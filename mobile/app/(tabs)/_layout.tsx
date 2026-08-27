import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Pressable, Image, StyleSheet, Animated, PanResponder, Dimensions } from 'react-native';
import { useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { FontSize } from '../../constants/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused, activeColor, inactiveColor }: { name: IoniconsName; focused: boolean; activeColor: string; inactiveColor: string }) {
  return (
    <Ionicons
      name={focused ? name : (`${name}-outline` as IoniconsName)}
      size={24}
      color={focused ? activeColor : inactiveColor}
    />
  );
}

export default function TabLayout() {
  const { t } = useLanguage();
  const { colors } = useTheme();

  const pan = useRef(new Animated.ValueXY()).current;
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const BUTTON_SIZE = 60;
  const MARGIN = 16;
  const MAX_Y = screenHeight - 150; // approximate boundary above tabs
  const MIN_Y = 50; // approximate boundary below header

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only start dragging if moved significantly (prevents absorbing tap)
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (evt, gestureState) => {
        pan.flattenOffset();
        
        const currentX = (pan.x as any)._value;
        const currentY = (pan.y as any)._value;
        
        // Snap to nearest side (left or right)
        // Original position is right: 16 (which is screenWidth - BUTTON_SIZE - MARGIN)
        // If currentX is negative, it's moving left.
        const absoluteX = screenWidth - BUTTON_SIZE - MARGIN + currentX;
        
        let targetX = 0; // default back to original (right side)
        if (absoluteX < screenWidth / 2) {
          // Snap to left side: currentX needs to be -(screenWidth - BUTTON_SIZE - MARGIN * 2)
          targetX = -(screenWidth - BUTTON_SIZE - MARGIN * 2);
        }
        
        // Keep within Y bounds
        let targetY = currentY;
        if (targetY > 20) targetY = 20; // Don't go too low (below tabs)
        if (targetY < -(MAX_Y)) targetY = -(MAX_Y); // Don't go too high
        
        Animated.spring(pan, {
          toValue: { x: targetX, y: targetY },
          useNativeDriver: false,
          friction: 5,
        }).start();
      }
    })
  ).current;

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.bgCard,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: 68,
            paddingTop: 6,
            paddingBottom: 10,
          },
          tabBarActiveTintColor:   colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: { fontSize: FontSize.xs, fontWeight: '600' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: t('tab.dashboard'), tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} activeColor={colors.primary} inactiveColor={colors.textMuted} /> }}
        />
        <Tabs.Screen
          name="search"
          options={{ title: t('tab.search'), tabBarIcon: ({ focused }) => <TabIcon name="search" focused={focused} activeColor={colors.primary} inactiveColor={colors.textMuted} /> }}
        />
        <Tabs.Screen
          name="log"
          options={{
            title: t('tab.log'),
            href: null,
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{ title: 'Progress', tabBarIcon: ({ focused }) => <TabIcon name="bar-chart" focused={focused} activeColor={colors.primary} inactiveColor={colors.textMuted} /> }}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: t('tab.profile'), tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} activeColor={colors.primary} inactiveColor={colors.textMuted} /> }}
        />
      </Tabs>
      
      <Animated.View 
        style={[styles.floatingButton, { transform: pan.getTranslateTransform() }]} 
        {...panResponder.panHandlers}
      >
        <Pressable 
          style={{ width: '100%', height: '100%' }}
          onPress={() => router.push('/chat-modal')}
        >
          <Image 
            source={require('../../assets/mascot/chatbot update.png')} 
            style={styles.floatingImage} 
            resizeMode="cover" 
          />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: 90, 
    right: 16,
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  floatingImage: {
    width: '100%',
    height: '100%',
  }
});
