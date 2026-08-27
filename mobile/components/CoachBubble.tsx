import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import TypewriterText from './TypewriterText';
import type { TypewriterTextHandle } from './TypewriterText';
import { FontSize, FontWeight, Spacing, Radius } from '../constants/theme';

interface CoachBubbleProps {
  mascotState?: 'idle' | 'worry' | 'streak' | 'sleep' | 'flex';
  message: string;
  typewriter?: boolean;
  typewriterSpeed?: number;
  onTypeComplete?: () => void;
}

export interface CoachBubbleHandle {
  skip: () => void;
}

const mascotImages = {
  idle: require('../assets/mascot/idle.gif'),
  worry: require('../assets/mascot/worry.png'),
  streak: require('../assets/mascot/streak.png'),
  sleep: require('../assets/mascot/sleeppp.png'),
  flex: require('../assets/mascot/flex.png'),
};

const getMascotStyle = (state: string) => {
  switch (state) {
    case 'flex':
      return { width: 300, height: 300, position: 'absolute', left: -50, bottom: -30, zIndex: 2 };
    case 'streak':
      return { width: 280, height: 280, position: 'absolute', alignSelf: 'center', bottom: -20, zIndex: 2 };
    case 'worry':
      return { width: 280, height: 280, position: 'absolute', left: -40, bottom: -20, zIndex: 2 };
    case 'sleep':
      return { width: 260, height: 260, position: 'absolute', alignSelf: 'center', bottom: -20, zIndex: 2 };
    case 'idle':
    default:
      return { width: 250, height: 250, position: 'absolute', alignSelf: 'center', bottom: -10, zIndex: 2 };
  }
};

const CoachBubbleRender: React.ForwardRefRenderFunction<CoachBubbleHandle, CoachBubbleProps> = ({
  message,
  typewriter = true,
  typewriterSpeed = 20,
  mascotState = 'idle',
  onTypeComplete,
}, ref) => {
  const typewriterRef = useRef<TypewriterTextHandle>(null);
  const [isTyping, setIsTyping] = useState(typewriter);

  useImperativeHandle(ref, () => ({
    skip: () => {
      if (isTyping) {
        typewriterRef.current?.skip();
      }
    }
  }));

  useEffect(() => {
    setIsTyping(typewriter);
  }, [message, typewriter]);

  const handleComplete = () => {
    setIsTyping(false);
    onTypeComplete?.();
  };

  return (
    <Pressable
      style={styles.container}
      onPress={() => isTyping && typewriterRef.current?.skip()}
      accessibilityRole={isTyping ? 'button' : undefined}
      accessibilityLabel={isTyping ? 'Reveal the full coach message' : undefined}
      accessibilityHint={isTyping ? 'Skips the typing animation' : undefined}
      accessible={isTyping}
    >
      <View style={styles.mascotStage}>
        <View style={styles.backdropAngle} />
        <Image
          source={mascotImages[mascotState]}
          style={[styles.mascot, getMascotStyle(mascotState) as any]}
          contentFit="contain"
          priority="low"
          cachePolicy="memory-disk"
        />
      </View>
      <View style={styles.textWrap}>
        {typewriter ? (
          <TypewriterText
            ref={typewriterRef}
            text={message}
            speed={typewriterSpeed}
            style={styles.questionText}
            onComplete={handleComplete}
          />
        ) : (
          <Text style={styles.questionText}>{message}</Text>
        )}
        {isTyping && (
          <Text style={styles.tapToSkipText}>Tap anywhere to skip</Text>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'stretch',
    marginBottom: Spacing.md,
  },
  mascotStage: {
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    position: 'relative',
  },
  backdropAngle: {
    position: 'absolute',
    top: 0,
    left: -20,
    right: -20,
    bottom: 20,
    backgroundColor: '#EBECEE',
    borderBottomRightRadius: 40,
    transform: [{ rotate: '-3deg' }],
  },
  mascot: {
    width: 125,
    height: 125,
    zIndex: 2,
  },
  textWrap: {
    minHeight: 126,
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  questionText: {
    fontSize: 22,
    fontWeight: FontWeight.bold,
    color: '#111827',
    lineHeight: 30,
    letterSpacing: -0.4,
  },
  tapToSkipText: {
    fontSize: FontSize.sm,
    color: '#9CA3AF',
    marginTop: Spacing.sm,
    fontWeight: FontWeight.medium,
  },
});

const CoachBubble = forwardRef(CoachBubbleRender);
export default CoachBubble;
