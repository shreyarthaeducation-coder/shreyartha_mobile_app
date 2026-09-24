import { useCallback, useEffect, useRef, useState } from 'react';
import { createAudioPlayer } from 'expo-audio';
import { TTS_LANGUAGE, synthesizeToFile } from '../services/student/speechService';
import { registerActiveAudio, releaseActiveAudio } from '../utils/audioController';

/**
 * Shreya's speaking voice.
 *
 * This half never needed the Azure SDK — the web already goes through our own TTS endpoint and
 * plays the result, so the port is `new Audio(url)` → a native player, with the base64 written to a
 * cache file first (see `synthesizeToFile`).
 *
 * **It runs on `expo-audio`, not `expo-av`.** expo-av's native module is absent from Expo Go as of
 * SDK 57 — importing it throws "Cannot find native module 'ExponentAV'" before a single screen
 * renders, which is how the whole app died on a phone. The player here is an object with
 * `play()` / `pause()` / `remove()` and a `playbackStatusUpdate` listener, rather than expo-av's
 * `Audio.Sound` with its `*Async` methods.
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
export default function useShreyaVoice({ language = TTS_LANGUAGE, gender = 'female', client } = {}) {
  // `client` is the transport. Students leave it undefined and speechService uses studentApi;
  // parent, teacher and partner screens pass services/shared/ttsClient, which carries THEIR
  // token and never tears a session down when the voice service says no.
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  /** The last failure, so a screen can surface it. Cleared when a line speaks successfully. */
  const [error, setError] = useState('');
  const soundRef = useRef(null);
  // The playbackStatusUpdate subscription belonging to the current player.
  const subscriptionRef = useRef(null);
  // Bumped on every stop and on unmount, so a slow synthesis cannot start playing into a screen
  // that has moved on — or over a recording that has since begun.
  const epochRef = useRef(0);

  const unload = useCallback(async () => {
    const player = soundRef.current;
    soundRef.current = null;
    const subscription = subscriptionRef.current;
    subscriptionRef.current = null;
    // These two swallow deliberately, and say so with a statement rather than an empty block:
    // this file's rule is that a failure to SPEAK is never silent, and neither of these is that.
    // Detaching a listener from an already-removed player, or removing a player twice, has nothing
    // to recover from and nothing to tell the student.
    try {
      subscription?.remove?.();
    } catch (detachError) {
      void detachError;
    }
    try {
      // `remove()` frees the native player. There is no async unload in expo-audio.
      player?.remove?.();
    } catch (removeError) {
      void removeError;
    }
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
    const player = soundRef.current;
    if (!player) return;
    try {
      player.pause();
      setPaused(true);
    } catch (e) {
      setError(e?.message || 'That clip could not be paused.');
    }
  }, []);

  /** Resume a paused clip. Re-claims playback, in case something else started meanwhile. */
  const resume = useCallback(async () => {
    const player = soundRef.current;
    if (!player) return;
    try {
      await registerActiveAudio(handleRef.current);
      player.play();
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
        const uri = await synthesizeToFile(text, { language, gender, client });
        if (!uri || epochRef.current !== epoch) return;

        await unload();
        // Claim playback BEFORE creating the sound: registering stops whatever else was audible,
        // and doing it after would leave two clips overlapping for the length of createAsync.
        await registerActiveAudio(handleRef.current);
        if (epochRef.current !== epoch) return;

        // `createAudioPlayer` is synchronous and does not auto-play, so playback is started
        // explicitly below — expo-av's `createAsync({ shouldPlay: true })` did both at once.
        const player = createAudioPlayer({ uri });
        if (epochRef.current !== epoch) {
          player.remove();
          return;
        }
        soundRef.current = player;
        setSpeaking(true);
        setPaused(false);

        await new Promise((resolve) => {
          // Kept on the subscription so `unload()` can detach it; a listener left attached to a
          // removed player is what leaks one clip's worth of state per line spoken.
          subscriptionRef.current = player.addListener('playbackStatusUpdate', (status) => {
            // `didJustFinish` fires once; a player that never loads also has to resolve or the
            // caller hangs. A PAUSE must not resolve — the clip has not finished, and Learn with
            // Shreya waits on this promise before advancing to the next line.
            if (status?.didJustFinish) return resolve();
            if (status?.isLoaded === false && status?.playing === false) return undefined;
            return undefined;
          });
          player.play();
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
    [language, gender, unload, client],
  );

  /** Warm the cache for a line we are about to need. Failures are irrelevant. */
  const prefetch = useCallback(
    (text) => {
      if (!text || !text.trim()) return;
      synthesizeToFile(text, { language, gender, client }).catch(() => {});
    },
    [language, gender, client],
  );

  return { speak, stop, pause, resume, prefetch, speaking, paused, error };
}
