// services/staff/identityService.js
//
// The identity card for a redesigned staff panel: name, email, a role-specific third row, school,
// staff ID and a photo.
//
// ══ WHY THIS IS NOT services/teacher/dashboardService ══════════════════════
// Three of that file's five exports were already role-agnostic and now live HERE, with
// dashboardService re-exporting them so no teacher call site changes. What could not move is its
// entry point, and the reason is its signature rather than its body: `loadTeacherIdentity` assumes
// exactly ONE profile endpoint, and the four staff roles do not agree on that.
//
//   vice_principal         ['/api/teacher/profile']
//   shreyartha_teacher     ['/api/teacher/profile']
//   counselor              ['/api/counselor/profile']     — a different DTO family, same shape
//   shreyartha_councellor  []                             — see below
//
// So this loader takes a LIST, possibly empty, and tries each in order until one answers. That is
// the same contract StaffProfileScreen already implements against `config.profileEndpoints`.
//
// ══ THE EMPTY LIST IS A CODEBASE BUG, NOT A BACKEND ONE ════════════════════
// staffRoles.js records `profileEndpoints: []` for shreyartha_councellor, annotated "no profile DTO
// on the web for this role". That is true of the WEBSITE and false of the BACKEND:
// SHREYARTHA_COUNCELLOR implies COUNSELOR, CounselorController admits it, and CounselorService looks
// the user up by email with no userType filter. Handling the empty list keeps this module honest
// until that config is corrected in the Shreyartha Counsellor phase.
//
// ══ WHAT THE THIRD ROW CAN AND CANNOT SAY ══════════════════════════════════
// The teacher's third row is "Subject I Teach", from `assignedClasses`. Two of the four roles can
// NEVER fill it:
//
//   shreyartha_teacher     the role's entire premise is whole-school access WITHOUT class
//                          assignments, so `assignedClasses` is [] on every response, forever
//   shreyartha_councellor  scoped by CounsellorSchoolLink rather than CounselorClass — also []
//   vice_principal         only populated if somebody used Assign Class; usually empty
//
// Hence `designationOf` below: a real, populated field on every staff DTO, and the honest fallback
// for a row that would otherwise read "Not set" on three panels out of four.

import staffApi from '../staffApi';
import { formatShortDate } from '../../utils/currency';
import { photoOf, schoolLabel, schoolLogoOf, teacherIdOf } from '../teacher/dashboardService';
import { fetchLiveSchools } from '../teacher/liveSessionService';

/**
 * The profile read and the HR read, independently guarded.
 *
 * Deliberately NOT `Promise.all`, for the same reason the teacher's is not: the two have different
 * role sets. `/api/staff/hr/profile` admits no unverified role at all, while `/api/teacher/profile`
 * and `/api/counselor/profile` each admit their own — so a pending staff member gets one success
 * and one refusal, and the card should still show the rows it can.
 *
 * The profile endpoints are tried IN ORDER and the first answer wins, matching StaffProfileScreen.
 * An empty list is not an error: it yields `{ profile: null }` and the caller falls back to the
 * values cached at login.
 *
 * A 403 here is ordinary. `staffApi` treats it as a renderable error rather than a dead session —
 * which is the entire reason staff traffic does not go through `apiService`.
 *
 * @param {string[]} profileEndpoints tried in order; may be empty
 * @returns {Promise<{ profile: object|null, hr: object|null }>}
 */
export async function loadStaffIdentity(profileEndpoints = []) {
  const profileTask = (async () => {
    for (const endpoint of profileEndpoints) {
      try {
        const res = await staffApi.get(endpoint);
        if (res) return res;
      } catch {
        // Try the next endpoint. A total miss returns null and the caller uses stored values.
      }
    }
    return null;
  })();

  const [profileRes, hrRes] = await Promise.allSettled([
    profileTask,
    staffApi.get('/api/staff/hr/profile'),
  ]);

  return {
    profile: profileRes.status === 'fulfilled' ? profileRes.value : null,
    hr: hrRes.status === 'fulfilled' ? hrRes.value : null,
  };
}

/**
 * The staff member's designation, or null.
 *
 * Populated at signup on `SchoolUser` and returned by every staff profile DTO, which makes it the
 * one third-row candidate that works for all four roles. `department` is the same shape if a panel
 * would rather show that.
 */
export function designationOf(profile) {
  const value = profile?.designation;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Replace this staff member's profile photo. Returns the new URL.
 *
 * `@RequestParam("file")`, not `@RequestPart` — which is why this goes through `staffApi.multipart`
 * with the part named `file`. React Native's FormData produces a part with no content type of its
 * own, and a `@RequestPart` binding rejects that with a 415 before the handler is ever reached;
 * every upload in this codebase takes a `@RequestParam MultipartFile` for exactly that reason.
 *
 * The caller is responsible for writing the returned URL into `STAFF_PHOTO_KEY`, because
 * `StaffProfileScreen` READS that cache rather than making its own HR call — a fresh photo that
 * never reaches the cache shows on the dashboard and nowhere else.
 *
 * @param {{uri: string, name?: string, type?: string}} file from utils/filePicker
 */
export async function uploadStaffPhoto(file) {
  const res = await staffApi.multipart('/api/staff/hr/profile/photo', {
    files: {
      file: {
        uri: file.uri,
        name: file.name || 'photo.jpg',
        type: file.type || 'image/jpeg',
      },
    },
  });
  return res?.url || null;
}

/**
 * The staff member's joining date as "12 Jan 2024", or null.
 *
 * `dateOfJoining` lives on the HR profile beside `employeeCode` and `profilePictureUrl`, and until
 * the photo-led dashboard header it was fetched on every staff panel and rendered on none.
 *
 * NULL rather than a dash when it is absent, because the header OMITS a chip with no value instead
 * of printing a placeholder. It is genuinely nullable: a staff member who has never been through
 * payroll setup has no joining date recorded. `formatShortDate` would answer "-" here, which is why
 * the emptiness check comes first.
 */
export function joinedOn(hr) {
  const value = hr?.dateOfJoining;
  if (!value) return null;
  const formatted = formatShortDate(value);
  return formatted && formatted !== '-' ? formatted : null;
}

/**
 * The classes this staff member is assigned to, distinct and joined — the counsellor's third row.
 *
 * Only ONE of the four redesigned roles can fill this. A school-bound counsellor is assigned classes
 * through the Academic Management tab on their own profile, so `assignedClasses` is real for them;
 * the two Shreyartha roles have none by design, and a Vice Principal has them only if somebody used
 * Assign Class. Everyone else shows Designation instead.
 *
 * Deduped by "className sectionName", because the array carries one row per (section, subject) — a
 * counsellor covering three subjects in 9-A would otherwise read "9 A, 9 A, 9 A". No academic-year
 * filter, unlike the teacher's equivalent: the counsellor DTO does not carry one to filter on.
 *
 * @returns {string} empty when there are none, which the card renders as "Not set"
 */
export function classesSupported(profile) {
  const seen = new Set();
  for (const row of profile?.assignedClasses || []) {
    const label = [row?.className, row?.sectionName].filter(Boolean).join(' ');
    if (label) seen.add(label);
  }
  return [...seen].join(', ');
}

/**
 * The schools this staff member covers — the Shreyartha Counsellor's third identity row.
 *
 * UNLIKE `classesSupported`, THIS NEEDS A SECOND REQUEST. The counsellor's classes ride along on
 * the profile response for free; a Shreyartha counsellor's scope does not appear on any profile DTO
 * at all, because the role is scoped by `CounsellorSchoolLink` rather than `CounselorClass` — so
 * `assignedClasses` is `[]` on every response, forever, and there is nothing on the profile to read.
 *
 * The endpoint is the SAME ONE its Live Counselling screen already calls, returning the identical
 * `[{schoolId, schoolCode, schoolName, classes:[…]}]` shape as the teacher's school tree. Passing it
 * to `fetchLiveSchools` is reuse rather than coincidence — `liveSessionService` documents that the
 * two sources differ only in which schools they list.
 *
 * Failure is silent and total: the row falls back to Designation. An identity row is not worth an
 * error state, and this role's card is perfectly readable without it.
 *
 * @param {string} endpoint the descriptor's `identityRow3.endpoint`
 * @returns {Promise<string>} comma-joined names, or '' — which the card renders as "Not set"
 */
export async function loadSchoolsCovered(endpoint) {
  if (!endpoint) return '';
  try {
    const schools = await fetchLiveSchools(undefined, endpoint);
    const seen = new Set();
    for (const school of schools || []) {
      const name = String(school?.schoolName || '').trim();
      if (name) seen.add(name);
    }
    return [...seen].join(', ');
  } catch {
    return '';
  }
}

/**
 * Whether the live profile says this account is verified.
 *
 * Returns `null` — not `false` — when the profile could not be read, which is the whole point.
 * `null` means "no answer", and the caller must fall back to the flag stored at login rather than
 * treating silence as a revocation. Getting this wrong locks out every role whose profile endpoint
 * refused, and for shreyartha_councellor (no profile endpoint at all) that would be every session.
 */
export function liveVerified(profile) {
  if (!profile || profile.verified == null) return null;
  return !!profile.verified;
}

// Re-exported so a staff screen imports its identity helpers from one place. The implementations
// stay in the teacher module because checkteacherdashboard.mjs asserts on that file's source text.
export { photoOf, schoolLabel, schoolLogoOf, teacherIdOf };

/** `teacherIdOf` under a role-neutral name — it reads `hr.employeeCode` and always did. */
export const staffIdOf = teacherIdOf;
