import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const LANGUAGE_PREFERENCE_KEY = 'studentPreferredLanguage';
export const SUPPORTED_LANGUAGES = [
  { code: 'EN', label: 'English' },
  { code: 'HI', label: 'Hindi' },
];

const DEFAULT_LANGUAGE = SUPPORTED_LANGUAGES[0];

const LanguageContext = createContext({
  language: DEFAULT_LANGUAGE,
  ready: false,
  supportedLanguages: SUPPORTED_LANGUAGES,
  setLanguage: async () => {},
});

const normalizeLanguage = (value) => {
  const normalized = String(value?.code || value || '').trim().toLowerCase();
  return SUPPORTED_LANGUAGES.find((item) =>
    item.code.toLowerCase() === normalized || item.label.toLowerCase() === normalized
  ) || DEFAULT_LANGUAGE;
};

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(DEFAULT_LANGUAGE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    const loadLanguage = async () => {
      try {
        const storedLanguage = await AsyncStorage.getItem(LANGUAGE_PREFERENCE_KEY);
        if (active && storedLanguage) {
          setLanguageState(normalizeLanguage(storedLanguage));
        }
      } finally {
        if (active) setReady(true);
      }
    };

    loadLanguage();

    return () => {
      active = false;
    };
  }, []);

  const setLanguage = useCallback(async (nextLanguage) => {
    const resolvedLanguage = normalizeLanguage(nextLanguage);
    setLanguageState(resolvedLanguage);
    await AsyncStorage.setItem(LANGUAGE_PREFERENCE_KEY, resolvedLanguage.code);
    return resolvedLanguage;
  }, []);

  const value = useMemo(
    () => ({
      language,
      ready,
      supportedLanguages: SUPPORTED_LANGUAGES,
      setLanguage,
    }),
    [language, ready, setLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
