import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

interface AnimatedPressableProps extends PressableProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  scaleTo?: number;
  hapticStyle?: Haptics.ImpactFeedbackStyle | 'selection' | 'none' | 'Light' | 'Medium' | 'Heavy';
}

export default function AnimatedPressable({
  children,
  style,
  scaleTo = 0.95,
  hapticStyle = Haptics.ImpactFeedbackStyle.Light,
  onPressIn,
  onPressOut,
  onPress,
  ...props
}: AnimatedPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = (e: any) => {
    // Fire haptic
    if (Platform.OS !== 'web' && hapticStyle !== 'none') {
      if (hapticStyle === 'selection') {
        Haptics.selectionAsync().catch(() => {});
      } else {
        let styleToUse = hapticStyle;
        if (hapticStyle === 'Light') styleToUse = Haptics.ImpactFeedbackStyle.Light;
        if (hapticStyle === 'Medium') styleToUse = Haptics.ImpactFeedbackStyle.Medium;
        if (hapticStyle === 'Heavy') styleToUse = Haptics.ImpactFeedbackStyle.Heavy;
        Haptics.impactAsync(styleToUse as Haptics.ImpactFeedbackStyle).catch(() => {});
      }
    }

    Animated.spring(scale, {
      toValue: scaleTo,
      useNativeDriver: Platform.OS !== 'web',
      speed: 50,
      bounciness: 10,
    }).start();

    if (onPressIn) onPressIn(e);
  };

  const handlePressOut = (e: any) => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: Platform.OS !== 'web',
      speed: 50,
      bounciness: 10,
    }).start();

    if (onPressOut) onPressOut(e);
  };

  return (
    <AnimatedPressableBase
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      style={
        typeof style === 'function'
          ? (state: any) => [style(state), { transform: [{ scale }] }]
          : [style as any, { transform: [{ scale }] }]
      }
      {...props}
    >
      {children}
    </AnimatedPressableBase>
  );
}
