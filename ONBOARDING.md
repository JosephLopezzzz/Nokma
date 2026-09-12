# Coach Hoo: Onboarding Architecture & Flow Specification

> **Creative North Star:** "The Gamified Health Ledger"  
> Onboarding in Coach Hoo is not a tedious questionnaire—it is an interactive, animated conversation with **Coach Hoo** (the mascot), designed to establish user trust, calculate personalized scientific nutrition targets, and seamlessly transition the user into habit tracking.

---

## 1. System Overview & Routing Architecture

```mermaid
flowchart TD
    AppLaunch([App Launch]) --> CheckAuth{AuthContext: isOnboarded?}
    CheckAuth -- Yes --> Tabs[(tabs) / Dashboard]
    CheckAuth -- No --> Onboarding[(onboarding) / CoachOnboarding]
    
    subgraph OnboardingFlow [Coach Hoo Onboarding Flow]
        S0[Step 0: Language Selection] --> S1[Step 1: Welcome & Name]
        S1 --> S2[Step 2: Age]
        S2 --> S3[Step 3: Biological Sex]
        S3 --> S4[Step 4: Height & Weight]
        S4 --> S5[Step 5: Feedback / Calculating]
        S5 --> S6[Step 6: Goal with BMI Suggestion]
        S6 --> S7[Step 7: Activity Level]
        S7 --> S8[Step 8: Health Conditions]
        S8 --> S9[Step 9: Allergies & Intolerances]
        S9 --> S10[Step 10: Review & Completion]
    end

    Onboarding --> OnboardingFlow
    S10 --> PersistUser[Persist User Profile & Targets]
    PersistUser --> Tabs
    Tabs --> CheckTutorial{First Launch: isTutorialComplete?}
    CheckTutorial -- No --> SpotlightTour[Dashboard Spotlight Tutorial]
    CheckTutorial -- Yes --> ActiveApp[Active Dashboard]
```

### Route Guarding & Context
- **Root Router ([mobile/app/_layout.tsx](file:///c:/Users/Joseph%20T%20Lopez/OneDrive/Documents/Coach%20Hoo/mobile/app/_layout.tsx)):**
  - Evaluates `useAuth()`.
  - When `isOnboarded === false` (no profile stored in `SecureStore`), the app redirects immediately to `/(onboarding)`.
  - When `isOnboarded === true`, redirects to `/(tabs)`.
- **Layout Container ([mobile/app/(onboarding)/_layout.tsx](file:///c:/Users/Joseph%20T%20Lopez/OneDrive/Documents/Coach%20Hoo/mobile/app/%28onboarding%29/_layout.tsx)):**
  - Renders a clean Stack navigation without headers against theme background `#FAF6EE`.
  - Mounts [CoachOnboarding.tsx](file:///c:/Users/Joseph%20T%20Lopez/OneDrive/Documents/Coach%20Hoo/mobile/components/CoachOnboarding.tsx).

---

## 2. Step-by-Step Flow Breakdown

| Step # | Step Key | Mascot State | Purpose & User Input | Validation & Constraints |
| :--- | :--- | :--- | :--- | :--- |
| **0** | `language` | `idle` | Language selection: English vs. Filipino | Auto-advances upon tap. Back button replaced by "Exit App" confirmation. |
| **1** | `welcome` | `flex` | Coach introduces himself; requests user's preferred name (`form.name`) | Non-empty text required (`!form.name.trim()`). |
| **2** | `age` | `idle` | User's chronological age (`form.age`) | Number-pad only; restricted to integer between 10 and 120. |
| **3** | `sex` | `idle` | Biological sex (`male` \| `female`) for Mifflin-St Jeor BMR calculation | Selection required. Shows "Confirm" button once selected. |
| **4** | `height_weight` | `flex` | Dual input with interactive unit toggles (`cm`/`in`, `kg`/`lbs`) | Height: 1–300 cm.<br>Weight: 1–700 kg.<br>Auto-converted to metric under the hood. |
| **5** | `feedback` | `streak` | Non-interactive transition pause. Coach acknowledges data and computes baseline needs. | Excluded from the progress dots (`visibleSteps`). "Continue" button appears after typewriter finishes. |
| **6** | `goal` | `streak` | Nutrition goal selection: `lose`, `maintain`, `gain`, or `build_habits` | Features **Smart BMI Recommendation** based on Step 4 measurements. |
| **7** | `activity` | `flex` | Physical activity level (1 to 5 scale from Sedentary to Super Active) | Selection required. Controls TDEE activity multiplier (1.2 to 1.9). |
| **8** | `health` | `worry` | Tri-state gate: `Yes` \| `No` \| `Prefer not to say`. If Yes: opens searchable condition list. | Categorized into Metabolic, Cardiovascular, Digestive, and Renal. Includes medical safety disclaimer. |
| **9** | `allergies` | `worry` | Tri-state gate: `Yes` \| `No` \| `Prefer not to say`. If Yes: multiselect allergen list + free-form intolerances text. | Flags 9 major allergen classes (peanuts, shellfish, dairy, eggs, etc.) + custom input. |
| **10** | `finish` | `sleep` | Profile summary review card (`ReviewSummary`) + "Go to Dashboard" CTA | Maps data, persists user profile, calculates macro targets, and redirects to dashboard. |

---

## 3. UI & Interaction Patterns

### 1. Mascot Mood States & Typewriter Dialogue
Each step renders the **CoachBubble** component with a designated mascot mood:
- **`idle` (`idle.gif`):** Neutral, attentive posture for informational and demographic steps.
- **`flex` (`flex.png`):** Energetic, encouraging posture for metrics and activity inputs.
- **`streak` (`streak.png`):** Motivated, celebratory posture for goals and feedback.
- **`worry` (`worry.png`):** Caring, attentive posture during health conditions and allergen queries, or when validation errors occur.
- **`sleep` (`sleeppp.png`):** Satisfied, relaxed posture on the finish screen.

```typescript
// Typewriter pacing and instant reveal
speed: 15ms per character
skip: Tap anywhere on the screen during typing to immediately reveal the full message.
```

### 2. Form State Auto-Persistence (Crash & Reload Resilient)
Every change to `form` or `step` is debounced and committed to local storage under `coach_hoo_onboarding_progress`:
```typescript
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
```
If the user closes the app or navigates away mid-flow, reopening the app returns them directly to their exact question with all previous answers intact.

### 3. Step Transitions & Hardware Back Button
- **Animations:** Parallel fade (opacity 0 → 1) and horizontal slide (-40px / +40px) transition between steps.
- **Hardware Back (Android):** Hooked into `BackHandler`. Pressing hardware back navigates to `step - 1`. On Step 0 (Language), prompts a native alert asking if the user wishes to exit the app.

---

## 4. Scientific Nutrition Target Computation

Upon completing Step 10, the collected metrics feed directly into the **Mifflin-St Jeor** metabolic calculation engine in [mobile/services/api.ts](file:///c:/Users/Joseph%20T%20Lopez/OneDrive/Documents/Coach%20Hoo/mobile/services/api.ts):

### Step 1: Basal Metabolic Rate (BMR)
$$\text{BMR}_{\text{male}} = 10 \times \text{weight (kg)} + 6.25 \times \text{height (cm)} - 5 \times \text{age} + 5$$
$$\text{BMR}_{\text{female}} = 10 \times \text{weight (kg)} + 6.25 \times \text{height (cm)} - 5 \times \text{age} - 161$$

### Step 2: Total Daily Energy Expenditure (TDEE)
$$\text{TDEE} = \text{BMR} \times \text{Activity Multiplier}$$

| Level | Identifier | Multiplier | Description |
| :---: | :--- | :---: | :--- |
| **1** | Sedentary | `1.200` | Little to no exercise |
| **2** | Lightly Active | `1.375` | Light exercise 1–3 days/week |
| **3** | Moderately Active | `1.550` | Moderate exercise 3–5 days/week |
| **4** | Very Active | `1.725` | Hard exercise 6–7 days/week |
| **5** | Super Active | `1.900` | Physical job or 2x/day training |

### Step 3: Caloric Goal Adjustment
- **`lose`**: $\text{Target} = \text{TDEE} - 500\text{ kcal}$
- **`gain`**: $\text{Target} = \text{TDEE} + 300\text{ kcal}$
- **`maintain` / `build_habits`**: $\text{Target} = \text{TDEE}$

### Step 4: Macronutrient Gram Split
- **Protein:** $2.0\text{ g}$ per $\text{kg}$ of body weight ($4\text{ kcal/g}$)
- **Fat:** $25\%$ of total calories ($9\text{ kcal/g}$)
- **Carbohydrates:** Remaining balance of calories ($4\text{ kcal/g}$)

$$\text{Carbs (g)} = \frac{\text{Calories Target} - (\text{Protein (g)} \times 4) - (\text{Fat (g)} \times 9)}{4}$$

---

## 5. Post-Onboarding Transition: Dashboard Spotlight Tutorial

When the user enters the dashboard for the very first time, [mobile/components/DashboardTutorial.tsx](file:///c:/Users/Joseph%20T%20Lopez/OneDrive/Documents/Coach%20Hoo/mobile/components/DashboardTutorial.tsx) triggers a 5-step guided spotlight tour:

```
[Onboarding Complete]
        ↓
[Replace Route to /(tabs)]
        ↓
[Dashboard: isTutorialComplete? == false]
        ↓
1. Welcome Spotlight: Coach Hoo introduces the main screen
2. FAB / Scanner Spotlight: Highlights the center Log (+) button & Nutrition Scanner
3. Tracker Spotlight: Highlights Calorie & Macro progress rings
4. Coach Advice Spotlight: Highlights the adaptive coach recommendation card
5. Celebration: Triggers full-screen Confetti & marks `nokma_tutorial_complete`
```

- **Visual Hole Technique:** Uses absolute coordinate measurement (`measureLayout` + `measure`) and a 4000px border cutout box with animated dashed rings to spotlight exact UI elements without breaking layout hierarchy.
- **Scroll Synchronization:** Auto-scrolls the dashboard ScrollView so off-screen targets are centered before revealing the spotlight.

---

## 6. Bilingual Localization Matrix

All user-facing text, options, validation strings, and safety disclaimers are completely localized in English and Filipino across [mobile/constants/strings.ts](file:///c:/Users/Joseph%20T%20Lopez/OneDrive/Documents/Coach%20Hoo/mobile/constants/strings.ts) and [mobile/constants/i18n.ts](file:///c:/Users/Joseph%20T%20Lopez/OneDrive/Documents/Coach%20Hoo/mobile/constants/i18n.ts):

- **Language Keys:**
  - `english`
  - `filipino`
- **Medical & Allergen Terminology:** Localized terms for Filipino foods and conditions (e.g., *alta presyon*, *sakit sa puso*, *alerhiya sa hipon/isda*).
- **Goal Mapping:**
  - Lose Weight $\leftrightarrow$ *Bawasan ang timbang*
  - Maintain Weight $\leftrightarrow$ *Panatilihin ang timbang*
  - Build Muscle $\leftrightarrow$ *Magpalaki ng kalamnan*
  - Build Healthy Habits $\leftrightarrow$ *Bumuo ng malusog na gawi*
