---
name: Coach Hoo
description: Gamified nutrition tracking where consistency is rewarded
colors:
  primary: "#D94A1E"
  primary-dim: "#B83912"
  accent: "#7CB7A5"
  accent-dim: "#62A491"
  bg: "#FAF6EE"
  bg-card: "#FFFFFF"
  bg-elevated: "#F5EBE0"
  calories: "#E8A254"
  protein: "#FFA76C"
  carbs: "#9BE1C8"
  fat: "#7CB7A5"
  text-primary: "#2F3E46"
  text-secondary: "#526E7A"
  text-muted: "#8FA4AE"
  border: "#EEDECB"
typography:
  display:
    fontSize: "42px"
    fontWeight: "800"
  headline:
    fontSize: "24px"
    fontWeight: "700"
  title:
    fontSize: "20px"
    fontWeight: "700"
  body:
    fontSize: "15px"
    fontWeight: "400"
  label:
    fontSize: "13px"
    fontWeight: "500"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
components:
  streak-card:
    backgroundColor: "{colors.bg-card}"
    rounded: "{rounded.xl}"
  kpi-card:
    backgroundColor: "{colors.bg-card}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
---

# Design System: Coach Hoo

## Overview

**Creative North Star: "The Gamified Health Ledger"**

Coach Hoo treats habit consistency as a premium game rather than a spreadsheet, while keeping macro data scannable and undeniable. The UI feels like a warm, engaging game dashboard rather than a clinical health app. It leverages heavy brand colors, native segmented controls, and minimalist editorial charts. The user sees their immediate streak rewarded beautifully, then scans their adherence objectively.

**Key Characteristics:**
- **Warm & Drenched:** Soft cream backgrounds contrasted with saturated, game-like hero elements.
- **Native-First Forms:** Standard segmented controls and iOS-style card elevation over custom web-style tabs.
- **Undeniable Data:** Clean, flat charts stripped of generic UI cruft (no inner grid lines, muddy shadows).
- **Tactile Rewards:** High-contrast, deeply shadowed streak cards that feel physical.

## Colors

The palette relies on a warm cream ground, punctuated by rich, saturated warm tones (red-oranges and golds) for gamification, with cool mint/teal accents for contrast and adherence tracking.

### Primary
- **Warm Red-Orange** (#D94A1E): The main brand and action color. Used for CTA buttons, line charts, and active states.
- **Deep Red-Orange** (#B83912): Used for pressed states and contrast requirements.

### Accent
- **Soft Mint/Teal** (#7CB7A5): The primary contrast accent, used for success states and fat macros.

### Neutral
- **Cozy Cream** (#FAF6EE): The primary app background.
- **Elevated Cream** (#F5EBE0): For secondary surfaces or list items against the background.
- **Dark Slate** (#2F3E46): Primary text. Deep and readable without being pure black.
- **Warm Border** (#EEDECB): Structural dividers on cream grounds.

### Named Rules
**The Macro Consistency Rule.** Macro colors are fixed everywhere in the app. Calories = Golden, Protein = Peach/Orange, Carbs = Mint, Fat = Teal. 

## Typography

**Display Font:** System Default (San Francisco on iOS, Roboto on Android)
**Body Font:** System Default

**Character:** The system relies on native typography, leaning on aggressive font weights and scales to create hierarchy rather than custom typefaces.

### Hierarchy
- **Display** (800, 42px): Hero streak numbers and massive KPI moments.
- **Headline** (700, 24px): Screen headers and primary section titles.
- **Title** (700, 20px): Modal titles and card headers.
- **Body** (400, 15px): Standard descriptions and list items.
- **Label** (500, 13px): Subtitles, component labels, and secondary data.

## Layout

The layout uses a standard 16px (`md`) safe area margin for most surfaces, expanding to 24px (`lg`) for hero containers. Density is relaxed, giving gamified elements room to breathe.

## Elevation & Depth

Surfaces rely on subtle, ambient drop shadows over borders. Hard borders are generally reserved for distinct list rows or disabled states.

### Shadow Vocabulary
- **Card Rest** (`0 4px 8px rgba(0,0,0,0.05)`): Standard elevation for KPI cards and data blocks on the cream background.
- **Hero Lift** (`0 8px 16px {colors.primary} at 25% opacity`): A drenched, colored shadow reserved strictly for the Streak hero card to make it pop off the screen.

## Shapes

Soft, tactile rounding. Smallest interactive elements use 8px (`sm`), standard cards use 12px or 16px (`md`/`lg`), and massive hero cards use 24px (`xl`). Buttons and badges often go fully pill-shaped (`full`).

## Components

### Segmented Control
- **Style:** Strictly platform-native (via `@react-native-segmented-control/segmented-control`).
- **Color:** Tinted with `colors.primary`.

### Streak Hero Card
- **Shape:** 24px radius (`xl`).
- **Depth:** No borders, heavy `Hero Lift` shadow.
- **Internal:** Highly saturated backgrounds (often gradients mapped to streak level) with white, drop-shadowed text.

### KPI Cards
- **Corner Style:** 12px radius (`md`).
- **Depth:** `Card Rest` shadow, no borders.
- **Internal:** `16px` padding, muted labels with bold values.

### Charts (react-native-chart-kit)
- **Style:** Editorial and flat.
- **Rules:** `withInnerLines={false}`, flat background gradients. Shadow fills must match the primary stroke color.

## Do's and Don'ts

### Do:
- **Do** use the native segmented control for top-level view switching.
- **Do** use colored shadows for high-value gamification cards.
- **Do** strip grid lines from charts to maintain a clean editorial look.

### Don't:
- **Don't** use 1px hard borders on data cards unless on a perfectly flat UI.
- **Don't** use generic black/grey shadow fills under colored line charts.
- **Don't** force low-contrast text on bright backgrounds; use a subtle text shadow if necessary.
