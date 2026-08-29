import React from 'react';
import {
  View, Text, StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, FontWeight, Spacing, Radius, ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import type { Food, Recipe, RestaurantFood } from '../types';
import AnimatedPressable from './AnimatedPressable';

type FoodCardItem =
  | { source: 'food';       data: Food }
  | { source: 'recipe';     data: Recipe }
  | { source: 'restaurant'; data: RestaurantFood };

interface FoodCardProps {
  item:      FoodCardItem;
  onPress?:  () => void;
  onAdd?:    () => void;
  compact?:  boolean;
  allergenWarning?: string;
}

function MacroPill({ value, label, color, styles }: { value: number; label: string; color: string; styles: any }) {
  return (
    <View style={[styles.pill, { backgroundColor: `${color}20` }]}>
      <Text style={[styles.pillValue, { color }]}>{Math.round(value)}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

export default function FoodCard({ item, onPress, onAdd, compact = false, allergenWarning }: FoodCardProps) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  let name = '';
  let calories = 0;
  let protein  = 0;
  let carbs    = 0;
  let fat      = 0;
  let badge    = '';
  let badgeColor: string = colors.primary;

  if (item.source === 'food') {
    const f = item.data as Food;
    name     = f.name;
    calories = f.calories_per_100g;
    protein  = f.protein_per_100g;
    carbs    = f.carbs_per_100g;
    fat      = f.fat_per_100g;
    badge    = f.is_raw ? t('card.per100gRaw') : t('card.per100g');
    badgeColor = colors.textMuted;
  } else if (item.source === 'recipe') {
    const r = item.data as any;
    name     = r.name;
    const isPortioned = !!r.macros_per_portion;
    const macros = r.macros_per_portion ?? r.macros_per_100g ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
    calories = macros.calories ?? 0;
    protein  = macros.protein ?? 0;
    carbs    = macros.carbs ?? 0;
    fat      = macros.fat ?? 0;
    badge    = isPortioned
      ? t('card.recipePortion', { country: r.country, grams: Math.round(r.macros_per_portion.portion_g) })
      : t('card.recipePer100g', { country: r.country });
    badgeColor = colors.accent;
  } else {
    const rf = item.data as RestaurantFood;
    name     = rf.name;
    calories = rf.calories;
    protein  = rf.protein;
    carbs    = rf.carbs;
    fat      = rf.fat;
    badge    = rf.restaurant_name;
    badgeColor = colors.warning;
  }

  return (
    <AnimatedPressable onPress={onPress} style={styles.card} scaleTo={0.98}>
      <View style={styles.top}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <View style={[styles.badge, { borderColor: `${badgeColor}50` }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>{badge}</Text>
          </View>
        </View>
        <Text style={styles.calories}>{Math.round(calories)} <Text style={styles.kcal}>{t('macro.kcal')}</Text></Text>
      </View>

      {!compact && (
        <View style={styles.macros}>
          <MacroPill value={protein} label="P" color={colors.protein} styles={styles} />
          <MacroPill value={carbs}   label="C" color={colors.carbs} styles={styles} />
          <MacroPill value={fat}     label="F" color={colors.fat} styles={styles} />
        </View>
      )}

      {allergenWarning ? (
        <View style={styles.allergenBadge}>
          <Ionicons name="warning" size={12} color="#fff" />
          <Text style={styles.allergenBadgeText} numberOfLines={2}>{allergenWarning}</Text>
        </View>
      ) : null}

      {onAdd && !compact && (
        <AnimatedPressable onPress={onAdd} style={styles.addBtn} hitSlop={10} scaleTo={0.8} hapticStyle="Medium">
          <Ionicons name="add-circle" size={28} color={colors.primary} />
        </AnimatedPressable>
      )}
    </AnimatedPressable>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: Spacing.sm,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  nameRow: {
    flex: 1,
    marginRight: 8,
    gap: 4,
  },
  name: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: colors.textPrimary,
  },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  calories: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: colors.calories,
  },
  kcal: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.regular,
    color: colors.textMuted,
  },
  macros: {
    flexDirection: 'row',
    gap: 6,
  },
  allergenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.error,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 8,
    maxWidth: '100%',
  },
  allergenBadgeText: {
    color: '#fff',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    flexShrink: 1,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  pillValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  pillLabel: {
    fontSize: FontSize.xs,
    color: colors.textMuted,
  },
  addBtn: {
    position: 'absolute',
    right: Spacing.md,
    bottom: Spacing.sm,
  },
});
