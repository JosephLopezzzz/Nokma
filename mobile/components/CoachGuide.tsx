import React, { useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import CoachMessage from './CoachMessage';
import { Spacing, Radius } from '../constants/theme';
import type { DashboardCoachExpression } from '../constants/coachAnimation';

const MIN_MASCOT = 120;
const MAX_MASCOT = 145;
const SCREEN_WIDTH_FACTOR = 0.33;

interface CoachGuideProps {
  message: string;
  visible: boolean;
  expression?: DashboardCoachExpression;
  greeting?: string;
  date?: string;
}

function CoachGuide({ message, visible, greeting, date, expression = 'idle' }: CoachGuideProps) {
  const { width } = useWindowDimensions();

  const mascotSize = useMemo(
    () => Math.min(Math.max(width * SCREEN_WIDTH_FACTOR, MIN_MASCOT), MAX_MASCOT),
    [width],
  );

  const tailTop = useMemo(() => Math.round(mascotSize * 0.37), [mascotSize]);

  return (
    <View style={styles.container}>
      <View style={[styles.mascotFrame, { width: mascotSize, height: mascotSize }]}>
        {/* Preserve the antialiased contour at the dashboard's small size. */}
        <Image
          source={COACH_DASHBOARD_ASSETS[expression]}
          style={{ width: mascotSize, height: mascotSize }}
          contentFit="contain"
          allowDownscaling={false}
          priority="low"
          cachePolicy="memory-disk"
        />
      </View>
      <CoachMessage message={message} visible={visible} tailTop={tailTop} greeting={greeting} date={date} />
    </View>
  );
}

const COACH_DASHBOARD_ASSETS: Record<DashboardCoachExpression, number> = {
  idle: require('../assets/mascot/idle-dashboard.webp'),
  flex: require('../assets/mascot/flex-dashboard.webp'),
  worry: require('../assets/mascot/worry-dashboard.webp'),
  sleep: require('../assets/mascot/sleep-dashboard.webp'),
};

export default React.memo(CoachGuide);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mascotFrame: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
