/**
 * The class analysis sheet's numbers and its printable page (28 Oct 2026) — the same formatting as
 * the website's ClassAnalysisReport, so the PDF from the phone reads like the one from the website.
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

/** What one cell shows: the marks, AB, or nothing. */
export const cellText = (cell) => (cell ? (cell.absent ? 'AB' : mark(cell.marks)) : '');

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
    `<tr>${th('DATE', 'left', 2)}${columns.map((c) => th(shortDate(c.examDate))).join('')}</tr>`,
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
</style></head><body>
<div class="title">
  <div class="school">${esc(report?.schoolName)}</div>
  <div>EXAMINATION: ${esc(String(report?.examName || '').toUpperCase())}</div>
  ${report?.session ? `<div>SESSION: ${esc(report.session)}</div>` : ''}
  <div>CLASS- ${esc(report?.className)}-${esc(report?.sectionName)}</div>
  <div class="ct">CLASS TEACHER- ${esc(report?.classTeacher || '')}</div>
</div>
<table><thead>${head}</thead><tbody>${body}${gap}${summary}</tbody></table>
</body></html>`;
}
