import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Alert,
  BackHandler,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StatusBar,
  Easing,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import CoachBubble from './CoachBubble';
import Confetti from './Confetti';
import AnimatedPressable from './AnimatedPressable';
import { useCoachHoo, CoachStepConfig } from '../hooks/useCoachHoo';
import SearchableSelectList from './SearchableSelectList';
import {
  getGoalLabel,
  getHealthConditionSafetyNotice,
  getAllergySafetyNotice,
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
  validateAge,
  validateHeight,
  validateWeight,
} from '../services/coachMessageService';
import {
  getHealthConditionGroups,
  getAllergenGroups,
  getMetaOptions,
  getActivityLabel,
} from '../constants/i18n';
import { Colors, FontSize, FontWeight, Spacing } from '../constants/theme';

const STEPS = [
  'language',
  'welcome',
  'age',
  'sex',
  'height_weight',
  'feedback',
  'goal',
  'activity',
  'health',
  'allergies',
  'finish',
] as const;

const STEP_COACH_CONFIG: Record<typeof STEPS[number], CoachStepConfig> = {
  language: {
    defaultMood: 'neutral',
    defaultPosition: 'topCenter',
    defaultAsset: 'idle',
    defaultIntensity: 'subtle',
  },
  welcome: {
    defaultMood: 'energetic',
    defaultPosition: 'topCenter',
    defaultAsset: 'flex',
    defaultIntensity: 'hero',
  },
  age: {
    defaultMood: 'curious',
    defaultPosition: 'topCenter',
    defaultAsset: 'idle',
    defaultIntensity: 'subtle',
  },
  sex: {
    defaultMood: 'neutral',
    defaultPosition: 'topCenter',
    defaultAsset: 'idle',
    defaultIntensity: 'subtle',
  },
  height_weight: {
    defaultMood: 'encouraging',
    defaultPosition: 'topCenter',
    defaultAsset: 'flex',
    defaultIntensity: 'medium',
  },
  feedback: {
    defaultMood: 'proud',
    defaultPosition: 'topCenter',
    defaultAsset: 'streak',
    defaultIntensity: 'medium',
  },
  goal: {
    defaultMood: 'motivated',
    defaultPosition: 'topCenter',
    defaultAsset: 'streak',
    defaultIntensity: 'medium',
  },
  activity: {
    defaultMood: 'energetic',
    defaultPosition: 'topCenter',
    defaultAsset: 'flex',
    defaultIntensity: 'medium',
  },
  health: {
    defaultMood: 'supportive',
    defaultPosition: 'topCenter',
    defaultAsset: 'phone',
    defaultIntensity: 'subtle',
  },
  allergies: {
    defaultMood: 'supportive',
    defaultPosition: 'topCenter',
    defaultAsset: 'phone',
    defaultIntensity: 'subtle',
  },
  finish: {
    defaultMood: 'proud',
    defaultPosition: 'topCenter',
    defaultAsset: 'streak',
    defaultIntensity: 'hero',
  },
};

export function parseHeightToCm(rawValue: string, unit: 'cm' | 'in'): number {
  if (!rawValue) return 0;
  const num = parseFloat(rawValue);
  if (isNaN(num) || num <= 0) return 0;
  if (unit === 'cm') return num;
  if (num < 10) {
    const feet = Math.floor(num);
    const fractional = Math.round((num - feet) * 100);
    const inches = fractional % 10 === 0 && fractional < 100 ? fractional / 10 : fractional;
    return Math.round((feet * 12 + inches) * 2.54);
  }
  return Math.round(num * 2.54);
}

export function parseWeightToKg(rawValue: string, unit: 'kg' | 'lbs'): number {
  if (!rawValue) return 0;
  const num = parseFloat(rawValue);
  if (isNaN(num) || num <= 0) return 0;
  if (unit === 'lbs') {
    return Math.round(num * 0.453592 * 10) / 10;
  }
  return num;
}

function getBmiCategory(bmi: number, lang: 'english' | 'filipino'): { label: string; color: string } {
  const isEn = lang === 'english';
  if (bmi < 18.5) {
    return { label: isEn ? 'Underweight' : 'Mababang timbang', color: '#3B82F6' };
  }
  if (bmi < 25.0) {
    return { label: isEn ? 'Normal weight' : 'Malusog na timbang', color: '#10B981' };
  }
  if (bmi < 30.0) {
    return { label: isEn ? 'Overweight' : 'Medyo mataas', color: '#F59E0B' };
  }
  return { label: isEn ? 'High / Obese' : 'Mataas na timbang', color: '#EF4444' };
}

interface FormData {
  name: string;
  age: string;
  sex: 'male' | 'female' | '';
  heightValue: string;
  weightValue: string;
  heightUnit: 'cm' | 'in';
  weightUnit: 'kg' | 'lbs';
  goal: string;
  activityLevel: number | '';
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
  activityLevel: '',
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
  const insets = useSafeAreaInsets();
  const modalTopInset = Platform.OS === 'android'
    ? Math.max(insets.top, StatusBar.currentHeight ?? 0, 28)
    : Math.max(insets.top, 16);
  const modalBottomInset = Math.max(insets.bottom, 20);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [healthModalOpen, setHealthModalOpen] = useState(false);
  const [allergiesModalOpen, setAllergiesModalOpen] = useState(false);

  // Smooth Form Transition values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Smooth Spring Progress Bar value
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Step 5 baseline calculation entrance
  const baselineAnim = useRef(new Animated.Value(1)).current;

  // Persistent Coach Hoo character state machine
  const coach = useCoachHoo(STEP_COACH_CONFIG.language);

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
          const restoredStep = parsed.step ?? 0;
          setStep(restoredStep);
          setForm({ ...emptyForm, ...parsed.form });
          const stepKey = STEPS[restoredStep];
          if (stepKey && STEP_COACH_CONFIG[stepKey]) {
            coach.trigger('screen-enter', STEP_COACH_CONFIG[stepKey]);
          }
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

  // Fluid, spring-assisted step navigation
  const goToStep = useCallback(
    (next: number) => {
      setValidationError(null);
      const isForward = next > step;
      const nextStepKey = STEPS[next];
      const nextConfig = STEP_COACH_CONFIG[nextStepKey] || STEP_COACH_CONFIG.welcome;
      coach.trigger('screen-enter', nextConfig);

      // Phase 1: Fluid exit of the question card
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 120,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: isForward ? -20 : 20,
          duration: 120,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.98,
          duration: 120,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setStep(next);
        saveProgress(next, form);
        slideAnim.setValue(isForward ? 20 : -20);
        scaleAnim.setValue(0.98);

        // Phase 2: Fluid entrance of the new question card
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      });
    },
    [form, saveProgress, step, coach, fadeAnim, slideAnim, scaleAnim],
  );

  const validateCurrent = (): boolean => {
    const s = STEPS[step];
    if (s === 'welcome' && !form.name.trim()) {
      setValidationError(t('validation.name'));
      coach.trigger('validation-error');
      return false;
    }
    if (s === 'age') {
      const age = parseInt(form.age, 10);
      if (!form.age || !validateAge(age)) {
        setValidationError(t('validation.age'));
        coach.trigger('validation-error');
        return false;
      }
    }
    if (s === 'sex' && !form.sex) {
      setValidationError(t('validation.required') || 'Please select an option');
      coach.trigger('validation-error');
      return false;
    }
    if (s === 'height_weight') {
      const parsedCm = parseHeightToCm(form.heightValue, form.heightUnit);
      const parsedKg = parseWeightToKg(form.weightValue, form.weightUnit);
      if (!form.heightValue || !validateHeight(parsedCm)) {
        setValidationError(t('validation.height'));
        coach.trigger('validation-error');
        return false;
      }
      if (!form.weightValue || !validateWeight(parsedKg)) {
        setValidationError(t('validation.weight'));
        coach.trigger('validation-error');
        return false;
      }
    }
    setValidationError(null);
    return true;
  };

  const handleNext = () => {
    if (!validateCurrent()) return;
    goToStep(step + 1);
  };

  const finishOnboarding = async () => {
    setSaving(true);
    coach.trigger('celebrate');
    setShowConfetti(false);
    setTimeout(() => setShowConfetti(true), 50);

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }

    const age = parseInt(form.age, 10) || 25;
    const heightCm = parseHeightToCm(form.heightValue, form.heightUnit);
    const weightKg = parseWeightToKg(form.weightValue, form.weightUnit);

    const hasHealth = form.healthAnswer === 'yes' && form.healthConditions.length > 0;
    const healthConditions = hasHealth
      ? form.healthConditions.filter((k) => k !== 'none' && k !== 'prefer_not_say')
      : undefined;

    const hasAllergies = form.allergiesAnswer === 'yes' && form.allergies.length > 0;
    const allergyItems = hasAllergies
      ? form.allergies.filter((k) => k !== 'none' && k !== 'prefer_not_say')
      : undefined;

    try {
      await completeOnboarding({
        full_name: form.name.trim(),
        age,
        sex: form.sex || undefined,
        height_cm: heightCm > 0 ? heightCm : undefined,
        weight_kg: weightKg > 0 ? weightKg : undefined,
        goal: form.goal === 'build_habits' ? 'maintain' : (form.goal as any) || 'maintain',
        activity_level: (form.activityLevel as any) || 2,
        health_condition: healthConditions ? healthConditions.join(',') : healthConditions,
        health_condition_custom: hasHealth && form.healthConditionOther ? form.healthConditionOther : undefined,
        allergies: allergyItems,
        allergy_other: hasAllergies && form.allergyOther ? form.allergyOther : undefined,
        intolerances: form.intolerances || undefined,
      });

      await AsyncStorage.removeItem(ONBOARDING_PROGRESS_KEY);
    } catch (e) {
      console.warn('Failed to complete onboarding:', e);
    }

    setTimeout(() => {
      router.replace('/(tabs)');
    }, 1600);
  };

  const currentStep = STEPS[step];

  // Celebratory confetti shower upon arriving at the final finish step
  useEffect(() => {
    if (currentStep === 'finish') {
      setShowConfetti(true);
      coach.trigger('celebrate');
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } else {
      setShowConfetti(false);
    }
  }, [currentStep, coach]);

  useEffect(() => {
    const onBack = () => {
      if (step <= 0) return false;
      if (currentStep === 'language') return false;
      goToStep(step - 1);
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [step, currentStep, goToStep]);

  // ─── Real-Time Baseline Calculations ────────────────────────────────────────
  const heightCm = parseHeightToCm(form.heightValue, form.heightUnit);
  const weightKg = parseWeightToKg(form.weightValue, form.weightUnit);
  const ageNum = parseInt(form.age, 10) || 25;

  const calculatedBmi =
    heightCm > 50 && weightKg > 10
      ? weightKg / (heightCm / 100) ** 2
      : 22.0;
  const bmiNumber = Math.min(60, Math.max(10, Math.round(calculatedBmi * 10) / 10));
  const bmiCategory = getBmiCategory(bmiNumber, lang);

  // Mifflin-St Jeor Formula BMR
  const bmrNumber =
    form.sex === 'female'
      ? Math.round(10 * weightKg + 6.25 * heightCm - 5 * ageNum - 161)
      : Math.round(10 * weightKg + 6.25 * heightCm - 5 * ageNum + 5);

  // Smart BMI Recommendation for Goal
  const suggestedGoal: 'lose' | 'maintain' | 'gain' =
    bmiNumber < 18.5 ? 'gain' : bmiNumber >= 25.0 ? 'lose' : 'maintain';

  const goalKeys = ['lose', 'maintain', 'gain', 'build_habits'] as const;

  // Step 5 reveal animation
  useEffect(() => {
    if (currentStep === 'feedback') {
      baselineAnim.setValue(0.9);
      Animated.spring(baselineAnim, {
        toValue: 1,
        damping: 15,
        stiffness: 140,
        useNativeDriver: true,
      }).start();
    }
  }, [currentStep, baselineAnim]);

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

  // Smooth animated progress bar fill
  useEffect(() => {
    if (currentStep === 'language') {
      progressAnim.setValue(0);
    } else {
      const target = Math.max(0, Math.min(1, (dotIndex + 1) / visibleSteps.length));
      Animated.spring(progressAnim, {
        toValue: target,
        damping: 20,
        stiffness: 150,
        mass: 0.8,
        useNativeDriver: false,
      }).start();
    }
  }, [dotIndex, visibleSteps.length, currentStep, progressAnim]);

  // Derived step title and subtitle for anchored CoachBubble
  const stepMeta = useMemo(() => {
    switch (currentStep) {
      case 'language':
        return {
          title: lang === 'filipino' ? 'Piliin ang iyong wika' : 'Select your language',
          subtitle: lang === 'filipino' ? 'Maligayang pagdating sa Nokma!' : 'Welcome to Nokma nutrition!',
        };
      case 'welcome':
        return {
          title: lang === 'filipino' ? 'Ano ang iyong pangalan?' : "What's your name?",
          subtitle: lang === 'filipino' ? 'I-personalize natin ang iyong plano' : "Let's personalize your coaching",
        };
      case 'age':
        return {
          title: lang === 'filipino' ? 'Ilang taon ka na?' : 'How old are you?',
          subtitle: lang === 'filipino' ? 'Para sa tamang kalkulasyon ng calories' : 'Used to calculate your daily metabolism',
        };
      case 'sex':
        return {
          title: lang === 'filipino' ? 'Ano ang iyong kasarian?' : "What's your biological sex?",
          subtitle: lang === 'filipino' ? 'Para sa tamang target ng nutrisyon' : 'Helps tailor calorie and macro targets',
        };
      case 'height_weight':
        return {
          title: lang === 'filipino' ? 'Iyong taas at timbang' : 'Height and weight',
          subtitle: lang === 'filipino' ? 'Panimulang sukat ng iyong katawan' : "Let's establish your baseline metrics",
        };
      case 'feedback':
        return {
          title: lang === 'filipino' ? 'Handa na ang iyong baseline!' : 'Your baseline is ready!',
          subtitle:
            lang === 'filipino'
              ? 'Kinalkula mula sa iyong sukat, edad, at kasarian'
              : 'Calculated from your body metrics & metabolism',
        };
      case 'goal':
        return {
          title: lang === 'filipino' ? 'Ano ang iyong layunin?' : 'What is your main goal?',
          subtitle:
            lang === 'filipino'
              ? `Iminumungkahi namin ang ${getGoalLabel(lang, suggestedGoal)} batay sa iyong BMI`
              : `We recommend ${getGoalLabel(lang, suggestedGoal)} based on your BMI`,
        };
      case 'activity':
        return {
          title: lang === 'filipino' ? 'Gaano ka ka-aktibo?' : 'How active are you?',
          subtitle: lang === 'filipino' ? 'Araw-araw na galaw at ehersisyo' : 'Include work and daily movement',
        };
      case 'health':
        return {
          title: lang === 'filipino' ? 'May kondisyon sa kalusugan?' : 'Any health conditions?',
          subtitle: lang === 'filipino' ? 'Aayusin namin ang mga payo nang ligtas' : "We'll tailor nutrition advice safely",
        };
      case 'allergies':
        return {
          title: lang === 'filipino' ? 'May mga allergy sa pagkain?' : 'Any food allergies?',
          subtitle: lang === 'filipino' ? 'Ihihiwalay namin ito sa iyong pagkain' : "We'll filter these out of your meals",
        };
      case 'finish':
        return {
          title: lang === 'filipino' ? 'Handa ka na!' : "You're all set!",
          subtitle: lang === 'filipino' ? 'Suriin ang iyong profile sa ibaba' : 'Review your customized profile below',
        };
      default:
        return { title: '', subtitle: '' };
    }
  }, [currentStep, lang, suggestedGoal]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Top Header Bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}>
        {isFirstStep ? (
          <AnimatedPressable
            onPress={handleExitSetup}
            style={styles.backBtn}
            accessibilityLabel={t('onboarding.exitSetup')}
            scaleTo={0.94}
            hapticStyle="Light"
          >
            <Text style={styles.backText}>{t('common.exit')}</Text>
          </AnimatedPressable>
        ) : showBack ? (
          <AnimatedPressable
            onPress={() => goToStep(step - 1)}
            style={styles.backBtn}
            accessibilityLabel={t('common.back')}
            scaleTo={0.94}
            hapticStyle="Light"
          >
            <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
            <Text style={styles.backText}>{t('common.back')}</Text>
          </AnimatedPressable>
        ) : (
          <View style={styles.backBtn} />
        )}

        {currentStep !== 'language' && currentStep !== 'feedback' ? (
          <View style={styles.progressRow}>
            <View style={styles.progressBarContainer}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
            <Text style={styles.stepIndicatorText}>
              {dotIndex + 1}/{visibleSteps.length}
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        <View style={styles.backBtnPlaceholder} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Anchored Mascot Companion Header */}
        <CoachBubble
          title={validationError || stepMeta.title}
          subtitle={validationError ? undefined : stepMeta.subtitle}
          assetKey={coach.assetKey}
          mood={coach.mood}
          behavior={coach.behavior}
          position="topCenter"
          intensity={coach.intensity}
          isKeyboardVisible={coach.isKeyboardVisible}
          isReducedMotion={coach.isReducedMotion}
          canTap={coach.canTap}
          onMascotTap={() => coach.trigger('tap-mascot')}
        />

        {/* Fluid Animated Form Area */}
        <Animated.View
          style={[
            styles.stepAnimatedWrap,
            {
              opacity: fadeAnim,
              transform: [
                { translateX: slideAnim },
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          {/* ── Step 0: Language selection ── */}
          {currentStep === 'language' && (
            <View style={styles.langScreen}>
              <View style={styles.optionsStack}>
                <AnimatedPressable
                  style={[styles.optionCard, lang === 'english' && styles.optionCardActive]}
                  onPress={async () => {
                    await setLang('english');
                    coach.trigger('answer-success', { mood: 'happy', asset: 'streak' });
                    setTimeout(() => {
                      goToStep(step + 1);
                    }, 220);
                  }}
                  scaleTo={0.97}
                  hapticStyle="selection"
                >
                  <Text style={[styles.optionCardText, lang === 'english' && styles.optionCardTextActive]}>
                    English
                  </Text>
                  {lang === 'english' && (
                    <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                  )}
                </AnimatedPressable>

                <AnimatedPressable
                  style={[styles.optionCard, lang === 'filipino' && styles.optionCardActive]}
                  onPress={async () => {
                    await setLang('filipino');
                    coach.trigger('answer-success', { mood: 'happy', asset: 'streak' });
                    setTimeout(() => {
                      goToStep(step + 1);
                    }, 220);
                  }}
                  scaleTo={0.97}
                  hapticStyle="selection"
                >
                  <Text style={[styles.optionCardText, lang === 'filipino' && styles.optionCardTextActive]}>
                    Filipino
                  </Text>
                  {lang === 'filipino' && (
                    <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                  )}
                </AnimatedPressable>
              </View>
            </View>
          )}

          {/* ── Step 1: Welcome (Name) ── */}
          {currentStep === 'welcome' && (
            <StepContent>
              <View style={styles.inputAreaCentered}>
                <TextInput
                  style={styles.inputCard}
                  placeholder={getNamePlaceholder(lang)}
                  placeholderTextColor="#9CA3AF"
                  value={form.name}
                  onChangeText={(v) => updateForm({ name: v })}
                  autoFocus
                />
              </View>
              <PrimaryBtn label={getConfirmLabel(lang)} onPress={handleNext} />
            </StepContent>
          )}

          {/* ── Step 2: Age ── */}
          {currentStep === 'age' && (
            <StepContent>
              <View style={styles.inputAreaCentered}>
                <TextInput
                  style={styles.inputCardCentered}
                  placeholder={getAgePlaceholder(lang)}
                  placeholderTextColor="#9CA3AF"
                  value={form.age}
                  onChangeText={(v) => updateForm({ age: v.replace(/[^0-9]/g, '') })}
                  keyboardType="number-pad"
                  autoFocus
                  maxLength={3}
                />
              </View>
              <PrimaryBtn label={getConfirmLabel(lang)} onPress={handleNext} />
            </StepContent>
          )}

          {/* ── Step 3: Sex ── */}
          {currentStep === 'sex' && (
            <StepContent>
              <View style={styles.optionsRow}>
                {['male', 'female'].map((s) => (
                  <AnimatedPressable
                    key={s}
                    style={[styles.sexCard, form.sex === s && styles.optionCardActive]}
                    onPress={() => {
                      updateForm({ sex: s as any });
                      coach.trigger('answer-success', { mood: 'happy', asset: 'idle' });
                    }}
                    scaleTo={0.96}
                    hapticStyle="selection"
                  >
                    <Ionicons
                      name={s === 'male' ? 'man-outline' : 'woman-outline'}
                      size={22}
                      color={form.sex === s ? Colors.primary : '#6B7280'}
                    />
                    <Text style={[styles.sexCardText, form.sex === s && styles.optionCardTextActive]}>
                      {s === 'male' ? (t('onboarding.male') || 'Male') : (t('onboarding.female') || 'Female')}
                    </Text>
                    {form.sex === s && (
                      <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                    )}
                  </AnimatedPressable>
                ))}
              </View>
              {form.sex ? (
                <PrimaryBtn label={getConfirmLabel(lang)} onPress={() => goToStep(step + 1)} />
              ) : null}
            </StepContent>
          )}

          {/* ── Step 4: Height & Weight ── */}
          {currentStep === 'height_weight' && (
            <StepContent>
              <View style={styles.dualRow}>
                <View style={styles.dualField}>
                  <Text style={styles.fieldLabel}>{t('onboarding.height')}</Text>
                  <View style={styles.inputWithUnit}>
                    <TextInput
                      style={[styles.inputCardCentered, styles.inputFlex]}
                      placeholder={`e.g. ${form.heightUnit === 'cm' ? '175' : '5.9'}`}
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
                      style={[styles.inputCardCentered, styles.inputFlex]}
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

          {/* ── Step 5: Feedback / Baseline ── */}
          {currentStep === 'feedback' && (
            <StepContent>
              <Animated.View style={[styles.baselineCard, { transform: [{ scale: baselineAnim }] }]}>
                <View style={styles.baselineMetricRow}>
                  {/* BMI Metric Block */}
                  <View style={styles.metricBlock}>
                    <Text style={styles.metricLabel}>BMI</Text>
                    <Text style={styles.metricValue}>{bmiNumber.toFixed(1)}</Text>
                    <View style={[styles.categoryBadge, { backgroundColor: `${bmiCategory.color}18` }]}>
                      <Text style={[styles.categoryBadgeText, { color: bmiCategory.color }]}>
                        {bmiCategory.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metricDivider} />

                  {/* BMR Base Metabolism Block */}
                  <View style={styles.metricBlock}>
                    <Text style={styles.metricLabel}>
                      {lang === 'filipino' ? 'PANGUNAHING BMR' : 'BASE METABOLISM'}
                    </Text>
                    <Text style={styles.metricValue}>
                      {bmrNumber.toLocaleString()} <Text style={styles.metricUnit}>kcal</Text>
                    </Text>
                    <Text style={styles.metricHint}>
                      {lang === 'filipino' ? 'Nasusunog habang nagpapahinga' : 'Daily burn at rest'}
                    </Text>
                  </View>
                </View>

                {/* Smart Goal Callout Preview */}
                <View style={styles.baselineCallout}>
                  <Ionicons name="sparkles" size={16} color={Colors.primary} />
                  <Text style={styles.baselineCalloutText}>
                    {lang === 'filipino'
                      ? `Batay sa iyong baseline, ang angkop na layunin ay ${getGoalLabel(lang, suggestedGoal)}.`
                      : `Based on your baseline, your suggested focus is ${getGoalLabel(lang, suggestedGoal)}.`}
                  </Text>
                </View>
              </Animated.View>

              <PrimaryBtn label={getContinueLabel(lang)} onPress={() => goToStep(step + 1)} />
            </StepContent>
          )}

          {/* ── Step 6: Goal ── */}
          {currentStep === 'goal' && (
            <StepContent>
              <View style={styles.goalGrid}>
                {goalKeys.map((g) => {
                  const iconName =
                    g === 'lose'
                      ? 'flame-outline'
                      : g === 'gain'
                      ? 'barbell-outline'
                      : g === 'maintain'
                      ? 'scale-outline'
                      : 'leaf-outline';
                  const isSuggested = g === suggestedGoal;

                  return (
                    <AnimatedPressable
                      key={g}
                      style={[
                        styles.goalCard,
                        form.goal === g && styles.goalCardActive,
                        isSuggested && !form.goal && styles.goalCardSuggested,
                      ]}
                      onPress={() => {
                        updateForm({ goal: g });
                        if (g === 'lose') {
                          coach.trigger('answer-success', { mood: 'motivated', asset: 'streak' });
                        } else if (g === 'gain') {
                          coach.trigger('answer-success', { mood: 'energetic', asset: 'flex' });
                        } else if (g === 'maintain') {
                          coach.trigger('answer-success', { mood: 'neutral', asset: 'idle' });
                        } else {
                          coach.trigger('answer-success', { mood: 'happy', asset: 'streak' });
                        }
                      }}
                      scaleTo={0.96}
                      hapticStyle="selection"
                    >
                      {isSuggested && (
                        <View style={styles.recommendedBadge}>
                          <Text style={styles.recommendedBadgeText}>
                            {lang === 'filipino' ? 'Mungkahi' : 'Suggested'}
                          </Text>
                        </View>
                      )}

                      <View style={[styles.goalIconBox, form.goal === g && styles.goalIconBoxActive]}>
                        <Ionicons name={iconName} size={20} color={form.goal === g ? Colors.primary : '#6B7280'} />
                      </View>
                      <Text style={[styles.goalCardText, form.goal === g && styles.goalCardTextActive]} numberOfLines={1}>
                        {getGoalLabel(lang, g)}
                      </Text>
                      {form.goal === g && (
                        <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
                      )}
                    </AnimatedPressable>
                  );
                })}
              </View>
              {form.goal ? (
                <PrimaryBtn label={getConfirmLabel(lang)} onPress={() => goToStep(step + 1)} />
              ) : null}
            </StepContent>
          )}

          {/* ── Step 7: Activity ── */}
          {currentStep === 'activity' && (
            <StepContent>
              <View style={styles.activityWrap}>
                <View style={styles.stepperRow}>
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <AnimatedPressable
                      key={lvl}
                      style={[styles.stepperPill, form.activityLevel === lvl && styles.stepperPillActive]}
                      onPress={() => {
                        updateForm({ activityLevel: lvl });
                        coach.trigger('answer-success', { mood: 'energetic', asset: 'flex' });
                      }}
                      scaleTo={0.92}
                      hapticStyle="selection"
                    >
                      <Text style={[styles.stepperPillNum, form.activityLevel === lvl && styles.stepperPillNumActive]}>
                        {lvl}
                      </Text>
                      <Text style={[styles.stepperPillSub, form.activityLevel === lvl && styles.stepperPillSubActive]}>
                        {lvl === 1 ? 'None' : lvl === 2 ? 'Light' : lvl === 3 ? 'Mod' : lvl === 4 ? 'Active' : 'Extra'}
                      </Text>
                    </AnimatedPressable>
                  ))}
                </View>
                <View style={styles.activityInfoCard}>
                  <View style={styles.activityInfoHeader}>
                    <Ionicons name="walk" size={18} color={Colors.primary} />
                    <Text style={styles.activityInfoTitle}>
                      {t(`activity.${form.activityLevel || 2}` as any)}
                    </Text>
                  </View>
                  <Text style={styles.activityInfoDesc} numberOfLines={2}>
                    {t(`onboarding.activity.${form.activityLevel || 2}.desc` as any)}
                  </Text>
                </View>
              </View>
              {form.activityLevel ? (
                <PrimaryBtn label={getConfirmLabel(lang)} onPress={() => goToStep(step + 1)} />
              ) : null}
            </StepContent>
          )}

          {/* ── Step 8: Health conditions ── */}
          {currentStep === 'health' && (
            <StepContent>
              <View style={styles.choiceChipsRow}>
                {(['no', 'yes', 'skip'] as const).map((a) => (
                  <AnimatedPressable
                    key={a}
                    style={[styles.choiceChip, form.healthAnswer === a && styles.choiceChipActive]}
                    onPress={() => {
                      const isYes = a === 'yes';
                      const patch: Partial<FormData> = { healthAnswer: a };
                      if (!isYes) {
                        patch.healthConditions = [];
                        patch.healthConditionOther = '';
                      }
                      updateForm(patch);
                      coach.trigger('answer-success', {
                        mood: isYes ? 'supportive' : 'happy',
                        asset: isYes ? 'phone' : 'idle',
                      });
                      if (isYes) {
                        setHealthModalOpen(true);
                      }
                    }}
                    scaleTo={0.96}
                    hapticStyle="selection"
                  >
                    <Text style={[styles.choiceChipText, form.healthAnswer === a && styles.choiceChipTextActive]}>
                      {a === 'no' ? getNoLabel(lang) : a === 'yes' ? getYesLabel(lang) : getSkipLabel(lang)}
                    </Text>
                    {form.healthAnswer === a && (
                      <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
                    )}
                  </AnimatedPressable>
                ))}
              </View>

              {form.healthAnswer === 'yes' && (
                <View style={styles.conditionSummaryCard}>
                  <View style={styles.conditionSummaryHeader}>
                    <Text style={styles.conditionSummaryCount}>
                      {form.healthConditions.length > 0
                        ? `${form.healthConditions.length} ${t('common.selected') || 'selected'}`
                        : t('onboarding.searchConditions')}
                    </Text>
                    <AnimatedPressable
                      style={styles.openSheetBtn}
                      onPress={() => setHealthModalOpen(true)}
                      scaleTo={0.94}
                      hapticStyle="Light"
                    >
                      <Ionicons name="create-outline" size={16} color={Colors.primary} />
                      <Text style={styles.openSheetBtnText}>
                        {form.healthConditions.length > 0 ? (t('common.edit') || 'Edit') : (t('common.select') || 'Select')}
                      </Text>
                    </AnimatedPressable>
                  </View>
                  {form.healthConditions.length > 0 && (
                    <View style={styles.tagChipsWrap}>
                      {form.healthConditions.slice(0, 4).map((k) => (
                        <View key={k} style={styles.tagChip}>
                          <Text style={styles.tagChipText} numberOfLines={1}>
                            {k.replace(/_/g, ' ')}
                          </Text>
                        </View>
                      ))}
                      {form.healthConditions.length > 4 && (
                        <View style={styles.tagChipMore}>
                          <Text style={styles.tagChipMoreText}>+{form.healthConditions.length - 4} more</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}

              {form.healthAnswer ? (
                <PrimaryBtn
                  label={form.healthAnswer === 'yes' ? getConfirmLabel(lang) : getContinueLabel(lang)}
                  onPress={() => goToStep(step + 1)}
                />
              ) : null}
            </StepContent>
          )}

          {/* ── Step 9: Allergies ── */}
          {currentStep === 'allergies' && (
            <StepContent>
              <View style={styles.choiceChipsRow}>
                {(['no', 'yes', 'skip'] as const).map((a) => (
                  <AnimatedPressable
                    key={a}
                    style={[styles.choiceChip, form.allergiesAnswer === a && styles.choiceChipActive]}
                    onPress={() => {
                      const isYes = a === 'yes';
                      const patch: Partial<FormData> = { allergiesAnswer: a };
                      if (!isYes) {
                        patch.allergies = [];
                        patch.allergyOther = '';
                      }
                      updateForm(patch);
                      coach.trigger('answer-success', {
                        mood: isYes ? 'supportive' : 'happy',
                        asset: isYes ? 'phone' : 'idle',
                      });
                      if (isYes) {
                        setAllergiesModalOpen(true);
                      }
                    }}
                    scaleTo={0.96}
                    hapticStyle="selection"
                  >
                    <Text style={[styles.choiceChipText, form.allergiesAnswer === a && styles.choiceChipTextActive]}>
                      {a === 'no' ? getNoLabel(lang) : a === 'yes' ? getYesLabel(lang) : getSkipLabel(lang)}
                    </Text>
                    {form.allergiesAnswer === a && (
                      <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
                    )}
                  </AnimatedPressable>
                ))}
              </View>

              {form.allergiesAnswer === 'yes' && (
                <View style={styles.conditionSummaryCard}>
                  <View style={styles.conditionSummaryHeader}>
                    <Text style={styles.conditionSummaryCount}>
                      {form.allergies.length > 0
                        ? `${form.allergies.length} ${t('common.selected') || 'selected'}`
                        : t('onboarding.searchAllergens')}
                    </Text>
                    <AnimatedPressable
                      style={styles.openSheetBtn}
                      onPress={() => setAllergiesModalOpen(true)}
                      scaleTo={0.94}
                      hapticStyle="Light"
                    >
                      <Ionicons name="create-outline" size={16} color={Colors.primary} />
                      <Text style={styles.openSheetBtnText}>
                        {form.allergies.length > 0 ? (t('common.edit') || 'Edit') : (t('common.select') || 'Select')}
                      </Text>
                    </AnimatedPressable>
                  </View>
                  {form.allergies.length > 0 && (
                    <View style={styles.tagChipsWrap}>
                      {form.allergies.slice(0, 4).map((k) => (
                        <View key={k} style={styles.tagChip}>
                          <Text style={styles.tagChipText} numberOfLines={1}>
                            {k.replace(/_/g, ' ')}
                          </Text>
                        </View>
                      ))}
                      {form.allergies.length > 4 && (
                        <View style={styles.tagChipMore}>
                          <Text style={styles.tagChipMoreText}>+{form.allergies.length - 4} more</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}

              {form.allergiesAnswer ? (
                <PrimaryBtn
                  label={form.allergiesAnswer === 'yes' ? getConfirmLabel(lang) : getContinueLabel(lang)}
                  onPress={() => goToStep(step + 1)}
                />
              ) : null}
            </StepContent>
          )}

          {/* ── Step 10: Finish ── */}
          {currentStep === 'finish' && (
            <StepContent>
              <ReviewSummary form={form} lang={lang} />
              <PrimaryBtn label={getGoToDashboardLabel(lang)} onPress={finishOnboarding} isLoading={saving} />
            </StepContent>
          )}
        </Animated.View>
      </ScrollView>

      {/* Health Conditions Modal */}
      <Modal
        visible={healthModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setHealthModalOpen(false)}
      >
        <View style={styles.modalRoot}>
          {/* Safe Top Header */}
          <View style={[styles.modalTopBar, { paddingTop: modalTopInset }]}>
            <View style={styles.modalHandleWrap}>
              <View style={styles.modalHandle} />
            </View>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <Text style={styles.modalTitle}>{t('onboarding.healthModalTitle') || 'Health Conditions'}</Text>
                <Text style={styles.modalSubtitle}>
                  {form.healthConditions.length > 0
                    ? `${form.healthConditions.length} ${t('common.selected') || 'selected'}`
                    : (t('onboarding.selectApplicable') || 'Select all that apply')}
                </Text>
              </View>
              <AnimatedPressable
                onPress={() => setHealthModalOpen(false)}
                style={styles.modalDoneBtn}
                scaleTo={0.94}
                hapticStyle="Light"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="checkmark" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.modalDoneText}>{t('common.done') || 'Done'}</Text>
              </AnimatedPressable>
            </View>
          </View>

          {/* Scrollable Content */}
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={[styles.modalScrollContent, { paddingBottom: modalBottomInset + 80 }]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={true}
            >
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
            </ScrollView>

            {/* Sticky Bottom Confirmation Footer */}
            <View style={[styles.modalFooter, { paddingBottom: modalBottomInset }]}>
              <AnimatedPressable
                onPress={() => setHealthModalOpen(false)}
                style={styles.modalSaveBtn}
                scaleTo={0.96}
                hapticStyle="Medium"
              >
                <Text style={styles.modalSaveBtnText}>
                  {form.healthConditions.length > 0
                    ? `${t('onboarding.saveSelection') || 'Save Selection'} (${form.healthConditions.length})`
                    : (t('common.done') || 'Done')}
                </Text>
              </AnimatedPressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Allergies & Intolerances Modal */}
      <Modal
        visible={allergiesModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAllergiesModalOpen(false)}
      >
        <View style={styles.modalRoot}>
          {/* Safe Top Header */}
          <View style={[styles.modalTopBar, { paddingTop: modalTopInset }]}>
            <View style={styles.modalHandleWrap}>
              <View style={styles.modalHandle} />
            </View>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <Text style={styles.modalTitle}>{t('onboarding.allergiesModalTitle') || 'Allergies & Intolerances'}</Text>
                <Text style={styles.modalSubtitle}>
                  {form.allergies.length > 0
                    ? `${form.allergies.length} ${t('common.selected') || 'selected'}`
                    : (t('onboarding.selectApplicable') || 'Select all that apply')}
                </Text>
              </View>
              <AnimatedPressable
                onPress={() => setAllergiesModalOpen(false)}
                style={styles.modalDoneBtn}
                scaleTo={0.94}
                hapticStyle="Light"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="checkmark" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.modalDoneText}>{t('common.done') || 'Done'}</Text>
              </AnimatedPressable>
            </View>
          </View>

          {/* Scrollable Content */}
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={[styles.modalScrollContent, { paddingBottom: modalBottomInset + 80 }]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={true}
            >
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
                style={[styles.inputCard, { marginTop: 6 }]}
                placeholder={t('onboarding.intolerancesPlaceholder')}
                placeholderTextColor="#9CA3AF"
                value={form.intolerances}
                onChangeText={(v) => updateForm({ intolerances: v })}
                multiline
                numberOfLines={2}
              />
            </ScrollView>

            {/* Sticky Bottom Confirmation Footer */}
            <View style={[styles.modalFooter, { paddingBottom: modalBottomInset }]}>
              <AnimatedPressable
                onPress={() => setAllergiesModalOpen(false)}
                style={styles.modalSaveBtn}
                scaleTo={0.96}
                hapticStyle="Medium"
              >
                <Text style={styles.modalSaveBtnText}>
                  {form.allergies.length > 0
                    ? `${t('onboarding.saveSelection') || 'Save Selection'} (${form.allergies.length})`
                    : (t('common.done') || 'Done')}
                </Text>
              </AnimatedPressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Celebratory confetti burst */}
      <Confetti active={showConfetti} />
    </KeyboardAvoidingView>
  );
}

function PrimaryBtn({ label, onPress, isLoading }: { label: string; onPress: () => void; isLoading?: boolean }) {
  return (
    <AnimatedPressable
      style={styles.primaryBtn}
      onPress={() => {
        if (!isLoading) onPress();
      }}
      scaleTo={0.97}
      hapticStyle="Light"
      disabled={isLoading}
    >
      {isLoading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <>
          <Text style={styles.primaryBtnText}>{label}</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
        </>
      )}
    </AnimatedPressable>
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
        <AnimatedPressable
          key={opt}
          style={[styles.unitOption, selected === opt && styles.unitOptionActive]}
          onPress={() => onSelect(opt)}
          scaleTo={0.94}
          hapticStyle="Light"
        >
          <Text style={[styles.unitText, selected === opt && styles.unitTextActive]}>{opt}</Text>
        </AnimatedPressable>
      ))}
    </View>
  );
}

function StepContent({ children }: { children: React.ReactNode }) {
  return <View style={styles.inputArea}>{children}</View>;
}

function ReviewSummary({ form, lang }: { form: FormData; lang: 'english' | 'filipino' }) {
  const isEn = lang === 'english';

  const heightDisplay = form.heightValue
    ? `${form.heightValue} ${form.heightUnit}`
    : isEn ? 'Not set' : 'Hindi itinakda';

  const weightDisplay = form.weightValue
    ? `${form.weightValue} ${form.weightUnit}`
    : isEn ? 'Not set' : 'Hindi itinakda';

  const goalDisplay = form.goal
    ? getGoalLabel(lang, form.goal)
    : isEn ? 'Not set' : 'Hindi itinakda';

  const activityDisplay = form.activityLevel
    ? getActivityLabel(lang, form.activityLevel)
    : isEn ? 'Not set' : 'Hindi itinakda';

  let healthDisplay: string;
  if (form.healthAnswer === 'skip') {
    healthDisplay = isEn ? 'Skipped' : 'Nilaktawan';
  } else if (form.healthAnswer === 'no' || !form.healthConditions.length) {
    healthDisplay = isEn ? 'None' : 'Wala';
  } else {
    healthDisplay = `${form.healthConditions.length} ${isEn ? 'reported' : 'naitala'}`;
  }

  let allergiesDisplay: string;
  if (form.allergiesAnswer === 'skip') {
    allergiesDisplay = isEn ? 'Skipped' : 'Nilaktawan';
  } else if (form.allergiesAnswer === 'no' || !form.allergies.length) {
    allergiesDisplay = isEn ? 'None' : 'Wala';
  } else {
    allergiesDisplay = `${form.allergies.length} ${isEn ? 'reported' : 'naitala'}`;
  }

  const items: { icon: string; label: string; value: string }[] = [
    { icon: 'person-outline', label: isEn ? 'Name' : 'Pangalan', value: form.name || '—' },
    { icon: 'calendar-outline', label: isEn ? 'Age' : 'Edad', value: form.age ? `${form.age} yrs` : '—' },
    { icon: 'resize-outline', label: isEn ? 'Height' : 'Taas', value: heightDisplay },
    { icon: 'barbell-outline', label: isEn ? 'Weight' : 'Bigat', value: weightDisplay },
    { icon: 'flag-outline', label: isEn ? 'Goal' : 'Layunin', value: goalDisplay },
    { icon: 'walk-outline', label: isEn ? 'Activity' : 'Aktibidad', value: activityDisplay },
    { icon: 'heart-outline', label: isEn ? 'Health' : 'Kalusugan', value: healthDisplay },
    { icon: 'warning-outline', label: isEn ? 'Allergies' : 'Alerhiya', value: allergiesDisplay },
  ];

  return (
    <View style={styles.bentoSummaryCard}>
      <View style={styles.bentoSummaryHeader}>
        <ExpoImage
          source={require('../assets/mascot/nokma_logo_badge.png')}
          style={styles.summaryBadgeLogo}
          contentFit="contain"
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.bentoSummaryTitle}>
            {isEn ? 'NOKMA PROFILE SUMMARY' : 'BUOD NG PROFILE'}
          </Text>
          <Text style={styles.bentoSummarySubtitle}>
            {isEn ? 'Your personalized coaching is ready' : 'Handa na ang iyong personalized coaching'}
          </Text>
        </View>
      </View>
      <View style={styles.bentoGrid}>
        {items.map((item) => (
          <View key={item.label} style={styles.bentoCell}>
            <View style={styles.bentoCellHeader}>
              <Ionicons name={item.icon as any} size={13} color={Colors.primary} />
              <Text style={styles.bentoCellLabel}>{item.label}</Text>
            </View>
            <Text style={styles.bentoCellValue} numberOfLines={1}>{item.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  backBtn: {
    minWidth: 64,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backBtnPlaceholder: {
    minWidth: 64,
    minHeight: 40,
  },
  backText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },

  progressRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Spacing.xs,
  },
  progressBarContainer: {
    flex: 1,
    height: 7,
    backgroundColor: '#EEDECB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  stepIndicatorText: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
    minWidth: 32,
    textAlign: 'right',
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    flexGrow: 1,
  },

  stepAnimatedWrap: {
    flex: 1,
  },

  inputArea: {
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  inputAreaCentered: {
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },

  inputCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#EEDECB',
    borderRadius: 18,
    padding: 16,
    fontSize: FontSize.md,
    color: '#1F2937',
    shadowColor: '#3A2010',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  inputCardCentered: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#EEDECB',
    borderRadius: 18,
    padding: 16,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1F2937',
    shadowColor: '#3A2010',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  inputFlex: { flex: 1 },

  dualRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  dualField: { flex: 1, gap: 6 },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: '#4B5563' },
  inputWithUnit: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  unitToggle: {
    flexDirection: 'row',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#EEDECB',
    backgroundColor: '#FFFFFF',
  },
  unitOption: { paddingHorizontal: 12, paddingVertical: 14, backgroundColor: '#FFFFFF' },
  unitOptionActive: { backgroundColor: Colors.primary },
  unitText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: '#4B5563' },
  unitTextActive: { color: '#FFFFFF', fontWeight: FontWeight.bold },

  sectionSpacer: { height: Spacing.sm },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#1F2937',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionHint: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 16,
  },

  optionsStack: {
    gap: 12,
    marginTop: Spacing.xs,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#EEDECB',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#3A2010',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  optionCardActive: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF5EE',
  },
  optionCardText: {
    fontSize: FontSize.md,
    color: '#1F2937',
    fontWeight: FontWeight.semibold,
  },
  optionCardTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },

  langScreen: {
    flex: 1,
  },

  sexCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#EEDECB',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#3A2010',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  sexCardText: {
    fontSize: FontSize.md,
    color: '#1F2937',
    fontWeight: FontWeight.semibold,
  },

  // ── Baseline Card (Step 5: BMR + BMI) ──
  baselineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#EEDECB',
    padding: 18,
    gap: 14,
    marginVertical: Spacing.xs,
    shadowColor: '#3A2010',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 2,
  },
  baselineMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  metricBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  metricDivider: {
    width: 1,
    height: 54,
    backgroundColor: '#EEDECB',
    marginHorizontal: 8,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: '#8FA4AE',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 26,
    fontWeight: FontWeight.bold,
    color: '#1F2937',
  },
  metricUnit: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: '#6B7280',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 2,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
  },
  metricHint: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  baselineCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  baselineCalloutText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: '#9A3412',
    fontWeight: FontWeight.medium,
    lineHeight: 18,
  },

  // ── 2x2 Bento Goal Grid ──
  goalGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    marginVertical: Spacing.xs,
  },
  goalCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#EEDECB',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 14,
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    position: 'relative',
    shadowColor: '#3A2010',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  goalCardActive: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF5EE',
  },
  goalCardSuggested: {
    borderColor: '#FDBA74',
  },
  recommendedBadge: {
    position: 'absolute',
    top: -8,
    right: 8,
    backgroundColor: Colors.primary,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 3,
  },
  recommendedBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
  },
  goalIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F5EBE0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalIconBoxActive: {
    backgroundColor: '#FFE3DC',
  },
  goalCardText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: '#374151',
    flex: 1,
  },
  goalCardTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },

  // ── 5-Pill Activity Stepper ──
  activityWrap: {
    width: '100%',
    gap: 12,
    marginVertical: Spacing.xs,
  },
  stepperRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  stepperPill: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#EEDECB',
    borderRadius: 16,
    paddingVertical: 14,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3A2010',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  stepperPillActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  stepperPillNum: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#374151',
  },
  stepperPillNumActive: {
    color: '#FFFFFF',
  },
  stepperPillSub: {
    fontSize: 10,
    fontWeight: FontWeight.medium,
    color: '#8FA4AE',
    marginTop: 2,
  },
  stepperPillSubActive: {
    color: '#FFFFFF',
  },
  activityInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#EEDECB',
    padding: 14,
    gap: 4,
    shadowColor: '#3A2010',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  activityInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activityInfoTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#1F2937',
  },
  activityInfoDesc: {
    fontSize: FontSize.xs,
    color: '#6B7280',
    lineHeight: 18,
  },

  // ── Health & Allergies Quick Chips ──
  choiceChipsRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  choiceChip: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#EEDECB',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    shadowColor: '#3A2010',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  choiceChipActive: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF5EE',
  },
  choiceChipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: '#374151',
  },
  choiceChipTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },

  conditionSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#EEDECB',
    padding: 14,
    gap: 10,
    marginTop: Spacing.xs,
    shadowColor: '#3A2010',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  conditionSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  conditionSummaryCount: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: '#374151',
  },
  openSheetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#FFF0EC',
  },
  openSheetBtnText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  tagChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    backgroundColor: '#F5EBE0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '48%',
  },
  tagChipText: {
    fontSize: FontSize.xs,
    color: '#4B5563',
    fontWeight: FontWeight.medium,
  },
  tagChipMore: {
    backgroundColor: '#EEDECB',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  tagChipMoreText: {
    fontSize: FontSize.xs,
    color: '#6B7280',
    fontWeight: FontWeight.bold,
  },

  // ── Step 10: Bento Summary Card ──
  bentoSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#EEDECB',
    padding: 16,
    gap: 12,
    shadowColor: '#3A2010',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2,
  },
  bentoSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5EBE0',
  },
  summaryBadgeLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  bentoSummaryTitle: {
    fontSize: 11,
    fontWeight: FontWeight.extrabold,
    color: Colors.primary,
    letterSpacing: 0.6,
  },
  bentoSummarySubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
    marginTop: 1,
  },
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  bentoCell: {
    width: '48.5%',
    backgroundColor: '#FAF6EE',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 2,
  },
  bentoCellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bentoCellLabel: {
    fontSize: 10,
    color: '#8FA4AE',
    fontWeight: FontWeight.medium,
  },
  bentoCellValue: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#1F2937',
  },

  // ── Buttons ──
  primaryBtn: {
    alignSelf: 'stretch',
    backgroundColor: Colors.primary,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
    marginTop: Spacing.sm,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },

  // ── Modals ──
  modalRoot: {
    flex: 1,
    backgroundColor: '#FAF6EE',
  },
  modalTopBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0E5D8',
    shadowColor: '#4A2810',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 10,
  },
  modalHandleWrap: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  modalHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: 4,
    paddingBottom: Spacing.md,
  },
  modalTitleWrap: {
    flex: 1,
    marginRight: Spacing.md,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#1F2937',
  },
  modalSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    fontWeight: FontWeight.medium,
  },
  modalDoneBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  modalDoneText: {
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
    fontSize: FontSize.sm,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: Spacing.lg,
  },
  modalFooter: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0E5D8',
    paddingHorizontal: Spacing.lg,
    paddingTop: 12,
    shadowColor: '#4A2810',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 8,
  },
  modalSaveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  modalSaveBtnText: {
    color: '#FFFFFF',
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
});
