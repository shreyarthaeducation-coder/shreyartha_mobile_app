// utils/readAloudText.js
// Port of frontendmain/src/student/translation/textUtils.js — `buildQuestionReadAloudText`.
//
// Turns a question plus its options into one utterance for Shreya Speak, so a student hears
// "…the question… Option A. …  Option C. …" rather than just the stem.

import htmlToText from './htmlToText';

/**
 * ── THE LETTER COMES FROM THE ARRAY INDEX, NOT THE POSITION AMONG NON-EMPTY OPTIONS ──
 *
 * `['A text', '', 'C text']` reads as "Option A … Option C". Letter **B is skipped**, deliberately:
 * the source rows really do have a blank `optionB`, and the on-screen list is lettered the same
 * way. Filtering the blanks out first and then lettering `A, B` would rename every option the
 * student can see, on exactly the questions that have a gap — a mismatch between what they hear and
 * what they read.
 *
 * Index ≥ 26 falls back to a 1-based number, as the web does.
 *
 * `htmlToText` is used rather than the web's `stripHtml` because it also decodes entities: an
 * `&nbsp;` reaching the TTS endpoint is a word the student never hears correctly.
 */
export function buildQuestionReadAloudText(questionText, options = []) {
  const parts = [htmlToText(questionText)].filter(Boolean);

  (options || []).forEach((option, index) => {
    const text = htmlToText(option);
    if (!text) return; // blank option — skipped WITHOUT consuming its letter
    const label = index < 26 ? String.fromCharCode(65 + index) : `${index + 1}`;
    parts.push(`Option ${label}. ${text}`);
  });

  return parts.join(' ');
}

export default buildQuestionReadAloudText;
