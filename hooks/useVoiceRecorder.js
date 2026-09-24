import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { stopActiveAudio } from '../utils/audioController';

/**
 * One microphone recorder for every voice surface in Language Pro.
 *
 * Record Your Voice, Sound Studio's practice recorder and Learn with Shreya all go through this,
 * for the same reason the three adaptive engines share `useAdaptiveSession`: permission handling
 * and the audio format are easy to get subtly wrong, and three copies means three chances to drift.
 *
 * ── WHY expo-audio AND NOT expo-av ───────────────────────────────────────────
 * `expo-av` is gone from Expo Go as of SDK 57: importing it throws
 * "Cannot find native module 'ExponentAV'" before any screen renders. `expo-audio` is its
 * replacement, and the API is different enough that this is a rewrite rather than a rename —
 * there is no prepare/unload lifecycle, the recorder is a stable object owned by the hook, and
 * the Android format and encoder are plain strings instead of enums.
 *
 * ── THE FORMAT IS NOT A DETAIL ───────────────────────────────────────────────
 * The recording is forwarded to Azure by `POST /api/v1/speech/assess`, and Azure's REST short-audio
 * endpoint accepts a specific set of codecs: **WAV/PCM, OGG-OPUS, WEBM-OPUS, MP3, FLAC, ALAW,
 * MULAW, AMR-NB and AMR-WB**.
 *
 * The HIGH_QUALITY preset produces **AAC in an .m4a container**, which is NOT on that list. Using
 * it would look completely reasonable and fail at Azure. So each platform is pinned to something
 * Azure actually takes:
 *
 *   iOS      Linear PCM in a .wav  — real WAV, the format Azure is happiest with
 *   Android  AMR-WB (.amr)         — 16 kHz wideband; the only Azure-accepted codec Android's
 *                                    MediaRecorder can produce directly. AMR-NB also works but is
 *                                    8 kHz narrowband, which measurably hurts pronunciation scores.
 *
 * **Android's AMR-WB path is the one to verify on a device first.** If it is rejected, the options
 * in order are: MP3 via a different encoder, transcoding server-side, or moving the backend to the
 * Azure Java SDK (which accepts a push stream and drops the codec constraint entirely).
 */

const SAMPLE_RATE = 16000; // Azure assesses at 16 kHz; recording higher just gets downsampled.

const RECORDING_OPTIONS = {
  isMeteringEnabled: true,
  extension: Platform.OS === 'android' ? '.amr' : '.wav',
  sampleRate: SAMPLE_RATE,
  numberOfChannels: 1,
  bitRate: Platform.OS === 'android' ? 23850 : 256000,
  android: {
    extension: '.amr',
    // 'amrwb' (container) and 'amr_wb' (encoder) have to agree or Android silently falls back.
    // These are STRINGS in expo-audio; expo-av used AndroidOutputFormat/AndroidAudioEncoder enums.
    outputFormat: 'amrwb',
    audioEncoder: 'amr_wb',
    sampleRate: SAMPLE_RATE,
    numberOfChannels: 1,
    bitRate: 23850, // AMR-WB's top mode; anything lower audibly degrades consonants.
  },
  ios: {
    extension: '.wav',
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    sampleRate: SAMPLE_RATE,
    numberOfChannels: 1,
    bitRate: 256000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

/** Content-Type per platform, matching RECORDING_OPTIONS. Sent to Azure verbatim. */
const MIME = { android: 'audio/amr-wb', ios: 'audio/wav', web: 'audio/webm' };

const currentMime = () => MIME[Platform.OS] || 'audio/wav';
const currentExtension = () =>
  (RECORDING_OPTIONS[Platform.OS] || RECORDING_OPTIONS.ios).extension || '.wav';

/** Azure's REST endpoint refuses anything longer; stop before the server has to reject it. */
export const MAX_RECORDING_SECONDS = 55;

/* ── THE MODULE-LEVEL MIC LOCK ─────────────────────────────────────────────────
 * There is one microphone, and two hook instances can live on one screen:
 * `ShreyaChapterScreen` mounts `useFreeSpeech` for answers and `useVoiceRecorder` for reading, and
 * neither toggle knows about the other. Under expo-av that collision threw
 * "Only one Recording object can be prepared at a time" and the take was lost; under expo-audio the
 * second recorder simply produces nothing useful, which is worse because it is silent.
 *
 * A ref guard cannot prevent this, because the ref is per hook INSTANCE and the microphone is per
 * PROCESS. So the lock lives at module scope, where the constraint does. `releaseChain` is a
 * promise that always resolves and is replaced by every teardown; anyone about to record awaits it
 * first. `owner` names the holder purely so a genuine double-start is reported honestly instead of
 * deadlocking behind a lock nobody will release. */
let releaseChain = Promise.resolve();
let owner = null;

let nextOwnerId = 1;
const newOwnerId = () => `rec-${nextOwnerId++}`;

/** Queue a teardown. Never rejects, so one failed stop cannot wedge every later recording. */
function queueRelease(fn) {
  releaseChain = releaseChain.then(fn, fn).catch(() => {});
  return releaseChain;
}

/** Wait for every outstanding teardown to finish, then take the mic. */
async function acquireMic(id) {
  await releaseChain;
  if (owner && owner !== id) {
    throw new Error('Another recording is already in progress on this screen.');
  }
  owner = id;
}

function releaseMic(id) {
  if (owner === id) owner = null;
}

export default function useVoiceRecorder({ maxSeconds = MAX_RECORDING_SECONDS } = {}) {
  const [recording, setRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [permission, setPermission] = useState('unknown'); // unknown | granted | denied
  const [error, setError] = useState('');
  /**
   * The finished take. Set by BOTH the explicit stop and the auto-stop at `maxSeconds`, so a
   * student who runs over the limit still gets their recording scored rather than silently losing
   * it — the auto-stop clears the recorder, so a later `stop()` call would find nothing.
   */
  const [lastRecording, setLastRecording] = useState(null);

  const aliveRef = useRef(true);
  const stopTimerRef = useRef(null);
  // Whether THIS instance is the one currently recording. The recorder object itself is owned by
  // expo-audio and outlives a single take, so it cannot serve as the "am I recording" flag.
  const activeRef = useRef(false);
  // Lets the auto-stop timeout call the CURRENT stop rather than the one captured when `start` ran.
  const stopRef = useRef(null);
  // This instance's identity for the module-level mic lock. Stable across renders.
  const idRef = useRef(null);
  if (idRef.current === null) idRef.current = newOwnerId();

  // One recorder per hook instance, created and owned by expo-audio. The status listener is how
  // the elapsed time reaches the screen; expo-av used setOnRecordingStatusUpdate for this.
  const recorder = useAudioRecorder(RECORDING_OPTIONS, (status) => {
    if (!aliveRef.current || !activeRef.current) return;
    if (status?.isFinished) return;
    const ms = typeof status?.durationMillis === 'number'
      ? status.durationMillis
      : Math.round((recorder?.currentTime || 0) * 1000);
    if (ms >= 0) setDurationMs(ms);
  });

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      // Leaving mid-recording must release the mic, or the next screen cannot record at all.
      // Cleanup cannot await, so the stop is pushed onto the shared chain instead: the next
      // `start()` anywhere in the app waits on it rather than racing it.
      const wasActive = activeRef.current;
      const id = idRef.current;
      activeRef.current = false;
      if (wasActive) {
        queueRelease(async () => {
          await recorder.stop().catch(() => {});
          releaseMic(id);
        });
      } else {
        releaseMic(id);
      }
    };
    // `recorder` is stable for the life of this hook instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensurePermission = useCallback(async () => {
    const { granted } = await requestRecordingPermissionsAsync();
    setPermission(granted ? 'granted' : 'denied');
    return granted;
  }, []);

  const start = useCallback(async () => {
    setError('');
    if (activeRef.current) return false; // already recording — ignore the second tap

    if (!(await ensurePermission())) {
      setError('Microphone access is needed to record. You can enable it in Settings.');
      return false;
    }

    // Shreya must not be talking into the microphone. Previously every caller had to remember to
    // call `voice.stop()` first, and only two of them did; the module-scope controller makes it
    // unconditional and needs no reference to whichever component is playing.
    await stopActiveAudio();

    try {
      // Wait for any other surface's recorder to finish stopping before we start.
      // This is what makes two recorders in one component (ShreyaChapterScreen) safe.
      await acquireMic(idRef.current);
    } catch (e) {
      setError(e?.message || 'Another recording is already in progress.');
      return false;
    }

    try {
      // Without this, iOS records at a whisper and Android may route to the earpiece.
      // expo-audio renamed both fields: allowsRecordingIOS → allowsRecording,
      // playsInSilentModeIOS → playsInSilentMode.
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

      await recorder.prepareToRecordAsync(RECORDING_OPTIONS);
      recorder.record();

      activeRef.current = true;
      setRecording(true);
      setDurationMs(0);

      // A hard stop, so a student who forgets never produces audio Azure will refuse.
      stopTimerRef.current = setTimeout(() => {
        if (activeRef.current) stopRef.current?.();
      }, maxSeconds * 1000);
      return true;
    } catch (e) {
      activeRef.current = false;
      setRecording(false);
      setError(e?.message || 'Could not start recording.');
      // A failed start still leaves us holding the lock; not releasing it would make the very next
      // attempt fail with "another recording is in progress" and never recover.
      releaseMic(idRef.current);
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensurePermission, maxSeconds]);

  /**
   * Stop and hand back the file.
   * @returns {Promise<{uri, type, name, durationMs}|null>} null if nothing was recording.
   */
  const stop = useCallback(async () => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (!activeRef.current) return null;
    setRecording(false);

    try {
      // Released through the shared chain, so a fast re-tap (or the other recorder on this screen)
      // waits rather than starting over a recorder that is still running.
      await queueRelease(async () => {
        await recorder.stop();
        activeRef.current = false;
        releaseMic(idRef.current);
      });
      // Hand the audio session back so playback (Shreya's voice) is not stuck in record mode.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });

      // `uri` is a property in expo-audio; expo-av had getURI().
      const uri = recorder.uri;
      if (!uri) {
        setError('The recording could not be saved.');
        return null;
      }
      const take = {
        uri,
        type: currentMime(),
        name: `recording${currentExtension()}`,
        durationMs,
      };
      setLastRecording(take);
      return take;
    } catch (e) {
      activeRef.current = false;
      releaseMic(idRef.current);
      setError(e?.message || 'Could not finish the recording.');
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMs]);

  // Keep the auto-stop pointed at the latest `stop`.
  stopRef.current = stop;

  /** Throw the recording away — used when the student backs out mid-take. */
  const cancel = useCallback(async () => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    const wasActive = activeRef.current;
    setRecording(false);
    setDurationMs(0);
    setLastRecording(null);
    // Same ordering rule as stop(): release through the chain, clear the flag after the stop.
    await queueRelease(async () => {
      if (wasActive) await recorder.stop().catch(() => {});
      activeRef.current = false;
      releaseMic(idRef.current);
    });
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    recording,
    lastRecording,
    durationMs,
    seconds: Math.floor(durationMs / 1000),
    maxSeconds,
    permission,
    error,
    start,
    stop,
    cancel,
    ensurePermission,
  };
}
