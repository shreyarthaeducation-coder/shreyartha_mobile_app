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
 *
 * ── SCHOOL-BOUND: `schoolBound` AND `schoolLogoSource` ──────────────────────
 * `StaffHomeScreen` puts the school's own crest in the lead position of the header. Only a role
 * that BELONGS to one school may show one, so it is declared here rather than inferred.
 *
 *   schoolBound      — this role belongs to exactly one school. Only then does StaffHomeScreen
 *                      pass `schoolLogoUrl`/`schoolName` to BrandBar.
 *   schoolLogoSource — where that identity comes from:
 *                        'profile'        → the role's own profileEndpoints DTO (`schoolLogo`)
 *                        'dashboardStats' → GET /api/school-admin/classes/dashboard-stats
 *
 * Set on `counselor`, `principal` and `vice_principal` only. The three `shreyartha_*` roles are HQ
 * roles that work ACROSS schools, and `sales` is not school staff at all — none of them should wear
 * a single school's crest. `sales` was previously safe only because `SalesController` happens not to
 * emit a `schoolLogo` field; that is an accident of a DTO, not a decision, which is why the rule is
 * now written down. Adding the field to that DTO must not silently change a header.
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
    // See the SCHOOL-BOUND note in the file header.
    schoolBound: true,
    schoolLogoSource: 'profile',
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
      // The face-to-face room. Also the centre FAB's destination — a tile as well, because the
      // FAB is only on the home screen and the workspace grid is where the panel is enumerated.
      { key: 'faceToFace', label: 'Face-to-Face Counselling', icon: 'mic-outline', native: '/staff/counselor/face-to-face' },
      { key: 'liveClasses', label: 'Live Classes', icon: 'videocam-outline', native: '/staff/counselor/live-classes' },
      { key: 'myCalendar', label: 'My Calendar', icon: 'calendar-outline', native: '/staff/counselor/my-calendar' },
      // BEYOND THE WEB SIDEBAR, deliberately. `StaffHrController` is one class-level guard naming
      // COUNSELOR explicitly alongside TEACHER, so a counsellor has always been able to read their
      // own balances, file leave and download payslips — the website simply never mounted a route.
      // Same call already made for the Principal's Fee/Leave/Payroll. See leave.js.
      // "My", not "Management" — these are the counsellor's OWN balances and payslips. The Vice
      // Principal panel carries both halves and the labels are what keep them apart there.
      { key: 'leave', label: 'My Leave', icon: 'today-outline', native: '/staff/counselor/leave' },
      { key: 'payroll', label: 'My Payslips', icon: 'cash-outline', native: '/staff/counselor/payroll' },
    ],
    headerActions: [],
  },

  principal: {
    userType: 'PRINCIPAL',
    label: 'Principal',
    schoolBound: true,
    // NOT 'profile' — `profileEndpoints` below is empty, so there is no profile DTO to read a logo
    // off. The principal's school identity comes from the school-admin dashboard stats instead,
    // which is the same call AdminOverviewScreen already makes.
    schoolLogoSource: 'dashboardStats',
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
      // ── SELF-SERVICE HR, and the labels are the whole safeguard ───────────────
      // The two above are the APPROVER queue on `/api/school-admin/hr` — other people's requests,
      // salary structures, payroll runs. These two are this Principal's OWN, on `/api/staff/hr`.
      // Two namespaces that share verb names: swap them and a Principal sees their own leave filed
      // under "Pending Approval", with no error anywhere. "… Management" administers others,
      // "My …" is yours — asserted in both directions in checkviceprincipal.mjs.
      //
      // Beyond the web sidebar, deliberately, and for the same reason as the other three panels:
      // `StaffHrController` names all eight staff roles explicitly, so a Principal has always been
      // able to file their own leave and read their own payslips. Only the sidebar entry was
      // missing — a gap in the WEBSITE, not a permission.
      { key: 'leave', label: 'My Leave', icon: 'today-outline', native: '/staff/principal/leave' },
      { key: 'payroll', label: 'My Payslips', icon: 'cash-outline', native: '/staff/principal/payroll' },
    ],
    headerActions: [],
  },

  vice_principal: {
    userType: 'VICE_PRINCIPAL',
    label: 'Vice Principal',
    schoolBound: true,
    schoolLogoSource: 'profile',
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
      // ── AND THE VP'S OWN LEAVE AND PAYSLIPS, WHICH ARE A DIFFERENT FEATURE ──
      // The four tiles above and below are easy to confuse and must not be: `leaveManagement` /
      // `payrollManagement` are the APPROVER queue on `/api/school-admin/hr` — other people's
      // requests, salary structures, payroll runs. `leave` / `payroll` are SELF-SERVICE on
      // `/api/staff/hr` — this VP's own balances and their own payslips. Two namespaces, two
      // screens, two sets of route files, and they share verb names.
      //
      // Hence the labels: anything reading "Management" administers OTHER staff; anything reading
      // "My" is the holder's own. `StaffHrController` names VICE_PRINCIPAL explicitly, so the
      // self-service half has always been authorised — the web sidebar just never mounted it.
      { key: 'leave', label: 'My Leave', icon: 'today-outline', native: '/staff/vice_principal/leave' },
      { key: 'payroll', label: 'My Payslips', icon: 'cash-outline', native: '/staff/vice_principal/payroll' },
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
    // CORRECTED Aug 2026. This read `[]`, annotated "no profile DTO on the web for this role".
    // That was true of the WEBSITE and false of the BACKEND, and the app had simply never asked.
    //
    // Both halves verified against the source before this changed, because a guard that passes and
    // a service that cannot find the user look identical from here:
    //   · `CounselorController.getProfile` is `hasAnyRole('COUNSELOR','UNVERIFIED_COUNSELOR')`, and
    //     `SecurityConfig` really does declare `SHREYARTHA_COUNCELLOR implies COUNSELOR` — so the
    //     hierarchy carries it, even though this codebase writes role lists longhand nearly
    //     everywhere as though it does not trust that.
    //   · `CounselorService.getCounselorProfile` looks the user up by `findByEmail` with **no
    //     userType filter**, so the row comes back for this role like any other.
    //
    // Two fields degrade rather than fail, and both are expected: `schoolName` is null because a
    // Shreyartha counsellor has no single `school`, and `assignedClasses` is always `[]` because
    // this role is scoped by `CounsellorSchoolLink` and not `CounselorClass`. Hence "Schools I
    // Cover" as its identity row rather than a class list — see constants/staffHome.js.
    profileEndpoints: ['/api/counselor/profile'],
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
      { key: 'faceToFace', label: 'Face-to-Face Counselling', icon: 'mic-outline', native: '/staff/shreyartha_councellor/face-to-face' },
      { key: 'queries', label: 'Queries', icon: 'help-circle-outline', native: '/staff/shreyartha_councellor/queries' },
      // Live Counselling is the Live Classes screen with a different scope source and wording —
      // hence the shared `live-classes` route. See app/staff/[role]/live-classes.js.
      { key: 'liveCounselling', label: 'Live Counselling', icon: 'videocam-outline', native: '/staff/shreyartha_councellor/live-classes' },
      { key: 'myCalendar', label: 'My Calendar', icon: 'calendar-outline', native: '/staff/shreyartha_councellor/my-calendar' },
      // Travel claims — Shreyartha's own employees only; /api/staff/travel-expenses names this role.
      { key: 'expenses', label: 'My Expenses', icon: 'car-outline', native: '/staff/shreyartha_councellor/travel-expenses' },
      // Beyond the web sidebar — `StaffHrController` names SHREYARTHA_COUNCELLOR explicitly.
      // Note the copy caveat: a SHREYA01 leave request reaches nobody by email until
      // `HrLeaveService.approversFor` is widened, because "SHREYARTHA_ADMIN" matches none of its
      // three clauses. The request is still filed and still decidable — it just arrives silently.
      { key: 'leave', label: 'My Leave', icon: 'today-outline', native: '/staff/shreyartha_councellor/leave' },
      { key: 'payroll', label: 'My Payslips', icon: 'cash-outline', native: '/staff/shreyartha_councellor/payroll' },
    ],
    headerActions: [],
  },

  /**
   * Field sales employee.
   *
   * Unlike every other entry here this role has no counterpart web sidebar to mirror verbatim —
   * the Sales panel was built on both platforms at once, so the item list below and
   * frontendmain/src/Sales/platform/SalesLayout.js's NAV are the same nine tiles by design.
   *
   * `basePath` is set even though NOTHING here uses `path`: every tile is native. It is left in
   * because `resolveStaffMenus` unconditionally prefixes it and a future WebView fallback would
   * otherwise resolve against `undefined`.
   *
   * Attendance, leave and payslips reuse the shared staff screens untouched — a sales rep is a
   * SchoolUser under SHREYA01, so /api/teacher/self-attendance and /api/staff/hr already serve
   * them now that SHREYARTHA_SALES is in those guards.
   */
  sales: {
    userType: 'SALES',
    label: 'Sales',
    basePath: `${PLATFORM_BASE}/sales/dashboard`,
    // There is no /api/sales/profile — the panel's own endpoint is under /api/staff/ so the
    // token picker resolves it. See services/salesService.js.
    profileEndpoints: ['/api/staff/sales/profile'],
    unlocks: [
      'Log geo-tagged school visits from the field',
      'Track your leads, deals and collections',
      'Watch your incentive build through the year',
    ],
    menu: [
      { key: 'profile', label: 'My Profile', icon: 'person-circle-outline', native: '/staff/sales/profile' },
      { key: 'tutorial', label: 'How this panel works', icon: 'help-circle-outline', native: '/staff/sales/sales-tutorial' },
      { key: 'leads', label: 'LEAD', icon: 'flag-outline', native: '/staff/sales/sales-leads' },
      { key: 'visits', label: 'Visits', icon: 'location-outline', native: '/staff/sales/sales-visits' },
      { key: 'schools', label: 'My Schools', icon: 'business-outline', native: '/staff/sales/sales-schools' },
      { key: 'deals', label: 'Sales', icon: 'cash-outline', native: '/staff/sales/sales-deals' },
      { key: 'dashboard', label: 'My Dashboard', icon: 'pie-chart-outline', native: '/staff/sales/sales-dashboard' },
      { key: 'incentive', label: 'My Incentive', icon: 'trophy-outline', native: '/staff/sales/sales-incentive' },
      { key: 'reports', label: 'Reports', icon: 'bar-chart-outline', native: '/staff/sales/sales-reports' },
      { key: 'selfAttendance', label: 'Self Attendance', icon: 'time-outline', native: '/staff/sales/self-attendance' },
      { key: 'myCalendar', label: 'My Calendar', icon: 'calendar-outline', native: '/staff/sales/my-calendar' },
      // Travel claims. A rep's check-ins are its stops automatically — see TravelExpensesScreen.
      { key: 'expenses', label: 'My Expenses', icon: 'car-outline', native: '/staff/sales/travel-expenses' },
      // "My", not "Management" — a rep only ever sees their own, as on every other panel.
      { key: 'leave', label: 'My Leave', icon: 'today-outline', native: '/staff/sales/leave' },
      { key: 'payroll', label: 'My Payslips', icon: 'wallet-outline', native: '/staff/sales/payroll' },
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
      // Beyond the web sidebar, and the only one of the four panels to get it: the adaptive
      // assessment controller is `hasAnyRole('TEACHER','VICE_PRINCIPAL')`, so this role reaches it
      // through SHREYARTHA_TEACHER → TEACHER rather than by being named. That inheritance is
      // relied on all over this shell, but VERIFY IT ON A REAL TOKEN before trusting this tile —
      // almost every other guard in the backend writes its role list longhand.
      { key: 'adaptiveAssessment', label: 'My Adaptive Assessment', icon: 'git-branch-outline', native: '/staff/shreyartha_teacher/adaptive-assessment' },
      { key: 'upskill', label: 'Upskill Your Self', icon: 'school-outline', native: '/staff/shreyartha_teacher/upskill' },
      { key: 'myCalendar', label: 'My Calendar', icon: 'calendar-outline', native: '/staff/shreyartha_teacher/my-calendar' },
      // Travel claims — Shreyartha's own employees only; /api/staff/travel-expenses names this role.
      { key: 'expenses', label: 'My Expenses', icon: 'car-outline', native: '/staff/shreyartha_teacher/travel-expenses' },
      // HR module, self-service on /api/staff/hr — this staff member's OWN leave and payslips.
      //
      // RELABELLED from "Leave Management" / "Payroll Management". Those names were fine while this
      // was the only staff panel carrying them, but the Vice Principal panel now carries BOTH these
      // and the approver-side screens on /api/school-admin/hr, which share their verb names. "My"
      // versus "Management" is what keeps the two apart, and it has to mean the same thing on every
      // panel to be worth anything.
      { key: 'leave', label: 'My Leave', icon: 'today-outline', native: '/staff/shreyartha_teacher/leave' },
      { key: 'payroll', label: 'My Payslips', icon: 'cash-outline', native: '/staff/shreyartha_teacher/payroll' },
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
