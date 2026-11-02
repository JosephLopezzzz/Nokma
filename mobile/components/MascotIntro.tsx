import React, { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

const INTRO_SEEN_KEY = 'nokma_intro_seen';
const MASCOT = require('../assets/mascot/intro-text-free.png');

interface MascotIntroProps {
  ready: boolean;
  onComplete: () => void;
}

export default function MascotIntro({ ready, onComplete }: MascotIntroProps) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const [showMascot, setShowMascot] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const motion = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const finished = useRef(false);
  const shouldPersist = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const complete = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    animation.current?.stop();

    // Intro history belongs to this installation, independent of profile resets.
    if (shouldPersist.current) {
      void AsyncStorage.setItem(INTRO_SEEN_KEY, 'true').catch(() => {
        console.warn('Could not save mascot intro completion.');
      });
    }
    onCompleteRef.current();
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Storage, image decoding, or a native preference query must never trap startup.
    const timeout = setTimeout(complete, 4000);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);

    AsyncStorage.getItem(INTRO_SEEN_KEY).then(seen => {
      if (cancelled || finished.current) return;
      if (seen === 'true') {
        complete();
        return;
      }
      shouldPersist.current = true;
      setShowMascot(true);
    }).catch(() => {
      if (!cancelled) complete();
    });

    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (!cancelled) setReduceMotion(current => current ?? reduced);
    }).catch(() => {
      if (!cancelled) setReduceMotion(current => current ?? true);
    });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      subscription.remove();
    };
  }, [complete]);

  useEffect(() => {
    if (!ready || !showMascot || !imageLoaded || reduceMotion === null || finished.current) return;

    const useNativeDriver = Platform.OS !== 'web';
    motion.setValue(0);
    const fade = Animated.timing(opacity, {
      toValue: 0,
      duration: reduceMotion ? 150 : 300,
      easing: Easing.out(Easing.quad),
      useNativeDriver,
      isInteraction: false,
    });
    const sequence = reduceMotion ? fade : Animated.sequence([
      Animated.delay(200),
      Animated.timing(motion, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver,
        isInteraction: false,
      }),
      Animated.timing(motion, {
        toValue: 0,
        duration: 500,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver,
        isInteraction: false,
      }),
      fade,
    ]);

    animation.current = sequence;
    sequence.start(result => {
      if (result.finished) complete();
    });
    return () => sequence.stop();
  }, [ready, showMascot, imageLoaded, reduceMotion, motion, opacity, complete]);

  const size = Math.min(220, width * 0.52, height * 0.36);

  return (
    <Modal
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={complete}
    >
      <Animated.View
        style={[styles.screen, { backgroundColor: colors.bg, opacity }]}
        accessibilityViewIsModal
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        testID="mascot-intro"
      >
        {showMascot && (
          <Animated.View
            style={{
              opacity: imageLoaded ? 1 : 0,
              transform: [
                { translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
                { rotate: motion.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-3deg'] }) },
              ],
            }}
          >
            <Image
              source={MASCOT}
              style={{ width: size, height: size }}
              resizeMode="contain"
              accessible={false}
              fadeDuration={0}
              onLoad={() => setImageLoaded(true)}
              onError={complete}
              testID="intro-mascot"
            />
          </Animated.View>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
