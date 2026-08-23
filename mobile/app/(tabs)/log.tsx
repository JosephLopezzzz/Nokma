import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMeals } from '../../context/MealContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getMealTypeLabel, getCookingMethodLabel, labelForOptionKey } from '../../constants/i18n';
import ManualEntryForm from '../../components/ManualEntryForm';
import { FontSize, FontWeight, Spacing, Radius, MEAL_TYPES, ThemeColors } from '../../constants/theme';
import type { LogItem } from '../../types';
import { calculateApi } from '../../services/api';
import { resolveLogItemKeywords, findAllergenMatches } from '../../services/allergenService';
import { ProgressiveNutritionData } from '../../services/nutritionScanner';
import { isOnline, enqueueTask, processSyncQueue } from '../../services/syncService';
import AnimatedPressable from '../../components/AnimatedPressable';
import { useTheme } from '../../context/ThemeContext';
import ScannerCamera from '../../components/ScannerCamera';

export default function LogMealScreen() {
  const { logMeal } = useMeals();
  const { showToast } = useToast();
  const { lang, t } = useLanguage();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [mealType, setMealType] = useState<string>('breakfast');
  const [items,    setItems]    = useState<LogItem[]>([]);
  const [flagged,  setFlagged]  = useState<boolean[]>([]);
  const [preview,  setPreview]  = useState<{ calories: number; protein: number; carbs: number; fat: number } | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [tab,      setTab]      = useState<'manual' | 'preview'>('manual');
  const [networkStatus, setNetworkStatus] = useState(true);
  const [showScanner, setShowScanner] = useState(false);

  // Poll for background sync
  useEffect(() => {
    const checkSync = async () => {
      const online = await isOnline();
      setNetworkStatus(online);
      
      if (online) {
        await processSyncQueue((type, parsed) => {
          if (type === 'scan_nutrition_label' && parsed) {
            const scannedItem: LogItem = {
              type: 'manual',
              food_type: parsed.food_name,
              quantity_g: parsed.serving_size_g || 100,
              manual_macros: {
                calories: parsed.calories,
                protein: parsed.protein,
                carbs: parsed.carbs,
                fat: parsed.fat,
              },
              method: 'raw',
              with_bones: false,
            };
            confirmAddItem(scannedItem);
            showToast({ type: 'success', title: 'Offline Scan Processed', subtitle: `Added ${parsed.food_name}.` });
          }
        });
      }
    };
    
    // Check immediately, then every 10 seconds
    checkSync();
    const interval = setInterval(checkSync, 10000);
    return () => clearInterval(interval);
  }, []);

  const addItem = async (item: LogItem, isFlagged = false) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const newItems = [...items, item];
    setFlagged((prev) => [...prev, isFlagged]);
    setItems(newItems);
    try {
      const { data } = await calculateApi.macros(newItems);
      setPreview({
        calories: data.total_calories,
        protein:  data.total_protein,
        carbs:    data.total_carbs,
        fat:      data.total_fat,
      });
    } catch (err) {
      console.warn('[Preview]', err);
    }
  };

  const confirmAddItem = async (item: LogItem) => {
    const keywords = await resolveLogItemKeywords(item);
    const matched = findAllergenMatches(user, keywords);

    if (matched.length === 0) {
      addItem(item);
      return;
    }

    const allergenLabels = matched.map((a) => labelForOptionKey(lang, a)).join(', ');
    Alert.alert(
      t('log.allergenTitle'),
      t('log.allergenBody', { allergens: allergenLabels }),
      [
        { text: t('common.cancel'), style: 'cancel' as const },
        {
          text: t('log.logAnyway'),
          style: 'destructive' as const,
          onPress: () => addItem(item, true),
        },
      ],
    );
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setFlagged((prev) => prev.filter((_, i) => i !== index));
    if (items.length <= 1) setPreview(null);
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      showToast({
        type: 'error',
        title: t('log.noItemsTitle'),
        subtitle: t('log.noItemsBody'),
      });
      return;
    }
    setLoading(true);
    try {
      await logMeal(mealType, items);
      setItems([]);
      setFlagged([]);
      setPreview(null);
    } catch (err: any) {
      console.error('[LogMeal] Submit failed:', err.response?.data ?? err.message);
      const errorMsg = err.response?.data?.error ?? err.message ?? t('log.failedBody');
      showToast({ type: 'error', title: t('log.failedTitle'), subtitle: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleCaptureScanner = async (parsed: ProgressiveNutritionData) => {
    setShowScanner(false);
    try {
      const scannedItem: LogItem = {
        type: 'manual',
        food_type: parsed.product_name || 'Scanned Food',
        quantity_g: parsed.serving_size.value || 100,
        manual_macros: {
          calories: parsed.nutrition.calories?.value || 0,
          protein: parsed.nutrition.protein?.value || 0,
          carbs: parsed.nutrition.total_carbohydrates?.value || 0,
          fat: parsed.nutrition.total_fat?.value || 0,
        },
        method: 'raw',
        with_bones: false,
      };
      
      confirmAddItem(scannedItem);
      showToast({ type: 'success', title: 'Scan Successful', subtitle: `Added ${parsed.product_name || 'Scanned Food'} from label.` });
    } catch (e: any) {
      console.error('Scan failed:', e);
      Alert.alert('Scan Failed', e.message || 'Could not read the nutrition label.');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.title}>{t('log.title')}</Text>
          {!networkStatus && (
            <Ionicons name="cloud-offline" size={24} color={colors.textMuted} />
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mealTypeScroll}>
          {MEAL_TYPES.map((mt) => (
            <AnimatedPressable
              key={mt.key}
              style={[styles.mealTypeBtn, mealType === mt.key && { backgroundColor: `${mt.color}20`, borderColor: mt.color }]}
              onPress={() => setMealType(mt.key)}
              scaleTo={0.95}
            >
              <Ionicons name={mt.icon as any} size={16} color={mealType === mt.key ? mt.color : colors.textMuted} />
              <Text style={[styles.mealTypeText, mealType === mt.key && { color: mt.color }]}>
                {getMealTypeLabel(lang, mt.key)}
              </Text>
            </AnimatedPressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {items.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('log.itemsToLog', { count: items.length })}</Text>
            {items.map((item, idx) => {
              const label = item.type === 'manual'
                ? `${(item as any).food_type} · ${getCookingMethodLabel(lang, (item as any).method ?? 'raw')} · ${item.quantity_g}g${(item as any).bone_weight_g && (item as any).bone_weight_g > 0 ? ` · 🦴 ${(item as any).bone_weight_g}g` : ((item as any).with_bones ? ' · 🦴' : '')}`
                : `${item.type} · ${item.quantity_g}g`;
              return (
                <View key={idx} style={[styles.pendingItem, flagged[idx] && styles.pendingItemWarn]}>
                  <View style={styles.pendingLabelRow}>
                    {flagged[idx] && <Ionicons name="warning" size={16} color={colors.error} />}
                    <Text style={styles.pendingLabel} numberOfLines={1}>{label}</Text>
                  </View>
                  <AnimatedPressable onPress={() => removeItem(idx)} hitSlop={10} scaleTo={0.8} hapticStyle="Medium">
                    <Ionicons name="close-circle" size={20} color={colors.error} />
                  </AnimatedPressable>
                </View>
              );
            })}
            {preview && (
              <View style={styles.previewRow}>
                {[
                  { label: t('macro.kcal'), value: preview.calories, color: colors.calories },
                  { label: 'P',    value: preview.protein,  color: colors.protein },
                  { label: 'C',    value: preview.carbs,    color: colors.carbs },
                  { label: 'F',    value: preview.fat,      color: colors.fat },
                ].map((m) => (
                  <View key={m.label} style={[styles.previewPill, { backgroundColor: `${m.color}15` }]}>
                    <Text style={[styles.previewValue, { color: m.color }]}>{Math.round(m.value)}</Text>
                    <Text style={styles.previewLabel}>{m.label}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('log.manualEntry')}</Text>
          
          <AnimatedPressable style={styles.scanBtn} onPress={() => setShowScanner(true)} disabled={loading} scaleTo={0.97}>
            <Ionicons name="barcode-outline" size={24} color={colors.primary} />
            <Text style={styles.scanBtnText}>Scan Nutrition Facts Label</Text>
          </AnimatedPressable>

          <ManualEntryForm onSubmit={confirmAddItem} />
        </View>

        <AnimatedPressable
          style={[styles.submitBtn, items.length === 0 && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading || items.length === 0}
          scaleTo={0.96}
        >
          {loading
            ? <ActivityIndicator color={colors.textInverse} />
            : <>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.textInverse} />
                <Text style={styles.submitText}>
                  {t('log.submit', { mealType: getMealTypeLabel(lang, mealType), count: items.length })}
                </Text>
              </>
          }
        </AnimatedPressable>
      </ScrollView>

      <ScannerCamera 
        visible={showScanner} 
        onClose={() => setShowScanner(false)} 
        onCapture={handleCaptureScanner} 
      />
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgCard,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mealTypeScroll: {
    flexDirection: 'row',
  },
  mealTypeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    backgroundColor: colors.bgInput,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  mealTypeText: {
    fontSize: FontSize.sm,
    color: colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  pendingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  pendingItemWarn: {
    backgroundColor: `${colors.error}10`,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    borderBottomWidth: 0,
    marginBottom: 4,
  },
  pendingLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    paddingRight: Spacing.md,
  },
  pendingLabel: {
    fontSize: FontSize.md,
    color: colors.textPrimary,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  previewPill: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.md,
  },
  previewValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  previewLabel: {
    fontSize: FontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    marginTop: Spacing.md,
    backgroundColor: colors.primary,
  },
  submitBtnDisabled: {
    backgroundColor: colors.border,
  },
  submitText: {
    color: colors.textInverse,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primaryGlow,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: `${colors.primary}40`,
  },
  scanBtnText: {
    color: colors.primary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
});
