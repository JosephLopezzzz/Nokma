import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Alert, ActivityIndicator, Image, Platform, Switch, TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getActivityLabel, labelForOptionKey } from '../../constants/i18n';
import type { Language } from '../../services/coachMessageService';
import type { StringKey } from '../../constants/strings';
import { resetTutorial } from '../../components/DashboardTutorial';
import { FontSize, FontWeight, Spacing, Radius, ThemeColors } from '../../constants/theme';
import AnimatedPressable from '../../components/AnimatedPressable';
import { useTheme } from '../../context/ThemeContext';
import { getHealthSyncConfig, setHealthSyncEnabled, syncDailyTotalsToHealth, readHealthData, initHealthConnect, type HealthSyncConfig, type HealthReadData } from '../../services/healthSyncService';
import { useMeals } from '../../context/MealContext';


const LANGUAGE_OPTIONS: { key: Language; labelKey: StringKey; flag: string }[] = [
  { key: 'english',  labelKey: 'lang.english',  flag: '🇬🇧' },
  { key: 'filipino', labelKey: 'lang.filipino', flag: '🇵🇭' },
];

function StatRow({ label, value, colors }: { label: string; value: string; colors: ThemeColors }) {
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function MacroTarget({ label, unit, value, color, colors }: { label: string; unit: string; value: number; color: string; colors: ThemeColors }) {
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={[styles.macroTarget, { borderColor: `${color}30` }]}>
      <Text style={[styles.macroValue, { color }]}>{Math.round(value)}</Text>
      <Text style={styles.macroUnit}>{unit}</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { user, resetUser, updateUser } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const { colors, theme, setTheme } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { totals } = useMeals();
  const [resetting, setResetting] = useState(false);
  const [healthConfig, setHealthConfig] = useState<HealthSyncConfig | null>(null);
  const [syncingHealth, setSyncingHealth] = useState(false);
  const [healthData, setHealthData] = useState<HealthReadData>({ steps: null, weight: null });

  React.useEffect(() => {
    // Initialize Health Connect and load config
    const init = async () => {
      if (Platform.OS === 'android') {
        await initHealthConnect();
      }
      const cfg = await getHealthSyncConfig();
      setHealthConfig(cfg);
      // If sync is enabled, read health data
      if (cfg.enabled && cfg.permissionsGranted) {
        const data = await readHealthData();
        setHealthData(data);
      }
    };
    init();
  }, []);

  const handleToggleHealthSync = async (val: boolean) => {
    const ok = await setHealthSyncEnabled(val);
    if (ok) {
      const updated = await getHealthSyncConfig();
      setHealthConfig(updated);
      // Read health data when enabling
      if (val && updated.permissionsGranted) {
        const data = await readHealthData();
        setHealthData(data);
      }
    } else if (val) {
      // Permission denied or HC not available
      Alert.alert(
        'Health Connect',
        'Could not connect to Health Connect. Please make sure it is installed and permissions are granted.',
      );
    }
  };

  const handleManualHealthSync = async () => {
    setSyncingHealth(true);
    try {
      // Sync actual consumed totals (not targets)
      await syncDailyTotalsToHealth({
        calories: Math.round(totals.calories),
        protein: Math.round(totals.protein),
        carbs: Math.round(totals.carbs),
        fat: Math.round(totals.fat),
      });
      const updated = await getHealthSyncConfig();
      setHealthConfig(updated);
      // Also refresh read data
      const data = await readHealthData();
      setHealthData(data);
      Alert.alert('Health Sync', `Synced today\'s nutrition to ${updated.platform}`);
    } catch (e) {
      Alert.alert('Sync Failed', 'Could not sync to Health Connect. Please try again.');
    } finally {
      setSyncingHealth(false);
    }
  };


  const handleReset = async () => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${t('profile.resetTitle')}\n\n${t('profile.resetBody')}`)) {
        setResetting(true);
        await resetUser();
      }
      return;
    }

    Alert.alert(t('profile.resetTitle'), t('profile.resetBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.resetConfirm'),
        style: 'destructive',
        onPress: async () => {
          setResetting(true);
          await resetUser();
        },
      },
    ]);
  };

  const handlePickImage = async () => {
    const launchPicker = async () => {
      try {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
          Alert.alert(t('ocr.permissionDenied'), t('profile.photoPermission'));
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          await updateUser({ avatar_uri: result.assets[0].uri });
        }
      } catch (e) {
        console.error('Failed to pick image:', e);
        Alert.alert(t('common.error'), t('profile.photoFailed'));
      }
    };

    if (user?.avatar_uri) {
      Alert.alert(t('profile.picture'), t('profile.pictureAction'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('profile.removePhoto'), style: 'destructive', onPress: async () => await updateUser({ avatar_uri: undefined }) },
        { text: t('profile.choosePhoto'), onPress: launchPicker },
      ]);
    } else {
      launchPicker();
    }
  };

  if (!user) return null;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Avatar / header */}
      <View style={styles.avatarSection}>
        <AnimatedPressable style={styles.avatarWrapper} onPress={handlePickImage} scaleTo={0.93}>
          {user.avatar_uri ? (
            <Image
              source={{ uri: user.avatar_uri }}
              style={styles.avatarImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.avatarImage, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgElevated }]}>
               <Ionicons 
                 name="person" 
                 size={150} 
                 color={colors.primary} 
               />
            </View>
          )}
          {/* Camera badge */}
          <View style={styles.cameraBadge}>
            <Ionicons name="camera" size={14} color={colors.textInverse} />
            <Text style={{ fontSize: 10, color: colors.textInverse, fontWeight: 'bold' }}>Edit</Text>
          </View>
        </AnimatedPressable>
        <Text style={styles.userName}>{user.full_name ?? t('profile.defaultName')}</Text>
        <View style={[styles.goalBadge, { backgroundColor: colors.primaryGlow, borderColor: colors.primary }]}>
          <Text style={styles.goalBadgeText}>
            {user.goal === 'lose'
              ? t('profile.goalLose')
              : user.goal === 'gain'
                ? t('profile.goalGain')
                : t('profile.goalMaintain')}
          </Text>
        </View>
      </View>

      {/* Daily targets */}
      {user.calories_target && (
        <View style={[styles.card, styles.elevatedCard]}>
          <Text style={styles.cardTitle}>{t('profile.dailyTargets')}</Text>
          <View style={styles.macroTargetsRow}>
            <MacroTarget label={t('macro.calories')} unit={t('macro.kcal')}  value={user.calories_target}     color={colors.calories} colors={colors} />
            <MacroTarget label={t('macro.protein')}  unit={t('macro.grams')} value={user.protein_target ?? 0} color={colors.protein}  colors={colors} />
            <MacroTarget label={t('macro.carbs')}    unit={t('macro.grams')} value={user.carbs_target   ?? 0} color={colors.carbs}    colors={colors} />
            <MacroTarget label={t('macro.fat')}      unit={t('macro.grams')} value={user.fat_target     ?? 0} color={colors.fat}      colors={colors} />
          </View>
        </View>
      )}

      {/* Custom Macros Settings */}
      <View style={[styles.card, styles.elevatedCard]}>
        <View style={styles.settingRow}>
          <Text style={styles.cardTitle}>Use Custom Macros</Text>
          <Switch
            value={user.use_custom_macros ?? false}
            onValueChange={(val) => updateUser({ use_custom_macros: val })}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
        {user.use_custom_macros && (
          <View style={styles.customMacrosGrid}>
            <View style={styles.customMacroInputRow}>
              <Text style={styles.healthLabel}>Calories</Text>
              <TextInput
                style={styles.customMacroInput}
                keyboardType="numeric"
                value={user.calories_target?.toString() || ''}
                onChangeText={(t) => updateUser({ calories_target: parseInt(t) || 0 })}
                placeholder="2000"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={styles.customMacroInputRow}>
              <Text style={styles.healthLabel}>Protein (g)</Text>
              <TextInput
                style={styles.customMacroInput}
                keyboardType="numeric"
                value={user.protein_target?.toString() || ''}
                onChangeText={(t) => updateUser({ protein_target: parseInt(t) || 0 })}
                placeholder="150"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={styles.customMacroInputRow}>
              <Text style={styles.healthLabel}>Carbs (g)</Text>
              <TextInput
                style={styles.customMacroInput}
                keyboardType="numeric"
                value={user.carbs_target?.toString() || ''}
                onChangeText={(t) => updateUser({ carbs_target: parseInt(t) || 0 })}
                placeholder="200"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={styles.customMacroInputRow}>
              <Text style={styles.healthLabel}>Fat (g)</Text>
              <TextInput
                style={styles.customMacroInput}
                keyboardType="numeric"
                value={user.fat_target?.toString() || ''}
                onChangeText={(t) => updateUser({ fat_target: parseInt(t) || 0 })}
                placeholder="65"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
        )}
      </View>

      {/* Body stats */}
      <View style={[styles.card, styles.elevatedCard]}>
        <Text style={styles.cardTitle}>{t('profile.bodyStats')}</Text>
        <StatRow label={t('profile.age')}      value={user.age ? t('profile.ageValue', { age: user.age }) : '—'} colors={colors} />
        <StatRow label={t('profile.sex')}      value={user.sex ? (user.sex === 'male' ? `♂ ${t('profile.male')}` : `♀ ${t('profile.female')}`) : '—'} colors={colors} />
        <StatRow label={t('profile.height')}   value={user.height_cm ? `${user.height_cm} cm` : '—'} colors={colors} />
        <StatRow label={t('profile.weight')}   value={user.weight_kg ? `${user.weight_kg} kg` : '—'} colors={colors} />
        <StatRow label={t('profile.activity')} value={getActivityLabel(lang, user.activity_level ?? 2)} colors={colors} />
        <StatRow label={t('profile.country')}  value={user.country ?? 'Philippines'} colors={colors} />
      </View>

      {/* Health Info card */}
      <View style={[styles.card, styles.elevatedCard]}>
        <Text style={styles.cardTitle}>{t('profile.healthInfo')}</Text>

        {/* Condition */}
        <View style={styles.healthRow}>
          <Text style={styles.healthLabel}>{t('profile.condition')}</Text>
          <View style={[styles.conditionBadge, { backgroundColor: `${colors.warning}15`, borderColor: `${colors.warning}40` }]}>
            <Ionicons name="medical-outline" size={14} color={colors.warning} />
            <Text style={[styles.conditionText, { color: colors.warning }]}>
              {!user.health_condition || user.health_condition === 'none'
                ? t('common.none')
                : user.health_condition === 'others' || user.health_condition === 'other'
                  ? (user.health_condition_custom || t('profile.otherCondition'))
                  : labelForOptionKey(lang, user.health_condition)}
            </Text>
          </View>
        </View>

        {/* Allergies */}
        <View style={[styles.healthRow, { alignItems: 'flex-start', marginTop: 8 }]}>
          <Text style={styles.healthLabel}>{t('profile.allergies')}</Text>
          {(!user.allergies || user.allergies.length === 0) ? (
            <Text style={styles.statValue}>{t('common.none')}</Text>
          ) : (
            <View style={styles.allergyChipsWrap}>
              {user.allergies.map((a: string) => (
                <View key={a} style={[styles.allergyChip, { backgroundColor: `${colors.protein}15`, borderColor: `${colors.protein}40` }]}>
                  <Text style={[styles.allergyChipText, { color: colors.protein }]}>{labelForOptionKey(lang, a)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Settings Unified Card */}
      <View style={[styles.card, styles.elevatedCard]}>
        <Text style={[styles.cardTitle, { marginBottom: Spacing.sm }]}>Settings</Text>
        
        {/* Language switcher */}
        <View style={styles.settingsSection}>
          <Text style={styles.settingsSubTitle}>{t('profile.language')}</Text>
          <View style={styles.langRow}>
            {LANGUAGE_OPTIONS.map((option) => {
              const active = lang === option.key;
              return (
                <AnimatedPressable
                  key={option.key}
                  style={[styles.langBtn, active && styles.langBtnActive]}
                  onPress={() => setLang(option.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={t(option.labelKey)}
                  scaleTo={0.95}
                >
                  <Text style={styles.langFlag}>{option.flag}</Text>
                  <Text style={[styles.langBtnText, active && styles.langBtnTextActive]}>
                    {t(option.labelKey)}
                  </Text>
                  {active && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                </AnimatedPressable>
              );
            })}
          </View>
          <Text style={styles.langHint}>{t('profile.languageHint')}</Text>
        </View>

        <View style={styles.settingsDivider} />

        {/* Theme switcher */}
        <View style={styles.settingsSection}>
          <Text style={styles.settingsSubTitle}>Theme</Text>
          <View style={styles.langRow}>
            {[
              { key: 'light', label: 'Light', icon: 'sunny' },
              { key: 'dark', label: 'Dark', icon: 'moon' },
              { key: 'system', label: 'Auto', icon: 'color-palette' },
            ].map((option) => {
              const active = theme === option.key;
              return (
                <AnimatedPressable
                  key={option.key}
                  style={[styles.langBtn, active && styles.langBtnActive]}
                  onPress={() => setTheme(option.key as any)}
                  scaleTo={0.95}
                >
                  <Ionicons name={option.icon as any} size={18} color={active ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.langBtnText, active && styles.langBtnTextActive]}>
                    {option.label}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>
        </View>

        <View style={styles.settingsDivider} />

        {/* Native Health Sync */}
        <View style={styles.settingsSection}>
          <View style={styles.settingRow}>
            <View style={{ flex: 1, paddingRight: Spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
                <Ionicons name="heart" size={18} color="#ef4444" />
                <Text style={styles.settingsSubTitle}>Health Connect</Text>
              </View>
              <Text style={styles.langHint}>
                Sync logged calories & macros to {healthConfig?.platform || 'Health Connect'} automatically.
              </Text>
            </View>
            <Switch
              value={healthConfig?.enabled ?? false}
              onValueChange={handleToggleHealthSync}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>

          {healthConfig?.enabled && (
            <View style={{ marginTop: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
              {/* Permission status */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm }}>
                <Ionicons
                  name={healthConfig.permissionsGranted ? 'checkmark-circle' : 'alert-circle'}
                  size={16}
                  color={healthConfig.permissionsGranted ? '#10b981' : '#f59e0b'}
                />
                <Text style={{ fontSize: FontSize.xs, color: healthConfig.permissionsGranted ? '#10b981' : '#f59e0b' }}>
                  {healthConfig.permissionsGranted ? 'Permissions granted' : 'Permissions needed'}
                </Text>
              </View>

              {/* Read data from Health Connect */}
              {healthConfig.permissionsGranted && (healthData.steps !== null || healthData.weight !== null) && (
                <View style={{ flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.sm }}>
                  {healthData.steps !== null && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="footsteps-outline" size={14} color={colors.textSecondary} />
                      <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary }}>
                        {healthData.steps.toLocaleString()} steps today
                      </Text>
                    </View>
                  )}
                  {healthData.weight !== null && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="scale-outline" size={14} color={colors.textSecondary} />
                      <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary }}>
                        {healthData.weight.toFixed(1)} kg
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Sync controls */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: FontSize.xs, color: colors.textMuted }}>
                  Last Synced: {healthConfig.lastSyncedAt ? new Date(healthConfig.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
                </Text>
                <AnimatedPressable
                  style={{ backgroundColor: colors.primaryGlow, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.sm, borderWidth: 1, borderColor: colors.primary }}
                  onPress={handleManualHealthSync}
                >
                  <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: colors.primary }}>
                    {syncingHealth ? 'Syncing...' : 'Sync Now'}
                  </Text>
                </AnimatedPressable>
              </View>
            </View>
          )}
        </View>

        <View style={styles.settingsDivider} />

        {/* Actions */}
        <AnimatedPressable
          style={styles.replayBtn}
          onPress={() => {
            resetTutorial();
            if (Platform.OS === 'web') {
              window.alert(t('profile.tutorialResetBody'));
            } else {
              Alert.alert(t('profile.tutorialReset'), t('profile.tutorialResetBody'));
            }
          }}
          scaleTo={0.96}
        >
          <Ionicons name="help-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.replayBtnText}>{t('profile.replayTutorial')}</Text>
        </AnimatedPressable>

        <AnimatedPressable style={styles.logoutBtn} onPress={handleReset} disabled={resetting} scaleTo={0.96}>
          {resetting
            ? <ActivityIndicator color={colors.error} />
            : <>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
                <Text style={styles.logoutText}>{t('profile.resetProgress')}</Text>
              </>}
        </AnimatedPressable>
      </View>


      <Text style={styles.version}>{t('profile.version')}</Text>
    </ScrollView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  avatarWrapper: {
    width: 140, height: 140,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 10, elevation: 4,
  },
  avatarImage: { width: 140, height: 140, borderRadius: 70, backgroundColor: colors.bgElevated },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  userName:  { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: colors.textPrimary },
  userEmail: { fontSize: FontSize.sm,  color: colors.textMuted },
  goalBadge: {
    flexDirection: 'row', borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: Radius.full,
  },
  goalBadgeText: { fontSize: FontSize.sm, color: colors.primary, fontWeight: FontWeight.semibold },
  card: {
    backgroundColor: colors.bgCard, borderRadius: Radius.xl, padding: Spacing.lg,
    borderWidth: 1, borderColor: colors.border, gap: 4,
  },
  cardTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: colors.textPrimary, marginBottom: Spacing.sm },
  macroTargetsRow: { flexDirection: 'row', gap: 8 },
  macroTarget: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: Radius.md, borderWidth: 1 },
  macroValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  macroUnit:  { fontSize: FontSize.xs, color: colors.textMuted },
  macroLabel: { fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 2 },
  statRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border,
  },
  statLabel: { fontSize: FontSize.sm, color: colors.textMuted },
  statValue: { fontSize: FontSize.sm, color: colors.textPrimary, fontWeight: FontWeight.semibold },
  bmiCard: {
    backgroundColor: colors.bgCard, borderRadius: Radius.xl,
    padding: Spacing.lg, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', gap: 4,
  },
  bmiLabel: { fontSize: FontSize.sm, color: colors.textMuted },
  bmiValue: { fontSize: FontSize.hero, fontWeight: FontWeight.extrabold },
  bmiCat:   { fontSize: FontSize.md,  fontWeight: FontWeight.semibold },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: Spacing.md, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: `${colors.error}40`, backgroundColor: `${colors.error}10`,
  },
  logoutText: { fontSize: FontSize.md, color: colors.error, fontWeight: FontWeight.semibold },
  version:    { fontSize: FontSize.xs, color: colors.textMuted, textAlign: 'center', marginTop: Spacing.sm },

  // Replay tutorial
  replayBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: Spacing.md, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: `${colors.primary}40`, backgroundColor: `${colors.primary}10`,
  },
  replayBtnText: { fontSize: FontSize.md, color: colors.primary, fontWeight: FontWeight.semibold },

  // Health Info card
  healthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  healthLabel: { fontSize: FontSize.sm, color: colors.textMuted },
  conditionBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1 },
  conditionText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  allergyChipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1, justifyContent: 'flex-end' },
  allergyChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1 },
  allergyChipText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, textTransform: 'capitalize' },

  // Language switcher
  langRow: { flexDirection: 'row', gap: Spacing.sm },
  langBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: Radius.md,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgElevated,
  },
  langBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryGlow },
  langFlag: { fontSize: FontSize.md },
  langBtnText: { fontSize: FontSize.sm, color: colors.textSecondary, fontWeight: FontWeight.semibold },
  langBtnTextActive: { color: colors.primary },
  langHint: { fontSize: FontSize.xs, color: colors.textMuted, marginTop: Spacing.sm },

  // Custom Macros Settings
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  customMacrosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: Spacing.sm },
  customMacroInputRow: { width: '48%' },
  customMacroInput: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: FontSize.md,
    color: colors.textPrimary,
    marginTop: 4,
  },
  settingsSection: { paddingVertical: Spacing.sm },
  settingsSubTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: colors.textPrimary, marginBottom: Spacing.sm },
  settingsDivider: { height: 1, backgroundColor: colors.border, marginVertical: Spacing.sm },
  elevatedCard: {
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 0,
  }
});
