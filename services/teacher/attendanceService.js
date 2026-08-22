// services/teacher/attendanceService.js
// Mirrors: frontendmain/src/School/Teacher/pages/TeacherAttendance.js
// Backend: teacher/controller/AttendanceController.java (+ AttendanceService.java)
//
// Class attendance for the teacher's own sections. NOT the staff member's own attendance — that is
// services/teacher/selfAttendanceService.js.
//
// THE API IS NAME-KEYED. `/classes` hands back classId/sectionId, but `/sheet` and `/mark` take
// `className` + `sectionName` STRINGS. The ids exist for list keys and the picker only; sending
// them where a name belongs silently matches nothing.
//
// All four endpoints are @PreAuthorize("hasRole('TEACHER')"); VICE_PRINCIPAL inherits TEACHER
// through the role hierarchy, so the VP shell can use this unchanged.
//
// THE COUNSELLOR MIRRORS THIS EXACTLY. `/api/counselor/attendance/{classes,sheet,mark}` take and
// return identical shapes — same name-keying, same every-day-of-the-month `attendance` map, same
// upsert semantics. Hence `apiBase`: an optional argument that defaults to the teacher namespace,
// so every existing call site is unchanged and the counsellor passes its own.
//
// THE SHREYARTHA COUNSELLOR IS DIFFERENT AND NEEDS MORE THAN A NAMESPACE. Its endpoints are
// **id-keyed**, not name-keyed: `/sheet?classId=&year=&month=` and a mark body of
// `{schoolId, classId, date, entries}` (Shreya01AttendanceMarkRequest). The RESPONSE is the very
// same AttendanceSheetResponse — it just fills `sectionName` with "" — so the roster, the
// blank-by-default rule, the coverage grid and the counters are all shared. Only the two requests
// differ, which is what ATTENDANCE_ADAPTERS encodes.

import { staffApi } from '../staffApi';
import { classesFromEndpoint } from './scopeService';

export const ATTENDANCE_STATUS = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
};

export const TEACHER_ATTENDANCE_BASE = '/api/teacher/attendance';

/**
 * How a portal turns the on-screen scope into request shapes.
 *
 * `classSection` — teacher and school-bound counsellor. Name-keyed: the ids in the class list are
 *   for React keys and the picker only, and sending one where a name belongs matches nothing.
 * `schoolClass` — Shreyartha counsellor. Id-keyed, and the mark body additionally carries
 *   `schoolId`, which the server uses to resolve the school code.
 */
export const ATTENDANCE_ADAPTERS = {
  classSection: {
    sheetParams: (scope, { year, month }) => ({
      className: scope.className,
      sectionName: scope.sectionName,
      year,
      month,
    }),
    markBody: (scope, date, entries) => ({
      className: scope.className,
      sectionName: scope.sectionName,
      date,
      entries,
    }),
    isReady: (scope) => !!(scope.className && scope.sectionName),
  },
  schoolClass: {
    sheetParams: (scope, { year, month }) => ({ classId: scope.classId, year, month }),
    markBody: (scope, date, entries) => ({
      schoolId: scope.schoolId,
      classId: scope.classId,
      date,
      entries,
    }),
    isReady: (scope) => !!scope.classId,
  },
};

/**
 * ScopePicker loader for this feature, cached per namespace.
 *
 * The cache is the point: ScopePicker's fetcher effect keys on the loader's **identity**, so a
 * fresh function every render would refetch the class list forever. One instance per namespace
 * keeps that stable for the teacher and both counsellor portals alike.
 */
const loaderCache = new Map();
export function attendanceClassesLoaderFor(apiBase = TEACHER_ATTENDANCE_BASE) {
  if (!loaderCache.has(apiBase)) {
    loaderCache.set(apiBase, classesFromEndpoint(`${apiBase}/classes`));
  }
  return loaderCache.get(apiBase);
}

/**
 * The month sheet for one class-section: the roster, their marks, and their month totals.
 *
 * `students[].attendance` is keyed "YYYY-MM-DD" and contains **every date of the month**, with
 * `null` for days this teacher hasn't marked. `dates` includes Sundays — the backend's
 * "excluding Sundays optionally" comment is aspirational, nothing is filtered.
 *
 * `presentCount`/`absentCount` are whole-month totals and only count the literal strings
 * "PRESENT"/"ABSENT"; `totalMarked` is their sum, not the number of stored records.
 *
 * Scoped to the calling teacher's id, so a co-teacher's marks for the same section are invisible
 * here — "unmarked" means "*I* haven't marked it".
 *
 * @returns {Promise<{ className: string, sectionName: string, year: number, month: number,
 *   monthName: string, dates: string[],
 *   students: Array<{ studentId: number, studentName: string,
 *                     attendance: Record<string, 'PRESENT'|'ABSENT'|null>,
 *                     presentCount: number, absentCount: number, totalMarked: number }> }>}
 */
export function fetchAttendanceSheet(
  { scope, year, month, apiBase = TEACHER_ATTENDANCE_BASE, adapter = ATTENDANCE_ADAPTERS.classSection },
  signal,
) {
  return staffApi.get(`${apiBase}/sheet`, {
    params: adapter.sheetParams(scope, { year, month }),
    signal,
  });
}

/**
 * Write one date's attendance for the whole class.
 *
 * Send the full roster, as the web does, not a diff: the server upserts on
 * `(teacher, student, date)` and the entry loop is `@Transactional`, so the call is idempotent and
 * one bad row rolls the whole batch back rather than half-applying it.
 *
 * The server validates almost nothing — no Sunday lock, no future-date rejection, no status enum
 * check, no duplicate-entry check. A null `status` NPEs into a 400 with a null message, so never
 * send an entry without one.
 *
 * @param {{ className: string, sectionName: string, date: string,
 *           entries: Array<{ studentId: number, status: 'PRESENT'|'ABSENT' }> }} payload
 */
export function markAttendance(
  { scope, date, entries, apiBase = TEACHER_ATTENDANCE_BASE, adapter = ATTENDANCE_ADAPTERS.classSection },
) {
  return staffApi.post(`${apiBase}/mark`, adapter.markBody(scope, date, entries));
}
