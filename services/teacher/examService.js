// services/teacher/examService.js
// Mirrors: frontendmain/src/School/Teacher/pages/TeacherReports.js and the shared grids
//          (QuestionManager, ExamMarksGrid, QuestionMarksGrid, ExamAnalysisCharts, SkillGauge)
// Backend: report/controller/TeacherReportController.java — class-level
//          @PreAuthorize("hasAnyRole('TEACHER','VICE_PRINCIPAL')")
//
// TEACHERS CANNOT CREATE, EDIT OR DELETE EXAMS, and cannot change `visibleToParents`. Exam
// definitions belong to the School Admin / Principal. The only writes here are question CRUD and
// marks — there is no exam-definition endpoint in this controller at all.

import { staffApi } from '../staffApi';
import { classesFromSchoolClasses } from './scopeService';

/** Returns `SchoolClassResponse[]`, whose ids are `id` not `classId` — hence the adapter. */
export const examClassesLoader = classesFromSchoolClasses('/api/teacher/reports/my-classes');

export const EXAM_STATUS = { PRESENT: 'PRESENT', ABSENT: 'ABSENT' };

/** From School/shared/testQuestionOptions.js. */
export const QUESTION_TYPES = [
  { value: 'MCQ', label: 'Multiple Choice (MCQ)' },
  { value: 'TRUE_FALSE', label: 'True / False' },
  { value: 'SHORT_ANSWER', label: 'Short Answer' },
  { value: 'LONG_ANSWER', label: 'Long Answer' },
  { value: 'FILL_IN_THE_BLANK', label: 'Fill in the Blank' },
  // Text that is read rather than answered — an unseen passage, a case study, a set of
  // instructions. It carries no marks of its own; the lettered sub-questions under it do.
  { value: 'PARAGRAPH', label: 'Paragraph' },
];

/** Sorted case-insensitively, as the website's src/common/questionTaxonomy.js sorts its lists. */
const alphabetical = (values) => [...values].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

/** The website's BLOOM_TAXONOMY (src/common/questionTaxonomy.js), same order. */
export const BLOOM_TAXONOMY = alphabetical([
  'Remembering', 'Understanding', 'Applying', 'Analyzing',
  'Evaluating', 'Creating', 'Arts', 'Commerce', 'Science',
]);

/**
 * The website's SKILL_SETS (src/common/questionTaxonomy.js) — the built-in list. What a school adds
 * through "+ Add a new skill set" comes from `/api/teacher/question-skills` and is merged on top at
 * the picker (`mergeSkillSets`). 40 entries — this is why components/ui/Select grew a `searchable`
 * variant.
 */
export const SKILLS_MEASURED = alphabetical([
  'Recall', 'Comprehension', 'Conceptual Understanding', 'Reasoning', 'Identification',
  'Application', 'Reflection',
  'Critical Thinking', 'Innovation', 'Communication', 'Collaboration', 'Creativity',
  'Digital literacy', 'Problem Solving', 'Leadership',
  'Self-awareness & Regulation', 'Empathy & Social Skills', 'Decision-Making',
  'Emotional Balance', 'Resilience & Optimism', 'Confidence & Responsibility',
  'Growth Mindset', 'Adaptability', 'Self-discipline', 'Future Orientation',
  'Science Aptitude', 'Commerce Aptitude', 'Humanities Aptitude',
  'Skill-based / Applied Learning',
  'Academic Rigor & Depth', 'Stream Confidence & Openness', 'Exploratory Curiosity',
  'Practical & Project Interest', 'Business / Social / People Interest',
  'Analytical & Research Interest', 'Creative & Innovation Interest',
  'Focus & Study Discipline', 'Learning Strategy Awareness',
  'Time & Stress Management', 'Adaptability & Help-Seeking',
  'Ownership & Academic Readiness',
]);

/**
 * Built-ins and a school's additions in one alphabetical list — the website's SkillSetSelect. A
 * skill matching a built-in apart from its capitalisation is the built-in, and a skill already on
 * the question stays in the list even if it is no longer offered, or picking nothing else would
 * blank it.
 */
export function mergeSkillSets(builtIn, added, current) {
  const seen = new Set();
  const merged = [];
  const norm = (v) => String(v || '').trim().toLowerCase();
  [...(builtIn || []), ...(added || [])].forEach((name) => {
    const key = norm(name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(name);
  });
  if (current && !seen.has(norm(current))) merged.push(current);
  return merged.sort((a, b) => a.localeCompare(b));
}

/** The school's own skill sets, added through "+ Add a new skill set". */
export async function fetchSchoolSkillSets(signal) {
  const res = await staffApi.get('/api/teacher/question-skills', { signal });
  return Array.isArray(res) ? res : [];
}

/** Adds a skill set for the whole school; returns the school's list, the new one included. */
export async function addSchoolSkillSet(name) {
  const res = await staffApi.post('/api/teacher/question-skills', { name });
  return Array.isArray(res) ? res : [];
}

/** The subject's exams, plus the header info. */
export function fetchSubjectOverview({ sectionId, subjectId }, signal) {
  return staffApi.get('/api/teacher/reports/subject-overview', {
    params: { sectionId, subjectId },
    signal,
  });
}

// ── marks ───────────────────────────────────────────────────────────────────
//
// WHICH GRID A TEACHER GETS IS DECIDED BY THE DATA, NOT BY THEM: `exam.questionCount > 0` means
// per-question marking, otherwise flat marks. Add the first question to an exam and its marks
// screen silently changes shape.

export function fetchMarksSheet(examId, signal) {
  return staffApi.get(`/api/teacher/reports/exams/${examId}/marks-sheet`, { signal });
}

/**
 * Flat marks. Each entry is written on its own, so send only the rows with something to save — a
 * mark, an absence, or a result already on file. A present student with no mark is refused ("Marks
 * are required for …") and takes the whole save down with it. An ABSENT student must carry
 * `marksObtained: null`.
 */
export function saveMarks(examId, entries) {
  return staffApi.post(`/api/teacher/reports/exams/${examId}/marks`, { entries });
}

export function fetchQuestionMarksSheet(examId, signal) {
  return staffApi.get(`/api/teacher/reports/exams/${examId}/question-marks-sheet`, { signal });
}

/**
 * Per-question marks.
 *
 * ABSENT is encoded differently from the flat endpoint: instead of a null mark, the entire
 * `questionMarks` array is dropped (`[]`). Build the array from the student's set's boxes rather
 * than from the edit map, so every question is represented — untouched ones as null — and questions
 * added since the sheet loaded are still included. Only that set: the server refuses a mark for a
 * question that is not on the paper the student sat.
 */
export function saveQuestionMarks(examId, entries) {
  return staffApi.post(`/api/teacher/reports/exams/${examId}/question-marks`, { entries });
}

// ── Scanning a marked answer book ─────────────────────────────────────────────
// The server reads the cover, checks it against the sheet's own totals, and reads it again more
// carefully when they disagree — up to a minute and a half on a slow network, so the timeout is
// well past the multipart default. Nothing here saves a mark: the reading comes back for the
// teacher to check.
const SCAN_TIMEOUT_MS = 150000;

/** Whether this site can read a marked answer book's cover at all (the server's switch). */
export async function fetchScanAvailable(signal) {
  const res = await staffApi.get('/api/teacher/reports/scan-available', { signal });
  return res?.marksSheet === true;
}

/** Reads a cover against one set of the paper — or, for a set with no questions, as its paper. */
export function scanMarksSheet(examId, file, questionSet) {
  return staffApi.multipart(
    `/api/teacher/reports/exams/${examId}/marks-sheet/scan`,
    { fields: { questionSet }, files: { file } },
    { timeoutMs: SCAN_TIMEOUT_MS },
  );
}

/** Reads a cover for an exam marked by total, including one with no questions yet. */
export function scanMarksSheetTotal(examId, file) {
  return staffApi.multipart(
    `/api/teacher/reports/exams/${examId}/marks-sheet/scan-total`,
    { files: { file } },
    { timeoutMs: SCAN_TIMEOUT_MS },
  );
}

/**
 * Adds the questions a scanned sheet has and the paper does not — only ever after the teacher has
 * looked at them. `maxima` is one entry per question: what it is out of, or null for none.
 */
export function createQuestionsFromSheet(examId, questionSet, maxima) {
  return staffApi.post(`/api/teacher/reports/exams/${examId}/questions/from-sheet`, {
    questionSet,
    questions: maxima.map((marks) => ({ marks })),
  });
}

/** What a paper made from an answer book is out of: the exam's total marks. */
export function setTotalMarks(examId, maxMarks) {
  return staffApi.put(`/api/teacher/reports/exams/${examId}/total-marks`, { maxMarks });
}

/**
 * What this exam's practical component is out of — or `null` to remove it. A decision about the
 * paper, made once; the server refuses a figure below a practical mark already entered and names
 * the students in the way.
 */
export function setPracticalMaxMarks(examId, practicalMaxMarks) {
  return staffApi.put(`/api/teacher/reports/exams/${examId}/practical`, { practicalMaxMarks });
}

// ── Excel ────────────────────────────────────────────────────────────────────
// The website's "Download Template" and "Import from Excel". The import only PROPOSES: the parsed
// numbers land in the sheet next to the right names and nothing is saved until Save marks — a
// spreadsheet is the easiest place to get a whole class wrong at once.

/** The roster as a spreadsheet to type marks into — the path for `utils/downloadFile`. */
export const marksTemplatePath = (examId) => `/api/teacher/reports/exams/${examId}/marks/template`;

/** The Content-Type the template arrives as, checked by `downloadAndShare`. */
export const XLSX_TYPE = 'spreadsheetml';

/**
 * Reads a filled-in marks file (.xlsx, .xls or .csv). Returns `{ rows: [{ rowNumber, studentId,
 * marks, absent, error }] }` — a row with `error` was skipped and says why.
 */
export function importMarksFile(examId, file) {
  return staffApi.multipart(`/api/teacher/reports/exams/${examId}/marks/import`, { files: { file } });
}

// ── questions ───────────────────────────────────────────────────────────────

export async function fetchExamQuestions(examId, signal) {
  const res = await staffApi.get(`/api/teacher/reports/exams/${examId}/questions`, { signal });
  return Array.isArray(res) ? res : [];
}

/**
 * Chapters (with their topics) for the exam's own subject — `sectionSubjectId` is the scope's
 * SchoolSectionSubject id, NOT an Academic IQ id. The server works out whether the subject is backed
 * by Academic IQ, Coding Pro, Language Pro or nothing at all, and merges in what the school added,
 * so every subject has chapters to pick. `[{ id, name, topics: [{ id, name, displayName }] }]`.
 */
export async function fetchSubjectChapters(sectionSubjectId, signal) {
  const res = await staffApi.get(`/api/teacher/curriculum/subjects/${sectionSubjectId}/chapters`, { signal });
  return Array.isArray(res) ? res : [];
}

/** Adds a chapter the curriculum does not have; returns the whole list, merged and ordered. */
export async function addSubjectChapter(sectionSubjectId, name) {
  const res = await staffApi.post(`/api/teacher/curriculum/subjects/${sectionSubjectId}/chapters`, { name });
  return Array.isArray(res) ? res : [];
}

/** Adds a topic under a chapter (by its name); returns the whole list, merged and ordered. */
export async function addSubjectTopic(sectionSubjectId, chapterName, name) {
  const res = await staffApi.post(`/api/teacher/curriculum/subjects/${sectionSubjectId}/topics`, {
    name,
    chapterName,
  });
  return Array.isArray(res) ? res : [];
}

/**
 * Stores one picture for a question, an option or a sample answer, the moment it is chosen — a
 * half-written question has no id to hang a file off. Returns its URL.
 */
export async function uploadQuestionImage(file) {
  const res = await staffApi.multipart('/api/teacher/reports/question-images', { files: { file } });
  if (!res?.url) throw new Error(res?.message || 'Could not store the image. Please try again.');
  return res.url;
}

/**
 * Puts one paper (set) in a new order — every question id of it, in order: a choice's alternatives
 * together, a question's parts right after it. Returns the exam's whole question list.
 */
export async function reorderQuestions(examId, questionIds) {
  const res = await staffApi.put(`/api/teacher/reports/exams/${examId}/questions/order`, { questionIds });
  return Array.isArray(res) ? res : null;
}

/** Joins questions into one either/or choice. Returns the exam's whole question list. */
export async function joinEitherOr(examId, questionIds) {
  const res = await staffApi.post(`/api/teacher/reports/exams/${examId}/questions/either-or`, { questionIds });
  return Array.isArray(res) ? res : null;
}

/** Splits an either/or choice back into separate questions. Returns the whole list. */
export async function splitEitherOr(examId, groupId) {
  const res = await staffApi.del(
    `/api/teacher/reports/exams/${examId}/questions/either-or/${encodeURIComponent(groupId)}`,
  );
  return Array.isArray(res) ? res : null;
}

/** Papers of this teacher's other classes that could be copied in here. */
export async function fetchCopySources(examId, signal) {
  const res = await staffApi.get(`/api/teacher/reports/exams/${examId}/questions/copy-sources`, { signal });
  return Array.isArray(res) ? res : [];
}

/** The same exam in the grade's other sections this teacher teaches — where this paper can go. */
export async function fetchCopyTargets(examId, signal) {
  const res = await staffApi.get(`/api/teacher/reports/exams/${examId}/questions/copy-targets`, { signal });
  return Array.isArray(res) ? res : [];
}

/**
 * Pulls another class's paper in. `questionSets` null = every set; a chosen list becomes Set 1, 2…
 * here. Returns `{ copiedQuestions, targetsUpdated, targetsSkipped, details: [{label, skippedReason}] }`.
 */
export function copyPaperFrom(examId, { sourceExamId, questionSets, replaceExisting }) {
  return staffApi.post(`/api/teacher/reports/exams/${examId}/questions/copy-from`, {
    sourceExamId,
    questionIds: null,
    questionSets: questionSets && questionSets.length ? questionSets : null,
    replaceExisting: !!replaceExisting,
  });
}

/** Pushes this paper out to other sections. Same result shape as `copyPaperFrom`. */
export function copyPaperTo(examId, { targetExamIds, questionSets, replaceExisting }) {
  return staffApi.post(`/api/teacher/reports/exams/${examId}/questions/copy-to`, {
    targetExamIds,
    questionIds: null,
    questionSets: questionSets && questionSets.length ? questionSets : null,
    replaceExisting: !!replaceExisting,
  });
}

/**
 * Reads a question paper — a PDF, or (where the server's photo reading is on) a photographed page —
 * into questions to review. Nothing is created: returns `{ questions, message }`, each question
 * `{ questionType, questionStatement, optionA–D, chapterName, topicName, bloomsTaxonomy, skillSet,
 * sampleAnswer, marks, questionImageUrl }`.
 */
export async function parseQuestionPaper(file) {
  const res = await staffApi.multipart('/api/teacher/reports/pdf/parse-questions', { files: { file } }, {
    timeoutMs: 120000,
  });
  // Questions found: the list itself. None: `{ questions: [], message }`, the message naming the two
  // layouts the parser understands — worth showing rather than a bare "nothing found".
  if (Array.isArray(res)) return { questions: res, message: null };
  if (Array.isArray(res?.questions)) return { questions: res.questions, message: res.message || null };
  throw new Error(res?.message || res?.error || 'Could not read that file.');
}

/** Whether a photographed question paper can be read here (Cloud Vision) — `available`. */
export async function fetchPhotoImportAvailable(signal) {
  const res = await staffApi.get('/api/teacher/reports/scan-available', { signal });
  return res?.available === true;
}

/** The school's name and logo, for the printed paper's heading. */
export function fetchTeacherProfile(signal) {
  return staffApi.get('/api/teacher/profile', { signal });
}

export function createExamQuestion(examId, payload) {
  return staffApi.post(`/api/teacher/reports/exams/${examId}/questions`, payload);
}

export function updateExamQuestion(examId, questionId, payload) {
  return staffApi.put(`/api/teacher/reports/exams/${examId}/questions/${questionId}`, payload);
}

export function deleteExamQuestion(examId, questionId) {
  return staffApi.del(`/api/teacher/reports/exams/${examId}/questions/${questionId}`);
}

/** The six picture fields a question carries — what the backend's `applyImages` writes. */
export const QUESTION_IMAGE_KEYS = [
  'questionImageUrl',
  'optionAImageUrl',
  'optionBImageUrl',
  'optionCImageUrl',
  'optionDImageUrl',
  'sampleAnswerImageUrl',
];

/**
 * Question payload — the website's QuestionManager.handleSave.
 *
 * EVERY FIELD THE SERVER WRITES IS SENT. An update overwrites the chapter, the topic and all six
 * pictures from the request (TeacherReportService.updateQuestion → applyImages), so a field this
 * form does not show must still go back with the value it came with — leaving one out erased it.
 * That is how editing a question here used to delete its pictures and its chapter.
 *
 * Chapter and topic are carried as both id and name (denormalised, so the label survives later
 * curriculum edits); a name the curriculum does not know is kept as it is. Non-MCQ types drop the
 * four options and their pictures, so a stray diagram never resurfaces on a short-answer question.
 *
 * @param form    the question form (chapterId/chapterName/topicId/topicName, the texts, the six
 *                picture URLs, marks)
 * @param extras  `{ questionSet, parentQuestionId }` — only meaningful when creating
 */
export function buildQuestionPayload(form, extras = {}) {
  const isMcq = form.questionType === 'MCQ';
  const text = (value) => {
    const v = String(value ?? '').trim();
    return v === '' || v === '<p></p>' ? null : v;
  };
  const id = (value) => (value === '' || value == null ? null : Number(value));
  return {
    chapterId: id(form.chapterId),
    chapterName: text(form.chapterName),
    topicId: id(form.topicId),
    topicName: text(form.topicName),
    questionType: form.questionType,
    questionStatement: String(form.questionStatement || '').trim(),
    optionA: isMcq ? text(form.optionA) : null,
    optionB: isMcq ? text(form.optionB) : null,
    optionC: isMcq ? text(form.optionC) : null,
    optionD: isMcq ? text(form.optionD) : null,
    questionImageUrl: text(form.questionImageUrl),
    optionAImageUrl: isMcq ? text(form.optionAImageUrl) : null,
    optionBImageUrl: isMcq ? text(form.optionBImageUrl) : null,
    optionCImageUrl: isMcq ? text(form.optionCImageUrl) : null,
    optionDImageUrl: isMcq ? text(form.optionDImageUrl) : null,
    sampleAnswerImageUrl: text(form.sampleAnswerImageUrl),
    bloomsTaxonomy: form.bloomsTaxonomy || null,
    skillSet: form.skillSet || null,
    sampleAnswer: text(form.sampleAnswer),
    // Left blank, the question has no maximum of its own and the paper is marked out of its total
    // marks — how a paper made from a scanned answer book starts. Never 0 for "blank": a question
    // worth nothing refuses every mark.
    marks: form.marks === '' || form.marks == null ? null : Number(form.marks),
    // The paper being looked at. A sub-question ignores this and joins its parent's set.
    questionSet: extras.questionSet ?? 1,
    // Only when creating: a part does not change which question it belongs to.
    parentQuestionId: extras.parentQuestionId ?? null,
  };
}

/** A question as the form holds it: every field, blanks as '' — including the ones not shown. */
export function questionToForm(q) {
  const form = {
    chapterId: q?.chapterId != null ? String(q.chapterId) : '',
    chapterName: q?.chapterName || '',
    topicId: q?.topicId != null ? String(q.topicId) : '',
    topicName: q?.topicName || '',
    questionType: q?.questionType || 'MCQ',
    questionStatement: q?.questionStatement || '',
    optionA: q?.optionA || '',
    optionB: q?.optionB || '',
    optionC: q?.optionC || '',
    optionD: q?.optionD || '',
    bloomsTaxonomy: q?.bloomsTaxonomy || '',
    skillSet: q?.skillSet || '',
    sampleAnswer: q?.sampleAnswer || '',
    // Blank for a question with no maximum of its own — one made from a scanned answer book.
    marks: q ? (q.marks == null ? '' : String(q.marks)) : '1',
  };
  QUESTION_IMAGE_KEYS.forEach((key) => {
    form[key] = q?.[key] || '';
  });
  return form;
}

// ── view report ─────────────────────────────────────────────────────────────

export async function fetchSectionStudents({ sectionId, subjectId }, signal) {
  const res = await staffApi.get('/api/teacher/reports/section-students', {
    params: { sectionId, subjectId },
    signal,
  });
  return Array.isArray(res) ? res : [];
}

export async function fetchStudentTestSummary({ sectionId, subjectId, studentId }, signal) {
  const res = await staffApi.get('/api/teacher/reports/student-test-summary', {
    params: { sectionId, subjectId, studentId },
    signal,
  });
  return Array.isArray(res) ? res : [];
}

/**
 * One student's breakdown for one exam.
 *
 * `bloomsBreakdown` / `skillBreakdown` rows are `{ tag, obtainedMarks, maxMarks, percentage,
 * classAveragePercentage }`; `questionScores` rows carry `questionOrder`, `questionStatement`,
 * `chapterName`, `topicName`, `marksObtained`, `maxMarks`, `bloomsTaxonomy`, `skillSet`.
 */
export function fetchExamAnalysis({ examId, studentId }, signal) {
  return staffApi.get(`/api/teacher/reports/exams/${examId}/students/${studentId}/analysis`, {
    signal,
  });
}
