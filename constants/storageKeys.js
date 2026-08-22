/**
 * Single source of truth for auth-related AsyncStorage keys.
 *
 * Before this file, `context/AuthContext.logout()` and `services/apiService.clearAuthAndRedirect()`
 * each cleared their own hand-maintained — and different, and incomplete — list, so keys like
 * `schoolUserName`, `schoolCode` and `schoolUserVerified` survived a logout and leaked into the
 * next session. Both now import ALL_AUTH_KEYS, so the lists can never drift apart again.
 */

/**
 * The seven keys the web school portal writes on login
 * (frontendmain/src/School/SchoolAuth.js). These are also the exact set injected into the
 * WebView's localStorage so the web route guard accepts the session.
 */
export const SCHOOL_SESSION_KEYS = [
  'schoolUserToken',
  'schoolLoggedIn',
  'schoolUserType',
  'schoolUserVerified',
  'schoolUserName',
  'schoolUserEmail',
  'schoolCode',
];

/** Staff self-attendance session written on login, consumed on logout. */
export const STAFF_ATTENDANCE_ACTIVE_KEY = 'staffAttendanceActiveSession';

/**
 * Last known staff profile photo URL, cached so the home screen paints one on a cold start instead
 * of showing initials until the HR call returns.
 *
 * MUST be in ALL_AUTH_KEYS below: it is personal to one staff member, and leaving it behind would
 * put the previous user's face on the next one's home screen. This is the same leak that
 * schoolUserName/schoolCode/schoolUserVerified had before the two logout lists were merged.
 */
export const STAFF_PHOTO_KEY = 'staffProfilePhotoUrl';

/**
 * Completed attendance records. Deliberately NOT cleared on logout — it is the offline
 * fallback log, and the web keeps it across sessions too.
 */
export const STAFF_ATTENDANCE_HISTORY_KEY = 'staffAttendanceHistory';

/** Everything a logout must remove, across every role. */
export const ALL_AUTH_KEYS = [
  ...SCHOOL_SESSION_KEYS,
  STAFF_ATTENDANCE_ACTIVE_KEY,
  STAFF_PHOTO_KEY,
  // Student — the token is mirrored across four keys by the existing student login.
  'studentToken',
  'userToken',
  'accessToken',
  'token',
  'studentLoggedIn',
  'studentRole',
  // Written by CounselorScreen so the shared Shreya sheet can greet by name (it reads storage
  // rather than taking a prop, so one component serves four portals). Personal to one student —
  // leaving it behind would greet the next one by the previous one's name, the same leak
  // STAFF_PHOTO_KEY and partnerUserType each had.
  'studentUserName',
  'cachedStudentRole',
  // Parent
  'parentUserToken',
  'parentLoggedIn',
  'parentUserVerified',
  'parentUserName',
  'linkedStudentName',
  'linkedStudentEmail',
  // Partner
  'partnerUserToken',
  'partnerLoggedIn',
  'partnerUserVerified',
  'partnerUserName',
  'partnerUserEmail',
  'partnerCode',
  // BOTH SPELLINGS, DELIBERATELY. The login screen and the web both write `partnerUserType`; this
  // list only ever cleared `partnerType`, so the key that exists was never cleared and the key that
  // was cleared is never written — one partner's MASTER/NORMAL tier survived logout into the next
  // partner's session and decided whether they saw the Linked Partners tile. Same leak the staff
  // photo key had. Keep `partnerType` too: it costs nothing and the web may yet write it.
  'partnerUserType',
  'partnerType',
  // Shared
  'userType',
  'userData',
];
