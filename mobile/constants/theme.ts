// ─── Nokma Design System ──────────────────────────────────────────────────
import { Platform } from 'react-native';

export const lightColors = {
  // Backgrounds
  bg:           '#FAF6EE',  // warm cozy cream/beige background
  bgCard:       '#FFFFFF',  // white card surface
  bgElevated:   '#F5EBE0',  // warm cream elevated element
  bgInput:      '#FFFFFF',  // white input fields

  // Primary brand
  primary:      '#D94A1E',  // warm red-orange
  primaryDim:   '#B83912',
  primaryGlow:  'rgba(217, 74, 30, 0.12)',

  // Accent
  accent:       '#7CB7A5',  // soft mint/teal
  accentDim:    '#62A491',

  // Macro colors (consistent across app, based on brand palette)
  calories:     '#E8A254',  // golden
  protein:      '#FFA76C',  // soft peach/orange
  carbs:        '#9BE1C8',  // mint green
  fat:          '#7CB7A5',  // soft teal

  // Text
  textPrimary:  '#2F3E46',  // dark slate text
  textSecondary:'#526E7A',  // lighter slate
  textMuted:    '#8FA4AE',  // muted slate
  textInverse:  '#FFFFFF',  // white text on colored buttons

  // Borders
  border:       '#EEDECB',  // warm border color
  borderLight:  '#F5EBE0',

  // Status
  success:      '#7CB7A5',
  warning:      '#FFA76C',
  error:        '#E05252',
  info:         '#9BE1C8',

  // Meal type colors
  breakfast:    '#E8A254',  // Golden
  lunch:        '#9BE1C8',  // Mint
  dinner:       '#7CB7A5',  // Teal
  snack:        '#FFA76C',  // Soft orange
};

export const darkColors: typeof lightColors = {
  // Backgrounds
  bg:           '#121212',  // deep charcoal/black
  bgCard:       '#1E1E1E',  // elevated dark card
  bgElevated:   '#2C2C2C',  // lighter dark element
  bgInput:      '#1E1E1E',

  // Primary brand (slightly brighter for contrast)
  primary:      '#E35A2D',
  primaryDim:   '#D94A1E',
  primaryGlow:  'rgba(227, 90, 45, 0.15)',

  // Accent
  accent:       '#8BCCB8',
  accentDim:    '#7CB7A5',

  // Macro colors
  calories:     '#F5B66A',
  protein:      '#FFBA89',
  carbs:        '#AEEFE4',
  fat:          '#8BCCB8',

  // Text
  textPrimary:  '#E0E0E0',
  textSecondary:'#A0A0A0',
  textMuted:    '#707070',
  textInverse:  '#FFFFFF',

  // Borders
  border:       '#333333',
  borderLight:  '#2C2C2C',

  // Status
  success:      '#8BCCB8',
  warning:      '#FFBA89',
  error:        '#F06565',
  info:         '#AEEFE4',

  // Meal type colors
  breakfast:    '#F5B66A',
  lunch:        '#AEEFE4',
  dinner:       '#8BCCB8',
  snack:        '#FFBA89',
};

// Keep Colors as default (light) to not break files that haven't been migrated yet
export const Colors = lightColors;

export type ThemeColors = typeof lightColors;

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
} as const;

export const Radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  full: 999,
} as const;

export const FontSize = {
  xs:   11,
  sm:   13,
  md:   15,
  lg:   17,
  xl:   20,
  xxl:  24,
  xxxl: 32,
  hero: 42,
} as const;

export const FontWeight = {
  regular:    '400' as const,
  medium:     '500' as const,
  semibold:   '600' as const,
  bold:       '700' as const,
  extrabold:  '800' as const,
};

// ─── Meal tokens (decoupled from macros) ────────────────────────────────────
// Meal hues are intentionally distinct from macro hues (golden/peach/mint/teal).
// Each meal has a theme-aware { bg, border, fg, iconBg } set so pill text meets
// WCAG AA contrast on both light and dark surfaces.
export interface MealToken {
  bg:     string;
  border: string;
  fg:     string;
  iconBg: string;
}

export const mealTokensLight: Record<string, MealToken> = {
  breakfast: { bg: '#FEF3C7', border: '#F59E0B66', fg: '#92400E', iconBg: '#F59E0B26' },
  lunch:     { bg: '#E0F2FE', border: '#0EA5E966', fg: '#0369A1', iconBg: '#0EA5E926' },
  dinner:    { bg: '#E0E7FF', border: '#6366F166', fg: '#4338CA', iconBg: '#6366F126' },
  snack:     { bg: '#FCE7F3', border: '#EC489966', fg: '#BE185D', iconBg: '#EC489926' },
};

export const mealTokensDark: Record<string, MealToken> = {
  breakfast: { bg: '#F59E0B2E', border: '#F59E0B55', fg: '#FCD34D', iconBg: '#F59E0B26' },
  lunch:     { bg: '#0EA5E92E', border: '#0EA5E955', fg: '#7DD3FC', iconBg: '#0EA5E926' },
  dinner:    { bg: '#6366F12E', border: '#6366F155', fg: '#A5B4FC', iconBg: '#6366F126' },
  snack:     { bg: '#EC48992E', border: '#EC489955', fg: '#F9A8D4', iconBg: '#EC489926' },
};

// Darkened macro foregrounds for small text on tinted pill backgrounds.
// Raw macro hexes (e.g. mint #9BE1C8) fail contrast on white; these pass AA.
export const macroFgLight: Record<string, string> = {
  calories: '#9A5B13',
  protein:  '#B44A12',
  carbs:    '#1E7E5C',
  fat:      '#2F7D6B',
};

export const macroFgDark: Record<string, string> = {
  calories: '#F5B66A',
  protein:  '#FFBA89',
  carbs:    '#AEEFE4',
  fat:      '#8BCCB8',
};

export function getMacroFg(isDark: boolean, key: string): string {
  const map = isDark ? macroFgDark : macroFgLight;
  return map[key] ?? (isDark ? darkColors.textPrimary : lightColors.textPrimary);
}

// Meal type metadata (icons + labels; colors resolved per-theme via getMealMeta)
export const MEAL_TYPES = [
  { key: 'breakfast', label: 'Breakfast', color: '#92400E', icon: 'sunny-outline', iconActive: 'sunny' },
  { key: 'lunch',     label: 'Lunch',     color: '#0369A1', icon: 'restaurant-outline', iconActive: 'restaurant' },
  { key: 'dinner',    label: 'Dinner',    color: '#4338CA', icon: 'moon-outline', iconActive: 'moon' },
  { key: 'snack',     label: 'Snack',     color: '#BE185D', icon: 'cafe-outline', iconActive: 'cafe' },
] as const;

export type MealTypeKey = typeof MEAL_TYPES[number]['key'];

export function getMealMeta(isDark: boolean, key: string): MealToken & { key: string; icon: string; iconActive: string; label: string } {
  const tokens = isDark ? mealTokensDark : mealTokensLight;
  const base = MEAL_TYPES.find((m) => m.key === key) ?? MEAL_TYPES[0];
  const token = tokens[key] ?? tokens[base.key];
  return { key: base.key, icon: base.icon, iconActive: base.iconActive, label: base.label, ...token };
}

// ─── Log-screen shadows (no squares on Android) ─────────────────────────────
// Android ignores shadowColor and renders elevation as a hardgedged grey slab,
// which reads as a "square" behind rounded pills/buttons. So Android gets
// elevation 0 + border emphasis (borders are set at the call site); iOS keeps
// the soft blur shadows.
export const logShadows = {
  pill: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
    },
    default: {},
  }),
  cta: (primaryHex: string) =>
    Platform.select({
      ios: {
        shadowColor: primaryHex,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      default: {},
    }),
} as const;

export const COOKING_METHODS = [
  { key: 'raw',       label: 'Raw' },
  { key: 'boiled',    label: 'Boiled' },
  { key: 'steamed',   label: 'Steamed' },
  { key: 'grilled',   label: 'Grilled' },
  { key: 'baked',     label: 'Baked' },
  { key: 'fried',     label: 'Fried' },
  { key: 'deep_fried',label: 'Deep Fried' },
  { key: 'sauteed',   label: 'Sautéed' },
  { key: 'stewed',    label: 'Stewed' },
  { key: 'roasted',   label: 'Roasted' },
] as const;

export const FOOD_TYPES = [
  'chicken', 'chicken breast', 'chicken thigh', 'chicken wings',
  'pork', 'pork belly', 'beef', 'ground beef',
  'fish', 'tilapia', 'bangus', 'shrimp', 'squid',
  'egg', 'tofu', 'rice',
] as const;
