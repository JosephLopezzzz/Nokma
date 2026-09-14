import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Dimensions, StyleSheet, Platform } from 'react-native';
import { Colors } from '../constants/theme';

const CONFETTI_COLORS = [
  Colors.primary,       // Brand Warm Orange (#D94A1E)
  '#FF8A50',            // Coral Orange
  '#FFC107',            // Radiant Gold
  '#F59E0B',            // Warm Amber
  '#10B981',            // Emerald Green
  '#06B6D4',            // Electric Cyan
  '#8B5CF6',            // Soft Purple
  '#EC4899',            // Celebration Pink
  '#FFF',               // Crisp White highlight
];

type ShapeType = 'rect' | 'circle' | 'ribbon';

interface Piece {
  x: number;
  size: number;
  color: string;
  shape: ShapeType;
  delay: number;
  animX: Animated.Value;
  animY: Animated.Value;
  animR: Animated.Value;
}

interface ConfettiProps {
  active: boolean;
  count?: number;
  duration?: number;
}

export default function Confetti({ active, count = 55, duration = 3800 }: ConfettiProps) {
  const { width: screenW, height: screenH } = Dimensions.get('window');
  const piecesRef = useRef<Piece[]>([]);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (!active) {
      piecesRef.current = [];
      forceUpdate((n) => n + 1);
      return;
    }

    const shapes: ShapeType[] = ['rect', 'rect', 'circle', 'ribbon'];
    const newPieces: Piece[] = [];

    for (let i = 0; i < count; i++) {
      newPieces.push({
        x: Math.random() * (screenW - 20) + 10,
        size: 7 + Math.random() * 8,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        delay: Math.random() * 400,
        animX: new Animated.Value(0),
        animY: new Animated.Value(0),
        animR: new Animated.Value(0),
      });
    }

    piecesRef.current = newPieces;
    forceUpdate((n) => n + 1);

    Animated.stagger(
      30,
      newPieces.map((p) =>
        Animated.parallel([
          Animated.timing(p.animY, {
            toValue: screenH + 80,
            duration: 2200 + Math.random() * 1400,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.sequence([
            Animated.timing(p.animX, {
              toValue: (Math.random() - 0.5) * 160,
              duration: 900 + Math.random() * 500,
              useNativeDriver: Platform.OS !== 'web',
            }),
            Animated.timing(p.animX, {
              toValue: (Math.random() - 0.5) * 120,
              duration: 900 + Math.random() * 500,
              useNativeDriver: Platform.OS !== 'web',
            }),
          ]),
          Animated.timing(p.animR, {
            toValue: Math.random() * 720 - 360,
            duration: 2200 + Math.random() * 1200,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
      ),
    ).start();

    const timer = setTimeout(() => {
      piecesRef.current = [];
      forceUpdate((n) => n + 1);
    }, duration);

    return () => clearTimeout(timer);
  }, [active, count, duration, screenH, screenW]);

  if (!active || piecesRef.current.length === 0) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      {piecesRef.current.map((p, i) => {
        const isCircle = p.shape === 'circle';
        const isRibbon = p.shape === 'ribbon';
        const heightMultiplier = isCircle ? 1 : isRibbon ? 2.4 : 1.6;
        const borderRadius = isCircle ? p.size / 2 : 3;

        return (
          <Animated.View
            key={i}
            style={[
              styles.piece,
              {
                left: p.x,
                width: p.size,
                height: p.size * heightMultiplier,
                backgroundColor: p.color,
                borderRadius,
                opacity: p.animY.interpolate({
                  inputRange: [0, screenH * 0.75, screenH + 60],
                  outputRange: [1, 1, 0],
                }),
                transform: [
                  { translateX: p.animX },
                  { translateY: p.animY },
                  {
                    rotate: p.animR.interpolate({
                      inputRange: [-360, 360],
                      outputRange: ['-360deg', '360deg'],
                    }),
                  },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  piece: {
    position: 'absolute',
    top: -40,
    zIndex: 9999,
    elevation: 9999,
  },
});