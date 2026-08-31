/**
 * The teacher dashboard menu.
 *
 * Item labels and paths mirror the web sidebar verbatim
 * (frontendmain/src/School/Teacher/components/TeacherSidebar.js) plus the two header actions
 * from TeacherDashboard.js, so a teacher sees the same vocabulary on both platforms.
 *
 * Item shape:
 *   { key, label, icon, native? , path? }
 *     native — an in-app route; rendered as a native screen
 *     path   — a web path opened through app/teacher/feature.js (native header + WebView body)
 *
 * As feature pages get ported to native, flip a single item from `path` to `native` — nothing
 * else in the shell needs to change.
 *
 * ── ON THE GROUPING ──────────────────────────────────────────────────────────
 * The sixteen items are grouped into collapsible sections. **The grouping is the app's own** —
 * the web's teacher sidebar is still a flat sixteen-item list at 5f077b1, and the only regrouping
 * in frontendmain is commit 1f4b0e9, which reorganised the *admin* sidebar (37 items into six
 * collapsible sections) and touched no teacher file. The group vocabulary here follows that
 * commit's house style — see src/admin/dashboard/layout/adminNavGroups.js — so that if the web
 * teacher sidebar is grouped later, the two should line up rather than clash.
 *
 * Because the grouping is not mirrored from anywhere, it is safe to rearrange: moving an item
 * between groups is a pure presentation change. What must NOT change is the item set — every item
 * appears in exactly one group, and TEACHER_MENU is derived below rather than maintained by hand
 * so the flat and grouped views can never drift apart.
 */

const TEACHER_BASE = '/school/platform/teacher/dashboard';

/**
 * The groups that make up **My Workspace**.
 *
 * The dashboard redesign split the original five into two destinations. These four are Workspace;
 * HR & Payroll became My Attendance below. Nothing was added, removed or renamed — the item SET is
 * what must not drift, and `TEACHER_MENU` is still derived from both lists so it cannot.
 *
 * `My Profile` left this list for the footer's Profile tab, which is the only item that changed
 * home rather than group.
 */
export const TEACHER_WORKSPACE_GROUPS = [
  {
    key: 'classroom',
    label: 'Classroom',
    icon: 'easel-outline',
    items: [
      { key: 'attendance', label: 'Mark Attendance', icon: 'checkbox-outline', native: '/teacher/attendance' },
      { key: 'resources', label: 'My Teaching Resources', icon: 'folder-open-outline', native: '/teacher/resources' },
      { key: 'homework', label: 'Homework', icon: 'document-text-outline', native: '/teacher/homework' },
      { key: 'liveClasses', label: 'Live Classes', icon: 'videocam-outline', native: '/teacher/live-classes' },
      { key: 'syllabus', label: 'Syllabus Completion', icon: 'list-outline', native: '/teacher/syllabus' },
    ],
  },
  {
    key: 'assessment',
    label: 'Assessment',
    icon: 'clipboard-outline',
    items: [
      { key: 'reports', label: 'Test and Examination', icon: 'clipboard-outline', native: '/teacher/reports' },
      { key: 'adaptiveAssessment', label: 'My Adaptive Assessment', icon: 'analytics-outline', native: '/teacher/adaptive-assessment' },
    ],
  },
  {
    key: 'student-support',
    label: 'Student Support',
    icon: 'heart-outline',
    items: [
      { key: 'groups', label: 'Create Group', icon: 'people-outline', native: '/teacher/groups' },
      { key: 'counselling', label: 'Counselling Needs and Notes', icon: 'chatbubbles-outline', native: '/teacher/counselling' },
      { key: 'counsellorReport', label: 'Counsellor Report', icon: 'reader-outline', native: '/teacher/counsellor-report' },
    ],
  },
  {
    // Renamed from 'my-workspace': the whole screen is My Workspace now, so a group inside it with
    // the same name reads as a mistake. `My Profile` moved out to the footer's Profile tab.
    key: 'personal',
    label: 'Personal',
    icon: 'briefcase-outline',
    items: [
      { key: 'myCalendar', label: 'My Calendar', icon: 'calendar-outline', native: '/teacher/my-calendar' },
      { key: 'upskill', label: 'Upskill Your Self', icon: 'school-outline', native: '/teacher/upskill' },
    ],
  },
];

/**
 * **My Attendance** — the teacher's own employment record.
 *
 * This was the `hr-payroll` group, moved out whole rather than split. Its original comment already
 * drew exactly the line the redesign needed: Self Attendance belongs with Leave and Payroll because
 * it is the teacher's own record and feeds the same HR module (backend `HrStatutoryConstants`),
 * while **"Mark Attendance", which is about students, stays in Classroom**. The design's "view and
 * manage your attendance records" is these three and not that one.
 */
export const TEACHER_ATTENDANCE_ITEMS = [
  { key: 'selfAttendance', label: 'Self Attendance', icon: 'time-outline', native: '/teacher/self-attendance' },
  { key: 'leave', label: 'Leave Management', icon: 'calendar-number-outline', native: '/teacher/leave' },
  { key: 'payroll', label: 'Payroll Management', icon: 'cash-outline', native: '/teacher/payroll' },
];

/**
 * **My Profile** — the footer's Profile tab.
 *
 * Kept as a declared item rather than an inline route so it still appears in `TEACHER_MENU`, which
 * every route check and the search index read. A tab is a destination like any other; leaving it out
 * of the derived list is how it would quietly stop being verified.
 */
export const TEACHER_PROFILE_ITEM = {
  key: 'profile',
  label: 'My Profile',
  icon: 'person-circle-outline',
  native: '/teacher/profile',
};

/**
 * The flat list, DERIVED — never edit this directly. Anything that wants "every teacher tab"
 * (route checks, the chatbot's suffix map, the search index) reads this and stays correct as the
 * grouping changes.
 *
 * All three sources are included, so the sixteen original items are still exactly sixteen after the
 * redesign split them across two destinations and a tab.
 */
export const TEACHER_MENU = [
  ...TEACHER_WORKSPACE_GROUPS.flatMap((group) => group.items),
  ...TEACHER_ATTENDANCE_ITEMS,
  TEACHER_PROFILE_ITEM,
];

/**
 * Kept for the shared staff shell's config shape, which still expects `groups`.
 *
 * The teacher home no longer renders through `StaffMenuScreen`, but nothing else should have to care
 * that the grouping was reorganised — and if a future role wants the old accordion, this is what it
 * reads.
 */
export const TEACHER_GROUPS = TEACHER_WORKSPACE_GROUPS;

/** Header actions — the web renders these in the dashboard top bar rather than the sidebar. */
export const TEACHER_HEADER_ACTIONS = [
  {
    key: 'studentAnalytics',
    label: 'My Students Analytics',
    icon: 'bar-chart-outline',
    native: '/teacher/student-analytics',
  },
  {
    key: 'changePassword',
    label: 'Change Password',
    icon: 'key-outline',
    native: '/teacher/change-password',
  },
];

export { TEACHER_BASE };
