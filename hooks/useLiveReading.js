import { useCallback, useEffect, useRef, useState } from 'react';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

/**
 * Live reading on the phone (1 Nov 2026) — the Speaking Challenge's word-by-word marking.
 *
 * The website marks words live with Azure's browser SDK, which has no React Native build. Here the
 * phone's own recogniser (iOS Speech / Android SpeechRecognizer, through expo-speech-recognition)
 * gives what has been heard so far, as it is said: `heardText`, every finished phrase plus the one
 * in progress. The same recording is kept as a 16 kHz WAV (`audioUri`, ready once status is
 * 'done') so the screen can send it to `/api/v1/speech/assess` for Azure's pronunciation scores.
 *
 * status: idle | starting | listening | done | denied | unavailable | error
 */
export default function useLiveReading() {
  const [status, setStatus] = useState('idle');
  const [heardText, setHeardText] = useState('');
  const [audioUri, setAudioUri] = useState(null);
  const [error, setError] = useState('');
  const committed = useRef('');
  const active = useRef(false);

  useSpeechRecognitionEvent('start', () => {
    if (active.current) setStatus('listening');
  });

  useSpeechRecognitionEvent('result', (event) => {
    if (!active.current) return;
    const text = (event.results && event.results[0] && event.results[0].transcript) || '';
    if (event.isFinal) {
      committed.current = `${committed.current} ${text}`.trim();
      setHeardText(committed.current);
    } else {
      setHeardText(`${committed.current} ${text}`.trim());
    }
  });

  useSpeechRecognitionEvent('audioend', (event) => {
    if (event && event.uri) setAudioUri(event.uri);
  });

  useSpeechRecognitionEvent('end', () => {
    if (!active.current) return;
    active.current = false;
    setStatus((s) => (s === 'error' || s === 'denied' ? s : 'done'));
  });

  useSpeechRecognitionEvent('error', (event) => {
    // "no-speech" after a pause is not a failure: what was heard stands.
    if (event && (event.error === 'no-speech' || event.error === 'aborted')) return;
    setError(event && event.message ? event.message : 'Listening stopped. Please try again.');
    setStatus('error');
  });

  /** Starts listening for `line`; its words help the recogniser expect them. */
  const start = useCallback(async (line) => {
    setError('');
    setHeardText('');
    setAudioUri(null);
    committed.current = '';
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      setStatus('unavailable');
      return;
    }
    setStatus('starting');
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setStatus('denied');
      return;
    }
    active.current = true;
    ExpoSpeechRecognitionModule.start({
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
    if (active.current) ExpoSpeechRecognitionModule.stop();
  }, []);

  const reset = useCallback(() => {
    if (active.current) ExpoSpeechRecognitionModule.abort();
    active.current = false;
    committed.current = '';
    setHeardText('');
    setAudioUri(null);
    setError('');
    setStatus('idle');
  }, []);

  useEffect(
    () => () => {
      if (active.current) ExpoSpeechRecognitionModule.abort();
    },
    [],
  );

  return { status, heardText, audioUri, error, start, stop, reset };
}
