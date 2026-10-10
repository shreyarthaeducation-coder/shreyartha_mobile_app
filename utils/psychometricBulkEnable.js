/**
 * Bulk enable of psychometric tests (Wellness Groups, 10 Oct 2026) — the rules the sheet shows.
 * The twin of the website's `School/shared/PsychometricBulkEnable/bulkEnable.js`; keep the two in step.
 *
 * The server sets EXACTLY the ticked tests for every student of the chosen sections: ticked open,
 * unticked closed. See PsychometricBulkEnableService.
 */

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Every test id of a test set, in the tree's order. */
export function topicIdsOf(testSet) {
  return (testSet?.chapters || []).flatMap((c) => (c.topics || []).map((t) => t.topicId));
}

/** Students across the chosen sections. */
export function studentsIn(sections, chosenIds) {
  const chosen = new Set(chosenIds);
  return (sections || []).filter((s) => chosen.has(s.sectionId)).reduce((n, s) => n + (s.students || 0), 0);
}

/** How many students of the chosen sections have this test open now. */
export function openCount(sections, chosenIds, topicId) {
  const chosen = new Set(chosenIds);
  return (sections || [])
    .filter((s) => chosen.has(s.sectionId))
    .reduce((n, s) => n + (s.openCounts?.[topicId] ?? s.openCounts?.[String(topicId)] ?? 0), 0);
}

/**
 * The ticks a panel opens with: a test is ticked when it is open for EVERY student of the chosen
 * sections — so pressing Apply straight away changes the fewest students. An empty class ticks nothing.
 */
export function defaultTicks(testSet, sections, chosenIds) {
  const students = studentsIn(sections, chosenIds);
  if (students === 0) return new Set();
  return new Set(topicIdsOf(testSet).filter((id) => openCount(sections, chosenIds, id) === students));
}

/** One line per section saying what Apply will do (or did). */
export function describeSection(section, applied = false) {
  const { sectionName, students, studentsChanged, opened, closed, sawEverything } = section;
  const name = `Section ${sectionName}`;
  if (!students) return `${name}: no students yet.`;
  if (!studentsChanged) return `${name}: ${plural(students, 'student')} — already set this way, nothing changes.`;
  const parts = [];
  if (opened) parts.push(`${plural(opened, 'test')} ${applied ? 'opened' : 'open'}`);
  if (closed) parts.push(`${plural(closed, 'test')} ${applied ? 'closed' : 'close'}`);
  let line = `${name}: ${plural(studentsChanged, 'student')} of ${students} ${applied ? 'changed' : 'change'} — ${parts.join(', ')}`;
  line += ' (counted per student).';
  if (sawEverything) {
    line += ` ${plural(sawEverything, 'student')} had every test open before, because nobody had chosen for them yet.`;
  }
  return line;
}

/** The headline above the per-section lines. */
export function headline(result) {
  if (!result) return '';
  const { openTests, totalTests, className } = result;
  if (openTests === 0) return `Every psychometric test of ${className} will be closed for these students.`;
  if (openTests === totalTests) return `Every psychometric test of ${className} will be open for these students.`;
  return `${openTests} of ${totalTests} tests of ${className} will be open; the other ${totalTests - openTests} closed.`;
}
