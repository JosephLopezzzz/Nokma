import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, RefreshControl, Pressable, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { mealsApi } from '../../services/api';
import { useMeals } from '../../context/MealContext';
import { useLanguage } from '../../context/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import MealSection from '../../components/MealSection';
import { useStreak } from '../../hooks/useStreak';
import {
  getQualityColor, getLevelGradient, getLevelEmoji,
  STREAK_MILESTONES, getNextMilestone,
} from '../../services/streakService';
import type { StreakDayEntry } from '../../types';

const screenWidth = Dimensions.get('window').width;

type Timeframe = 7 | 14 | 30;

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const { meals, totals, targets, deleteMeal } = useMeals();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState<'diary' | 'charts'>('diary');
  const { streakInfo, isLoading: streakLoading } = useStreak(totals.calories, targets, totals);

  // ── Calendar navigation ───────────────────────────────────────────────────
  const today = new Date();
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth()); // 0-indexed

  const [timeframe, setTimeframe] = useState<Timeframe>(7);
  const [loading, setLoading] = useState(true);
  const [historyData, setHistoryData] = useState<{
    date: string;
    dayLabel: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }[]>([]);

  const targetCalories = targets?.calories_target || 2000;

  // ── Streak calendar grid builder ──────────────────────────────────────────
  const calendarGrid = useMemo(() => {
    // Build a lookup from calendarData
    const qualityMap: Record<string, StreakDayEntry> = {};
    for (const entry of streakInfo.calendarData) {
      qualityMap[entry.date] = entry;
    }

    // First day of the displayed month
    const firstDay = new Date(calYear, calMonth, 1);
    const startDow = firstDay.getDay(); // 0=Sun
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

    // Pad with nulls before the 1st
    const cells: (StreakDayEntry | null)[] = Array(startDow).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(calMonth + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      const dateStr = `${calYear}-${mm}-${dd}`;
      cells.push(qualityMap[dateStr] ?? { date: dateStr, quality: 0, calories: 0 });
    }
    return cells;
  }, [streakInfo.calendarData, calYear, calMonth]);

  const calMonthLabel = new Date(calYear, calMonth, 1).toLocaleDateString('en-PH', {
    month: 'long', year: 'numeric',
  });

  const loadHistory = useCallback(async (days: Timeframe) => {
    setLoading(true);
    try {
      const res = await mealsApi.history(days);
      setHistoryData(res.data || []);
    } catch (e) {
      console.error('Failed to load history:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory(timeframe);
  }, [timeframe, loadHistory]);

  const statsSummary = useMemo(() => {
    if (!historyData.length) {
      return {
        avgCalories: 0,
        adherenceRate: 0,
        peakCalories: 0,
        avgProtein: 0,
        avgCarbs: 0,
        avgFat: 0,
        proteinPct: 0,
        carbsPct: 0,
        fatPct: 0,
      };
    }

    const totalCals = historyData.reduce((acc, curr) => acc + curr.calories, 0);
    const avgCalories = Math.round(totalCals / historyData.length);

    // Adherence means falling in the "Perfect" range (Target - 300 to Target + 200)
    const metGoalCount = historyData.filter(d => d.calories > 0 && d.calories <= targetCalories + 200 && d.calories >= targetCalories - 300).length;
    const adherenceRate = Math.round((metGoalCount / historyData.length) * 100);

    const peakCalories = Math.max(...historyData.map(d => d.calories), 0);

    const totalP = historyData.reduce((acc, curr) => acc + curr.protein, 0);
    const totalC = historyData.reduce((acc, curr) => acc + curr.carbs, 0);
    const totalF = historyData.reduce((acc, curr) => acc + curr.fat, 0);
    const count = historyData.length;

    const avgProtein = Math.round(totalP / count);
    const avgCarbs = Math.round(totalC / count);
    const avgFat = Math.round(totalF / count);

    const pCals = avgProtein * 4;
    const cCals = avgCarbs * 4;
    const fCals = avgFat * 9;
    const macroSum = pCals + cCals + fCals || 1;

    const proteinPct = Math.round((pCals / macroSum) * 100);
    const carbsPct = Math.round((cCals / macroSum) * 100);
    const fatPct = Math.round((fCals / macroSum) * 100);

    return {
      avgCalories,
      adherenceRate,
      peakCalories,
      avgProtein,
      avgCarbs,
      avgFat,
      proteinPct,
      carbsPct,
      fatPct,
    };
  }, [historyData, targetCalories]);

  const chartConfig = {
    backgroundGradientFrom: colors.bgCard,
    backgroundGradientTo: colors.bgCard,
    color: (opacity = 1) => `rgba(${isDark ? '255, 255, 255' : '30, 41, 59'}, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(${isDark ? '148, 163, 184' : '100, 116, 139'}, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.65,
    useShadowColorFromDataset: false,
    decimalPlaces: 0,
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: colors.primary,
    },
  };

  const calorieData = useMemo(() => {
    if (!historyData.length) {
      return {
        labels: ['--'],
        datasets: [{ data: [0], color: (opacity = 1) => colors.calories, strokeWidth: 2 }],
      };
    }

    // Step labels for clarity based on timeframe
    const labels = historyData.map((d, index) => {
      if (timeframe === 7) return d.dayLabel;
      if (timeframe === 14) return index % 2 === 0 ? d.date.substring(5) : '';
      return index % 5 === 0 ? d.date.substring(5) : '';
    });

    const data = historyData.map((d) => d.calories);

    return {
      labels,
      datasets: [
        {
          data,
          color: (opacity = 1) => colors.primary,
          strokeWidth: 3,
        },
      ],
    };
  }, [historyData, timeframe, colors.primary, colors.calories]);

  const macroData = useMemo(() => {
    return {
      labels: ['Protein', 'Carbs', 'Fat'],
      datasets: [
        {
          data: [statsSummary.avgProtein, statsSummary.avgCarbs, statsSummary.avgFat],
          colors: [
            (opacity = 1) => colors.protein,
            (opacity = 1) => colors.carbs,
            (opacity = 1) => colors.fat,
          ],
        },
      ],
    };
  }, [statsSummary, colors.protein, colors.carbs, colors.fat]);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.segmentedControl}>
          <Pressable
            style={[styles.segmentBtn, activeTab === 'diary' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('diary')}
          >
            <Text style={[styles.segmentText, activeTab === 'diary' && styles.segmentTextActive]}>
              {t('dash.todaysMeals') || 'Diary'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, activeTab === 'charts' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('charts')}
          >
            <Text style={[styles.segmentText, activeTab === 'charts' && styles.segmentTextActive]}>
              Charts
            </Text>
          </Pressable>
        </View>

        {activeTab === 'charts' && (
          <View style={[styles.headerTop, { marginTop: Spacing.md }]}>
            <Text style={styles.title}>Progress & Analytics</Text>
            <View style={styles.timeframeChips}>
              {([7, 14, 30] as Timeframe[]).map((tf) => {
                const active = timeframe === tf;
                return (
                  <Pressable
                    key={tf}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setTimeframe(tf)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{tf}D</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {activeTab === 'diary' ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { padding: Spacing.lg }]}
          showsVerticalScrollIndicator={false}
        >
          {meals.length === 0 ? (
            <View style={styles.emptyMeals}>
              <ExpoImage
                source={require('../../assets/mascot/idle.gif')}
                style={styles.emptyMascot}
                contentFit="contain"
                priority="low"
              />
              <Text style={styles.emptyTitle}>
                {new Date().getHours() < 12
                  ? t('dash.goodMorning')
                  : new Date().getHours() < 18
                    ? t('dash.goodAfternoon')
                    : t('dash.goodEvening')}
              </Text>
              <Text style={styles.emptySubText}>{t('dash.emptyMeals')}</Text>
              <Pressable
                style={styles.emptyCta}
                onPress={() => router.push('/(tabs)/log')}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={18}
                  color={colors.textInverse}
                />
                <Text style={styles.emptyCtaText}>{t('dash.logAMeal')}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.diaryList}>
              <Pressable
                onPress={() => router.push('/(tabs)/log')}
                style={styles.addMealBtn}
              >
                <Ionicons name="add" size={16} color={colors.primary} />
                <Text style={styles.addMealText}>{t('dash.add')}</Text>
              </Pressable>
              
              {meals.map((meal) => (
                <MealSection key={meal.id} meal={meal} onDelete={deleteMeal} />
              ))}
            </View>
          )}
        </ScrollView>
      ) : (

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => loadHistory(timeframe)}
            tintColor={colors.primary}
          />
        }
      >
        {/* ── Streak Hero Card ─────────────────────────────────────────────── */}
        <StreakHeroCard
          streakInfo={streakInfo}
          calendarGrid={calendarGrid}
          calMonthLabel={calMonthLabel}
          calYear={calYear}
          calMonth={calMonth}
          onPrevMonth={() => {
            if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
            else setCalMonth(m => m - 1);
          }}
          onNextMonth={() => {
            const now = new Date();
            const isCurrentMonth = calYear === now.getFullYear() && calMonth === now.getMonth();
            if (!isCurrentMonth) {
              if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
              else setCalMonth(m => m + 1);
            }
          }}
          colors={colors}
          styles={styles}
        />

        {/* KPI Grid */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <View style={styles.kpiHeader}>
              <Ionicons name="flame-outline" size={18} color={colors.calories} />
              <Text style={styles.kpiLabel}>Avg Calories</Text>
            </View>
            <Text style={styles.kpiValue}>{statsSummary.avgCalories}</Text>
            <Text style={styles.kpiSub}>kcal / day</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={styles.kpiHeader}>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.success || '#10b981'} />
              <Text style={styles.kpiLabel}>Goal Adherence</Text>
            </View>
            <Text style={styles.kpiValue}>{statsSummary.adherenceRate}%</Text>
            <Text style={styles.kpiSub}>Target: {targetCalories} kcal</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={styles.kpiHeader}>
              <Ionicons name="trending-up-outline" size={18} color={colors.warning || '#f59e0b'} />
              <Text style={styles.kpiLabel}>Peak Intake</Text>
            </View>
            <Text style={styles.kpiValue}>{statsSummary.peakCalories}</Text>
            <Text style={styles.kpiSub}>highest day kcal</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={styles.kpiHeader}>
              <Ionicons name="pie-chart-outline" size={18} color={colors.protein} />
              <Text style={styles.kpiLabel}>Macro Split</Text>
            </View>
            <Text style={styles.kpiValue}>{statsSummary.proteinPct}% P</Text>
            <Text style={styles.kpiSub}>{statsSummary.carbsPct}% C · {statsSummary.fatPct}% F</Text>
          </View>
        </View>

        {/* Calorie Trend Chart */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>Calorie Intake Trend</Text>
              <Text style={styles.cardSubtitle}>Past {timeframe} days daily calories</Text>
            </View>
            <View style={styles.targetBadge}>
              <Text style={styles.targetBadgeText}>Target {targetCalories} kcal</Text>
            </View>
          </View>
          <LineChart
            data={calorieData}
            width={screenWidth - 48}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
            withInnerLines={true}
            withOuterLines={false}
          />
        </View>

        {/* Average Macro Breakdown Chart */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>Average Macro Distribution</Text>
              <Text style={styles.cardSubtitle}>Daily average grams for past {timeframe} days</Text>
            </View>
          </View>

          <BarChart
            data={macroData}
            width={screenWidth - 48}
            height={220}
            yAxisLabel=""
            yAxisSuffix="g"
            chartConfig={chartConfig}
            style={styles.chart}
            withCustomBarColorFromData
            flatColor
          />

          {/* Macro Breakdown Pills */}
          <View style={styles.macroPillsRow}>
            <View style={[styles.macroPill, { borderColor: `${colors.protein}40` }]}>
              <View style={[styles.dot, { backgroundColor: colors.protein }]} />
              <Text style={styles.macroPillLabel}>Protein:</Text>
              <Text style={styles.macroPillVal}>{statsSummary.avgProtein}g ({statsSummary.proteinPct}%)</Text>
            </View>
            <View style={[styles.macroPill, { borderColor: `${colors.carbs}40` }]}>
              <View style={[styles.dot, { backgroundColor: colors.carbs }]} />
              <Text style={styles.macroPillLabel}>Carbs:</Text>
              <Text style={styles.macroPillVal}>{statsSummary.avgCarbs}g ({statsSummary.carbsPct}%)</Text>
            </View>
            <View style={[styles.macroPill, { borderColor: `${colors.fat}40` }]}>
              <View style={[styles.dot, { backgroundColor: colors.fat }]} />
              <Text style={styles.macroPillLabel}>Fat:</Text>
              <Text style={styles.macroPillVal}>{statsSummary.avgFat}g ({statsSummary.fatPct}%)</Text>
            </View>
          </View>
        </View>
      </ScrollView>
      )}
    </View>
  );
}

// ─── StreakHeroCard ───────────────────────────────────────────────────────────

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function StreakHeroCard({
  streakInfo,
  calendarGrid,
  calMonthLabel,
  calYear,
  calMonth,
  onPrevMonth,
  onNextMonth,
  colors,
  styles,
}: {
  streakInfo: any;
  calendarGrid: any[];
  calMonthLabel: string;
  calYear: number;
  calMonth: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  colors: ThemeColors;
  styles: any;
}) {
  const [from, to] = getLevelGradient(streakInfo.currentLevel);
  const flameEmoji = getLevelEmoji(streakInfo.currentLevel);

  // Pulse animation for flame
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const now = new Date();
  const isCurrentMonth = calYear === now.getFullYear() && calMonth === now.getMonth();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  const nextMilestone = getNextMilestone(streakInfo.currentStreak);
  const prevMilestone = STREAK_MILESTONES.slice().reverse().find(m => m.days <= streakInfo.currentStreak);

  // Milestone progress bar
  const milestoneFrom = prevMilestone?.days ?? 0;
  const milestoneTo   = nextMilestone?.days ?? (milestoneFrom + 1);
  const milestonePct  = Math.min(
    (streakInfo.currentStreak - milestoneFrom) / Math.max(milestoneTo - milestoneFrom, 1),
    1,
  );

  // Calendar rows (7 cells each)
  const weeks: (any | null)[][] = [];
  for (let i = 0; i < calendarGrid.length; i += 7) {
    weeks.push(calendarGrid.slice(i, i + 7));
  }

  const levelSubtitle: Record<string, string> = {
    Spark:   streakInfo.currentStreak > 0 ? 'You\'ve started! Keep the spark alive ✨' : 'Log your first meal to start!',
    Glow:    'You\'re warming up! Keep going 🔥',
    Blaze:   'A full week streak — blazing! 🔥',
    Ignite:  'Two weeks strong — you\'re on fire!',
    Inferno: 'Unstoppable! You\'re an Inferno! 🔥',
  };

  return (
    <View style={styles.streakCard}>
      {/* Hero gradient banner */}
      <View style={[styles.streakHero, { backgroundColor: from }]}>
        <View style={[styles.streakHeroOverlay, { backgroundColor: to }]} />
        <View style={styles.streakHeroContent}>
          <View style={styles.streakLevelBadge}>
            <Text style={styles.streakLevelBadgeText}>{streakInfo.levelName.toUpperCase()}</Text>
          </View>
          <Animated.Text style={[styles.streakHeroFlame, { transform: [{ scale: pulse }] }]}>
            {flameEmoji}
          </Animated.Text>
          <Text style={styles.streakHeroCount}>{streakInfo.currentStreak}</Text>
          <Text style={styles.streakHeroDayLabel}>day streak!</Text>
          <Text style={styles.streakHeroSubtitle}>{levelSubtitle[streakInfo.levelName]}</Text>
        </View>
      </View>

      {/* Calendar section */}
      <View style={styles.streakCalSection}>
        {/* Month navigation */}
        <View style={styles.streakCalNav}>
          <Text style={styles.streakCalMonth}>{calMonthLabel}</Text>
          <View style={styles.streakCalNavBtns}>
            <Pressable onPress={onPrevMonth} style={styles.streakNavBtn}>
              <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
            </Pressable>
            <Pressable
              onPress={onNextMonth}
              style={[styles.streakNavBtn, isCurrentMonth && styles.streakNavBtnDisabled]}
              disabled={isCurrentMonth}
            >
              <Ionicons name="chevron-forward" size={18}
                color={isCurrentMonth ? colors.textMuted : colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        {/* Day-of-week headers */}
        <View style={styles.streakDowRow}>
          {DAY_HEADERS.map(h => (
            <Text key={h} style={styles.streakDowLabel}>{h}</Text>
          ))}
        </View>

        {/* Calendar rows */}
        {weeks.map((week, wIdx) => {
          // Detect streak run within this week for pill rendering
          const runStart = week.findIndex(c => c && c.quality >= 1);
          const runEnd   = week.reduce((last, c, i) => (c && c.quality >= 1 ? i : last), -1);
          const hasRun   = runStart !== -1 && runEnd >= runStart;

          return (
            <View key={wIdx} style={styles.streakWeekRow}>
              {/* Streak pill highlight behind cells */}
              {hasRun && (
                <View
                  style={[
                    styles.streakPill,
                    {
                      left:  runStart * (36 + 4),
                      right: (6 - runEnd) * (36 + 4),
                      backgroundColor: '#D94A1E26',
                    },
                  ]}
                />
              )}
              {week.map((cell, cIdx) => {
                if (!cell) return <View key={cIdx} style={styles.streakDayEmpty} />;
                const isToday = cell.date === todayStr;
                const isFuture = cell.date > todayStr;
                const dotColor = getQualityColor(cell.quality);
                const dayNum = parseInt(cell.date.split('-')[2], 10);
                return (
                  <View
                    key={cell.date}
                    style={[
                      styles.streakDayCell,
                      isToday && { borderWidth: 2, borderColor: colors.primary },
                    ]}
                  >
                    {!isFuture && cell.quality > 0 ? (
                      <View style={[styles.streakDayFill, { backgroundColor: dotColor }]}>
                        <Text style={styles.streakDayNumFilled}>{dayNum}</Text>
                        {cell.quality >= 2 && (
                          <Text style={styles.streakDayEmoji}>
                            {cell.quality === 3 ? '🔥' : '🟠'}
                          </Text>
                        )}
                      </View>
                    ) : (
                      <Text style={[
                        styles.streakDayNumEmpty,
                        isFuture && { color: colors.textMuted },
                        isToday && { color: colors.primary, fontWeight: FontWeight.bold },
                      ]}>{dayNum}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })}

        {/* Stats row */}
        <View style={styles.streakStatsRow}>
          <View style={styles.streakStatItem}>
            <Text style={styles.streakStatLabel}>Streak started</Text>
            <Text style={styles.streakStatValue}>
              {streakInfo.streakStartDate
                ? new Date(streakInfo.streakStartDate + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                : '—'}
            </Text>
          </View>
          <View style={styles.streakStatDivider} />
          <View style={styles.streakStatItem}>
            <Text style={styles.streakStatLabel}>Best streak</Text>
            <Text style={styles.streakStatValue}>{streakInfo.longestStreak} days</Text>
          </View>
        </View>

        {/* Milestone progress */}
        {nextMilestone && (
          <View style={styles.streakMilestoneBox}>
            <View style={styles.streakMilestoneHeader}>
              <Ionicons name={nextMilestone.icon as any} size={16} color="#E8A254" />
              <Text style={styles.streakMilestoneTitle}>Next: {nextMilestone.label}</Text>
              <Text style={styles.streakMilestoneDay}>
                Day {streakInfo.currentStreak} of {nextMilestone.days}
              </Text>
            </View>
            <View style={styles.streakMilestoneTrack}>
              <View style={[
                styles.streakMilestoneFill,
                { width: `${Math.round(milestonePct * 100)}%` },
              ]} />
            </View>
          </View>
        )}

        {/* Legend */}
        <View style={styles.streakLegendRow}>
          {[
            { color: '#D94A1E', label: 'Perfect' },
            { color: '#E8A254', label: 'Close'   },
            { color: '#F4C97A', label: 'Logged'  },
            { color: 'transparent', label: 'Missed', border: true },
          ].map(item => (
            <View key={item.label} style={styles.streakLegendItem}>
              <View style={[
                styles.streakLegendDot,
                { backgroundColor: item.color },
                item.border && { borderWidth: 1.5, borderColor: colors.border },
              ]} />
              <Text style={styles.streakLegendLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.bgElevated,
    borderRadius: Radius.full,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Radius.full,
  },
  segmentBtnActive: {
    backgroundColor: colors.bgCard,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: FontSize.sm,
    color: colors.textSecondary,
    fontWeight: FontWeight.semibold,
  },
  segmentTextActive: {
    color: colors.primary,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  timeframeChips: {
    flexDirection: 'row',
    gap: Spacing.xs,
    backgroundColor: colors.bg,
    padding: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: colors.textMuted,
  },
  chipTextActive: {
    color: '#ffffff',
  },
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: 110,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  kpiCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: colors.bgCard,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  kpiLabel: {
    fontSize: FontSize.xs,
    color: colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  kpiValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  kpiSub: {
    fontSize: FontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  cardTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: FontSize.xs,
    color: colors.textMuted,
    marginBottom: Spacing.xs,
  },
  targetBadge: {
    backgroundColor: `${colors.primary}15`,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  targetBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: colors.primary,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
    alignSelf: 'center',
  },
  macroPillsRow: {
    flexDirection: 'column',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  macroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.xs,
  },
  macroPillLabel: {
    fontSize: FontSize.xs,
    color: colors.textMuted,
    fontWeight: FontWeight.medium,
    marginRight: 4,
  },
  macroPillVal: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },

  // ── StreakHeroCard ────────────────────────────────────────────────────────
  streakCard: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  streakHero: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  streakHeroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    opacity: 0.5,
    borderTopLeftRadius: 80,
    borderTopRightRadius: 80,
  },
  streakHeroContent: {
    alignItems: 'center',
    gap: 4,
  },
  streakLevelBadge: {
    backgroundColor: 'rgba(255,255,255,0.28)',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: Radius.full,
    marginBottom: Spacing.xs,
  },
  streakLevelBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.extrabold,
    color: '#fff',
    letterSpacing: 1.5,
  },
  streakHeroFlame: {
    fontSize: 56,
    lineHeight: 70,
  },
  streakHeroCount: {
    fontSize: 52,
    fontWeight: FontWeight.extrabold,
    color: '#fff',
    lineHeight: 60,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  streakHeroDayLabel: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  streakHeroSubtitle: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 6,
    textAlign: 'center',
  },
  // Calendar
  streakCalSection: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  streakCalNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  streakCalMonth: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  streakCalNavBtns: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  streakNavBtn: {
    padding: 6,
    borderRadius: Radius.sm,
    backgroundColor: colors.bgElevated,
  },
  streakNavBtnDisabled: {
    opacity: 0.35,
  },
  streakDowRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 2,
  },
  streakDowLabel: {
    width: 36,
    textAlign: 'center',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: colors.textMuted,
  },
  streakWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    position: 'relative',
    marginVertical: 2,
  },
  streakPill: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    borderRadius: 20,
  },
  streakDayEmpty: {
    width: 36,
    height: 36,
  },
  streakDayCell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  streakDayFill: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakDayNumFilled: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
    color: '#fff',
    lineHeight: 13,
  },
  streakDayEmoji: {
    fontSize: 10,
    lineHeight: 12,
  },
  streakDayNumEmpty: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  // Stats row
  streakStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.xs,
  },
  streakStatItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  streakStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
  streakStatLabel: {
    fontSize: FontSize.xs,
    color: colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  streakStatValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  // Milestone
  streakMilestoneBox: {
    backgroundColor: colors.bgElevated,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  streakMilestoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  streakMilestoneTitle: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: colors.textPrimary,
  },
  streakMilestoneDay: {
    fontSize: FontSize.xs,
    color: colors.textMuted,
  },
  streakMilestoneTrack: {
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  streakMilestoneFill: {
    height: '100%',
    borderRadius: Radius.full,
    backgroundColor: '#E8A254',
  },
  // Legend
  streakLegendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    marginTop: Spacing.xs,
    flexWrap: 'wrap',
  },
  streakLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  streakLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  streakLegendLabel: {
    fontSize: FontSize.xs,
    color: colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  emptyMeals: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: Spacing.xl,
    backgroundColor: colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    marginTop: Spacing.xl,
  },
  emptyMascot: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  emptySubText: {
    fontSize: FontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
    lineHeight: 20,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radius.full,
    marginTop: 4,
  },
  emptyCtaText: {
    fontSize: FontSize.sm,
    color: colors.textInverse,
    fontWeight: FontWeight.semibold,
  },
  diaryList: {
    gap: Spacing.md,
    paddingBottom: 40,
  },
  addMealBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: colors.primaryGlow,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: Spacing.sm,
  },
  addMealText: {
    fontSize: FontSize.sm,
    color: colors.primary,
    fontWeight: FontWeight.semibold,
  },
});
