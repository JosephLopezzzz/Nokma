import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Animated, Dimensions, Modal, ScrollView, Image, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Rect, Mask, LinearGradient, Stop } from 'react-native-svg';
import { Spacing, Radius } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { scanNutritionFactsProgressive, ProgressiveNutritionData, createEmptyNutritionData } from '../services/nutritionScanner';

interface ScannerCameraProps {
  visible: boolean;
  onCapture: (data: ProgressiveNutritionData) => void;
  onClose: () => void;
}

const { width, height } = Dimensions.get('window');
const SCANNER_SIZE = width * 0.75;
const SCANNER_RADIUS = 32;

export default function ScannerCamera({ visible, onCapture, onClose }: ScannerCameraProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scannedData, setScannedData] = useState<ProgressiveNutritionData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const maskOpacityAnim = useRef(new Animated.Value(1)).current;
  const cameraRef = useRef<CameraView>(null);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  
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
    if (visible && permission?.granted && !isProcessing) {
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
  }, [visible, permission, isProcessing]);

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

  const takePicture = async () => {
    if (cameraRef.current && !isProcessing) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsProcessing(true);
      setErrorMsg(null);
      setScannedData(createEmptyNutritionData());
      try {
        const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.1 });
        if (photo?.base64 && photo?.uri) {
          setCapturedImage(photo.uri);
          const finalData = await scanNutritionFactsProgressive(photo.base64, (partialData) => {
            setScannedData({ ...partialData });
          });
          // Small delay for user to read the final screen before dismissing
          setTimeout(() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setIsProcessing(false);
            setScannedData(null);
            setCapturedImage(null);
            onCapture(finalData);
          }, 1200);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setIsProcessing(false);
          setScannedData(null);
          setCapturedImage(null);
          setErrorMsg('Failed to capture image. Please try again.');
        }
      } catch (err: any) {
        const errorMessage = err?.message || '';
        if (!errorMessage.includes('503') && !errorMessage.includes('high demand') && !errorMessage.includes('429')) {
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
        } else {
          setErrorMsg("Couldn't read the label. Try moving closer or improving lighting.");
        }
      }
    }
  };

  const renderProgressiveFields = () => {
    if (!scannedData) return null;
    
    const fields = [
      { key: 'calories', label: 'Calories', data: scannedData.nutrition.calories },
      { key: 'total_fat', label: 'Total Fat', data: scannedData.nutrition.total_fat },
      { key: 'saturated_fat', label: 'Saturated Fat', data: scannedData.nutrition.saturated_fat },
      { key: 'total_carbohydrates', label: 'Carbs', data: scannedData.nutrition.total_carbohydrates },
      { key: 'dietary_fiber', label: 'Fiber', data: scannedData.nutrition.dietary_fiber },
      { key: 'total_sugars', label: 'Sugars', data: scannedData.nutrition.total_sugars },
      { key: 'protein', label: 'Protein', data: scannedData.nutrition.protein },
      { key: 'sodium', label: 'Sodium', data: scannedData.nutrition.sodium },
    ];

    return (
      <View style={styles.progressiveContainer}>
        <Text style={styles.progressiveTitle}>Scanning Nutrition...</Text>
        <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {fields.map(f => (
            <ProgressiveField key={f.key} label={f.label} data={f.data} />
          ))}
        </ScrollView>
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
                y={(height - SCANNER_SIZE) / 2 - 40} 
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
            <TouchableOpacity onPress={onClose} style={styles.iconBtn} disabled={isProcessing}>
              <Ionicons name="close" size={28} color="white" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>AI Scanner</Text>
              <Text style={styles.headerSubtitle}>Scan Nutrition Facts</Text>
            </View>
            <TouchableOpacity onPress={() => setIsTorchOn(!isTorchOn)} style={styles.iconBtn} disabled={isProcessing}>
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
              
              {/* Ghost Label Outline */}
              <View style={styles.ghostLabel} pointerEvents="none">
                <View style={[styles.ghostLine, { height: 6, width: '100%', marginBottom: 8 }]} />
                <View style={[styles.ghostLine, { width: '100%' }]} />
                <View style={[styles.ghostLine, { width: '80%' }]} />
                <View style={[styles.ghostLine, { width: '90%' }]} />
                <View style={[styles.ghostLine, { width: '100%' }]} />
                <View style={[styles.ghostLine, { width: '70%' }]} />
                <View style={[styles.ghostLine, { height: 4, width: '100%', marginTop: 8 }]} />
              </View>

              {/* Laser Animation */}
              {!isProcessing && (
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

function ProgressiveField({ label, data }: { label: string; data: { value: number | null, unit: string } }) {
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
          <Text style={styles.progressiveValue}>{data.value} {data.unit}</Text>
          <Ionicons name="checkmark-circle" size={18} color="#4cd964" style={{ marginLeft: 6 }} />
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
    top: (height - SCANNER_SIZE) / 2 - 40,
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
});
