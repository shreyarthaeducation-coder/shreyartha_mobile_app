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
 * ── SEVERAL CHILDREN, ONE SHOWING (6 Nov 2026) ───────────────────────────────
 * A parent may now link several children (My Children). Which one every screen shows is held on
 * the SERVER (`ParentUser.linkedStudent`, set by PUT /api/parent/children/{id}/select), and every
 * `/api/parent/dashboard/*` endpoint still resolves that child from the JWT subject — no endpoint
 * takes a `studentId`, which is what stops one parent reading another's child.
 *
 * ── CHANGE PASSWORD IS NOT A MENU ITEM ───────────────────────────────────────
 * The web puts it in the header, not the sidebar, and so do we — see PARENT_HEADER_ACTIONS.
 */

const PARENT_BASE = '/parent/platform/dashboard';

/**
 * ── WHAT THE HOME'S "ALL SECTIONS" GRID HOLDS (6 Nov 2026) ───────────────────
 * EVERY feature of the parent login — "all sections should hold all the features". So the grid
 * repeats what the quick actions and the report card already open (View Report, Notifications,
 * Payment History) and lists the two halves of View Report — Test & Exam Analysis and Counselling
 * Report — as sections of their own, opening View Report on that tab.
 * - Home is not a tile: the tile grid IS home.
 * - Plans for my child is hidden from parents, here and on the website.
 * - Change Password is the row under the search box (PARENT_HEADER_ACTIONS), as on the website's header.
 * Labels are the website sidebar's words where it has the item. Each tile wears its area's hue
 * (constants/parentColours).
 */
export const PARENT_MENU = [
  { key: 'children', label: 'My Children', icon: 'people-outline', native: '/parent/children' },
  { key: 'view-report', label: 'View Report', icon: 'document-text-outline', native: '/parent/view-report' },
  { key: 'test-analysis', label: 'Test & Exam Analysis', icon: 'analytics-outline', native: '/parent/view-report?tab=tests' },
  {
    key: 'counselling-report',
    label: 'Counselling Report',
    icon: 'clipboard-outline',
    native: '/parent/view-report?tab=counselling',
  },
  { key: 'academic-progress', label: 'Academic Progress', icon: 'stats-chart-outline', native: '/parent/academic-progress' },
  { key: 'learning-activities', label: 'Learning Activities', icon: 'library-outline', native: '/parent/learning-activities' },
  { key: 'attendance-schedule', label: 'Attendance & Schedule', icon: 'calendar-outline', native: '/parent/attendance-schedule' },
  { key: 'notifications', label: 'Notifications', icon: 'notifications-outline', native: '/parent/notifications' },
  { key: 'fees', label: 'School Fees', icon: 'cash-outline', native: '/parent/fees' },
  { key: 'payment-history', label: 'Payment History', icon: 'receipt-outline', native: '/parent/fees?tab=history' },
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
