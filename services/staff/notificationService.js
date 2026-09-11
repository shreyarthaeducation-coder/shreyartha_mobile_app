// services/staff/notificationService.js
//
// The staff inbox behind the notification bell.
//
// ══ THE PATH PREFIX IS LOAD-BEARING ════════════════════════════════════════
// `/api/staff/` is what makes the WEBSITE's apiService attach a staff token. Mobile's `staffApi`
// has no such rule, but both clients share these URLs, so moving them would break one of the two
// silently. `checksales.mjs` already asserts this for the sales module.
//
// ══ WHY staffApi AND NOT apiService ════════════════════════════════════════
// `staffApi` renders a 403 as an error you can show; `apiService` treats it as a dead session and
// logs the user out. A staff member whose role is not in the controller's guard would otherwise be
// ejected from the app by a decoration on their dashboard.

import staffApi from '../staffApi';

const BASE = '/api/staff/notifications';

/**
 * One page of the inbox, newest first.
 *
 * @returns {Promise<{items: Array, page: number, totalPages: number, unreadCount: number}>}
 */
export async function fetchNotifications(page = 0) {
  return staffApi.get(`${BASE}?page=${page}`);
}

/**
 * Just the badge number.
 *
 * Its own endpoint rather than `fetchNotifications().unreadCount`, because every staff dashboard
 * asks for this on load and pulling fifty rows to read one integer would be the most expensive
 * thing on the home screen.
 *
 * ── IT NEVER THROWS ─────────────────────────────────────────────────────────
 * A bell is decoration on somebody else's dashboard. A staff role the controller does not admit,
 * a server that is down, a session that has just expired — none of those should surface an error
 * on a screen the user opened to do something else. Zero means "no badge", which is also what an
 * empty inbox means, and the two are indistinguishable to the reader by design.
 */
export async function fetchUnreadCount() {
  try {
    const res = await staffApi.get(`${BASE}/unread-count`);
    const count = Number(res?.unreadCount);
    return Number.isFinite(count) && count > 0 ? count : 0;
  } catch {
    return 0;
  }
}

/** Mark one notification read. Returns the new unread count. */
export async function markNotificationRead(id) {
  const res = await staffApi.post(`${BASE}/${id}/read`, {});
  const count = Number(res?.unreadCount);
  return Number.isFinite(count) ? count : 0;
}

/** Mark every unread notification read. Returns the new unread count, which is always 0. */
export async function markAllNotificationsRead() {
  await staffApi.post(`${BASE}/read-all`, {});
  return 0;
}

/**
 * Where a notification's `link` points, or null.
 *
 * ══ `link` IS A MENU KEY, NOT A ROUTE ══════════════════════════════════════
 * The server stores "leave", "deals", "leaveManagement" — the same keys `constants/staffRoles.js`
 * uses — and never a path. It cannot store a path: the panel segment differs per recipient
 * (`/staff/sales/leave` for a rep, `/teacher/leave` for a teacher), so one stored string could not
 * serve everybody the notification is sent to. This is the same per-portal resolution the parent
 * and teacher chapter links already need, and getting it wrong there produced links that resolved
 * on one client and 404'd on the other.
 *
 * Resolving against the RECIPIENT'S OWN MENU also means a key their role does not carry yields
 * null, and the row renders as unclickable rather than navigating into a screen they are refused.
 *
 * @param {string|null} link the stored menu key
 * @param {Array<{key, native}>} menu the role's resolved menu
 */
export function resolveNotificationRoute(link, menu = []) {
  if (!link) return null;
  const item = (menu || []).find((entry) => entry.key === link);
  return item?.native || null;
}

/** The Ionicons name for a notification category. Unknown categories get a plain bell. */
export function notificationIcon(category) {
  switch (category) {
    case 'LEAVE':
      return 'today-outline';
    case 'DEAL':
      return 'cash-outline';
    case 'INCENTIVE':
      return 'trophy-outline';
    case 'MEETING':
      return 'videocam-outline';
    case 'ACCOUNT':
      return 'person-circle-outline';
    // A travel claim approved, returned or paid (AdminTravelExpenseService). Its link, "expenses",
    // is the My Expenses menu key on the sales, Shreyartha teacher and Shreyartha counsellor shells.
    case 'EXPENSE':
      return 'car-outline';
    default:
      return 'notifications-outline';
  }
}
