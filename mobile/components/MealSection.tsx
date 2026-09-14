import React, { useState } from 'react';
import {
  View, Text, StyleSheet,
  LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, FontWeight, Spacing, Radius, ThemeColors } from '../constants/theme';
import type { Meal, MealItem } from '../types';
import { getMealMeta } from '../constants/theme';
import { RECIPES_DB } from '../services/api';
import { useMeals } from '../context/MealContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { getMealTypeLabel, getCookingMethodLabel } from '../constants/i18n';
import AnimatedPressable from './AnimatedPressable';

if (Platform.OS === 'android' && typeof UIManager.setLayoutAnimationEnabledExperimental === 'function') {
  try {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  } catch (_) {}
}


interface MealSectionProps {
  meal:       Meal;
  onDelete?:  (id: string) => void;
}

function ItemRow({ item }: { item: MealItem }) {
  const { lang, t } = useLanguage();
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [showRecipe, setShowRecipe] = useState(false);
  const isRecipe = item.source_type === 'recipe';
  const recipe = isRecipe ? RECIPES_DB.find((r) => r.id === item.source_id) : null;

  let scaledIngredients: { name: string; qty_g: number }[] = [];
  if (recipe && recipe.ingredients) {
    const factor = item.quantity_g / (recipe.total_weight_g || 100);
    scaledIngredients = recipe.ingredients.map((ing) => ({
      name: ing.name,
      qty_g: ing.base_qty_g * factor,
    }));
  }

  return (
    <View style={styles.itemWrapper}>
      <AnimatedPressable
        style={styles.itemRow}
        onPress={() => isRecipe && setShowRecipe(!showRecipe)}
        disabled={!isRecipe}
      >
        <View style={styles.itemInfo}>
          <View style={styles.itemNameRow}>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.food_name ?? item.source_type}
            </Text>
            {isRecipe && (
              <View style={styles.recipeBadge}>
                <Text style={styles.recipeBadgeText}>{t('mealSection.recipe')}</Text>
              </View>
            )}
          </View>
          <Text style={styles.itemMeta}>
            {item.quantity_g}g
            {item.cooking_method && item.cooking_method !== 'raw'
              ? ` · ${getCookingMethodLabel(lang, item.cooking_method)}`
              : ''}
            {item.bone_weight_g && item.bone_weight_g > 0
              ? ` · 🦴 ${t('mealSection.bones', { grams: item.bone_weight_g })}`
              : item.with_bones
                ? ` · ${t('mealSection.withBones')}`
                : ''}
          </Text>
        </View>
        <View style={styles.itemRight}>
          <Text style={styles.itemCal}>{Math.round(item.calculated_calories ?? 0)} kcal</Text>
          {isRecipe && (
            <Ionicons
              name={showRecipe ? "chevron-up" : "chevron-down"}
              size={14}
              color={colors.textMuted}
              style={{ marginLeft: 4 }}
            />
          )}
        </View>
      </AnimatedPressable>

      {isRecipe && showRecipe && scaledIngredients.length > 0 && (
        <View style={styles.ingredientsList}>
          <Text style={styles.ingredientsTitle}>
            {t('mealSection.ingredients', { grams: item.quantity_g })}
          </Text>
          <View style={styles.ingredientsGrid}>
            {scaledIngredients.map((ing, i) => (
              <View key={i} style={styles.ingredientItem}>
                <View style={styles.bullet} />
                <Text style={styles.ingredientText}>
                  {Math.round(ing.qty_g)}g <Text style={styles.ingredientName}>{ing.name}</Text>
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

export default function MealSection({ meal, onDelete }: MealSectionProps) {
  const { targets } = useMeals();
  const { lang, t } = useLanguage();
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(true);

  const mealMeta = getMealMeta(isDark, meal.meal_type);
  const totalCal = meal.items.reduce((s, i) => s + (i.calculated_calories ?? 0), 0);
  const totalP = meal.items.reduce((s, i) => s + (i.calculated_protein ?? 0), 0);
  const totalC = meal.items.reduce((s, i) => s + (i.calculated_carbs ?? 0), 0);
  const totalF = meal.items.reduce((s, i) => s + (i.calculated_fat ?? 0), 0);

  const splitRatios: Record<string, number> = {
    breakfast: 0.30,
    lunch: 0.35,
    dinner: 0.30,
    snack: 0.05,
  };
  const ratio = splitRatios[meal.meal_type] ?? 0.25;

  const calTarget = targets ? Math.round(targets.calories_target * ratio) : 0;
  const pTarget = targets ? Math.round(targets.protein_target * ratio) : 0;
  const cTarget = targets ? Math.round(targets.carbs_target * ratio) : 0;
  const fTarget = targets ? Math.round(targets.fat_target * ratio) : 0;

  const calPct = calTarget > 0 ? totalCal / calTarget : 0;
  const pPct = pTarget > 0 ? totalP / pTarget : 0;
  const cPct = cTarget > 0 ? totalC / cTarget : 0;
  const fPct = fTarget > 0 ? totalF / fTarget : 0;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((p) => !p);
  };

  return (
    <View style={[styles.container, { borderLeftColor: mealMeta.fg }]}>
      <AnimatedPressable
        style={styles.header}
        onPress={toggle}
        scaleTo={0.98}
      >
        <View style={styles.headerLeft}>
          <Ionicons name={mealMeta.icon as any} size={18} color={mealMeta.fg} />
          <Text style={[styles.mealType, { color: mealMeta.fg }]}>
            {getMealTypeLabel(lang, mealMeta.key)}
          </Text>
          <Text style={styles.itemCount}>
            {t('mealSection.itemCount', { count: meal.items.length })}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.totalCal}>{Math.round(totalCal)} kcal</Text>
          {onDelete && (
            <AnimatedPressable onPress={() => onDelete(meal.id)} hitSlop={15} scaleTo={0.8} hapticStyle="Medium">
              <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
            </AnimatedPressable>
          )}
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textMuted}
          />
        </View>
      </AnimatedPressable>

      {expanded && (
        <View style={styles.expandedContent}>
          {/* Meal Target Alignment Dashboard */}
          {targets && (
            <View style={styles.alignmentCard}>
              <View style={styles.alignmentHeaderRow}>
                <Ionicons name="analytics" size={14} color={colors.textSecondary} />
                <Text style={styles.alignmentTitle}>
                  {t('mealSection.alignment', { pct: Math.round(ratio * 100) })}
                </Text>
              </View>
              <View style={styles.alignmentGrid}>
                {[
                  { label: t('macro.calories'), current: totalCal, target: calTarget, pct: calPct, color: colors.calories, unit: ' kcal' },
                  { label: t('macro.protein'), current: totalP, target: pTarget, pct: pPct, color: colors.protein, unit: 'g' },
                  { label: t('macro.carbs'), current: totalC, target: cTarget, pct: cPct, color: colors.carbs, unit: 'g' },
                  { label: t('macro.fat'), current: totalF, target: fTarget, pct: fPct, color: colors.fat, unit: 'g' },
                ].map((m) => (
                  <View key={m.label} style={styles.alignmentItem}>
                    <View style={styles.alignmentItemHeader}>
                      <Text style={styles.alignmentLabel}>{m.label}</Text>
                      <Text style={styles.alignmentValues}>
                        <Text style={[styles.boldText, { color: m.color }]}>{Math.round(m.current)}</Text>
                        <Text style={styles.mutedText}>/{m.target}{m.unit}</Text>
                      </Text>
                    </View>
                    <View style={styles.miniTrack}>
                      <View style={[styles.miniFill, { width: `${Math.min(100, m.pct * 100)}%`, backgroundColor: m.color }]} />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.items}>
            {meal.items.length === 0 ? (
              <Text style={styles.emptyText}>{t('mealSection.noItems')}</Text>
            ) : (
              meal.items.map((item) => <ItemRow key={item.id} item={item} />)
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    borderRadius: Radius.md,
    borderLeftWidth: 3,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mealType: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  itemCount: {
    fontSize: FontSize.xs,
    color: colors.textMuted,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  totalCal: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: colors.calories,
  },
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  alignmentCard: {
    padding: Spacing.md,
    backgroundColor: colors.bgElevated + '30',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  alignmentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  alignmentTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  alignmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  alignmentItem: {
    width: '47%',
    marginBottom: Spacing.xs,
  },
  alignmentItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  alignmentLabel: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  alignmentValues: {
    fontSize: FontSize.xs,
  },
  boldText: {
    fontWeight: FontWeight.bold,
  },
  mutedText: {
    color: colors.textMuted,
  },
  miniTrack: {
    height: 4,
    backgroundColor: colors.bgElevated,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  miniFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  items: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: 2,
  },
  itemWrapper: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  itemInfo: {
    flex: 1,
    marginRight: 8,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: colors.textPrimary,
  },
  recipeBadge: {
    backgroundColor: colors.primaryGlow,
    borderColor: colors.primary,
    borderWidth: 0.5,
    borderRadius: Radius.sm,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  recipeBadgeText: {
    fontSize: 9,
    color: colors.primary,
    fontWeight: FontWeight.bold,
  },
  itemMeta: {
    fontSize: FontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemCal: {
    fontSize: FontSize.sm,
    color: colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  ingredientsList: {
    backgroundColor: colors.bgElevated + '20',
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ingredientsTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  ingredientsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bgCard,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  bullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  ingredientText: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
  },
  ingredientName: {
    fontWeight: FontWeight.medium,
    color: colors.textPrimary,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 12,
  },
});
