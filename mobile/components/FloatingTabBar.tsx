import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
  Keyboard,
} from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { FontSize } from '../constants/theme';
import type { StringKey } from '../constants/strings';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface TabConfig {
  name: string;
  iconFocused: IoniconsName;
  iconUnfocused: IoniconsName;
  labelKey?: StringKey;
  fallbackLabel: string;
}

const TAB_CONFIG: Record<string, TabConfig> = {
  index: {
    name: 'index',
    iconFocused: 'home',
    iconUnfocused: 'home-outline',
    labelKey: 'tab.dashboard',
    fallbackLabel: 'Home',
  },
  search: {
    name: 'search',
    iconFocused: 'search',
    iconUnfocused: 'search-outline',
    labelKey: 'tab.search',
    fallbackLabel: 'Search',
  },
  log: {
    name: 'log',
    iconFocused: 'scan',
    iconUnfocused: 'scan',
    labelKey: 'tab.log',
    fallbackLabel: 'Scan',
  },
  progress: {
    name: 'progress',
    iconFocused: 'bar-chart',
    iconUnfocused: 'bar-chart-outline',
    fallbackLabel: 'Progress',
  },
  profile: {
    name: 'profile',
    iconFocused: 'person',
    iconUnfocused: 'person-outline',
    labelKey: 'tab.profile',
    fallbackLabel: 'Profile',
  },
};

function TabItem({
  route,
  isFocused,
  onPress,
  onLongPress,
  config,
  label,
  activeColor,
  inactiveColor,
}: {
  route: any;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  config: TabConfig;
  label: string;
  activeColor: string;
  inactiveColor: string;
  pillColor?: string;
}) {
  const pressScaleAnim = useRef(new Animated.Value(1)).current;
  const activeAnim = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(activeAnim, {
      toValue: isFocused ? 1 : 0,
      friction: 7,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [isFocused, activeAnim]);

  const handlePressIn = () => {
    Animated.spring(pressScaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
      speed: 50,
      bounciness: 8,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 8,
    }).start();
  };

  const iconScale = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });

  const iconTranslateY = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, -1],
  });

  const indicatorScaleX = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 1],
  });

  const iconColor = isFocused ? activeColor : inactiveColor;

  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        onPress();
      }}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabButton}
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={label}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Animated.View style={[styles.tabContent, { transform: [{ scale: pressScaleAnim }] }]}>
        <Animated.View
          style={[
            styles.iconWrap,
            {
              transform: [{ scale: iconScale }, { translateY: iconTranslateY }],
            },
          ]}
        >
          <Ionicons
            name={isFocused ? config.iconFocused : config.iconUnfocused}
            size={23}
            color={iconColor}
          />
        </Animated.View>
        <Text
          numberOfLines={1}
          style={[
            styles.tabLabel,
            {
              color: iconColor,
              fontWeight: isFocused ? '700' : '500',
            },
          ]}
        >
          {label}
        </Text>
        <Animated.View
          style={[
            styles.activeIndicator,
            {
              backgroundColor: activeColor,
              opacity: activeAnim,
              transform: [{ scaleX: indicatorScaleX }],
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

function CenterActionButton({
  onPress,
  primaryColor,
  barColor,
  barBorderColor,
}: {
  onPress: () => void;
  primaryColor: string;
  barColor: string;
  barBorderColor: string;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
      speed: 50,
      bounciness: 10,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 10,
    }).start();
  };

  return (
    <View style={styles.centerButtonWrapper} pointerEvents="box-none">
      {/* Curved notch backdrop cradle — color-matched to bar to hide seam */}
      <View
        style={[
          styles.notchCradle,
          { backgroundColor: barColor, borderColor: barBorderColor },
        ]}
      />

      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Pressable
          onPress={() => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            }
            onPress();
          }}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={[
            styles.centerFab,
            {
              backgroundColor: primaryColor,
              shadowColor: primaryColor,
              borderColor: barColor,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Scan and log meal"
        >
          <Ionicons name="scan" size={26} color="#FFFFFF" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

export default function FloatingTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();

  // ─── Themed navbar tokens (fits DESIGN.md warm system) ───
  const barColor = colors.bgCard;
  const barBorderColor = colors.border;
  const activeColor = colors.primary;
  const inactiveColor = colors.textSecondary;
  const pillColor = colors.primaryGlow;
  const barShadow = isDark
    ? {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 18,
        elevation: 12,
      }
    : {
        shadowColor: '#2F3E46',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 6,
      };

  // Keyboard avoidance animation
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const translateYAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
        Animated.timing(translateYAnim, {
          toValue: 120,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    );

    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        Animated.spring(translateYAnim, {
          toValue: 0,
          friction: 8,
          tension: 70,
          useNativeDriver: true,
        }).start();
      }
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [translateYAnim]);

  // Separate left tabs, center action, and right tabs
  const leftRoutes = state.routes.filter((r) => r.name === 'index' || r.name === 'search');
  const centerRoute = state.routes.find((r) => r.name === 'log');
  const rightRoutes = state.routes.filter((r) => r.name === 'progress' || r.name === 'profile');

  const bottomInset = Math.max(insets.bottom, 16);

  return (
    <Animated.View
      style={[
        styles.floatingContainer,
        {
          bottom: bottomInset,
          transform: [{ translateY: translateYAnim }],
        },
      ]}
      pointerEvents={isKeyboardVisible ? 'none' : 'box-none'}
    >
      <View
        style={[
          styles.pillBar,
          {
            backgroundColor: barColor,
            borderColor: barBorderColor,
            ...barShadow,
          },
        ]}
      >
        {/* Left tabs (Home, Search) */}
        <View style={styles.tabGroup}>
          {leftRoutes.map((route) => {
            const index = state.routes.findIndex((r) => r.key === route.key);
            const isFocused = state.index === index;
            const config = TAB_CONFIG[route.name] || {
              name: route.name,
              iconFocused: 'ellipse',
              iconUnfocused: 'ellipse-outline',
              fallbackLabel: route.name,
            };

            const label = config.labelKey ? t(config.labelKey) : config.fallbackLabel;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            return (
              <TabItem
                key={route.key}
                route={route}
                isFocused={isFocused}
                onPress={onPress}
                onLongPress={onLongPress}
                config={config}
                label={label}
                activeColor={activeColor}
                inactiveColor={inactiveColor}
                pillColor={pillColor}
              />
            );
          })}
        </View>

        {/* Center spacing spacer for FAB */}
        <View style={styles.centerPlaceholder} />

        {/* Right tabs (Progress, Profile) */}
        <View style={styles.tabGroup}>
          {rightRoutes.map((route) => {
            const index = state.routes.findIndex((r) => r.key === route.key);
            const isFocused = state.index === index;
            const config = TAB_CONFIG[route.name] || {
              name: route.name,
              iconFocused: 'ellipse',
              iconUnfocused: 'ellipse-outline',
              fallbackLabel: route.name,
            };

            const label = config.labelKey ? t(config.labelKey) : config.fallbackLabel;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            return (
              <TabItem
                key={route.key}
                route={route}
                isFocused={isFocused}
                onPress={onPress}
                onLongPress={onLongPress}
                config={config}
                label={label}
                activeColor={activeColor}
                inactiveColor={inactiveColor}
                pillColor={pillColor}
              />
            );
          })}
        </View>
      </View>

      {/* Elevated center action button */}
      {centerRoute && (
        <CenterActionButton
          primaryColor={colors.primary}
          barColor={barColor}
          barBorderColor={barBorderColor}
          onPress={() => {
            const event = navigation.emit({
              type: 'tabPress',
              target: centerRoute.key,
              canPreventDefault: true,
            });

            if (!event.defaultPrevented) {
              navigation.navigate(centerRoute.name, centerRoute.params);
            }
          }}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 99,
    alignItems: 'center',
  },
  pillBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    height: 66,
    borderRadius: 33,
    paddingHorizontal: 12,
    borderWidth: 1,
    // backgroundColor / borderColor / shadow are themed inline
  },
  tabGroup: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  centerPlaceholder: {
    width: 62,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: FontSize.xs || 11,
    letterSpacing: 0.1,
  },
  activeIndicator: {
    width: 14,
    height: 3,
    borderRadius: 1.5,
    marginTop: 2,
  },
  centerButtonWrapper: {
    position: 'absolute',
    top: -18,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 101,
  },
  notchCradle: {
    position: 'absolute',
    width: 66,
    height: 66,
    borderRadius: 33,
    top: -3,
    // backgroundColor / borderColor matched to bar inline to hide seam
    borderWidth: 1,
  },
  centerFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    // borderColor = barColor inline (creates clean cutout ring)
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
});
