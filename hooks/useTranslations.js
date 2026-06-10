import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

/**
 * Translates a static map of English UI strings into the current app language.
 *
 * Usage:
 *   const STRINGS = { title: 'Hello', subtitle: 'Welcome back' };
 *   // Define STRINGS outside the component (stable reference)
 *
 *   function MyScreen() {
 *     const t = useTranslations(STRINGS);
 *     return <Text>{t.title}</Text>;  // translated
 *   }
 *
 * - When language is English the original strings are returned immediately.
 * - Translations are batched in a single API call and cached (24 h) so
 *   repeated language switches don't hit the network twice.
 * - Shows original English text while the API call is in-flight.
 */
export function useTranslations(stringsObj) {
  const { language, translateBatch } = useLanguage();
  const langCode = language.code;

  // Keep a stable reference to the English originals (first render wins)
  const baseRef = useRef(stringsObj);

  const [translated, setTranslated] = useState(stringsObj);

  useEffect(() => {
    let cancelled = false;
    const base = baseRef.current;

    if (langCode === 'en') {
      setTranslated(base);
      return;
    }

    const keys = Object.keys(base);
    const values = keys.map(k => base[k]);

    translateBatch(values, langCode).then(results => {
      if (cancelled) return;
      const out = {};
      keys.forEach((k, i) => { out[k] = results[i] ?? base[k]; });
      setTranslated(out);
    });

    return () => { cancelled = true; };
  }, [langCode, translateBatch]);

  return translated;
}
