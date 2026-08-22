/**
 * API namespaces for the two counsellor portals.
 *
 * The web builds both from ONE `CounselorDashboard` with component props
 * (frontendmain/src/School/Counselor/CounselorDashboard.js, driven by
 * School/Counselor/index.js and School/ShreyarthaCounsellor/index.js). This mirrors that: one
 * native screen per feature, told which portal it is serving.
 *
 * SPELLINGS ARE LOAD-BEARING. `counselor` has one l; `shreyartha_councellor` is COUNCELLOR with a
 * c. Both match the exact lowercased `schoolUserType` the login response carries — see the header
 * of constants/staffRoles.js. Never "correct" either.
 *
 * WHY PORTAL B MIXES NAMESPACES: `/survey/categories`, `/survey/indices/update`,
 * `/survey/indices/override`, `/survey/indices/graph` and the whole `/psychometric/*` block stay on
 * `/api/counselor/*` for BOTH portals — those controllers are guarded
 * `hasAnyRole('COUNSELOR','SHREYARTHA_COUNCELLOR')` and there is no shreya01 twin.
 * `ShreyarthaCounsellorGroups.js` does exactly this. It reads like an inconsistency and is not one;
 * "tidying" the shared paths to `/api/shreya01/` returns 404.
 */

/** Paths shared by both portals, regardless of which one is active. */
export const SHARED_COUNSELLOR_API = {
  surveyCategories: '/api/counselor/survey/categories',
  surveyIndexUpdate: '/api/counselor/survey/indices/update',
  surveyIndexOverride: '/api/counselor/survey/indices/override',
  surveyGraph: '/api/counselor/survey/indices/graph',
  psychometric: '/api/counselor/psychometric',
  // Guarded hasAnyRole(TEACHER, COUNSELOR, PRINCIPAL, VICE_PRINCIPAL, SCHOOL_ADMIN, …) despite the
  // path. The counsellor uses the teacher route unchanged — do not build a variant.
  selfAttendance: '/api/teacher/self-attendance',
  // StaffMyCalendar serves six dashboards; these are role-agnostic by design.
  calendar: '/api/staff',
};

export const COUNSELLOR_PORTALS = {
  counselor: {
    key: 'counselor',
    label: 'Counsellor',
    /** ScopePicker shape: academic year → class → section. */
    scope: 'classSection',
    attendance: '/api/counselor/attendance',
    counselling: '/api/counselor/counselling',
    report: '/api/counselor/counsellor-report',
    /** Root for profile / available-classes / assign-class / class-assignment. */
    profile: '/api/counselor',
    scopeClasses: '/api/counselor/groups/classes',
    surveyIndices: '/api/counselor/survey/indices',
    /** Live Classes — the same session endpoints the teacher panel uses. */
    liveSessionScope: '/api/shreya01/schools',
    hasQueries: false,
    hasLiveClasses: true,
    hasLiveCounselling: false,
  },

  shreyartha_councellor: {
    key: 'shreyartha_councellor',
    label: 'Shreyartha Counsellor',
    /** School → class. There is no section tier anywhere in this portal. */
    scope: 'schoolClass',
    schoolsClasses: '/api/shreya01/counsellor/schools-classes',
    attendance: '/api/shreya01/counsellor/attendance',
    counselling: '/api/shreya01/counsellor/counselling',
    report: '/api/shreya01/counsellor-report',
    profile: null, // no profile DTO — the web page lists the school/class scope instead
    surveyIndices: '/api/shreya01/counsellor/survey/indices',
    /** Live Counselling reuses the Live Classes endpoints; only the scope source differs. */
    liveSessionScope: '/api/shreya01/counsellor/schools-classes',
    // Note: `shreyartha`, not `shreya01`, and `councellor`. Three spellings in one app.
    queries: '/api/shreyartha/councellor',
    hasQueries: true,
    hasLiveClasses: false,
    hasLiveCounselling: true,
  },
};

/** Resolve a portal descriptor from a route's `[role]` segment. Null for non-counsellor roles. */
export function getCounsellorPortal(role) {
  return COUNSELLOR_PORTALS[String(role || '').toLowerCase()] || null;
}
