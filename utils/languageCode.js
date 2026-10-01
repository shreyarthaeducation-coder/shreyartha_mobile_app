/**
 * The language CODE ("hi", "bn", "en"), whatever shape the language arrives in.
 *
 * `useLanguage().language` is an OBJECT — `{ code, nativeName, englishName }` (see
 * context/LanguageContext.js) — but everything on the network takes the code: `/api/v1/translate/tts`
 * binds it to `TTSRequest.language`, a String, so sending the object is a 400 in EVERY language,
 * English included, and `/translate/batch` quietly falls back to English. Read-aloud shipped exactly
 * that way on 24 Sep 2026 and nothing reported it. Anything that hands a language to the network
 * goes through here.
 *
 * Import-free on purpose: scripts/checkspeech.mjs evaluates it directly.
 */
export function languageCodeOf(language) {
  const raw = typeof language === 'string' ? language : language?.code;
  const code = typeof raw === 'string' ? raw.trim() : '';
  return code || 'en';
}
