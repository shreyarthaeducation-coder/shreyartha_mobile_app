// services/admin/examService.js
// Mirrors: frontendmain/src/School/Admin/pages/AdminReports.js + School/shared/ExamMarksGrid.js
//          rendered with mode="admin".
// Backend: report/controller/AdminReportController.java —
//          @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')") at CLASS level. PRINCIPAL is
//          named explicitly here; this is not a role-hierarchy case.
//
// A DIFFERENT SCREEN FROM THE TEACHER'S ExamsScreen, not a parameterisation of it. Two hard
// differences, both stated in the web's own comment:
//   * the admin OWNS the exam record — create, edit, and the visible-to-parents switch. A teacher
//     and a vice principal can only enter marks against exams created here.
//   * the marks WRITE is `PUT /exams/{id}/results/{studentId}`, ONE REQUEST PER STUDENT. The
//     teacher's `POST /exams/{id}/marks` does not exist under /api/school-admin/reports.
// There is no delete-exam endpoint on this controller, so the app offers none.

import { staffApi } from '../staffApi';

/** Exam types, with the code each one pre-fills. Verbatim from AdminReports. */
export const EXAM_TYPE_DEFAULT_CODE = {
  MONTHLY: 'MT1',
  QUARTERLY: 'QUARTERLY',
  HALF_YEARLY: 'HALFYEARLY',
  YEARLY: 'YEARLY',
  CUSTOM: '',
};

export const EXAM_TYPES = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'HALF_YEARLY', label: 'Half yearly' },
  { value: 'YEARLY', label: 'Yearly' },
  { value: 'CUSTOM', label: 'Custom' },
];

export const MARK_STATUSES = [
  { value: 'PRESENT', label: 'Present' },
  { value: 'ABSENT', label: 'Absent' },
];

/**
 * Exams for one section+subject in one academic year.
 *
 * All three parameters are required — the endpoint returns nothing useful without them, and the
 * web does not call it until every level of its picker is chosen.
 */
export async function fetchExams(apiBase, { academicYearId, sectionId, subjectId }, signal) {
  if (!academicYearId || !sectionId || !subjectId) return [];
  const res = await staffApi.get(
    `${apiBase}/exams?academicYearId=${academicYearId}&sectionId=${sectionId}&subjectId=${subjectId}`,
    { signal },
  );
  return Array.isArray(res) ? res : [];
}

/** `examName` falls back to the code, as the web does — the field is not really optional. */
export function createExam(apiBase, { sectionId, subjectId, examType, examCode, examName, maxMarks }) {
  return staffApi.post(`${apiBase}/exams`, {
    sectionId,
    subjectId,
    examType,
    examCode: examCode.trim(),
    examName: examName.trim() || examCode.trim(),
    maxMarks: Number(maxMarks) || 100,
  });
}

export function updateExam(apiBase, examId, { examType, examCode, examName, maxMarks }) {
  return staffApi.put(`${apiBase}/exams/${examId}`, {
    examType,
    examCode: examCode.trim(),
    examName: examName.trim() || examCode.trim(),
    maxMarks: Number(maxMarks) || 100,
  });
}

/** POST, not PUT — the controller declares the visibility toggle as a post. */
export function setExamVisibility(apiBase, examId, visible) {
  return staffApi.post(`${apiBase}/exams/${examId}/visibility`, { visible });
}

/**
 * The marks sheet: the section roster with whatever is already recorded.
 *
 * @returns {Promise<{ maxMarks, students: Array<{ studentId, studentName, rollNumber,
 *   status, marksObtained, remarks }> }>}
 */
export function fetchMarksSheet(apiBase, examId, signal) {
  return staffApi.get(`${apiBase}/exams/${examId}/marks-sheet`, { signal });
}

/**
 * Save marks — ONE PUT PER STUDENT, sequentially, exactly as the web's admin branch does.
 *
 * Not parallelised on purpose: there is no transaction around these, so a burst that half-fails
 * would leave the sheet in a state the user cannot see. Sequential means the first failure stops
 * and everything before it is already saved.
 *
 * ABSENT sends `marksObtained: null` — the same encoding the teacher's flat sheet uses.
 */
export async function saveMarks(apiBase, examId, entries) {
  for (const entry of entries) {
    await staffApi.put(`${apiBase}/exams/${examId}/results/${entry.studentId}`, {
      status: entry.status,
      marksObtained:
        entry.status === 'ABSENT'
          ? null
          : entry.marksObtained === '' || entry.marksObtained == null
            ? null
            : Number(entry.marksObtained),
      remarks: entry.remarks || null,
    });
  }
}

/**
 * Clamp a typed mark to the exam's maximum.
 *
 * THE ONLY MAX-MARKS GUARD THAT EXISTS. The web relies on an HTML `max=` attribute with no JS
 * check; RN's TextInput has no such attribute, so without this the guard vanishes entirely and a
 * typo writes a mark above the maximum. Same reasoning as MarksSheet.sanitise on the teacher side.
 */
export function clampMark(text, max) {
  const cleaned = String(text).replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
  if (cleaned === '') return '';
  const value = Number(cleaned);
  if (Number.isNaN(value)) return '';
  if (max != null && value > max) return String(max);
  return cleaned;
}
