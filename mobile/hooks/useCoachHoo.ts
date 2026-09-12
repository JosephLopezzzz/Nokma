import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Keyboard, AccessibilityInfo, Platform, EmitterSubscription } from 'react-native';
import {
  CoachMood,
  CoachBehavior,
  CoachPosition,
  CoachIntensity,
  CoachSemanticTrigger,
  MascotAssetKey,
  COACH_PRIORITY,
  COACH_TIMING,
  CoachPriorityValue,
} from '../constants/coachAnimation';

export interface CoachState {
  mood: CoachMood;
  behavior: CoachBehavior;
  position: CoachPosition;
  intensity: CoachIntensity;
  assetKey: MascotAssetKey;
  isKeyboardVisible: boolean;
  keyboardHeight: number;
  isReducedMotion: boolean;
  canTap: boolean;
}

export interface CoachStepConfig {
  defaultMood: CoachMood;
  defaultPosition: CoachPosition;
  defaultAsset: MascotAssetKey;
  defaultIntensity?: CoachIntensity;
}

export function useCoachHoo(initialConfig?: Partial<CoachStepConfig>) {
  const [mood, setMood] = useState<CoachMood>(initialConfig?.defaultMood ?? 'neutral');
  const [behavior, setBehavior] = useState<CoachBehavior>('enter');
  const [position, setPosition] = useState<CoachPosition>(initialConfig?.defaultPosition ?? 'topCenter');
  const [intensity, setIntensity] = useState<CoachIntensity>(initialConfig?.defaultIntensity ?? 'idle');
  const [assetKey, setAssetKey] = useState<MascotAssetKey>(initialConfig?.defaultAsset ?? 'idle');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [isTappingCooldown, setIsTappingCooldown] = useState(false);

  // Tracks whether hook is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Tracks the priority of the currently running animation
  const currentPriorityRef = useRef<CoachPriorityValue>(COACH_PRIORITY.IDLE);

  // Timer handles for clean cancellation
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapCooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const calculateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Accessibility: Reduced Motion ──────────────────────────────────────────
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (isMountedRef.current) setIsReducedMotion(enabled);
      })
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      if (isMountedRef.current) setIsReducedMotion(enabled);
    });

    return () => {
      sub?.remove();
    };
  }, []);

  // ─── Keyboard Listeners ──────────────────────────────────────────────────────
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub: EmitterSubscription = Keyboard.addListener(showEvent, (e) => {
      if (!isMountedRef.current) return;
      setIsKeyboardVisible(true);
      setKeyboardHeight(e.endCoordinates?.height || 260);
    });

    const hideSub: EmitterSubscription = Keyboard.addListener(hideEvent, () => {
      if (!isMountedRef.current) return;
      setIsKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // ─── Centralized Timer Cleanup ───────────────────────────────────────────────
  const clearAllTimers = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (reactionTimerRef.current) {
      clearTimeout(reactionTimerRef.current);
      reactionTimerRef.current = null;
    }
    if (calculateTimerRef.current) {
      clearTimeout(calculateTimerRef.current);
      calculateTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearAllTimers();
      if (tapCooldownTimerRef.current) {
        clearTimeout(tapCooldownTimerRef.current);
      }
    };
  }, [clearAllTimers]);

  // ─── Can Tap Check ────────────────────────────────────────────────────────
  const canTap = behavior === 'listen' && !isTappingCooldown;
  const canTapRef = useRef(canTap);
  useEffect(() => {
    canTapRef.current = canTap;
  }, [canTap]);

  // ─── Semantic Trigger Dispatcher ──────────────────────────────────────────
  const trigger = useCallback(
    (event: CoachSemanticTrigger, payload?: any) => {
      switch (event) {
        case 'screen-enter': {
          clearAllTimers();
          currentPriorityRef.current = COACH_PRIORITY.NAVIGATION;
          const config: CoachStepConfig = payload || {};
          setMood(config.defaultMood || 'neutral');
          setPosition(config.defaultPosition || 'topCenter');
          setAssetKey(config.defaultAsset || 'idle');
          setIntensity(config.defaultIntensity || 'subtle');
          setBehavior(config.defaultPosition === 'peekLeft' ? 'peek' : 'enter');
          break;
        }

        case 'dialogue-start': {
          if (currentPriorityRef.current <= COACH_PRIORITY.DIALOGUE) {
            currentPriorityRef.current = COACH_PRIORITY.DIALOGUE;
            setBehavior('talk');
            setIntensity('subtle');
          }
          break;
        }

        case 'dialogue-complete': {
          currentPriorityRef.current = COACH_PRIORITY.IDLE;
          setBehavior('listen');
          setIntensity('idle');
          break;
        }

        case 'answer-success': {
          clearAllTimers();
          currentPriorityRef.current = COACH_PRIORITY.ANSWER_REACTION;
          setBehavior('acknowledge');
          setMood(payload?.mood || 'happy');
          if (payload?.asset) setAssetKey(payload.asset);
          setIntensity('medium');

          reactionTimerRef.current = setTimeout(() => {
            if (!isMountedRef.current) return;
            if (currentPriorityRef.current <= COACH_PRIORITY.ANSWER_REACTION) {
              currentPriorityRef.current = COACH_PRIORITY.IDLE;
              setBehavior('listen');
              setIntensity('idle');
            }
          }, COACH_TIMING.reaction);
          break;
        }

        case 'validation-error': {
          clearAllTimers();
          currentPriorityRef.current = COACH_PRIORITY.VALIDATION;
          setBehavior('react');
          setMood('concerned');
          setAssetKey('worry');
          setIntensity('medium');

          reactionTimerRef.current = setTimeout(() => {
            if (!isMountedRef.current) return;
            if (currentPriorityRef.current <= COACH_PRIORITY.VALIDATION) {
              currentPriorityRef.current = COACH_PRIORITY.IDLE;
              setBehavior('listen');
              setIntensity('idle');
            }
          }, COACH_TIMING.reaction);
          break;
        }

        case 'tap-mascot': {
          if (!canTapRef.current) return;
          clearAllTimers();
          currentPriorityRef.current = COACH_PRIORITY.MASCOT_TAP;
          setIsTappingCooldown(true);
          setBehavior('react');
          setIntensity('subtle');

          reactionTimerRef.current = setTimeout(() => {
            if (!isMountedRef.current) return;
            if (currentPriorityRef.current <= COACH_PRIORITY.MASCOT_TAP) {
              currentPriorityRef.current = COACH_PRIORITY.IDLE;
              setBehavior('listen');
              setIntensity('idle');
            }
          }, COACH_TIMING.tapReactionMin);

          tapCooldownTimerRef.current = setTimeout(() => {
            if (!isMountedRef.current) return;
            setIsTappingCooldown(false);
          }, COACH_TIMING.tapCooldown);
          break;
        }

        case 'calculate': {
          clearAllTimers();
          currentPriorityRef.current = COACH_PRIORITY.NAVIGATION;
          setMood('thinking');
          setAssetKey('phone');
          setBehavior('react');
          setIntensity('medium');

          calculateTimerRef.current = setTimeout(() => {
            if (!isMountedRef.current) return;
            setMood('happy');
            setAssetKey('streak');
            setBehavior('acknowledge');
            setIntensity('medium');
            currentPriorityRef.current = COACH_PRIORITY.IDLE;
            payload?.onCalculated?.();
          }, 1200);
          break;
        }

        case 'celebrate': {
          clearAllTimers();
          currentPriorityRef.current = COACH_PRIORITY.NAVIGATION;
          setMood('proud');
          setAssetKey('streak');
          setBehavior('celebrate');
          setIntensity('hero');
          break;
        }

        case 'screen-exit': {
          clearAllTimers();
          currentPriorityRef.current = COACH_PRIORITY.NAVIGATION;
          setBehavior('exit');
          break;
        }
      }
    },
    [clearAllTimers]
  );

  return useMemo(
    () => ({
      mood,
      behavior,
      position,
      intensity,
      assetKey,
      isKeyboardVisible,
      keyboardHeight,
      isReducedMotion,
      canTap,
      trigger,
      setAssetKey,
      setMood,
      setPosition,
      setBehavior,
    }),
    [
      mood,
      behavior,
      position,
      intensity,
      assetKey,
      isKeyboardVisible,
      keyboardHeight,
      isReducedMotion,
      canTap,
      trigger,
      setAssetKey,
      setMood,
      setPosition,
      setBehavior,
    ]
  );
}
