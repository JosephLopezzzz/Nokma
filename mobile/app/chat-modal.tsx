import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { router } from 'expo-router';
import {
  View, Text, StyleSheet, TextInput, FlatList,
  Pressable, KeyboardAvoidingView, Platform, Image,
  Animated, Keyboard, ActivityIndicator, ScrollView, Modal, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMeals } from '../context/MealContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getMealTypeLabel, getGoalLabel, labelForOptionKey } from '../constants/i18n';
import type { StringKey } from '../constants/strings';
import { FontSize, FontWeight, Spacing, Radius, MEAL_TYPES, ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { calculateItemMacros, recommendApi, RESTAURANT_DB, RECIPES_DB, FOODS_DB } from '../services/api';
import { resolveLogItemKeywords, findAllergenMatches } from '../services/allergenService';
import ScannerCamera from '../components/ScannerCamera';
import { ProgressiveNutritionData } from '../services/nutritionScanner';
import NetInfo from '@react-native-community/netinfo';
import { streamChatResponse, ChatMessage, ChatAiContext } from '../services/chatAiService';

// ─── Mascot Image Map (root-level high-res for header) ───────────────────────
const MASCOT_IMAGES = {
  idle:    require('../assets/mascot/idle.gif'),
  worry:   require('../assets/mascot/worry.png'),
  sleeppp: require('../assets/mascot/sleeppp.png'),
  streak:  require('../assets/mascot/streak.png'),
  flex:    require('../assets/mascot/flex.png'),
};

// ─── Small avatars for chat bubbles ──────────────────────────────────────────
const MASCOT_AVATARS = {
  idle:    require('../assets/mascot/idle.gif'),
  worry:   require('../assets/mascot/worry.png'),
  sleeppp: require('../assets/mascot/sleeppp.png'),
  streak:  require('../assets/mascot/streak.png'),
  flex:    require('../assets/mascot/flex.png'),
};

type MascotState = keyof typeof MASCOT_IMAGES;

interface Message {
  id: string;
  sender: 'user' | 'coach';
  text: string;
  timestamp: Date;
  mascotState?: MascotState;
}

// ─── Parser vocabularies (English + Filipino) ────────────────────────────────
/** Words that name a meal slot rather than a food, so they never count as a food match. */
const MEAL_WORDS = [
  'food', 'eat', 'ate', 'meal', 'lunch', 'breakfast', 'dinner', 'snack',
  'pagkain', 'kumain', 'kain', 'almusal', 'agahan', 'tanghalian', 'hapunan', 'meryenda', 'merienda',
];

/** Food nouns the parser recognises. Filipino spellings sit alongside English. */
const FOOD_KEYWORDS = [
  ...MEAL_WORDS,
  'pork', 'baboy', 'beef', 'baka', 'chicken', 'manok', 'rice', 'kanin', 'bigas',
  'egg', 'itlog', 'tofu', 'tokwa', 'fish', 'isda', 'tilapia', 'bangus',
  'shrimp', 'hipon', 'squid', 'pusit',
  'adobo', 'sinigang', 'tinola', 'kare-kare',
  'milk', 'gatas', 'juice', 'soda', 'coke', 'coffee', 'kape', 'tea', 'tsaa',
  'drink', 'inumin', 'beverage', 'shake', 'water', 'tubig',
  'broccoli', 'spinach', 'kangkong', 'cabbage', 'repolyo', 'potato', 'patatas',
  'vegetable', 'gulay',
  'banana', 'saging', 'apple', 'mansanas', 'mango', 'mangga', 'avocado',
  'orange', 'dalandan', 'calamansi', 'fruit', 'prutas',
  'oil', 'mantika', 'butter', 'mantikilya', 'cheese', 'keso',
  'mayo', 'mayonnaise', 'sauce', 'sarsa', 'ketchup', 'peanut', 'mani', 'peanut butter',
];

/** Cooking method key → words that imply it, longest/most specific first. */
const COOKING_ALIASES: Record<string, string[]> = {
  deep_fried: ['deep-fried', 'deep fried', 'malalim na pagprito'],
  boiled:     ['boiled', 'nilaga', 'nilagang', 'pinakuluan'],
  steamed:    ['steamed', 'pinasingawan', 'siniksik'],
  grilled:    ['grilled', 'inihaw', 'inihaw na', 'ihaw'],
  baked:      ['baked', 'hinurno', 'niluto sa oven'],
  fried:      ['fried', 'pinirito', 'prito', 'piniritong'],
  sauteed:    ['sauteed', 'ginisa', 'ginisang', 'sinangag'],
  stewed:     ['stewed', 'nilagang ulam', 'inihalo'],
  roasted:    ['roasted', 'inasado', 'litson', 'lechon'],
};

const QUICK_SUGGESTION_KEYS: StringKey[] = [
  'chat.suggestion.logChicken',
  'chat.suggestion.logRice',
  'chat.suggestion.remaining',
  'chat.suggestion.suggestMeal',
  'chat.suggestion.strategies',
  'chat.suggestion.allergies',
];

const MessageItem = React.memo(({ item, styles }: { item: Message, styles: any }) => {
  const isCoach = item.sender === 'coach';
  return (
    <View style={[styles.msgWrapper, isCoach ? styles.msgCoachWrapper : styles.msgUserWrapper]}>
      {isCoach && (
        <View style={styles.coachAvatarCircle}>
          <Image source={require('../assets/mascot/chatbot update.png')} style={styles.coachAvatar} resizeMode="cover" />
        </View>
      )}
      <View style={[styles.msgBubble, isCoach ? styles.msgBubbleCoach : styles.msgBubbleUser, { flexShrink: 1 }]}>
        <Text style={[styles.msgText, isCoach ? styles.msgTextCoach : styles.msgTextUser]}>
          {item.text}
        </Text>
        <Text style={[styles.msgTime, isCoach ? styles.msgTimeCoach : styles.msgTimeUser]}>
          {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      {!isCoach && (
        <View style={styles.userAvatarCircle}>
          <Ionicons name="person" size={24} color={styles.msgBubbleUser.backgroundColor} />
        </View>
      )}
    </View>
  );
}, (prev, next) => prev.item.text === next.item.text && prev.item.id === next.item.id);

export interface StreamingBubbleRef {
  setText: (text: string) => void;
  clear: () => void;
}

const StreamingBubble = forwardRef<StreamingBubbleRef, { styles: any }>((props, ref) => {
  const [text, setText] = useState('');

  useImperativeHandle(ref, () => ({
    setText: (newText) => setText(newText),
    clear: () => setText('')
  }));

  if (!text) return null;

  return (
    <View style={[props.styles.msgWrapper, props.styles.msgCoachWrapper]}>
      <View style={props.styles.coachAvatarCircle}>
        <Image source={require('../assets/mascot/chatbot update.png')} style={props.styles.coachAvatar} resizeMode="cover" />
      </View>
      <View style={[props.styles.msgBubble, props.styles.msgBubbleCoach, { flexShrink: 1 }]}>
        <Text style={[props.styles.msgText, props.styles.msgTextCoach]}>
          {text}
        </Text>
      </View>
    </View>
  );
});

export default function ChatScreen() {
  const [scannerCameraVisible, setScannerCameraVisible] = useState(false);
  const streamingBubbleRef = useRef<StreamingBubbleRef>(null);

  const { logMeal, deleteMeal, totals, targets, remaining, meals } = useMeals();
  const { user, updateUser } = useAuth();
  const { lang, t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: 'welcome',
      sender: 'coach',
      text: t('chat.welcome', { name: user?.full_name?.split(' ')[0] ?? t('coach.friend') }),
      timestamp: new Date(),
      mascotState: 'idle',
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [mascotState, setMascotState] = useState<MascotState>('idle');
  const [mascotStatusKey, setMascotStatusKey] = useState<StringKey>('chat.statusMotivated');
  const [isTyping, setIsTyping] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const breathAnim = useRef(new Animated.Value(1)).current;
  const breathing = useRef<Animated.CompositeAnimation | null>(null);

  // ─── Mascot Breathing Animation ────────────────────────────────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, {
          toValue: 1.03,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(breathAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    breathing.current = loop;
    loop.start();
    return () => loop.stop();
  }, []);

  useEffect(() => {
    if (isTyping && breathing.current) {
      breathing.current.stop();
      Animated.timing(breathAnim, {
        toValue: 0.95,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else if (!isTyping && breathing.current) {
      Animated.timing(breathAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        breathing.current?.start();
      });
    }
  }, [isTyping]);

  // ─── Mascot State Animation ────────────────────────────────────────────────
  const changeMascotState = (newState: MascotState, statusKey: StringKey) => {
    setMascotStatusKey(statusKey);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0.3, duration: 150, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.85, duration: 150, useNativeDriver: true })
    ]).start(() => {
      setMascotState(newState);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 250, useNativeDriver: true })
      ]).start();
    });
  };

  // ─── Sleepy State Trigger ──────────────────────────────────────────────────
  useEffect(() => {
    // Check if it's late night (after 10 PM)
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 5) {
      changeMascotState('sleeppp', 'chat.statusSleepy');
    }
  }, []);

  // ─── Offline NLP Parser ───────────────────────────────────────────────────
  // Keyword lists carry both English and Filipino spellings so the parser works
  // regardless of the UI language — users mix both in practice.
  const parseChatMessage = (text: string) => {
    const clean = text.toLowerCase().trim();

    // Meal type extraction
    let meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack' = 'snack';
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 11) meal_type = 'breakfast';
    else if (hour >= 11 && hour < 15) meal_type = 'lunch';
    else if (hour >= 17 && hour < 21) meal_type = 'dinner';

    const has = (words: string[]) => words.some((w) => clean.includes(w));
    const BREAKFAST_WORDS = ['breakfast', 'morning', 'almusal', 'agahan', 'umaga'];
    const LUNCH_WORDS     = ['lunch', 'noon', 'afternoon', 'tanghalian', 'hapon'];
    const DINNER_WORDS    = ['dinner', 'evening', 'night', 'hapunan', 'gabi'];
    const SNACK_WORDS     = ['snack', 'meryenda', 'merienda'];

    if (has(BREAKFAST_WORDS)) meal_type = 'breakfast';
    else if (has(LUNCH_WORDS)) meal_type = 'lunch';
    else if (has(DINNER_WORDS)) meal_type = 'dinner';
    else if (has(SNACK_WORDS)) meal_type = 'snack';

    const chunks = clean.split(/\s+and\s+|\s+at\s+|,|\s+also\s+|\s+with\s+|\s+na may\s+|\s+may\s+/);
    const parsedItems: any[] = [];
    let missingGramsKeyword: string | null = null;

    for (const chunk of chunks) {
      if (!chunk.trim()) continue;

      // Bone weight extraction
      let bone_weight_g: number | undefined = undefined;
      const boneMatch = chunk.match(/(\d+(?:\.\d+)?)\s*(?:g|grams|gramo)?\s*(?:of|ng)\s*(?:bones?|buto)\b/) ||
                        chunk.match(/(\d+(?:\.\d+)?)\s*(?:g|grams|gramo)?\s*(?:bones?|buto)\b/);
      if (boneMatch) {
        bone_weight_g = parseFloat(boneMatch[1]);
      }

      // Grams extraction
      const gramMatch = chunk.match(/(\d+(?:\.\d+)?)\s*(?:g|grams|gramo)\b/);
      if (!gramMatch) {
        if (bone_weight_g !== undefined && parsedItems.length > 0) {
          parsedItems[parsedItems.length - 1].bone_weight_g = bone_weight_g;
          continue;
        }

        // Check if they mentioned a food keyword but forgot weight in grams
        for (const kw of FOOD_KEYWORDS) {
          if (chunk.includes(kw)) {
            if (!MEAL_WORDS.includes(kw)) {
              missingGramsKeyword = kw;
            }
          }
        }
        continue;
      }
      const quantity_g = parseFloat(gramMatch[1]);

      // Cooking method extraction
      let cooking_method = 'raw';
      for (const [method, words] of Object.entries(COOKING_ALIASES)) {
        if (words.some((w) => chunk.includes(w))) {
          cooking_method = method;
          break;
        }
      }

      // Food Match
      let matchedItem: { type: 'food' | 'recipe' | 'restaurant' | 'manual'; id?: string; name: string } | null = null;

      // Check fast food
      for (const rt of RESTAURANT_DB) {
        if (chunk.includes(rt.name.toLowerCase()) || (chunk.includes(rt.restaurant_name.toLowerCase()) && chunk.includes(rt.name.split(' ').slice(1).join(' ').toLowerCase()))) {
          matchedItem = { type: 'restaurant', id: rt.id, name: rt.name };
          break;
        }
      }

      // Check recipes
      if (!matchedItem) {
        for (const r of RECIPES_DB) {
          if (chunk.includes(r.name.toLowerCase())) {
            matchedItem = { type: 'recipe', id: r.id, name: r.name };
            break;
          }
        }
      }

      // Check raw foods
      if (!matchedItem) {
        for (const f of FOODS_DB) {
          const short = f.name.toLowerCase().replace(/\(.*?\)/g, '').replace('cooked', '').replace('raw', '').trim();
          if (chunk.includes(short)) {
            matchedItem = { type: 'food', id: f.id, name: f.name };
            break;
          }
        }
      }

      // Fallback to manual food type keyword
      if (!matchedItem) {
        let foodType = 'chicken';
        for (const kw of FOOD_KEYWORDS) {
          if (MEAL_WORDS.includes(kw)) continue;
          if (chunk.includes(kw)) {
            foodType = kw;
            break;
          }
        }
        matchedItem = { type: 'manual', name: foodType };
      }

      // If we matched "bones" fallback manually but it's really bones
      if (matchedItem.type === 'manual' && matchedItem.name === 'chicken' && (chunk.includes('bone') || chunk.includes('buto'))) {
          if (parsedItems.length > 0) {
              parsedItems[parsedItems.length - 1].bone_weight_g = bone_weight_g || quantity_g;
              continue;
          }
      }

      parsedItems.push({
        matchedItem,
        quantity_g,
        bone_weight_g,
        cooking_method,
      });
    }

    if (parsedItems.length > 0) {
      return {
        type: 'log_multiple',
        items: parsedItems,
        meal_type,
      };
    }

    // Conversational Checks
    const isEditMeal = /change.*to|meant|actually|instead|those in|that in|palitan|ibahin|ilipat|for (breakfast|lunch|dinner|snack)/i.test(clean);
    if (isEditMeal) {
      if (has(BREAKFAST_WORDS)) return { type: 'edit_meal', new_meal_type: 'breakfast' };
      if (has(LUNCH_WORDS)) return { type: 'edit_meal', new_meal_type: 'lunch' };
      if (has(DINNER_WORDS)) return { type: 'edit_meal', new_meal_type: 'dinner' };
      if (has(SNACK_WORDS)) return { type: 'edit_meal', new_meal_type: 'snack' };
    }

    if (/strategies|strategy|guide|estratehiya|plano|paano/.test(clean)) {
      return { type: 'strategy' };
    }

    if (/recommend|suggest|ideas|magmungkahi|mungkahi|irekomenda|anong (?:dapat|pwede|puwede)|what\s+(?:meals?\s+)?(?:should|can)\s+i\s+eat/.test(clean)) {
      return { type: 'recommendation' };
    }

    if (/allerg|intoleran|my allerg|show allerg|what.*allerg/.test(clean)) {
      return { type: 'allergy_query' };
    }

    if (/weight|weigh|heavy|lbs|kg|timbang|bigat/.test(clean)) {
      return { type: 'weight_query' };
    }
    if (/profile|height|age|gender|sex|country|goal|about me|taas|edad|kasarian|bansa|layunin|tungkol sa akin/.test(clean)) {
      return { type: 'profile_query' };
    }
    if (/what did i eat|logged|history|my meals|past meals|what i ate|show meals|ano.*kinain|kinain ko|mga pagkain ko|kasaysayan/.test(clean)) {
      return { type: 'meals_query' };
    }
    if (/macro|calories|status|report|today|progress|remaining|how am i doing|ngayong araw|progreso|natitira|kumusta ako/.test(clean)) {
      return { type: 'report' };
    }
    if (/tip|help|advice|tulong|payo/.test(clean)) {
      return { type: 'general_chat' };
    }
    if (clean.match(/\b(hello|hi|hey|greetings|morning|afternoon|evening|yo|whats up|howdy|sup|kumusta|kamusta|musta|magandang umaga|magandang hapon|magandang gabi)\b/)) {
      return { type: 'greeting' };
    }

    if (missingGramsKeyword) {
      return { type: 'missing_grams', foodKeyword: missingGramsKeyword };
    }

    return { type: 'out_of_domain' };
  };

  // ─── Send Message Handler ──────────────────────────────────────────────────
  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: Message = {
      id: Math.random().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    const netInfo = await NetInfo.fetch();
    const isOnline = netInfo.isConnected && netInfo.isInternetReachable !== false;

    const fallbackParse = () => {
      // Process Response
      setTimeout(async () => {
        const parsed = parseChatMessage(textToSend);
        let coachResponseText = '';
      let nextMascot: MascotState = 'idle';
      let nextStatus: StringKey = 'chat.statusMotivated';

      // Check for late night sleepiness override first
      const hour = new Date().getHours();
      const isLate = hour >= 22 || hour < 5;
      const firstName = user?.full_name?.split(' ')[0] ?? t('coach.friend');

      if (!parsed || parsed.type === 'out_of_domain') {
        coachResponseText = t('chat.outOfDomain');
        nextMascot = isLate ? 'sleeppp' : 'worry';
        nextStatus = isLate ? 'chat.statusSleepy' : 'chat.statusReady';
      } else if (parsed.type === 'greeting') {
        const timeOfDay = hour < 12 ? t('chat.timeMorning') : hour < 18 ? t('chat.timeAfternoon') : t('chat.timeEvening');
        coachResponseText = t('chat.greetingReply', { timeOfDay, name: firstName });
        nextMascot = isLate ? 'sleeppp' : 'idle';
        nextStatus = isLate ? 'chat.statusYawning' : 'chat.statusHappy';
      } else if (parsed.type === 'weight_query') {
        if (user?.weight_kg) {
          coachResponseText = t('chat.weightReply', {
            kg: user.weight_kg,
            lbs: Math.round(user.weight_kg * 2.20462),
            goal: getGoalLabel(lang, user.goal || 'maintain'),
          });
          nextMascot = isLate ? 'sleeppp' : 'idle';
          nextStatus = 'chat.statusWeight';
        } else {
          coachResponseText = t('chat.noWeight');
          nextMascot = isLate ? 'sleeppp' : 'worry';
          nextStatus = 'chat.statusWorried';
        }
      } else if (parsed.type === 'profile_query') {
        const notSet = t('common.notSet');
        const condition = !user?.health_condition || user?.health_condition === 'none'
          ? t('common.none')
          : user?.health_condition === 'others'
            ? (user?.health_condition_custom || t('profile.otherCondition'))
            : labelForOptionKey(lang, user.health_condition);
        const allergiesStr = user?.allergies?.length
          ? user.allergies.map((a: string) => labelForOptionKey(lang, a)).join(', ')
          : t('common.none');
        coachResponseText = t('chat.profileReply', {
          name: user?.full_name ?? notSet,
          age: user?.age ? t('profile.ageValue', { age: user.age }) : notSet,
          height: user?.height_cm ?? notSet,
          weight: user?.weight_kg ?? notSet,
          goal: user?.goal ? getGoalLabel(lang, user.goal) : notSet,
          country: user?.country ?? notSet,
          condition,
          allergies: allergiesStr,
        });
        nextMascot = isLate ? 'sleeppp' : 'idle';
        nextStatus = 'chat.statusProfile';
      } else if (parsed.type === 'meals_query') {
        if (!meals || meals.length === 0) {
          coachResponseText = t('chat.noMeals');
          nextMascot = isLate ? 'sleeppp' : 'idle';
          nextStatus = 'chat.statusWaitingLog';
        } else {
          let mealList = `${t('chat.mealsHeader')}\n\n`;
          meals.forEach((m) => {
            const time = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const mealLabel = getMealTypeLabel(lang, m.meal_type).toUpperCase();
            mealList += `🍳 **${t('chat.mealAtTime', { mealType: mealLabel, time })}**\n`;
            m.items.forEach((item) => {
              const bones = item.with_bones ? t('chat.minusBones', { grams: item.bone_weight_g ?? 0 }) : '';
              mealList += `- ${item.food_name || t('mealSection.item')} (${item.quantity_g}g${bones})\n`;
            });
            mealList += `\n`;
          });
          coachResponseText = mealList.trim();
          nextMascot = isLate ? 'sleeppp' : 'streak';
          nextStatus = 'chat.statusMenu';
        }
      } else if (parsed.type === 'missing_grams') {
        coachResponseText = t('chat.missingGrams', { food: (parsed as any).foodKeyword });
        nextMascot = isLate ? 'sleeppp' : 'worry';
        nextStatus = 'chat.statusWaitingGrams';
      } else if (parsed.type === 'report') {
        const calTarget = targets?.calories_target ?? 2000;
        const pTarget = targets?.protein_target ?? 150;
        const cTarget = targets?.carbs_target ?? 200;
        const fTarget = targets?.fat_target ?? 65;
        const hitProtein = totals.protein >= pTarget;

        const body = t('chat.reportBody', {
          cal: Math.round(totals.calories),
          calTarget,
          calRem: Math.round(remaining?.calories ?? 0),
          p: Math.round(totals.protein),
          pTarget,
          c: Math.round(totals.carbs),
          cTarget,
          f: Math.round(totals.fat),
          fTarget,
        });
        const verdict = hitProtein
          ? t('chat.proteinHit')
          : t('chat.proteinNeeded', { grams: Math.round(Math.max(0, pTarget - totals.protein)) });
        coachResponseText = `${t('chat.reportHeader')}\n\n${body}\n\n${verdict}`;
        nextMascot = hitProtein ? 'flex' : (isLate ? 'sleeppp' : 'idle');
        nextStatus = hitProtein ? 'chat.statusFlexing' : (isLate ? 'chat.statusSleepyBawk' : 'chat.statusMacros');
      } else if (parsed.type === 'edit_meal') {
        if (meals && meals.length > 0) {
           const lastMeal = meals[meals.length - 1];
           await deleteMeal(lastMeal.id);
           const itemsToRelog = lastMeal.items.map((it: any) => ({
               type: it.source_type,   // normalize: source_type -> type
               id: it.source_id,
               quantity_g: it.quantity_g,
               cooking_method: it.cooking_method,
               method: it.cooking_method,
               food_type: it.food_name,
               with_bones: it.with_bones,
               bone_weight_g: it.bone_weight_g,
           }));
           const newType = parsed.new_meal_type || 'snack';
           await logMeal(newType, itemsToRelog);
           coachResponseText = t('chat.mealMoved', { mealType: getMealTypeLabel(lang, newType) });
           nextMascot = 'streak';
           nextStatus = 'chat.statusUpdated';
        } else {
           coachResponseText = t('chat.noMealsToEdit');
           nextMascot = 'worry';
           nextStatus = 'chat.statusConfused';
        }
      } else if (parsed.type === 'recommendation' || parsed.type === 'strategy') {
          const remCals = remaining?.calories ? Math.max(0, remaining.calories) : (targets?.calories_target ?? 500);
          const userAllergies: string[] = user?.allergies ?? [];
          const healthCond = user?.health_condition ?? 'none';
          const healthCustom = user?.health_condition_custom ?? '';

          // Build health-condition context note. The keys here are the ones the
          // onboarding select actually persists (see HEALTH_GROUP_SPEC).
          const conditionNoteKey: StringKey | undefined =
            ['type1_diabetes', 'type2_diabetes', 'prediabetes'].includes(healthCond) ? 'chat.condDiabetes'
            : healthCond === 'high_blood_pressure' ? 'chat.condHypertension'
            : ['ckd', 'kidney_stones'].includes(healthCond) ? 'chat.condKidney'
            : undefined;
          const conditionNote = conditionNoteKey
            ? t(conditionNoteKey)
            : (healthCond === 'other' || healthCond === 'others') && healthCustom
              ? t('chat.condOther', { condition: healthCustom })
              : '';

          // Allergy note
          const allergenLabels = userAllergies.map((a) => labelForOptionKey(lang, a)).join(', ');
          const allergyNote = userAllergies.length > 0
            ? t('chat.filteringOut', { allergens: allergenLabels })
            : '';

          const loggedMealTypes = meals?.map(m => m.meal_type) || [];
          const hasBreakfast = loggedMealTypes.includes('breakfast');
          const hasLunch = loggedMealTypes.includes('lunch');
          const hasDinner = loggedMealTypes.includes('dinner');

          let remainingMealsToEat = 0;
          const mealsLeft: string[] = [];
          if (!hasBreakfast) { remainingMealsToEat++; mealsLeft.push(getMealTypeLabel(lang, 'breakfast')); }
          if (!hasLunch) { remainingMealsToEat++; mealsLeft.push(getMealTypeLabel(lang, 'lunch')); }
          if (!hasDinner) { remainingMealsToEat++; mealsLeft.push(getMealTypeLabel(lang, 'dinner')); }

          if (remainingMealsToEat === 0) {
              remainingMealsToEat = 1;
              mealsLeft.push(getMealTypeLabel(lang, 'snack'));
          }

          const caloriesPerRemainingMeal = remCals / remainingMealsToEat;
          const contextLines = [conditionNote, allergyNote].filter(Boolean).join('\n');

          if (parsed.type === 'strategy') {
              let stratText = `${t('chat.stratHeader', { kcal: Math.round(remCals) })}\n\n`;
              if (contextLines) stratText += `${contextLines}\n\n`;
              if (remainingMealsToEat > 1) {
                  stratText += t('chat.stratSplit', {
                    meals: mealsLeft.join(` ${t('common.and')} `),
                    perMeal: Math.round(caloriesPerRemainingMeal),
                  });
              } else {
                  stratText += t('chat.stratSingle', {
                    meal: mealsLeft[0],
                    kcal: Math.round(remCals),
                    protein: Math.round(Math.max(0, (targets?.protein_target ?? 0) - (totals?.protein || 0))),
                  });
              }
              coachResponseText = stratText;
              nextMascot = 'streak';
              nextStatus = 'chat.statusStrategy';
          } else {
              try {
                  const res = await recommendApi.meals(undefined, 3, caloriesPerRemainingMeal, userAllergies);
                  const recs = res.data;
                  let recText = '';
                  if (contextLines) recText += `${contextLines}\n\n`;

                  if (recs.length === 0) {
                      recText += t('chat.recNoMatch');
                  } else {
                      recText += remainingMealsToEat > 1
                        ? `${t('chat.recNextMeal', { count: remainingMealsToEat, kcal: Math.round(caloriesPerRemainingMeal) })}\n\n`
                        : `${t('chat.recExact', { kcal: Math.round(remCals) })}\n\n`;
                      recs.forEach((r: any) => {
                         recText += `🍽️ **${r.name}**\n${t('chat.recTotalPortion', { grams: Math.round(r.macros_per_portion.portion_g) })}\n${Math.round(r.macros_per_portion.calories)} ${t('macro.kcal')} | ${Math.round(r.macros_per_portion.protein)}g ${t('macro.protein')}\n\n${t('chat.recIngredients')}\n`;
                         if (r.ingredients && r.ingredients.length > 0) {
                             r.ingredients.forEach((ing: any) => {
                                 recText += `- ${Math.round(ing.qty_g)}g ${ing.name}\n`;
                             });
                         }
                         recText += `\n`;
                      });
                      if (userAllergies.length > 0) {
                          recText += `\n${t('chat.recAllergenFree', { allergens: allergenLabels })}`;
                      }
                  }
                  coachResponseText = recText.trim();
                  nextMascot = 'streak';
                  nextStatus = 'chat.statusTips';
              } catch(e) {
                  coachResponseText = t('chat.recFailed');
              }
          }
      } else if (parsed.type === 'allergy_query') {
        const allergiesStr = user?.allergies?.length
          ? user.allergies.map((a: string) => `• ${labelForOptionKey(lang, a)}`).join('\n')
          : t('common.none');
        const condition = !user?.health_condition || user?.health_condition === 'none'
          ? t('common.none')
          : user?.health_condition === 'others' || user?.health_condition === 'other'
            ? (user?.health_condition_custom || t('profile.otherCondition'))
            : labelForOptionKey(lang, user.health_condition);
        coachResponseText = t('chat.allergyReply', { name: firstName, condition, allergies: allergiesStr });
        nextMascot = isLate ? 'sleeppp' : 'idle';
        nextStatus = 'chat.statusHealth';
      } else if (parsed.type === 'general_chat') {
        coachResponseText = t('chat.generalTips');
        nextMascot = isLate ? 'sleeppp' : 'idle';
        nextStatus = isLate ? 'chat.statusYawning' : 'chat.statusHelpful';
      } else if (parsed.type === 'log_multiple' && parsed.items && parsed.items.length > 0) {
        try {
          const itemsToLog = parsed.items.map((it: any) => ({
            type: it.matchedItem.type,
            id: it.matchedItem.id || 'manual',
            quantity_g: it.quantity_g,
            cooking_method: it.cooking_method,
            method: it.cooking_method,
            food_type: it.matchedItem.type === 'manual' ? it.matchedItem.name : undefined,
            with_bones: it.bone_weight_g !== undefined,
            bone_weight_g: it.bone_weight_g,
          }));

// Log via context
          await logMeal(parsed.meal_type, itemsToLog);

          // Allergen check across logged items — surface a reminder in the reply
          const matchedAllergens = new Set<string>();
          for (const it of itemsToLog) {
            const kw = await resolveLogItemKeywords(it);
            findAllergenMatches(user, kw).forEach((a) => matchedAllergens.add(a));
          }

          let totalCal = 0, totalP = 0, totalC = 0, totalF = 0;
          let summaryText = '';

          for (const it of itemsToLog) {
            const itemMacros = await calculateItemMacros(it);
            totalCal += itemMacros.calories;
            totalP += itemMacros.protein;
            totalC += itemMacros.carbs;
            totalF += itemMacros.fat;
            
            const originalItem = parsed.items.find((p: any) => 
              (p.matchedItem.id === it.id) || (p.matchedItem.type === 'manual' && p.matchedItem.name === it.food_type)
            );
            
            const foodName = originalItem?.matchedItem?.name || it.food_type || t('mealSection.item');
            const bonesSuffix = it.bone_weight_g ? t('chat.logItemBones', { grams: it.bone_weight_g }) : '';
            summaryText += `🍗 **${foodName}** (${it.quantity_g}g${bonesSuffix})\n`;
          }

          const totalsText = t('chat.logTotals', {
            cal: Math.round(totalCal),
            p: Math.round(totalP),
            c: Math.round(totalC),
            f: Math.round(totalF),
          });
          const closer = totalP > 20 ? t('chat.greatProtein') : t('chat.loggedKeepGoing');

          if (matchedAllergens.size > 0) {
            const labels = Array.from(matchedAllergens).map((a) => labelForOptionKey(lang, a)).join(', ');
            coachResponseText = `⚠️ **${t('chat.allergenLoggedTitle')}**\n${t('chat.allergenLoggedBody', { allergens: labels })}\n\n${summaryText}\n${totalsText}`;
            nextMascot = isLate ? 'sleeppp' : 'worry';
            nextStatus = isLate ? 'chat.statusSleepy' : 'chat.statusWorried';
          } else {
            coachResponseText = `${t('chat.logSuccess', { mealType: getMealTypeLabel(lang, parsed.meal_type) })}\n\n${summaryText}\n${totalsText}\n\n${closer}`;
            nextMascot = totalP > 20 ? 'flex' : (isLate ? 'sleeppp' : 'streak');
            nextStatus = totalP > 20 ? 'chat.statusPump' : (isLate ? 'chat.statusBedtime' : 'chat.statusStreak');
          }
        } catch (err: any) {
          coachResponseText = t('chat.logFailed', { error: err.message || t('common.unknown') });
          nextMascot = 'worry';
          nextStatus = 'chat.statusWorried';
        }
      }

      const coachMsg: Message = {
        id: Math.random().toString(),
        sender: 'coach',
        text: coachResponseText,
        timestamp: new Date(),
        mascotState: nextMascot,
      };

      setMessages((prev) => [...prev, coachMsg]);
      setIsTyping(false);
      changeMascotState(nextMascot, nextStatus);

      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }, 1500);
    };

    if (isOnline) {
      const historyRaw = [...messages, userMsg];
      const chatHistory: ChatMessage[] = historyRaw.slice(-10).map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        text: m.text
      }));

      const context: ChatAiContext = {
        user: user || {},
        targets: targets ? {
          calories: targets.calories_target,
          protein: targets.protein_target,
          carbs: targets.carbs_target,
          fat: targets.fat_target
        } : { calories: 2000, protein: 150, carbs: 200, fat: 65 },
        totals: totals,
        meals: meals || []
      };

      streamChatResponse(
        chatHistory,
        context,
        (partialText) => {
          setIsTyping(false);
          const cleanText = partialText.replace(/\[(?:LOG_MEAL|DELETE_MEAL|CHANGE_GOAL):.*?\]/g, '');
          streamingBubbleRef.current?.setText(cleanText);
        },
        async (finalText) => {
          streamingBubbleRef.current?.clear();
          const cleanText = finalText.replace(/\[(?:LOG_MEAL|DELETE_MEAL|CHANGE_GOAL):.*?\]/g, '');
          
          setMessages((prev) => [...prev, {
            id: Math.random().toString(),
            sender: 'coach',
            text: cleanText,
            timestamp: new Date(),
            mascotState: 'idle'
          }]);
          
          const logMatch = finalText.match(/\[LOG_MEAL:\s*(.*?)\s*\]/);
          const delMatch = finalText.match(/\[DELETE_MEAL:\s*(.*?)\s*\]/);
          const goalMatch = finalText.match(/\[CHANGE_GOAL:\s*(.*?)\s*\]/);
          
          try {
            if (logMatch) {
              const data = JSON.parse(logMatch[1]);
              await logMeal(data.meal_type || 'snack', data.items.map((it: any) => ({
                type: 'manual',
                quantity_g: it.grams || 100,
                food_type: it.name,
                method: it.method || 'raw'
              })));
            }
            if (delMatch) {
              const data = JSON.parse(delMatch[1]);
              const mealType = data.meal_type;
              const mealToDelete = [...(meals||[])].reverse().find(m => m.meal_type === mealType);
              if (mealToDelete) {
                await deleteMeal(mealToDelete.id);
              }
            }
            if (goalMatch) {
              const data = JSON.parse(goalMatch[1]);
              if (['lose', 'gain', 'maintain'].includes(data.goal)) {
                await updateUser({ goal: data.goal });
              }
            }
          } catch(e) {
            console.error('Failed to parse AI action:', e);
          }
          
          const hour = new Date().getHours();
          const isLate = hour >= 22 || hour < 5;
          changeMascotState(isLate ? 'sleeppp' : 'idle', isLate ? 'chat.statusSleepy' : 'chat.statusMotivated');
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        },
        (err) => {
          streamingBubbleRef.current?.clear();
          console.log('Gemini error:', err);
          setMessages((prev) => [...prev, {
            id: Math.random().toString(),
            sender: 'coach',
            text: "Bawk! My AI brain is a bit scrambled right now. Please try again later!",
            timestamp: new Date(),
            mascotState: 'worry'
          }]);
          setIsTyping(false);
          const hour = new Date().getHours();
          const isLate = hour >= 22 || hour < 5;
          changeMascotState('worry', isLate ? 'chat.statusSleepy' : 'chat.statusWorried');
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      );
    } else {
      fallbackParse();
    }
  };

  const handleCaptureScanner = async (parsed: ProgressiveNutritionData) => {
    setScannerCameraVisible(false);

    const c = parsed.nutrition.calories?.value || 0;
    const p = parsed.nutrition.protein?.value || 0;
    const cb = parsed.nutrition.total_carbohydrates?.value || 0;
    const f = parsed.nutrition.total_fat?.value || 0;
    const foodName = parsed.product_name || 'Scanned Food';
    const mealType = 'snack';

    const ocrHour = new Date().getHours();
    const isLate = ocrHour >= 22 || ocrHour < 5;

    // Send user message
    const userMsg: Message = { id: Math.random().toString(), sender: 'user', text: t('chat.scannedPrefix', { name: foodName }), timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      await logMeal(mealType, [{
        type: 'manual',
        quantity_g: parsed.serving_size.value || 100, // Normalized to 1 serving
        food_type: foodName,
        method: 'raw',
        with_bones: false,
        manual_macros: { calories: c, protein: p, carbs: cb, fat: f }
      }]);

      const matched = findAllergenMatches(user, [foodName]);

      setTimeout(() => {
        let replyText = t('chat.scanLogged', {
          name: foodName,
          mealType: getMealTypeLabel(lang, mealType),
          cal: c, p, c: cb, f,
        });
        let mascot: MascotState = p > 15 ? 'flex' : 'streak';
        let status: StringKey = 'chat.statusScan';

        if (matched.length > 0) {
          const labels = matched.map((a) => labelForOptionKey(lang, a)).join(', ');
          replyText = `⚠️ **${t('chat.allergenLoggedTitle')}**\n${t('chat.allergenLoggedBody', { allergens: labels })}\n\n${replyText}`;
          mascot = isLate ? 'sleeppp' : 'worry';
          status = isLate ? 'chat.statusSleepy' : 'chat.statusWorried';
        }

        const coachMsg: Message = {
          id: Math.random().toString(),
          sender: 'coach',
          text: replyText,
          timestamp: new Date(),
          mascotState: mascot,
        };
        setMessages((prev) => [...prev, coachMsg]);
        setIsTyping(false);
        changeMascotState(mascot, status);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }, 1500);
    } catch (e: any) {
      setIsTyping(false);
      Alert.alert('Scan Failed', e.message || 'Could not save the nutrition label.');
    }
  };

  const renderMessage = useCallback(({ item }: { item: Message }) => {
    return <MessageItem item={item} styles={styles} />;
  }, [styles]);

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} />
      <View style={[styles.chatContainer, { paddingBottom: insets.bottom }]}>
        {/* Simple Header View */}
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <Text style={styles.coachTitle}>Nokma 🐔</Text>
            <View style={styles.statusBubble}>
              <View style={[styles.statusDot, { backgroundColor: mascotState === 'worry' ? colors.error : mascotState === 'sleeppp' ? colors.textMuted : colors.success }]} />
              <Text style={styles.statusText}>{t(mascotStatusKey)}</Text>
            </View>
          </View>
          <Pressable onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="close-circle" size={32} color={colors.border} />
          </Pressable>
        </View>
      
      {/* Chat Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.chatList}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <>
            {isTyping && (
              <View style={styles.typingBubble}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.typingText}>{t('chat.writing')}</Text>
              </View>
            )}
            <StreamingBubble ref={streamingBubbleRef} styles={styles} />
          </>
        }
      />

      {/* Suggestions scroll */}
      <View style={styles.suggestionsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsScroll}>
          {QUICK_SUGGESTION_KEYS.map((key) => {
            const label = t(key);
            return (
              <Pressable
                key={key}
                style={styles.suggestionChip}
                onPress={() => setInputText(label)}
              >
                <Text style={styles.suggestionText}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Message Input Bar */}
      <View style={styles.inputContainer}>
        <Pressable style={styles.attachBtn} onPress={() => setScannerCameraVisible(true)}>
          <Ionicons name="camera" size={24} color={colors.textMuted} />
        </Pressable>
        <TextInput
          style={styles.input}
          placeholder={t('chat.inputPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={inputText}
          onChangeText={setInputText}
          multiline={false}
          onSubmitEditing={() => handleSend(inputText)}
        />
        <Pressable
          style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
          onPress={() => handleSend(inputText)}
          disabled={!inputText.trim()}
        >
          <Ionicons name="send" size={18} color={colors.textInverse} />
        </Pressable>
      </View>
      </View>
      <ScannerCamera 
        visible={scannerCameraVisible} 
        onClose={() => setScannerCameraVisible(false)} 
        onCapture={handleCaptureScanner} 
      />
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  chatContainer: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    flex: 1,
    marginTop: '25%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgCard,
    gap: Spacing.md,
  },
  headerInfo: {
    flex: 1,
    gap: 4,
  },
  coachTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  statusBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  closeBtn: {
    padding: 8,
  },
  chatList: {
    padding: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  msgWrapper: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
    maxWidth: '95%',
  },
  msgCoachWrapper: {
    alignSelf: 'flex-start',
    alignItems: 'flex-end',
    gap: 8,
  },
  msgUserWrapper: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: 8,
  },
  coachAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coachAvatar: {
    width: '100%',
    height: '100%',
  },
  userAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  msgBubble: {
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    gap: 4,
  },
  msgBubbleCoach: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  msgBubbleUser: {
    backgroundColor: colors.primary,
    borderTopRightRadius: 2,
  },
  msgText: {
    fontSize: FontSize.md,
    lineHeight: 20,
  },
  msgTextCoach: {
    color: colors.textPrimary,
  },
  msgTextUser: {
    color: colors.textInverse,
  },
  msgTime: {
    fontSize: 9,
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  msgTimeCoach: {
    color: colors.textMuted,
  },
  msgTimeUser: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  typingContainer: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.xs,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radius.lg,
    borderTopLeftRadius: 2,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  typingText: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
  },
  suggestionsWrapper: {
    paddingVertical: Spacing.sm,
    backgroundColor: colors.bg,
  },
  suggestionsScroll: {
    paddingHorizontal: Spacing.md,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radius.full,
    marginRight: 8,
  },
  suggestionText: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bgCard,
    gap: 8,
  },
  input: {
    flex: 1,
    height: 44,
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    color: colors.textPrimary,
    fontSize: FontSize.md,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
  },
  attachBtn: {
    padding: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // OCR Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, maxHeight: '80%' },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: colors.textPrimary, marginBottom: Spacing.md },
  modalScroll: { gap: Spacing.sm },
  inputLabel: { fontSize: FontSize.sm, color: colors.textSecondary, fontWeight: FontWeight.medium, marginTop: 4 },
  modalInput: { backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, padding: Spacing.md, color: colors.textPrimary, fontSize: FontSize.md },
  mealTypeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mealTypeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgInput },
  mealTypeChipActive: { backgroundColor: colors.primaryGlow, borderColor: colors.primary },
  mealTypeChipText: { fontSize: FontSize.sm, color: colors.textSecondary },
  mealTypeChipTextActive: { color: colors.primary, fontWeight: FontWeight.bold },
  modalBtnRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  modalCancelBtn: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center', backgroundColor: colors.bgElevated },
  modalCancelText: { color: colors.textPrimary, fontWeight: FontWeight.bold },
  modalSaveBtn: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center', backgroundColor: colors.primary },
  modalSaveText: { color: colors.textInverse, fontWeight: FontWeight.bold },
});
