/**
 * Where a passage's vocabulary words and phrases fall in a line of text (2 Nov 2026) — pure. A
 * line-for-line copy of the website's `speaking/vocabHighlight.js`, so the phone's script list
 * shows exactly the words, in exactly the colours, that the website and the admin's preview do.
 *
 * The rules:
 * - Case does not matter; the line's own capitals, spaces and punctuation are kept as they are.
 * - Whole words only: "art" is not found inside "party". A phrase may span any run of spaces.
 * - Every occurrence is found, not only the first.
 * - Where two entries overlap, the longer match wins; then the earlier one in the line; then the
 *   entry that comes first in the vocabulary list. The same word listed twice keeps its first entry.
 */

const SPECIAL = /[.*+?^${}()|[\]\\]/g;

/** A letter or digit in any script — the characters a word boundary is about. */
const isWordChar = (c) =>
  !!c && (/[A-Za-z0-9]/.test(c) || (c > '\u007f' && c.toLowerCase() !== c.toUpperCase()));

/** The entries worth matching: a word, trimmed, its spaces collapsed, each word once. */
function terms(vocabulary) {
  const seen = new Set();
  const out = [];
  (vocabulary || []).forEach((entry, order) => {
    const word = String(entry?.word ?? '').trim().replace(/\s+/g, ' ');
    const key = word.toLowerCase();
    if (!word || seen.has(key)) return;
    seen.add(key);
    out.push({ word, category: entry?.category ?? null, order });
  });
  return out;
}

/** Every whole-word occurrence of one term in the text. */
function occurrences(text, term) {
  const pattern = new RegExp(term.word.replace(SPECIAL, '\\$&').replace(/ /g, '\\s+'), 'gi');
  const needsStart = isWordChar(term.word.charAt(0));
  const needsEnd = isWordChar(term.word.charAt(term.word.length - 1));
  const found = [];
  let m;
  while ((m = pattern.exec(text)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    const okStart = !needsStart || !isWordChar(text.charAt(start - 1));
    const okEnd = !needsEnd || !isWordChar(text.charAt(end));
    if (okStart && okEnd) found.push({ start, end, category: term.category, order: term.order });
    // Step one character on, so "art" in "party art" is still found after the false start.
    pattern.lastIndex = start + 1;
  }
  return found;
}

/**
 * The text cut into segments, each `{ text, category }` — `category` is the vocabulary entry's
 * category for a match and null for the text between. Joined back together, the segments are the
 * text exactly.
 */
export function vocabSegments(text, vocabulary) {
  const source = String(text ?? '');
  const all = terms(vocabulary).flatMap((t) => occurrences(source, t));
  all.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start || a.order - b.order);
  const chosen = [];
  all.forEach((c) => {
    if (chosen.every((k) => c.end <= k.start || c.start >= k.end)) chosen.push(c);
  });
  chosen.sort((a, b) => a.start - b.start);

  const segments = [];
  let at = 0;
  chosen.forEach((c) => {
    if (c.start > at) segments.push({ text: source.slice(at, c.start), category: null });
    segments.push({ text: source.slice(c.start, c.end), category: c.category });
    at = c.end;
  });
  if (at < source.length || segments.length === 0) segments.push({ text: source.slice(at), category: null });
  return segments;
}
