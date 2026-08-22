// services/teacher/counsellingService.js
// Mirrors: frontendmain/src/School/shared/CounsellingNotes.js (role="teacher")
//          + School/Teacher/pages/TeacherCounsellorReport.js
// Backend: counselling/controller/TeacherCounsellingController.java (@PreAuthorize hasRole TEACHER)
//          counsellorreport/controller/TeacherCounsellorReportController.java
//
// Both features share the class/section/student endpoints, so they share this module.
//
// THE COUNSELLOR USES THE SAME SHAPES on `/api/counselor/counselling` (and the Shreyartha
// counsellor on `/api/shreya01/counsellor/counselling`) — the web's CounsellingNotes.js is one
// component that just interpolates `/api/${role}`. Hence `apiBase`, optional and defaulting to the
// teacher namespace so existing call sites are untouched.
//
// The counsellor also sees ALL EIGHT counselling types where a teacher sees two; that gating lives
// in constants/counsellingConfig.js `counsellingTypesForRole`, not here.

import { staffApi } from '../staffApi';

export const TEACHER_COUNSELLING_BASE = '/api/teacher/counselling';

/** Class → section tree. `academicYearId` is optional; omitted, the server resolves the default. */
export async function fetchCounsellingClasses(
  academicYearId,
  signal,
  apiBase = TEACHER_COUNSELLING_BASE,
) {
  const res = await staffApi.get(`${apiBase}/classes`, {
    params: { academicYearId },
    signal,
  });
  return Array.isArray(res) ? res : [];
}

/**
 * The section's students plus a session index for the month.
 *
 * `sessions` is keyed `"<studentId>_<YYYY-MM-DD>"` → an array of
 * `{ id, counsellingType, caseStatus, createdByRole }` summaries.
 *
 * @returns {Promise<{ students: Array<{studentId, studentName}>, sessions: Record<string, object[]> }>}
 */
export async function fetchCounsellingStudents(
  { scope, year, month, apiBase = TEACHER_COUNSELLING_BASE, scopeKind = 'classSection' },
  signal,
) {
  // The ONLY call in this module whose request shape differs by portal. The Shreyartha counsellor
  // is id-keyed (`?classId=`); the sessions GET and POST below are byte-identical across portals,
  // right down to sharing CounsellingSessionRequest.
  const params =
    scopeKind === 'schoolClass'
      ? { classId: scope.classId, year, month }
      : { className: scope.className, sectionName: scope.sectionName, year, month };

  const res = await staffApi.get(`${apiBase}/students`, { params, signal });
  return {
    students: Array.isArray(res?.students) ? res.students : [],
    sessions: res?.sessions && typeof res.sessions === 'object' ? res.sessions : {},
  };
}

/**
 * Full sessions for one student on one date.
 *
 * Reads are cross-type and school-scoped only, so a teacher can see counsellor-authored sessions
 * here too — show the type and status, not the counsellor's notes.
 */
export async function fetchSessionsForDate(
  { studentId, date, apiBase = TEACHER_COUNSELLING_BASE },
  signal,
) {
  const res = await staffApi.get(`${apiBase}/sessions`, { params: { studentId, date }, signal });
  return Array.isArray(res) ? res : [];
}

/**
 * Save a counselling session.
 *
 * ### This deliberately differs from the web, because the web loses data
 *
 * `CounsellingNotes.js` posts `{ studentId, date, counsellingType, ...formData }` — spreading the
 * type-specific answers at the **top level**. But `CounsellingSessionRequest` declares
 * `Map<String,Object> formData`, so Jackson drops those unknown properties, `getFormData()` is
 * null, and the service stores the literal `"{}"`. Every answer a teacher types into the dynamic
 * part of that form is silently discarded today; only the five common fields survive, because
 * those happen to be real DTO fields.
 *
 * We nest them properly. Nothing reads session `formData` yet (the web never parses it), so this
 * can only add information — but it is a real divergence and worth knowing about.
 *
 * We also send `className`/`sectionName`, which the web omits. Without them the server falls back
 * to the student's own class string, and where that reads `"6"` against a picker showing
 * `"Class 6"`, a just-saved session fails to reappear in the month grid.
 *
 * @param {{ studentId, date, counsellingType, className, sectionName,
 *           common: object, formData: object }} args
 */
export function saveCounsellingSession({
  studentId,
  date,
  counsellingType,
  className,
  sectionName,
  common,
  formData,
  apiBase = TEACHER_COUNSELLING_BASE,
}) {
  return staffApi.post(`${apiBase}/sessions`, {
    studentId,
    date,
    counsellingType,
    className,
    sectionName,
    sessionMode: common.sessionMode || null,
    caseStatus: common.caseStatus || null,
    improvementScore: common.improvementScore ?? null,
    counselorNotes: common.counselorNotes || null,
    followUpDate: common.followUpDate || null,
    formData: formData || {},
  });
}

/** Portal A's read-only report list. Note the `/reports` suffix — Portal B's path has none. */
export const TEACHER_REPORTS_ENDPOINT = '/api/teacher/counsellor-report/reports';

/**
 * A student's counsellor reports, newest first. **Read-only** — the teacher controllers expose
 * this one method and nothing else; creating and editing live in the counsellor panels.
 *
 * The two teacher portals differ by more than a prefix, so the whole path is the parameter:
 *
 *   Portal A  GET /api/teacher/counsellor-report/reports?studentId=      ← has /reports
 *   Portal B  GET /api/shreya01/counselling/counsellor-report?studentId= ← does not
 *
 * Appending `/reports` to Portal B's base 404s, which is why this takes an endpoint rather than a
 * base to build on.
 *
 * `formData` on each row is a JSON string; parse it with `parseReportForm`.
 */
export async function fetchCounsellorReports(studentId, signal, endpoint = TEACHER_REPORTS_ENDPOINT) {
  const res = await staffApi.get(endpoint, {
    params: { studentId },
    signal,
  });
  return Array.isArray(res) ? res : [];
}
