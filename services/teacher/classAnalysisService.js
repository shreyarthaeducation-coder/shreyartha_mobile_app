/**
 * The class teacher's class analysis (28 Oct 2026; exam and subject choices 29 Oct) — the website's
 * ClassAnalysisReport. The server allows only the section's class teacher.
 */
import { staffApi } from '../staffApi';
import { downloadAndShare } from '../../utils/downloadFile';

const BASE = '/api/teacher/reports/class-analysis';

/**
 * What the class teacher can choose: `{ exams: [{ examName, subjects, firstDate }],
 * subjects: [{ subjectId, heading, subjectName }] }`.
 */
export async function fetchClassAnalysisOptions(sectionId, signal) {
  const res = await staffApi.get(`${BASE}/options`, { params: { sectionId }, signal });
  if (!res || !Array.isArray(res.exams) || !Array.isArray(res.subjects)) {
    throw new Error('The class analysis could not be read from the server.');
  }
  return res;
}

/**
 * The sheet for a selection query (`selectionQuery` in utils/classAnalysisSheet):
 * `{ schoolName, examName, session, className, sectionName, classTeacher, allExams, exams[], warnings[],
 *    columns[{ subjectId, heading, subjectName, teacherInitials, examDate, lastExamDate, outOf, examCount }],
 *    students[{ studentId, rollNumber, studentName, marks: { [subjectId]: { marks, absent, missing } } }],
 *    summaries[{ subjectId, counted, average, averagePercent, highestPercent, lowestPercent, bands }],
 *    bandLabels[] }`
 */
export function fetchClassAnalysis(query, signal) {
  return staffApi.get(`${BASE}?${query}`, { signal });
}

// Whole MIME types: checked against the response's Content-Type, then handed to the share sheet.
const FILE_TYPES = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  csv: 'text/csv',
};

/** Excel, Word or CSV from the server, handed to the share sheet. */
export function shareClassAnalysisFile(query, format, filename) {
  return downloadAndShare(`${BASE}/export?${query}&format=${format}`, filename, FILE_TYPES[format]);
}

/** The subject's teacher sets the day the paper was written ("2026-07-11"), or null to remove it. */
export function saveExamDate(examId, examDate) {
  return staffApi.put(`/api/teacher/reports/exams/${examId}/exam-date`, { examDate: examDate || null });
}
