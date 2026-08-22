// services/teacher/subjectService.js
// Mirrors: frontendmain/src/School/Teacher/pages/SHREYA01/Shreya01Subjects.js
//
// Manage Subjects exists ONLY in the Shreyartha teacher panel (Portal B). Portal A's subjects come
// from the AcademicIQ curriculum and are administered elsewhere, so there is no `/api/teacher`
// twin for any of this.
//
// Note the scope endpoint: Manage Subjects reads the HOMEWORK schools tree, not a subjects one of
// its own. That is what the web does, and the two trees are populated from different assignment
// sources — see constants/shreya01TeacherPortal.js.

import { staffApi } from '../staffApi';

const BASE = '/api/shreya01/subjects';

/**
 * Subjects taught in one class.
 *
 * @returns {Promise<Array<{ subjectId: number, subjectName: string }>>}
 */
export async function fetchClassSubjects(classId, signal) {
  const res = await staffApi.get(BASE, { params: { classId }, signal });
  return Array.isArray(res) ? res : [];
}

/** Add a subject to a class. The class rides in the PATH here, unlike the GET's query param. */
export function addClassSubject(classId, subjectName) {
  return staffApi.post(`${BASE}/class/${classId}`, { subjectName });
}

/**
 * Remove a subject.
 *
 * DESTRUCTIVE BEYOND THIS SCREEN — the server also detaches the subject from homework and
 * syllabus rows, which is why the web confirms first and so does the native screen.
 */
export function deleteClassSubject(subjectId) {
  return staffApi.del(`${BASE}/${subjectId}`);
}
