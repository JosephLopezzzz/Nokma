import React, {
  createContext, useContext, useEffect, useState, useCallback,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { LANGUAGE_KEY, ONBOARDING_PROGRESS_KEY } from '../services/coachMessageService';
import { mealsApi } from '../services/api';
import { clearStreakCache } from '../services/streakService';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isOnboarded: boolean;
  dailySteps: number;
  completeOnboarding: (userData: Partial<User>) => Promise<void>;
  updateUser: (updated: Partial<User>) => Promise<void>;
  resetUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const USER_STORAGE_KEY = 'coach_hoo_user_data';

const setStorageItem = async (key: string, value: string) => {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
};

const getStorageItem = async (key: string) => {
  if (Platform.OS === 'web') {
    return await AsyncStorage.getItem(key);
  } else {
    return await SecureStore.getItemAsync(key);
  }
};

const deleteStorageItem = async (key: string) => {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ─── Rehydrate local user data on launch ───────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const storedUser = await getStorageItem(USER_STORAGE_KEY);
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (e) {
        console.error('Failed to load user data:', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ─── Complete Onboarding ──────────────────────────────────────────────────
  const completeOnboarding = useCallback(async (userData: Partial<User>) => {
    const newUser: User = {
      id: Math.random().toString(36).substring(7),
      email: '', // Not used in account-less mode
      created_at: new Date().toISOString(),
      ...userData,
    } as User;

    await setStorageItem(USER_STORAGE_KEY, JSON.stringify(newUser));
    setUser(newUser);
  }, []);

  // ─── Update User Profile ───────────────────────────────────────────────────
  const updateUser = useCallback(async (updated: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const next = { ...prev, ...updated };
      setStorageItem(USER_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // ─── Reset User (e.g., for fresh start) ───────────────────────────────────
  // Also clears the saved language and any half-finished onboarding, so the
  // next run starts on the language picker instead of silently reusing the old
  // choice while showing a fresh onboarding flow.
  const resetUser = useCallback(async () => {
    await deleteStorageItem(USER_STORAGE_KEY);
    try {
      await AsyncStorage.multiRemove([LANGUAGE_KEY, ONBOARDING_PROGRESS_KEY]);
      await mealsApi.clearAll();
      clearStreakCache();
    } catch (e) {
      console.error('Failed to clear language/onboarding/meals state:', e);
    }
    setUser(null);
  }, []);

  const [dailySteps, setDailySteps] = useState(0);

  // ─── Foreground Health Sync ────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    
    // Lazy import to prevent issues on non-supported platforms
    const { getHealthSyncConfig, readHealthData } = require('../services/healthSyncService');

    const performSync = async () => {
      try {
        const config = await getHealthSyncConfig();
        if (!config.enabled || !config.permissionsGranted) return;

        const data = await readHealthData();
        setDailySteps(data.steps || 0);
        
        // Auto-update weight if it differs by more than 0.1kg
        if (data.weight && Math.abs(data.weight - (user.weight_kg || 0)) > 0.1) {
          updateUser({ weight_kg: data.weight });
        }
      } catch (e) {
        console.error('Foreground health sync failed:', e);
      }
    };

    // Sync immediately
    performSync();

    // And sync every time the app comes to foreground
    const sub = Platform.OS === 'web' ? { remove: () => {} } : require('react-native').AppState.addEventListener('change', (nextAppState: any) => {
      if (nextAppState === 'active') {
        performSync();
      }
    });

    return () => sub.remove();
  }, [user?.id]); // Only rebind if user changes, use user.id to prevent infinite loops from weight updates

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isOnboarded: !!user,
      dailySteps,
      completeOnboarding,
      updateUser,
      resetUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

