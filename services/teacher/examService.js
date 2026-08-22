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

/** From School/shared/testQuestionOptions.js — kept in sync with the Super Admin psychometric page. */
export const QUESTION_TYPES = [
  { value: 'MCQ', label: 'Multiple Choice (MCQ)' },
  { value: 'TRUE_FALSE', label: 'True / False' },
  { value: 'SHORT_ANSWER', label: 'Short Answer' },
  { value: 'LONG_ANSWER', label: 'Long Answer' },
  { value: 'FILL_IN_THE_BLANK', label: 'Fill in the Blank' },
];

export const BLOOM_TAXONOMY = [
  'Remembering', 'Understanding', 'Applying', 'Analyzing',
  'Evaluating', 'Creating', 'Arts', 'Commerce', 'Science',
];

/** 33 entries — this is why components/ui/Select grew a `searchable` variant. */
export const SKILLS_MEASURED = [
  'Critical Thinking', 'Communication', 'Collaboration', 'Creativity',
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
];

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
 * Flat marks. Sends the **whole roster** every time, not a diff — the endpoint is a full replace.
 * An ABSENT student must carry `marksObtained: null`.
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
 * `questionMarks` array is dropped (`[]`). Build the array from the sheet's question list rather
 * than from the edit map, so every question is represented — untouched ones as null — and questions
 * added since the sheet loaded are still included.
 */
export function saveQuestionMarks(examId, entries) {
  return staffApi.post(`/api/teacher/reports/exams/${examId}/question-marks`, { entries });
}

// ── questions ───────────────────────────────────────────────────────────────

export async function fetchExamQuestions(examId, signal) {
  const res = await staffApi.get(`/api/teacher/reports/exams/${examId}/questions`, { signal });
  return Array.isArray(res) ? res : [];
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

/**
 * Question payload.
 *
 * Deliberately **denormalised** — chapter and topic go out as both id and name, so the label
 * survives later curriculum edits. Non-MCQ types force all four options to null; MCQ needs at
 * least two non-blank ones.
 */
export function buildQuestionPayload(form, chapter, topic) {
  const isMcq = form.questionType === 'MCQ';
  const opt = (value) => (isMcq ? (value || '').trim() || null : null);
  return {
    chapterId: chapter?.id ?? null,
    chapterName: chapter?.name ?? null,
    topicId: topic?.id ?? null,
    topicName: topic ? topic.displayName || topic.name : null,
    questionType: form.questionType,
    questionStatement: (form.questionStatement || '').trim(),
    optionA: opt(form.optionA),
    optionB: opt(form.optionB),
    optionC: opt(form.optionC),
    optionD: opt(form.optionD),
    bloomsTaxonomy: form.bloomsTaxonomy || null,
    skillSet: form.skillSet || null,
    sampleAnswer: (form.sampleAnswer || '').trim() || null,
    marks: Number(form.marks) || 0,
  };
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
