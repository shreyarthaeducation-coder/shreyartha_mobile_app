import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import useVoiceRecorder from './useVoiceRecorder';

/**
 * One counselling turn, recorded as a single file and uploaded when recording stops.
 *
 * The face-to-face counterpart of the web's `useSessionRecorder`. It wraps `useVoiceRecorder` —
 * which already owns microphone permission, the module-scope mic lock (expo-av allows one prepared
 * recording per process), and the per-platform format — and adds the three things a counselling
 * turn needs on top of a Language Pro take.
 *
 * ══ 1. `stop()` RESOLVES ONLY AFTER THE UPLOAD HAS BEEN ATTEMPTED ══════════
 * This is not a nicety, it is the whole reason this hook exists. Ending a turn nulls the mic token
 * server-side, and `uploadSegment` refuses any upload whose token no longer matches — permanently,
 * with "The microphone is no longer yours". So the caller must be able to `await` the upload before
 * calling `/finish`. The web shipped without that await and lost every recording shorter than its
 * chunk interval; the same mistake here would lose every recording, full stop.
 *
 * It NEVER rejects. A failed upload is counted in `failed` and the counsellor still has to be able
 * to close the session and write the report by hand.
 *
 * ══ 2. THE TURN IDENTITY IS PINNED WHEN RECORDING STARTS ═══════════════════
 * `start(identity)` captures `{turnId, micToken}` at that instant and the upload uses THAT, not
 * whatever is on screen when it finishes. Seating a student is too early: the counsellor can
 * advance to the next child while the previous upload is still in flight, and a recording filed
 * under another child's name is a safeguarding problem, where a dropped one is only a gap.
 *
 * ══ 3. A HARD CAP, DERIVED FROM WHAT THE BACKEND CAN FORWARD ═══════════════
 * See `capSecondsFor` below.
 */

/**
 * How much audio the backend can hand Google in one request.
 *
 * `GoogleSttService` sends the bytes INLINE — there is no Cloud Storage bucket in this deployment,
 * the audio lives in S3 — and inline recognition audio is capped at 10 MB. Sized a little under
 * that for protobuf framing.
 */
const INLINE_BUDGET_BYTES = 9.5 * 1024 * 1024;

/**
 * Bytes per second of each platform's recording, from `useVoiceRecorder`'s pinned formats.
 *
 *   Android  AMR-WB at 23 850 bps  →  ~2.98 KB/s
 *   iOS      LINEAR16, 16 kHz, mono, 16-bit  →  32 KB/s exactly
 *
 * Uncompressed PCM is more than ten times the size of AMR-WB, which is why the two caps are so
 * far apart. Both formats are deliberate: they are what Google Speech-to-Text accepts directly,
 * and neither is Opus, so mobile avoids the Opus sample-rate handling entirely.
 */
const BYTES_PER_SECOND = { android: 23850 / 8, ios: 16000 * 2 };

/** The server's own ceiling (`F2FSessionService.MAX_SEGMENT_SECONDS`). */
const SERVER_MAX_SECONDS = 45 * 60;

/**
 * The recording cap for this platform, in seconds.
 *
 * DERIVED rather than typed, so it stays correct if a format changes: raise the Android bitrate and
 * the cap falls out of the arithmetic instead of silently exceeding what can be transcribed.
 * Rounded down to a whole minute because a countdown reading "4:47 left" invites the question of
 * why, and the honest answer is a byte budget nobody in the room cares about.
 */
export function capSecondsFor(platform = Platform.OS) {
  const bps = BYTES_PER_SECOND[platform] || BYTES_PER_SECOND.ios;
  const fromBudget = Math.floor(INLINE_BUDGET_BYTES / bps);
  return Math.min(SERVER_MAX_SECONDS, Math.floor(fromBudget / 60) * 60);
}

/** Warn this long before the auto-stop, so the counsellor can draw the conversation to a close. */
export const CAP_WARNING_SECONDS = 60;

/**
 * @param uploadTurn async ({ file, identity, durationMs }) => void — must throw to be counted failed
 */
export default function useTurnRecorder({ uploadTurn }) {
  const maxSeconds = capSecondsFor();
  const voice = useVoiceRecorder({ maxSeconds });

  const [uploaded, setUploaded] = useState(0);
  const [failed, setFailed] = useState(0);
  const [uploading, setUploading] = useState(false);

  // The turn this recording belongs to, pinned at start. See the class note.
  const identityRef = useRef(null);
  const uploadRef = useRef(uploadTurn);
  uploadRef.current = uploadTurn;

  const start = useCallback(async (identity) => {
    // Pinned BEFORE the await: `voice.start()` can take a moment on a cold microphone, and the
    // counsellor cannot change students in that window, but the ordering should not depend on it.
    identityRef.current = identity && identity.turnId && identity.micToken ? identity : null;
    setUploaded(0);
    setFailed(0);
    const ok = await voice.start();
    if (!ok) identityRef.current = null;
    return ok;
  }, [voice]);

  /**
   * Stop, upload, and resolve once that upload has settled.
   *
   * @returns {Promise<boolean>} whether the audio reached the server. False is not an error the
   *   caller should abort on — the turn still ends and the report is still written by hand.
   */
  const stop = useCallback(async () => {
    const take = await voice.stop();
    const identity = identityRef.current;
    identityRef.current = null;

    if (!take) return false;
    if (!identity) {
      // No turn was ever pinned — the mic was granted but the recording cannot be filed. Counted
      // rather than silently dropped: a resolved promise with no upload looks exactly like success.
      setFailed((n) => n + 1);
      return false;
    }

    setUploading(true);
    try {
      await uploadRef.current({ file: take, identity, durationMs: take.durationMs });
      setUploaded((n) => n + 1);
      return true;
    } catch {
      setFailed((n) => n + 1);
      return false;
    } finally {
      setUploading(false);
    }
  }, [voice]);

  const elapsedSeconds = Math.floor((voice.durationMs || 0) / 1000);

  return {
    recording: voice.recording,
    // expo-av is present on every build, so unlike the browser there is no capability question —
    // what can fail is permission, and that surfaces through `error`.
    supported: true,
    error: voice.error,
    permission: voice.permission,
    elapsedSeconds,
    remainingSeconds: Math.max(0, maxSeconds - elapsedSeconds),
    maxSeconds,
    nearingCap: voice.recording && maxSeconds - elapsedSeconds <= CAP_WARNING_SECONDS,
    uploading,
    uploaded,
    failed,
    start,
    stop,
    cancel: voice.cancel,
  };
}
