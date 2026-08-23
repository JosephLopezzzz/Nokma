import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Alert,
  BackHandler,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import CoachBubble, { CoachBubbleHandle } from './CoachBubble';
import SearchableSelectList from './SearchableSelectList';
import {
  getWelcomeMessage,
  getAgeMessage,
  getHeightWeightMessage,
  getFeedbackMessage,
  getGoalMessage,
  getGoalLabel,
  getHealthConditionMessage,
  getHealthConditionNoResponse,
  getHealthConditionWhichMessage,
  getHealthConditionSafetyNotice,
  getAllergiesMessage,
  getAllergiesNoResponse,
  getAllergiesSelectMessage,
  getAllergySafetyNotice,
  getFinishMessage,
  getSuggestedGoal,
  getNamePlaceholder,
  getAgePlaceholder,
  getNoLabel,
  getYesLabel,
  getSkipLabel,
  getContinueLabel,
  getGoToDashboardLabel,
  getConfirmLabel,
  ONBOARDING_PROGRESS_KEY,
  LANGUAGE_KEY,
  convertHeight,
  convertWeight,
  validateAge,
  validateHeight,
  validateWeight,
} from '../services/coachMessageService';
import {
  getHealthConditionGroups,
  getAllergenGroups,
  getMetaOptions,
} from '../constants/i18n';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../constants/theme';

const STEPS = [
  'language',
  'welcome',
  'age',
  'sex',
  'height_weight',
  'feedback',
  'goal',
  'health',
  'allergies',
  'finish',
] as const;

interface FormData {
  name: string;
  age: string;
  sex: 'male' | 'female' | '';
  heightValue: string;
  weightValue: string;
  heightUnit: 'cm' | 'in';
  weightUnit: 'kg' | 'lbs';
  goal: string;
  healthAnswer: '' | 'no' | 'yes' | 'skip';
  healthConditions: string[];
  healthConditionOther: string;
  allergiesAnswer: '' | 'no' | 'yes' | 'skip';
  allergies: string[];
  allergyOther: string;
  intolerances: string;
}

const emptyForm: FormData = {
  name: '',
  age: '',
  sex: '',
  heightValue: '',
  weightValue: '',
  heightUnit: 'cm',
  weightUnit: 'kg',
  goal: '',
  healthAnswer: '',
  healthConditions: [],
  healthConditionOther: '',
  allergiesAnswer: '',
  allergies: [],
  allergyOther: '',
  intolerances: '',
};

export default function CoachOnboarding() {
  const { completeOnboarding } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const bubbleRef = useRef<CoachBubbleHandle>(null) as any;
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [typingDone, setTypingDone] = useState(true);
  const [saving, setSaving] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const healthGroups = useMemo(() => getHealthConditionGroups(lang), [lang]);
  const allergenGroups = useMemo(() => getAllergenGroups(lang), [lang]);
  const metaOptions = useMemo(() => getMetaOptions(lang), [lang]);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(ONBOARDING_PROGRESS_KEY);
        const savedLang = await AsyncStorage.getItem(LANGUAGE_KEY);
        if (savedLang === 'filipino' || savedLang === 'english') setLang(savedLang);
        if (saved) {
          const parsed = JSON.parse(saved);
          setStep(parsed.step ?? 0);
          setForm({ ...emptyForm, ...parsed.form });
        }
      } catch {}
    })();
  }, []);

  const saveProgress = useCallback(
    async (s: number, f: FormData) => {
      try {
        await AsyncStorage.setItem(
          ONBOARDING_PROGRESS_KEY,
          JSON.stringify({ step: s, form: f }),
        );
      } catch {}
    },
    [],
  );

  const updateForm = useCallback(
    (patch: Partial<FormData>) => {
      setForm((prev) => {
        const next = { ...prev, ...patch };
        saveProgress(step, next);
        return next;
      });
    },
    [step, saveProgress],
  );

  const goToStep = useCallback(
    (next: number) => {
      setTypingDone(false);
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setStep(next);
        saveProgress(next, form);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }).start();
      });
    },
    [form, saveProgress],
  );

  const validateCurrent = (): boolean => {
    const s = STEPS[step];
    if (s === 'welcome' && !form.name.trim()) {
      Alert.alert('', t('validation.name'));
      return false;
    }
    if (s === 'age') {
      const age = parseInt(form.age, 10);
      if (!form.age || !validateAge(age)) {
        Alert.alert('', t('validation.age'));
        return false;
      }
    }
    if (s === 'sex' && !form.sex) {
      Alert.alert('', t('validation.required') || 'Please select an option');
      return false;
    }
    if (s === 'height_weight') {
      const h = parseFloat(form.heightValue);
      const w = parseFloat(form.weightValue);
      if (!form.heightValue || !validateHeight(convertHeight(h, form.heightUnit))) {
        Alert.alert('', t('validation.height'));
        return false;
      }
      if (!form.weightValue || !validateWeight(convertWeight(w, form.weightUnit))) {
        Alert.alert('', t('validation.weight'));
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!typingDone && step < STEPS.length - 1) return;
    if (!validateCurrent()) return;
    if (step < STEPS.length - 1) {
      goToStep(step + 1);
    } else {
      finishOnboarding();
    }
  };

  const finishOnboarding = async () => {
    if (saving) return;
    setSaving(true);
    const heightCm = convertHeight(parseFloat(form.heightValue) || 0, form.heightUnit);
    const weightKg = convertWeight(parseFloat(form.weightValue) || 0, form.weightUnit);
    const age = parseInt(form.age, 10) || undefined;

    const hasHealth = form.healthAnswer === 'yes' && form.healthConditions.length > 0 && !form.healthConditions.includes('none') && !form.healthConditions.includes('prefer_not_say');
    const healthConditions = hasHealth ? form.healthConditions : form.healthAnswer === 'skip' ? undefined : [];
    const hasAllergies = form.allergiesAnswer === 'yes' && form.allergies.length > 0 && !form.allergies.includes('none') && !form.allergies.includes('prefer_not_say');
    const allergyItems = hasAllergies ? form.allergies : form.allergiesAnswer === 'skip' ? undefined : [];

    await completeOnboarding({
      full_name: form.name.trim(),
      age,
      sex: form.sex || undefined,
      height_cm: heightCm > 0 ? heightCm : undefined,
      weight_kg: weightKg > 0 ? weightKg : undefined,
      goal: form.goal === 'build_habits' ? 'maintain' : (form.goal as any) || 'maintain',
      health_condition: healthConditions ? healthConditions.join(',') : healthConditions,
      health_condition_custom: hasHealth && form.healthConditionOther ? form.healthConditionOther : undefined,
      allergies: allergyItems,
      allergy_other: hasAllergies && form.allergyOther ? form.allergyOther : undefined,
      intolerances: form.intolerances || undefined,
    });

    try {
      await AsyncStorage.removeItem(ONBOARDING_PROGRESS_KEY);
    } catch {}
    router.replace('/(tabs)');
  };

  const currentStep = STEPS[step];

  useEffect(() => {
    const onBack = () => {
      if (step <= 0) return false;
      if (currentStep === 'language') return false;
      goToStep(step - 1);
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [step, currentStep]);

  const suggestedGoal =
    form.heightValue && form.weightValue
      ? getSuggestedGoal(
          convertHeight(parseFloat(form.heightValue) || 0, form.heightUnit),
          convertWeight(parseFloat(form.weightValue) || 0, form.weightUnit),
        )
      : null;

  const goalKeys = ['lose', 'maintain', 'gain', 'build_habits'] as const;

  const handleExitSetup = () => {
    Alert.alert(
      t('onboarding.exitTitle'),
      t('onboarding.exitBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.exit'), style: 'destructive', onPress: () => BackHandler.exitApp() },
      ],
    );
  };

  const visibleSteps = STEPS.filter((s) => s !== 'feedback');
  const dotIndex = visibleSteps.indexOf(currentStep as typeof visibleSteps[number]);
  const showBack = step > 0 && currentStep !== 'feedback';
  const isFirstStep = currentStep === 'language';

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}>
        {isFirstStep ? (
          <Pressable onPress={handleExitSetup} style={styles.backBtn} accessibilityLabel={t('onboarding.exitSetup')}>
            <Text style={styles.backText}>{t('common.exit')}</Text>
          </Pressable>
        ) : showBack ? (
          <Pressable onPress={() => goToStep(step - 1)} style={styles.backBtn} accessibilityLabel={t('common.back')}>
            <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
            <Text style={styles.backText}>{t('common.back')}</Text>
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}
        {currentStep !== 'language' && currentStep !== 'feedback' && (
          <View style={styles.dotsRow}>
            {visibleSteps.map((_, i) => (
              <View key={i} style={[styles.dot, i <= dotIndex && styles.dotActive]} />
            ))}
          </View>
        )}
        <View style={styles.backBtn} />
      </View>



      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* ── Language selection ── */}
          {currentStep === 'language' && (
            <View style={styles.langScreen}>
              <View style={styles.langMascotStage}>
                <Image
                  source={require('../assets/mascot/idle.gif')}
                  style={styles.langMascot}
                  contentFit="contain"
                />
              </View>
              <Text style={styles.langTitle}>{t('onboarding.selectLanguage')}</Text>

              <View style={styles.optionsStack}>
                <Pressable
                  style={[styles.optionCard, lang === 'english' && styles.optionCardActive]}
                  onPress={async () => {
                    await setLang('english');
                    goToStep(step + 1);
                  }}
                >
                  <Text style={[styles.optionCardText, lang === 'english' && styles.optionCardTextActive]}>
                    English
                  </Text>
                  {lang === 'english' && (
                    <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                  )}
                </Pressable>
                <Pressable
                  style={[styles.optionCard, lang === 'filipino' && styles.optionCardActive]}
                  onPress={async () => {
                    await setLang('filipino');
                    goToStep(step + 1);
                  }}
                >
                  <Text style={[styles.optionCardText, lang === 'filipino' && styles.optionCardTextActive]}>
                    Filipino
                  </Text>
                  {lang === 'filipino' && (
                    <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                  )}
                </Pressable>
              </View>
            </View>
          )}

          {/* ── Welcome ── */}
          {currentStep === 'welcome' && (
            <StepContent
              coachMessage={getWelcomeMessage(lang)}
              typingDone={typingDone}
              onTypeDone={() => setTypingDone(true)}
              stepKey="welcome"
              bubbleRef={bubbleRef}
            >
              <TextInput
                style={styles.inputCard}
                placeholder={getNamePlaceholder(lang)}
                placeholderTextColor="#9CA3AF"
                value={form.name}
                onChangeText={(v) => updateForm({ name: v })}
                autoFocus
              />
              <PrimaryBtn label={getConfirmLabel(lang)} onPress={handleNext} />
            </StepContent>
          )}

          {/* ── Age ── */}
          {currentStep === 'age' && (
            <StepContent
              coachMessage={getAgeMessage(lang, form.name || t('coach.friend'))}
              typingDone={typingDone}
              onTypeDone={() => setTypingDone(true)}
              stepKey="age"
              bubbleRef={bubbleRef}
            >
              <TextInput
                style={styles.inputCard}
                placeholder={getAgePlaceholder(lang)}
                placeholderTextColor="#9CA3AF"
                value={form.age}
                onChangeText={(v) => updateForm({ age: v.replace(/[^0-9]/g, '') })}
                keyboardType="number-pad"
                autoFocus
                maxLength={3}
              />
              <PrimaryBtn label={getConfirmLabel(lang)} onPress={handleNext} />
            </StepContent>
          )}

          {/* ── Sex ── */}
          {currentStep === 'sex' && (
            <StepContent
              coachMessage={t('onboarding.sexMessage') || 'What is your biological sex? This helps me calculate your daily calorie and macronutrient targets accurately.'}
              typingDone={typingDone}
              onTypeDone={() => setTypingDone(true)}
              stepKey="sex"
              bubbleRef={bubbleRef}
            >
              <View style={styles.optionsStack}>
                {['male', 'female'].map((s) => (
                  <Pressable
                    key={s}
                    style={[styles.optionCard, form.sex === s && styles.optionCardActive]}
                    onPress={() => updateForm({ sex: s as any })}
                  >
                    <Text style={[styles.optionCardText, form.sex === s && styles.optionCardTextActive]}>
                      {s === 'male' ? (t('onboarding.male') || 'Male') : (t('onboarding.female') || 'Female')}
                    </Text>
                    {form.sex === s && (
                      <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                    )}
                  </Pressable>
                ))}
              </View>
              {form.sex ? (
                <PrimaryBtn label={getConfirmLabel(lang)} onPress={() => goToStep(step + 1)} />
              ) : null}
            </StepContent>
          )}

          {/* ── Height & Weight ── */}
          {currentStep === 'height_weight' && (
            <StepContent
              coachMessage={getHeightWeightMessage(lang)}
              typingDone={typingDone}
              onTypeDone={() => setTypingDone(true)}
              stepKey="height_weight"
              bubbleRef={bubbleRef}
            >
              <View style={styles.dualRow}>
                <View style={styles.dualField}>
                  <Text style={styles.fieldLabel}>{t('onboarding.height')}</Text>
                  <View style={styles.inputWithUnit}>
                    <TextInput
                      style={[styles.inputCard, styles.inputFlex]}
                      placeholder={`e.g. ${form.heightUnit === 'cm' ? '175' : "5'9\""}`}
                      placeholderTextColor="#9CA3AF"
                      value={form.heightValue}
                      onChangeText={(v) => updateForm({ heightValue: v.replace(/[^0-9.]/g, '') })}
                      keyboardType="decimal-pad"
                    />
                    <UnitToggle
                      options={['cm', 'in'] as const}
                      selected={form.heightUnit}
                      onSelect={(v) => updateForm({ heightUnit: v })}
                    />
                  </View>
                </View>
                <View style={styles.dualField}>
                  <Text style={styles.fieldLabel}>{t('onboarding.weight')}</Text>
                  <View style={styles.inputWithUnit}>
                    <TextInput
                      style={[styles.inputCard, styles.inputFlex]}
                      placeholder={`e.g. ${form.weightUnit === 'kg' ? '70' : '154'}`}
                      placeholderTextColor="#9CA3AF"
                      value={form.weightValue}
                      onChangeText={(v) => updateForm({ weightValue: v.replace(/[^0-9.]/g, '') })}
                      keyboardType="decimal-pad"
                    />
                    <UnitToggle
                      options={['kg', 'lbs'] as const}
                      selected={form.weightUnit}
                      onSelect={(v) => updateForm({ weightUnit: v })}
                    />
                  </View>
                </View>
              </View>
              <PrimaryBtn label={getContinueLabel(lang)} onPress={handleNext} />
            </StepContent>
          )}

          {/* ── Feedback ── */}
          {currentStep === 'feedback' && (
            <StepContent
              coachMessage={getFeedbackMessage(lang, form.name || t('coach.friend'))}
              typingDone={typingDone}
              onTypeDone={() => setTypingDone(true)}
              stepKey="feedback"
              bubbleRef={bubbleRef}
            >
              {typingDone && (
                <PrimaryBtn label={getContinueLabel(lang)} onPress={() => goToStep(step + 1)} />
              )}
            </StepContent>
          )}

          {/* ── Goal ── */}
          {currentStep === 'goal' && (
            <StepContent
              coachMessage={getGoalMessage(
                lang,
                suggestedGoal ? getGoalLabel(lang, suggestedGoal) : undefined,
              )}
              typingDone={typingDone}
              onTypeDone={() => setTypingDone(true)}
              stepKey="goal"
              bubbleRef={bubbleRef}
            >
              <View style={styles.optionsStack}>
                {goalKeys.map((g) => (
                  <Pressable
                    key={g}
                    style={[styles.optionCard, form.goal === g && styles.optionCardActive]}
                    onPress={() => updateForm({ goal: g })}
                  >
                    <Text style={[styles.optionCardText, form.goal === g && styles.optionCardTextActive]}>
                      {getGoalLabel(lang, g)}
                    </Text>
                    {form.goal === g && (
                      <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                    )}
                  </Pressable>
                ))}
              </View>
              {form.goal ? (
                <PrimaryBtn label={getConfirmLabel(lang)} onPress={() => goToStep(step + 1)} />
              ) : null}
            </StepContent>
          )}

          {/* ── Health condition ── */}
          {currentStep === 'health' && (
            <StepContent
              coachMessage={
                form.healthAnswer === 'no' || form.healthAnswer === 'skip'
                  ? getHealthConditionNoResponse(lang)
                  : form.healthAnswer === 'yes'
                    ? getHealthConditionWhichMessage(lang)
                    : getHealthConditionMessage(lang)
              }
              typingDone={typingDone}
              onTypeDone={() => setTypingDone(true)}
              stepKey="health"
              bubbleRef={bubbleRef}
            >
              {typingDone && (
                <View style={styles.optionsStack}>
                  {(['yes', 'no', 'skip'] as const).map((a) => (
                    <Pressable
                      key={a}
                      style={[styles.optionCard, form.healthAnswer === a && styles.optionCardActive]}
                      onPress={() => {
                        const wasYes = form.healthAnswer === 'yes';
                        const isYes = a === 'yes';
                        const patch: Partial<FormData> = { healthAnswer: a };
                        if (wasYes && !isYes) {
                          patch.healthConditions = [];
                          patch.healthConditionOther = '';
                        }
                        updateForm(patch);
                        setTypingDone(false);
                      }}
                    >
                      <Text style={[styles.optionCardText, form.healthAnswer === a && styles.optionCardTextActive]}>
                        {a === 'no' ? getNoLabel(lang) : a === 'yes' ? getYesLabel(lang) : getSkipLabel(lang)}
                      </Text>
                      {form.healthAnswer === a && (
                        <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                      )}
                    </Pressable>
                  ))}
                </View>
              )}

              {form.healthAnswer === 'yes' && typingDone && (
                <>
                  <SearchableSelectList
                    groups={healthGroups}
                    metaOptions={metaOptions}
                    selectedKeys={form.healthConditions}
                    onSelectionChange={(keys) => updateForm({ healthConditions: keys })}
                    otherKey="other"
                    otherValue={form.healthConditionOther}
                    onOtherChange={(text) => updateForm({ healthConditionOther: text })}
                    noneKey="none"
                    preferNotKey="prefer_not_say"
                    searchPlaceholder={t('onboarding.searchConditions')}
                    safetyMessage={getHealthConditionSafetyNotice(lang)}
                  />
                  {form.healthConditions.length > 0 && (
                    <PrimaryBtn label={getConfirmLabel(lang)} onPress={() => goToStep(step + 1)} />
                  )}
                </>
              )}

              {(form.healthAnswer === 'no' || form.healthAnswer === 'skip') && typingDone && (
                <PrimaryBtn label={getContinueLabel(lang)} onPress={() => goToStep(step + 1)} />
              )}
            </StepContent>
          )}

          {/* ── Allergies ── */}
          {currentStep === 'allergies' && (
            <StepContent
              coachMessage={
                form.allergiesAnswer === 'no' || form.allergiesAnswer === 'skip'
                  ? getAllergiesNoResponse(lang)
                  : form.allergiesAnswer === 'yes'
                    ? getAllergiesSelectMessage(lang)
                    : getAllergiesMessage(lang)
              }
              typingDone={typingDone}
              onTypeDone={() => setTypingDone(true)}
              stepKey="allergies"
              bubbleRef={bubbleRef}
            >
              {typingDone && (
                <View style={styles.optionsStack}>
                  {(['yes', 'no', 'skip'] as const).map((a) => (
                    <Pressable
                      key={a}
                      style={[styles.optionCard, form.allergiesAnswer === a && styles.optionCardActive]}
                      onPress={() => {
                        const wasYes = form.allergiesAnswer === 'yes';
                        const isYes = a === 'yes';
                        const patch: Partial<FormData> = { allergiesAnswer: a };
                        if (wasYes && !isYes) {
                          patch.allergies = [];
                          patch.allergyOther = '';
                        }
                        updateForm(patch);
                        setTypingDone(false);
                      }}
                    >
                      <Text style={[styles.optionCardText, form.allergiesAnswer === a && styles.optionCardTextActive]}>
                        {a === 'no' ? getNoLabel(lang) : a === 'yes' ? getYesLabel(lang) : getSkipLabel(lang)}
                      </Text>
                      {form.allergiesAnswer === a && (
                        <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                      )}
                    </Pressable>
                  ))}
                </View>
              )}

              {form.allergiesAnswer === 'yes' && typingDone && (
                <>
                  <SearchableSelectList
                    groups={allergenGroups}
                    metaOptions={metaOptions}
                    selectedKeys={form.allergies}
                    onSelectionChange={(keys) => updateForm({ allergies: keys })}
                    otherKey="other"
                    otherValue={form.allergyOther}
                    onOtherChange={(text) => updateForm({ allergyOther: text })}
                    noneKey="none"
                    preferNotKey="prefer_not_say"
                    searchPlaceholder={t('onboarding.searchAllergens')}
                    safetyMessage={getAllergySafetyNotice(lang)}
                  />
                  <View style={styles.sectionSpacer} />
                  <Text style={styles.sectionTitle}>{t('onboarding.intolerancesTitle')}</Text>
                  <Text style={styles.sectionHint}>{t('onboarding.intolerancesHint')}</Text>
                  <TextInput
                    style={styles.inputCard}
                    placeholder={t('onboarding.intolerancesPlaceholder')}
                    placeholderTextColor="#9CA3AF"
                    value={form.intolerances}
                    onChangeText={(v) => updateForm({ intolerances: v })}
                    multiline
                    numberOfLines={2}
                  />
                  {form.allergies.length > 0 && (
                    <PrimaryBtn label={getConfirmLabel(lang)} onPress={() => goToStep(step + 1)} />
                  )}
                </>
              )}

              {(form.allergiesAnswer === 'no' || form.allergiesAnswer === 'skip') && typingDone && (
                <PrimaryBtn label={getContinueLabel(lang)} onPress={() => goToStep(step + 1)} />
              )}
            </StepContent>
          )}

          {/* ── Finish ── */}
          {currentStep === 'finish' && (
            <StepContent
              coachMessage={getFinishMessage(lang, form.name || t('coach.friend'))}
              typingDone={typingDone}
              onTypeDone={() => setTypingDone(true)}
              stepKey="finish"
              bubbleRef={bubbleRef}
            >
              {typingDone && (
                <>
                  <ReviewSummary form={form} lang={lang} />
                  <PrimaryBtn label={getGoToDashboardLabel(lang)} onPress={finishOnboarding} />
                </>
              )}
            </StepContent>
          )}
        </Animated.View>
      </ScrollView>

      {/* Full-screen tap-to-skip overlay */}
      {!typingDone && currentStep !== 'language' && currentStep !== 'feedback' && (
        <Pressable
          style={[StyleSheet.absoluteFill, { zIndex: 999, elevation: 999 }]}
          onPress={() => bubbleRef.current?.skip()}
          accessibilityRole="button"
          accessibilityLabel="Reveal the full coach message"
        />
      )}
    </KeyboardAvoidingView>
  );
}

function PrimaryBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.primaryBtn} onPress={onPress}>
      <Text style={styles.primaryBtnText}>{label}</Text>
      <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
    </Pressable>
  );
}

function UnitToggle<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: readonly T[];
  selected: T;
  onSelect: (v: T) => void;
}) {
  return (
    <View style={styles.unitToggle}>
      {options.map((opt) => (
        <Pressable
          key={opt}
          style={[styles.unitOption, selected === opt && styles.unitOptionActive]}
          onPress={() => onSelect(opt)}
        >
          <Text style={[styles.unitText, selected === opt && styles.unitTextActive]}>{opt}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function StepContent({
  coachMessage,
  typingDone,
  onTypeDone,
  stepKey,
  children,
  bubbleRef,
}: {
  coachMessage: string;
  typingDone: boolean;
  onTypeDone: () => void;
  stepKey: string;
  children: React.ReactNode;
  bubbleRef?: React.RefObject<CoachBubbleHandle>;
}) {
  return (
    <View key={stepKey} style={styles.stepContent}>
      <CoachBubble
        ref={bubbleRef}
        message={coachMessage}
        typewriter
        typewriterSpeed={15}
        onTypeComplete={onTypeDone}
      />
      {typingDone && <View style={styles.inputArea}>{children}</View>}
    </View>
  );
}

function ReviewSummary({ form, lang }: { form: FormData; lang: 'english' | 'filipino' }) {
  const isEn = lang === 'english';

  // Build height display string
  const heightDisplay = form.heightValue
    ? `${form.heightValue} ${form.heightUnit}`
    : isEn ? 'Not set' : 'Hindi itinakda';

  // Build weight display string
  const weightDisplay = form.weightValue
    ? `${form.weightValue} ${form.weightUnit}`
    : isEn ? 'Not set' : 'Hindi itinakda';

  // Build goal display
  const goalDisplay = form.goal
    ? getGoalLabel(lang, form.goal)
    : isEn ? 'Not set' : 'Hindi itinakda';

  // Build health conditions display
  let healthDisplay: string;
  if (form.healthAnswer === 'skip') {
    healthDisplay = isEn ? 'Skipped' : 'Nilaktawan';
  } else if (form.healthAnswer === 'no' || !form.healthConditions.length) {
    healthDisplay = isEn ? 'None' : 'Wala';
  } else {
    const items = form.healthConditions
      .filter(k => k !== 'none' && k !== 'prefer_not_say')
      .map(k => k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
    if (form.healthConditionOther) items.push(form.healthConditionOther);
    healthDisplay = items.length > 0 ? items.join(', ') : (isEn ? 'None' : 'Wala');
  }

  // Build allergies display
  let allergiesDisplay: string;
  if (form.allergiesAnswer === 'skip') {
    allergiesDisplay = isEn ? 'Skipped' : 'Nilaktawan';
  } else if (form.allergiesAnswer === 'no' || !form.allergies.length) {
    allergiesDisplay = isEn ? 'None' : 'Wala';
  } else {
    const items = form.allergies
      .filter(k => k !== 'none' && k !== 'prefer_not_say')
      .map(k => k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
    if (form.allergyOther) items.push(form.allergyOther);
    allergiesDisplay = items.length > 0 ? items.join(', ') : (isEn ? 'None' : 'Wala');
  }

  const rows: { icon: string; label: string; value: string }[] = [
    { icon: 'person-outline', label: isEn ? 'Name' : 'Pangalan', value: form.name || '—' },
    { icon: 'calendar-outline', label: isEn ? 'Age' : 'Edad', value: form.age ? `${form.age} ${isEn ? 'years old' : 'taong gulang'}` : '—' },
    { icon: 'resize-outline', label: isEn ? 'Height' : 'Taas', value: heightDisplay },
    { icon: 'barbell-outline', label: isEn ? 'Weight' : 'Bigat', value: weightDisplay },
    { icon: 'flag-outline', label: isEn ? 'Goal' : 'Layunin', value: goalDisplay },
    { icon: 'heart-outline', label: isEn ? 'Health Conditions' : 'Kalagayang Pangkalusugan', value: healthDisplay },
    { icon: 'warning-outline', label: isEn ? 'Allergies' : 'Mga Alerhiya', value: allergiesDisplay },
  ];

  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <Ionicons name="clipboard-outline" size={18} color={Colors.primary} />
        <Text style={styles.reviewTitle}>
          {isEn ? 'Your Profile Summary' : 'Buod ng Iyong Profile'}
        </Text>
      </View>
      {rows.map((row, idx) => (
        <View
          key={row.label}
          style={[
            styles.reviewRow,
            idx < rows.length - 1 && styles.reviewRowBorder,
          ]}
        >
          <View style={styles.reviewLabelRow}>
            <Ionicons name={row.icon as any} size={16} color="#9CA3AF" />
            <Text style={styles.reviewLabel}>{row.label}</Text>
          </View>
          <Text style={styles.reviewValue} numberOfLines={2}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F5F7' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  backBtn: {
    minWidth: 70,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  dotsRow: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D1D5DB' },
  dotActive: { backgroundColor: Colors.primary, width: 22, borderRadius: 4 },

  scroll: {
    padding: Spacing.lg,
    paddingTop: 0,
    paddingBottom: 60,
    flexGrow: 1,
  },
  stepContent: { gap: Spacing.md },

  inputArea: { gap: Spacing.md, marginTop: Spacing.sm },

  inputCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 16,
    fontSize: FontSize.md,
    color: '#111827',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  inputFlex: { flex: 1 },

  dualRow: { flexDirection: 'row', gap: Spacing.sm },
  dualField: { flex: 1, gap: 6 },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: '#4B5563' },
  inputWithUnit: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  unitToggle: {
    flexDirection: 'row',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  unitOption: { paddingHorizontal: 12, paddingVertical: 14, backgroundColor: '#FFFFFF' },
  unitOptionActive: { backgroundColor: Colors.primary },
  unitText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: '#4B5563' },
  unitTextActive: { color: '#FFFFFF' },

  sectionSpacer: { height: Spacing.md },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionHint: {
    fontSize: FontSize.xs,
    color: '#6B7280',
    lineHeight: 18,
  },

  optionsStack: { gap: 12 },
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  optionCardActive: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF0EC',
  },
  optionCardText: {
    fontSize: FontSize.md,
    color: '#1F2937',
    fontWeight: FontWeight.medium,
  },
  optionCardTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },

  primaryBtn: {
    alignSelf: 'stretch',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    shadowColor: Colors.primary,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
    fontSize: FontSize.md,
    letterSpacing: 0.2,
  },

  langScreen: {
    flex: 1,
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  langMascotStage: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 140,
    marginBottom: Spacing.sm,
  },
  langMascot: {
    width: 120,
    height: 120,
  },
  langTitle: {
    fontSize: 22,
    fontWeight: FontWeight.bold,
    color: '#111827',
    marginBottom: Spacing.sm,
  },

  // ── Review Summary Card ──
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 2,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  reviewTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#111827',
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  reviewRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  reviewLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  reviewLabel: {
    fontSize: FontSize.sm,
    color: '#6B7280',
    fontWeight: FontWeight.medium,
  },
  reviewValue: {
    fontSize: FontSize.sm,
    color: '#111827',
    fontWeight: FontWeight.semibold,
    flex: 1.2,
    textAlign: 'right',
  },
});


