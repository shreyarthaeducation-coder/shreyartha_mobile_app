import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY_PREFIX = '@shreyartha_cache_';

export const cacheService = {
  set: async (key, data, ttlMs = 5 * 60 * 1000) => {
    try {
      const entry = {
        data,
        expiresAt: Date.now() + ttlMs,
      };
      await AsyncStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify(entry));
    } catch (e) {
      console.warn('Cache set failed:', e);
    }
  },

  get: async (key) => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY_PREFIX + key);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (Date.now() > entry.expiresAt) {
        await AsyncStorage.removeItem(CACHE_KEY_PREFIX + key);
        return null;
      }
      return entry.data;
    } catch (e) {
      console.warn('Cache get failed:', e);
      return null;
    }
  },

  clear: async (key) => {
    try {
      await AsyncStorage.removeItem(CACHE_KEY_PREFIX + key);
    } catch (e) {
      console.warn('Cache clear failed:', e);
    }
  },

  clearAll: async () => {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter((k) => k.startsWith(CACHE_KEY_PREFIX));
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
      }
    } catch (e) {
      console.warn('Cache clearAll failed:', e);
    }
  },
};
