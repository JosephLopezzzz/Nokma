import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Confetti from './Confetti';
import { useLanguage } from '../context/LanguageContext';
import type { StringKey } from '../constants/i18n';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../constants/theme';
import AnimatedPressable from './AnimatedPressable';

const TUTORIAL_KEY = 'nokma_tutorial_complete';

export interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
  rx: number;
  ry: number;
}

export interface TutorialTargetRefs {
  fabRef: React.RefObject<View | null>;
  trackerRef: React.RefObject<View | null>;
  coachRef: React.RefObject<View | null>;
  scrollContentRef?: React.RefObject<View | null>;
}

function SpotlightCutout({
  rect,
  screenW,
  screenH,
}: {
  rect: SpotlightRect;
  screenW: number;
  screenH: number;
}) {
  const PAD = 6;
  const BORDER_SIZE = 4000;

  // The actual hole size (padded)
  const holeWidth = rect.width + 2 * PAD;
  const holeHeight = rect.height + 2 * PAD;
  const holeLeft = rect.left - PAD;
  const holeTop = rect.top - PAD;
  const holeRadius = rect.rx + PAD;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* 
        Massive border trick: 
        Creates a perfect transparent hole using a single View's borders.
        The inner hole sits exactly at holeLeft/holeTop.
      */}
      <View
        style={{
          position: 'absolute',
          left: holeLeft - BORDER_SIZE,
          top: holeTop - BORDER_SIZE,
          width: holeWidth + 2 * BORDER_SIZE,
          height: holeHeight + 2 * BORDER_SIZE,
          borderWidth: BORDER_SIZE,
          borderColor: 'rgba(31, 41, 55, 0.75)',
          borderRadius: holeRadius + BORDER_SIZE,
        }}
      />

      {/* Dashed white border around the hole */}
      <View
        style={{
          position: 'absolute',
          top: holeTop,
          left: holeLeft,
          width: holeWidth,
          height: holeHeight,
          borderRadius: holeRadius,
          borderWidth: 2,
          borderColor: '#FFFFFF',
          borderStyle: 'dashed',
        }}
      />
    </View>
  );
}

interface DashboardTutorialProps {
  visible: boolean;
  onComplete: () => void;
  targetRefs: TutorialTargetRefs;
  userName?: string;
  scrollViewRef?: React.RefObject<ScrollView | null>;
}

export default function DashboardTutorial({
  visible,
  onComplete,
  targetRefs,
  userName,
  scrollViewRef,
}: DashboardTutorialProps) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const isMeasuring = useRef(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const { width: screenW, height: screenH } = Dimensions.get('window');

  const name = userName?.split(' ')[0] || t('coach.friend');

  const steps: {
    titleKey: StringKey;
    messageKey: StringKey;
    getRef: () => React.RefObject<View | null> | null;
    scrollTo?: number;
  }[] = [
    {
      titleKey: 'tutorial.welcome.title',
      messageKey: 'tutorial.welcome.body',
      getRef: () => null,
    },
    {
      titleKey: 'tutorial.log.title',
      messageKey: 'tutorial.log.body',
      getRef: () => targetRefs.fabRef,
    },
    {
      titleKey: 'tutorial.track.title',
      messageKey: 'tutorial.track.body',
      getRef: () => targetRefs.trackerRef,
    },
    {
      titleKey: 'tutorial.coach.title',
      messageKey: 'tutorial.coach.body',
      getRef: () => targetRefs.coachRef,
    },
    {
      titleKey: 'tutorial.ready.title',
      messageKey: 'tutorial.ready.body',
      getRef: () => null,
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;
  const isFirst = step === 0;

  const measureTarget = useCallback(
    (ref: React.RefObject<View | null> | null): Promise<SpotlightRect | null> => {
      return new Promise((resolve) => {
        if (!ref?.current) {
          resolve(null);
          return;
        }
        // Use measure to get pageX/pageY which includes status bar and is absolute to screen
        ref.current.measure((x: number, y: number, w: number, h: number, pageX: number, pageY: number) => {
          if (w === 0 && h === 0) {
            resolve(null);
            return;
          }
          resolve({ top: pageY, left: pageX, width: w, height: h, rx: 16, ry: 16 });
        });
      });
    },
    [],
  );

  const goTo = useCallback(
    async (next: number) => {
      if (isMeasuring.current) return;
      isMeasuring.current = true;

      setStep(next);
      setSpotlight(null);

      const target = steps[next];
      const ref = target?.getRef?.();
      if (!ref) {
        isMeasuring.current = false;
        return;
      }

      if (ref.current && scrollViewRef?.current && targetRefs.scrollContentRef?.current) {
        // Find element's position relative to ScrollView content using native View ref
        await new Promise<void>((resolve) => {
          ref.current?.measureLayout(
            targetRefs.scrollContentRef!.current!,
            (left, top, width, height) => {
              // Scroll so the element is roughly centered or in the top third
              const targetScroll = Math.max(0, top - screenH / 4);
              scrollViewRef.current?.scrollTo({ y: targetScroll, animated: true });
              resolve();
            },
            () => resolve() // on fail, just continue
          );
        });
        
        // Wait for scroll animation to completely finish and bounce to settle
        await new Promise((resolve) => setTimeout(resolve, 600));
      }

      let rect = await measureTarget(ref);
      if (!rect) {
        // Wait and retry once
        await new Promise((resolve) => setTimeout(resolve, 300));
        rect = await measureTarget(ref);
      }

      if (rect) {
        setSpotlight(rect);
      } else {
        const fallbackRect = {
          top: screenH / 2 - 40,
          left: screenW / 2 - 40,
          width: 80,
          height: 80,
          rx: 8,
          ry: 8,
        };
        setSpotlight(fallbackRect);
      }

      isMeasuring.current = false;
    },
    [measureTarget, scrollViewRef, screenH, screenW],
  );

  // Reset
  useEffect(() => {
    if (!visible) {
      setStep(0);
      setSpotlight(null);
      setShowConfetti(false);
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
    }
  }, [visible]);

  // Animate step transitions
  useEffect(() => {
    if (!visible) return;
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.9);
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [step, visible]);

  // Launch confetti on last step
  useEffect(() => {
    if (isLast && visible) {
      const t = setTimeout(() => setShowConfetti(true), 500);
      return () => clearTimeout(t);
    } else {
      setShowConfetti(false);
    }
  }, [isLast, visible]);

  const handleComplete = async () => {
    try {
      await AsyncStorage.setItem(TUTORIAL_KEY, 'true');
    } catch {}
    onComplete();
  };

  const handleSkip = () => handleComplete();

  if (!visible) return null;

  // Calculate tooltip placement
  const FOOTER_HEIGHT = 60 + Math.max(insets.bottom, 16); // sticky footer reserve
  const spaceAbove = spotlight ? spotlight.top : 0;
  const spaceBelow = spotlight ? screenH - (spotlight.top + spotlight.height) : 0;
  
  // Prefer placing it where there is more space
  const isTopPlacement = spotlight && spaceAbove > spaceBelow;
  
  const tooltipStyle: any = {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    opacity: fadeAnim,
    transform: [{ scale: scaleAnim }],
  };

  // Compute maxHeight so the card never overlaps the sticky footer
  let cardMaxHeight: number | undefined;

  if (spotlight) {
    if (isTopPlacement) {
      // Place ABOVE the spotlight
      tooltipStyle.bottom = screenH - spotlight.top + Spacing.sm;
      // Available space = from top of screen to bottom of card
      cardMaxHeight = spotlight.top - Spacing.sm - Spacing.md;
    } else {
      // Place BELOW the spotlight
      const cardTop = spotlight.top + spotlight.height + Spacing.sm;
      tooltipStyle.top = cardTop;
      // Available space = from card top to footer top
      cardMaxHeight = screenH - cardTop - FOOTER_HEIGHT - Spacing.sm;
    }
  } else {
    // Center it if there's no spotlight
    tooltipStyle.top = screenH / 2 - 120;
    cardMaxHeight = screenH - (screenH / 2 - 120) - FOOTER_HEIGHT - Spacing.sm;
  }

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.root}>
        {spotlight ? (
          <SpotlightCutout rect={spotlight} screenW={screenW} screenH={screenH} />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(31, 41, 55, 0.75)' },
            ]}
            pointerEvents="none"
          />
        )}

        <Confetti active={showConfetti} />

        {/* Floating Tooltip Card — content only, scrollable */}
        <Animated.View style={[
          styles.coachCard,
          tooltipStyle,
          spotlight ? { paddingTop: Spacing.lg } : null,
          cardMaxHeight ? { maxHeight: Math.max(cardMaxHeight, 120) } : null,
          { zIndex: 9999 },
        ]}>
          
          {/* Caret pointing to spotlight */}
          {spotlight && isTopPlacement && (
            <View style={[styles.caretContainer, { bottom: -14 }]}>
              <View style={[styles.caret, styles.caretBottomOuter]} />
              <View style={[styles.caret, styles.caretBottomInner]} />
            </View>
          )}
          {spotlight && !isTopPlacement && (
            <View style={[styles.caretContainer, { top: -14 }]}>
              <View style={[styles.caret, styles.caretTopOuter]} />
              <View style={[styles.caret, styles.caretTopInner]} />
            </View>
          )}

          {/* Large floating mascot — only on steps without a spotlight */}
          {!spotlight && (
            <View style={styles.mascotStage}>
              <Image
                source={require('../assets/mascot/idle.gif')}
                style={styles.mascotLarge}
                contentFit="contain"
              />
            </View>
          )}

          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.contentWrap}
          >
            <Text style={styles.title}>{t(current.titleKey)}</Text>
            <Text style={styles.message}>{t(current.messageKey, { name })}</Text>
          </ScrollView>
        </Animated.View>

        {/* Sticky navigation footer — always pinned to the bottom */}
        <Animated.View style={[styles.stickyFooter, { opacity: fadeAnim, paddingBottom: Math.max(insets.bottom, 16), zIndex: 9999 }]}>
          <Pressable onPress={handleSkip} style={({pressed}) => [styles.skipBtn, pressed && {opacity: 0.7}]}>
            <Text style={styles.skipText}>{t('common.skip')}</Text>
          </Pressable>

          <View style={styles.dotsRow}>
            {steps.map((_, i) => (
              <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
            ))}
          </View>

          <View style={styles.navGroup}>
            {!isFirst && (
              <AnimatedPressable
                style={styles.navBtn}
                onPress={() => goTo(step - 1)}
                scaleTo={0.95}
              >
                <Text style={styles.navBtnText}>{t('common.back')}</Text>
              </AnimatedPressable>
            )}
            {isLast ? (
              <AnimatedPressable
                style={[styles.navBtn, styles.doneBtn]}
                onPress={handleComplete}
                scaleTo={0.95}
              >
                <Text style={styles.doneBtnText}>{t('common.done')}</Text>
              </AnimatedPressable>
            ) : (
              <AnimatedPressable
                style={[styles.navBtn, styles.nextBtn]}
                onPress={() => goTo(step + 1)}
                scaleTo={0.95}
              >
                <Text style={styles.nextBtnText}>{t('common.next')}</Text>
              </AnimatedPressable>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

export async function isTutorialComplete(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(TUTORIAL_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function resetTutorial(): Promise<void> {
  try {
    await AsyncStorage.removeItem(TUTORIAL_KEY);
  } catch {}
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  curtain: {
    position: 'absolute',
    backgroundColor: 'rgba(31, 41, 55, 0.75)',
  },
  coachCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    paddingTop: 50, // Space for the floating mascot
    gap: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  mascotStage: {
    position: 'absolute',
    top: -65,
    alignSelf: 'center',
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mascotLarge: {
    width: 110,
    height: 110,
  },
  caretContainer: {
    position: 'absolute',
    alignSelf: 'center',
    width: 28,
    height: 14,
  },
  caret: {
    position: 'absolute',
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
  },
  caretTopOuter: {
    top: 0,
    borderLeftWidth: 14,
    borderRightWidth: 14,
    borderBottomWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: Colors.primary,
  },
  caretTopInner: {
    top: 3, // inner triangle shifted down to expose top border
    borderLeftWidth: 11,
    borderRightWidth: 11,
    borderBottomWidth: 11,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFFFFF',
  },
  caretBottomOuter: {
    bottom: 0,
    borderLeftWidth: 14,
    borderRightWidth: 14,
    borderTopWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: Colors.primary,
  },
  caretBottomInner: {
    bottom: 3,
    borderLeftWidth: 11,
    borderRightWidth: 11,
    borderTopWidth: 11,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
  },
  contentWrap: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: 'rgba(31, 41, 55, 0.92)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 24,
    borderRadius: 4,
  },
  skipBtn: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  navGroup: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  navBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
  },
  navBtnText: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    fontWeight: FontWeight.semibold,
  },
  nextBtn: {
    backgroundColor: Colors.primary,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
  },
  doneBtn: {
    backgroundColor: Colors.primary,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
  },
});