import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  Pressable, ScrollView, Switch,
} from 'react-native';
import { FontSize, FontWeight, Spacing, Radius, ThemeColors } from '../constants/theme';
import { COOKING_METHODS, FOOD_TYPES } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { getCookingMethodLabel, labelForOptionKey } from '../constants/i18n';
import { findTextAllergens } from '../services/allergenService';
import type { LogManualItem } from '../types';
import { useTheme } from '../context/ThemeContext';
import AnimatedPressable from './AnimatedPressable';

interface ManualEntryFormProps {
  onSubmit: (item: LogManualItem) => void;
  /** Meal-tint propagated from the Log screen selector (theme-aware, AA-safe). */
  accentFg?:     string;
  accentBg?:     string;
  accentBorder?: string;
}

export interface ChipTint {
  bg:     string;
  border: string;
  fg:     string;
}

type ChipListProps<T extends string> = {
  options:  readonly { key: T; label: string }[];
  value:    T;
  onChange: (val: T) => void;
  tint?:    ChipTint;
};

function ChipList<T extends string>({ options, value, onChange, tint }: ChipListProps<T>) {
  const { colors } = useTheme();
  const active = tint ?? { bg: colors.primaryGlow, border: colors.primary, fg: colors.primary };
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
      {options.map((opt) => {
        const selected = value === opt.key;
        return (
          <AnimatedPressable
            key={opt.key}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.chip, selected && { backgroundColor: active.bg, borderColor: active.border, borderWidth: 1.5 }]}
            onPress={() => onChange(opt.key)}
            scaleTo={0.92}
          >
            <Text style={[styles.chipText, selected && { color: active.fg, fontWeight: FontWeight.bold }]}>{opt.label}</Text>
          </AnimatedPressable>
        );
      })}
    </ScrollView>
  );
}

function FoodTypeChips({
  value, onChange, tint,
}: {
  value: string; onChange: (v: string) => void; tint?: ChipTint;
}) {
  const { colors } = useTheme();
  const active = tint ?? { bg: colors.primaryGlow, border: colors.primary, fg: colors.primary };
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const options = FOOD_TYPES.map((f) => ({ key: f as string, label: f.replace(/-/g, ' ') }));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
      {options.map((opt) => {
        const selected = value === opt.key;
        return (
          <AnimatedPressable
            key={opt.key}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.chip, selected && { backgroundColor: active.bg, borderColor: active.border, borderWidth: 1.5 }]}
            onPress={() => onChange(opt.key)}
            scaleTo={0.92}
          >
            <Text style={[styles.chipText, selected && { color: active.fg, fontWeight: FontWeight.bold }]}>{opt.label}</Text>
          </AnimatedPressable>
        );
      })}
    </ScrollView>
  );
}

export default function ManualEntryForm({ onSubmit, accentFg, accentBg, accentBorder }: ManualEntryFormProps) {
  const { lang, t } = useLanguage();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const tint: ChipTint | undefined = accentFg && accentBg && accentBorder
    ? { fg: accentFg, bg: accentBg, border: accentBorder }
    : undefined;
  const activeTint: ChipTint = tint ?? { fg: colors.primary, bg: colors.primaryGlow, border: colors.primary };
  const [foodType,      setFoodType]      = useState('chicken');
  const [cookingMethod, setCookingMethod] = useState('raw');
  const [grams,         setGrams]         = useState('100');
  const [hasBones,      setHasBones]      = useState(false);
  const [boneWeight,    setBoneWeight]    = useState('');
  const [showMacros,    setShowMacros]    = useState(false);
  const [macros,        setMacros]        = useState({ cal: '', p: '', c: '', f: '' });
  const [error,         setError]         = useState('');
  const [liveAllergens, setLiveAllergens] = useState<string[]>([]);

  const handleFoodTypeChange = (text: string) => {
    setFoodType(text);
    setLiveAllergens(findTextAllergens(user, text));
  };

  const cookingOptions = React.useMemo(
    () => COOKING_METHODS.map((m) => ({ key: m.key, label: getCookingMethodLabel(lang, m.key) })),
    [lang],
  );

  const handleSubmit = () => {
    const quantity = parseFloat(grams);
    if (!foodType.trim()) { setError(t('form.errFoodType')); return; }
    if (isNaN(quantity) || quantity <= 0) { setError(t('form.errWeight')); return; }
    setError('');

    const payload: any = {
      type:       'manual',
      food_type:  foodType.trim(),
      method:     cookingMethod,
      quantity_g: quantity,
      with_bones: hasBones,
      bone_weight_g: hasBones ? (parseFloat(boneWeight) || 0) : undefined,
    };

    if (showMacros) {
      payload.manual_macros = {
        calories: parseFloat(macros.cal) || 0,
        protein:  parseFloat(macros.p)   || 0,
        carbs:    parseFloat(macros.c)   || 0,
        fat:      parseFloat(macros.f)   || 0,
      };
    }

    onSubmit(payload);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>{t('form.foodType')}</Text>
      <FoodTypeChips value={foodType} onChange={handleFoodTypeChange} tint={tint} />

      {/* Custom text override */}
      <TextInput
        style={styles.input}
        placeholder={t('form.foodPlaceholder')}
        placeholderTextColor={colors.textMuted}
        value={foodType}
        onChangeText={handleFoodTypeChange}
      />

      <Text style={styles.sectionLabel}>{t('form.cookingMethod')}</Text>
      <ChipList
        options={cookingOptions}
        value={cookingMethod as any}
        onChange={setCookingMethod as any}
        tint={tint}
      />

      <Text style={styles.sectionLabel}>{t('form.amountGrams')}</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        placeholder={t('ph.exampleGrams')}
        placeholderTextColor={colors.textMuted}
        value={grams}
        onChangeText={setGrams}
      />

      {/* Quick gram buttons */}
      <View style={styles.quickGrams}>
        {['100', '150', '200', '250'].map((g) => {
          const gramActive = grams === g;
          return (
            <AnimatedPressable
              key={g}
              style={[
                styles.gramBtn,
                gramActive && {
                  backgroundColor: activeTint.bg,
                  borderColor: activeTint.border,
                  borderWidth: 1.5,
                },
              ]}
              onPress={() => setGrams(g)}
              scaleTo={0.93}
            >
              <Text style={[styles.gramBtnText, gramActive && { color: activeTint.fg, fontWeight: FontWeight.bold }]}>
                {g}g
              </Text>
            </AnimatedPressable>
          );
        })}
      </View>

      <View style={styles.bonesContainer}>
        <View style={styles.bonesRow}>
          <View>
            <Text style={styles.sectionLabel}>{t('form.hasBones')}</Text>
            <Text style={styles.bonesHint}>{t('form.bonesHint')}</Text>
          </View>
          <Switch
            value={hasBones}
            onValueChange={setHasBones}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.textPrimary}
          />
        </View>
        {hasBones && (
          <View style={styles.boneWeightInputRow}>
            <Text style={styles.boneWeightLabel}>{t('form.boneWeight')}</Text>
            <TextInput
              style={styles.boneInput}
              keyboardType="decimal-pad"
              placeholder={t('ph.exampleBones')}
              placeholderTextColor={colors.textMuted}
              value={boneWeight}
              onChangeText={setBoneWeight}
            />
          </View>
        )}
      </View>

      <View style={styles.macrosToggleRow}>
        <Text style={styles.sectionLabel}>{t('form.manualMacros')}</Text>
        <Switch
          value={showMacros}
          onValueChange={setShowMacros}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor={colors.textPrimary}
        />
      </View>

      {showMacros && (
        <View style={styles.manualMacrosGrid}>
          {[
            { key: 'cal', label: t('macro.calories'), color: colors.calories },
            { key: 'p',   label: t('macro.protein'),  color: colors.protein },
            { key: 'c',   label: t('macro.carbs'),    color: colors.carbs },
            { key: 'f',   label: t('macro.fat'),      color: colors.fat },
          ].map((m) => (
            <View key={m.key} style={[styles.macroInputBox, { borderLeftWidth: 3, borderLeftColor: m.color }]}>
              <Text style={[styles.macroInputLabel, { color: m.color }]}>{m.label}</Text>
              <TextInput
                style={styles.macroInput}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                value={(macros as any)[m.key]}
                onChangeText={(v) => setMacros({ ...macros, [m.key]: v })}
              />
            </View>
          ))}
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {liveAllergens.length > 0 && (
        <View style={styles.allergenWarning}>
          <Text style={styles.allergenWarningText}>
            ⚠️ {t('form.liveAllergen', { allergens: liveAllergens.map((a) => labelForOptionKey(lang, a)).join(', ') })}
          </Text>
        </View>
      )}

      <AnimatedPressable style={styles.submitBtn} onPress={handleSubmit} scaleTo={0.97}>
        <Text style={styles.submitText}>{t('form.addToMeal')}</Text>
      </AnimatedPressable>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: 2,
    marginTop: 4,
  },
  chipScroll: {
    flexGrow: 0,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    backgroundColor: colors.bgCard,
  },
  chipText: {
    fontSize: FontSize.sm,
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: colors.bgInput,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.md,
    color: colors.textPrimary,
    fontSize: FontSize.md,
  },
  quickGrams: {
    flexDirection: 'row',
    gap: 8,
  },
  gramBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  gramBtnText: {
    fontSize: FontSize.sm,
    color: colors.textSecondary,
  },
  bonesContainer: {
    backgroundColor: colors.bgElevated,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginTop: 4,
    gap: 8,
  },
  bonesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bonesHint: {
    fontSize: FontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  boneWeightInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
  boneWeightLabel: {
    fontSize: FontSize.sm,
    color: colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  boneInput: {
    backgroundColor: colors.bgInput,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    color: colors.textPrimary,
    fontSize: FontSize.md,
    width: 100,
    textAlign: 'right',
  },
  macrosToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  manualMacrosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  macroInputBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.bgInput,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  macroInputLabel: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  macroInput: {
    color: colors.textPrimary,
    fontSize: FontSize.md,
    height: 32,
    padding: 0,
  },
  error: {
    color: colors.error,
    fontSize: FontSize.sm,
  },
  allergenWarning: {
    backgroundColor: `${colors.error}12`,
    borderWidth: 1,
    borderColor: `${colors.error}45`,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  allergenWarningText: {
    color: colors.error,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: 4,
  },
  submitText: {
    color: colors.textInverse,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
});
