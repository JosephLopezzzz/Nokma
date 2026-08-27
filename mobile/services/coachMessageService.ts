export type Language = 'english' | 'filipino';

export const LANGUAGE_KEY = 'coach_hoo_language';
export const ONBOARDING_PROGRESS_KEY = 'coach_hoo_onboarding_progress';

// `i18n` imports Language from this module with `import type`, which is erased at
// compile time — so this runtime import does not create a cycle.
import { t as translate } from '../constants/i18n';
import { getGoalLabel as goalLabel } from '../constants/i18n';

export function getSuggestedGoal(
  heightCm: number,
  weightKg: number,
): 'lose' | 'maintain' | 'gain' {
  const bmi = weightKg / (heightCm / 100) ** 2;
  if (bmi < 18.5) return 'gain';
  if (bmi > 25) return 'lose';
  return 'maintain';
}

export function getWelcomeMessage(lang: Language): string {
  return translate(lang, 'onboarding.welcome');
}

export function getAgeMessage(lang: Language, name: string): string {
  return translate(lang, 'onboarding.age', { name });
}

export function getHeightWeightMessage(lang: Language): string {
  return translate(lang, 'onboarding.heightWeight');
}

export function getFeedbackMessage(lang: Language, name: string): string {
  return translate(lang, 'onboarding.feedback', { name });
}

export function getGoalMessage(lang: Language, suggestedGoal?: string): string {
  const base = translate(lang, 'onboarding.goalQuestion');
  if (suggestedGoal) {
    const suggestion = translate(lang, 'onboarding.goalSuggestion', {
      goal: suggestedGoal,
    });
    return `${base}\n\n${suggestion}`;
  }
  return base;
}

export function getGoalLabel(lang: Language, key: string): string {
  return goalLabel(lang, key);
}

export function getActivityLevelMessage(lang: Language): string {
  return translate(lang, 'onboarding.activityQuestion');
}

export function getHealthConditionMessage(lang: Language): string {
  return translate(lang, 'onboarding.healthQuestion');
}

export function getHealthConditionNoResponse(lang: Language): string {
  return translate(lang, 'onboarding.healthNo');
}

export function getHealthConditionYesResponse(lang: Language): string {
  return translate(lang, 'onboarding.healthSafety');
}

export function getAllergiesMessage(lang: Language): string {
  return translate(lang, 'onboarding.allergiesQuestion');
}

export function getAllergiesNoResponse(lang: Language): string {
  return translate(lang, 'onboarding.allergiesNo');
}

export function getAllergiesSelectMessage(lang: Language): string {
  return translate(lang, 'onboarding.allergiesSelect');
}

export function getFinishMessage(lang: Language, name: string): string {
  return translate(lang, 'onboarding.finish', { name });
}

export function getNoLabel(lang: Language): string {
  return translate(lang, 'common.no');
}
export function getYesLabel(lang: Language): string {
  return translate(lang, 'common.yes');
}
export function getSkipLabel(lang: Language): string {
  return translate(lang, 'common.preferNotToSay');
}
export function getContinueLabel(lang: Language): string {
  return translate(lang, 'common.continue');
}
export function getGoToDashboardLabel(lang: Language): string {
  return translate(lang, 'onboarding.goToDashboard');
}
export function getOtherAllergyLabel(lang: Language): string {
  return translate(lang, 'common.otherOptional');
}
export function getConfirmLabel(lang: Language): string {
  return translate(lang, 'common.confirm');
}
export function getHealthConditionSafetyNotice(lang: Language): string {
  return translate(lang, 'onboarding.healthSafety');
}
export function getHealthConditionWhichMessage(lang: Language): string {
  return translate(lang, 'onboarding.healthWhich');
}
export function getNamePlaceholder(lang: Language): string {
  return translate(lang, 'onboarding.namePlaceholder');
}
export function getAgePlaceholder(lang: Language): string {
  return translate(lang, 'onboarding.agePlaceholder');
}
export function getAllergySafetyNotice(lang: Language): string {
  return translate(lang, 'onboarding.allergySafety');
}

export interface SelectItem {
  key: string;
  label: string;
}
export interface SelectGroup {
  category: string;
  items: SelectItem[];
}

export function convertHeight(value: number, fromUnit: 'cm' | 'in'): number {
  if (fromUnit === 'in') return Math.round(value * 2.54);
  return value;
}

export function convertWeight(value: number, fromUnit: 'kg' | 'lbs'): number {
  if (fromUnit === 'lbs') return Math.round(value * 0.453592 * 10) / 10;
  return value;
}

export function validateAge(age: number): boolean {
  return Number.isInteger(age) && age >= 10 && age <= 120;
}

export function validateHeight(height: number): boolean {
  return height > 0 && height <= 300;
}

export function validateWeight(weight: number): boolean {
  return weight > 0 && weight <= 700;
}
