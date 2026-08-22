// services/teacher/studentAnalyticsService.js
// Mirrors: frontendmain/src/School/Teacher/pages/MyStudentAnalytics.js
// Backend: teacher/controller/TeacherStudentAnalyticsController.java (all hasRole('TEACHER'))

import { staffApi } from '../staffApi';

const BASE = '/api/teacher/student-analytics';

/**
 * Learning-gap buckets, in order of increasing mastery.
 *
 * These are **title-case display strings from the API**, not enum constants — `learningGaps` comes
 * back keyed exactly like this, so don't upper-case them when looking up counts.
 */
export const GAP_LEVELS = [
  { key: 'Beginner', color: '#dc2626', bg: '#fee2e2' },
  { key: 'Developing', color: '#d97706', bg: '#fef3c7' },
  { key: 'Progressing', color: '#2563eb', bg: '#dbeafe' },
  { key: 'Proficient', color: '#059669', bg: '#d1fae5' },
];

export const RESOURCE_TYPES = [
  { value: 'PDF', label: 'PDF' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'LINK', label: 'Link' },
  { value: 'NOTE', label: 'Note' },
];

/**
 * The student's Academic IQ snapshot.
 *
 * @returns {Promise<{ studentId, studentName, studentClass, studentSection,
 *   syllabusCompletionPercent, syllabusRating, progressPercent, progressRating,
 *   learningGaps: Record<string, number>, topicsByLevel: Record<string, object[]>,
 *   teacherRemarks: Record<string, string>, totalReflections: number }>}
 */
export function fetchStudentAnalytics(studentId, signal) {
  return staffApi.get(`${BASE}/${studentId}`, { signal });
}

export function fetchStudentSyllabus(studentId, signal) {
  return staffApi.get(`${BASE}/${studentId}/syllabus-completion`, { signal });
}

export function fetchStudentProgress(studentId, signal) {
  return staffApi.get(`${BASE}/${studentId}/my-progress`, { signal });
}

export function fetchAcademicIqHistory(studentId, signal) {
  return staffApi.get(`${BASE}/${studentId}/academic-iq-history`, { signal });
}

export async function fetchPersonalisedResources({ studentId, topicId }, signal) {
  const res = await staffApi.get(
    `${BASE}/personalised-resources/student/${studentId}/topic/${topicId}`,
    { signal },
  );
  return Array.isArray(res) ? res : [];
}

/**
 * Assign a resource to one student for one topic.
 *
 * Multipart with a `@RequestPart("data")` JSON part — the same shape as the homework upload, and
 * the same 415 trap if that part goes out as `text/plain`. `staffApi.multipart({ json })` handles
 * it; the file is optional (a LINK or NOTE resource has none).
 */
export function uploadPersonalisedResource(data, file) {
  return staffApi.multipart(`${BASE}/personalised-resources/upload`, {
    json: { data },
    files: file ? { file } : undefined,
  });
}
