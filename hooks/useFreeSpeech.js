import { useCallback, useState } from 'react';
import useVoiceRecorder from './useVoiceRecorder';
import { assessPronunciation } from '../services/student/speechService';

/**
 * Spoken answers → a transcript.
 *
 * The web's `useFreeSpeech` runs Azure's **continuous** recogniser in the browser, so the
 * transcript builds up live while the student is still talking. React Native has no build of that
 * SDK, so this records and transcribes in one go: the transcript appears when they stop.
 *
 * **That difference is the reason the calling screens confirm each answer before moving on.** On
 * the web a student can watch the words appear and correct themselves mid-sentence; here they only
 * see it afterwards, so they need the chance to redo it.
 *
 * Transcription reuses `POST /api/v1/speech/assess` with an **empty `referenceText`** — that is
 * what switches Azure into unscripted mode, where accuracy and completeness stop being meaningful
 * but `recognizedText` still comes back. No second endpoint is needed.
 */
export default function useFreeSpeech() {
  const recorder = useVoiceRecorder();
  const [transcript, setTranscript] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState('');

  const start = useCallback(async () => {
    setError('');
    setTranscript('');
    return recorder.start();
  }, [recorder]);

  /** Stop and transcribe. Resolves to the transcript, or '' when nothing was heard. */
  const stop = useCallback(async () => {
    const take = await recorder.stop();
    if (!take) return '';

    setTranscribing(true);
    try {
      const res = await assessPronunciation(take, '');
      const heard = res?.recognizedText || '';
      setTranscript(heard);
      if (!heard) setError('We could not hear anything. Please try again.');
      return heard;
    } catch (e) {
      // "Nothing to score" is the server's way of saying the student did not speak — a normal
      // outcome to report, not a failure to log.
      setError(e?.message || 'We could not hear that. Please try again.');
      return '';
    } finally {
      setTranscribing(false);
    }
  }, [recorder]);

  const reset = useCallback(() => {
    setTranscript('');
    setError('');
    recorder.cancel();
  }, [recorder]);

  return {
    recording: recorder.recording,
    seconds: recorder.seconds,
    maxSeconds: recorder.maxSeconds,
    transcribing,
    transcript,
    error: error || recorder.error,
    start,
    stop,
    reset,
  };
}
