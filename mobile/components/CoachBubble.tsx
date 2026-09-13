import React, { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import CoachMascot from './CoachMascot';
import {
  CoachMood,
  CoachBehavior,
  CoachPosition,
  CoachIntensity,
  MascotAssetKey,
} from '../constants/coachAnimation';
import { FontSize, FontWeight, Spacing } from '../constants/theme';

export interface CoachBubbleHandle {
  skip: () => void;
}

interface CoachBubbleProps {
  title?: string;
  subtitle?: string;
  message?: string;
  // Semantic character props
  assetKey?: MascotAssetKey;
  mood?: CoachMood;
  behavior?: CoachBehavior;
  position?: CoachPosition;
  intensity?: CoachIntensity;
  isKeyboardVisible?: boolean;
  isReducedMotion?: boolean;
  canTap?: boolean;
  onMascotTap?: () => void;
  mascotSize?: number;
  // Backwards compatibility props
  typewriter?: boolean;
  typewriterSpeed?: number;
  adaptiveSpeed?: boolean;
  maxDuration?: number;
  onTypeComplete?: () => void;
  variant?: 'compact' | 'expanded';
  mascotState?: 'idle' | 'worry' | 'streak' | 'sleep' | 'flex';
}

const CoachBubbleRender: React.ForwardRefRenderFunction<CoachBubbleHandle, CoachBubbleProps> = ({
  title,
  subtitle,
  message,
  assetKey,
  mood = 'neutral',
  behavior = 'listen',
  position = 'topCenter',
  intensity = 'idle',
  isKeyboardVisible = false,
  isReducedMotion = false,
  canTap = true,
  onMascotTap,
  mascotSize,
  mascotState,
}, ref) => {
  useImperativeHandle(ref, () => ({
    skip: () => {},
  }));

  const effectiveAssetKey: MascotAssetKey =
    assetKey ||
    (mascotState === 'sleep' ? 'sleep' : (mascotState as MascotAssetKey)) ||
    'idle';

  const headingText = title || message || '';

  const textFade = useRef(new Animated.Value(1)).current;
  const prevHeadingRef = useRef(headingText);

  useEffect(() => {
    if (prevHeadingRef.current !== headingText) {
      prevHeadingRef.current = headingText;
      textFade.setValue(0.2);
      Animated.timing(textFade, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [headingText, textFade]);

  return (
    <View style={styles.container}>
      <View style={styles.mascotStage}>
        <CoachMascot
          assetKey={effectiveAssetKey}
          mood={mood}
          behavior={behavior}
          position={position}
          intensity={intensity}
          isKeyboardVisible={isKeyboardVisible}
          isReducedMotion={isReducedMotion}
          canTap={canTap}
          onTap={onMascotTap}
          size={mascotSize}
        />
      </View>
      <Animated.View style={[styles.textWrap, { opacity: textFade }]}>
        <Text style={styles.titleText}>{headingText}</Text>
        {subtitle ? <Text style={styles.subtitleText}>{subtitle}</Text> : null}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  mascotStage: {
    height: 200,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: Spacing.xs,
  },
  textWrap: {
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.xs,
  },
  titleText: {
    fontSize: 24,
    fontWeight: FontWeight.bold,
    color: '#1F2937',
    textAlign: 'center',
    letterSpacing: -0.3,
    lineHeight: 32,
  },
  subtitleText: {
    fontSize: FontSize.md,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 22,
    fontWeight: FontWeight.medium,
  },
});

const CoachBubble = forwardRef(CoachBubbleRender);
export default CoachBubble;
