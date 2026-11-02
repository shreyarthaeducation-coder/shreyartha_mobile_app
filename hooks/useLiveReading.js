import { useCallback, useEffect, useRef, useState } from 'react';
import { requireOptionalNativeModule } from 'expo';

/**
 * Live reading on the phone (1 Nov 2026) — the Speaking Challenge's word-by-word marking.
 *
 * The website marks words live with Azure's browser SDK, which has no React Native build. Here the
 * phone's own recogniser (iOS Speech / Android SpeechRecognizer, through expo-speech-recognition)
 * gives what has been heard so far, as it is said: `heardText`, every finished phrase plus the one
 * in progress. The same recording is kept as a 16 kHz WAV (`audioUri`, ready once status is
 * 'done') so the screen can send it to `/api/v1/speech/assess` for Azure's pronunciation scores.
 *
 * ── NEVER IMPORT expo-speech-recognition AT THE TOP OF A FILE (2 Nov 2026) ──────────────────────
 * The package calls `requireNativeModule` the moment it is imported, which THROWS in any build
 * without its native half — Expo Go, or an installed app built before it was added. Imported at the
 * top, it took Learn with Shreya down with "Cannot find native module 'ExpoSpeechRecognition'"
 * before a single screen drew (and Metro reports a module-factory throw even inside try/catch). So
 * the native module is looked up with `requireOptionalNativeModule`, which returns null instead of
 * throwing, and the package is required only when that says it is there. Without it the status is
 * 'needs-update' and the rest of the challenge (Hear it, Words, Meaning) works as usual.
 *
 * status: idle | starting | listening | done | denied | unavailable | needs-update | error
 */
let speechModuleCache;
function speechModule() {
  if (speechModuleCache === undefined) {
    speechModuleCache = requireOptionalNativeModule('ExpoSpeechRecognition')
      ? // eslint-disable-next-line global-require
        require('expo-speech-recognition').ExpoSpeechRecognitionModule
      : null;
  }
  return speechModuleCache;
}

/** Whether this build of the app can listen at all. */
export const liveReadingSupported = () => speechModule() !== null;

export default function useLiveReading() {
  const [status, setStatus] = useState(() => (speechModule() ? 'idle' : 'needs-update'));
  const [heardText, setHeardText] = useState('');
  const [audioUri, setAudioUri] = useState(null);
  const [error, setError] = useState('');
  const committed = useRef('');
  const active = useRef(false);

  useEffect(() => {
    const speech = speechModule();
    if (!speech) return undefined;
    const subscriptions = [
      speech.addListener('start', () => {
        if (active.current) setStatus('listening');
      }),
      speech.addListener('result', (event) => {
        if (!active.current) return;
        const text = (event.results && event.results[0] && event.results[0].transcript) || '';
        if (event.isFinal) {
          committed.current = `${committed.current} ${text}`.trim();
          setHeardText(committed.current);
        } else {
          setHeardText(`${committed.current} ${text}`.trim());
        }
      }),
      speech.addListener('audioend', (event) => {
        if (event && event.uri) setAudioUri(event.uri);
      }),
      speech.addListener('end', () => {
        if (!active.current) return;
        active.current = false;
        setStatus((s) => (s === 'error' || s === 'denied' ? s : 'done'));
      }),
      speech.addListener('error', (event) => {
        // "no-speech" after a pause is not a failure: what was heard stands.
        if (event && (event.error === 'no-speech' || event.error === 'aborted')) return;
        setError(event && event.message ? event.message : 'Listening stopped. Please try again.');
        setStatus('error');
      }),
    ];
    return () => {
      subscriptions.forEach((s) => s.remove());
      if (active.current) speech.abort();
    };
  }, []);

  /** Starts listening for `line`; its words help the recogniser expect them. */
  const start = useCallback(async (line) => {
    const speech = speechModule();
    setError('');
    setHeardText('');
    setAudioUri(null);
    committed.current = '';
    if (!speech) {
      setStatus('needs-update');
      return;
    }
    if (!speech.isRecognitionAvailable()) {
      setStatus('unavailable');
      return;
    }
    setStatus('starting');
    const permission = await speech.requestPermissionsAsync();
    if (!permission.granted) {
      setStatus('denied');
      return;
    }
    active.current = true;
    speech.start({
      lang: 'en-IN',
      interimResults: true,
      continuous: true,
      addsPunctuation: false,
      contextualStrings: String(line || '')
        .split(/\s+/)
        .map((w) => w.replace(/[^A-Za-z']/g, ''))
        .filter((w) => w.length > 2),
      recordingOptions: { persist: true, outputSampleRate: 16000, outputEncoding: 'pcmFormatInt16' },
    });
  }, []);

  /** Stops listening; what was heard stands, and the recording is finished. */
  const stop = useCallback(() => {
    const speech = speechModule();
    if (speech && active.current) speech.stop();
  }, []);

  const reset = useCallback(() => {
    const speech = speechModule();
    if (speech && active.current) speech.abort();
    active.current = false;
    committed.current = '';
    setHeardText('');
    setAudioUri(null);
    setError('');
    setStatus(speech ? 'idle' : 'needs-update');
  }, []);

  return { status, heardText, audioUri, error, start, stop, reset };
}
