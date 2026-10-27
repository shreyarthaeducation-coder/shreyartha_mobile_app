/**
 * The class teacher's class analysis (28 Oct 2026) — the website's ClassAnalysisReport: one exam
 * across every subject of her section. The server allows only the section's class teacher.
 */
import { staffApi } from '../staffApi';

const BASE = '/api/teacher/reports/class-analysis';

/** The section's exams, one per name across subjects: `[{ examName, subjects, firstDate }]`. */
export async function fetchClassAnalysisExams(sectionId, signal) {
  const res = await staffApi.get(`${BASE}/exams`, { params: { sectionId }, signal });
  return Array.isArray(res) ? res : [];
}

/**
 * `{ schoolName, examName, session, className, sectionName, classTeacher,
 *    columns[{ subjectId, heading, subjectName, teacherInitials, examDate, outOf }],
 *    students[{ studentId, rollNumber, studentName, marks: { [subjectId]: { marks, absent } } }],
 *    summaries[{ subjectId, counted, average, averagePercent, highestPercent, lowestPercent, bands }],
 *    bandLabels[] }`
 */
export function fetchClassAnalysis(sectionId, examName, signal) {
  return staffApi.get(BASE, { params: { sectionId, examName }, signal });
}

/** The subject's teacher sets the day the paper was written ("2026-07-11"), or null to remove it. */
export function saveExamDate(examId, examDate) {
  return staffApi.put(`/api/teacher/reports/exams/${examId}/exam-date`, { examDate: examDate || null });
}
