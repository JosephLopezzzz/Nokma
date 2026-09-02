import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { findAllergenMatches } from './allergenService';
import { FOODS_DB, RECIPES_DB } from './foodDb';
import { getDb } from './db';

export const getLocalDateString = (d: Date = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export { FOODS_DB, RECIPES_DB };

// Built-in fast food items
export const RESTAURANT_DB: any[] = [
  {
    id: 'ff_r5',
    name: 'Chicken Inasal',
    restaurant_name: 'Mang Inasal',
    serving_size_g: 300,
    calories: 585,
    protein: 72,
    carbs: 3,
    fat: 30,
    description: 'Ilonggo-style grilled chicken marinated in calamansi, lemongrass, and annatto',
  }
];

// ─── Local Helpers ────────────────────────────────────────────────────────────

async function getLocalMeals(): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem('coach_hoo_logged_meals');
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to parse meals:', err);
    return [];
  }
}

async function saveLocalMeals(meals: any[]) {
  try {
    await AsyncStorage.setItem('coach_hoo_logged_meals', JSON.stringify(meals));
  } catch (err) {
    console.error('Failed to save meals:', err);
  }
}

export async function getCustomFoods(): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem('coach_hoo_custom_foods');
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to parse custom foods:', err);
    return [];
  }
}

async function saveCustomFood(newFood: any) {
  try {
    const existing = await getCustomFoods();
    existing.push(newFood);
    await AsyncStorage.setItem('coach_hoo_custom_foods', JSON.stringify(existing));
  } catch (err) {
    console.error('Failed to save custom food:', err);
  }
}

async function deleteCustomFood(id: string) {
  try {
    const existing = await getCustomFoods();
    const updated = existing.filter((f: any) => f.id !== id);
    await AsyncStorage.setItem('coach_hoo_custom_foods', JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to delete custom food:', err);
  }
}

export async function getCustomFastFoods(): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem('coach_hoo_custom_fast_foods');
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to parse custom fast foods:', err);
    return [];
  }
}

async function saveCustomFastFood(newFood: any) {
  try {
    const existing = await getCustomFastFoods();
    existing.push(newFood);
    await AsyncStorage.setItem('coach_hoo_custom_fast_foods', JSON.stringify(existing));
  } catch (err) {
    console.error('Failed to save custom fast food:', err);
  }
}

async function deleteCustomFastFood(id: string) {
  try {
    const existing = await getCustomFastFoods();
    const updated = existing.filter((f: any) => f.id !== id);
    await AsyncStorage.setItem('coach_hoo_custom_fast_foods', JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to delete custom fast food:', err);
  }
}

async function lookupFoodName(type: string, id: string): Promise<string> {
  if (type === 'food') {
    const custom = await getCustomFoods();
    return [...FOODS_DB, ...custom].find(fd => fd.id === id)?.name ?? 'Food Item';
  }
  if (type === 'recipe') {
    return RECIPES_DB.find(rc => rc.id === id)?.name ?? 'Recipe Item';
  }
  if (type === 'restaurant') {
    const customFF = await getCustomFastFoods();
    return [...RESTAURANT_DB, ...customFF].find((rt: any) => rt.id === id)?.name ?? 'Fast Food Item';
  }
  return 'Food';
}

export function calculateDailyTargets(user: any) {
  const age = parseFloat(user.age) || 25;
  const height = parseFloat(user.height_cm) || 170;
  const weight = parseFloat(user.weight_kg) || 70;
  const sex = user.sex || 'male';
  const goal = user.goal || 'maintain';

  if (user.use_custom_macros) {
    return {
      calories_target: user.calories_target || 2000,
      protein_target: user.protein_target || 150,
      carbs_target: user.carbs_target || 200,
      fat_target: user.fat_target || 65,
    };
  }

  // Mifflin-St Jeor Formula BMR
  let bmr = 0;
  if (sex === 'male') {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }

  // TDEE — activity level 1-5 maps to standard multipliers
  const activityMultipliers: Record<number, number> = {
    1: 1.2,    // Sedentary
    2: 1.375,  // Lightly Active
    3: 1.55,   // Moderately Active
    4: 1.725,  // Very Active
    5: 1.9,    // Super Active
  };
  const activityLevel = user.activity_level ?? 2;
  const multiplier = activityMultipliers[activityLevel] ?? 1.375;
  const tdee = bmr * multiplier;

  let calories_target = tdee;
  if (goal === 'lose') {
    calories_target = tdee - 500;
  } else if (goal === 'gain') {
    calories_target = tdee + 300;
  }

  // Standard Macros Target Split
  const protein_target = Math.round(weight * 2.0); // 2.0g per kg of bodyweight
  const fat_target = Math.round((calories_target * 0.25) / 9); // 25% of calories
  const carbs_target = Math.round((calories_target - (protein_target * 4) - (fat_target * 9)) / 4);

  return {
    calories_target: Math.round(calories_target),
    protein_target,
    carbs_target,
    fat_target,
  };
}

export async function calculateItemMacros(item: any) {
  let quantity = parseFloat(item.quantity_g) || 0;
  let edibleWeight = quantity;

  // Custom bone weight subtraction
  if (item.bone_weight_g !== undefined && item.bone_weight_g > 0) {
    edibleWeight = Math.max(0, quantity - parseFloat(item.bone_weight_g));
  } else if (item.with_bones) {
    edibleWeight = quantity * 0.7; // default 70% edible weight reduction
  }

  let cal = 0, p = 0, c = 0, f = 0;

  if (item.type === 'manual' || item.food_type) {
    if (item.manual_macros) {
      return item.manual_macros;
    }

    const foodType = (item.food_type || '').toLowerCase();
    const customFoods = await getCustomFoods();
    const allFoods = [...FOODS_DB, ...customFoods];
    let baseFood = allFoods.find(fd => fd.name.toLowerCase().includes(foodType)) || 
                   allFoods.find(fd => foodType.includes(fd.name.toLowerCase()));
    
    if (!baseFood) {
      if (foodType.includes('pork')) {
        baseFood = FOODS_DB.find(fd => fd.id === 'f14')!; // pork chop
      } else if (foodType.includes('beef')) {
        baseFood = FOODS_DB.find(fd => fd.id === 'f5')!; // ground beef
      } else if (foodType.includes('rice')) {
        baseFood = FOODS_DB.find(fd => fd.id === 'f7')!; // white rice
      } else if (foodType.includes('egg')) {
        baseFood = FOODS_DB.find(fd => fd.id === 'f6')!; // egg
      } else if (foodType.includes('fish') || foodType.includes('tilapia') || foodType.includes('bangus') || foodType.includes('seafood') || foodType.includes('shrimp') || foodType.includes('squid')) {
        baseFood = FOODS_DB.find(fd => fd.id === 'f9')!; // tilapia
      } else if (foodType.includes('milk') || foodType.includes('drink') || foodType.includes('juice') || foodType.includes('beverage') || foodType.includes('coffee') || foodType.includes('soda') || foodType.includes('coke') || foodType.includes('shake') || foodType.includes('water') || foodType.includes('tea')) {
        baseFood = FOODS_DB.find(fd => fd.id === 'f16')!; // default to whole milk
      } else if (foodType.includes('vegetable') || foodType.includes('broccoli') || foodType.includes('spinach') || foodType.includes('kangkong') || foodType.includes('cabbage') || foodType.includes('salad') || foodType.includes('potato')) {
        baseFood = FOODS_DB.find(fd => fd.id === 'f21')!; // default to broccoli
      } else if (foodType.includes('fruit') || foodType.includes('banana') || foodType.includes('apple') || foodType.includes('mango') || foodType.includes('avocado') || foodType.includes('orange') || foodType.includes('calamansi')) {
        baseFood = FOODS_DB.find(fd => fd.id === 'f26')!; // default to banana
      } else if (foodType.includes('oil') || foodType.includes('butter') || foodType.includes('cheese') || foodType.includes('mayo') || foodType.includes('sauce') || foodType.includes('ketchup') || foodType.includes('peanut')) {
        baseFood = FOODS_DB.find(fd => fd.id === 'f31')!; // default to olive oil
      } else {
        baseFood = FOODS_DB.find(fd => fd.id === 'f1')!; // default to chicken breast
      }
    }

    const multiplier = edibleWeight / 100;
    cal = baseFood.calories_per_100g * multiplier;
    p = baseFood.protein_per_100g * multiplier;
    c = baseFood.carbs_per_100g * multiplier;
    f = baseFood.fat_per_100g * multiplier;

    // Cooking adjustments
    const method = (item.method || item.cooking_method || 'raw').toLowerCase();
    if (method === 'fried') {
      f += 5 * multiplier;
      cal += 45 * multiplier;
    } else if (method === 'deep_fried') {
      f += 10 * multiplier;
      cal += 90 * multiplier;
    } else if (method === 'sauteed') {
      f += 3 * multiplier;
      cal += 27 * multiplier;
    }

  } else if (item.type === 'food') {
    const customFoods = await getCustomFoods();
    const baseFood = [...FOODS_DB, ...customFoods].find(fd => fd.id === item.id);
    if (baseFood) {
      const multiplier = edibleWeight / 100;
      cal = baseFood.calories_per_100g * multiplier;
      p = baseFood.protein_per_100g * multiplier;
      c = baseFood.carbs_per_100g * multiplier;
      f = baseFood.fat_per_100g * multiplier;

      const method = (item.cooking_method || 'raw').toLowerCase();
      if (method === 'fried') {
        f += 5 * multiplier;
        cal += 45 * multiplier;
      } else if (method === 'deep_fried') {
        f += 10 * multiplier;
        cal += 90 * multiplier;
      } else if (method === 'sauteed') {
        f += 3 * multiplier;
        cal += 27 * multiplier;
      }
    }
  } else if (item.type === 'recipe') {
    const baseRecipe = RECIPES_DB.find(rc => rc.id === item.id);
    if (baseRecipe) {
      const multiplier = edibleWeight / 100;
      cal = (baseRecipe.macros_per_100g?.calories ?? 0) * multiplier;
      p = (baseRecipe.macros_per_100g?.protein ?? 0) * multiplier;
      c = (baseRecipe.macros_per_100g?.carbs ?? 0) * multiplier;
      f = (baseRecipe.macros_per_100g?.fat ?? 0) * multiplier;
    }
  } else if (item.type === 'restaurant') {
    const customFF = await getCustomFastFoods();
    const baseRest = [...RESTAURANT_DB, ...customFF].find(rt => rt.id === item.id);
    if (baseRest) {
      const multiplier = quantity / baseRest.serving_size_g;
      cal = baseRest.calories * multiplier;
      p = baseRest.protein * multiplier;
      c = baseRest.carbs * multiplier;
      f = baseRest.fat * multiplier;
    }
  }

  return { calories: cal, protein: p, carbs: c, fat: f };
}

// ─── API Mock Exports ─────────────────────────────────────────────────────────

export const authApi = {
  register: async (payload: any) => {
    return { data: { token: 'mock-token', user: payload } };
  },
  login: async (email: string) => {
    return { data: { token: 'mock-token', user: { email } } };
  },
  me: async () => {
    const raw = await SecureStore.getItemAsync('coach_hoo_user_data');
    return { data: raw ? JSON.parse(raw) : null };
  },
  update: async (payload: any) => {
    const raw = await SecureStore.getItemAsync('coach_hoo_user_data');
    const user = raw ? JSON.parse(raw) : {};
    const next = { ...user, ...payload };
    await SecureStore.setItemAsync('coach_hoo_user_data', JSON.stringify(next));
    return { data: next };
  },
};

export const foodsApi = {
  search: async (q: string, category?: string) => {
    const qc = (q || '').toLowerCase().trim();
    const customFoods = await getCustomFoods();
    let results = [...FOODS_DB, ...customFoods];
    if (qc) {
      results = results.filter(f => f.name.toLowerCase().includes(qc));
    }
    if (category) {
      results = results.filter(f => f.category === category);
    }
    return { data: { results } };
  },
  getById: async (id: string) => {
    const customFoods = await getCustomFoods();
    const food = [...FOODS_DB, ...customFoods].find(f => f.id === id);
    return { data: food };
  },
  categories: async () => {
    const customFoods = await getCustomFoods();
    const cats = Array.from(new Set([...FOODS_DB, ...customFoods].map(f => f.category)));
    return { data: cats };
  },
  create: async (payload: any) => {
    const newFood = { id: 'f_user_' + Math.random().toString(36).substring(7), ...payload };
    await saveCustomFood(newFood);  // Persisted to AsyncStorage!
    return { data: newFood };
  },
  listCustomFoods: async () => {
    const custom = await getCustomFoods();
    return { data: custom };
  },
  deleteCustomFood: async (id: string) => {
    try {
      const existing = await getCustomFoods();
      const updated = existing.filter(f => f.id !== id);
      await AsyncStorage.setItem('coach_hoo_custom_foods', JSON.stringify(updated));
      return { data: { success: true } };
    } catch (err) {
      console.error('Failed to delete custom food:', err);
      return { data: { success: false } };
    }
  },
};

export const recipesApi = {
  list: async (country?: string, meal_type?: string) => {
    let list = RECIPES_DB;
    if (country) list = list.filter(r => r.country === country);
    if (meal_type) list = list.filter(r => r.meal_types.includes(meal_type));
    return { data: list };
  },
  search: async (q: string) => {
    const qc = (q || '').toLowerCase().trim();
    let results = RECIPES_DB;
    if (qc) {
      results = results.filter(r => r.name.toLowerCase().includes(qc) || r.description?.toLowerCase().includes(qc));
    }
    return { data: { recipes: results } };
  },
  getById: async (id: string) => {
    const recipe = RECIPES_DB.find(r => r.id === id);
    return { data: recipe };
  },
};

export const mealsApi = {
  log: async (payload: { meal_type: string; items: any[]; notes?: string; logged_date?: string }) => {
    const db = getDb();
    const isWeb = !db;
    
    let stored = isWeb ? await getLocalMeals() : [];
    
    const processedItems = await Promise.all(payload.items.map(async (item) => {
      const macros = await calculateItemMacros(item);
      const sourceType = item.type || item.source_type || 'manual';
      const sourceId = item.id || item.source_id || ('src_' + Math.random().toString(36).substring(7));
      const foodName = item.food_type || item.food_name || item.name || (await lookupFoodName(sourceType, sourceId)) || 'Food Item';

      return {
        id: 'mi_' + Math.random().toString(36).substring(7),
        source_type: sourceType,
        source_id: sourceId,
        food_name: foodName,
        quantity_g: parseFloat(item.quantity_g) || 0,
        cooking_method: item.method || item.cooking_method || 'raw',
        with_bones: !!item.with_bones,
        bone_weight_g: item.bone_weight_g !== undefined ? parseFloat(item.bone_weight_g) : undefined,
        calculated_calories: macros.calories,
        calculated_protein: macros.protein,
        calculated_carbs: macros.carbs,
        calculated_fat: macros.fat,
      };
    }));


    const newMeal = {
      id: 'm_' + Math.random().toString(36).substring(7),
      user_id: 'local_user',
      meal_type: payload.meal_type,
      logged_date: payload.logged_date || getLocalDateString(),
      notes: payload.notes || '',
      created_at: new Date().toISOString(),
      items: processedItems,
    };

    if (isWeb) {
      stored.push(newMeal);
      await saveLocalMeals(stored);
    } else {
      db.withTransactionSync(() => {
        db.runSync(
          `INSERT INTO meals (id, user_id, meal_type, logged_date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
          [newMeal.id, newMeal.user_id, newMeal.meal_type, newMeal.logged_date, newMeal.notes, newMeal.created_at]
        );
        for (const item of newMeal.items) {
          db.runSync(
            `INSERT INTO meal_items 
             (id, meal_id, source_type, source_id, food_name, quantity_g, cooking_method, with_bones, bone_weight_g, calculated_calories, calculated_protein, calculated_carbs, calculated_fat)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [item.id, newMeal.id, item.source_type, item.source_id, item.food_name, item.quantity_g, item.cooking_method, item.with_bones ? 1 : 0, item.bone_weight_g || null, item.calculated_calories, item.calculated_protein, item.calculated_carbs, item.calculated_fat]
          );
        }
      });
    }

    return { data: newMeal };
  },

  today: async (date?: string) => {
    const targetDate = date || getLocalDateString();
    const db = getDb();
    const isWeb = !db;

    let filteredMeals: any[] = [];
    if (isWeb) {
      const meals = await getLocalMeals();
      filteredMeals = meals.filter(m => m.logged_date === targetDate);
    } else {
      const dbMeals = db.getAllSync<{id: string, user_id: string, meal_type: string, logged_date: string, notes: string, created_at: string}>(
        `SELECT * FROM meals WHERE logged_date = ?`, [targetDate]
      );
      
      for (const m of dbMeals) {
        const items = db.getAllSync<any>(
          `SELECT * FROM meal_items WHERE meal_id = ?`, [m.id]
        );
        filteredMeals.push({
          ...m,
          items: items.map(item => ({
            ...item,
            with_bones: !!item.with_bones,
          })),
        });
      }
    }

    let totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    filteredMeals.forEach(meal => {
      meal.items.forEach((item: any) => {
        totals.calories += item.calculated_calories || 0;
        totals.protein += item.calculated_protein || 0;
        totals.carbs += item.calculated_carbs || 0;
        totals.fat += item.calculated_fat || 0;
      });
    });

    let targets = null;
    try {
      const userData = await SecureStore.getItemAsync('coach_hoo_user_data');
      if (userData) {
        const user = JSON.parse(userData);
        targets = calculateDailyTargets(user);
      }
    } catch (_) {}

    let remaining = null;
    if (targets) {
      remaining = {
        calories: Math.max(0, targets.calories_target - totals.calories),
        protein: Math.max(0, targets.protein_target - totals.protein),
        carbs: Math.max(0, targets.carbs_target - totals.carbs),
        fat: Math.max(0, targets.fat_target - totals.fat),
      };
    }

    return {
      data: {
        date: targetDate,
        meals: filteredMeals,
        totals,
        targets,
        remaining,
      }
    };
  },

  delete: async (id: string) => {
    const db = getDb();
    if (!db) {
      let stored = await getLocalMeals();
      stored = stored.filter(m => m.id !== id);
      await saveLocalMeals(stored);
    } else {
      db.runSync(`DELETE FROM meals WHERE id = ?`, [id]);
    }
    return { data: { success: true } };
  },

  history: async (days: number = 7) => {
    const db = getDb();
    const isWeb = !db;
    
    const dates: string[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dates.push(getLocalDateString(d));
    }

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const result: {
      date: string;
      dayLabel: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    }[] = [];

    for (const dateStr of dates) {
      const dObj = new Date(dateStr + 'T00:00:00');
      const label = dayLabels[dObj.getDay()];

      let dayTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };

      if (isWeb) {
        const meals = await getLocalMeals();
        const filtered = meals.filter((m: any) => m.logged_date === dateStr);
        filtered.forEach((m: any) => {
          m.items?.forEach((it: any) => {
            dayTotals.calories += it.calculated_calories || 0;
            dayTotals.protein += it.calculated_protein || 0;
            dayTotals.carbs += it.calculated_carbs || 0;
            dayTotals.fat += it.calculated_fat || 0;
          });
        });
      } else {
        const rows = db.getAllSync<{
          cals: number;
          prot: number;
          carbs: number;
          fat: number;
        }>(
          `SELECT 
            SUM(mi.calculated_calories) as cals,
            SUM(mi.calculated_protein) as prot,
            SUM(mi.calculated_carbs) as carbs,
            SUM(mi.calculated_fat) as fat
           FROM meals m
           JOIN meal_items mi ON m.id = mi.meal_id
           WHERE m.logged_date = ?`,
          [dateStr]
        );
        if (rows && rows.length > 0 && rows[0].cals !== null) {
          dayTotals.calories = Math.round(rows[0].cals || 0);
          dayTotals.protein = Math.round(rows[0].prot || 0);
          dayTotals.carbs = Math.round(rows[0].carbs || 0);
          dayTotals.fat = Math.round(rows[0].fat || 0);
        }
      }

      result.push({
        date: dateStr,
        dayLabel: label,
        ...dayTotals,
      });
    }

    return { data: result };
  },

  clearAll: async () => {
    const db = getDb();
    if (db) {
      db.withTransactionSync(() => {
        db.runSync(`DELETE FROM meal_items`);
        db.runSync(`DELETE FROM meals`);
      });
    } else {
      await saveLocalMeals([]);
    }
  },
};

export const calculateApi = {
  macros: async (items: any[]) => {
    let total_calories = 0;
    let total_protein = 0;
    let total_carbs = 0;
    let total_fat = 0;

    for (const item of items) {
      const macros = await calculateItemMacros(item);
      total_calories += macros.calories;
      total_protein += macros.protein;
      total_carbs += macros.carbs;
      total_fat += macros.fat;
    }

    return {
      data: {
        total_calories,
        total_protein,
        total_carbs,
        total_fat,
      }
    };
  },
};

export const recommendApi = {
  meals: async (meal_type?: string, quantity?: number, remainingCalories: number = 500, allergies: string[] = []) => {
    let list = RECIPES_DB;

    // Filter by meal type
    if (meal_type) {
      list = list.filter(r => r.meal_types.includes(meal_type));
    }

    // Filter out recipes that contain allergen ingredients (uses shared allergen
    // signals so e.g. crustacean→Shrimp, mollusks→Squid, fish→Tilapia/Bangus match).
    if (allergies.length > 0) {
      list = list.filter(r => {
        const ingredientNames = (r.ingredients ?? []).map(ing => ing.name);
        return findAllergenMatches({ allergies }, ingredientNames).length === 0;
      });
    }

    // Shuffle for variety (Fisher-Yates)
    const shuffled = [...list];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const limit = quantity || 3;
    const recommendations = shuffled.slice(0, limit).map((r, index) => {
      // Scale portion to exactly hit remaining calories
      const portion_g = remainingCalories > 0 ? (remainingCalories / r.macros_per_100g.calories) * 100 : 100;
      const factor = portion_g / 100;
      
      const scaled_ingredients = r.ingredients.map(ing => ({
        name: ing.name,
        qty_g: (ing.base_qty_g / r.total_weight_g) * portion_g
      }));

      return {
        id: r.id,
        name: r.name,
        country: r.country,
        total_weight_g: r.total_weight_g,
        description: r.description,
        meal_types: r.meal_types,
        ingredients: scaled_ingredients,
        macros_per_portion: {
          portion_g,
          calories: r.macros_per_100g.calories * factor,
          protein: r.macros_per_100g.protein * factor,
          carbs: r.macros_per_100g.carbs * factor,
          fat: r.macros_per_100g.fat * factor,
        },
        remaining_after: { calories: 0, protein: 0, carbs: 0, fat: 0 },
        fit_score: 95 - index * 5,
        allergen_filtered: allergies.length > 0,
      };
    });
    return { data: recommendations };
  },

  restaurant: async (restaurant?: string) => {
    const qc = (restaurant || '').toLowerCase().trim();
    const customFF = await getCustomFastFoods();
    let items = [...RESTAURANT_DB, ...customFF];
    if (qc) {
      items = items.filter((rt: any) => rt.restaurant_name?.toLowerCase().includes(qc) || rt.name.toLowerCase().includes(qc));
    }
    return { data: { items } };
  },

  createFastFood: async (payload: any) => {
    const newFF = { id: 'ff_user_' + Math.random().toString(36).substring(7), ...payload };
    await saveCustomFastFood(newFF);
    return { data: newFF };
  },

  deleteCustomFastFood: async (id: string) => {
    await deleteCustomFastFood(id);
    return { data: { success: true } };
  },
};

const api = {
  get: async (url: string, config?: any) => {
    console.log('[Mock GET]', url, config);
    return { data: {} };
  },
  post: async (url: string, data?: any) => {
    console.log('[Mock POST]', url, data);
    return { data: {} };
  },
};

export default api;
