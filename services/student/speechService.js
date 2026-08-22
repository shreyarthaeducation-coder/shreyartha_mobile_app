// services/student/speechService.js
// Mirrors: frontendmain/src/api/{speechApi,translateApi}.js — but by a different route for the
// microphone half.
//
// ── HOW MOBILE DIFFERS FROM THE WEB, AND WHY ─────────────────────────────────
// The web runs `microsoft-cognitiveservices-speech-sdk` in the browser: it takes a short-lived
// token from `/api/v1/speech/token`, opens the mic itself, and posts only the resulting scores.
// There is no React Native build of that SDK — it is built on `getUserMedia` and
// `AudioConfig.fromDefaultMicrophoneInput()`.
//
// So the app records with expo-av and posts the audio to `POST /api/v1/speech/assess`, added for
// exactly this (backendmain `.../speech/service/AzurePronunciationService.java`). The response is
// the SAME metric shape the browser produces, so the stored voice attempt is identical either way.
//
// **One behaviour is genuinely lost.** The browser streams partial results as the student speaks,
// so words colour in live. Record → upload → score cannot do that; scoring happens once, at the
// end. That is a real difference students will notice, not just an implementation detail.

import * as FileSystem from 'expo-file-system/legacy';
import { studentApi } from '../studentApi';

/* ── THE TWO ENDPOINTS TAKE DIFFERENT LANGUAGE CONVENTIONS ──────────────────
   This is the bug that made Sound Studio and every Learn with Shreya line silent, so it is spelled
   out rather than left to be rediscovered:

     POST /api/v1/translate/tts      wants "en"     — our own SupportedLanguage enum, which holds
                                                      only two-letter codes (en, hi, bn, ta, …).
                                                      `validateLanguage()` 400s on anything else.
     POST /api/v1/speech/assess      wants "en-US"  — forwarded verbatim to Azure, which wants BCP-47.

   Passing "en-US" to TTS returns 400 UNSUPPORTED_LANGUAGE. Passing "en" to Azure is not a locale.
   **Do not "tidy" these into one constant** — they are two different vocabularies that happen to
   describe the same language. */

/** The TTS language. Must be a code `SupportedLanguage.java` actually contains — NOT a BCP-47 tag. */
export const TTS_LANGUAGE = 'en';

/** The Azure assessment locale. BCP-47, and deliberately not the same value as TTS_LANGUAGE. */
export const ASSESS_LANGUAGE = 'en-US';

/* ── Pronunciation assessment ──────────────────────────────────────────── */

/**
 * Score a recording against a reference text.
 *
 * @param {{uri: string, name?: string, type?: string}} recording from useVoiceRecorder
 * @param {string} referenceText  what the student was asked to say. Pass '' for free speech —
 *        Azure then returns a transcript without meaningful accuracy/completeness.
 * @returns {Promise<{recognizedText, overallScore, accuracyScore, fluencyScore,
 *          completenessScore, prosodyScore, wordsJson}>}
 */
export function assessPronunciation(recording, referenceText, language = ASSESS_LANGUAGE) {
  return studentApi.multipart(
    '/api/v1/speech/assess',
    {
      fields: { referenceText: referenceText || '' },
      files: {
        audio: {
          uri: recording.uri,
          // The server forwards this Content-Type to Azure verbatim, so it has to describe the
          // file honestly — a wrong type is rejected by Azure, not by us.
          type: recording.type || 'audio/m4a',
          name: recording.name || 'recording.m4a',
        },
      },
    },
    { params: { language } },
  );
}

/* ── Voice attempts (unchanged from the web) ───────────────────────────── */

export function saveVoiceAttempt(payload) {
  return studentApi.post('/api/students/voice-attempts/languagepro', payload);
}

export async function fetchVoiceAttempts(topicId, signal) {
  const res = await studentApi.get(`/api/students/voice-attempts/languagepro/${topicId}`, { signal });
  return Array.isArray(res) ? res : [];
}

/* ── Text to speech — Shreya's voice ───────────────────────────────────────
   This half needed no backend change: the web already goes through our own TTS endpoint rather
   than Azure, and returns base64 audio.

   `new Audio(url)` on the web becomes: decode the base64 to a CACHE FILE and play that. expo-av on
   Android is unreliable with large `data:` URIs, and a TTS sentence easily exceeds the size where
   that starts to matter — so the file path is the dependable one, not an optimisation. */

const TTS_DIR = `${FileSystem.cacheDirectory}shreya-tts/`;

async function ensureTtsDir() {
  const info = await FileSystem.getInfoAsync(TTS_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(TTS_DIR, { intermediates: true });
}

/** Filenames must be filesystem-safe and stable, so the same line is only synthesised once. */
const cacheKey = (text, language, gender) => {
  let hash = 0;
  const seed = `${language}|${gender}|${text}`;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return `tts-${Math.abs(hash)}`;
};

/**
 * Synthesise a line and return a local file URI ready for `expo-av`.
 *
 * Cached on disk: Shreya repeats prompts across a chapter, and re-synthesising each time costs a
 * round trip and a Google TTS call for audio the device already has.
 */
export async function synthesizeToFile(text, { language = TTS_LANGUAGE, gender = 'female' } = {}) {
  if (!text || !text.trim()) return null;
  await ensureTtsDir();

  const res = await studentApi.post('/api/v1/translate/tts', { text, language, gender });
  if (!res?.audioContent) throw new Error('The voice service returned no audio.');

  // `audioFormat` is a container name ("MP3"), not an extension — lowercase it and default sanely.
  const ext = String(res.audioFormat || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp3';
  const uri = `${TTS_DIR}${cacheKey(text, language, gender)}.${ext}`;

  const existing = await FileSystem.getInfoAsync(uri);
  if (!existing.exists) {
    await FileSystem.writeAsStringAsync(uri, res.audioContent, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }
  return uri;
}

/** Drop the TTS cache — worth calling on logout so one student's audio is not left on disk. */
export async function clearTtsCache() {
  try {
    await FileSystem.deleteAsync(TTS_DIR, { idempotent: true });
  } catch {
    // A cache that will not delete is not worth failing anything over.
  }
}
