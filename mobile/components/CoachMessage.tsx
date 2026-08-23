import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../constants/theme';

interface CoachMessageProps {
  message: string;
  visible: boolean;
  tailTop?: number;
  greeting?: string;   // e.g. "Good evening, Joseph!"
  date?: string;       // e.g. "Tuesday, August 18"
}

export default function CoachMessage({ message, visible, tailTop, greeting, date }: CoachMessageProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      fadeAnim.setValue(0);
    }
  }, [visible, message]);

  return (
    <Animated.View
      style={[
        styles.bubble,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <View style={[styles.tail, { top: tailTop ?? 42 }]} />
      {/* Greeting header — user name + salutation */}
      {greeting ? (
        <Text style={styles.greeting}>{greeting}</Text>
      ) : null}
      <Text style={styles.message}>{message}</Text>
      {/* Date footer */}
      {date ? (
        <Text style={styles.dateFooter}>{date}</Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    flex: 1,
    backgroundColor: '#FFF5E6',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingTop: 10,
    paddingBottom: 10,
    marginLeft: 4,
    gap: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  tail: {
    position: 'absolute',
    left: -7,
    top: 42,
    width: 12,
    height: 12,
    backgroundColor: '#FFF5E6',
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.primary,
    transform: [{ rotate: '45deg' }],
  },
  greeting: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    marginBottom: 2,
  },
  message: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    fontWeight: FontWeight.medium,
    lineHeight: 22,
  },
  dateFooter: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
    textAlign: 'right',
    marginTop: 6,
    opacity: 0.7,
  },
});