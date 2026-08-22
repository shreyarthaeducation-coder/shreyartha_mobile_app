/**
 * Native shells for the non-teacher school-staff roles.
 *
 * One entry per backend role, keyed by the EXACT lowercased `schoolUserType` string the login
 * response carries (constants/authPortals.js). Two spellings are deliberate and must never be
 * "corrected": `counselor` (single l) and `shreyartha_councellor` (the backend enum is
 * SHREYARTHA_COUNCELLOR). `teacher` is not here — it has its own group at app/teacher — and
 * `admin` is blocked on mobile at the login screen.
 *
 * Menu item shape matches constants/teacherMenu.js:
 *   { key, label, icon, native? , path? }
 *     native — an in-app route; rendered as a native screen
 *     path   — a web path opened through app/staff/[role]/feature.js (native header + WebView)
 *
 * Labels and paths mirror the web sidebars verbatim (frontendmain/src/School/<Role>/components/
 * *Sidebar.js) so staff see the same vocabulary on both platforms. Flipping an item from `path`
 * to `native` is all it takes to port a page.
 */

const PLATFORM_BASE = '/school/platform';

const shellRoutes = (role) => ({
  home: `/staff/${role}`,
  feature: `/staff/${role}/feature`,
  profile: `/staff/${role}/profile`,
  pending: `/staff/${role}/pending-verification`,
  changePassword: `/staff/${role}/change-password`,
});

// Header actions shared by every role: Change Password is native everywhere.
const changePasswordAction = (role) => ({
  key: 'changePassword',
  label: 'Change Password',
  icon: 'key-outline',
  native: shellRoutes(role).changePassword,
});

export const STAFF_ROLE_CONFIG = {
  counselor: {
    userType: 'COUNSELOR',
    label: 'Counselor',
    basePath: `${PLATFORM_BASE}/counselor/dashboard`,
    // Same DTO family as the teacher profile; validated by the web shell's own fetch.
    profileEndpoints: ['/api/counselor/profile'],
    unlocks: [
      'Mark and review student attendance',
      'Manage wellness groups and counselling notes',
      'Create counsellor reports for your classes',
    ],
    menu: [
      { key: 'profile', label: 'My Profile', icon: 'person-circle-outline', native: '/staff/counselor/profile' },
      { key: 'selfAttendance', label: 'Self Attendance', icon: 'time-outline', native: '/staff/counselor/self-attendance' },
      { key: 'attendance', label: 'Mark Attendance', icon: 'checkbox-outline', native: '/staff/counselor/attendance' },
      // "Wellness Groups" shares nothing with the teacher's "Create Group" — it is the
      // wellbeing-survey index screen. Same slot, different feature entirely.
      { key: 'groups', label: 'Wellness Groups', icon: 'people-outline', native: '/staff/counselor/groups' },
      { key: 'counselling', label: 'Counselling Needs and Notes', icon: 'chatbubbles-outline', native: '/staff/counselor/counselling' },
      { key: 'counsellorReport', label: 'Counsellor Report', icon: 'reader-outline', native: '/staff/counselor/counsellor-report' },
      { key: 'liveClasses', label: 'Live Classes', icon: 'videocam-outline', native: '/staff/counselor/live-classes' },
      { key: 'myCalendar', label: 'My Calendar', icon: 'calendar-outline', native: '/staff/counselor/my-calendar' },
    ],
    headerActions: [],
  },

  principal: {
    userType: 'PRINCIPAL',
    label: 'Principal',
    basePath: `${PLATFORM_BASE}/principal/dashboard`,
    // The web principal shell has no profile endpoint (it loads dashboard stats);
    // the native profile screen falls back to the values cached at login.
    profileEndpoints: [],
    // Verbatim from the web's own pending-verification card (PrincipalDashboard.js). Note it says
    // "the system administrator" where the VP card says "the school administrator".
    unlocks: [
      'View and manage school staff members',
      'Manage classes, sections, and subjects',
      'View school statistics and reports',
    ],
    // Mirrors PrincipalSidebar.js item for item — 15 entries, flat, no disabled items and no
    // conditional pushes — PLUS the three at the end, which the web left out.
    //
    // ── THE THREE THE WEBSITE FORGOT ──────────────────────────────────────────
    // Fee, Leave and Payroll Management have no PrincipalSidebar counterpart. That is a gap in the
    // WEBSITE, not a divergence here: the web mounts all three on SchoolAdminDashboard, and a
    // Principal token has always been authorised for them — `PRINCIPAL implies SCHOOL_ADMIN` in
    // SecurityConfig's roleHierarchy, `SchoolAdminFeeController` is `hasRole('SCHOOL_ADMIN')` and
    // `SchoolAdminHrController` is `hasAnyRole('SCHOOL_ADMIN','VICE_PRINCIPAL')`.
    // `HrLeaveService.approversFor` even counts Principals as part of the approver pool. Only the
    // sidebar entry was ever missing. Labels are verbatim from SchoolAdminSidebar.
    menu: [
      { key: 'overview', label: 'Dashboard Overview', icon: 'stats-chart-outline', native: '/staff/principal/overview' },
      // Already native and role-agnostic: TeacherSelfAttendanceController names PRINCIPAL, and the
      // web renders TeacherSelfAttendance here unchanged.
      { key: 'selfAttendance', label: 'Self Attendance', icon: 'time-outline', native: '/staff/principal/self-attendance' },
      { key: 'staff', label: 'Staff Management', icon: 'people-circle-outline', native: '/staff/principal/staff' },
      { key: 'classes', label: 'Class Management', icon: 'school-outline', native: '/staff/principal/classes' },
      // Deliberately NOT /reports: that route is the VP's teacher exam screen. The admin screen
      // owns exam records (create / edit / publish-to-parents), which a teacher cannot do.
      { key: 'reports', label: 'Test and Examination', icon: 'clipboard-outline', native: '/staff/principal/admin-reports' },
      { key: 'students', label: 'Student Management', icon: 'people-outline', native: '/staff/principal/students' },
      { key: 'linkedColleges', label: 'Linked Colleges', icon: 'business-outline', native: '/staff/principal/linked-colleges' },
      { key: 'staffAttendance', label: 'Staff Attendance', icon: 'timer-outline', native: '/staff/principal/staff-attendance' },
      { key: 'events', label: 'Events', icon: 'megaphone-outline', native: '/staff/principal/events' },
      { key: 'staffEvaluation', label: 'Staff Evaluation', icon: 'trending-up-outline', native: '/staff/principal/staff-evaluation' },
      { key: 'academicIqAliases', label: 'Academic IQ Aliases', icon: 'pricetag-outline', native: '/staff/principal/academic-iq-aliases' },
      { key: 'languageProAliases', label: 'Language Pro Aliases', icon: 'language-outline', native: '/staff/principal/language-pro-aliases' },
      { key: 'codingProAliases', label: 'Coding Pro Aliases', icon: 'code-slash-outline', native: '/staff/principal/coding-pro-aliases' },
      { key: 'liveMeeting', label: 'Live Meeting', icon: 'videocam-outline', native: '/staff/principal/live-meeting' },
      // /api/staff/**/calendar is role-agnostic by design — StaffMyCalendar serves six dashboards.
      { key: 'myCalendar', label: 'My Calendar', icon: 'calendar-outline', native: '/staff/principal/my-calendar' },
      { key: 'fees', label: 'Fee Management', icon: 'cash-outline', native: '/staff/principal/fees' },
      { key: 'leaveManagement', label: 'Leave Management', icon: 'calendar-number-outline', native: '/staff/principal/leave-management' },
      { key: 'payrollManagement', label: 'Payroll Management', icon: 'wallet-outline', native: '/staff/principal/payroll-management' },
    ],
    headerActions: [],
  },

  vice_principal: {
    userType: 'VICE_PRINCIPAL',
    label: 'Vice Principal',
    basePath: `${PLATFORM_BASE}/vice_principal/dashboard`,
    // The web VP shell is teacher-flavoured and fetches exactly this endpoint.
    profileEndpoints: ['/api/teacher/profile'],
    // Verbatim from the web's own pending-verification card (VicePrincipalDashboard.js).
    unlocks: [
      'Access your profile and classes',
      'Assign homework to students',
      'Upload resources and track syllabus completion',
    ],
    // FULLY NATIVE. Every screen here is the teacher screen with a different home route: the web
    // VP dashboard imports nine School/Teacher/pages/* components unchanged, and the role
    // hierarchy makes VICE_PRINCIPAL imply TEACHER, so no namespace differs. See
    // constants/vicePrincipalPortal.js for why that descriptor carries no paths.
    // Flat, not grouped — the web VP sidebar is a flat 11-item list.
    menu: [
      { key: 'profile', label: 'My Profile', icon: 'person-circle-outline', native: '/staff/vice_principal/profile' },
      { key: 'selfAttendance', label: 'Self Attendance', icon: 'time-outline', native: '/staff/vice_principal/self-attendance' },
      { key: 'attendance', label: 'Mark Attendance', icon: 'checkbox-outline', native: '/staff/vice_principal/attendance' },
      { key: 'groups', label: 'Create Group', icon: 'people-outline', native: '/staff/vice_principal/groups' },
      // One tile, four tabs. The website's single entry reaches only Assign + Submitted because
      // it renders AssignHomework without a `group` prop; ours honours the label. See
      // app/staff/[role]/homework.js.
      { key: 'homework', label: 'Assign Home Work, My Resources', icon: 'document-text-outline', native: '/staff/vice_principal/homework' },
      { key: 'liveClasses', label: 'Live Classes', icon: 'videocam-outline', native: '/staff/vice_principal/live-classes' },
      { key: 'syllabus', label: 'Syllabus Completion', icon: 'list-outline', native: '/staff/vice_principal/syllabus' },
      { key: 'reports', label: 'Test and Examination', icon: 'clipboard-outline', native: '/staff/vice_principal/reports' },
      { key: 'counselling', label: 'Counselling Needs and Notes', icon: 'chatbubbles-outline', native: '/staff/vice_principal/counselling' },
      { key: 'myCalendar', label: 'My Calendar', icon: 'calendar-outline', native: '/staff/vice_principal/my-calendar' },
      // "Upskill Your Self" is disabled on the web VP sidebar (no route registered) — omitted,
      // even though /api/teacher-skillsedge names VICE_PRINCIPAL.
      //
      // ── HR, WHICH THE WEB VP SIDEBAR ALSO LACKS ─────────────────────────────
      // `SchoolAdminHrController` names VICE_PRINCIPAL in its class-level guard, so a VP genuinely
      // is an approver — the backend was built for it and the flat 11-item web sidebar just never
      // mounted it. Same story as the Principal's three.
      //
      // **FEE MANAGEMENT IS NOT HERE AND MUST NOT BE.** `SchoolAdminFeeController` is
      // `hasRole('SCHOOL_ADMIN')`, and VICE_PRINCIPAL implies only TEACHER — a VP would get a
      // screen that renders and then 403s on every call.
      { key: 'leaveManagement', label: 'Leave Management', icon: 'calendar-number-outline', native: '/staff/vice_principal/leave-management' },
      { key: 'payrollManagement', label: 'Payroll Management', icon: 'wallet-outline', native: '/staff/vice_principal/payroll-management' },
    ],
    headerActions: [
      { key: 'studentAnalytics', label: 'My Students Analytics', icon: 'bar-chart-outline', native: '/staff/vice_principal/student-analytics' },
    ],
  },

  shreyartha_admin: {
    userType: 'SHREYARTHA_ADMIN',
    label: 'Shreyartha Admin',
    basePath: `${PLATFORM_BASE}/shreyartha_admin/dashboard`,
    profileEndpoints: [],
    unlocks: [
      'Manage SHREYA01 schools, classes and fees',
      'Review and assign incoming queries',
      'Verify counsellors and teachers',
    ],
    menu: [
      { key: 'overview', label: 'Dashboard Overview', icon: 'stats-chart-outline', path: '' },
      { key: 'selfAttendance', label: 'Self Attendance', icon: 'time-outline', path: '/self-attendance' },
      { key: 'staff', label: 'Staff Management', icon: 'people-circle-outline', path: '/staff' },
      { key: 'classes', label: 'Class Management', icon: 'school-outline', path: '/classes' },
      { key: 'reports', label: 'Test and Examination', icon: 'clipboard-outline', path: '/reports' },
      { key: 'students', label: 'Student Management', icon: 'people-outline', path: '/students' },
      { key: 'linkedColleges', label: 'Linked Colleges', icon: 'business-outline', path: '/linked-colleges' },
      { key: 'staffAttendance', label: 'Staff Attendance', icon: 'timer-outline', path: '/staff-attendance' },
      { key: 'events', label: 'Events', icon: 'megaphone-outline', path: '/events' },
      { key: 'staffEvaluation', label: 'Staff Evaluation', icon: 'trending-up-outline', path: '/staff-evaluation' },
      { key: 'academicIqAliases', label: 'Academic IQ Aliases', icon: 'pricetag-outline', path: '/academic-iq-aliases' },
      { key: 'languageProAliases', label: 'Language Pro Aliases', icon: 'language-outline', path: '/language-pro-aliases' },
      { key: 'codingProAliases', label: 'Coding Pro Aliases', icon: 'code-slash-outline', path: '/coding-pro-aliases' },
      { key: 'fees', label: 'Fee Management', icon: 'cash-outline', path: '/fees' },
      { key: 'queries', label: 'Queries', icon: 'help-circle-outline', path: '/queries' },
      // The web sidebar shows this as a second "Staff Management"; disambiguated here.
      { key: 'counsellorManagement', label: 'Counsellor & Teacher Management', icon: 'id-card-outline', path: '/counsellor-management' },
      { key: 'myCalendar', label: 'My Calendar', icon: 'calendar-outline', path: '/my-calendar' },
    ],
    headerActions: [],
  },

  shreyartha_councellor: {
    userType: 'SHREYARTHA_COUNCELLOR',
    label: 'Shreyartha Counsellor',
    basePath: `${PLATFORM_BASE}/shreyartha_councellor/dashboard`,
    // No profile DTO on the web for this role (its profile page lists school/class scope);
    // native profile falls back to the values cached at login.
    profileEndpoints: [],
    unlocks: [
      'Mark attendance across SHREYA01 schools',
      'Manage wellness groups and counselling notes',
      'Respond to queries and run live counselling',
    ],
    menu: [
      { key: 'profile', label: 'My Profile', icon: 'person-circle-outline', native: '/staff/shreyartha_councellor/profile' },
      { key: 'selfAttendance', label: 'Self Attendance', icon: 'time-outline', native: '/staff/shreyartha_councellor/self-attendance' },
      { key: 'attendance', label: 'Mark Attendance', icon: 'checkbox-outline', native: '/staff/shreyartha_councellor/attendance' },
      { key: 'groups', label: 'Wellness Groups', icon: 'people-outline', native: '/staff/shreyartha_councellor/groups' },
      { key: 'counselling', label: 'Counselling Needs and Notes', icon: 'chatbubbles-outline', native: '/staff/shreyartha_councellor/counselling' },
      { key: 'counsellorReport', label: 'Counsellor Report', icon: 'reader-outline', native: '/staff/shreyartha_councellor/counsellor-report' },
      { key: 'queries', label: 'Queries', icon: 'help-circle-outline', native: '/staff/shreyartha_councellor/queries' },
      // Live Counselling is the Live Classes screen with a different scope source and wording —
      // hence the shared `live-classes` route. See app/staff/[role]/live-classes.js.
      { key: 'liveCounselling', label: 'Live Counselling', icon: 'videocam-outline', native: '/staff/shreyartha_councellor/live-classes' },
      { key: 'myCalendar', label: 'My Calendar', icon: 'calendar-outline', native: '/staff/shreyartha_councellor/my-calendar' },
    ],
    headerActions: [],
  },

  shreyartha_teacher: {
    userType: 'SHREYARTHA_TEACHER',
    label: 'Shreyartha Teacher',
    basePath: `${PLATFORM_BASE}/shreyartha_teacher/dashboard`,
    // The web s01-teacher shell fetches exactly this endpoint.
    profileEndpoints: ['/api/teacher/profile'],
    unlocks: [
      'Access your SHREYA01 schools and classes',
      'Assign homework and share resources',
      'Track syllabus completion and student analytics',
    ],
    menu: [
      { key: 'profile', label: 'My Profile', icon: 'person-circle-outline', native: '/staff/shreyartha_teacher/profile' },
      { key: 'selfAttendance', label: 'Self Attendance', icon: 'time-outline', native: '/staff/shreyartha_teacher/self-attendance' },
      { key: 'attendance', label: 'Mark Attendance', icon: 'checkbox-outline', native: '/staff/shreyartha_teacher/attendance' },
      { key: 'groups', label: 'Create Group', icon: 'people-outline', native: '/staff/shreyartha_teacher/groups' },
      { key: 'liveClasses', label: 'Live Classes', icon: 'videocam-outline', native: '/staff/shreyartha_teacher/live-classes' },
      { key: 'subjects', label: 'Manage Subjects', icon: 'book-outline', native: '/staff/shreyartha_teacher/subjects' },
      { key: 'homework', label: 'Homework', icon: 'document-text-outline', native: '/staff/shreyartha_teacher/homework' },
      { key: 'resources', label: 'Resources', icon: 'folder-open-outline', native: '/staff/shreyartha_teacher/resources' },
      { key: 'syllabus', label: 'Syllabus Completion', icon: 'list-outline', native: '/staff/shreyartha_teacher/syllabus' },
      { key: 'counselling', label: 'Counselling Needs and Notes', icon: 'chatbubbles-outline', native: '/staff/shreyartha_teacher/counselling' },
      { key: 'counsellorReport', label: 'Counsellor Report', icon: 'reader-outline', native: '/staff/shreyartha_teacher/counsellor-report' },
      { key: 'upskill', label: 'Upskill Your Self', icon: 'school-outline', native: '/staff/shreyartha_teacher/upskill' },
      { key: 'myCalendar', label: 'My Calendar', icon: 'calendar-outline', native: '/staff/shreyartha_teacher/my-calendar' },
      // HR module. Only the two teacher sidebars carry these on the web — the counsellor,
      // principal and VP panels have no HR route registered, so they are deliberately absent
      // from those menus above.
      { key: 'leave', label: 'Leave Management', icon: 'calendar-number-outline', native: '/staff/shreyartha_teacher/leave' },
      { key: 'payroll', label: 'Payroll Management', icon: 'cash-outline', native: '/staff/shreyartha_teacher/payroll' },
    ],
    headerActions: [
      { key: 'studentAnalytics', label: 'My Students Analytics', icon: 'bar-chart-outline', native: '/staff/shreyartha_teacher/student-analytics' },
    ],
    // Mounts the floating Shreya launcher, as the web does — ShreyarthaTeacherDashboard imports
    // TeacherChatbotLauncher, and both AI controllers allow SHREYARTHA_TEACHER. `isShreya01` drops
    // the mainPortalOnly sections via teacherChatbotData's sectionsForPortal().
    chatbot: { basePath: '/staff/shreyartha_teacher', isShreya01: true },
  },
};

/** Resolve a role config, or null for unknown/blocked roles. */
export function getStaffRoleConfig(role) {
  return STAFF_ROLE_CONFIG[String(role || '').toLowerCase()] || null;
}

/**
 * Expand a config for consumption by the shell screens: menu/header items get absolute web
 * paths, and every role gets the shared Change Password action appended.
 */
export function resolveStaffMenus(roleKey) {
  const config = getStaffRoleConfig(roleKey);
  if (!config) return null;

  const withAbsolutePath = (item) =>
    item.path !== undefined ? { ...item, path: `${config.basePath}${item.path}` } : item;

  return {
    ...config,
    roleKey,
    routes: shellRoutes(roleKey),
    menu: config.menu.map(withAbsolutePath),
    headerActions: [...config.headerActions.map(withAbsolutePath), changePasswordAction(roleKey)],
  };
}
