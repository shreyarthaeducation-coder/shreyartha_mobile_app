/**
 * The parent dashboard menu.
 *
 * Labels use the website's words (frontendmain/src/Parent/platform/ParentLayout.js) so a parent
 * sees the same vocabulary on both platforms; the arrangement is the app's own (see below).
 *
 * Item shape matches constants/studentMenu.js and constants/teacherMenu.js:
 *   { key, label, icon, native?, path? }
 *     native — an in-app route; rendered as a native screen
 *     path   — a web path opened through a WebView with the session injected
 *
 * ── ONE PARENT, ONE CHILD ────────────────────────────────────────────────────
 * There is no child selector anywhere in this portal and there must not be one. `ParentUser` has a
 * single `linkedStudent` relation, and every `/api/parent/dashboard/*` endpoint resolves that child
 * from the JWT subject — the controller accepts no `studentId` at all, which is exactly what stops
 * one parent reading another's child. `linkedStudentName` is a single scalar in storage.
 *
 * ── CHANGE PASSWORD IS NOT A MENU ITEM ───────────────────────────────────────
 * The web puts it in the header, not the sidebar, and so do we — see PARENT_HEADER_ACTIONS.
 */

const PARENT_BASE = '/parent/platform/dashboard';

/**
 * ── WHAT THE HOME'S "ALL SECTIONS" GRID HOLDS (4 Nov 2026) ───────────────────
 * The app's own arrangement, no longer a copy of the web sidebar:
 * - **Counselling Report is not a section.** It is the second tab of View Report (the home's quick
 *   action), beside Test & Analysis — what the parent asked for. Search still finds it.
 * - **Attendance and Schedule are one section** with two tabs, as on the website since 3 Nov 2026.
 * - Home is not a tile: the tile grid IS home.
 * - Plans for my child is hidden from parents, here and on the website.
 * Each tile wears its area's hue (constants/parentColours).
 */
export const PARENT_MENU = [
  { key: 'academic-progress', label: 'Academic Progress', icon: 'stats-chart-outline', native: '/parent/academic-progress' },
  { key: 'learning-activities', label: 'Learning Activities', icon: 'library-outline', native: '/parent/learning-activities' },
  { key: 'attendance-schedule', label: 'Attendance & Schedule', icon: 'calendar-outline', native: '/parent/attendance-schedule' },
  { key: 'notifications', label: 'Notifications', icon: 'notifications-outline', native: '/parent/notifications' },
  { key: 'fees', label: 'School Fees', icon: 'cash-outline', native: '/parent/fees' },
];

/** The web renders these in the dashboard header rather than the sidebar. */
export const PARENT_HEADER_ACTIONS = [
  {
    key: 'changePassword',
    label: 'Change Password',
    icon: 'key-outline',
    native: '/parent/change-password',
  },
];

/**
 * Which tabs a parent can use before an admin verifies the account.
 *
 * The web gates unevenly: Home and Fees show a "pending verification" block, and the chatbot does
 * not mount — but the other seven pages just fetch and let the backend refuse, ending in generic
 * error states. We gate uniformly at the menu instead, so an unverified parent is told why rather
 * than shown seven broken screens. Nothing is lost: `ParentFeeController` hard-refuses an
 * unverified parent with a 403, and every dashboard endpoint needs a linked student that an
 * unverified account does not yet have.
 */
export const VERIFIED_ONLY = true;

export { PARENT_BASE };
