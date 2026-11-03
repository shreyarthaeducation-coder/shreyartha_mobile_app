/**
 * What a character says when correcting the student (3 Nov 2026) — the website's
 * `speaking/coaching.js`, word for word; keep the two the same.
 *
 * - Sonia, correcting a word of her own line (or of a line everyone says together, which she
 *   corrects): "Say it like me: <word>."
 * - Shri, Shreya, Darsh or Krish, correcting a word of their line:
 *   "Try to pronounce it like I am doing: <word>."
 * Several words caught at once go in one sentence — "…: morning, library." — rather than the
 * phrase again for each.
 */
export function coachingLine(characterKey, words) {
  const list = (words || []).map((w) => String(w).trim()).filter(Boolean);
  if (list.length === 0) return "";
  const lead = characterKey === 'SONIA' ? 'Say it like me' : 'Try to pronounce it like I am doing';
  return `${lead}: ${list.join(", ")}.`;
}
