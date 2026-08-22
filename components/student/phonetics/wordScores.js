import { BAND } from '../../../constants/theme';

/**
 * Azure's per-word assessment, as stored in `wordsJson`.
 *
 * Extracted from `RecordYourVoice.js` because a second caller appeared: the reading passage colours
 * itself per word after scoring. Two copies of this parsing would drift, and the drift would be
 * invisible — one screen colouring words and the other not.
 *
 * Defensive on purpose. The same column is now written by two clients — the browser Speech SDK and
 * our server-side REST path — and while both use Azure's own casing, a malformed or empty value
 * must degrade to "no per-word detail" rather than throw inside a render.
 */

/**
 * The web's traffic-light thresholds, verbatim from `phonetics/scoreColor.js`.
 *
 * THE THRESHOLDS ARE THE WEB'S AND STAY HERE; only the colours moved to `BAND`, which took its
 * values from this function precisely because this one is the verbatim copy. Two other features had
 * their own private band scales and one of them had drifted to a different amber.
 */
export function scoreColor(s) {
  if (s == null) return BAND.none;
  if (s >= 80) return BAND.good;
  if (s >= 60) return BAND.fair;
  return BAND.poor;
}

/**
 * @param {string} wordsJson
 * @returns {Array<{word: string, score: number|null, errorType: string|null}>}
 */
export function parseWordScores(wordsJson) {
  if (!wordsJson) return [];
  try {
    const parsed = typeof wordsJson === 'string' ? JSON.parse(wordsJson) : wordsJson;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((w) => ({
        word: w.Word ?? w.word ?? '',
        score: w.PronunciationAssessment?.AccuracyScore ?? w.accuracyScore ?? null,
        // Azure marks omissions and insertions here; a skipped word scores 0 but the reason is
        // what actually tells the student what went wrong.
        errorType: w.PronunciationAssessment?.ErrorType ?? w.errorType ?? null,
      }))
      .filter((w) => w.word);
  } catch {
    return [];
  }
}

export default parseWordScores;
