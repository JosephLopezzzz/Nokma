import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Animated, Dimensions, Modal, ScrollView, Image, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Rect, Mask, LinearGradient, Stop } from 'react-native-svg';
import { Spacing, Radius } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import {
  scanNutritionFactsProgressive,
  scanMenuItemProgressive,
  lowestConfidence,
  SCAN_ABORTED,
  ProgressiveNutritionData,
  NutritionField,
  createEmptyNutritionData,
} from '../services/nutritionScanner';

export type ScannerMode = 'label' | 'menu';

interface ScannerCameraProps {
  visible: boolean;
  onCapture: (data: ProgressiveNutritionData) => void;
  onClose: () => void;
  /**
   * 'label' reads a printed nutrition facts panel (default).
   * 'menu' identifies a restaurant menu item and estimates its macros.
   */
  mode?: ScannerMode;
}

type ModeCopy = {
  title: string;
  subtitle: string;
  progressTitle: string;
  failure: string;
  /**
   * How far past the guide box to crop, as a multiple of its size. A label is
   * self-contained so we crop tight; identifying a menu item benefits from the
   * surrounding context (branding, adjacent prices), so we keep a margin.
   */
  cropPadding: number;
};

const MODE_COPY: Record<ScannerMode, ModeCopy> = {
  label: {
    title: 'AI Scanner',
    subtitle: 'Scan Nutrition Facts',
    progressTitle: 'Scanning Nutrition...',
    failure: "Couldn't read the label. Try moving closer or improving lighting.",
    cropPadding: 1.05,
  },
  menu: {
    title: 'Menu Scanner',
    subtitle: 'Point at a menu item',
    progressTitle: 'Identifying Item...',
    failure: "Couldn't identify a menu item. Try a clearer shot of the item name.",
    cropPadding: 1.35,
  },
};

const { width, height } = Dimensions.get('window');
const SCANNER_SIZE = width * 0.75;
const SCANNER_RADIUS = 32;
/** Vertical nudge applied to the cutout box; must stay in sync with the SVG mask. */
const SCANNER_OFFSET_Y = -40;
/** Past this the model gains nothing and the upload just gets slower. */
const MAX_UPLOAD_EDGE = 1280;

/** Confidence tiers, used to colour the per-field indicator. */
const CONFIDENCE_OK = 0.8;
const CONFIDENCE_WEAK = 0.5;

function confidenceStyle(confidence: number) {
  if (confidence >= CONFIDENCE_OK) return { color: '#4cd964', icon: 'checkmark-circle' as const };
  if (confidence >= CONFIDENCE_WEAK) return { color: '#ffcc00', icon: 'alert-circle' as const };
  return { color: '#ff9500', icon: 'help-circle' as const };
}

/**
 * The preview covers the screen, so the sensor image extends past what the user
 * actually framed. Map the on-screen cutout box back into photo pixel coordinates
 * so we upload only the framed region instead of the whole frame.
 */
function cutoutCropRect(photoW: number, photoH: number, padding: number) {
  // 'cover' fit: the photo is scaled until it fills the screen, overflow clipped off the
  // long axis. Covering needs photo/scale >= screen on both axes, so take the smaller ratio.
  const scale = Math.min(photoW / width, photoH / height);
  const clippedX = (photoW / scale - width) / 2;
  const clippedY = (photoH / scale - height) / 2;

  const boxSize = SCANNER_SIZE * padding;
  const boxX = (width - boxSize) / 2;
  const boxY = (height - boxSize) / 2 + SCANNER_OFFSET_Y;

  // Padding can push the rect past the sensor edge, so clamp rather than fail.
  const originX = Math.max(0, Math.round((boxX + clippedX) * scale));
  const originY = Math.max(0, Math.round((boxY + clippedY) * scale));
  const cropW = Math.round(Math.min(boxSize * scale, photoW - originX));
  const cropH = Math.round(Math.min(boxSize * scale, photoH - originY));

  if (cropW < 64 || cropH < 64) return null;
  return { originX, originY, width: cropW, height: cropH };
}

/**
 * Crops the capture to the guide box and re-encodes it at a size worth sending.
 * Falls back to the uncropped frame if the geometry doesn't work out.
 */
async function prepareImage(uri: string, photoW: number, photoH: number, padding: number) {
  const ctx = ImageManipulator.manipulate(uri);
  const rect = cutoutCropRect(photoW, photoH, padding);
  if (rect) ctx.crop(rect);

  const outW = rect ? rect.width : photoW;
  const outH = rect ? rect.height : photoH;
  if (Math.max(outW, outH) > MAX_UPLOAD_EDGE) {
    // resize() preserves the ratio from whichever edge we pin, so pin the longer one.
    ctx.resize(outW >= outH ? { width: MAX_UPLOAD_EDGE } : { height: MAX_UPLOAD_EDGE });
  }

  const rendered = await ctx.renderAsync();
  return rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
}

export default function ScannerCamera({ visible, onCapture, onClose, mode = 'label' }: ScannerCameraProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scannedData, setScannedData] = useState<ProgressiveNutritionData | null>(null);
  /** Set once a scan resolves, so the user can check the values before they're used. */
  const [reviewData, setReviewData] = useState<ProgressiveNutritionData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const maskOpacityAnim = useRef(new Animated.Value(1)).current;
  const cameraRef = useRef<CameraView>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const copy = MODE_COPY[mode];
  
  // Laser animation goes from -100 (above) to SCANNER_SIZE
  const laserAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    Animated.timing(maskOpacityAnim, {
      toValue: capturedImage ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [capturedImage, maskOpacityAnim]);

  useEffect(() => {
    if (visible && permission?.granted && !isProcessing && !reviewData) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, {
            toValue: SCANNER_SIZE,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(laserAnim, {
            toValue: -100,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      laserAnim.stopAnimation();
      laserAnim.setValue(-100);
    }
  }, [visible, permission, isProcessing, reviewData]);

  // A scan outliving the component would resolve into unmounted state, so cut it loose.
  useEffect(() => () => abortRef.current?.abort(), []);

  if (!visible) return null;

  if (!permission) {
    return <Modal visible={visible} transparent={false}><View style={styles.container} /></Modal>;
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide" transparent={false}>
        <View style={[styles.container, { backgroundColor: colors.bg, padding: Spacing.xl, justifyContent: 'center' }]}>
          <Text style={[styles.message, { color: colors.textPrimary }]}>We need your permission to show the camera</Text>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={requestPermission}>
            <Text style={styles.btnText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.closeBtn, { marginTop: Spacing.lg }]} onPress={onClose}>
            <Text style={{ color: colors.textSecondary }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  /** Back to a live camera, with nothing in flight. */
  const resetToCamera = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsProcessing(false);
    setScannedData(null);
    setReviewData(null);
    setCapturedImage(null);
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetToCamera();
    setErrorMsg(null);
  };

  const handleClose = () => {
    resetToCamera();
    setErrorMsg(null);
    onClose();
  };

  const handleAcceptReview = () => {
    if (!reviewData) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const data = reviewData;
    resetToCamera();
    onCapture(data);
  };

  const takePicture = async () => {
    if (cameraRef.current && !isProcessing) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsProcessing(true);
      setErrorMsg(null);
      setReviewData(null);
      setScannedData(createEmptyNutritionData());

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // Capture at high quality, then crop to the guide box — a tight, sharp crop
        // reads far better than a soft full frame of the same byte size.
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
        if (controller.signal.aborted) return;
        if (!photo?.uri) throw new Error('capture-failed');

        setCapturedImage(photo.uri);
        const prepared = await prepareImage(photo.uri, photo.width, photo.height, copy.cropPadding);
        if (controller.signal.aborted) return;
        if (!prepared.base64) throw new Error('capture-failed');

        const scan = mode === 'menu' ? scanMenuItemProgressive : scanNutritionFactsProgressive;
        const finalData = await scan(
          prepared.base64,
          (partialData) => setScannedData({ ...partialData }),
          controller.signal
        );

        if (finalData.nutrition.calories?.value === null) {
          throw new Error('no-food-found');
        }

        // Hand off to review rather than auto-dismissing — the user gets to see what
        // was read, and how sure the model is, before it lands in their log.
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsProcessing(false);
        setScannedData(null);
        setReviewData(finalData);
      } catch (err: any) {
        const errorMessage = err?.message || '';

        // Cancelling isn't a failure; the UI has already been reset by handleCancel.
        if (errorMessage === SCAN_ABORTED || controller.signal.aborted) return;

        const expected = ['503', 'high demand', '429', 'no-food-found', 'capture-failed'];
        if (!expected.some((m) => errorMessage.includes(m))) {
          console.error('Camera error:', err);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setIsProcessing(false);
        setScannedData(null);
        setCapturedImage(null);

        if (errorMessage.includes('503') || errorMessage.includes('high demand')) {
          setErrorMsg('The AI service is experiencing high demand. Please try again later or log manually.');
        } else if (errorMessage.includes('429')) {
          setErrorMsg('Rate limit exceeded. Please wait a moment and try again.');
        } else if (errorMessage === 'capture-failed') {
          setErrorMsg('Failed to capture image. Please try again.');
        } else {
          setErrorMsg(copy.failure);
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    }
  };

  const fieldsFor = (data: ProgressiveNutritionData) => {
    const fields = [
      { key: 'calories', label: 'Calories', data: data.nutrition.calories },
      { key: 'total_fat', label: 'Total Fat', data: data.nutrition.total_fat },
      { key: 'saturated_fat', label: 'Saturated Fat', data: data.nutrition.saturated_fat },
      { key: 'total_carbohydrates', label: 'Carbs', data: data.nutrition.total_carbohydrates },
      { key: 'dietary_fiber', label: 'Fiber', data: data.nutrition.dietary_fiber },
      { key: 'total_sugars', label: 'Sugars', data: data.nutrition.total_sugars },
      { key: 'protein', label: 'Protein', data: data.nutrition.protein },
      { key: 'sodium', label: 'Sodium', data: data.nutrition.sodium },
    ];

    // Serving size drives the whole macro calculation for a menu item, so surface it.
    if (mode === 'menu') {
      fields.unshift({ key: 'serving_size', label: 'Serving', data: data.serving_size });
    }
    return fields;
  };

  const renderIdentity = (data: ProgressiveNutritionData) =>
    data.product_name ? (
      <Text style={styles.progressiveProductName} numberOfLines={2}>
        {data.product_name}
        {data.restaurant_name ? ` · ${data.restaurant_name}` : ''}
      </Text>
    ) : null;

  const renderProgressiveFields = () => {
    if (!scannedData) return null;

    return (
      <View style={styles.progressiveContainer}>
        <Text style={styles.progressiveTitle}>{copy.progressTitle}</Text>
        {renderIdentity(scannedData)}
        <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {fieldsFor(scannedData).map(f => (
            <ProgressiveField key={f.key} label={f.label} data={f.data} />
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.cancelScanBtn} onPress={handleCancel}>
          <Text style={styles.cancelScanText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderReview = () => {
    if (!reviewData) return null;

    const weakest = lowestConfidence(reviewData);
    const source = reviewData.is_estimate
      ? 'Estimated from known data'
      : 'Read from printed values';

    return (
      <View style={styles.progressiveContainer}>
        <Text style={styles.progressiveTitle}>Check these values</Text>
        {renderIdentity(reviewData)}

        <View style={styles.sourceRow}>
          <Ionicons
            name={reviewData.is_estimate ? 'sparkles' : 'document-text'}
            size={14}
            color={confidenceStyle(weakest).color}
          />
          <Text style={[styles.sourceText, { color: confidenceStyle(weakest).color }]}>
            {source}
            {weakest < CONFIDENCE_WEAK ? ' · low confidence' : ''}
          </Text>
        </View>

        <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {fieldsFor(reviewData).map(f => (
            <ProgressiveField key={f.key} label={f.label} data={f.data} />
          ))}
        </ScrollView>

        <View style={styles.reviewBtnRow}>
          <TouchableOpacity style={styles.retakeBtn} onPress={handleCancel}>
            <Ionicons name="camera-reverse-outline" size={18} color="white" />
            <Text style={styles.btnText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.useBtn, { backgroundColor: colors.primary }]}
            onPress={handleAcceptReview}
          >
            <Ionicons name="checkmark" size={18} color="white" />
            <Text style={styles.btnText}>Use values</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        <CameraView style={StyleSheet.absoluteFillObject} ref={cameraRef} facing="back" enableTorch={isTorchOn} />
        
        {capturedImage && (
          <Image source={{ uri: capturedImage }} style={StyleSheet.absoluteFillObject} />
        )}
          
        {/* True Cutout Overlay using SVG Mask */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: maskOpacityAnim }]} pointerEvents="none">
          <Svg style={StyleSheet.absoluteFill}>
            <Defs>
            <Mask id="mask">
              <Rect x={0} y={0} width="100%" height="100%" fill="white" />
              <Rect
                x={(width - SCANNER_SIZE) / 2}
                y={(height - SCANNER_SIZE) / 2 + SCANNER_OFFSET_Y}
                width={SCANNER_SIZE}
                height={SCANNER_SIZE}
                rx={SCANNER_RADIUS}
                fill="black"
              />
            </Mask>
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" fill="rgba(0,0,0,0.7)" mask="url(#mask)" />
        </Svg>
      </Animated.View>

      <View style={[StyleSheet.absoluteFillObject, styles.uiLayer]}>
          {/* Top Bar */}
          <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
            <TouchableOpacity onPress={handleClose} style={styles.iconBtn}>
              <Ionicons name="close" size={28} color="white" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>{copy.title}</Text>
              <Text style={styles.headerSubtitle}>{copy.subtitle}</Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsTorchOn(!isTorchOn)}
              style={styles.iconBtn}
              disabled={isProcessing || !!reviewData}
            >
              <Ionicons name={isTorchOn ? "flash" : "flash-outline"} size={28} color="white" />
            </TouchableOpacity>
          </View>

          {/* Scanner Box Area (absolutely positioned to match SVG hole) */}
          <View style={styles.scannerArea}>
            <View style={styles.scannerBox}>
              {/* Corner Brackets */}
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
              
              {/* Ghost Label Outline — mimics a nutrition panel, so label mode only */}
              {mode === 'label' && (
                <View style={styles.ghostLabel} pointerEvents="none">
                  <View style={[styles.ghostLine, { height: 6, width: '100%', marginBottom: 8 }]} />
                  <View style={[styles.ghostLine, { width: '100%' }]} />
                  <View style={[styles.ghostLine, { width: '80%' }]} />
                  <View style={[styles.ghostLine, { width: '90%' }]} />
                  <View style={[styles.ghostLine, { width: '100%' }]} />
                  <View style={[styles.ghostLine, { width: '70%' }]} />
                  <View style={[styles.ghostLine, { height: 4, width: '100%', marginTop: 8 }]} />
                </View>
              )}

              {/* Laser Animation */}
              {!isProcessing && !reviewData && (
                <Animated.View
                  style={[
                    styles.laserContainer,
                    { transform: [{ translateY: laserAnim }] },
                  ]}
                >
                  <Svg width="100%" height="100%">
                    <Defs>
                      <LinearGradient id="laserGrad" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={colors.primary} stopOpacity="0" />
                        <Stop offset="0.9" stopColor={colors.primary} stopOpacity="0.4" />
                        <Stop offset="1" stopColor={colors.primary} stopOpacity="1" />
                      </LinearGradient>
                    </Defs>
                    <Rect width="100%" height="100%" fill="url(#laserGrad)" />
                  </Svg>
                </Animated.View>
              )}
            </View>
          </View>

          {/* Bottom Bar / Progressive UI */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.xl }]}>
            {isProcessing ? (
              renderProgressiveFields()
            ) : reviewData ? (
              renderReview()
            ) : errorMsg ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMsg}</Text>
                <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary, marginTop: Spacing.md }]} onPress={() => setErrorMsg(null)}>
                  <Text style={styles.btnText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.captureBtn} 
                onPress={takePicture}
              >
                <View style={styles.captureBtnInner}>
                  <View style={[styles.captureBtnCore, { backgroundColor: colors.primary }]} />
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ProgressiveField({ label, data }: { label: string; data: NutritionField }) {
  const isFound = data.value !== null;
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isFound) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.spring(anim, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }).start();
    }
  }, [isFound]);

  // A confident read and a rough guess should not look identical.
  const tier = confidenceStyle(data.confidence);
  const isWeak = data.confidence < CONFIDENCE_OK;

  return (
    <View style={styles.progressiveRow}>
      <Text style={styles.progressiveLabel}>{label}</Text>
      {isFound ? (
        <Animated.View style={{
          flexDirection: 'row',
          alignItems: 'center',
          opacity: anim,
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }]
        }}>
          <Text style={styles.progressiveValue}>
            {isWeak ? '~' : ''}{data.value} {data.unit}
          </Text>
          <Ionicons name={tier.icon} size={18} color={tier.color} style={{ marginLeft: 6 }} />
        </Animated.View>
      ) : (
        <View style={styles.scanningDotRow}>
          <ActivityIndicator size="small" color="rgba(255,255,255,0.4)" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  uiLayer: { flex: 1, justifyContent: 'space-between' },
  errorContainer: { alignItems: 'center', paddingHorizontal: Spacing.xl },
  errorText: { color: '#ff6b6b', textAlign: 'center', fontSize: 16, fontWeight: '500' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg },
  iconBtn: { padding: Spacing.xs },
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 2 },
  scannerArea: {
    position: 'absolute',
    left: (width - SCANNER_SIZE) / 2,
    top: (height - SCANNER_SIZE) / 2 + SCANNER_OFFSET_Y,
    width: SCANNER_SIZE,
    height: SCANNER_SIZE,
  },
  scannerBox: { width: '100%', height: '100%', borderRadius: SCANNER_RADIUS, overflow: 'hidden' },
  corner: { position: 'absolute', width: 40, height: 40, borderColor: 'white' },
  topLeft: { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: SCANNER_RADIUS },
  topRight: { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: SCANNER_RADIUS },
  bottomLeft: { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: SCANNER_RADIUS },
  bottomRight: { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: SCANNER_RADIUS },
  ghostLabel: { position: 'absolute', top: 30, left: 30, right: 30, bottom: 30, justifyContent: 'space-evenly', opacity: 0.15 },
  ghostLine: { height: 2, backgroundColor: 'white', borderRadius: 2 },
  laserContainer: { position: 'absolute', left: 0, right: 0, height: 100 },
  footer: { alignItems: 'center', paddingTop: Spacing.xl, paddingHorizontal: Spacing.lg },
  captureBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255, 255, 255, 0.2)', alignItems: 'center', justifyContent: 'center' },
  captureBtnInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' },
  captureBtnCore: { width: 54, height: 54, borderRadius: 27 },
  message: { textAlign: 'center', paddingBottom: 10, fontSize: 16 },
  btn: { padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: 'bold' },
  closeBtn: { alignItems: 'center', padding: Spacing.sm },
  progressiveContainer: { width: '100%', backgroundColor: 'transparent', paddingHorizontal: Spacing.lg },
  progressiveTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: Spacing.md, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: {width: 0, height: 1}, textShadowRadius: 4 },
  progressiveProductName: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: -Spacing.sm,
    marginBottom: Spacing.md,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  progressiveRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingVertical: 12, 
    paddingHorizontal: 16,
    backgroundColor: 'rgba(30,30,30,0.7)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  progressiveLabel: { color: '#E5E7EB', fontSize: 15, fontWeight: '500' },
  progressiveValue: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  progressiveScanning: { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontStyle: 'italic' },
  scanningDotRow: { flexDirection: 'row', alignItems: 'center' },
  cancelScanBtn: { alignSelf: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl },
  cancelScanText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: Spacing.md,
  },
  sourceText: { fontSize: 13, fontWeight: '600' },
  reviewBtnRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  retakeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(60,60,60,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  useBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
  },
});
