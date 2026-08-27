import { Stack, router } from 'expo-router';
import { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { MealProvider } from '../context/MealContext';
import { LanguageProvider } from '../context/LanguageContext';
import { ToastProvider } from '../context/ToastContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { Colors as DefaultColors, ThemeColors } from '../constants/theme';
import { initDb } from '../services/db';
import NetInfo from '@react-native-community/netinfo';
import { processSyncQueue } from '../services/syncService';

function RootLayoutNav() {
  const { isOnboarded, isLoading } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);

  useEffect(() => {
    initDb(); // Initialize SQLite DB and handle migration
    
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable) {
        processSyncQueue((type, result) => {
          console.log('Background sync processed:', type, result);
        });
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (isOnboarded) {
      router.replace('/(tabs)');
    } else {
      router.replace('/(onboarding)');
    }
  }, [isOnboarded, isLoading]);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.bg} />
      <View style={styles.webGutter}>
        <View style={styles.appContainer}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="(onboarding)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="chat-modal" options={{ presentation: 'transparentModal', animation: 'fade' }} />
          </Stack>
        </View>
      </View>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LanguageProvider>
          <ToastProvider>
            <MealProvider>
              <RootLayoutNav />
            </MealProvider>
          </ToastProvider>
        </LanguageProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  webGutter: {
    flex: 1,
    backgroundColor: Platform.OS === 'web' ? (colors.bg === '#121212' ? '#000000' : '#EBECEE') : colors.bg,
  },
  appContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    backgroundColor: colors.bg,
    ...(Platform.OS === 'web'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.1,
          shadowRadius: 30,
          overflow: 'hidden',
        }
      : {}),
  },
});
