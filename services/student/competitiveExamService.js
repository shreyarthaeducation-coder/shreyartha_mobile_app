// services/student/competitiveExamService.js
// Mirrors: frontendmain/src/student/platform/AcademicIQ/{CompetitiveExam,CompetitiveExamMockTest}.js
//
// TWO NAMESPACES, and the split is not where you would guess:
//   /api/competitiveexam/          the CATALOGUE — categories and the subject tree (bare, no
//                                  student prefix; the content exists independently of any student)
//   /api/student/competitiveexam/  everything ABOUT this student — resources, progress, practice,
//                                  adaptive, mock tests (SINGULAR `student`)
//
// Copied endpoint by endpoint from the web lines that call them.

import { studentApi } from '../studentApi';
import { shuffleArray } from '../../utils/shuffle';

/* ── Catalogue — bare `/api/competitiveexam/` ──────────────────────────── */

/**
 * Exam categories. The response has FOUR possible shapes — a bare array, or an object wrapping the
 * list under `data`, `categories` or `content`. The web unwraps all four; so do we, because which
 * one arrives is not something this client controls.
 */
export async function fetchCategories(signal) {
  const res = await studentApi.get('/api/competitiveexam/categories', { signal });
  if (Array.isArray(res)) return res;
  if (res && typeof res === 'object') return res.data || res.categories || res.content || [];
  return [];
}

/** `{ name, examName, subjects: [{ chapters: [{ topics }] }] }` for one sub-exam. */
export function fetchSubjectTree(subExamId, signal) {
  return studentApi.get(`/api/competitiveexam/subject/${subExamId}/tree`, { signal });
}

/* ── This student — SINGULAR `/api/student/competitiveexam/` ───────────── */

/** `{ hasExam, examId, … }` — which exam this student has been set up with. */
export function fetchMyExam(signal) {
  return studentApi.get('/api/student/competitiveexam/resources', { signal });
}

export function fetchCompletionSummary(signal) {
  return studentApi.get('/api/student/competitiveexam/completion-summary', { signal });
}

export function fetchTopicContent(topicId, signal) {
  return studentApi.get(`/api/student/competitiveexam/topic/${topicId}/content`, { signal });
}

export function markTopicComplete(topicId) {
  return studentApi.post(`/api/student/competitiveexam/topic/${topicId}/complete`, {});
}

export function fetchUnderstandingQuestions(topicId, signal) {
  return studentApi
    .get(`/api/student/competitiveexam/understanding/${topicId}/questions`, { signal })
    .then((r) => (Array.isArray(r) ? r : []));
}

export async function fetchPracticeQuestions(topicId, signal) {
  const res = await studentApi.get(`/api/student/competitiveexam/practice/${topicId}/questions`, {
    signal,
  });
  return shuffleArray(Array.isArray(res) ? res : []);
}

export function fetchPracticeProgress(topicId, signal) {
  return studentApi.get(`/api/student/competitiveexam/practice/${topicId}/progress`, { signal });
}

export function savePracticeProgress(topicId, body) {
  return studentApi.post(`/api/student/competitiveexam/practice/${topicId}/progress`, body);
}

/* ── Adaptive ──────────────────────────────────────────────────────────────
   The same start/next/submit protocol MyReflection uses. On the web this engine carries NONE of
   the guards from the repeat-question saga — no pinned `currentQuestionId`, no attempt epoch, no
   seen-question tracking. Routing it through hooks/useAdaptiveSession gives it all four. */

export const adaptiveEngine = (topicId) => ({
  start: () => studentApi.post(`/api/student/competitiveexam/adaptive/${topicId}/start`, {}),
  answer: (body, isLast) =>
    studentApi.post(
      isLast
        ? `/api/student/competitiveexam/adaptive/${topicId}/submit`
        : `/api/student/competitiveexam/adaptive/${topicId}/next`,
      body,
    ),
});

/* ── Mock tests ────────────────────────────────────────────────────────── */

export async function fetchMockTestPapers(subExamId, signal) {
  const res = await studentApi.get(
    `/api/student/competitiveexam/mocktest-papers/subject/${subExamId}`,
    { signal },
  );
  return Array.isArray(res) ? res : [];
}

export function fetchMockTestQuestions(paperId, signal) {
  return studentApi
    .get(`/api/student/competitiveexam/mocktest-papers/${paperId}/questions`, { signal })
    .then((r) => (Array.isArray(r) ? r : []));
}

export function submitMockTest(mockTestId, body) {
  return studentApi.post(`/api/student/competitiveexam/mocktest/${mockTestId}/submit`, body);
}

/** The mock-test list for a whole entrance exam — the separate mock-test screen's only read. */
export function fetchMockTestsForExam(entranceExamId, signal) {
  return studentApi.get(
    `/api/student/competitiveexam/mocktest/entrance-exam/${entranceExamId}`,
    { signal },
  );
}

/** The three sections of the exam screen, in the web's order. */
export const EXAM_SECTIONS = [
  { key: 'resources', label: 'Resources' },
  { key: 'practiceZone', label: 'Practice' },
  { key: 'mockTest', label: 'Mock Test', premium: true },
];
