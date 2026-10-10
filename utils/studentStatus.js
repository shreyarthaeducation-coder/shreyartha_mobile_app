/**
 * Student Status (10 Oct 2026) — how the app reads the tables the server builds
 * (studentstatus/StudentStatusService). The twin of the website's
 * `School/shared/StudentStatus/studentStatus.js`; keep the two in step.
 */

/** How each cell state reads. */
export const STATES = {
  DONE: 'Done',
  PARTIAL: 'Started',
  NONE: 'Not started',
  LOCKED: 'Locked',
  CLOSED: 'Closed',
  NA: 'Not for this student',
};

export const LEGEND = ['DONE', 'PARTIAL', 'NONE', 'LOCKED', 'CLOSED'];

/** The node one level up, from the table's own breadcrumb; null at the overview. */
export function parentNode(table) {
  const path = table?.path || [];
  return path.length >= 2 ? path[path.length - 2].node : null;
}

/** "31 of 45 done" — or how many started when nobody has finished. */
export function summaryText(summary) {
  if (!summary || !summary.total) return '—';
  const { done, started, total } = summary;
  if (done === 0 && started > 0) return `${started} of ${total} started`;
  return `${done} of ${total} done`;
}

/** The roster rows as the search helper reads them (name, roll number). */
export function searchableRows(table) {
  return (table?.students || []).map((row) => ({ ...row, studentName: row.name }));
}

/** Schools with only the classes that have sections. */
export function flattenScope(scope) {
  return (Array.isArray(scope) ? scope : []).map((school) => ({
    ...school,
    classes: (school.classes || []).filter((c) => (c.sections || []).length > 0),
  }));
}

/** Where a section lives in the scope. */
export function findSection(scope, sectionId) {
  const id = Number(sectionId);
  for (const school of flattenScope(scope)) {
    for (const cls of school.classes) {
      const section = (cls.sections || []).find((s) => Number(s.sectionId) === id);
      if (section) return { school, cls, section };
    }
  }
  return null;
}
