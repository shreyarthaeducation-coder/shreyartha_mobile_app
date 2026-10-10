// scripts/checkexamscan.mjs
//
// Scanning a marked answer book in the app's Test and Examination marks sheet — and the paper a
// scanned sheet sets up when an exam has no questions yet. The website's version of the same rules
// lives in frontendmain/src/School/shared (QuestionMarksGrid, ExamMarksGrid, SheetPaperReview).
//
// None of what matters here is visible to a build:
//
//   * which question a scanned mark lands on — an either/or choice is ONE box, a question holding a
//     passage is marked through its lettered parts, and a mark put one place over is a wrong mark
//     that looks right;
//   * that nothing is created before the teacher has looked at it, and nothing saved before Save;
//   * that a question with no maximum of its own is capped by the whole paper, not refused at 0;
//   * that a save sends only the student's own set — the server refuses any other question.
//
// Two halves. utils/marksSheetScan.js is import-free so it is EVALUATED and its behaviour asserted;
// the screen and the service are asserted on their constructs. Every mutation must plant (change
// bytes) or it is reported as inert, and must then turn at least one assertion red.
//
// Usage: node scripts/checkexamscan.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BACKEND = path.resolve(APP, '..', 'backendmain', 'src', 'main', 'java', 'com', 'shreyartha', 'backend');

const FILES = {
  util: path.join(APP, 'utils', 'marksSheetScan.js'),
  image: path.join(APP, 'utils', 'marksSheetImage.js'),
  sheet: path.join(APP, 'components', 'staff', 'exams', 'MarksSheet.js'),
  grid: path.join(APP, 'components', 'staff', 'exams', 'marks', 'MarksGrid.js'),
  review: path.join(APP, 'components', 'staff', 'exams', 'marks', 'PaperReviewPanel.js'),
  scanner: path.join(APP, 'components', 'staff', 'exams', 'marks', 'ScanPanel.js'),
  result: path.join(APP, 'components', 'staff', 'exams', 'marks', 'ScanResultPanel.js'),
  formSheet: path.join(APP, 'components', 'ui', 'FormSheet.js'),
  scaffold: path.join(APP, 'components', 'ui', 'ScreenScaffold.js'),
  questionHtml: path.join(APP, 'components', 'QuestionHtml.js'),
  questions: path.join(APP, 'components', 'staff', 'exams', 'QuestionsSheet.js'),
  analysis: path.join(APP, 'components', 'staff', 'exams', 'ExamAnalysisSheet.js'),
  screen: path.join(APP, 'components', 'staff', 'ExamsScreen.js'),
  service: path.join(APP, 'services', 'teacher', 'examService.js'),
  controller: path.join(BACKEND, 'report', 'controller', 'TeacherReportController.java'),
};

const load = () =>
  Object.fromEntries(
    Object.entries(FILES).map(([key, file]) => [key, fs.readFileSync(file, 'utf8').split('\r\n').join('\n')]),
  );

const evaluate = async (src) => {
  try {
    return await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);
  } catch (e) {
    return { __error: e.message };
  }
};

// ── A paper with everything that makes numbering hard ─────────────────────────────────────────────
// Deliberately shuffled: the server sends questions in order, and a helper that relies on that
// breaks the day it doesn't.
const Q = (id, questionOrder, extra = {}) => ({ id, questionOrder, questionSet: 1, marks: 2, ...extra });
const PAPER = [
  Q(17, 5, { marks: 4 }), //                     Q4
  Q(15, 1, { parentQuestionId: 14 }), //         Q3a
  Q(12, 2, { eitherOrGroup: 'g', marks: 3 }), // Q2 — answer this…
  Q(21, 1, { questionSet: 2 }), //               another paper altogether
  Q(11, 1), //                                   Q1
  Q(16, 2, { parentQuestionId: 14, marks: 3 }), // Q3b
  Q(13, 3, { eitherOrGroup: 'g', marks: 3 }), // …or this
  Q(14, 4, { marks: 5 }), //                     Q3, a passage marked through its parts
];

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Behaviour of the evaluated helpers. Each returns true when the rule holds. */
const BEHAVIOUR = [
  {
    name: 'a paper is read in question order, one set at a time',
    test: (m) => same(m.paperItems(PAPER, 1).map((i) => i.lead.id), [11, 12, 14, 17])
      && same(m.paperItems(PAPER, 2).map((i) => i.lead.id), [21]),
  },
  {
    name: 'an either/or choice is one item, led by its earliest alternative',
    test: (m) => same(m.paperItems(PAPER, 1)[1].alternatives.map((q) => q.id), [12, 13]),
  },
  {
    name: 'lettered parts hang off their question instead of standing on the paper',
    test: (m) => same(m.paperItems(PAPER, 1)[2].parts.map((q) => q.id), [15, 16]),
  },
  {
    name: "the marking boxes are the website's columns: Q1, Q2 (a choice), Q3a, Q3b, Q4",
    test: (m) => {
      const columns = m.markingColumns(m.paperItems(PAPER, 1));
      return same(columns.map((c) => c.label), ['Q1', 'Q2', 'Q3a', 'Q3b', 'Q4'])
        && same(columns.map((c) => c.question.id), [11, 12, 15, 16, 17])
        && same(columns.map((c) => c.choice), [false, true, false, false, false]);
    },
  },
  {
    name: "the Nth mark read lands on the paper's Nth item, passing over a question marked by parts",
    test: (m) => same(m.marksFromScan(m.paperItems(PAPER, 1), [1, 2, 3, 4]).marks, { 11: '1', 12: '2', 17: '4' }),
  },
  {
    name: 'marks for added questions start where they were added (startAt)',
    test: (m) => {
      const { marks, statuses } = m.marksFromScan(
        m.paperItems(PAPER, 1),
        [{ questionNumber: 4, marks: 1.5, status: 'CHECK', raw: '1½' }],
        4,
      );
      return same(marks, { 17: '1.5' }) && statuses[17]?.status === 'CHECK' && statuses[17]?.raw === '1½';
    },
  },
  {
    name: 'a mark goes on the question the sheet numbers it — not one early after a box the server left out',
    test: (m) => same(
      m.marksFromScan(m.paperItems(PAPER, 1), [{ questionNumber: 1, marks: 1 }, { questionNumber: 4, marks: 3 }]).marks,
      { 11: '1', 17: '3' },
    ),
  },
  {
    name: 'plain numbers count from where they were added (startAt)',
    test: (m) => same(m.marksFromScan(m.paperItems(PAPER, 1), [1.5], 4).marks, { 17: '1.5' }),
  },
  {
    name: "a cover naming someone else warns — by roll number first, then by name — and never on a match",
    test: (m) => /roll number 12/.test(m.sheetMismatch({ rollNumber: '12' }, { rollNumber: '7', studentName: 'Aarav Shah' }) || '')
      && m.sheetMismatch({ rollNumber: '007' }, { rollNumber: '7', studentName: 'Aarav Shah' }) === null
      && m.sheetMismatch({ studentName: 'AARAV S.' }, { studentName: 'Aarav Shah' }) === null
      && /reads "Priya Nair"/.test(m.sheetMismatch({ studentName: 'Priya Nair' }, { studentName: 'Aarav Shah' }) || '')
      && m.sheetMismatch(null, { studentName: 'Aarav Shah' }) === null,
  },
  {
    name: 'a box the scan could not read is flagged and left empty, never guessed',
    test: (m) => {
      const { marks, statuses } = m.marksFromScan(m.paperItems(PAPER, 1), [{ marks: null, status: 'UNREADABLE' }]);
      return same(marks, {}) && statuses[11]?.status === 'UNREADABLE';
    },
  },
  {
    name: "a student's questions add up as the server adds them: no other alternative, no passage itself",
    test: (m) => m.columnsTotal(
      m.markingColumns(m.paperItems(PAPER, 1)),
      { 11: '1', 12: '2', 13: '3', 14: '9', 15: '1', 16: '1', 17: '' },
    ) === 5,
  },
  {
    name: 'a paper is open when a box has no maximum — and a passage is judged by its parts',
    test: (m) => m.isOpenPaper(PAPER) === false
      && m.isOpenPaper(PAPER.map((q) => (q.id === 17 ? { ...q, marks: null } : q))) === true
      && m.isOpenPaper(PAPER.map((q) => (q.id === 14 ? { ...q, marks: null } : q))) === false,
  },
  {
    name: 'a question with no maximum is capped by the whole paper',
    test: (m) => m.ceilingFor({ marks: null }, 20) === 20 && m.ceilingFor({ marks: 3 }, 20) === 3,
  },
  {
    name: "the examiner's rounding (54.5 = 55) becomes the typed total only when the sheet vouches for it",
    test: (m) => m.examinersTotal({ sheetTotalStatus: 'VERIFIED', sheetTotal: 55, readTotal: 54.5 }) === '55'
      && m.examinersTotal({ sheetTotalStatus: 'VERIFIED', sheetTotal: 54.5, readTotal: 54.5 }) === ''
      && m.examinersTotal({ sheetTotalStatus: 'CHECK', sheetTotal: 55, readTotal: 54.5 }) === '',
  },
  {
    name: 'a total typed by hand, or recorded before the paper had questions, stays typed',
    test: (m) => {
      const marked = [{ questionId: 11, marksObtained: 2 }];
      const blank = [{ questionId: 11, marksObtained: null }];
      return m.seededTotal({ status: 'PRESENT', totalMarksObtained: 40, totalByHand: false, questionMarks: blank }) === '40'
        && m.seededTotal({ status: 'PRESENT', totalMarksObtained: 40, totalByHand: true, questionMarks: marked }) === '40'
        && m.seededTotal({ status: 'PRESENT', totalMarksObtained: 2, totalByHand: false, questionMarks: marked }) === ''
        && m.seededTotal({ status: 'ABSENT', totalMarksObtained: null, questionMarks: [] }) === '';
    },
  },
  {
    name: 'a row nobody touched is not saved as a present student who scored nothing',
    test: (m) => m.worthSaving({ status: null }, undefined) === false
      && m.worthSaving({ status: null }, { status: 'PRESENT', marks: { 11: '' }, totalTyped: '' }) === false
      && m.worthSaving({ status: null }, { status: 'PRESENT', marks: { 11: '0' }, totalTyped: '' }) === true
      && m.worthSaving({ status: null }, { status: 'PRESENT', marks: {}, totalTyped: '7' }) === true
      && m.worthSaving({ status: null }, { status: 'ABSENT', marks: {} }) === true
      && m.worthSaving({ status: 'PRESENT' }, { status: 'PRESENT', marks: {} }) === true,
  },
  {
    name: 'with one total, only a mark, an absence or an earlier result is sent — never a blank present row',
    test: (m) => m.totalWorthSaving({ status: null }, { status: 'PRESENT', marksObtained: '' }) === false
      && m.totalWorthSaving({ status: null }, undefined) === false
      && m.totalWorthSaving({ status: null }, { status: 'PRESENT', marksObtained: '0' }) === true
      && m.totalWorthSaving({ status: null }, { status: 'ABSENT', marksObtained: '' }) === true
      && m.totalWorthSaving({ status: 'PRESENT' }, { status: 'PRESENT', marksObtained: '' }) === true,
  },
  {
    name: 'with one total, only a row that CHANGED is sent — an untouched one keeps its question marks',
    test: (m) => {
      const was = { status: 'PRESENT', marksObtained: '12', practicalMarks: '', remarks: '', questionSet: 1 };
      return m.totalRowChanged(was, { ...was }) === false
        && m.totalRowChanged(was, { ...was, marksObtained: '13' }) === true
        && m.totalRowChanged(was, { ...was, practicalMarks: '4' }) === true
        && m.totalRowChanged(was, { ...was, remarks: 'Good' }) === true
        && m.totalRowChanged(was, { ...was, questionSet: 2 }) === true
        && m.totalRowChanged(was, { ...was, status: 'ABSENT' }) === true
        && m.totalRowChanged(was, undefined) === false;
    },
  },
  {
    name: 'a present student needs a written total, in range, before a one-total save — the practical too',
    test: (m) => m.totalRowProblem('Aarav', { status: 'PRESENT', marksObtained: '' }, 40, null) === "Enter Aarav's total too, or mark them absent."
      && m.totalRowProblem('Aarav', { status: 'PRESENT', marksObtained: '', practicalMarks: '9' }, 40, 20) !== null
      && m.totalRowProblem('Aarav', { status: 'ABSENT', marksObtained: '' }, 40, null) === null
      && /between 0 and 40/.test(m.totalRowProblem('Aarav', { status: 'PRESENT', marksObtained: '41' }, 40, null) || '')
      && /practical mark must be between 0 and 20/.test(m.totalRowProblem('Aarav', { status: 'PRESENT', marksObtained: '30', practicalMarks: '21' }, 40, 20) || '')
      && m.totalRowProblem('Aarav', { status: 'PRESENT', marksObtained: '30', practicalMarks: '20' }, 40, 20) === null,
  },
  {
    name: 'an Excel import proposes marks next to the names, skips what it could not read, and saves nothing',
    test: (m) => {
      const before = { 1: { status: 'PRESENT', marksObtained: '', remarks: 'x' } };
      const { edits, applied, problems } = m.applyImportedRows(before, [
        { rowNumber: 2, studentId: 1, marks: 17.5 },
        { rowNumber: 3, studentId: 2, absent: true },
        { rowNumber: 4, studentId: 4, marks: 3, error: 'Mark above the maximum' },
        { rowNumber: 5, studentId: 3 },
      ]);
      return applied === 2 && problems.length === 1 && problems[0].rowNumber === 4
        && edits[1].marksObtained === '17.5' && edits[1].remarks === 'x' && edits[1].status === 'PRESENT'
        && edits[2].status === 'ABSENT' && edits[2].marksObtained === '' && !edits[3] && !edits[4]
        && before[1].marksObtained === '';
    },
  },
  {
    name: "each student is out of the set they sat; an exam with no questions is out of its own total",
    test: (m) => {
      const sheet = { maxMarks: 100, totalQuestionMarks: 40, sets: [{ questionSet: 1, totalMarks: 40 }, { questionSet: 2, totalMarks: 55 }] };
      return JSON.stringify(m.setNumbers(sheet)) === '[1,2]' && JSON.stringify(m.setNumbers({ sets: [] })) === '[1]'
        && m.setOutOfFrom(sheet, 2) === 55 && m.setOutOfFrom(sheet, 1) === 40 && m.setOutOfFrom(sheet, 7) === 40
        && m.setOutOfFrom({ maxMarks: 100, sets: [] }, 1) === 100;
    },
  },
  {
    name: "the review refuses what the website's review and the server refuse",
    test: (m) => {
      const p = (values, totalMarks, typedTotal = '') => m.reviewProblems({ values, totalMarks, typedTotal, studentName: 'Aarav' });
      return p([], '20').some((x) => /at least one question/.test(x))
        && p(['1'], '0').some((x) => /whole number/.test(x))
        && p(['1'], '7.5').some((x) => /whole number/.test(x))
        && p(['-1'], '10').some((x) => /negative/.test(x))
        && p(['5', '6'], '10').some((x) => /add up to 11/.test(x))
        && p(['5', '6'], '10', '10').length === 0
        && p(['1'], '10', '11').some((x) => /Aarav's total must be between 0 and 10/.test(x))
        && p(['2', '', '0'], '20').length === 0;
    },
  },
  {
    name: 'a blank or a dash came in as 0 — nothing to check; a missing or unreadable box is red',
    test: (m) => m.scanTone('EMPTY') === null && m.scanTone('NOT_ATTEMPTED') === null
      && m.scanTone('MISSING') === 'missing' && m.scanTone('UNREADABLE') === 'missing'
      && m.scanTone('CONFLICT') === 'missing' && m.scanTone('VERIFIED') === 'ok' && m.scanTone('CHECK') === 'check',
  },
  {
    name: 'the add-questions offer names the questions the way the sheet does',
    test: (m) => m.questionRange(11, 11) === 'Q11' && m.questionRange(11, 14) === 'Q11–Q14',
  },
];

/** The text between `from` and the next occurrence of `to` after it ('' when either is missing). */
const between = (src, from, to) => {
  const start = src.indexOf(from);
  if (start < 0) return '';
  const end = src.indexOf(to, start + from.length);
  return end < 0 ? '' : src.slice(start, end);
};

/** Every place a function is called, as indexes. */
const callSites = (src, call) => {
  const found = [];
  for (let i = src.indexOf(call); i >= 0; i = src.indexOf(call, i + 1)) found.push(i);
  return found;
};

const fnBody = (src, header) => between(src, header, '\n  };\n');

/** Wiring, on the constructs themselves. Each returns true when it holds. */
const WIRING = [
  // ── the service ────────────────────────────────────────────────────────────────────────────────
  {
    name: 'scan availability is the marks-sheet switch, not the question-paper import',
    test: (s) => s.service.includes("staffApi.get('/api/teacher/reports/scan-available', { signal });")
      && s.service.includes('return res?.marksSheet === true;'),
  },
  {
    name: 'a per-question scan posts the photo and the set, with the long scan timeout',
    test: (s) => s.service.includes('`/api/teacher/reports/exams/${examId}/marks-sheet/scan`,\n    { fields: { questionSet }, files: { file } },\n    { timeoutMs: SCAN_TIMEOUT_MS },'),
  },
  {
    name: 'a one-total scan posts just the photo, with the long scan timeout',
    test: (s) => s.service.includes('`/api/teacher/reports/exams/${examId}/marks-sheet/scan-total`,\n    { files: { file } },\n    { timeoutMs: SCAN_TIMEOUT_MS },'),
  },
  {
    name: 'questions from a sheet go to from-sheet, one slot per question with its maximum or null',
    test: (s) => s.service.includes('staffApi.post(`/api/teacher/reports/exams/${examId}/questions/from-sheet`, {\n    questionSet,\n    questions: maxima.map((marks) => ({ marks })),'),
  },
  {
    name: "the paper's total marks are PUT to total-marks",
    test: (s) => s.service.includes('staffApi.put(`/api/teacher/reports/exams/${examId}/total-marks`, { maxMarks });'),
  },
  {
    name: 'a blank "Marks" in the question editor is sent as no maximum, never 0',
    test: (s) => s.service.includes("marks: form.marks === '' || form.marks == null ? null : Number(form.marks),"),
  },
  {
    name: 'the backend has every endpoint the app calls',
    test: (s) => s.controller.includes('@GetMapping("/scan-available")')
      && s.controller.includes('"marksSheet", reportService.isMarksSheetScanAvailable()')
      && s.controller.includes('@PostMapping("/exams/{examId}/questions/from-sheet")')
      && s.controller.includes('@PutMapping("/exams/{examId}/total-marks")')
      && s.controller.includes('value = "/exams/{examId}/marks-sheet/scan", consumes')
      && s.controller.includes('value = "/exams/{examId}/marks-sheet/scan-total", consumes')
      && s.controller.includes('@RequestParam(value = "questionSet", required = false) Integer questionSet'),
  },
  {
    name: 'a photo is sent as a JPEG of at most 3000 px, like the website',
    test: (s) => s.image.includes('export const SCAN_MAX_SIDE = 3000;')
      && s.image.includes('format: ImageManipulator.SaveFormat.JPEG,')
      && s.image.includes("return { uri: out.uri, name: 'marks-sheet.jpg', type: 'image/jpeg' };"),
  },

  // ── the marks sheet ────────────────────────────────────────────────────────────────────────────
  {
    name: "scanning is offered only when the server's switch says so — toolbar button and scanner panel",
    test: (s) => s.sheet.includes('{scanOn ? (\n                  <LinkButton\n                    icon="camera-outline"')
      && s.sheet.includes('{scanOn && scanPanelOpen ? (')
      && s.sheet.includes('.then((on) => alive && setScanOn(on))')
      && callSites(s.sheet, 'setScanOn(').length === 1,
  },
  {
    name: 'the scanner and the paper review are panels inside the marks sheet, never Modals of their own',
    test: (s) => !s.scanner.includes('FormSheet') && !s.review.includes('FormSheet') && !s.result.includes('FormSheet')
      && callSites(s.sheet, '<FormSheet').length === 1
      && s.sheet.includes('onRead={({ studentId, set, source }) => scanFor(studentId, source, set)}'),
  },
  {
    name: 'questions are created only from the confirmed review or the add-questions offer',
    test: (s) => {
      // Every call, however written — the import names it without a bracket, so it is not one.
      const sites = callSites(s.sheet, 'createQuestionsFromSheet(');
      const create = fnBody(s.sheet, 'const createFromReview = async () => {');
      const add = fnBody(s.sheet, 'const addExtraQuestions = async () => {');
      const inside = (at, body) => body && at >= s.sheet.indexOf(body) && at < s.sheet.indexOf(body) + body.length;
      return sites.length === 2 && sites.every((at) => inside(at, create) || inside(at, add));
    },
  },
  {
    name: 'a paper-from-sheet scan opens the review instead of creating anything',
    test: (s) => /if \(res\?\.paperFromSheet\) \{\s+openReview\(studentId, set, res, false\);\s+return;\s+\}/.test(s.sheet)
      && /if \(!hasQuestions && \(res\?\.marks \|\| \[\]\)\.length > 0\) \{\s+openReview\(studentId, 1, res, true\);\s+return;\s+\}/.test(s.sheet),
  },
  {
    name: 'Create stays disabled while the review has a problem, and refuses if pressed anyway',
    test: (s) => s.review.includes('disabled={busy || issues.length > 0}')
      && s.sheet.includes('issues={reviewIssues}')
      && fnBody(s.sheet, 'const createFromReview = async () => {').includes('if (!r || reviewIssues.length > 0) return;'),
  },
  {
    name: "from the one-total sheet the total marks are set BEFORE any question is created",
    test: (s) => {
      const body = fnBody(s.sheet, 'const createFromReview = async () => {');
      const first = body.indexOf('if (r.fromTotalSheet && totalChanged) await setTotalMarks(exam.id, total);');
      const create = body.indexOf('await createQuestionsFromSheet(exam.id, r.set, r.values.map(() => null));');
      return first > 0 && create > first;
    },
  },
  {
    name: 'nothing is saved but by Save marks',
    test: (s) => {
      const submit = fnBody(s.sheet, 'const submit = async () => {');
      const start = s.sheet.indexOf(submit);
      const saves = [...callSites(s.sheet, 'saveQuestionMarks(exam.id'), ...callSites(s.sheet, 'saveMarks(exam.id')];
      return submit.length > 0 && saves.length === 2 && saves.every((at) => at > start && at < start + submit.length);
    },
  },
  {
    name: 'per question, only rows worth saving are sent',
    test: (s) => s.sheet.includes('? students.filter((student) => worthSaving(student, edits[student.studentId]))')
      && fnBody(s.sheet, 'const submit = async () => {').includes('const toSave = rowsToSave();'),
  },
  {
    name: 'with one total, only rows that changed are sent, and never a blank present row',
    test: (s) => {
      const rows = between(s.sheet, 'const rowsToSave = () =>', 'const submit = async');
      const submit = fnBody(s.sheet, 'const submit = async () => {');
      return rows.includes('totalRowChanged(originals.current[student.studentId], edits[student.studentId]) &&')
        && rows.includes('(totalWorthSaving(student, edits[student.studentId]) ||')
        && submit.includes('const problem = totalRowProblem(');
    },
  },
  {
    name: "a save sends the student's set and only that set's boxes",
    test: (s) => {
      const submit = fnBody(s.sheet, 'const submit = async () => {');
      return callSites(submit, 'questionSet: set,').length === 2
        && submit.includes('columnsFor(set).map(({ question: q }) => ({')
        && !submit.includes('questions.map(');
    },
  },
  {
    name: 'a total typed by hand is sent as typed',
    test: (s) => s.sheet.includes('...(typed ? { totalMarksObtained: Number(entry.totalTyped), totalByHand: true } : {}),'),
  },
  {
    name: 'a mark on a question with no maximum is capped by the paper, not refused',
    test: (s) => s.sheet.includes('sanitise(text, ceilingFor(column.question, outOf))'),
  },
  {
    name: 'a question with no maximum shows no "/n" in its header cell',
    test: (s) => s.sheet.includes("sub: column.choice ? 'either/or' : hasNoMaximum(column.question) ? null : `/${column.question.marks}`,"),
  },
  {
    name: "the marks table is the website's: one cell per box of the student's set, headed Q1 over /5",
    test: (s) => s.sheet.includes('...columnsFor(set).map((column) => ({')
      && s.sheet.includes('title: column.label,')
      && s.sheet.includes('<MarksGrid students={here} columns={questionColumns(set)} />')
      && s.sheet.includes('<MarksGrid students={studentSearch.results} columns={totalColumns} />')
      && s.grid.includes('{column.title}') && s.grid.includes('{column.sub ? ('),
  },
  {
    name: "the marks table shows no question text — the website's cells carry the number and the marks only",
    test: (s) => !s.sheet.includes('questionStatement') && !s.grid.includes('questionStatement'),
  },
  {
    name: 'the student column stays put while the cells scroll sideways',
    test: (s) => s.grid.includes('<View style={grid.frozen}>') && s.grid.includes('horizontal\n        nestedScrollEnabled'),
  },
  {
    name: 'questions added to a paper whose every question has a maximum must say theirs',
    test: (s) => s.sheet.includes("maxima: everyHasAMaximum ? extra.map(() => '') : null,")
      && s.result.includes("disabled={busy || (offer.maxima && offer.maxima.some((m) => m === ''))}"),
  },
  {
    name: 'only a reload after questions were added keeps what was typed',
    test: (s) => s.sheet.includes('if (!keep) return seeded;')
      && callSites(s.sheet, 'keepEdits.current = true;').length === 1,
  },
  {
    name: "changing a student's paper clears what they scored on the other one",
    test: (s) => s.sheet.includes("patch(studentId, { questionSet, marks: {}, totalTyped: '' });")
      && s.sheet.includes("patch(studentId, { questionSet, marksObtained: '' });")
      && s.sheet.includes('onPress={() => pickSet(s)}'),
  },
  {
    name: 'a practical mark is erased only by clearing a box that had one',
    test: (s) => s.sheet.includes("clearPractical: practical === '' && hadPractical,")
      && s.sheet.includes("practicalMarksObtained: practical === '' ? null : Number(practical),"),
  },
  {
    name: 'an Excel import only proposes: it fills the sheet and never saves',
    test: (s) => {
      const body = fnBody(s.sheet, 'const importFile = async () => {');
      return body.includes('applyImportedRows(edits, res?.rows)') && !/save(Question)?Marks\(/.test(body)
        && s.service.includes('staffApi.multipart(`/api/teacher/reports/exams/${examId}/marks/import`, { files: { file } });');
    },
  },
  {
    name: 'either shape switches to the other — per question to one total, and back when there are questions',
    test: (s) => s.sheet.includes('label="Switch to one total per student"')
      && /\) : hasQuestions \? \(\s+<LinkButton\s+icon="swap-horizontal-outline"\s+label="Switch to marks per question"/.test(s.sheet),
  },
  {
    name: 'the scanner asks whose book it is, and offers a new paper when marking per question',
    test: (s) => s.scanner.includes('extra={[{ value: sets.length + 1, label: `Set ${sets.length + 1} (a new paper)` }]}')
      && s.scanner.includes('disabled={!ready}'),
  },
  {
    name: 'a cover naming another student is said before anything is saved — result and review',
    test: (s) => s.result.includes('const mismatch = sheetMismatch(res.header, student);')
      && s.review.includes('const mismatch = sheetMismatch(review.res?.header, student);'),
  },
  {
    name: 'a failure is written on the sheet as well as toasted — never only under the Modal',
    test: (s) => s.sheet.includes('      setError(message);\n      showToast?.(message, \'error\');')
      && !/showToast\?\.\(e\?\.message/.test(s.sheet)
      && s.sheet.includes("fail(e?.message || 'Could not read that marks sheet.');")
      && s.sheet.includes("fail(e?.message || 'Could not save the marks.');"),
  },
  {
    name: "a sheet shows the screen's toast inside itself, and every screen hands it down",
    test: (s) => s.formSheet.includes('const toast = useContext(SheetToastContext);')
      && s.formSheet.includes('<Toast message={toast.message} tone={toast.tone} />')
      && callSites(s.scaffold, '<SheetToastContext.Provider value={toast || null}>').length === 2,
  },
  {
    name: 'no Pressable wraps a sheet\'s scrolling body — the backdrop sits behind the card',
    test: (s) => !s.formSheet.includes('onPress={() => {}}')
      && s.formSheet.includes('style={StyleSheet.absoluteFill}\n          onPress={onClose}')
      && s.formSheet.includes('<View style={[styles.sheet, fullHeight && styles.sheetFull]}>'),
  },
  {
    name: "a question's maths never takes the touch that should scroll the list",
    test: (s) => s.questionHtml.includes('pointerEvents="none">\n      <WebView'),
  },
  {
    name: 'the exam card is refreshed when questions are made from a sheet',
    test: (s) => between(s.screen, '<MarksSheet', '/>').includes('onChanged={revalidateOverview}'),
  },

  // ── the question editor and the analysis ───────────────────────────────────────────────────────
  {
    name: 'editing a question with no maximum leaves "Marks" blank rather than filling in 1',
    test: (s) => s.service.includes("marks: q ? (q.marks == null ? '' : String(q.marks)) : '1',")
      && s.questions.includes('setForm(questionToForm(question));'),
  },
  {
    name: 'the question list says "no maximum" rather than "0 marks"',
    test: (s) => s.questions.includes("{itemHasNoMaximum(item) ? 'no maximum' : `${itemMarks(item)} marks`}")
      && s.questions.includes("{part.marks == null ? 'no maximum' : `${part.marks} marks`}"),
  },
  {
    name: 'the analysis shows a question with no maximum as scored, with no percentage',
    test: (s) => s.analysis.includes('{outOf == null\n                          ? `${q.marksObtained ?? 0}/—`'),
  },
];

// ── Mutations ──────────────────────────────────────────────────────────────────────────────────────
// [name, file key, from, to]. Utility mutations are re-evaluated and must break a behaviour.
const MUTATIONS = [
  // behaviour
  ['a parted question is filled from its one box', 'util', 'if (!item || item.parts.length > 0) return;', 'if (!item) return;'],
  ['startAt is ignored', 'util', 'entry.questionNumber : startAt + i;', 'entry.questionNumber : 1 + i;'],
  ['the sheet\'s question number is ignored', 'util', 'const number = isEntry && Number.isInteger(entry.questionNumber) ? entry.questionNumber : startAt + i;', 'const number = startAt + i;'],
  ['another roll number is taken for a match', 'util', 'return sheetRoll === studentRoll\n      ? null', 'return true\n      ? null'],
  ['a name with nothing in common passes', 'util', '!sheetName.some((w) => studentName.includes(w))', 'false'],
  ['an either/or choice becomes two items', 'util', 'const existing = q.eitherOrGroup ? itemByGroup.get(q.eitherOrGroup) : null;', 'const existing = null;'],
  ['the paper is not put in order', 'util', '.sort((a, b) => (a.questionOrder ?? 0) - (b.questionOrder ?? 0));\n\n  const partsByParent', ';\n\n  const partsByParent'],
  ['another set leaks in', 'util', ".filter((q) => (q.questionSet || 1) === set)\n    .sort(", '.filter(() => true)\n    .sort('],
  ['a part is labelled as a question of its own', 'util', 'label: `Q${index + 1}${String.fromCharCode(97 + (p % 26))}`,', 'label: `Q${index + 2 + p}`,'],
  ['an unread box is guessed as 0', 'util', 'if (value != null) marks[id] = String(value);', 'marks[id] = String(value ?? 0);'],
  ['the total counts every mark typed', 'util', 'return (columns || []).reduce((sum, column) => sum + (Number(marks?.[column.question.id]) || 0), 0);', 'return Object.values(marks || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);'],
  ['a passage with a null maximum opens the paper', 'util', 'markingColumns(paperItems(questions, set)).some((column) => column.question.marks == null),', '(questions || []).some((question) => question.marks == null),'],
  ['an unverified sheet total becomes the typed total', 'util', "if (!response || response.sheetTotalStatus !== 'VERIFIED') return '';", "if (!response) return '';"],
  ['a flat total recorded before questions is lost', 'util', "return row.totalByHand || !hasBreakdown ? String(row.totalMarksObtained) : '';", "return row.totalByHand ? String(row.totalMarksObtained) : '';"],
  ['an untouched row is saved as a zero', 'util', "return Object.values(entry.marks || {}).some((v) => v !== '' && v != null);", 'return true;'],
  ['a blank present row is sent with one total', 'util', "return entry.marksObtained !== '' && entry.marksObtained != null;", 'return true;'],
  ['the review lets marks exceed the total', 'util', "if ((typedTotal ?? '') === '' && Number.isInteger(outOf) && outOf >= 1 && sum > outOf) {", 'if (false) {'],
  ['a blank is flagged for checking', 'util', "  VERIFIED: 'ok',", "  VERIFIED: 'ok',\n  EMPTY: 'check',"],
  ['a question with no maximum is capped at nothing', 'util', 'question?.marks != null ? question.marks : paperOutOf ?? null;', 'question?.marks ?? 0;'],
  // service
  ['availability reads the question-paper switch', 'service', 'return res?.marksSheet === true;', 'return res?.available === true;'],
  ['the scan loses its set', 'service', '{ fields: { questionSet }, files: { file } },', '{ files: { file } },'],
  ['the scan uses the default upload timeout', 'service', '    { files: { file } },\n    { timeoutMs: SCAN_TIMEOUT_MS },', '    { files: { file } },\n    {},'],
  ['from-sheet drops the maxima', 'service', 'questions: maxima.map((marks) => ({ marks })),', 'questions: maxima.map(() => ({})),'],
  ['a blank question maximum is sent as 0', 'service', "marks: form.marks === '' || form.marks == null ? null : Number(form.marks),", 'marks: Number(form.marks) || 0,'],
  ['the backend loses from-sheet', 'controller', '@PostMapping("/exams/{examId}/questions/from-sheet")', '@PostMapping("/exams/{examId}/questions/from-sheet-x")'],
  ['the photo is not made a JPEG', 'image', 'format: ImageManipulator.SaveFormat.JPEG,', 'format: ImageManipulator.SaveFormat.PNG,'],
  // screen
  ['the toolbar scans without asking the server', 'sheet', '{scanOn ? (\n                  <LinkButton\n                    icon="camera-outline"', '{true ? (\n                  <LinkButton\n                    icon="camera-outline"'],
  ['the scanner panel shows without asking the server', 'sheet', '{scanOn && scanPanelOpen ? (', '{scanPanelOpen ? ('],
  ['scanning is switched on regardless', 'sheet', '.then((on) => alive && setScanOn(on))', '.then(() => alive && setScanOn(true))'],
  ['the scanner is a Modal again', 'scanner', "import { SLATE } from '../../../../constants/theme';", "import { SLATE } from '../../../../constants/theme';\nimport { FormSheet } from '../../../ui';"],
  ['a scanned paper is created without the review', 'sheet', 'if (res?.paperFromSheet) {\n          openReview(studentId, set, res, false);', 'if (res?.paperFromSheet) {\n          await createQuestionsFromSheet(exam.id, set, []);'],
  ['Create is enabled despite a problem', 'review', 'disabled={busy || issues.length > 0}', 'disabled={busy}'],
  ['Create ignores the problems', 'sheet', 'if (!r || reviewIssues.length > 0) return;', 'if (!r) return;'],
  ['the total marks are set after the questions', 'sheet', '      if (r.fromTotalSheet && totalChanged) await setTotalMarks(exam.id, total);\n', ''],
  ['a scan saves on its own', 'sheet', "setScanInfo((prev) => ({ ...prev, [studentId]: statuses }));", "setScanInfo((prev) => ({ ...prev, [studentId]: statuses }));\n        await saveQuestionMarks(exam.id, []);"],
  ['every row is sent per question', 'sheet', '? students.filter((student) => worthSaving(student, edits[student.studentId]))', '? students'],
  ['the save ignores the rows worth saving', 'sheet', 'const toSave = rowsToSave();', 'const toSave = students;'],
  ['untouched one-total rows are re-sent, wiping question marks', 'sheet', 'totalRowChanged(originals.current[student.studentId], edits[student.studentId]) &&', 'true &&'],
  ['a blank present row is sent with one total', 'sheet', 'const problem = totalRowProblem(', 'const problem = null && totalRowProblem('],
  ['changing the paper keeps the old marks', 'sheet', "patch(studentId, { questionSet, marks: {}, totalTyped: '' });", 'patch(studentId, { questionSet });'],
  ['the Set cell cannot move a student', 'sheet', 'onPress={() => pickSet(s)}', 'onPress={() => {}}'],
  ['the question text is back in the marks table', 'sheet', 'title: column.label,', 'title: column.question.questionStatement || column.label,'],
  ['the student column scrolls away with the cells', 'grid', '<View style={grid.frozen}>', '<View>'],
  ['a failure goes only to the toast, under the Modal', 'sheet', "      setError(message);\n      showToast?.(message, 'error');", "      showToast?.(message, 'error');"],
  ['a save failure is only toasted', 'sheet', "fail(e?.message || 'Could not save the marks.');", "showToast?.(e?.message || 'Could not save the marks.', 'error');"],
  ['the sheet shows no toast', 'formSheet', '<Toast message={toast.message} tone={toast.tone} />', 'null'],
  ['the scaffold hands no toast down', 'scaffold', '<SheetToastContext.Provider value={toast || null}>', '<SheetToastContext.Provider value={null}>'],
  ['the card swallows taps around the scroll again', 'formSheet', '<View style={[styles.sheet, fullHeight && styles.sheetFull]}>', '<Pressable style={[styles.sheet, fullHeight && styles.sheetFull]} onPress={() => {}}>'],
  ['maths takes the touch', 'questionHtml', 'pointerEvents="none">\n      <WebView', '>\n      <WebView'],
  ['the result names no mismatch', 'result', 'const mismatch = sheetMismatch(res.header, student);', 'const mismatch = null;'],
  ['every blank practical box erases a mark', 'sheet', "clearPractical: practical === '' && hadPractical,", "clearPractical: practical === '',"],
  ['the Excel import saves on its own', 'sheet', "      setNotice(`${parts.join('. ')}.`);", "      setNotice(`${parts.join('. ')}.`);\n      await saveMarks(exam.id, []);"],
  ['there is no way back to marks per question', 'sheet', 'label="Switch to marks per question"', 'label="Marks per question"'],
  ['the scanner offers no new paper', 'scanner', 'extra={[{ value: sets.length + 1, label: `Set ${sets.length + 1} (a new paper)` }]}', 'extra={[]}'],
  ['an untouched row is reported as changed', 'util', 'return TOTAL_FIELDS.some((field) => !same(original?.[field], entry[field]));', 'return true;'],
  ['a present student with only a practical mark is sent', 'util', "    return `Enter ${name}'s total too, or mark them absent.`;", '    return null;'],
  ['an import applies unreadable rows', 'util', '      problems.push({ rowNumber: row.rowNumber, error: row.error });\n      return;', '      problems.push({ rowNumber: row.rowNumber, error: row.error });'],
  ['every set is out of the first', 'util', 'sets.find((s) => s.questionSet === set)?.totalMarks ??', 'sets[0]?.totalMarks ??'],
  ['the save sends every question of the exam', 'sheet', 'columnsFor(set).map(({ question: q }) => ({', 'questions.map((q) => ({'],
  ["the per-question save leaves out the student's set", 'sheet', '            remarks: entry.remarks || null,\n            questionSet: set,\n', '            remarks: entry.remarks || null,\n'],
  ["the one-total save leaves out the student's set", 'sheet', '          status: entry.status || EXAM_STATUS.PRESENT,\n          questionSet: set,\n', '          status: entry.status || EXAM_STATUS.PRESENT,\n'],
  ['a typed total is not sent', 'sheet', 'totalMarksObtained: Number(entry.totalTyped), totalByHand: true', 'totalMarksObtained: Number(entry.totalTyped)'],
  ['a mark on an open question is capped at its null maximum', 'sheet', 'sanitise(text, ceilingFor(column.question, outOf))', 'sanitise(text, column.question.marks)'],
  ['an open question shows "/0"', 'sheet', "hasNoMaximum(column.question) ? null : `/${column.question.marks}`,", '`/${column.question.marks ?? 0}`,'],
  ['the table lists every question', 'sheet', '...columnsFor(set).map((column) => ({', '...markingColumns(paperItems(sheet?.questions, 1)).map((column) => ({'],
  ['new questions on a closed paper go in without a maximum', 'sheet', "maxima: everyHasAMaximum ? extra.map(() => '') : null,", 'maxima: null,'],
  ['a reopened sheet keeps last time\'s unsaved marks', 'sheet', 'if (!keep) return seeded;', 'if (false) return seeded;'],
  ['the exam card is not refreshed', 'screen', "        // Questions made from a scanned answer book change the exam card's count and total even\n        // before anything is saved.\n        onChanged={revalidateOverview}\n", ''],
  ['editing an open question fills in 1', 'service', "marks: q ? (q.marks == null ? '' : String(q.marks)) : '1',", 'marks: String(q?.marks ?? 1),'],
  ['the list says "0 marks"', 'questions', "{itemHasNoMaximum(item) ? 'no maximum' : `${itemMarks(item)} marks`}", '{`${itemMarks(item)} marks`}'],
  ['the analysis shows "/0 · 0%"', 'analysis', '? `${q.marksObtained ?? 0}/—`', '? `${q.marksObtained ?? 0}/0 · 0%`'],
];

const runWiring = (sources) => WIRING.filter((a) => !a.test(sources)).map((a) => a.name);

const runBehaviour = async (utilSrc) => {
  const m = await evaluate(utilSrc);
  if (m.__error) return [`utils/marksSheetScan.js does not evaluate: ${m.__error}`];
  return BEHAVIOUR.filter((b) => {
    try {
      return !b.test(m);
    } catch {
      return true;
    }
  }).map((b) => b.name);
};

const sources = load();

const failing = [...(await runBehaviour(sources.util)), ...runWiring(sources)];
if (failing.length) {
  console.error('checkexamscan FAILED:');
  failing.forEach((name) => console.error(`  ✗ ${name}`));
  process.exit(1);
}

let problems = 0;
for (const [name, key, from, to] of MUTATIONS) {
  if (!sources[key].includes(from)) {
    console.error(`  ✗ could not plant "${name}" — that mutation is inert and proves nothing`);
    problems += 1;
    continue;
  }
  const mutated = { ...sources, [key]: sources[key].replace(from, to) };
  if (mutated[key] === sources[key]) {
    console.error(`  ✗ "${name}" changed nothing — inert`);
    problems += 1;
    continue;
  }
  const caught = key === 'util'
    ? (await runBehaviour(mutated.util)).length > 0
    : runWiring(mutated).length > 0;
  if (!caught) {
    console.error(`  ✗ NOT CAUGHT: ${name}`);
    problems += 1;
  }
}

if (problems) {
  console.error(`checkexamscan: ${problems} mutation problem(s).`);
  process.exit(1);
}
console.log(
  `checkexamscan PASSED: ${BEHAVIOUR.length} behaviours, ${WIRING.length} wiring assertions, `
    + `${MUTATIONS.length} mutations all caught.`,
);
