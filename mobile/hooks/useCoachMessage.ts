import { useEffect, useState } from 'react';
import type { Meal, MacroResult, DailyTargets } from '../types';
import type { DashboardCoachExpression } from '../constants/coachAnimation';
import type { Language } from '../services/coachMessageService';
import { t } from '../constants/i18n';
import type { StringKey } from '../constants/i18n';

export type CoachMessageType =
  | 'welcome'
  | 'encouragement'
  | 'progress'
  | 'celebration'
  | 'late-night'
  | 'warning'
  | 'confirmation';

export interface CoachMessageResult {
  greeting: string;
  message: string;
  messageType: CoachMessageType;
  expression: DashboardCoachExpression;
}

function getGreetingKey(hour: number): StringKey {
  if (hour < 12) return 'coach.greeting.morning';
  if (hour < 17) return 'coach.greeting.afternoon';
  return 'coach.greeting.evening';
}

function isWellAboveDailyTarget(value: number, target: number): boolean {
  return target > 0 && Number.isFinite(value) && value >= target * 1.25;
}

function isWellAboveAnyDailyTarget(totals: MacroResult, targets: DailyTargets): boolean {
  return (
    isWellAboveDailyTarget(totals.calories, targets.calories_target) ||
    isWellAboveDailyTarget(totals.protein, targets.protein_target) ||
    isWellAboveDailyTarget(totals.carbs, targets.carbs_target) ||
    isWellAboveDailyTarget(totals.fat, targets.fat_target)
  );
}

export function useCoachMessage(
  userName: string | undefined,
  meals: Meal[],
  totals: MacroResult,
  targets: DailyTargets | null,
  lang: Language = 'english',
  currentStreak: number = 0,
): CoachMessageResult {
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const timer = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const name = userName?.split(' ')[0] || t(lang, 'coach.friend');
  const isLate = hour >= 22 || hour < 5;
  const greeting = t(lang, getGreetingKey(hour), { name });

  if (isLate) {
    return {
      greeting,
      message: t(lang, 'coach.lateNight', { name }),
      messageType: 'late-night',
      expression: 'sleep',
    };
  }

  if (!meals || meals.length === 0) {
    return {
      greeting,
      message: t(lang, 'coach.welcome'),
      messageType: 'welcome',
      expression: 'idle',
    };
  }

  if (targets && isWellAboveAnyDailyTarget(totals, targets)) {
    return {
      greeting,
      message: t(lang, 'coach.highIntake'),
      messageType: 'warning',
      expression: 'worry',
    };
  }

  // Streak milestone shout-outs (checked once per session via meals.length > 0)
  if (currentStreak > 0 && meals.length > 0) {
    const milestones = [30, 14, 7, 3];
    const hit = milestones.find(m => currentStreak === m);
    if (hit) {
      const streakMessages: Record<number, string> = {
        3:  `${name}, 3 days in a row 🔥 You\'re building momentum!`,
        7:  `One full week streak, ${name}! That\'s real dedication 🏆`,
        14: `Two weeks strong, ${name}! You\'re on fire 🔥🔥`,
        30: `A MONTH of streaks, ${name}?! You\'re unstoppable! 🔥🔥🔥`,
      };
      return {
        greeting,
        message: streakMessages[hit],
        messageType: 'celebration',
        expression: 'idle',
      };
    }
  }

  if (targets) {
    const calPct =
      targets.calories_target > 0
        ? totals.calories / targets.calories_target
        : 0;
    const proteinRemaining = Math.round(
      Math.max(0, targets.protein_target - totals.protein),
    );
    const mealCount = meals.length;

    const macroTargetsMet =
      targets.protein_target > 0 && totals.protein >= targets.protein_target &&
      targets.carbs_target > 0 && totals.carbs >= targets.carbs_target &&
      targets.fat_target > 0 && totals.fat >= targets.fat_target;

    if (macroTargetsMet && calPct >= 0.9) {
      return {
        greeting,
        message: t(lang, 'coach.celebration'),
        messageType: 'celebration',
        expression: 'flex',
      };
    }

    if (calPct >= 0.75) {
      const remainder =
        proteinRemaining > 0
          ? t(lang, 'coach.proteinToGo', { grams: proteinRemaining })
          : t(lang, 'coach.bitMore');
      return {
        greeting,
        message: t(lang, 'coach.almostThere', { remainder }),
        messageType: 'progress',
        expression: 'idle',
      };
    }

    if (calPct >= 0.5) {
      return {
        greeting,
        message: t(
          lang,
          mealCount > 1 ? 'coach.goodProgressPlural' : 'coach.goodProgress',
          { count: mealCount },
        ),
        messageType: 'encouragement',
        expression: 'idle',
      };
    }

    if (mealCount >= 2) {
      return {
        greeting,
        message: t(lang, 'coach.greatStart', { count: mealCount }),
        messageType: 'encouragement',
        expression: 'idle',
      };
    }

    return {
      greeting,
      message: t(lang, 'coach.offToGoodStart'),
      messageType: 'encouragement',
      expression: 'idle',
    };
  }

  return {
    greeting,
    message: t(lang, 'coach.startLogging'),
    messageType: 'welcome',
    expression: 'idle',
  };
}
