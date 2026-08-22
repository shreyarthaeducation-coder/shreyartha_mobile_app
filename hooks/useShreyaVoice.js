import { useCallback, useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import { TTS_LANGUAGE, synthesizeToFile } from '../services/student/speechService';
import { registerActiveAudio, releaseActiveAudio } from '../utils/audioController';

/**
 * Shreya's speaking voice.
 *
 * This half never needed the Azure SDK — the web already goes through our own TTS endpoint and
 * plays the result, so the port is `new Audio(url)` → `expo-av`, with the base64 written to a cache
 * file first (see `synthesizeToFile`).
 *
 * **`stop()` before opening the microphone is not optional.** `useVoiceRecorder` puts the audio
 * session into record mode; a prompt still playing will fight it, and on Android the recording can
 * capture Shreya's own voice. Since this hook now registers with `utils/audioController`, the
 * recorder can also just call `stopActiveAudio()` without holding a reference to this instance.
 *
 * `prefetch` exists because the chapter screen synthesises the NEXT question while the current one
 * plays. `synthesizeToFile` caches by text, so prefetching is just calling it early.
 *
 * **The default language is TTS_LANGUAGE, not a BCP-47 tag.** This hook shipped defaulting to
 * `'en-US'`, which `/api/v1/translate/tts` rejects with 400 UNSUPPORTED_LANGUAGE — and because the
 * catch below was silent, every line in Learn with Shreya simply never spoke, with nothing on screen
 * to say why. `error` is exposed for exactly that reason.
 *
 * ── PAUSE / RESUME ───────────────────────────────────────────────────────────
 * Added for the Shreya Speak button, whose web counterpart is a four-state machine
 * (idle → loading → playing ⇄ paused). `speak()` still resolves only when the clip actually
 * FINISHES, so a paused clip leaves it pending — which is correct for Learn with Shreya, where the
 * caller waits for the line to end before advancing. The `finally` block therefore must not unload
 * on pause; it only runs once the promise settles.
 */
export default function useShreyaVoice({ language = TTS_LANGUAGE, gender = 'female' } = {}) {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  /** The last failure, so a screen can surface it. Cleared when a line speaks successfully. */
  const [error, setError] = useState('');
  const soundRef = useRef(null);
  // Bumped on every stop and on unmount, so a slow synthesis cannot start playing into a screen
  // that has moved on — or over a recording that has since begun.
  const epochRef = useRef(0);

  const unload = useCallback(async () => {
    const sound = soundRef.current;
    soundRef.current = null;
    if (sound) await sound.unloadAsync().catch(() => {});
  }, []);

  // A stable identity for the module-scope controller, so it can stop THIS instance from anywhere.
  const handleRef = useRef(null);
  if (handleRef.current === null) {
    handleRef.current = {
      stop: async () => {
        epochRef.current += 1;
        setSpeaking(false);
        setPaused(false);
        await unload();
      },
    };
  }

  useEffect(
    () => () => {
      epochRef.current += 1;
      releaseActiveAudio(handleRef.current);
      unload();
    },
    [unload],
  );

  const stop = useCallback(() => {
    epochRef.current += 1;
    setSpeaking(false);
    setPaused(false);
    releaseActiveAudio(handleRef.current);
    unload();
  }, [unload]);

  /**
   * Pause the current clip. No-op when nothing is playing.
   *
   * A failure is REPORTED, not swallowed: the student pressed pause and the audio kept going, so
   * they need to know the control did not work. A bare `catch {}` here would be the same silence
   * that hid the wrong TTS language code for a whole phase.
   */
  const pause = useCallback(async () => {
    const sound = soundRef.current;
    if (!sound) return;
    try {
      await sound.pauseAsync();
      setPaused(true);
    } catch (e) {
      setError(e?.message || 'That clip could not be paused.');
    }
  }, []);

  /** Resume a paused clip. Re-claims playback, in case something else started meanwhile. */
  const resume = useCallback(async () => {
    const sound = soundRef.current;
    if (!sound) return;
    try {
      await registerActiveAudio(handleRef.current);
      await sound.playAsync();
      setPaused(false);
    } catch (e) {
      setError(e?.message || 'That clip could not be resumed.');
    }
  }, []);

  /** Speak a line; resolves when it finishes (or immediately if it cannot). */
  const speak = useCallback(
    async (text) => {
      if (!text || !text.trim()) return;
      const epoch = (epochRef.current += 1);
      setError('');

      try {
        const uri = await synthesizeToFile(text, { language, gender });
        if (!uri || epochRef.current !== epoch) return;

        await unload();
        // Claim playback BEFORE creating the sound: registering stops whatever else was audible,
        // and doing it after would leave two clips overlapping for the length of createAsync.
        await registerActiveAudio(handleRef.current);
        if (epochRef.current !== epoch) return;

        const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
        if (epochRef.current !== epoch) {
          await sound.unloadAsync().catch(() => {});
          return;
        }
        soundRef.current = sound;
        setSpeaking(true);
        setPaused(false);

        await new Promise((resolve) => {
          sound.setOnPlaybackStatusUpdate((status) => {
            if (!status.isLoaded) return resolve();
            // `didJustFinish` fires once; an error also has to resolve or the caller hangs.
            // A PAUSE must not resolve — the clip has not finished, and Learn with Shreya waits on
            // this promise before advancing to the next line.
            if (status.didJustFinish) return resolve();
            return undefined;
          });
        });
      } catch (e) {
        // Still non-blocking — a lesson must never stall over audio — but no longer INVISIBLE.
        // Silence with no explanation is what hid the wrong language code for a whole phase.
        setError(e?.message || 'Shreya could not speak that line.');
      } finally {
        if (epochRef.current === epoch) {
          setSpeaking(false);
          setPaused(false);
          releaseActiveAudio(handleRef.current);
          await unload();
        }
      }
    },
    [language, gender, unload],
  );

  /** Warm the cache for a line we are about to need. Failures are irrelevant. */
  const prefetch = useCallback(
    (text) => {
      if (!text || !text.trim()) return;
      synthesizeToFile(text, { language, gender }).catch(() => {});
    },
    [language, gender],
  );

  return { speak, stop, pause, resume, prefetch, speaking, paused, error };
}
