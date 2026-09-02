import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList,
  Pressable, ActivityIndicator, ScrollView, Modal, Alert, Platform,
  PanResponder, Animated, KeyboardAvoidingView, Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { foodsApi, recipesApi, recommendApi, RECIPES_DB } from '../../services/api';
import { findAllergenMatches } from '../../services/allergenService';
import FoodCard from '../../components/FoodCard';
import { FontSize, FontWeight, Spacing, Radius, MEAL_TYPES, ThemeColors } from '../../constants/theme';
import type { Food, Recipe, RestaurantFood } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import AnimatedPressable from '../../components/AnimatedPressable';
import { useAuth } from '../../context/AuthContext';
import { useMeals } from '../../context/MealContext';
import { useLanguage } from '../../context/LanguageContext';
import { getMealTypeLabel, labelForOptionKey } from '../../constants/i18n';
import type { StringKey } from '../../constants/strings';

type TabKey = 'foods' | 'restaurant';

const TABS: { key: TabKey; labelKey: StringKey; icon: string }[] = [
  { key: 'foods',      labelKey: 'search.tabFoods',      icon: 'nutrition-outline' },
  { key: 'restaurant', labelKey: 'search.tabRestaurant', icon: 'fast-food-outline' },
];

const SwipeableModalContent = ({ visible, onClose, contentStyle, children }: any) => {
  const { colors } = useTheme();
  const panY = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) panY.setValue(0);
  }, [visible]);

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120 || gestureState.vy > 1.2) {
          onClose();
        } else {
          Animated.spring(panY, { toValue: 0, useNativeDriver: true }).start();
        }
      }
    })
  ).current;

  return (
    <Animated.View style={[contentStyle, { transform: [{ translateY: panY }] }]}>
      <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%', flexShrink: 1 }}>
        <View style={{ alignItems: 'center', paddingVertical: 16, marginTop: -16, flexShrink: 0 }} {...panResponder.panHandlers}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border }} />
        </View>
        {children}
      </Pressable>
    </Animated.View>
  );
};

const PlatformModal = ({ visible, onClose, children }: any) => {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [isKeyboardVisible, setKeyboardVisible] = React.useState(false);

  React.useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleOverlayPress = () => {
    if (isKeyboardVisible) {
      Keyboard.dismiss();
    } else {
      onClose();
    }
  };

  return (
      <Modal 
        visible={visible} 
        animationType="slide" 
        transparent={Platform.OS !== 'ios'}
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}
        onRequestClose={onClose}
      >
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          {Platform.OS === 'ios' ? (
            <View style={styles.iosPageSheetContent}>
              {children}
            </View>
          ) : (
            <Pressable style={styles.modalOverlay} onPress={handleOverlayPress}>
              <SwipeableModalContent visible={visible} onClose={onClose} contentStyle={styles.modalContent}>
                {children}
              </SwipeableModalContent>
            </Pressable>
          )}
        </KeyboardAvoidingView>
      </Modal>
  );
};

export default function SearchScreen() {
  const { user } = useAuth();
  const { logMeal, remaining, targets, meals } = useMeals();
  const { lang, t } = useLanguage();
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [query,       setQuery]       = useState('');
  const [activeTab,   setActiveTab]   = useState<TabKey>('foods');
  const [foods,       setFoods]       = useState<any[]>([]);
  const [restaurant,  setRestaurant]  = useState<RestaurantFood[]>([]);
  const [loading,     setLoading]     = useState(false);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemRestaurant, setNewItemRestaurant] = useState('');
  const [newItemCals, setNewItemCals] = useState('');
  const [newItemProtein, setNewItemProtein] = useState('');
  const [newItemCarbs, setNewItemCarbs] = useState('');
  const [newItemFat, setNewItemFat] = useState('');

  // Details Modal State
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedItemSource, setSelectedItemSource] = useState<'food' | 'recipe' | 'restaurant' | null>(null);

  // Meal Type Selection State
  const [mealTypeModalVisible, setMealTypeModalVisible] = useState(false);
  const [pendingLogItem, setPendingLogItem] = useState<{item: any, type: string, defaultQty: number} | null>(null);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const remCals = remaining?.calories ? Math.max(0, remaining.calories) : (targets?.calories_target ?? 500);
      const loggedMealTypes = meals?.map(m => m.meal_type) || [];
      const hasBreakfast = loggedMealTypes.includes('breakfast');
      const hasLunch = loggedMealTypes.includes('lunch');
      const hasDinner = loggedMealTypes.includes('dinner');

      let remainingMealsToEat = 0;
      if (!hasBreakfast) remainingMealsToEat++;
      if (!hasLunch) remainingMealsToEat++;
      if (!hasDinner) remainingMealsToEat++;
      
      if (remainingMealsToEat === 0) {
          remainingMealsToEat = 1;
      }
      const caloriesPerRemainingMeal = remCals / remainingMealsToEat;

      if (activeTab === 'foods') {
        if (!q.trim()) {
           // Default: Recommendations + Custom Foods
           const alg = user?.allergies || [];
           const custom = await foodsApi.listCustomFoods();
           const recs = await recommendApi.meals(undefined, 10, caloriesPerRemainingMeal, alg);
           setFoods([...custom.data, ...recs.data]);
        } else {
           const { data: f } = await foodsApi.search(q);
           const { data: r } = await recipesApi.search(q);
           
           // Scale searched recipes to caloriesPerRemainingMeal to maintain consistency
           const scaledRecipes = r.recipes.map((recipe: any) => {
             const portion_g = caloriesPerRemainingMeal > 0 ? (caloriesPerRemainingMeal / recipe.macros_per_100g.calories) * 100 : 100;
             const factor = portion_g / 100;
             return {
               ...recipe,
               macros_per_portion: {
                 portion_g,
                 calories: recipe.macros_per_100g.calories * factor,
                 protein: recipe.macros_per_100g.protein * factor,
                 carbs: recipe.macros_per_100g.carbs * factor,
                 fat: recipe.macros_per_100g.fat * factor,
               }
             };
           });

           setFoods([...f.results, ...scaledRecipes]);
        }
      } else {
        const { data } = await recommendApi.restaurant(q || undefined);
        setRestaurant(data.items);
      }
    } catch (err) {
      console.error('[Search]', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, targets, remaining, meals, user?.allergies]);

  const clearResults = () => { setFoods([]); setRestaurant([]); };

  // Load defaults on tab change
  useEffect(() => {
    search('');
    setQuery('');
  }, [activeTab]);

  const handleScanMenu = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('ocr.permissionDenied'), t('ocr.cameraRequiredMenu'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.5 });
    if (!result.canceled) {
      Alert.alert(
        t('ocr.simulatedTitle'),
        t('ocr.simulatedMenuBody'),
        [
          { text: t('common.ok'), onPress: () => {
              setNewItemName('');
              setNewItemRestaurant(t('search.scannedMenuItem'));
              setModalVisible(true);
          }}
        ]
      );
    }
  };

  const handleSaveCustomItem = async () => {
    if (!newItemName) return Alert.alert(t('common.error'), t('search.nameRequired'));

    if (activeTab === 'restaurant') {
      await recommendApi.createFastFood({
        name: newItemName,
        restaurant_name: newItemRestaurant || t('search.customFastFood'),
        calories: parseFloat(newItemCals) || 0,
        protein: parseFloat(newItemProtein) || 0,
        carbs: parseFloat(newItemCarbs) || 0,
        fat: parseFloat(newItemFat) || 0,
        serving_size_g: 100,
        country: user?.country || 'PH'
      });
    } else {
      await foodsApi.create({
        name: newItemName,
        category: 'custom',
        calories_per_100g: parseFloat(newItemCals) || 0,
        protein_per_100g: parseFloat(newItemProtein) || 0,
        carbs_per_100g: parseFloat(newItemCarbs) || 0,
        fat_per_100g: parseFloat(newItemFat) || 0,
        is_raw: false,
        source: 'User'
      });
    }
    setModalVisible(false);
    setNewItemName(''); setNewItemRestaurant(''); setNewItemCals(''); setNewItemProtein(''); setNewItemCarbs(''); setNewItemFat('');
    search(query);
  };

  const handleDelete = async (id: string, isFastFood: boolean) => {
    if (isFastFood) {
      await recommendApi.deleteCustomFastFood(id);
    } else {
      await foodsApi.deleteCustomFood(id);
    }
    search(query);
  };

  const handleAddPress = (item: any) => {
    const isRecipe = !!item.meal_types;
    const isRestaurant = !!item.restaurant_name;
    const type = isRecipe ? 'recipe' : isRestaurant ? 'restaurant' : 'food';

    const defaultQty = item.macros_per_portion?.portion_g ?? item.serving_size_g ?? 100;

    setPendingLogItem({ item, type, defaultQty });
    setMealTypeModalVisible(true);
  };

  const allergenKeywordsFor = (item: any): string[] => {
    if (item.ingredients?.length) {
      return [item.name, ...item.ingredients.map((ing: any) => ing?.name ?? ing)];
    }
    return [String(item.name || '')];
  };

  const performLog = async (item: any, type: string, quantity_g: number, mealType: string) => {
    const matched = findAllergenMatches(user, allergenKeywordsFor(item));
    if (matched.length === 0) {
      runLog(item, type, quantity_g, mealType);
      return;
    }
    const labels = matched.map((a) => labelForOptionKey(lang, a)).join(', ');
    Alert.alert(
      t('log.allergenTitle'),
      t('log.allergenBody', { allergens: labels }),
      [
        { text: t('common.cancel'), style: 'cancel' as const },
        { text: t('log.logAnyway'), style: 'destructive' as const, onPress: () => runLog(item, type, quantity_g, mealType) },
      ],
    );
  };

  const runLog = async (item: any, type: string, quantity_g: number, mealType: string) => {
    try {
      await logMeal(mealType, [{
        type: type as any,
        id: item.id,
        quantity_g,
        cooking_method: 'raw',
        with_bones: false
      }]);
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || t('search.couldNotLog'));
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const allergenWarning = (() => {
      const matched = findAllergenMatches(user, allergenKeywordsFor(item));
      if (matched.length === 0) return undefined;
      return `⚠️ ${t('search.containsAllergen', { allergens: matched.map((a) => labelForOptionKey(lang, a)).join(', ') })}`;
    })();

    if (activeTab === 'foods') {
      const isRecipe = !!item.meal_types;
      const isCustom = item.id.startsWith('f_user_');
      return (
        <View style={styles.cardWrapper}>
          <FoodCard
            item={{ source: isRecipe ? 'recipe' : 'food', data: item }}
            allergenWarning={allergenWarning}
            onPress={() => {
              setSelectedItem(item);
              setSelectedItemSource(isRecipe ? 'recipe' : 'food');
              setDetailModalVisible(true);
            }}
            onAdd={() => handleAddPress(item)}
          />
          {isCustom && (
            <Pressable style={styles.deleteBtn} onPress={() => handleDelete(item.id, false)}>
              <Ionicons name="trash" size={16} color={colors.error} />
              <Text style={styles.deleteBtnText}>{t('search.deleteCustomFood')}</Text>
            </Pressable>
          )}
        </View>
      );
    }
    
    // Fast Food
    const isCustomFF = item.id.startsWith('ff_user_');
    return (
      <View style={styles.cardWrapper}>
        <FoodCard
          item={{ source: 'restaurant', data: item }}
          allergenWarning={allergenWarning}
          onPress={() => {
            setSelectedItem(item);
            setSelectedItemSource('restaurant');
            setDetailModalVisible(true);
          }}
          onAdd={() => handleAddPress(item)}
        />
        {isCustomFF && (
          <Pressable style={styles.deleteBtn} onPress={() => handleDelete(item.id, true)}>
            <Ionicons name="trash" size={16} color={colors.error} />
            <Text style={styles.deleteBtnText}>{t('search.deleteFastFood')}</Text>
          </Pressable>
        )}
      </View>
    );
  };

  const dataArr = activeTab === 'foods' ? foods : restaurant;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={22} color={colors.textSecondary} />
          <TextInput
            style={styles.input}
            placeholder={activeTab === 'foods' ? t('search.phFoods') : t('search.phRestaurant')}
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              search(text);
            }}
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(''); search(''); }} hitSlop={15}>
              <Ionicons name="close-circle" size={22} color={colors.textMuted} />
            </Pressable>
          )}
        </View>

        {/* Segmented Control Tabs */}
        <View style={styles.tabsContainer}>
          <Pressable
            style={[styles.tabSegment, activeTab === 'foods' && styles.tabSegmentActive]}
            onPress={() => setActiveTab('foods')}
          >
            <Ionicons name="nutrition-outline" size={16} color={activeTab === 'foods' ? colors.primary : colors.textSecondary} />
            <Text style={[styles.tabSegmentText, activeTab === 'foods' && styles.tabSegmentTextActive]}>
              {t('search.tabFoods')}
            </Text>
          </Pressable>
          
          <Pressable
            style={[styles.tabSegment, activeTab === 'restaurant' && styles.tabSegmentActive]}
            onPress={() => setActiveTab('restaurant')}
          >
            <Ionicons name="fast-food-outline" size={16} color={activeTab === 'restaurant' ? colors.primary : colors.textSecondary} />
            <Text style={[styles.tabSegmentText, activeTab === 'restaurant' && styles.tabSegmentTextActive]}>
              {t('search.tabRestaurant')}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Results */}
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : dataArr.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="fast-food-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>
            {activeTab === 'restaurant' ? t('search.noFastFood') : t('search.noResults')}
          </Text>
          {activeTab === 'restaurant' && (
             <Text style={[styles.emptyText, { textAlign: 'center', fontSize: FontSize.sm, marginTop: Spacing.sm }]}>
               {t('search.fastFoodHint')}
             </Text>
          )}
        </View>
      ) : (
        <FlatList
          data={dataArr}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Floating Action Button (FAB) */}
      <View style={styles.fabContainer}>
        {activeTab === 'restaurant' && (
          <AnimatedPressable style={[styles.fab, styles.fabSecondary]} onPress={handleScanMenu} scaleTo={0.9}>
            <Ionicons name="scan" size={24} color={colors.textPrimary} />
          </AnimatedPressable>
        )}
        <AnimatedPressable style={styles.fab} onPress={() => setModalVisible(true)} scaleTo={0.9}>
          <Ionicons name="add" size={32} color="#FFFFFF" />
        </AnimatedPressable>
      </View>

      {/* Add Custom Item Modal */}
      <PlatformModal visible={modalVisible} onClose={() => setModalVisible(false)}>
        <View style={styles.modalHeaderCompact}>
           <View style={[styles.modalHeaderIconCompact, { backgroundColor: activeTab === 'restaurant' ? colors.primaryGlow : colors.carbs + '20' }]}>
             <Ionicons name={activeTab === 'restaurant' ? "fast-food" : "nutrition"} size={24} color={activeTab === 'restaurant' ? colors.primary : colors.carbs} />
           </View>
           <View style={{ flex: 1 }}>
             <Text style={styles.modalTitleCompact}>
               {activeTab === 'restaurant' ? t('search.addFastFood') : t('search.addCustomFood')}
             </Text>
             <Text style={styles.modalSubtitleCompact} numberOfLines={1}>
               {activeTab === 'restaurant' ? 'Log a meal from your favorite spot' : 'Log a custom homemade recipe'}
             </Text>
           </View>
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.modalScroll}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formGroup}>
            <View style={styles.formRow}>
              <Text style={styles.inputLabel}>{t('search.name')}</Text>
              <TextInput 
                style={styles.formInput} 
                placeholder={activeTab === 'restaurant' ? t('ph.exampleMenuItem') : t('ph.exampleCustomFood')} 
                placeholderTextColor={colors.textMuted} 
                value={newItemName} 
                onChangeText={setNewItemName} 
              />
            </View>

            {activeTab === 'restaurant' && (
              <>
                <View style={[styles.formRow, { borderTopWidth: 1, borderTopColor: colors.borderLight, paddingVertical: 0, height: 1 }]} />
                <View style={styles.formRow}>
                  <Text style={styles.inputLabel}>{t('search.restaurant')}</Text>
                  <TextInput style={styles.formInput} placeholder={t('ph.exampleRestaurant')} placeholderTextColor={colors.textMuted} value={newItemRestaurant} onChangeText={setNewItemRestaurant} />
                </View>
              </>
            )}
          </View>

          <View style={styles.macrosGrid}>
            <View style={styles.macroInputCell}>
              <View style={[styles.macroInputIconContainer, { backgroundColor: colors.calories + '20' }]}>
                <Ionicons name="flame" size={16} color={colors.calories} />
              </View>
              <Text style={styles.macroInputCellLabel}>{t('macro.calories')}</Text>
              <TextInput style={styles.macroInputField} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textMuted} value={newItemCals} onChangeText={setNewItemCals} />
              <Text style={styles.macroInputUnit}>kcal</Text>
            </View>

            <View style={styles.macroInputCell}>
              <View style={[styles.macroInputIconContainer, { backgroundColor: colors.protein + '20' }]}>
                <Ionicons name="fish" size={16} color={colors.protein} />
              </View>
              <Text style={styles.macroInputCellLabel}>{t('macro.protein')}</Text>
              <TextInput style={styles.macroInputField} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textMuted} value={newItemProtein} onChangeText={setNewItemProtein} />
              <Text style={styles.macroInputUnit}>g</Text>
            </View>

            <View style={styles.macroInputCell}>
              <View style={[styles.macroInputIconContainer, { backgroundColor: colors.carbs + '20' }]}>
                <Ionicons name="leaf" size={16} color={colors.carbs} />
              </View>
              <Text style={styles.macroInputCellLabel}>{t('macro.carbs')}</Text>
              <TextInput style={styles.macroInputField} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textMuted} value={newItemCarbs} onChangeText={setNewItemCarbs} />
              <Text style={styles.macroInputUnit}>g</Text>
            </View>

            <View style={styles.macroInputCell}>
              <View style={[styles.macroInputIconContainer, { backgroundColor: colors.fat + '20' }]}>
                <Ionicons name="water" size={16} color={colors.fat} />
              </View>
              <Text style={styles.macroInputCellLabel}>{t('macro.fat')}</Text>
              <TextInput style={styles.macroInputField} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textMuted} value={newItemFat} onChangeText={setNewItemFat} />
              <Text style={styles.macroInputUnit}>g</Text>
            </View>
          </View>

          <View style={styles.modalBtnRow}>
            <Pressable style={styles.ghostBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.ghostBtnText}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable style={styles.modalSaveBtn} onPress={handleSaveCustomItem}>
              <Text style={styles.modalSaveText}>{t('search.saveItem')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </PlatformModal>

      {/* Detail Modal */}
      <PlatformModal visible={detailModalVisible} onClose={() => setDetailModalVisible(false)}>
        {selectedItem && (
          <>
            <View style={styles.modalHeaderCenter}>
               <View style={[styles.modalHeaderIconCircle, { backgroundColor: selectedItemSource === 'restaurant' ? colors.primaryGlow : selectedItemSource === 'recipe' ? colors.accent + '20' : colors.carbs + '20' }]}>
                 <Ionicons name={selectedItemSource === 'restaurant' ? "fast-food" : selectedItemSource === 'recipe' ? "book" : "nutrition"} size={32} color={selectedItemSource === 'restaurant' ? colors.primary : selectedItemSource === 'recipe' ? colors.accent : colors.carbs} />
               </View>
               <Text style={[styles.modalTitle, { marginBottom: 0 }]}>{selectedItem.name}</Text>
               <Text style={styles.modalSubtitle}>
                 {selectedItemSource === 'recipe'
                   ? t('search.srcRecipe', { country: selectedItem.country })
                   : selectedItemSource === 'restaurant'
                     ? t('search.srcRestaurant', { restaurant: selectedItem.restaurant_name })
                     : t('search.srcFood', { category: selectedItem.category || t('search.categoryGeneral') })}
               </Text>
            </View>

            <ScrollView 
              showsVerticalScrollIndicator={false} 
              contentContainerStyle={styles.modalScroll}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
            >
              
              {/* Macros Summary */}
              <View style={styles.detailMacrosContainer}>
                
                {(() => {
                  const macros = selectedItem.macros_per_portion ?? selectedItem.macros_per_100g ?? {
                    calories: selectedItem.calories_per_100g ?? selectedItem.calories ?? 0,
                    protein: selectedItem.protein_per_100g ?? selectedItem.protein ?? 0,
                    carbs: selectedItem.carbs_per_100g ?? selectedItem.carbs ?? 0,
                    fat: selectedItem.fat_per_100g ?? selectedItem.fat ?? 0
                  };
                  const portionG = selectedItem.macros_per_portion?.portion_g ?? selectedItem.serving_size_g ?? 100;
                  
                  return (
                    <>
                      <Text style={styles.detailSecTitle}>{t('search.macrosBreakdown')} • {t('search.servingSize', { grams: Math.round(portionG) })}</Text>
                      <View style={styles.detailMacrosGrid}>
                        <View style={[styles.detailMacroCard, { backgroundColor: colors.primaryGlow }]}>
                          <Text style={[styles.detailMacroVal, { color: colors.calories, fontSize: FontSize.xxl }]}>{Math.round(macros.calories)}</Text>
                          <Text style={styles.detailMacroLabel}>{t('macro.kcal')}</Text>
                        </View>
                        {[
                          { key: 'c', label: t('macro.carbs'), val: macros.carbs, color: colors.carbs },
                          { key: 'p', label: t('macro.protein'), val: macros.protein, color: colors.protein },
                          { key: 'f', label: t('macro.fat'), val: macros.fat, color: colors.fat },
                        ].map((m) => (
                          <View key={m.key} style={[styles.detailMacroCard, { backgroundColor: m.color + '15' }]}>
                            <Text style={[styles.detailMacroVal, { color: m.color, fontSize: FontSize.lg }]}>{Math.round(m.val)}g</Text>
                            <Text style={styles.detailMacroLabel}>{m.label}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  );
                })()}
              </View>

              {/* Recipe Ingredients */}
              {selectedItemSource === 'recipe' && (() => {
                const recipe = RECIPES_DB.find(r => r.id === selectedItem.id);
                if (recipe && recipe.ingredients) {
                  const portion_g = selectedItem.macros_per_portion?.portion_g ?? recipe.total_weight_g;
                  const factor = portion_g / recipe.total_weight_g;
                  const scaled = recipe.ingredients.map(ing => ({
                    name: ing.name,
                    qty_g: ing.base_qty_g * factor
                  }));

                  return (
                    <View style={styles.ingredientsSection}>
                      <Text style={styles.detailSecTitle}>{t('search.ingredients', { grams: Math.round(portion_g) })}</Text>
                      <View style={styles.ingredientsContainer}>
                        {scaled.map((ing, idx) => (
                          <View key={idx} style={styles.ingredientRow}>
                            <View style={styles.bulletPoint} />
                            <Text style={styles.ingredientText}>
                              <Text style={styles.ingredientQty}>{Math.round(ing.qty_g)}g</Text> {ing.name}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                }
                return null;
              })()}

              <View style={styles.modalBtnRow}>
                <Pressable style={styles.ghostBtn} onPress={() => setDetailModalVisible(false)}>
                  <Text style={styles.ghostBtnText}>{t('common.close')}</Text>
                </Pressable>
                <Pressable style={styles.modalSaveBtn} onPress={() => { setDetailModalVisible(false); handleAddPress(selectedItem); }}>
                  <Text style={styles.modalSaveText}>{t('search.logThisItem')}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </>
        )}
      </PlatformModal>

      {/* Meal Type Selection Modal */}
      <Modal visible={mealTypeModalVisible} transparent animationType="fade">
        <View style={[styles.modalOverlay, { justifyContent: 'center', alignItems: 'center' }]}>
          <View style={styles.mealTypeModalCard}>
            <Text style={styles.modalTitle}>
              {pendingLogItem?.item ? t('search.selectMealType', { name: pendingLogItem.item.name }) : t('log.title')}
            </Text>
            
            {MEAL_TYPES.map((mt) => (
              <Pressable
                key={mt.key}
                style={({ pressed }) => [
                  styles.mealTypeOption,
                  { borderColor: mt.color },
                  pressed && { opacity: 0.8, backgroundColor: mt.color + '10' }
                ]}
                onPress={() => {
                  if (pendingLogItem) {
                    performLog(pendingLogItem.item, pendingLogItem.type, pendingLogItem.defaultQty, mt.key);
                  }
                  setMealTypeModalVisible(false);
                  setPendingLogItem(null);
                }}
              >
                <Ionicons name={mt.icon as any} size={20} color={mt.color} />
                <Text style={[styles.mealTypeOptionText, { color: mt.color }]}>
                  {getMealTypeLabel(lang, mt.key)}
                </Text>
              </Pressable>
            ))}

            <Pressable
              style={styles.mealTypeCancel}
              onPress={() => {
                setMealTypeModalVisible(false);
                setPendingLogItem(null);
              }}
            >
              <Text style={styles.mealTypeCancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: colors.bg,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: Spacing.lg,
    height: 56,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },
  input: { flex: 1, color: colors.textPrimary, fontSize: FontSize.md },
  
  // Segmented Control Tabs
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.bgElevated,
    borderRadius: Radius.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabSegment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Radius.md,
    gap: 6,
  },
  tabSegmentActive: {
    backgroundColor: colors.bgCard,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  tabSegmentText: { fontSize: FontSize.sm, color: colors.textSecondary, fontWeight: FontWeight.medium },
  tabSegmentTextActive: { color: colors.primary, fontWeight: FontWeight.bold },
  
  fabContainer: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.xl,
    gap: Spacing.md,
    alignItems: 'center',
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  fabSecondary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bgElevated,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },

  cardWrapper: { marginBottom: Spacing.md },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: -8, paddingRight: Spacing.md, gap: 4 },
  deleteBtnText: { color: colors.error, fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  loader: { marginTop: Spacing.xxl },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  emptyText: { fontSize: FontSize.md, color: colors.textSecondary },
  list: { padding: Spacing.lg },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { 
    backgroundColor: colors.bgCard, 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    padding: Spacing.xl, 
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 24,
  },
  iosPageSheetContent: {
    flex: 1,
    backgroundColor: colors.bgCard,
    padding: Spacing.xl,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: colors.textPrimary, marginBottom: Spacing.lg, textAlign: 'center' },
  modalScroll: { gap: Spacing.md, paddingBottom: Spacing.xl },
  inputLabel: { fontSize: FontSize.sm, color: colors.textSecondary, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  modalInput: { 
    backgroundColor: colors.bgElevated, 
    borderWidth: 1, 
    borderColor: 'transparent',
    borderRadius: Radius.lg, 
    padding: Spacing.md, 
    color: colors.textPrimary, 
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
  },
  modalBtnRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl },
  modalCancelBtn: { flex: 1, padding: Spacing.md, borderRadius: Radius.full, alignItems: 'center', backgroundColor: colors.bgElevated },
  modalCancelText: { color: colors.textPrimary, fontWeight: FontWeight.bold },
  modalSaveBtn: { flex: 1, padding: Spacing.md, borderRadius: Radius.full, alignItems: 'center', backgroundColor: colors.primary, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  modalSaveText: { color: '#FFFFFF', fontWeight: FontWeight.bold },

  // Details Modal Specific Styles
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  detailLabel: {
    fontSize: FontSize.sm,
    color: colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  detailValue: {
    fontSize: FontSize.sm,
    color: colors.textPrimary,
    fontWeight: FontWeight.semibold,
  },
  detailMacrosContainer: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  detailSecTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  portionText: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    marginTop: -2,
  },
  detailMacrosGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 4,
  },
  detailMacroCard: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailMacroVal: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  detailMacroLabel: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ingredientsSection: {
    marginTop: Spacing.md,
  },
  ingredientsContainer: {
    backgroundColor: colors.bgElevated + '30',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: 6,
    gap: 8,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bulletPoint: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  ingredientText: {
    fontSize: FontSize.sm,
    color: colors.textSecondary,
  },
  ingredientQty: {
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  
  // Meal Type Modal Styles
  mealTypeModalCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 32,
    padding: Spacing.xxl,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  mealTypeOption: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  mealTypeOptionText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  mealTypeCancel: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  mealTypeCancelText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: colors.error,
  },

  // Impeccable Form Layout
  formGroup: {
    backgroundColor: colors.bgElevated,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  formInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: colors.textPrimary,
    textAlign: 'right',
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    backgroundColor: colors.bgInput,
    borderRadius: Radius.sm,
    marginLeft: Spacing.md,
  },
  macrosGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
    gap: 8,
  },
  macroInputCell: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: 2,
    alignItems: 'center',
  },
  macroInputIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  macroInputCellLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
  },
  macroInputField: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extrabold,
    color: colors.textPrimary,
    textAlign: 'center',
    width: '100%',
    padding: 0,
    marginTop: -2,
  },
  macroInputUnit: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: -4,
  },
  modalHeaderCenter: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    paddingTop: Spacing.sm,
  },
  modalHeaderIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  modalSubtitle: {
    fontSize: FontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  modalHeaderCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  modalHeaderIconCompact: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitleCompact: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extrabold,
    color: colors.textPrimary,
  },
  modalSubtitleCompact: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ghostBtn: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: Radius.full,
    alignItems: 'center',
  },
  ghostBtnText: {
    color: colors.textSecondary,
    fontWeight: FontWeight.bold,
  },
});
