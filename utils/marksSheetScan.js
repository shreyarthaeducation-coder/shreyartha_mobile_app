/**
 * What the app does with a scanned answer book — the mobile side of the website's
 * frontendmain/src/School/shared/marksSheetScan.js, QuestionMarksGrid.js and SheetPaperReview.js.
 *
 * The server reads the photographed cover and says, box by box, what it read and how sure it is.
 * These decide what the marks sheet does with that: which question each mark belongs to, what a
 * student's total is, and whether a paper made from the sheet may be created.
 *
 * Import-free on purpose: scripts/checkexamscan.mjs evaluates it.
 */

/** How each box the scan touched is shown. A blank or a dash came in as 0: nothing to check. */
export const SCAN_TONE = Object.freeze({
  VERIFIED: 'ok',
  CHECK: 'check',
  CONFLICT: 'missing',
  UNREADABLE: 'missing',
  OVER_MAX: 'missing',
  MISSING: 'missing',
});

export const scanTone = (status) => SCAN_TONE[status] || null;

/** "Q11", or "Q11–Q14": the questions a sheet has and the paper does not. */
export const questionRange = (from, to) => (from === to ? `Q${from}` : `Q${from}–Q${to}`);

/** True for a question with no maximum of its own — one made from a scanned answer book. */
export const hasNoMaximum = (question) => question?.marks == null;

/** The most a box can take: the question's own maximum, or the whole paper when it has none. */
export const ceilingFor = (question, paperOutOf) =>
  question?.marks != null ? question.marks : paperOutOf ?? null;

/**
 * One set of the paper as a student meets it, in paper order — the website's toPaperItems
 * (School/shared/eitherOrGrouping.js). Each item is `{ lead, alternatives, parts }`:
 *
 *  - an either/or choice is ONE item, led by its earliest alternative, which is the question its
 *    mark is stored against (the server drops marks sent for the others);
 *  - a question holding a passage keeps its lettered parts as `parts` — 1(a) is not question 2 —
 *    and is marked through them, never itself.
 *
 * The answer book numbers its boxes the same way: one per item.
 */
export function paperItems(questions, set = 1) {
  const inSet = (questions || [])
    .filter((q) => (q.questionSet || 1) === set)
    .sort((a, b) => (a.questionOrder ?? 0) - (b.questionOrder ?? 0));

  const partsByParent = new Map();
  inSet.forEach((q) => {
    if (q.parentQuestionId == null) return;
    if (!partsByParent.has(q.parentQuestionId)) partsByParent.set(q.parentQuestionId, []);
    partsByParent.get(q.parentQuestionId).push(q);
  });

  const items = [];
  const itemByGroup = new Map();
  inSet.forEach((q) => {
    if (q.parentQuestionId != null) return;
    const existing = q.eitherOrGroup ? itemByGroup.get(q.eitherOrGroup) : null;
    if (existing) {
      existing.alternatives.push(q);
      return;
    }
    const item = { lead: q, alternatives: [q], parts: partsByParent.get(q.id) || [] };
    if (q.eitherOrGroup) itemByGroup.set(q.eitherOrGroup, item);
    items.push(item);
  });
  return items;
}

/**
 * The boxes a student's marks go in — the website's grid columns: "Q3" for a question or a choice,
 * "Q1a" for a lettered part. Saving sends exactly these, so what is shown is what is stored.
 */
export function markingColumns(items) {
  return (items || []).flatMap((item, index) =>
    item.parts.length > 0
      ? item.parts.map((part, p) => ({
          question: part,
          label: `Q${index + 1}${String.fromCharCode(97 + (p % 26))}`,
          choice: false,
        }))
      : [{ question: item.lead, label: `Q${index + 1}`, choice: item.alternatives.length > 1 }],
  );
}

/**
 * True when any box of the paper has no maximum of its own: such a paper is marked out of the
 * exam's total marks — the server's ExamQuestionGrouping.outOf.
 */
export function isOpenPaper(questions) {
  const sets = [...new Set((questions || []).map((q) => q.questionSet || 1))];
  return sets.some((set) =>
    markingColumns(paperItems(questions, set)).some((column) => column.question.marks == null),
  );
}

/**
 * Marks read off a sheet, placed on the questions they belong to: the sheet numbers questions the
 * way the paper does, so mark N goes on the paper's Nth item. A question marked through lettered
 * parts is passed over — its one box cannot say how the marks split.
 *
 * WHICH N: the server's own `questionNumber` whenever the entry carries one, as the website does
 * (`items[entry.questionNumber - 1]`). The server leaves out a box it cannot place, so counting the
 * entries instead put every mark after the gap one question too early. Plain numbers — and entries
 * without a number — count from `startAt`.
 *
 * @param items    paperItems() of the set the student sat
 * @param read     the server's marks, or plain numbers (null for a box left for the teacher)
 * @returns {{ marks: Object<string,string>, statuses: Object<string,object> }} by question id
 */
export function marksFromScan(items, read, startAt = 1) {
  const marks = {};
  const statuses = {};
  (read || []).forEach((entry, i) => {
    const isEntry = entry != null && typeof entry === 'object';
    const number = isEntry && Number.isInteger(entry.questionNumber) ? entry.questionNumber : startAt + i;
    const item = items[number - 1];
    if (!item || item.parts.length > 0) return;
    const id = item.lead.id;
    const value = isEntry ? entry.marks : entry;
    if (isEntry && entry.status) {
      statuses[id] = { status: entry.status, raw: entry.raw, note: entry.note };
    }
    if (value != null) marks[id] = String(value);
  });
  return { marks, statuses };
}

/** A student's questions added up: their boxes only, as the server adds them. */
export function columnsTotal(columns, marks) {
  return (columns || []).reduce((sum, column) => sum + (Number(marks?.[column.question.id]) || 0), 0);
}

/**
 * "54.5 = 55": when the sheet vouches for a total that is not its boxes added up, it is the
 * examiner's rounding and goes in as the typed total. Otherwise '' — the questions add up.
 */
export function examinersTotal(response) {
  if (!response || response.sheetTotalStatus !== 'VERIFIED') return '';
  if (response.sheetTotal == null || response.readTotal == null) return '';
  return Math.abs(response.sheetTotal - response.readTotal) > 1e-9 ? String(response.sheetTotal) : '';
}

/**
 * A student's total as it should first appear. A total typed by hand stays typed; so does one
 * recorded as a total before the paper had questions, which has no breakdown to be the sum of.
 */
export function seededTotal(row) {
  if (!row || row.status !== 'PRESENT' || row.totalMarksObtained == null) return '';
  const hasBreakdown = (row.questionMarks || []).some((qm) => qm.marksObtained != null);
  return row.totalByHand || !hasBreakdown ? String(row.totalMarksObtained) : '';
}

/**
 * Whether a row has anything to save. A row nobody has touched is left alone rather than written
 * down as a present student who scored nothing — which is a mark, not a blank.
 */
export function worthSaving(row, entry) {
  if (row?.status) return true;
  if (!entry) return false;
  if (entry.status === 'ABSENT') return true;
  if ((entry.totalTyped ?? '') !== '') return true;
  return Object.values(entry.marks || {}).some((v) => v !== '' && v != null);
}

/**
 * The same question for the one-total sheet. The server refuses a present student with no total
 * ("Marks are required for …") and takes the whole save down with it, so a teacher who has done five
 * of forty — or scanned one answer book — sends those five, not forty.
 */
export function totalWorthSaving(row, entry) {
  if (row?.status) return true;
  if (!entry) return false;
  if (entry.status === 'ABSENT') return true;
  return entry.marksObtained !== '' && entry.marksObtained != null;
}

/** The fields of a one-total row that a save writes, as the sheet shows them. */
const TOTAL_FIELDS = ['status', 'marksObtained', 'practicalMarks', 'remarks', 'questionSet'];
const same = (a, b) => String(a ?? '') === String(b ?? '');

/**
 * Whether a one-total row differs from what the server sent.
 *
 * Saving a total REPLACES that student's question-by-question marks (TeacherReportService
 * .submitMarks → clearQuestionMarksFor). On an exam with questions, re-sending a row nobody touched
 * — which the website does for every row already on file — silently throws its breakdown away. So
 * on such an exam only rows that actually changed are sent.
 */
export function totalRowChanged(original, entry) {
  if (!entry) return false;
  return TOTAL_FIELDS.some((field) => !same(original?.[field], entry[field]));
}

/**
 * Why a one-total row cannot be saved, or null. A present student needs a written total — the
 * server refuses the whole save otherwise ("Marks are required for …") — even when only their
 * practical mark was typed, since the practical is marked on its own timetable.
 */
export function totalRowProblem(name, entry, outOf, practicalOutOf) {
  if (!entry || entry.status === 'ABSENT') return null;
  const total = entry.marksObtained;
  if (total === '' || total == null) {
    return `Enter ${name}'s total too, or mark them absent.`;
  }
  if (!(Number(total) >= 0 && (outOf == null || Number(total) <= outOf))) {
    return `${name}'s total must be between 0 and ${outOf}.`;
  }
  const practical = entry.practicalMarks;
  if (practical !== '' && practical != null && practicalOutOf != null
      && !(Number(practical) >= 0 && Number(practical) <= practicalOutOf)) {
    return `${name}'s practical mark must be between 0 and ${practicalOutOf}.`;
  }
  return null;
}

/**
 * A filled-in marks file's rows applied to the one-total sheet — the website's import. A row the
 * server could not match or read (`error`) is skipped and reported; an absent row becomes an
 * absence; a mark becomes the student's total. Nothing is saved.
 *
 * @returns {{ edits: Object, applied: number, problems: Array<{rowNumber, error}> }}
 */
export function applyImportedRows(edits, rows) {
  const next = { ...edits };
  let applied = 0;
  const problems = [];
  (rows || []).forEach((row) => {
    if (row?.error) {
      problems.push({ rowNumber: row.rowNumber, error: row.error });
      return;
    }
    if (!row?.studentId) return;
    const current = next[row.studentId] || { status: 'PRESENT', marksObtained: '', remarks: '' };
    if (row.absent) {
      next[row.studentId] = { ...current, status: 'ABSENT', marksObtained: '' };
      applied += 1;
    } else if (row.marks != null) {
      next[row.studentId] = { ...current, status: 'PRESENT', marksObtained: String(row.marks) };
      applied += 1;
    }
  });
  return { edits: next, applied, problems };
}

/** The papers an exam has, as a sheet reports them: `[1]` when it has none of its own. */
export function setNumbers(sheet) {
  const sets = (sheet?.sets || []).map((s) => s.questionSet).filter((n) => n != null);
  return sets.length ? sets : [1];
}

/** What one set is out of, per the sheet — the exam's own total when the set has no questions. */
export function setOutOfFrom(sheet, set) {
  const sets = sheet?.sets || [];
  return (
    sets.find((s) => s.questionSet === set)?.totalMarks ??
    sets[0]?.totalMarks ??
    sheet?.totalQuestionMarks ??
    sheet?.maxMarks ??
    null
  );
}

/**
 * Why the paper a sheet describes cannot be created yet, or [] when it can: the same rules as the
 * website's review and the server's.
 */
export function reviewProblems({ values, totalMarks, typedTotal, studentName = 'The student' }) {
  const problems = [];
  const outOf = Number(totalMarks);
  const sum = (values || []).reduce((s, v) => s + (Number(v) || 0), 0);
  if (!values || values.length === 0) problems.push('The paper needs at least one question.');
  if (!Number.isInteger(outOf) || outOf < 1) problems.push('Total marks must be a whole number, at least 1.');
  if ((values || []).some((v) => v !== '' && !(Number(v) >= 0))) problems.push('A mark cannot be negative.');
  if ((typedTotal ?? '') === '' && Number.isInteger(outOf) && outOf >= 1 && sum > outOf) {
    problems.push(`The marks add up to ${sum}, more than the paper's total of ${outOf}.`);
  }
  if ((typedTotal ?? '') !== '' && !(Number(typedTotal) >= 0 && Number(typedTotal) <= outOf)) {
    problems.push(`${studentName}'s total must be between 0 and ${totalMarks || 'the total marks'}.`);
  }
  return problems;
}

/** The same child's name and roll number compared loosely: case, punctuation and leading zeros. */
const normaliseRoll = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^0+(?=[0-9])/, '');

const nameWords = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3);

/**
 * Whether the cover looks like someone else's answer book — the website's sheetMismatch. The roll
 * number decides when both sides have one; otherwise a name with no word in common. Handwritten
 * names are misread, so this warns and never blocks. Null when nothing is amiss.
 */
export function sheetMismatch(header, student) {
  if (!header || !student) return null;
  const sheetRoll = normaliseRoll(header.rollNumber);
  const studentRoll = normaliseRoll(student.rollNumber);
  if (sheetRoll && studentRoll) {
    return sheetRoll === studentRoll
      ? null
      : `This sheet says roll number ${header.rollNumber}, but ${student.studentName}'s roll number is ${student.rollNumber}.`;
  }
  const sheetName = nameWords(header.studentName);
  const studentName = nameWords(student.studentName);
  if (sheetName.length && studentName.length && !sheetName.some((w) => studentName.includes(w))) {
    return `The name on this sheet reads "${header.studentName}", but you chose ${student.studentName}.`;
  }
  return null;
}
