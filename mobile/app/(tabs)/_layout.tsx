import React, { useRef } from 'react';
import { Tabs, router } from 'expo-router';
import { View, Image, StyleSheet, Animated, PanResponder, Dimensions } from 'react-native';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import AnimatedPressable from '../../components/AnimatedPressable';
import FloatingTabBar from '../../components/FloatingTabBar';

export default function TabLayout() {
  const { t } = useLanguage();
  const { colors } = useTheme();

  const pan = useRef(new Animated.ValueXY()).current;
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const BUTTON_SIZE = 60;
  const MARGIN = 16;
  const MAX_Y = screenHeight - 160; // approximate boundary above floating tabs
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
        const absoluteX = screenWidth - BUTTON_SIZE - MARGIN + currentX;
        
        let targetX = 0; // default back to original (right side)
        if (absoluteX < screenWidth / 2) {
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
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: t('tab.dashboard') }}
        />
        <Tabs.Screen
          name="search"
          options={{ title: t('tab.search') }}
        />
        <Tabs.Screen
          name="log"
          options={{
            title: t('tab.log'),
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              router.push({ pathname: '/log', params: { openScanner: 'true' } });
            },
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{ title: 'Progress' }}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: t('tab.profile') }}
        />
      </Tabs>
      
      <Animated.View 
        style={[styles.floatingButton, { transform: pan.getTranslateTransform() }]} 
        {...panResponder.panHandlers}
      >
        <AnimatedPressable 
          style={{ width: '100%', height: '100%' }}
          onPress={() => router.push('/chat-modal')}
          scaleTo={0.9}
        >
          <Image 
            source={require('../../assets/mascot/chatbot update.png')} 
            style={styles.floatingImage} 
            resizeMode="cover" 
          />
        </AnimatedPressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: '45%', 
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
