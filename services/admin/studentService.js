// services/admin/studentService.js
// Mirrors: frontendmain/src/School/Admin/pages/StudentManagement.js
// Backend: school/controller/SchoolClassManagementController.java
//          GET /students and GET /students/academic-iq-history are
//          `hasRole('SCHOOL_ADMIN') or hasRole('PRINCIPAL')` — PRINCIPAL is named explicitly.
//
// READ-ONLY. There is no create, edit or delete on this page: students belong to the school by
// school code, and the platform admin owns their records. Don't add write UI.
//
// Two independent lists, fetched in parallel and failing independently — the web does the same, so
// a broken history call must not blank the roster.

import { staffApi } from '../staffApi';

/** Roster filters. `school`/`paid`/`free` are client-side; there is no query parameter. */
export const STUDENT_FILTERS = [
  { value: 'all', label: 'Total', field: 'totalStudents', tone: 'total' },
  { value: 'school', label: 'School', field: 'schoolStudents', tone: 'info' },
  { value: 'paid', label: 'Paid', field: 'paidStudents', tone: 'success' },
];

/**
 * The school's students plus the counts shown above them.
 *
 * NOTE THE ENVELOPE: this returns `{ stats, students }`, not a bare array — unlike almost every
 * other list endpoint in the app.
 *
 * @returns {Promise<{ stats: { schoolCode, schoolName, totalStudents, schoolStudents,
 *   paidStudents }, students: Array<{ userId, fullName, email, mobile, currentClass, section,
 *   schoolStudent: boolean, paid: boolean, planName, planTier, subscriptionStatus }> }>}
 */
export async function fetchStudents(apiBase, signal) {
  const res = await staffApi.get(`${apiBase}/students`, { signal });
  return {
    stats: res?.stats || {},
    students: Array.isArray(res?.students) ? res.students : [],
  };
}

/**
 * Every Academic IQ profile change the school's students have made.
 *
 * `editNumber` counts against a cap of 12 — the web hardcodes that denominator, and there is no
 * field carrying it, so it is repeated here rather than invented.
 *
 * @returns {Promise<Array<{ studentName, changedAt, editNumber, curriculumName, className,
 *   subjectNames, preparingCompetitiveExam: 'YES'|'NO'|null, competitiveExamName,
 *   entranceExamNames }>>}
 */
export async function fetchAcademicIqHistory(apiBase, signal) {
  const res = await staffApi.get(`${apiBase}/students/academic-iq-history`, { signal });
  return Array.isArray(res) ? res : [];
}

/** The web's hardcoded edit cap, shown as `3/12`. */
export const ACADEMIC_IQ_EDIT_CAP = 12;

/** Roster search across the four fields the web searches. */
export function matchesStudent(student, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  return ['fullName', 'email', 'mobile', 'currentClass'].some((field) =>
    String(student?.[field] || '').toLowerCase().includes(q),
  );
}

/** Apply the active stat-card filter. `free` is "not paid", not a field of its own. */
export function matchesFilter(student, filter) {
  if (filter === 'school') return !!student?.schoolStudent;
  if (filter === 'paid') return !!student?.paid;
  if (filter === 'free') return !student?.paid;
  return true;
}
