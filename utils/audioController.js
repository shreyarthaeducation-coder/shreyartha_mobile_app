// utils/audioController.js
// Port of frontendmain/src/student/components/ReadAloudButton/audioController.js
//
// ── ONE CLIP AT A TIME, ACROSS THE WHOLE APP ────────────────────────────────
// The web keeps a module-scope `activeAudio` and stops it whenever anything else starts. Mobile had
// no equivalent: `useShreyaVoice`'s `epochRef` is a **per-hook-instance** ref, so it can only
// cancel that one component's clip. Two components each calling `useShreyaVoice()` played over each
// other.
//
// This is the SAME CLASS OF BUG as the recorder mutex in `hooks/useVoiceRecorder.js` — a
// per-instance guard standing in for a per-process constraint — and it matters more here, because
// after Phase 3 there is a Shreya Speak button on seven screens plus `PlacementAssessment`,
// `ShreyaChapterScreen`, and `PhonemeDetailPanel` (which calls `synthesizeToFile` directly, a third
// uncoordinated path).
//
// ── AND IT MUST STOP BEFORE THE MICROPHONE OPENS ────────────────────────────
// `useVoiceRecorder` puts the shared audio session into record mode. A clip still playing will
// fight it, and on Android the recording can capture Shreya's own voice. `stopActiveAudio()` is the
// one call that guarantees nothing is playing, from anywhere, without needing a reference to
// whichever component started it.

/** The one clip that is allowed to be audible. `{ stop }` — anything with an async stop works. */
let active = null;

/**
 * Claim playback. Stops whatever was playing first.
 *
 * @param {{ stop: () => any }} handle an object that knows how to stop itself
 * @returns {Promise<void>} resolves once the previous clip has been told to stop
 */
export async function registerActiveAudio(handle) {
  if (active && active !== handle) await stopActiveAudio();
  active = handle;
}

/**
 * Stop whatever is playing, from anywhere.
 *
 * Never throws: a failure to stop must not prevent the caller from starting, or one bad clip would
 * wedge audio for the rest of the session.
 */
export async function stopActiveAudio() {
  const handle = active;
  active = null;
  if (!handle) return;
  try {
    await handle.stop();
  } catch {
    // Already unloaded, or the screen is gone. Either way there is nothing audible left.
  }
}

/** Release the claim without stopping — for a clip that has finished on its own. */
export function releaseActiveAudio(handle) {
  if (active === handle) active = null;
}

/** Tests only. */
export function activeAudioForTests() {
  return active;
}
