import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  RefreshControl, Animated, TouchableOpacity, Dimensions
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useMeals } from '../../context/MealContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import CoachGuide from '../../components/CoachGuide';
import DashboardTutorial, {
  isTutorialComplete,
} from '../../components/DashboardTutorial';
import { useCoachMessage } from '../../hooks/useCoachMessage';
import { useStreak } from '../../hooks/useStreak';
import { getQualityColor, getLevelEmoji } from '../../services/streakService';
import { Colors as StaticColors, FontSize, FontWeight, Spacing, Radius, MEAL_TYPES, ThemeColors } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';

const CONFIRMATION_DURATION = 3000;

// IMPORTANT: Create animated component ONCE at module scope — not inside render
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function CalorieRing({
  consumed,
  target,
  size = 200,
}: {
  consumed: number;
  target: number;
  size?: number;
}) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const pct = target > 0 ? Math.min(consumed / target, 1) : 0;
  const animVal = useRef(new Animated.Value(pct)).current;

  useEffect(() => {
    Animated.timing(animVal, {
      toValue: pct,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  const strokeDashoffset = animVal.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="transparent"
          stroke={colors.bgElevated}
          strokeWidth={strokeWidth}
        />
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={radius}
          fill="transparent"
          stroke={colors.calories}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${cx}, ${cy}`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <View style={styles.ringCalsRow}>
          <Text style={styles.ringCals}>{Math.round(consumed).toLocaleString()}</Text>
          <Text style={styles.ringTarget}> / {Math.round(target).toLocaleString()}</Text>
        </View>
        <Text style={styles.ringLabel}>kcal</Text>
        <Text style={styles.ringPct}>{Math.round((target > 0 ? consumed / target : 0) * 100)}%</Text>
      </View>
    </View>
  );
}


export default function DashboardScreen() {
  const { user, dailySteps } = useAuth();
  const { lang, t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { meals, totals, targets, remaining, isLoading, loadToday } = useMeals();
  const { streakInfo, refresh: refreshStreak } = useStreak(totals.calories, targets);
  const [showTutorial, setShowTutorial] = useState(false);
  const [confirmationMsg, setConfirmationMsg] = useState<string | null>(null);
  const prevMealCount = useRef(meals.length);

  // Streak chip pulse animation
  const streakPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (streakInfo.currentStreak > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(streakPulse, { toValue: 1.12, duration: 900, useNativeDriver: true }),
          Animated.timing(streakPulse, { toValue: 1,    duration: 900, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [streakInfo.currentStreak]);

  const fabRef = useRef<View>(null);
  const trackerRef = useRef<View>(null);
  const coachRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollContentRef = useRef<View>(null);

  const coach = useCoachMessage(
    user?.full_name,
    meals,
    totals,
    targets,
    lang,
    streakInfo.currentStreak,
  );

  const coachCardAnim = useRef(new Animated.Value(0)).current;

  // Entrance animation
  useEffect(() => {
    Animated.spring(coachCardAnim, {
      toValue: 1,
      friction: 7,
      tension: 70,
      useNativeDriver: true,
    }).start();
  }, []);

  // Confirmation on meal save. The timer is cleared on unmount (and before a
  // replacement is scheduled) so a fast second log can't leave a stale setState.
  useEffect(() => {
    const grew = meals.length > prevMealCount.current && prevMealCount.current > 0;
    prevMealCount.current = meals.length;
    if (!grew) return;

    setConfirmationMsg(t('dash.logged'));
    const timer = setTimeout(() => setConfirmationMsg(null), CONFIRMATION_DURATION);
    return () => clearTimeout(timer);
  }, [meals.length, t]);

  // Refresh data every time the dashboard tab gains focus
  useFocusEffect(
    useCallback(() => {
      loadToday();
    }, [loadToday])
  );

  // Tutorial check
  useEffect(() => {
    (async () => {
      const done = await isTutorialComplete();
      if (!done) {
        setShowTutorial(true);
      }
    })();
  }, []);

  const displayMessage = confirmationMsg ?? coach.message;

  const caloriesTarget = targets?.calories_target ?? 2000;
  const proteinTarget = targets?.protein_target ?? 150;
  const carbsTarget = targets?.carbs_target ?? 200;
  const fatTarget = targets?.fat_target ?? 65;

  // Date string for inside the chat bubble
  const today = new Date().toLocaleDateString(lang === 'filipino' ? 'fil-PH' : 'en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // First name only for the bubble greeting
  const firstName = user?.full_name?.split(' ')[0] ?? 'there';

  return (
    <View style={styles.root}>
      {/* Absolute Background Gradient (hide in dark mode or make very subtle) */}
      {!isDark && (
        <ExpoImage
          source={require('../../assets/dashboard_bg.jpeg')}
          style={styles.bgImage}
          contentFit="cover"
        />
      )}

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => loadToday()}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View ref={scrollContentRef} style={{ flex: 1 }}>
          {/* Header */}
          <View style={[styles.headerWrapper, { paddingTop: insets.top + Spacing.lg }]}>
          <View style={styles.header}>
            {/* NOKMA brand title */}
            <Text style={styles.nokmaTitle}>NOKMA</Text>
          </View>

          {/* Coach Guide — mascot + speech bubble with greeting + date inside */}
          <View ref={coachRef}>
            <Animated.View
              style={{
                opacity: coachCardAnim,
                transform: [
                  {
                    translateY: coachCardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-20, 0],
                    }),
                  },
                ],
              }}
            >
              <CoachGuide
                message={displayMessage}
                visible
                greeting={`${coach.greeting.replace(/,.*$/, '')}, ${firstName}!`}
                date={today}
              />
            </Animated.View>
          </View>
        </View>

        {/* Layered White Content Card */}
        <View style={styles.contentCard}>
          {/* Top Row: Calorie Ring & Quick Actions */}
          <View ref={trackerRef} style={styles.topDashboardRow}>
            <View style={styles.ringCard}>
              <CalorieRing consumed={totals.calories} target={caloriesTarget} size={150} />
            </View>
            <View style={styles.quickActionsCol}>
              <View ref={fabRef}>
                <Pressable style={styles.quickActionBtn} onPress={() => router.push('/(tabs)/log')}>
                  <Ionicons name="restaurant" size={20} color={colors.primary} />
                  <Text style={styles.quickActionText}>{t('dash.logAMeal')}</Text>
                </Pressable>
              </View>
              <Pressable style={styles.quickActionBtn} onPress={() => router.push('/(tabs)/search')}>
                <Ionicons name="search" size={20} color={colors.primary} />
                <Text style={styles.quickActionText}>{t('search.title')}</Text>
              </Pressable>
            </View>
          </View>

            {/* Steps KPI */}
            {dailySteps > 0 && (
              <View style={styles.stepsCard}>
                <Ionicons name="footsteps" size={20} color={colors.primary} />
                <Text style={styles.stepsText}>
                  {dailySteps.toLocaleString()}{' '}
                  <Text style={styles.stepsLabel}>{t('dash.steps') || 'Steps'}</Text>
                </Text>
              </View>
            )}

            {/* Slim macro trio bars */}
            <View style={styles.macroTrio}>
              <View style={styles.slimMacroRow}>
                <View style={[styles.slimTrack, { backgroundColor: colors.bgElevated }]}>
                  <View
                    style={[
                      styles.slimFill,
                      {
                        width: `${Math.min((totals.protein / Math.max(proteinTarget, 1)) * 100, 100)}%`,
                        backgroundColor: colors.protein,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.slimLabel}>
                  {t('macro.protein')}{' '}
                  <Text style={styles.slimVal}>
                    {Math.round(totals.protein)}/{proteinTarget}g
                  </Text>
                </Text>
              </View>
              <View style={styles.slimMacroRow}>
                <View style={[styles.slimTrack, { backgroundColor: colors.bgElevated }]}>
                  <View
                    style={[
                      styles.slimFill,
                      {
                        width: `${Math.min((totals.carbs / Math.max(carbsTarget, 1)) * 100, 100)}%`,
                        backgroundColor: colors.carbs,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.slimLabel}>
                  {t('macro.carbs')}{' '}
                  <Text style={styles.slimVal}>
                    {Math.round(totals.carbs)}/{carbsTarget}g
                  </Text>
                </Text>
              </View>
              <View style={styles.slimMacroRow}>
                <View style={[styles.slimTrack, { backgroundColor: colors.bgElevated }]}>
                  <View
                    style={[
                      styles.slimFill,
                      {
                        width: `${Math.min((totals.fat / Math.max(fatTarget, 1)) * 100, 100)}%`,
                        backgroundColor: colors.fat,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.slimLabel}>
                  {t('macro.fat')}{' '}
                  <Text style={styles.slimVal}>
                    {Math.round(totals.fat)}/{fatTarget}g
                  </Text>
                </Text>
              </View>
            </View>

            {/* Streak Dashboard Widget */}
            <Pressable onPress={() => router.push('/(tabs)/progress')}>
              <View
                style={[
                  styles.streakWidgetCard,
                  {
                    backgroundColor: streakInfo.levelName === 'Inferno' ? '#FF4B2B' :
                                     streakInfo.levelName === 'Ignite'  ? '#f12711' :
                                     streakInfo.levelName === 'Blaze'   ? '#FF512F' :
                                     streakInfo.levelName === 'Glow'    ? '#FF8008' :
                                     '#E2E8F0' // Spark or none
                  }
                ]}
              >
                <View style={styles.streakWidgetRow}>
                  <View style={styles.streakWidgetInfo}>
                    <Text style={[styles.streakWidgetTitle, streakInfo.levelName === 'Spark' && {color: '#1E293B'}]}>
                      {streakInfo.currentStreak} Day Streak
                    </Text>
                    <Text style={[styles.streakWidgetSubtitle, streakInfo.levelName === 'Spark' && {color: '#475569'}]}>
                      {streakInfo.levelName} Level
                    </Text>
                  </View>
                  <Animated.Text style={[styles.streakWidgetEmoji, { transform: [{ scale: streakPulse }] }]}>
                    {getLevelEmoji(streakInfo.levelName)}
                  </Animated.Text>
                </View>
                
                {streakInfo.weekHeatmap.length > 0 && (
                  <View style={styles.streakWidgetHeatmapRow}>
                    {streakInfo.weekHeatmap.map((entry, idx) => {
                      const dotColor = getQualityColor(entry.quality);
                      const isToday = idx === streakInfo.weekHeatmap.length - 1;
                      const dayLabels = ['Su','Mo','Tu','We','Th','Fr','Sa'];
                      const dayObj = new Date(entry.date + 'T00:00:00');
                      const dayLabel = dayLabels[dayObj.getDay()];
                      return (
                        <View key={entry.date} style={styles.miniHeatmapCell}>
                          <Text style={[
                            styles.streakWidgetDayLabel,
                            streakInfo.levelName === 'Spark' && {color: '#475569'},
                            isToday && { fontWeight: FontWeight.bold },
                          ]}>{dayLabel}</Text>
                          <View style={[
                            styles.streakWidgetDot,
                            {
                              backgroundColor: entry.quality > 0 ? dotColor : 'rgba(255,255,255,0.2)',
                              borderColor: entry.quality > 0 ? dotColor : 'rgba(255,255,255,0.4)',
                            },
                            streakInfo.levelName === 'Spark' && entry.quality === 0 && {
                              backgroundColor: 'rgba(0,0,0,0.05)', borderColor: 'rgba(0,0,0,0.1)'
                            },
                            isToday && { borderColor: streakInfo.levelName === 'Spark' ? '#0F172A' : '#FFF', borderWidth: 2 },
                          ]}>
                            {entry.quality >= 2 && (
                              <Text style={styles.miniHeatmapEmoji}>
                                {entry.quality === 3 ? '🎯' : '👍'}
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <DashboardTutorial
        visible={showTutorial}
        onComplete={() => setShowTutorial(false)}
        targetRefs={{ fabRef, trackerRef, coachRef, scrollContentRef }}
        scrollViewRef={scrollRef}
        userName={user?.full_name}
      />
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  // ── 7-day mini heatmap ────────────────────────────────────────────────────
  miniHeatmapRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  miniHeatmapCell: {
    alignItems: 'center',
    gap: 4,
  },
  miniHeatmapDayLabel: {
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: FontWeight.medium,
    textTransform: 'uppercase',
  },
  miniHeatmapDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniHeatmapEmoji: {
    fontSize: 14,
  },
  streakWidgetCard: {
    borderRadius: 20,
    padding: Spacing.lg,
    marginVertical: Spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  streakWidgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  streakWidgetInfo: {
    flex: 1,
    gap: 2,
  },
  streakWidgetTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extrabold,
    color: '#FFF',
  },
  streakWidgetSubtitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  streakWidgetEmoji: {
    fontSize: 42,
  },
  streakWidgetHeatmapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  streakWidgetDayLabel: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: FontWeight.medium,
    marginBottom: 4,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  streakWidgetDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 480, // Covers upper portion, creating the sky/gradient look
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerWrapper: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  contentCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: Spacing.lg,
    gap: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 8,
  },
  nokmaTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.extrabold,
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  ringCard: {
    backgroundColor: 'transparent',
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.md,
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCalsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  ringCals: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.extrabold,
    color: colors.textPrimary,
  },
  ringTarget: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: colors.textMuted,
  },
  ringLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  ringPct: {
    fontSize: FontSize.xs,
    color: colors.calories,
    fontWeight: FontWeight.semibold,
    marginTop: 2,
  },
  topDashboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  quickActionsCol: {
    flex: 1,
    gap: Spacing.sm,
  },
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryGlow,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(232,162,84,0.3)',
  },
  quickActionText: {
    fontSize: FontSize.sm,
    color: colors.primary,
    fontWeight: FontWeight.bold,
  },
  stepsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(232,162,84,0.1)',
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(232,162,84,0.3)',
    marginBottom: Spacing.md,
    gap: 8,
  },
  stepsText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  stepsLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: colors.textSecondary,
  },

  macroTrio: {
    backgroundColor: colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  slimMacroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  slimTrack: {
    height: 4,
    flex: 1,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  slimFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  slimLabel: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    fontWeight: FontWeight.medium,
    width: 90,
    textAlign: 'right',
  },
  slimVal: {
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
});
