/**
 * The class analysis sheet's numbers and its printable page (28 Oct 2026; several exams added and
 * an OUT OF row, 29 Oct) — the same formatting as the website's ClassAnalysisReport, so the PDF from
 * the phone reads like the one from the website.
 * Pure: no React Native, so it can be checked on its own.
 */

/** 18 → "18", 6.5 → "6.5", 13.533 → "13.53". */
export const mark = (v) => (v == null ? '' : String(Math.round(Number(v) * 100) / 100));

/** 90 → "90%". */
export const percent = (v) => (v == null ? '' : `${mark(v)}%`);

/** "2026-07-11" → "11/7/26", the sheet's own way of writing a date. */
export const shortDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  return `${Number(d)}/${Number(m)}/${String(y).slice(-2)}`;
};

/** "11/7/26", or "11/7/26 – 2/9/26" when the exams added were written on different days. */
export const dateRange = (c) =>
  c?.lastExamDate && c.lastExamDate !== c.examDate
    ? `${shortDate(c.examDate)} – ${shortDate(c.lastExamDate)}`
    : shortDate(c?.examDate);

/** A total the student has no mark in one or more of the exams of (absent or not entered). */
export const isPartial = (cell) => !!cell && !cell.absent && (cell.missing || 0) > 0;

/** What one cell shows: the marks (with † when part of a total is missing), AB, or nothing. */
export const cellText = (cell) =>
  cell ? (cell.absent ? 'AB' : `${mark(cell.marks)}${isPartial(cell) ? ' †' : ''}`) : '';

/** The exam dropdown's "add every exam" choice. Not an exam name: those come from the school. */
export const ALL_EXAMS = '__all__';

/**
 * The query for a selection — the website's: `examName` repeated (or `allExams=true`), `subjectId`
 * repeated, none when every subject is ticked (so a subject added later is still in).
 */
export function selectionQuery(sectionId, { exams, subjects, allSubjects }) {
  const parts = [`sectionId=${encodeURIComponent(sectionId)}`];
  if (exams.includes(ALL_EXAMS)) parts.push('allExams=true');
  else exams.forEach((name) => parts.push(`examName=${encodeURIComponent(name)}`));
  if (!allSubjects) subjects.forEach((id) => parts.push(`subjectId=${encodeURIComponent(id)}`));
  return parts.join('&');
}

/**
 * Below 33% — underlined in red, as teachers mark the paper sheet. With the server's whisker of
 * tolerance: 6.6 / 20 is exactly 33%, though the division comes out a hair under.
 */
export const isLow = (cell, outOf) =>
  !!cell && !cell.absent && cell.marks != null && outOf > 0 && (cell.marks / outOf) * 100 + 1e-9 < 33;

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** The summary rows under the students: [label, value for a column]. */
export function summaryRows(report) {
  const bySubject = Object.fromEntries((report?.summaries || []).map((s) => [s.subjectId, s]));
  const rows = [
    ['CLASS AVERAGE', (c) => mark(bySubject[c.subjectId]?.average)],
    ['HIGHEST MARKS %', (c) => percent(bySubject[c.subjectId]?.highestPercent)],
    ['LOWEST MARKS %', (c) => percent(bySubject[c.subjectId]?.lowestPercent)],
  ];
  (report?.bandLabels || []).forEach((label) => {
    rows.push([label, (c) => (bySubject[c.subjectId]?.counted ? String(bySubject[c.subjectId].bands?.[label] ?? 0) : '')]);
  });
  return rows;
}

/** The whole sheet as an A4 landscape page, for expo-print. */
export function classAnalysisHtml(report) {
  const columns = report?.columns || [];
  const tag = (name) => (text, cls = '', span = 1) =>
    `<${name} class="${cls}"${span > 1 ? ` colspan="${span}"` : ''}>${esc(text)}</${name}>`;
  const th = tag('th');
  const td = tag('td');
  const head = [
    `<tr>${th('TEACHER NAME', 'left', 2)}${columns.map((c) => th(c.teacherInitials)).join('')}</tr>`,
    `<tr>${th('DATE', 'left', 2)}${columns.map((c) => th(dateRange(c))).join('')}</tr>`,
    `<tr>${th('OUT OF', 'left', 2)}${columns.map((c) => th(mark(c.outOf))).join('')}</tr>`,
    `<tr>${th('ROLL')}${th("STUDENT'S NAME", 'left')}${columns.map((c) => th(c.heading)).join('')}</tr>`,
  ].join('');
  const body = (report?.students || [])
    .map(
      (s) =>
        `<tr>${td(s.rollNumber || '')}${td(s.studentName, 'left')}${columns
          .map((c) => {
            const cell = s.marks?.[c.subjectId];
            return td(cellText(cell), isLow(cell, c.outOf) ? 'num low' : 'num');
          })
          .join('')}</tr>`,
    )
    .join('');
  const gap = `<tr class="gap"><td colspan="${2 + columns.length}"></td></tr>`;
  const summary = summaryRows(report)
    .map(([label, value]) => `<tr>${td(label, 'left', 2)}${columns.map((c) => td(value(c), 'num')).join('')}</tr>`)
    .join('');
  const anyPartial = (report?.students || []).some((s) => Object.values(s.marks || {}).some(isPartial));
  const notes = [
    ...((report?.exams || []).length > 1 ? [`Marks added across: ${report.exams.join(', ')}.`] : []),
    ...(anyPartial ? ['† no mark in one or more of the exams added (absent or not entered).'] : []),
  ]
    .map((n) => `<div>${esc(n)}</div>`)
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8" />
<style>
  @page { size: A4 landscape; margin: 10mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 0; }
  .title { text-align: center; font-weight: 700; font-size: 12px; line-height: 1.45; margin-bottom: 8px; }
  .school { font-size: 14px; }
  .ct { text-align: left; margin-top: 4px; }
  table { border-collapse: collapse; width: 100%; font-size: 11px; }
  th, td { border: 1px solid #000; padding: 2px 6px; text-align: center; white-space: nowrap; }
  .left { text-align: left; }
  .num { text-align: right; }
  .low { color: #b91c1c; text-decoration: underline; }
  .gap td { height: 10px; border-left: none; border-right: none; }
  .notes { margin-top: 6px; font-size: 10px; line-height: 1.5; }
</style></head><body>
<div class="title">
  <div class="school">${esc(report?.schoolName)}</div>
  <div>EXAMINATION: ${esc(String(report?.examName || '').toUpperCase())}</div>
  ${report?.session ? `<div>SESSION: ${esc(report.session)}</div>` : ''}
  <div>CLASS- ${esc(report?.className)}-${esc(report?.sectionName)}</div>
  <div class="ct">CLASS TEACHER- ${esc(report?.classTeacher || '')}</div>
</div>
<table><thead>${head}</thead><tbody>${body}${gap}${summary}</tbody></table>
${notes ? `<div class="notes">${notes}</div>` : ''}
</body></html>`;
}
