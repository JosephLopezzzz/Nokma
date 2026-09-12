import React, { useEffect, useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { Text } from 'react-native';

export interface TypewriterTextHandle {
  skip: () => void;
}

interface TypewriterTextProps {
  text: string;
  speed?: number;
  /** When true, dynamically adjusts character speed based on text length */
  adaptiveSpeed?: boolean;
  /** Optional cap on total typing duration in ms */
  maxDuration?: number;
  style?: any;
  onComplete?: () => void;
}

const TypewriterText = forwardRef<TypewriterTextHandle, TypewriterTextProps>(({
  text,
  speed = 20,
  adaptiveSpeed = false,
  maxDuration,
  style,
  onComplete,
}, ref) => {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneRef = useRef(false);

  // Compute effective typing delay per character
  const effectiveSpeed = React.useMemo(() => {
    let s = speed;
    if (adaptiveSpeed) {
      const len = text.length;
      if (len <= 70) s = 16;
      else if (len <= 130) s = 13;
      else s = 11;
    }
    if (maxDuration && text.length > 0) {
      const totalEstimated = s * text.length;
      if (totalEstimated > maxDuration) {
        s = Math.max(8, Math.floor(maxDuration / text.length));
      }
    }
    return s;
  }, [text.length, speed, adaptiveSpeed, maxDuration]);

  useImperativeHandle(ref, () => ({
    skip: () => {
      if (doneRef.current) return;
      doneRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      setDisplayed(text);
      onComplete?.();
    },
  }));

  useEffect(() => {
    setDisplayed('');
    indexRef.current = 0;
    doneRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);

    const type = () => {
      if (indexRef.current < text.length) {
        setDisplayed(text.slice(0, indexRef.current + 1));
        indexRef.current++;
        timerRef.current = setTimeout(type, effectiveSpeed);
      } else if (!doneRef.current) {
        doneRef.current = true;
        onComplete?.();
      }
    };

    type();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text, effectiveSpeed]);

  return (
    <Text style={style}>
      {displayed}
      {displayed.length < text.length && <Text style={{ opacity: 0.5 }}>|</Text>}
    </Text>
  );
});

export default TypewriterText;
