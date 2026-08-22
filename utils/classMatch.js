// utils/classMatch.js
// Source: frontendmain/src/student/platform/CodingPro/CodingPro.js — `normalizeClassName` and
// `findMatchedClass`.
//
// ── WHY THIS IS THE ONE TO COPY ──────────────────────────────────────────────
// The website has TWO Roman-numeral class matchers and only this one is correct.
//
//   Coding Pro    matches the numeral as a WORD:  /\b(xii|xi|x|…|ii|i)\b/i
//                 "Class VIII" → finds "viii" → 8   ✓
//
//   Psychometric  strips every non-numeral CHARACTER from the whole string:
//                 "Class VIII" → "CLVIII" → 158     ✗
//                 (the C and L come from the word "class" itself)
//
// Phase 3 shipped a recovery pass around the broken one without knowing a correct implementation
// already existed a few folders away. Psychometric's passes 1-2 still use its own faithful (broken)
// version — mobile must never resolve a class differently from the website when the website
// succeeds — but its final recovery pass now delegates here instead of duplicating the fix.

const ROMAN_VALUES = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };

// Longest-first, so "xii" is tried before "xi" and "x" — order is load-bearing.
const ROMAN_WORD = /\b(xii|xi|x|ix|viii|vii|vi|v|iv|iii|ii|i)\b/i;

/**
 * A class name reduced to something comparable: "Class 8", "VIII" and "Class VIII" all → "8".
 *
 * Digits win over numerals, so "Class 9" never goes near the Roman path. A name with neither —
 * "Nursery", "LKG" — is returned lowercased and trimmed, which still compares equal to itself.
 */
export function normalizeClassName(name) {
  if (!name) return '';
  const str = String(name).trim().toLowerCase();

  const arabic = str.match(/\d+/);
  if (arabic) return arabic[0];

  const match = str.match(ROMAN_WORD);
  if (match) {
    let result = 0;
    let prev = 0;
    for (let i = match[1].length - 1; i >= 0; i -= 1) {
      const value = ROMAN_VALUES[match[1][i].toLowerCase()] || 0;
      result += value < prev ? -value : value;
      prev = value;
    }
    return result > 0 ? String(result) : str;
  }
  return str;
}

/**
 * The class in `curriculum.classes` matching the student's class name.
 *
 * Returns null when nothing matches — the CALLER decides the fallback. Coding Pro falls back to
 * the first class so an unusual class name still shows content rather than an empty screen; do not
 * bake that in here, because a caller that silently shows the wrong class would be worse.
 */
export function findMatchedClass(curriculum, studentClass) {
  if (!curriculum || !studentClass) return null;
  const target = normalizeClassName(studentClass);
  return (
    (curriculum.classes || []).find((cls) => normalizeClassName(cls.name) === target) || null
  );
}
