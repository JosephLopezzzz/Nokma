import { ImageSourcePropType } from 'react-native';

// ─── Animation Priority Tokens (Higher number = Higher priority) ──────────────
export const COACH_PRIORITY = {
  NAVIGATION: 100,
  VALIDATION: 80,
  DIALOGUE: 60,
  ANSWER_REACTION: 40,
  MASCOT_TAP: 20,
  IDLE: 10,
} as const;

export type CoachPriorityValue = typeof COACH_PRIORITY[keyof typeof COACH_PRIORITY];

// ─── Centralized Timing Tokens (Milliseconds) ────────────────────────────────
export const COACH_TIMING = {
  instant: 120,
  quick: 200,

  acknowledgement: 380,
  reaction: 620,

  entrance: 460,
  exit: 320,
  peek: 480,

  transition: 440,

  flexReaction: 720,

  // Calculation sequence timing on Step 5
  thinkingMin: 1800,
  thinkingIdeal: 2200,
  thinkingMax: 2600,

  // Final celebration timing on Step 10
  heroCelebration: 1100,
  proudSettle: 350,
  finalTransitionDelay: 1450,

  // Tap interaction
  tapReactionMin: 420,
  tapReactionMax: 650,
  tapCooldown: 1800,

  // Inactivity cues
  firstIdleReaction: 12000,
  inactivityHint: 25000,

  // Ambient idle loops
  idleBreathing: 3000,
  headTilt: 700,
  nod: 400,
} as const;

// ─── Semantic Character Types ────────────────────────────────────────────────
export type CoachMood =
  | 'neutral'
  | 'happy'
  | 'proud'
  | 'thinking'
  | 'concerned'
  | 'sleepy'
  | 'energetic'
  | 'curious'
  | 'encouraging'
  | 'motivated'
  | 'supportive';

export type CoachBehavior =
  | 'enter'
  | 'talk'
  | 'listen'
  | 'acknowledge'
  | 'react'
  | 'peek'
  | 'celebrate'
  | 'relax'
  | 'exit';

export type CoachPosition =
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'peekLeft'
  | 'peekRight';

export type CoachIntensity =
  | 'idle'
  | 'subtle'
  | 'medium'
  | 'hero';

export type CoachSemanticTrigger =
  | 'screen-enter'
  | 'dialogue-start'
  | 'dialogue-complete'
  | 'answer-success'
  | 'validation-error'
  | 'tap-mascot'
  | 'screen-exit'
  | 'calculate'
  | 'celebrate';

// ─── Standard Asset Keys ──────────────────────────────────────────────────────
export type MascotAssetKey =
  | 'idle'
  | 'flex'
  | 'streak'
  | 'worry'
  | 'sleep'
  | 'phone';

// ─── Verified Existing Asset Registry ────────────────────────────────────────
// All mapped directly to verified existing local files.
// Note: worry.png is Coach Hoo holding a phone with wing on chin (thinking/checklist pose).
export const MASCOT_ASSETS: Record<MascotAssetKey, ImageSourcePropType> = {
  idle: require('../assets/mascot/idle_static.png'),
  flex: require('../assets/mascot/flex.png'),
  streak: require('../assets/mascot/streak.png'),
  worry: require('../assets/mascot/worry.png'),
  sleep: require('../assets/mascot/sleeppp.png'),
  phone: require('../assets/mascot/worry.png'), // Visual match for phone/checklist checking
};

// ─── Mathematical Asset Normalization Matrix ──────────────────────────────────
// Derived from physical pixel measurements of canvas and alpha content:
// - idle.gif: canvas 1200x1200, character 802x819 (68.25% canvas height, baseline 987)
// - flex.png: canvas 640x400, character 236x230 (57.50% canvas height, baseline 305)
// - streak.png: canvas 640x400, character 223x234 (58.50% canvas height, baseline 315)
// - worry.png: canvas 640x400, character 217x221 (55.25% canvas height, baseline 290)
// - sleeppp.png: canvas 640x400, character 239x240 (60.00% canvas height, baseline 315)
export interface AssetNormalization {
  /** Relative scale correction factor to normalize perceived character height to idle.gif */
  scaleFactor: number;
  /** Vertical offset in dp (positive pushes down to align feet baseline) */
  baselineOffset: number;
  /** Horizontal offset in dp to align character visual center */
  centerOffset: number;
  /** Native canvas aspect ratio (width / height) */
  aspectRatio: number;
}

export const MASCOT_NORMALIZATION: Record<MascotAssetKey, AssetNormalization> = {
  idle: {
    scaleFactor: 1.0,
    baselineOffset: 0,
    centerOffset: 0,
    aspectRatio: 1.0, // 1200 / 1200
  },
  flex: {
    scaleFactor: 1.187, // 68.25% / 57.50%
    baselineOffset: 4,
    centerOffset: 0,
    aspectRatio: 1.6, // 640 / 400
  },
  streak: {
    scaleFactor: 1.166, // 68.25% / 58.50%
    baselineOffset: 0,
    centerOffset: 0,
    aspectRatio: 1.6,
  },
  worry: {
    scaleFactor: 1.235, // 68.25% / 55.25%
    baselineOffset: 10, // Sits 25px higher in raw canvas, normalize feet down
    centerOffset: 3,
    aspectRatio: 1.6,
  },
  phone: {
    scaleFactor: 1.235,
    baselineOffset: 10,
    centerOffset: 3,
    aspectRatio: 1.6,
  },
  sleep: {
    scaleFactor: 1.137, // 68.25% / 60.00%
    baselineOffset: 0,
    centerOffset: 0,
    aspectRatio: 1.6,
  },
};
