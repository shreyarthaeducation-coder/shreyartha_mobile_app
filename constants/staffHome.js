// constants/staffHome.js
//
// The redesigned staff panels: which tiles sit behind which hero, what the footer carries, and
// which support surface a role gets. One descriptor per role, consumed by components/staff/home/.
//
// ── WHY THIS FILE OWNS THE ARRANGEMENT AND NOT THE ITEMS ────────────────────
// The tiles themselves stay in constants/staffRoles.js, which every existing checker reads and
// compares key-for-key AND IN ORDER against the role's web sidebar. This file references them by
// key rather than redeclaring them, so:
//
//   * there is exactly one definition of a tile — its label, icon and route live in one place;
//   * `config.menu` keeps its web order, so checkviceprincipal and checkprincipal keep working
//     unchanged rather than needing their order assertions relaxed;
//   * and the arrangement below is free to differ from that order, which it must — a workspace grid
//     groups by subject matter, while the web sidebar is one flat list.
//
// The invariant that makes that safe is `assertArrangementCovers` below: every key in the role's
// menu must appear in exactly one destination. A tile dropped from a group is then not silently
// lost from the panel, and a tile pasted into two places is not silently duplicated.
//
// ── WHY NOT `config.groups` ─────────────────────────────────────────────────
// staffRoles.js role configs already support a `groups` key. It is deliberately NOT reused: it is
// read by StaffMenuScreen to render a collapsible accordion, and both checkviceprincipal.mjs and
// checkprincipal.mjs assert it is ABSENT because the web sidebars are flat. Putting a workspace
// grid there would conflate two different things and fight two live assertions.
//
// The teacher reached the same conclusion: its grouping lives in constants/teacherMenu.js, and
// `TEACHER_GROUPS` survives there only as a compat alias for the shared shell's config shape.

import { GRADIENT } from './theme';

/**
 * Vice Principal.
 *
 * First of the four because it is closest to the teacher: its profile screen is already the
 * teacher's exact three tabs, and every destination it needs already exists.
 *
 * ── THE HR SPLIT, WHICH ONLY THIS PANEL CARRIES BOTH HALVES OF ──────────────
 * `leaveManagement` / `payrollManagement` are the APPROVER queue on /api/school-admin/hr — other
 * people's requests, salary structures, payroll runs. `leave` / `payroll` are SELF-SERVICE on
 * /api/staff/hr — this VP's own balances and payslips. The two namespaces share verb names, so
 * putting them under one hero is how a VP ends up reading their own leave as a queue to approve.
 *
 * Hence the approver pair sits in Workspace under School Administration, and only the self-service
 * three go under My Attendance. My Attendance means the same thing on every panel: your own record.
 * The menu labels enforce the same line and checkviceprincipal.mjs asserts them in both directions.
 */
const VICE_PRINCIPAL = {
  role: 'vice_principal',

  heroes: [
    {
      key: 'workspace',
      title: 'My Workspace',
      subtitle: 'Attendance, homework, live classes and your school admin tools.',
      icon: 'briefcase',
      colors: GRADIENT.violet,
      shell: 'workspace',
    },
    {
      key: 'attendance',
      title: 'My Attendance',
      subtitle: 'Your own attendance record, leave and payslips.',
      icon: 'calendar',
      colors: GRADIENT.blue,
      shell: 'my-attendance',
    },
    {
      key: 'third',
      title: 'My Students Analytics',
      subtitle: 'Track student performance, progress and insights.',
      icon: 'stats-chart',
      colors: GRADIENT.teal,
      route: '/staff/vice_principal/student-analytics',
    },
  ],

  /** Workspace groups, by menu key. Order within a group is the order it renders. */
  workspaceGroups: [
    {
      key: 'classroom',
      label: 'Classroom',
      icon: 'easel-outline',
      itemKeys: ['attendance', 'homework', 'liveClasses', 'syllabus'],
    },
    {
      key: 'assessment',
      label: 'Assessment',
      icon: 'clipboard-outline',
      itemKeys: ['reports'],
    },
    {
      key: 'student-support',
      label: 'Student Support',
      icon: 'heart-outline',
      itemKeys: ['groups', 'counselling'],
    },
    // Beyond the web sidebar, and beyond anything a teacher can do: a VP is a real leave approver
    // and payroll admin. Grouped well away from the personal three, on purpose.
    {
      key: 'school-admin',
      label: 'School Administration',
      icon: 'business-outline',
      itemKeys: ['leaveManagement', 'payrollManagement'],
    },
    {
      key: 'personal',
      label: 'Personal',
      icon: 'person-outline',
      itemKeys: ['myCalendar'],
    },
  ],

  /** The My Attendance hub — the holder's OWN record. Never the approver queue. */
  attendanceItemKeys: ['selfAttendance', 'leave', 'payroll'],

  /** The footer's Profile tab. Declared, so the coverage assertion can see it. */
  profileItemKey: 'profile',

  attendanceNote:
    'Marking student attendance lives in My Workspace, under Classroom. This page is your own record.',

  /**
   * No Shreya, and the reason is subtler than a 403.
   *
   * A VP passes TeacherShreyaController's @PreAuthorize via VICE_PRINCIPAL → TEACHER, and is then
   * refused by a string comparison inside the service, which tests SchoolUser.userType against the
   * literals "TEACHER" and "SHREYARTHA_TEACHER". The result is an HTTP 400 about account types — a
   * failure that reads as a data bug rather than a permission. A help page is the honest surface.
   */
  support: 'help',

  /**
   * Search is on. The index is this panel's own menu plus its school and class names — not
   * `assignedClasses`, which a VP usually does not have. See services/staff/searchService.js.
   */
  search: true,
};

/**
 * Shreyartha Teacher.
 *
 * The cross-school teacher: everything a teacher does, but over SHREYA01's linked schools rather
 * than one roster. Closest of the four to the teacher panel in shape, and the only one of them that
 * can have Shreya.
 *
 * ── ITS IDENTITY CARD CANNOT SHOW A SUBJECT ─────────────────────────────────
 * The teacher's third row is "Subject I Teach", off `assignedClasses`. This role has none, by
 * design — whole-school access is the entire premise, so there are no `TeacherClass` rows and that
 * array is `[]` on every response, forever. StaffHomeScreen shows Designation instead, which is
 * populated at signup and real for every staff role.
 */
const SHREYARTHA_TEACHER = {
  role: 'shreyartha_teacher',

  heroes: [
    {
      key: 'workspace',
      title: 'My Workspace',
      subtitle: 'Classes, homework, resources and syllabus across your schools.',
      icon: 'briefcase',
      colors: GRADIENT.violet,
      shell: 'workspace',
    },
    {
      key: 'attendance',
      title: 'My Attendance',
      subtitle: 'Your own attendance record, leave and payslips.',
      icon: 'calendar',
      colors: GRADIENT.blue,
      shell: 'my-attendance',
    },
    {
      key: 'third',
      title: 'My Students Analytics',
      subtitle: 'Track student performance, progress and insights.',
      icon: 'stats-chart',
      colors: GRADIENT.teal,
      route: '/staff/shreyartha_teacher/student-analytics',
    },
  ],

  workspaceGroups: [
    {
      key: 'classroom',
      label: 'Classroom',
      icon: 'easel-outline',
      itemKeys: ['attendance', 'subjects', 'homework', 'resources', 'liveClasses', 'syllabus'],
    },
    {
      key: 'assessment',
      label: 'Assessment',
      icon: 'clipboard-outline',
      itemKeys: ['adaptiveAssessment'],
    },
    {
      key: 'student-support',
      label: 'Student Support',
      icon: 'heart-outline',
      itemKeys: ['groups', 'counselling', 'counsellorReport'],
    },
    {
      key: 'personal',
      label: 'Personal',
      icon: 'person-outline',
      itemKeys: ['myCalendar', 'upskill'],
    },
  ],

  /**
   * All three self-service on /api/staff/hr — this role has no approver side at all, so unlike the
   * Vice Principal there is no pair of similarly-named screens to keep apart here.
   */
  attendanceItemKeys: ['selfAttendance', 'leave', 'payroll'],

  profileItemKey: 'profile',

  attendanceNote:
    'Marking student attendance lives in My Workspace, under Classroom. This page is your own record.',

  /**
   * THE ONLY ONE OF THE FOUR THAT GETS SHREYA.
   *
   * `TeacherShreyaController` is `hasAnyRole('TEACHER','SHREYARTHA_TEACHER')` and the service behind
   * it compares `SchoolUser.userType` against those same two literals — so this role passes both
   * gates, and the other three fail one or the other. See StaffSupportScreen.
   *
   * It used to reach Shreya through a floating `ShreyaLauncher` mounted by StaffMenuScreen on
   * `config.chatbot`. Moving to StaffHomeScreen retires that FAB for this role automatically, which
   * is why the card below and the Support tab both exist: same reach, two doors, exactly as the
   * teacher panel did it.
   */
  support: 'shreya',

  /**
   * The tile paired with Shreya in the For Support block. The teacher pairs her with Live Classes;
   * this role has the same tile, so the pair reads identically across both panels.
   */
  supportPairKey: 'liveClasses',

  search: true,
};

/**
 * Counselor — the school-bound counsellor, and the first purple panel.
 *
 * ── ITS THIRD HERO IS A MENU TILE, WHICH THE OTHER TWO PANELS' IS NOT ───────
 * The teacher-flavoured panels put My Students Analytics there, a header action with no menu entry.
 * A counsellor has no student-analytics surface at all — what it has is Wellness Groups, the
 * wellbeing-survey index with its LOW/MODERATE/HIGH bands, which is the closest thing this role has
 * to "how are my students doing". So the hero names `itemKey` rather than `route`, and the coverage
 * check counts it.
 *
 * ── WELLNESS GROUPS IS NOT CREATE GROUP ─────────────────────────────────────
 * Same `groups` key and the same slot as the teacher's Create Group, and nothing whatsoever in
 * common: this one is the survey index over /api/counselor/survey and /psychometric. The wrapper
 * dispatches on role, and the counsellor branch is the FALLBACK there — which is why a new role
 * must always be named above it.
 */
const COUNSELOR = {
  role: 'counselor',

  heroes: [
    {
      key: 'workspace',
      title: 'My Workspace',
      subtitle: 'Attendance, counselling notes, reports and live classes.',
      icon: 'briefcase',
      colors: GRADIENT.violet,
      shell: 'workspace',
    },
    {
      key: 'attendance',
      title: 'My Attendance',
      subtitle: 'Your own attendance record, leave and payslips.',
      icon: 'calendar',
      colors: GRADIENT.blue,
      shell: 'my-attendance',
    },
    {
      key: 'third',
      title: 'Wellness Groups',
      subtitle: 'Wellbeing survey indices and per-student psychometric status.',
      icon: 'pulse',
      colors: GRADIENT.teal,
      itemKey: 'groups',
    },
  ],

  workspaceGroups: [
    {
      key: 'caseload',
      label: 'My Caseload',
      icon: 'people-outline',
      itemKeys: ['attendance', 'counselling', 'counsellorReport'],
    },
    {
      key: 'personal',
      label: 'Personal',
      icon: 'person-outline',
      itemKeys: ['liveClasses', 'myCalendar'],
    },
  ],

  attendanceItemKeys: ['selfAttendance', 'leave', 'payroll'],

  profileItemKey: 'profile',

  attendanceNote:
    'Marking student attendance lives in My Workspace, under My Caseload. This page is your own record.',

  /**
   * No Shreya. `TeacherShreyaController` is `hasAnyRole('TEACHER','SHREYARTHA_TEACHER')` and
   * COUNSELOR implies neither — the two namespaces are disjoint in the role hierarchy. There is no
   * counsellor Shreya controller and no counsellor context service anywhere, so this is not a guard
   * that could be widened; it would be a backend project.
   */
  support: 'help',

  /**
   * "Classes I Support", not "Subject I Teach".
   *
   * This is the one redesigned role whose `assignedClasses` is genuinely populated — a school-bound
   * counsellor is assigned classes through their own profile editor, which is what the Academic
   * Management tab is for. The two Shreyartha roles and usually the VP have none.
   */
  identityRow3: { label: 'Classes I Support', source: 'assignedClasses' },

  search: true,
};

/**
 * Shreyartha Counsellor — Portal B, and the last of the four.
 *
 * ══ THIS IS NOT THE COUNSELOR DESCRIPTOR WITH ONE TILE ADDED ═══════════════
 * The two counsellor portals look alike and are wired differently underneath, and that split is
 * fully implemented today: Portal A is **name-keyed** (`{className, sectionName}`) and Portal B is
 * **id-keyed** (`{schoolId, classId}`), with no section tier and no academic year anywhere in B.
 * This descriptor changes the HOME SCREEN only. Every screen below it keeps the wiring it has, and
 * a "tidy-up" that pointed one portal's screens at the other's paths would 404 or, worse, post the
 * wrong body shape to a real endpoint.
 *
 * Its two tiles that Portal A does not have — Queries and Live Counselling — are exactly the two
 * the web sidebar gives it. Nothing here is invented.
 *
 * `liveCounselling` routes to `live-classes`: it IS the Live Classes screen with a different scope
 * source and different wording, which is why the route is shared. Not a copy-paste slip.
 */
const SHREYARTHA_COUNCELLOR = {
  role: 'shreyartha_councellor',

  heroes: [
    {
      key: 'workspace',
      title: 'My Workspace',
      subtitle: 'Attendance, counselling notes, reports, queries and live counselling.',
      icon: 'briefcase',
      colors: GRADIENT.teal,
      shell: 'workspace',
    },
    {
      key: 'attendance',
      title: 'My Attendance',
      subtitle: 'Your own attendance record, leave and payslips.',
      icon: 'calendar',
      colors: GRADIENT.blue,
      shell: 'my-attendance',
    },
    {
      key: 'third',
      title: 'Wellness Groups',
      subtitle: 'Wellbeing survey indices and per-student psychometric status.',
      icon: 'pulse',
      colors: GRADIENT.violet,
      itemKey: 'groups',
    },
  ],

  workspaceGroups: [
    {
      key: 'caseload',
      label: 'My Caseload',
      icon: 'people-outline',
      itemKeys: ['attendance', 'counselling', 'counsellorReport', 'queries'],
    },
    {
      key: 'personal',
      label: 'Personal',
      icon: 'person-outline',
      itemKeys: ['liveCounselling', 'myCalendar'],
    },
  ],

  attendanceItemKeys: ['selfAttendance', 'leave', 'payroll'],

  profileItemKey: 'profile',

  attendanceNote:
    'Marking student attendance lives in My Workspace, under My Caseload. This page is your own record.',

  /** No Shreya, for the same reason Portal A has none — see the COUNSELOR descriptor above. */
  support: 'help',

  /**
   * "Schools I Cover" — and it is the only row on any of the four panels that costs a request.
   *
   * `assignedClasses` is `[]` for this role on every response, forever: it is scoped by
   * `CounsellorSchoolLink`, not `CounselorClass`, so there is nothing on the profile DTO to read.
   * The `endpoint` is the one its own Live Counselling screen already calls; a failure falls back
   * to Designation rather than showing an error, because an identity row is not worth one.
   */
  identityRow3: {
    label: 'Schools I Cover',
    source: 'schools',
    endpoint: '/api/shreya01/counsellor/schools-classes',
    icon: 'business-outline',
  },

  search: true,
};

/**
 * Principal — the first SIX-hero panel, and the template the Shreyartha Admin panel will be built
 * from next.
 *
 * ══ WHY THIS ONE LOOKS DIFFERENT ═══════════════════════════════════════════
 * The other four lead with three cards because they are practitioner panels: do your work, mark
 * your attendance, look at your students. A Principal's home is a set of school-wide dashboards,
 * so the design promotes four more destinations to the front and leaves the rest in Workspace.
 * That is why `heroes` is a list — see the note on `heroRoute`.
 *
 * ══ THE TWO FEE CARDS ARE ONE SCREEN, TWO TABS ═════════════════════════════
 * Total Fees Collected and Fees Pending both name the tile `fees` and differ only in `view`, which
 * opens `FeeManagementScreen` on its Payments and Due & Overdue tabs respectively. Both tabs
 * already exist; nothing was invented for the mockup. This is the only descriptor using `view`, and
 * it is why a placement is a `key|view` pair rather than a bare key.
 *
 * ══ PAYROLL & LEAVE MANAGEMENT IS ONE CARD OVER TWO SCREENS ════════════════
 * `itemKeys`, so it opens the admin hub listing both — the same shape `my-attendance` already has.
 * Note these are the APPROVER screens on /api/school-admin/hr; the Principal's own leave and
 * payslips sit under My Attendance with the other self-service tiles. Two namespaces, shared verb
 * names — checkprincipal.mjs asserts both the labels and the routes.
 *
 * ══ SHREYA IS THIS PANEL'S OWN, NOT THE TEACHER'S ══════════════════════════
 * The design shows a Chat with Shreya card, and no existing Shreya endpoint would serve it:
 * `TeacherShreyaController` is `hasAnyRole('TEACHER','SHREYARTHA_TEACHER')` and the hierarchy has
 * `PRINCIPAL implies SCHOOL_ADMIN` — not TEACHER — so a Principal is refused at the door with a
 * 403, not merely rejected inside the service like a VP.
 *
 * So the card is backed by `/api/principal/shreya`, a separate controller, chatbot service and
 * context service grounded in the school's own dashboards rather than in class assignments (which a
 * Principal does not have — the reason widening the teacher guard was rejected). `shreyaConfig`
 * below is what routes the sheet there; without it the sheet falls back to the teacher's service
 * and the chat fails on every message while looking perfectly healthy.
 */
const PRINCIPAL = {
  role: 'principal',

  heroes: [
    {
      key: 'workspace',
      title: 'My Work Space',
      subtitle: 'Access school resources, academic tools, circulars and important updates.',
      icon: 'briefcase',
      colors: GRADIENT.violet,
      shell: 'workspace',
    },
    {
      key: 'attendance',
      title: 'My Attendance',
      subtitle: 'Mark and manage your attendance records.',
      icon: 'calendar',
      colors: GRADIENT.blue,
      shell: 'my-attendance',
    },
    {
      key: 'feesCollected',
      title: 'Total Fees Collected',
      subtitle: 'Track total fees collected across all classes.',
      icon: 'wallet',
      colors: GRADIENT.green,
      itemKey: 'fees',
      view: 'payments',
    },
    {
      key: 'feesPending',
      title: 'Fees Pending',
      subtitle: 'View and follow up on pending fee payments.',
      icon: 'receipt',
      colors: GRADIENT.amber,
      itemKey: 'fees',
      view: 'due',
    },
    {
      key: 'hrAdmin',
      title: 'Payroll & Leave Management',
      subtitle: 'Manage staff payroll, leaves and approvals.',
      icon: 'people',
      colors: GRADIENT.indigo,
      itemKeys: ['leaveManagement', 'payrollManagement'],
    },
    {
      key: 'teachersProgress',
      title: 'Teachers Progress',
      subtitle: 'Monitor teachers performance, activities and progress insights.',
      icon: 'trending-up',
      colors: GRADIENT.violet,
      itemKey: 'staffEvaluation',
    },
  ],

  workspaceGroups: [
    {
      key: 'school',
      label: 'School',
      icon: 'business-outline',
      itemKeys: ['overview', 'staff', 'classes', 'students', 'linkedColleges'],
    },
    {
      key: 'academics',
      label: 'Academics',
      icon: 'school-outline',
      itemKeys: ['reports', 'academicIqAliases', 'languageProAliases', 'codingProAliases'],
    },
    {
      key: 'staffOps',
      label: 'Staff',
      icon: 'people-outline',
      itemKeys: ['staffAttendance', 'events'],
    },
    {
      key: 'personal',
      label: 'Personal',
      icon: 'person-outline',
      itemKeys: ['liveMeeting', 'myCalendar'],
    },
  ],

  attendanceItemKeys: ['selfAttendance', 'leave', 'payroll'],

  // No `profileItemKey`: unlike the other four, the Principal's menu carries no My Profile tile —
  // the profile is reached from the footer, as the design shows.

  attendanceNote:
    'Staff attendance for everyone else lives in My Workspace, under Staff. This page is your own record.',

  /**
   * The real Shreya, as the design shows — and the only staff panel besides Shreyartha Teacher
   * with one. This was `'help'` until the Principal Shreya backend landed, because every Shreya
   * endpoint refused this role: `TeacherShreyaController` is
   * `hasAnyRole('TEACHER','SHREYARTHA_TEACHER')` and the hierarchy declares
   * `PRINCIPAL implies SCHOOL_ADMIN`, not TEACHER — a 403 at the door.
   *
   * `shreyaConfig` names which chatbot this panel talks to. Without it the sheet falls back to the
   * TEACHER service, which would render a working chat pointed at an endpoint this role is refused
   * by — the failure would look like a backend outage rather than a missing key.
   */
  support: 'shreya',
  shreyaConfig: 'principal',

  /**
   * NO `supportPairKey`. Shreyartha Teacher pairs Shreya with Live Classes at ~48% width each; the
   * Principal's design puts Shreya full-width and gives Live Meeting its own banner above, so a
   * pair here would duplicate the banner's destination beside it.
   */

  /**
   * The design's banner between the heroes and For Support. Descriptor-driven so the Shreyartha
   * Admin panel can take the same one, and so a role without it renders nothing rather than an
   * empty strip.
   */
  banner: {
    key: 'liveMeeting',
    title: 'Schedule Live Meeting',
    subtitle: 'Schedule or join live meetings with staff, teachers and parents.',
    icon: 'videocam',
    cta: 'Schedule Meeting',
    itemKey: 'liveMeeting',
  },

  /**
   * The design's row order, which differs from the other four: they show the role-specific row
   * third, this one shows it last. Declared rather than hardcoded so the order is per-panel data.
   */
  identityRowOrder: ['name', 'email', 'school', 'staffId', 'row3'],

  identityRow3: { label: 'Role', source: 'designation', icon: 'ribbon-outline' },

  /** The pill under the photo. The design reads "Principal / Admin". */
  badge: { label: 'Principal / Admin' },

  search: true,
};

/**
 * Sales.
 *
 * The only panel here whose holder is not in a school building, which is what shapes the
 * arrangement: the hero that matters is the one they tap standing in a corridor between meetings,
 * so LEAD and Visits front the panel and everything reflective sits behind Workspace.
 *
 * ── NO "MY WORKSPACE" HERO ──────────────────────────────────────────────────
 * The other four panels lead with a Workspace card because their work IS the tile grid. A rep's
 * work is two tiles — find the school, log the visit — and burying those one tap deeper to keep
 * the shape uniform would cost them a tap on every visit, every day. The workspace shell is still
 * there, reached from the third hero, and still carries everything.
 *
 * ── SELF-ATTENDANCE MEANS SOMETHING DIFFERENT HERE ──────────────────────────
 * On every other panel My Attendance is a formality. A field rep's attendance is the thing their
 * manager actually reads, and it sits beside a visit log that also carries GPS — hence the note,
 * which spells out that the two are separate records and neither substitutes for the other.
 */
const SALES = {
  role: 'sales',

  heroes: [
    {
      key: 'leads',
      title: 'LEAD',
      subtitle: 'Your prospect pipeline — who you are working and what stage they are at.',
      icon: 'flag',
      colors: GRADIENT.violet,
      itemKey: 'leads',
    },
    {
      key: 'visits',
      title: 'Visits',
      subtitle: 'Check in at a school. Your location and the time are captured with the visit.',
      icon: 'location',
      colors: GRADIENT.blue,
      itemKey: 'visits',
    },
    {
      key: 'attendance',
      title: 'My Attendance',
      subtitle: 'Your own attendance record, leave and payslips.',
      icon: 'calendar',
      colors: GRADIENT.teal,
      shell: 'my-attendance',
    },
  ],

  workspaceGroups: [
    {
      key: 'business',
      label: 'Business',
      icon: 'briefcase-outline',
      itemKeys: ['schools', 'deals'],
    },
    {
      key: 'performance',
      label: 'Performance',
      icon: 'stats-chart-outline',
      // `dashboard` is placed here and NOWHERE else. assertArrangementCovers reports it as
      // `duplicated` if it also appears as a hero's itemKey.
      itemKeys: ['dashboard', 'incentive', 'reports'],
    },
    {
      key: 'personal',
      label: 'Personal',
      icon: 'person-outline',
      itemKeys: ['myCalendar', 'tutorial'],
    },
  ],

  attendanceItemKeys: ['selfAttendance', 'leave', 'payroll'],

  profileItemKey: 'profile',

  attendanceNote:
    'This is your own attendance, not your visit log. A day with visits logged is not automatically '
    + 'a day marked present, and vice versa — the two records are kept apart on purpose.',

  /**
   * No Shreya. There is no sales-facing Shreya backend at all — the four that exist are STUDENT,
   * PARENT, TEACHER and PRINCIPAL — and ShreyaChatSheet silently falls back to the TEACHER service
   * when it is handed no config, which would answer a rep's questions as though they taught a
   * class. A help page is the honest surface.
   */
  support: 'help',

  /** Search over this panel's own menu. There is no roster or class list to index. */
  search: true,
};

const STAFF_HOME = {
  principal: PRINCIPAL,
  vice_principal: VICE_PRINCIPAL,
  shreyartha_teacher: SHREYARTHA_TEACHER,
  counselor: COUNSELOR,
  shreyartha_councellor: SHREYARTHA_COUNCELLOR,
  sales: SALES,
};

/**
 * The descriptor for a role, or null.
 *
 * Null is load-bearing: it is what keeps every role without an entry — principal, shreyartha_admin,
 * and the three panels not yet redesigned — rendering StaffMenuScreen exactly as before.
 */
export function getStaffHome(roleKey) {
  return STAFF_HOME[String(roleKey || '').toLowerCase()] || null;
}

/**
 * Resolve a list of `itemKeys` against the role's real menu.
 *
 * Returns the menu items in the listed order, skipping any key the menu does not carry. Skipping
 * rather than throwing is deliberate — a role that legitimately loses a tile should render one card
 * fewer, not a blank screen. `assertArrangementCovers` is what turns an accidental omission into a
 * caught error instead of a silent one.
 */
export function itemsFor(menu, itemKeys = []) {
  const byKey = new Map((menu || []).map((item) => [item.key, item]));
  return itemKeys.map((key) => byKey.get(key)).filter(Boolean);
}

/**
 * Every menu key must land in exactly one destination — a workspace group, the attendance hub, or
 * the profile tab.
 *
 * This is the invariant the whole file rests on. Without it, moving a tile between groups can drop
 * it from the panel entirely and nothing would say so: the route still resolves, the screen still
 * renders, the tile is simply gone. It catches both directions, which a flat derived list cannot —
 * a key in no group, and a key in two.
 *
 * Exported rather than inlined so a checker can CALL it rather than grep for its shape.
 *
 * @returns {{ missing: string[], duplicated: string[], unknown: string[] }} all empty when correct
 */
export function assertArrangementCovers(menu, home) {
  const menuKeys = (menu || []).map((item) => item.key);

  // A PLACEMENT IS A KEY *AND* A VIEW, not a key alone.
  //
  // That distinction exists for one real case and it is worth stating plainly: the Principal's
  // mockup has two fee cards — Total Fees Collected and Fees Pending — and they are two views of
  // ONE screen, so both name the tile `fees`. Counting bare keys would report that as a tile placed
  // twice and refuse a correct panel. Counting `key|view` pairs keeps the duplicate check sharp:
  // two cards pointing at the same key AND the same view is still an error, and still caught,
  // because that genuinely is one destination rendered twice.
  const placed = [
    ...(home?.workspaceGroups || []).flatMap((group) => group.itemKeys || []),
    ...(home?.attendanceItemKeys || []),
    ...(home?.profileItemKey ? [home.profileItemKey] : []),
    // HEROES COUNT AS DESTINATIONS when they name menu tiles.
    //
    // A hero names its target in one of four ways and only two of them are tiles: `shell` (the
    // workspace or attendance hub — not in `menu`), `route` (a header action such as My Students
    // Analytics — also not in `menu`), `itemKey` (one tile), or `itemKeys` (several, for a card
    // that fronts a small hub of its own, like Payroll & Leave Management). Without the last two,
    // a tile promoted to the panel's most prominent card would report as "in no destination".
    ...(home?.heroes || []).flatMap((hero) => {
      const keys = hero.itemKeys || (hero.itemKey ? [hero.itemKey] : []);
      return keys.map((key) => (hero.view ? `${key}|${hero.view}` : key));
    }),
  ];

  const seen = new Map();
  for (const entry of placed) seen.set(entry, (seen.get(entry) || 0) + 1);

  // Compared on the bare key, because `missing` asks whether a tile is reachable AT ALL — a tile
  // placed only as `fees|due` is reachable, and reporting it missing would be false.
  const placedKeys = new Set([...seen.keys()].map((e) => e.split('|')[0]));

  return {
    missing: menuKeys.filter((key) => !placedKeys.has(key)),
    duplicated: [...seen.entries()].filter(([, count]) => count > 1).map(([entry]) => entry),
    unknown: [...placedKeys].filter((key) => !menuKeys.includes(key)),
  };
}

/**
 * The route a hero opens, or null.
 *
 * ONE resolver, called by the screen AND by the checker, so a hero cannot render one destination and
 * be verified against another. The four forms, in the order they are tested:
 *
 *   shell     'workspace' | 'my-attendance'  → the panel's own hub route
 *   itemKeys  two or more tiles              → the panel's admin hub, which lists them
 *   itemKey   one tile                       → that tile's own native route
 *   route     a literal                      → used as-is (a header action, not a menu tile)
 *
 * `view` is appended as a query param for a hero that opens one tab of a shared screen — the two
 * fee cards are the only users today. It is deliberately part of the ROUTE rather than descriptor
 * state the screen reads separately, so a deep link and a tap land in the same place.
 *
 * @param {object} hero
 * @param {string} roleKey the `[role]` URL segment
 * @param {Array<object>} menu the role's resolved menu, for itemKey lookups
 * @returns {string|null} null when the hero names a tile the menu does not carry
 */
export function heroRoute(hero, roleKey, menu = []) {
  if (!hero) return null;

  let base = null;
  if (hero.shell) base = `/staff/${roleKey}/${hero.shell}`;
  else if (hero.itemKeys?.length) base = `/staff/${roleKey}/admin-hub`;
  else if (hero.itemKey) base = itemsFor(menu, [hero.itemKey])[0]?.native || null;
  else if (hero.route) base = hero.route;

  if (!base) return null;
  return hero.view ? `${base}?view=${encodeURIComponent(hero.view)}` : base;
}

export { STAFF_HOME };
