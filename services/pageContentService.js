import { api } from './apiService';
import { cacheService } from './cacheService';
import { PAGE_DATA } from '../constants/pageData';

const PAGE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const pageContentService = {
  getPageContent: async (slug) => {
    const cacheKey = `page_${slug}`;

    // Return cached data if still fresh
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    // Attempt API fetch
    try {
      const data = await api.get(`/api/pages/${slug}`);
      if (data) {
        await cacheService.set(cacheKey, data, PAGE_CACHE_TTL_MS);
        return data;
      }
    } catch {
      // Fall through to static fallback
    }

    // Static fallback
    const staticData = PAGE_DATA[slug] || null;
    if (staticData) {
      await cacheService.set(cacheKey, staticData, PAGE_CACHE_TTL_MS);
    }
    return staticData;
  },
};
