import React, { useRef, useState } from 'react';
import { Tabs, router } from 'expo-router';
import { View, StyleSheet, Animated, PanResponder, Dimensions, Pressable } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import FloatingTabBar from '../../components/FloatingTabBar';

export default function TabLayout() {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const [chatheadHovered, setChatheadHovered] = useState(false);
  const [chatheadPressed, setChatheadPressed] = useState(false);

  const pan = useRef(new Animated.ValueXY()).current;
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const BUTTON_SIZE = 64;
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
              router.push({ pathname: '/(tabs)/log', params: { openScanner: 'true' } });
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
        style={[styles.floatingButton, { borderColor: colors.primary, transform: pan.getTranslateTransform() }]}
        {...panResponder.panHandlers}
      >
        <Pressable
          style={[
            styles.floatingButtonPressable,
            (chatheadHovered || chatheadPressed) && { backgroundColor: '#F5EBE0' },
          ]}
          onPress={() => router.push('/chat-modal')}
          onHoverIn={() => setChatheadHovered(true)}
          onHoverOut={() => setChatheadHovered(false)}
          onFocus={() => setChatheadHovered(true)}
          onBlur={() => setChatheadHovered(false)}
          onPressIn={() => setChatheadPressed(true)}
          onPressOut={() => setChatheadPressed(false)}
          accessibilityRole="button"
          accessibilityLabel="Ask Coach Hoo"
          accessibilityHint="Opens the coaching chat."
        >
          <ExpoImage
            source={require('../../assets/mascot/chatbot-dashboard.png')}
            style={styles.floatingImage}
            contentFit="contain"
          />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: '45%', 
    right: 16,
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    padding: 2,
    backgroundColor: '#FAF6EE',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 100,
    shadowColor: '#2F3E46',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  floatingButtonPressable: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF6EE',
  },
  floatingImage: {
    width: '95%',
    height: '95%',
  }
});
