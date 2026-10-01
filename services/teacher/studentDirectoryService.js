// services/teacher/studentDirectoryService.js
// Mirrors: frontendmain/src/School/Teacher/pages/TeacherStudentManagement.js
// Backend: teacher/controller/TeacherStudentDirectoryController.java —
//          @PreAuthorize("hasAnyRole('TEACHER','VICE_PRINCIPAL')"), everything keyed by sectionId.
//
// Student Management for a class teacher: the section's roster, each student's school record
// (name, admission and roll numbers, parents, date of birth, the FORMAL photo used on report cards —
// not the picture a student uploads on their own dashboard, which stays theirs), and the same child
// listed twice — the school's record and an account they made themselves — joined into one.

import { staffApi } from '../staffApi';

const BASE = '/api/teacher/students';

/** `[{ studentId, studentName, admissionNumber, rollNumber, fatherName, motherName, dob,
 *  formalPhotoUrl, selfEnrolled, accountStatus }]` */
export async function fetchSectionRoster(sectionId, signal) {
  const res = await staffApi.get(BASE, { params: { sectionId }, signal });
  return Array.isArray(res) ? res : [];
}

/** Pairs that look like one child listed twice: `[{ schoolRecord, selfRegistered, datesOfBirthAgree }]`. */
export async function fetchDuplicates(sectionId, signal) {
  const res = await staffApi.get(`${BASE}/duplicates`, { params: { sectionId }, signal });
  return Array.isArray(res) ? res : [];
}

/**
 * What joining the pair would do, changing nothing: `{ warnings, loginMoving, survivingName,
 * moves: [{ table, column, moved, discarded }] }`. A plan with warnings cannot be carried out.
 */
export function previewMerge(sectionId, keepStudentId, mergeStudentId) {
  return staffApi.get(`${BASE}/merge-preview`, { params: { sectionId, keepStudentId, mergeStudentId } });
}

/** Joins the self-registered account into the school's record. Cannot be undone. */
export function mergeStudents(sectionId, keepStudentId, mergeStudentId) {
  return staffApi.request(`${BASE}/merge`, {
    method: 'POST',
    params: { sectionId, keepStudentId, mergeStudentId },
  });
}

/**
 * Saves one student's school record — ALL of it, every time, as the website does: the request is the
 * whole record, so a field left out would be cleared. Returns the saved row.
 */
export function updateStudentRecord(sectionId, studentId, draft) {
  return staffApi.put(
    `${BASE}/${studentId}`,
    {
      studentName: String(draft.studentName || '').trim(),
      admissionNumber: draft.admissionNumber || '',
      rollNumber: draft.rollNumber || '',
      fatherName: draft.fatherName || '',
      motherName: draft.motherName || '',
      dob: draft.dob || '',
      formalPhotoUrl: draft.formalPhotoUrl || '',
    },
    { params: { sectionId } },
  );
}

/** Stores the formal photograph; returns its URL. Saved with the record only when Save is pressed. */
export async function uploadFormalPhoto(file) {
  const res = await staffApi.multipart('/api/uploads/images', { files: { file } });
  if (!res?.url) throw new Error(res?.message || 'The photo could not be stored.');
  return res.url;
}
