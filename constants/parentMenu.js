/**
 * The parent dashboard menu.
 *
 * Labels and order mirror the web sidebar verbatim
 * (frontendmain/src/Parent/platform/ParentLayout.js → SIDEBAR_ITEMS) so a parent sees the same
 * vocabulary on both platforms.
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
 * ── THE WEB'S "HOME" ITEM IS NOT HERE, AND THAT IS DELIBERATE ────────────────
 * `ParentHome` renders exactly one thing: the linked child's profile card — avatar, name, class,
 * stream, school. On mobile the tile grid IS the home screen, and its Welcome header already shows
 * that card. A "Home" tile sitting on the home screen, navigating to information visible directly
 * above it, is noise. Eight tiles here + the header equals the web's nine sidebar items.
 */
export const PARENT_MENU = [
  { key: 'academic-progress', label: 'Academic Progress', icon: 'stats-chart-outline', native: '/parent/academic-progress' },
  { key: 'learning-activities', label: 'Learning Activities', icon: 'library-outline', native: '/parent/learning-activities' },
  { key: 'assessment-results', label: 'Assessment Results', icon: 'ribbon-outline', native: '/parent/assessment-results' },
  { key: 'counselor-notes', label: 'Counselor Notes', icon: 'chatbubbles-outline', native: '/parent/counselor-notes' },
  { key: 'counsellor-report', label: 'Counsellor Report', icon: 'reader-outline', native: '/parent/counsellor-report' },
  { key: 'attendance', label: 'Attendance', icon: 'calendar-outline', native: '/parent/attendance' },
  { key: 'schedule', label: 'Schedule', icon: 'today-outline', native: '/parent/schedule' },
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
