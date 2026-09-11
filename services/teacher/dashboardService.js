// services/teacher/dashboardService.js
//
// The five rows of the teacher dashboard's Personal Details card.
//
// ══ THE CARD NEEDS TWO ENDPOINTS, NOT ONE ══════════════════════════════════
//   GET /api/teacher/profile   → fullName, email, assignedClasses[], schoolName
//   GET /api/staff/hr/profile  → profilePictureUrl AND employeeCode
//
// There is no single call with all five. The photo and the Teacher ID both live on the HR employee
// profile — `TeacherProfileResponse` has twelve fields and none of them is an image (its
// `schoolLogo` is the SCHOOL's crest, not the person) — so the HR call earns its place twice over.
// The old menu shell already made it for the photo alone.
//
// ══ WHAT THE DESIGN GETS WRONG ABOUT THE DATA ══════════════════════════════
//   "TCH10245"          Invented. `employeeCode` is generated as `{SCHOOLCODE}-EMP-{seq:0000}`, so
//                       real values read `SHREYA01-EMP-0007` — seventeen-plus characters, not eight.
//                       The column is nullable and an admin can overwrite it with free text, so
//                       "Not set" is a genuine state rather than a defensive nicety.
//
//   "Mathematics"       There is NO single-subject field anywhere. Subjects come only from
//                       `assignedClasses`, one row per (section, subject) — a teacher taking Maths
//                       in 8A, 8B and 9A has three rows all reading "Mathematics".
//
//                       Worse, `TeacherService.getTeacherProfile` applies **no academic-year
//                       predicate** — it calls `findByTeacher_Id` flat, and the website filters by
//                       year client-side. So the raw list can carry last year's subjects. Both the
//                       dedupe and the year filter have to happen here.
//
//   School              `SchoolUser.school` is a NULLABLE join. `schoolName` is null for a user
//                       whose `school_id` was never linked; only `schoolCode` is `nullable = false`.

import staffApi from '../staffApi';

/**
 * Both profile reads, independently guarded.
 *
 * Deliberately NOT `Promise.all`. The two have different role sets — `/api/teacher/profile` is the
 * only endpoint on the whole teacher surface that admits `UNVERIFIED_TEACHER`, while
 * `/api/staff/hr/profile` does not — so a pending teacher gets one success and one refusal, and the
 * identity card should still show the three rows it can.
 *
 * @returns {Promise<{ profile: object|null, hr: object|null }>}
 */
export async function loadTeacherIdentity() {
  const [profileRes, hrRes] = await Promise.allSettled([
    staffApi.get('/api/teacher/profile'),
    staffApi.get('/api/staff/hr/profile'),
  ]);

  return {
    profile: profileRes.status === 'fulfilled' ? profileRes.value : null,
    hr: hrRes.status === 'fulfilled' ? hrRes.value : null,
  };
}

/**
 * The subjects this teacher currently teaches, distinct and joined.
 *
 * Two filters, and both are load-bearing:
 *
 *   YEAR    `assignedClasses` is not year-filtered server-side. Without this a teacher who changed
 *           subject last April reads "Mathematics, Physics" forever. When no year is known the list
 *           is used whole rather than dropped — showing last year's subject beats showing none.
 *   DISTINCT One subject across four sections is four rows. Rendering them raw gives
 *           "Mathematics, Mathematics, Mathematics, Mathematics".
 *
 * Order is the order the server returned, first occurrence wins — there is no priority field to
 * sort on and inventing an alphabetical one would reorder a teacher's own list under them.
 *
 * @param {object|null} profile         TeacherProfileResponse
 * @param {number|null} academicYearId  null when the current year is unknown
 * @returns {string} '' when there are no assignments — a newly verified teacher has none
 */
export function subjectsTaught(profile, academicYearId = null) {
  const rows = Array.isArray(profile?.assignedClasses) ? profile.assignedClasses : [];

  const scoped = academicYearId
    ? rows.filter((row) => row?.academicYearId === academicYearId)
    : rows;

  const seen = new Set();
  const names = [];
  scoped.forEach((row) => {
    const name = String(row?.subjectName || '').trim();
    if (!name || seen.has(name)) return;
    seen.add(name);
    names.push(name);
  });

  return names.join(', ');
}

/**
 * The teacher's employee code, or null when one has not been assigned.
 *
 * `HrProfileService.getOrCreate` is the only creation path in the backend and it always sets a code,
 * and `GET /api/staff/hr/profile` calls it — so in practice the first read materialises one. The
 * column still allows null and an admin can blank it through the school-admin endpoint, so null is
 * handled rather than assumed away.
 */
export function teacherIdOf(hr) {
  const code = hr?.employeeCode;
  return typeof code === 'string' && code.trim() ? code.trim() : null;
}

/**
 * The school to show: its name, falling back to its code.
 *
 * `schoolName` comes off a nullable join and is null for an unlinked user; `schoolCode` is
 * `nullable = false` on `SchoolUser`, so it is the one thing always available. Falling back to it
 * beats an empty row, because the code is what the teacher's colleagues use anyway.
 */
export function schoolLabel(profile, storedCode = '') {
  const name = String(profile?.schoolName || '').trim();
  if (name) return name;
  return String(profile?.schoolCode || storedCode || '').trim();
}

/** The photo, from the HR profile. Null when the teacher has never uploaded one — the common case. */
export function photoOf(hr) {
  const url = hr?.profilePictureUrl;
  return typeof url === 'string' && url.trim() ? url.trim() : null;
}

/**
 * The SCHOOL's crest, from the role profile — not the person's photo, which is `photoOf(hr)`.
 *
 * `schoolLogo` has been on `TeacherProfileResponse` all along and was fetched and discarded on
 * every staff dashboard. It is now the left-hand mark in the header. Reads from whichever profile
 * DTO the caller has: the teacher's and (since this change) the counsellor's both carry the field
 * under the same name, so one accessor serves four of the six school-bound portals.
 *
 * Null when the school has no logo uploaded — the common case on a new school, and the header
 * falls back to the 3C Edge mark alone.
 */
export function schoolLogoOf(profile) {
  const url = profile?.schoolLogo;
  return typeof url === 'string' && url.trim() ? url.trim() : null;
}
