import React, { forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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

  return (
    <View style={styles.container}>
      <View style={styles.mascotStage}>
        <View style={styles.backdropAngle} />
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
      <View style={styles.textWrap}>
        <Text style={styles.titleText}>{headingText}</Text>
        {subtitle ? <Text style={styles.subtitleText}>{subtitle}</Text> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  mascotStage: {
    height: 220,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: Spacing.xs,
  },
  backdropAngle: {
    position: 'absolute',
    top: 0,
    left: -20,
    right: -20,
    bottom: 20,
    backgroundColor: '#F3F4F6',
    borderBottomRightRadius: 40,
    transform: [{ rotate: '-3deg' }],
  },
  textWrap: {
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.xs,
  },
  titleText: {
    fontSize: 24,
    fontWeight: FontWeight.bold,
    color: '#111827',
    textAlign: 'center',
    letterSpacing: -0.4,
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
