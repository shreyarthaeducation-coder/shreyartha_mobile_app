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
 * Completed attendance records — the offline fallback log.
 *
 * CLEARED ON LOGOUT, and it must stay that way. It used to be excluded on the grounds that "the
 * web keeps it across sessions too". The web does not any more: keeping it meant that on a shared
 * staffroom device, the next person to sign in saw the previous person's attendance rows. It is
 * one member of staff's record of their own working days, not a device-level cache.
 *
 * The cost of clearing it is that a rep who signs out mid-month loses the local copy of a log the
 * server already holds. That is the right trade.
 */
export const STAFF_ATTENDANCE_HISTORY_KEY = 'staffAttendanceHistory';

/**
 * The student's cached search index.
 *
 * MUST be in ALL_AUTH_KEYS below, for the same reason as STAFF_PHOTO_KEY. Every content tree the
 * index is built from applies a **per-school topic-alias overlay** server-side, so two students at
 * different schools genuinely see different names for the same topic id. Left behind on a shared
 * device, one student's index would answer the next one's searches with their school's vocabulary.
 *
 * The service also fingerprints the cache to the session, so this is the second of two guards
 * rather than the only one — but the fingerprint is a defence against a stale read, and this is
 * the one that makes the data actually go away.
 */
export const STUDENT_SEARCH_INDEX_KEY = 'studentSearchIndexV1';

/**
 * The parent's cached search index.
 *
 * Same reasoning as the student's, one step worse: this index is built from the CHILD's academic
 * tree and their assigned work, so leaving it behind on a shared device would show one parent
 * another family's syllabus and homework titles. In ALL_AUTH_KEYS below.
 */
export const PARENT_SEARCH_INDEX_KEY = 'parentSearchIndexV1';

/**
 * The partner's cached search index.
 *
 * The most sensitive of the three: it carries student names and per-subscription revenue for every
 * school the partner is linked to. In ALL_AUTH_KEYS below, and fingerprinted to the session on top.
 */
export const PARTNER_SEARCH_INDEX_KEY = 'partnerSearchIndexV1';

/**
 * The teacher's cached search index.
 *
 * Carries their class and section names. In ALL_AUTH_KEYS below — a staffroom device is shared more
 * often than a parent's phone, so this one earns the guard twice over.
 */
export const TEACHER_SEARCH_INDEX_KEY = 'teacherSearchIndexV1';

/**
 * The staff shells' cached search index — vice principal, both counsellors, Shreyartha teacher.
 *
 * ONE key for all four roles, and that is safe rather than lazy: a session holds exactly one staff
 * role, and the index is fingerprinted on the token AND the role key, so a role that somehow reused
 * a session would miss the cache rather than read another panel's rows.
 *
 * IT MUST STAY A SINGLE STATIC STRING. A per-role template — `staffSearchIndexV1:${roleKey}` — is
 * the obvious refactor and it would be a data leak: ALL_AUTH_KEYS below is a static array handed
 * straight to `multiRemove`, so a computed key is never cleared on logout, and the next staff member
 * on a shared staffroom device would inherit the previous one's school and class names. That leak is
 * the reason this file exists at all.
 *
 * Deliberately NOT reusing TEACHER_SEARCH_INDEX_KEY either: both fingerprint off `schoolUserToken`,
 * so sharing the key would let a teacher's cached index serve a vice principal's search with the
 * fingerprint check passing.
 */
export const STAFF_SEARCH_INDEX_KEY = 'staffSearchIndexV1';

/**
 * Sales check-ins captured while offline, waiting to sync.
 *
 * Cleared on logout like everything else here, and for a sharper reason than most: a queued visit
 * is attributed to whoever is signed in when it flushes. Left behind on a shared device it would
 * post one rep's visit under the next rep's account — and visits feed the closure report and,
 * through it, incentive money. Each queued item also carries the email it was captured under and
 * the flusher refuses anything that does not match, so neither guard depends on the other.
 */
export const SALES_VISIT_QUEUE_KEY = 'salesVisitQueueV1';

/** Everything a logout must remove, across every role. */
export const ALL_AUTH_KEYS = [
  ...SCHOOL_SESSION_KEYS,
  STAFF_ATTENDANCE_ACTIVE_KEY,
  // One person's own attendance rows. Added after the web fixed the same leak: on a shared
  // staffroom device this showed the previous user's log to the next one.
  STAFF_ATTENDANCE_HISTORY_KEY,
  STAFF_PHOTO_KEY,
  SALES_VISIT_QUEUE_KEY,
  STUDENT_SEARCH_INDEX_KEY,
  PARENT_SEARCH_INDEX_KEY,
  PARTNER_SEARCH_INDEX_KEY,
  TEACHER_SEARCH_INDEX_KEY,
  STAFF_SEARCH_INDEX_KEY,
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
  // Written at login from `ParentUserResponse.email` and shown on the dashboard's identity card.
  // Personal to one parent, so it belongs here for the same reason STAFF_PHOTO_KEY does: on a
  // shared device the next parent would otherwise see the previous one's address under their own
  // name. The partner list a few lines down already carries its equivalent.
  'parentUserEmail',
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
