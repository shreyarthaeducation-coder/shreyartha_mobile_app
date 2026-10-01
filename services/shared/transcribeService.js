// services/shared/transcribeService.js
//
// A spoken question to Shreya, as text — POST /api/v1/speech/transcribe
// (backend: speech/controller/SpeechTranscriptionController.java).
//
// ── WHY NOT speechService.assessPronunciation ────────────────────────────────
// That goes to /assess: student-only, sent through studentApi (which reads only student tokens and
// signs the user out on a 401), and backed by Azure's short-audio endpoint, which refuses the AMR-WB
// Android records. /transcribe admits the student roles plus PARENT, TEACHER and PARTNER, and uses
// Azure fast transcription, which takes AMR, WAV, AAC and friends. The neutral ttsClient carries
// whichever portal token is signed in and never tears a session down.
//
// Lives in its OWN module, not in services/student/speechService.js: checkspeech.mjs evaluates that
// file with exactly two imports stubbed, and a third would break its baseline load.
//
// The LANGUAGE sent is the platform code ("hi", "ta", "en") — the server maps it to an Azure locale
// and falls back to English for languages Azure cannot hear. See speech/service/SpeechLocales.java.

import ttsClient from './ttsClient';

/**
 * @param {{ uri: string, type?: string, name?: string }} recording — from useVoiceRecorder
 * @param {string} languageCode — a platform code, e.g. from utils/languageCode.languageCodeOf
 * @returns {Promise<{ text: string, locale: string }>} `text` is "" when nothing was heard
 */
export async function transcribeSpeech(recording, languageCode) {
  const res = await ttsClient.multipart('/api/v1/speech/transcribe', {
    fields: { language: languageCode || 'en' },
    files: {
      audio: {
        uri: recording.uri,
        type: recording.type || 'audio/m4a',
        name: recording.name || 'question.m4a',
      },
    },
  });
  return { text: String(res?.text || '').trim(), locale: res?.locale || '' };
}
