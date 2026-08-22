// services/teacher/adaptiveService.js
// Mirrors: frontendmain/src/School/Teacher/pages/TeacherAdaptiveAssessment.js
//          + components/AdaptiveReportCharts + components/PdfQuestionImporter
// Backend: universaladaptive/controller/TeacherPracticeQuestionController.java
//          @PreAuthorize("hasAnyRole('TEACHER','VICE_PRINCIPAL')")
//
// A per-topic switch. OFF, students get the company question bank; ON, they get the teacher's own
// questions plus whichever company questions the teacher selected.

import { staffApi } from '../staffApi';
import { classesFromSchoolClasses } from './scopeService';

/** Same `SchoolClassResponse` tree as Test and Examination — ids are `id`, hence the adapter. */
export const adaptiveClassesLoader = classesFromSchoolClasses('/api/teacher/reports/my-classes');

export const DIFFICULTIES = [
  { value: 'BASIC', label: 'Basic' },
  { value: 'INTERMEDIATE', label: 'Intermediate' },
  { value: 'ADVANCED', label: 'Advanced' },
];

export const levelLabel = (value) =>
  DIFFICULTIES.find((d) => d.value === value)?.label || value || '—';

/** Cap enforced on both sides: the server's MAX_BULK_IMPORT is also 50 per request. */
export const MAX_PDF_IMPORT = 50;

/**
 * The parser emits base-form Bloom's verbs; the question form's dropdown uses the `-ing` forms.
 * Without this an imported question opens for edit with a blank Bloom's field. Unknown values are
 * passed through untouched rather than dropped.
 */
const BLOOM_IMPORT_MAP = {
  remember: 'Remembering',
  understand: 'Understanding',
  apply: 'Applying',
  analyze: 'Analyzing',
  analyse: 'Analyzing',
  evaluate: 'Evaluating',
  create: 'Creating',
};

export const toBloomOption = (value) => {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return null;
  return BLOOM_IMPORT_MAP[key] || value;
};

const scope = ({ sectionId, subjectId, topicId }) => ({ sectionId, subjectId, topicId });

/**
 * The topic's configuration.
 *
 * `effectivePoolSize` is computed **after pool hygiene** (unanswerable and duplicate questions
 * dropped), so it can be smaller than `customCount + selectedCompanyCount` — never derive it
 * client-side. `canEnable` is `teacherPool > 0`.
 */
export function fetchAdaptiveConfig({ sectionId, subjectId, topicId, chapterId }, signal) {
  return staffApi.get('/api/teacher/practice-questions/config', {
    params: { sectionId, subjectId, topicId, chapterId: chapterId ?? undefined },
    signal,
  });
}

/**
 * Flip the topic's switch. Returns the fresh config.
 *
 * The server rejects `enabled: true` with a 400 when the teacher's pool is empty. Note the UI's
 * disable rule is `!canEnable && !enabled` — an already-ON topic can always be switched off, even
 * if its pool later empties.
 */
export function setAdaptiveEnabled({ sectionId, subjectId, chapterId, topicId, enabled }) {
  return staffApi.post('/api/teacher/practice-questions/config', {
    sectionId,
    subjectId,
    chapterId: chapterId ?? null,
    topicId,
    enabled,
  });
}

/** Topic ids the teacher has switched on, for the ON badges. Compared as STRINGS on the web. */
export async function fetchEnabledTopics({ sectionId, subjectId }, signal) {
  const res = await staffApi.get('/api/teacher/practice-questions/enabled-topics', {
    params: { sectionId, subjectId },
    signal,
  });
  return Array.isArray(res) ? res.map(String) : [];
}

export async function fetchCompanyQuestions(args, signal) {
  const res = await staffApi.get('/api/teacher/practice-questions/company-questions', {
    params: scope(args),
    signal,
  });
  return Array.isArray(res) ? res : [];
}

export async function fetchCustomQuestions(args, signal) {
  const res = await staffApi.get('/api/teacher/practice-questions/custom-questions', {
    params: scope(args),
    signal,
  });
  return Array.isArray(res) ? res : [];
}

/**
 * Replace the topic's company-question selection wholesale.
 *
 * This is not a merge — whatever ids you send become the selection, and an empty array is a legal
 * way to deselect everything. Returns the fresh config.
 */
export function saveCompanySelection({ sectionId, subjectId, chapterId, topicId, ids }) {
  return staffApi.put('/api/teacher/practice-questions/selections', {
    sectionId,
    subjectId,
    chapterId: chapterId ?? null,
    topicId,
    academicQuestionIds: ids,
  });
}

/** MCQ-only, graded on accuracy — there is no marks or negative-marks field in this module. */
export function buildPracticeQuestionPayload(form, scopeArgs) {
  const trim = (v) => (v || '').trim() || null;
  return {
    sectionId: scopeArgs.sectionId,
    subjectId: scopeArgs.subjectId,
    chapterId: scopeArgs.chapterId ?? null,
    topicId: scopeArgs.topicId,
    testLevel: form.testLevel,
    questionText: form.questionText,
    optionA: trim(form.optionA),
    optionB: trim(form.optionB),
    optionC: trim(form.optionC),
    optionD: trim(form.optionD),
    correctAnswer: form.correctAnswer,
    bloomsLevel: form.bloomsLevel || null,
    skillSet: form.skillSet || null,
    hint: trim(form.hint),
    solution: trim(form.solution),
  };
}

export function createPracticeQuestion(payload) {
  return staffApi.post('/api/teacher/practice-questions/custom-questions', payload);
}

export function updatePracticeQuestion(id, payload) {
  return staffApi.put(`/api/teacher/practice-questions/custom-questions/${id}`, payload);
}

export function deletePracticeQuestion(id) {
  return staffApi.del(`/api/teacher/practice-questions/custom-questions/${id}`);
}

/** Bulk import. The body is a **bare JSON array**, not an object wrapper. Cap 50 per request. */
export function bulkCreatePracticeQuestions(payload) {
  return staffApi.post('/api/teacher/practice-questions/custom-questions/bulk', payload);
}

/**
 * Parse a question paper server-side.
 *
 * MUST stay on the teacher-namespaced path. The web overrides the importer's default
 * `/api/admin/pdf/parse-questions` because the web's apiService picks its token from the URL —
 * ours always sends `schoolUserToken`, so that half is moot, but the admin endpoint also omits
 * `VICE_PRINCIPAL`, who has this page.
 *
 * Returns either a bare array or `{ questions: [], message }` when nothing matched the expected
 * "Q1. Bloom Skills - Level" format.
 */
export async function parseQuestionPdf(file) {
  const res = await staffApi.multipart(
    '/api/teacher/practice-questions/parse-pdf',
    { files: { file } },
    { timeoutMs: 120000 },
  );
  if (Array.isArray(res)) return { questions: res, message: null };
  return { questions: res?.questions || [], message: res?.message || null };
}

// ── reports ─────────────────────────────────────────────────────────────────

export async function fetchAdaptiveStudents({ sectionId, subjectId }, signal) {
  const res = await staffApi.get('/api/teacher/practice-questions/reports/students', {
    params: { sectionId, subjectId },
    signal,
  });
  return Array.isArray(res) ? res : [];
}

/** Topics with at least one completed attempt — NOT the same as the teacher's enabled topics. */
export async function fetchStandingTopics({ sectionId, subjectId }, signal) {
  const res = await staffApi.get('/api/teacher/practice-questions/reports/topics', {
    params: { sectionId, subjectId },
    signal,
  });
  return Array.isArray(res) ? res : [];
}

export async function fetchStandings({ sectionId, subjectId, topicId }, signal) {
  const res = await staffApi.get('/api/teacher/practice-questions/reports/standings', {
    params: { sectionId, subjectId, topicId },
    signal,
  });
  return Array.isArray(res) ? res : [];
}

/** The endpoint also accepts an optional `topicId` filter the web never uses. */
export async function fetchAttempts({ sectionId, subjectId, studentId, topicId }, signal) {
  const res = await staffApi.get('/api/teacher/practice-questions/reports/attempts', {
    params: { sectionId, subjectId, studentId, topicId: topicId ?? undefined },
    signal,
  });
  return Array.isArray(res) ? res : [];
}

export function fetchAttemptAnalysis(attemptId, signal) {
  return staffApi.get(
    `/api/teacher/practice-questions/reports/attempts/${attemptId}/analysis`,
    { signal },
  );
}

/** The six metrics of the performance radar, in the order the web reads them. */
export const PERFORMANCE_METRICS = [
  { key: 'accuracy', label: 'Accuracy', hint: 'Share of questions answered correctly.' },
  { key: 'consistency', label: 'Consistency', hint: 'How rarely they flipped between right and wrong.' },
  { key: 'depth', label: 'Depth', hint: 'The hardest difficulty level reached.' },
  { key: 'coverage', label: 'Coverage', hint: 'How much of the question set they got through.' },
  { key: 'speed', label: 'Speed', hint: 'Pace against a 45-second-per-question reference.' },
  { key: 'resilience', label: 'Resilience', hint: 'How often they bounced back after a wrong answer.' },
];

export const REMARK_TIER = {
  Excellent: '#10b981',
  'Above Average': '#667eea',
  Average: '#f59e0b',
  'Below Average': '#ef4444',
  'Needs Improvement': '#ef4444',
};

/** "m:ss", or "h:mm:ss" past an hour. Mirrors frontendmain/src/utils/formatDuration.js. */
export function formatDuration(totalSeconds) {
  const seconds = Number(totalSeconds);
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
