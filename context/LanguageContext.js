import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/apiService';

export const LANGUAGE_PREFERENCE_KEY = 'studentPreferredLanguage';
const SUPPORTED_LANGUAGES_CACHE_KEY = 'studentSupportedLanguagesCache';
const TRANSLATION_CACHE_KEY = 'studentTranslationCacheV1';
const SUPPORTED_LANGUAGES_TTL_MS = 24 * 60 * 60 * 1000;
const TRANSLATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// All 22 constitutionally scheduled Indian languages + English
// Mirrors backendmain SupportedLanguage.java and frontendmain constants.js
export const FALLBACK_LANGUAGES = [
  { code: 'en',       nativeName: 'English',        englishName: 'English' },
  { code: 'as',       nativeName: 'অসমীয়া',         englishName: 'Assamese' },
  { code: 'bn',       nativeName: 'বাংলা',           englishName: 'Bengali' },
  { code: 'brx',      nativeName: "बर'",            englishName: 'Bodo' },
  { code: 'doi',      nativeName: 'डोगरी',           englishName: 'Dogri' },
  { code: 'gu',       nativeName: 'ગુજરાતી',          englishName: 'Gujarati' },
  { code: 'hi',       nativeName: 'हिन्दी',           englishName: 'Hindi' },
  { code: 'kn',       nativeName: 'ಕನ್ನಡ',           englishName: 'Kannada' },
  { code: 'ks',       nativeName: 'کاشُر',           englishName: 'Kashmiri' },
  { code: 'gom',      nativeName: 'कोंकणी',          englishName: 'Konkani' },
  { code: 'mai',      nativeName: 'मैथिली',          englishName: 'Maithili' },
  { code: 'ml',       nativeName: 'മലയാളം',          englishName: 'Malayalam' },
  { code: 'mni-Mtei', nativeName: 'মৈতৈলোন্',        englishName: 'Meitei (Manipuri)' },
  { code: 'mr',       nativeName: 'मराठी',           englishName: 'Marathi' },
  { code: 'ne',       nativeName: 'नेपाली',          englishName: 'Nepali' },
  { code: 'or',       nativeName: 'ଓଡ଼ିଆ',           englishName: 'Odia' },
  { code: 'pa',       nativeName: 'ਪੰਜਾਬੀ',          englishName: 'Punjabi' },
  { code: 'sa',       nativeName: 'संस्कृतम्',        englishName: 'Sanskrit' },
  { code: 'sat',      nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ',         englishName: 'Santali' },
  { code: 'sd',       nativeName: 'سنڌي',            englishName: 'Sindhi' },
  { code: 'ta',       nativeName: 'தமிழ்',           englishName: 'Tamil' },
  { code: 'te',       nativeName: 'తెలుగు',          englishName: 'Telugu' },
  { code: 'ur',       nativeName: 'اردو',            englishName: 'Urdu' },
];

const DEFAULT_LANGUAGE = FALLBACK_LANGUAGES[0];
const RTL_LANGUAGES = ['ks', 'sd', 'ur'];

const LanguageContext = createContext(null);

// ─── In-memory translation cache (warm from AsyncStorage on start) ───────────
const _memCache = {};

function _getCached(text, langCode) {
  return _memCache[`${text}\x00${langCode}`] ?? null;
}

function _putCached(text, langCode, translated) {
  const key = `${text}\x00${langCode}`;
  _memCache[key] = translated;
  // Persist to AsyncStorage in the background — non-blocking
  AsyncStorage.getItem(TRANSLATION_CACHE_KEY)
    .then(raw => {
      const store = raw ? JSON.parse(raw) : {};
      const now = Date.now();
      // Prune expired entries first
      for (const k of Object.keys(store)) {
        if (store[k].expiresAt < now) delete store[k];
      }
      store[key] = { value: translated, expiresAt: now + TRANSLATION_CACHE_TTL_MS };
      return AsyncStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(store));
    })
    .catch(() => {});
}

async function _warmMemCache() {
  try {
    const raw = await AsyncStorage.getItem(TRANSLATION_CACHE_KEY);
    if (!raw) return;
    const store = JSON.parse(raw);
    const now = Date.now();
    for (const [key, entry] of Object.entries(store)) {
      if (entry.expiresAt > now) _memCache[key] = entry.value;
    }
  } catch { /* ignore */ }
}

// Warm the in-memory cache once on module load
_warmMemCache();

// ─── Language entry normalizer ────────────────────────────────────────────────
function _normalizeEntry(lang) {
  if (!lang?.code) return null;
  const fb = FALLBACK_LANGUAGES.find(l => l.code === lang.code);
  return {
    code: lang.code,
    nativeName: lang.nativeName ?? lang.native ?? fb?.nativeName ?? lang.code,
    englishName: lang.englishName ?? lang.name ?? fb?.englishName ?? lang.code,
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function LanguageProvider({ children }) {
  const [currentLanguage, setCurrentLanguage] = useState(DEFAULT_LANGUAGE);
  const [supportedLanguages, setSupportedLanguages] = useState(FALLBACK_LANGUAGES);
  const [ready, setReady] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  // Restore persisted language and cached language list
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [storedCode, cachedRaw] = await Promise.all([
          AsyncStorage.getItem(LANGUAGE_PREFERENCE_KEY),
          AsyncStorage.getItem(SUPPORTED_LANGUAGES_CACHE_KEY),
        ]);
        if (!active) return;

        if (storedCode) {
          const lower = storedCode.toLowerCase().replace(/^en$/, 'en');
          const found = FALLBACK_LANGUAGES.find(l => l.code === lower)
            ?? FALLBACK_LANGUAGES.find(l => l.englishName.toLowerCase() === lower);
          if (found) setCurrentLanguage(found);
        }

        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (cached?.expiresAt > Date.now() && Array.isArray(cached.langs)) {
            setSupportedLanguages(cached.langs);
          }
        }
      } catch { /* ignore */ } finally {
        if (active) setReady(true);
      }
    })();
    return () => { active = false; };
  }, []);

  // Fetch live language list from backend (public endpoint, no auth required)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await api.get('/api/v1/translate/languages');
        if (!active || !Array.isArray(data) || !data.length) return;
        const normalized = data.map(_normalizeEntry).filter(Boolean);
        const list = [
          { code: 'en', nativeName: 'English', englishName: 'English' },
          ...normalized.filter(l => l.code !== 'en'),
        ];
        setSupportedLanguages(list);
        await AsyncStorage.setItem(SUPPORTED_LANGUAGES_CACHE_KEY, JSON.stringify({
          langs: list,
          expiresAt: Date.now() + SUPPORTED_LANGUAGES_TTL_MS,
        }));
      } catch { /* silently keep fallback */ }
    })();
    return () => { active = false; };
  }, []);

  const setLanguage = useCallback(async (nextLang) => {
    const code = typeof nextLang === 'string' ? nextLang : nextLang?.code;
    const found = FALLBACK_LANGUAGES.find(l => l.code === code) ?? DEFAULT_LANGUAGE;
    setCurrentLanguage(found);
    try {
      await AsyncStorage.setItem(LANGUAGE_PREFERENCE_KEY, found.code);
    } catch { /* ignore */ }
    return found;
  }, []);

  /**
   * Translate an array of English strings to targetCode.
   * Returns the same array with translated strings in-place.
   * Falls back to original text on error or if language is English.
   */
  const translateBatch = useCallback(async (texts, targetCode) => {
    if (!Array.isArray(texts) || !texts.length || targetCode === 'en') {
      return texts;
    }

    const results = [...texts];
    const uncachedTexts = [];
    const uncachedIdxs = [];

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      if (!text || typeof text !== 'string' || !text.trim()) continue;
      const cached = _getCached(text, targetCode);
      if (cached !== null) {
        results[i] = cached;
      } else {
        uncachedTexts.push(text);
        uncachedIdxs.push(i);
      }
    }

    if (!uncachedTexts.length) return results;

    setIsTranslating(true);
    try {
      const response = await api.post('/api/v1/translate/batch', {
        texts: uncachedTexts,
        sourceLanguage: 'en',
        targetLanguage: targetCode,
      });
      const translated = Array.isArray(response?.translatedTexts)
        ? response.translatedTexts
        : [];
      for (let i = 0; i < uncachedTexts.length; i++) {
        const t = translated[i] || uncachedTexts[i];
        results[uncachedIdxs[i]] = t;
        _putCached(uncachedTexts[i], targetCode, t);
      }
    } catch { /* return originals on API error */ } finally {
      setIsTranslating(false);
    }

    return results;
  }, []);

  const value = useMemo(() => ({
    language: currentLanguage,
    supportedLanguages,
    ready,
    isTranslating,
    setLanguage,
    translateBatch,
    // Legacy compat — some screens use language.code in uppercase format
    // Return code as-is (lowercase 'hi', 'bn') — callers must update
  }), [currentLanguage, supportedLanguages, ready, isTranslating, setLanguage, translateBatch]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
