import { getDb } from './db';
import * as Network from 'expo-network';

export type SyncTaskType = 'scan_nutrition_label';

export interface SyncTask {
  id: string;
  type: SyncTaskType;
  payload: string; // JSON string
  created_at: string;
}

export const enqueueTask = (type: SyncTaskType, payload: any) => {
  const db = getDb();
  if (!db) {
    console.warn('DB not initialized. Cannot enqueue task.');
    return;
  }
  
  const id = 'sync_' + Date.now() + '_' + Math.random().toString(36).substring(7);
  const now = new Date().toISOString();
  
  try {
    db.runSync(
      `INSERT INTO sync_queue (id, type, payload, created_at) VALUES (?, ?, ?, ?)`,
      [id, type, JSON.stringify(payload), now]
    );
    console.log(`Task ${id} of type ${type} enqueued successfully.`);
  } catch (err) {
    console.error('Failed to enqueue task:', err);
  }
};

export const getPendingTasks = (): SyncTask[] => {
  const db = getDb();
  if (!db) return [];
  
  try {
    return db.getAllSync<SyncTask>(`SELECT * FROM sync_queue ORDER BY created_at ASC`);
  } catch (err) {
    console.error('Failed to fetch pending tasks:', err);
    return [];
  }
};

export const removeTask = (id: string) => {
  const db = getDb();
  if (!db) return;
  
  try {
    db.runSync(`DELETE FROM sync_queue WHERE id = ?`, [id]);
  } catch (err) {
    console.error('Failed to remove task:', err);
  }
};

export const isOnline = async (): Promise<boolean> => {
  try {
    const state = await Network.getNetworkStateAsync();
    return !!state.isConnected && !!state.isInternetReachable;
  } catch {
    return false;
  }
};

export const processSyncQueue = async (onTaskComplete?: (type: SyncTaskType, result: any) => void) => {
  const online = await isOnline();
  if (!online) return;

  const tasks = getPendingTasks();
  if (tasks.length === 0) return;

  console.log(`Processing ${tasks.length} pending sync tasks...`);

  for (const task of tasks) {
    try {
      if (task.type === 'scan_nutrition_label') {
        console.log('Skipping offline scan_nutrition_label task - requires streaming UI now.');
      }
      
      // Mark as done
      removeTask(task.id);
    } catch (err) {
      console.error(`Failed to process task ${task.id}:`, err);
      // We do not remove it, it will retry next time
    }
  }
};

export const initNetworkSyncListener = (onTaskComplete?: (type: SyncTaskType, result: any) => void) => {
  try {
    const NetInfo = require('@react-native-community/netinfo');
    let wasOnline = false;
    return NetInfo.addEventListener((state: any) => {
      const isOnlineNow = !!(state.isConnected && state.isInternetReachable);
      
      if (isOnlineNow && !wasOnline) {
        console.log('[SyncService] Network online, processing sync queue...');
        processSyncQueue(onTaskComplete);
      }
      
      wasOnline = isOnlineNow;
    });
  } catch (err) {
    console.warn('[SyncService] NetInfo listener setup skipped:', err);
    return () => {};
  }
};

