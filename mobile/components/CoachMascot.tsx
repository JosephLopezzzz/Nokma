import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Pressable,
  Dimensions,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import {
  CoachMood,
  CoachBehavior,
  CoachPosition,
  CoachIntensity,
  MascotAssetKey,
  MASCOT_ASSETS,
  MASCOT_NORMALIZATION,
  COACH_TIMING,
} from '../constants/coachAnimation';

interface CoachMascotProps {
  assetKey: MascotAssetKey;
  mood?: CoachMood;
  behavior?: CoachBehavior;
  position?: CoachPosition;
  intensity?: CoachIntensity;
  isKeyboardVisible?: boolean;
  isReducedMotion?: boolean;
  canTap?: boolean;
  onTap?: () => void;
  size?: number;
  style?: any;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CoachMascot({
  assetKey,
  mood = 'neutral',
  behavior = 'listen',
  position = 'topCenter',
  intensity = 'idle',
  isKeyboardVisible = false,
  isReducedMotion = false,
  canTap = false,
  onTap,
  size,
  style,
}: CoachMascotProps) {
  const mascotSize = size ?? Math.min(220, Math.round(SCREEN_WIDTH * 0.52));
  // ─── Animated Values ────────────────────────────────────────────────────────
  const animX = useRef(new Animated.Value(0)).current;
  const animY = useRef(new Animated.Value(0)).current;
  const animScale = useRef(new Animated.Value(1)).current;
  const animRotate = useRef(new Animated.Value(0)).current; // In degrees
  const animOpacity = useRef(new Animated.Value(1)).current;

  // Active looping animation reference for clean cancellation
  const activeLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const normalization = MASCOT_NORMALIZATION[assetKey] || MASCOT_NORMALIZATION.idle;

  // ─── Stop any running loop cleanly ──────────────────────────────────────────
  const stopCurrentLoop = () => {
    if (activeLoopRef.current) {
      activeLoopRef.current.stop();
      activeLoopRef.current = null;
    }
  };

  // ─── Keyboard Avoidance ───────────────────────────────────────────────────
  useEffect(() => {
    Animated.parallel([
      Animated.timing(animScale, {
        toValue: isKeyboardVisible ? 0.76 : 1.0,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(animY, {
        toValue: isKeyboardVisible ? -22 : 0,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isKeyboardVisible, animScale, animY]);

  // ─── Position & Entrance Choreography ─────────────────────────────────────
  useEffect(() => {
    stopCurrentLoop();

    if (isReducedMotion) {
      animX.setValue(0);
      animOpacity.setValue(1);
      return;
    }

    if (position === 'peekLeft') {
      // Calculate exact offset using actual rendered mascot width (Correction 7)
      // Hide ~52% of the mascot off-screen, showing ~48%
      const restingPeekX = -Math.round(mascotSize * 0.52);
      const offscreenX = -Math.round(mascotSize + 40);

      animX.setValue(offscreenX);
      animOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(animOpacity, {
          toValue: 1,
          duration: COACH_TIMING.peek * 0.6,
          useNativeDriver: true,
        }),
        Animated.spring(animX, {
          toValue: restingPeekX,
          damping: 18,
          stiffness: 180,
          mass: 0.9,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (position === 'peekRight') {
      const restingPeekX = Math.round(mascotSize * 0.52);
      const offscreenX = Math.round(mascotSize + 40);

      animX.setValue(offscreenX);
      animOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(animOpacity, {
          toValue: 1,
          duration: COACH_TIMING.peek * 0.6,
          useNativeDriver: true,
        }),
        Animated.spring(animX, {
          toValue: restingPeekX,
          damping: 18,
          stiffness: 180,
          mass: 0.9,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Standard centered entrance
      animX.setValue(24);
      animOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(animOpacity, {
          toValue: 1,
          duration: COACH_TIMING.entrance,
          useNativeDriver: true,
        }),
        Animated.spring(animX, {
          toValue: 0,
          damping: 20,
          stiffness: 190,
          mass: 0.9,
          useNativeDriver: true,
        }),
      ]).start();
    }

    return () => {
      stopCurrentLoop();
    };
  }, [position, isReducedMotion, animX, animOpacity]);

  // ─── Behavior & Reaction Choreography ─────────────────────────────────────
  useEffect(() => {
    if (isReducedMotion || isKeyboardVisible) return;

    if (behavior === 'talk') {
      stopCurrentLoop();
      // Gentle subtle speaking bob (1.5px vertical movement)
      const talkLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(animY, {
            toValue: -2.5,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.timing(animY, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
          }),
        ])
      );
      activeLoopRef.current = talkLoop;
      talkLoop.start();
    } else if (behavior === 'listen') {
      stopCurrentLoop();
      // Gentle calm breathing cycle (~3.0s duration)
      const breathingLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(animScale, {
            toValue: 1.014,
            duration: COACH_TIMING.idleBreathing / 2,
            useNativeDriver: true,
          }),
          Animated.timing(animScale, {
            toValue: 1.0,
            duration: COACH_TIMING.idleBreathing / 2,
            useNativeDriver: true,
          }),
        ])
      );
      activeLoopRef.current = breathingLoop;
      breathingLoop.start();
    } else if (behavior === 'acknowledge') {
      stopCurrentLoop();
      // Friendly nod
      Animated.sequence([
        Animated.timing(animY, {
          toValue: 4,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.spring(animY, {
          toValue: 0,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (behavior === 'react') {
      stopCurrentLoop();
      // Tap or validation reaction: small head tilt and recover
      const tiltVal = mood === 'concerned' ? -4 : 4;
      Animated.sequence([
        Animated.timing(animRotate, {
          toValue: tiltVal,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(animRotate, {
          toValue: 0,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (behavior === 'celebrate') {
      stopCurrentLoop();
      // Hero celebratory jump and proud pump
      Animated.sequence([
        Animated.parallel([
          Animated.timing(animScale, {
            toValue: 1.12,
            duration: 280,
            useNativeDriver: true,
          }),
          Animated.timing(animY, {
            toValue: -14,
            duration: 280,
            useNativeDriver: true,
          }),
        ]),
        Animated.spring(animY, {
          toValue: 0,
          friction: 5,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.spring(animScale, {
          toValue: 1.05,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start();
    }

    return () => {
      stopCurrentLoop();
    };
  }, [behavior, mood, isReducedMotion, isKeyboardVisible, animY, animScale, animRotate]);

  // ─── Render Sizing & Normalized Positioning ───────────────────────────────
  // Using mathematically computed aspect ratios & scale multipliers to keep
  // character visual height and baseline perfectly uniform.
  const isSquare = normalization.aspectRatio === 1.0;
  const imageWidth = isSquare
    ? mascotSize
    : Math.round(mascotSize * normalization.aspectRatio * (normalization.scaleFactor / 1.6));
  const imageHeight = isSquare
    ? mascotSize
    : Math.round(mascotSize * (normalization.scaleFactor / 1.6));

  const scaleRatio = mascotSize / 180;
  const normalizedBaselineOffset = Math.round(normalization.baselineOffset * scaleRatio);
  const normalizedCenterOffset = Math.round(normalization.centerOffset * scaleRatio);

  const rotateInterpolate = animRotate.interpolate({
    inputRange: [-10, 0, 10],
    outputRange: ['-10deg', '0deg', '10deg'],
  });

  return (
    <Animated.View
      style={[
        styles.stage,
        {
          width: mascotSize,
          height: mascotSize,
          opacity: animOpacity,
          transform: [
            { translateX: animX },
            { translateY: animY },
            { scale: animScale },
            { rotate: rotateInterpolate },
          ],
        },
        position === 'peekLeft' && styles.stagePeekLeft,
        position === 'peekRight' && styles.stagePeekRight,
        style,
      ]}
      pointerEvents={canTap ? 'auto' : 'none'}
    >
      <Pressable
        onPress={onTap}
        disabled={!canTap}
        style={styles.pressableWrap}
        accessibilityRole={canTap ? 'button' : undefined}
        accessibilityLabel="Coach Hoo mascot"
      >
        <Image
          source={MASCOT_ASSETS[assetKey] || MASCOT_ASSETS.idle}
          style={[
            styles.mascotImage,
            {
              width: imageWidth,
              height: imageHeight,
              transform: [
                { translateY: normalizedBaselineOffset },
                { translateX: normalizedCenterOffset },
              ],
            },
          ]}
          contentFit="contain"
          priority="high"
          cachePolicy="memory-disk"
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  stagePeekLeft: {
    alignSelf: 'flex-start',
  },
  stagePeekRight: {
    alignSelf: 'flex-end',
  },
  pressableWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotImage: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
  },
});
