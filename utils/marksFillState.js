/**
 * Who still needs marks (31 Oct 2026), as on the website (frontendmain shared/marksFillState.js):
 * every row is DONE (green), PARTIAL (amber), LEFT (red) or ABSENT (grey), read from the sheet as
 * it stands, so a row turns green the moment its mark is typed.
 *
 * Question by question this reads the paper's ITEMS (paperItems), not the app's columns: the app
 * shows a question with parts by its parts only, and a teacher on the website may have given the
 * whole of it one mark — which is the question answered, though no part box holds it.
 */

export const DONE = 'done';
export const PARTIAL = 'partial';
export const LEFT = 'left';
export const ABSENT = 'absent';

const filled = (value) => value !== '' && value != null && String(value).trim() !== '';

/** One total per student; with a practical, the written mark and the practical together. */
export function flatFillState(entry, hasPractical) {
  if (!entry) return LEFT;
  if (entry.status === 'ABSENT') return ABSENT;
  const written = filled(entry.marksObtained);
  if (!hasPractical) return written ? DONE : LEFT;
  const practical = filled(entry.practicalMarks);
  if (written && practical) return DONE;
  return written || practical ? PARTIAL : LEFT;
}

/**
 * Question by question over the paper's items: an item is answered by its lead's mark, or, when it
 * has parts, by every part. A typed total (the examiner's own) is a complete record.
 */
export function questionFillState(entry, items) {
  if (!entry) return LEFT;
  if (entry.status === 'ABSENT') return ABSENT;
  if (filled(entry.totalTyped)) return DONE;
  const marks = entry.marks || {};
  const has = (id) => filled(marks[id]);
  const answered = (items || []).map((item) =>
    has(item.lead.id) || (item.parts.length > 0 && item.parts.every((part) => has(part.id))),
  );
  if (answered.length > 0 && answered.every(Boolean)) return DONE;
  return Object.values(marks).some(filled) ? PARTIAL : LEFT;
}

export function fillCounts(states) {
  const out = { [DONE]: 0, [PARTIAL]: 0, [LEFT]: 0, [ABSENT]: 0 };
  states.forEach((s) => {
    if (s in out) out[s] += 1;
  });
  return out;
}
