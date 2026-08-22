/**
 * API namespaces for the admin-flavoured school panels.
 *
 * The web builds the Principal panel from twelve `School/Admin/pages/*` components rendered inside
 * its own shell (`Principal/PrincipalDashboard.js` — a hard fork of `Admin/SchoolAdminDashboard`,
 * not a prop-configured reuse). This mirrors that: one native screen per page, told which portal it
 * is serving.
 *
 * WHY A PER-FEATURE MAP AND NOT ONE `apiBase` STRING. `SHREYARTHA_ADMIN` renders the SAME twelve
 * pages, but only *some* of them move off `/api/school-admin`:
 *
 *   Class Management  → /api/shreya01/admin/**      (its own bulk routes)
 *   Queries           → /api/shreyartha/admin/**    (note `shreyartha`, not `shreya01`)
 *   everything else   → /api/school-admin/**        (unchanged)
 *
 * A single base would quietly move all twelve. Same shape of trap as the counsellor portals' three
 * spellings — it belongs in one descriptor, not in twelve call sites.
 *
 * `meetings` is deliberately OUTSIDE the school-admin namespace: StaffMeetingController is mapped
 * at `/api/school/staff-meetings` so the frontend attaches the school-user token. "Tidying" it
 * under `/api/school-admin/` returns 404.
 *
 * WHY THIS IS NOT IN staffScope.js: that resolver answers "what shape is this role's scope
 * PICKER" (academic year → class → section, or school → class). None of these admin pages use a
 * scope picker at all — they are school-wide, with the school taken from the token.
 */

/** Paths that are the same for every admin-flavoured portal, and are not school-admin-namespaced. */
export const SHARED_ADMIN_API = {
  /** GET only; the POST/import writes live under /api/school-admin/academic-years. */
  academicYears: '/api/school/academic-years',
  /** ImageUploadController — names PRINCIPAL explicitly. Used by the Overview school logo. */
  imageUpload: '/api/uploads/images',
  /** Curriculum pickers used by Class Management; both are SCHOOL_ADMIN-guarded. */
  curriculumClasses: '/api/curriculum/my-school/classes',
  codingCurriculums: '/api/coding/curriculums',
};

const SCHOOL_ADMIN = '/api/school-admin';

export const SCHOOL_ADMIN_PORTALS = {
  principal: {
    key: 'principal',
    label: 'Principal',

    // ── one entry per feature, all on /api/school-admin for this role ──────────
    /** dashboard-stats, school-logo, students, and the whole class/section/subject tree. */
    classes: `${SCHOOL_ADMIN}/classes`,
    /** Staff Management: list, pending, verify, unverify. */
    verification: `${SCHOOL_ADMIN}/verification`,
    /** Test and Examination — NOT the teacher's /api/teacher/reports. Different verbs. */
    reports: `${SCHOOL_ADMIN}/reports`,
    events: `${SCHOOL_ADMIN}/events`,
    staffAttendance: `${SCHOOL_ADMIN}/staff-attendance`,
    staffEvaluation: `${SCHOOL_ADMIN}/staff-evaluation`,
    linkedUniversities: `${SCHOOL_ADMIN}/linked-universities`,
    /** The three alias managers. Same three verbs each; see ALIAS_TREES for the shape difference. */
    topicAliases: `${SCHOOL_ADMIN}/topic-aliases`,
    languageProAliases: `${SCHOOL_ADMIN}/language-pro-aliases`,
    codingProAliases: `${SCHOOL_ADMIN}/coding-pro-aliases`,
    /** Academic-year WRITES (create, set-current, import-to). Reads use SHARED_ADMIN_API. */
    academicYearWrites: `${SCHOOL_ADMIN}/academic-years`,
    /** Live Meeting. Not under school-admin — see the header note. */
    meetings: '/api/school/staff-meetings',

    // ── HR and fees ───────────────────────────────────────────────────────────
    // These three were absent until now because PrincipalSidebar has no entry for them — but only
    // the SIDEBAR was missing. A Principal token has always been authorised: `PRINCIPAL implies
    // SCHOOL_ADMIN` in SecurityConfig's roleHierarchy, `SchoolAdminFeeController` is
    // `hasRole('SCHOOL_ADMIN')`, and `SchoolAdminHrController` is
    // `hasAnyRole('SCHOOL_ADMIN','VICE_PRINCIPAL')`. `HrLeaveService.approversFor` goes further and
    // names Principals as part of the approver pool outright. The website mounts all three on
    // SchoolAdminDashboard and simply never wired them into the Principal's.
    /** Fee Management — Setup, Student Fees, Payments, Due & Overdue. */
    fees: `${SCHOOL_ADMIN}/fees`,
    /** Leave approvals, staff balances, salary structures and payroll runs. */
    hr: `${SCHOOL_ADMIN}/hr`,
  },

  vice_principal: {
    key: 'vice_principal',
    label: 'Vice Principal',

    // ── HR ONLY, AND THAT IS THE WHOLE POINT OF THIS ENTRY ────────────────────
    // `SchoolAdminHrController` names VICE_PRINCIPAL in its class-level guard, so a VP genuinely is
    // an approver — the backend was built for it and the web VP sidebar (a flat 11 items) just
    // never mounted it.
    //
    // **NO `fees` KEY, EVER.** `SchoolAdminFeeController` is `hasRole('SCHOOL_ADMIN')` and
    // VICE_PRINCIPAL implies only TEACHER, so a VP would get a screen that renders and then 403s on
    // every call. This is the one place where a wrong menu is a guaranteed failure rather than a
    // cosmetic slip, so scripts/checkadminhr.mjs asserts the absence in both directions.
    //
    // Everything else the VP panel does is the TEACHER namespace — see
    // constants/vicePrincipalPortal.js, which deliberately carries no paths at all.
    hr: `${SCHOOL_ADMIN}/hr`,
  },
};

/**
 * The three alias managers differ in ONE way: how deep the tree is.
 *
 *   Academic IQ   class → subject → chapter → topic
 *   Language Pro  class → chapter → topic          (no subject tier)
 *   Coding Pro    class → chapter → topic          (no subject tier)
 *
 * Verified against the web sources, which are otherwise near-identical files. Everything else is
 * shared: `GET /{ns}/tree`, `PUT /{ns}/topic/{id}` with `{aliasName, displayOrder}`, and
 * `DELETE /{ns}/topic/{id}`. One screen reads this to know how many levels to render.
 */
export const ALIAS_TREES = {
  topicAliases: {
    key: 'topicAliases',
    title: 'Academic IQ Aliases',
    // Each level names the array key on its parent node.
    levels: ['subjects', 'chapters', 'topics'],
  },
  languageProAliases: {
    key: 'languageProAliases',
    title: 'Language Pro Aliases',
    levels: ['chapters', 'topics'],
  },
  codingProAliases: {
    key: 'codingProAliases',
    title: 'Coding Pro Aliases',
    levels: ['chapters', 'topics'],
  },
};

/** Resolve an admin portal descriptor from a route's `[role]` segment. Null for other roles. */
export function getAdminPortal(role) {
  return SCHOOL_ADMIN_PORTALS[String(role || '').toLowerCase()] || null;
}
