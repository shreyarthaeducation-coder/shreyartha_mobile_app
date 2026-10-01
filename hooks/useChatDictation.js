import { useCallback, useEffect, useRef, useState } from 'react';
import useVoiceRecorder from './useVoiceRecorder';
import { transcribeSpeech } from '../services/shared/transcribeService';

/** A spoken question is a sentence or two; the mic stops itself after this. */
export const DICTATION_MAX_SECONDS = 30;

/**
 * Speak a question to Shreya: record → /api/v1/speech/transcribe → text.
 *
 * Built on useVoiceRecorder (the module-level mic lock, the permission prompt, AMR-WB on Android and
 * WAV on iOS), which gets three things wrong for THIS use, each handled here:
 *
 *   - its elapsed time does not tick — expo-audio's status carries no duration while recording and
 *     Android reports only when it finishes — so "Listening… 0:07" runs off a JS clock;
 *   - its auto-stop at `maxSeconds` leaves the take ONLY in `lastRecording` (a later `stop()` finds
 *     nothing and returns null), so transcription is driven from `lastRecording`, however the
 *     recording ended;
 *   - a manual stop ALSO sets `lastRecording`, so each take object is transcribed once
 *     (`handledRef`), and an epoch drops answers that arrive after a cancel, a new take or unmount.
 */
export default function useChatDictation({ languageCode = 'en', onTranscript } = {}) {
  const recorder = useVoiceRecorder({ maxSeconds: DICTATION_MAX_SECONDS });
  const { recording, lastRecording, start: startRecording, stop: stopRecording, cancel: cancelRecording } =
    recorder;

  const [elapsed, setElapsed] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState('');

  const epochRef = useRef(0);
  const handledRef = useRef(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  useEffect(
    () => () => {
      epochRef.current += 1; // unmounted: whatever is in flight is no longer anyone's answer
    },
    [],
  );

  // The JS clock (see the header).
  useEffect(() => {
    if (!recording) return undefined;
    setElapsed(0);
    const startedAt = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 500);
    return () => clearInterval(id);
  }, [recording]);

  // Each finished take, transcribed exactly once.
  useEffect(() => {
    const take = lastRecording;
    if (!take || handledRef.current === take) return;
    handledRef.current = take;
    const epoch = epochRef.current;
    setTranscribing(true);
    setError('');
    transcribeSpeech(take, languageCode)
      .then(({ text }) => {
        if (epochRef.current !== epoch) return;
        if (text) onTranscriptRef.current?.(text);
        else setError("I didn't catch that — tap the mic and try again.");
      })
      .catch((e) => {
        if (epochRef.current !== epoch) return;
        setError(e?.message || 'Could not turn that into text. Please try again.');
      })
      .finally(() => {
        if (epochRef.current === epoch) setTranscribing(false);
      });
  }, [lastRecording, languageCode]);

  const start = useCallback(async () => {
    epochRef.current += 1;
    setError('');
    setTranscribing(false);
    return startRecording();
  }, [startRecording]);

  // The take reaches `lastRecording` whichever way the recording ends; the effect above sends it.
  const stop = useCallback(() => stopRecording(), [stopRecording]);

  const cancel = useCallback(async () => {
    epochRef.current += 1;
    setTranscribing(false);
    await cancelRecording();
  }, [cancelRecording]);

  return {
    recording,
    transcribing,
    elapsed,
    maxSeconds: DICTATION_MAX_SECONDS,
    error: error || recorder.error,
    start,
    stop,
    cancel,
  };
}
