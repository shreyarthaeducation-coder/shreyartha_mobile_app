// services/parent/notificationService.js
// Mirrors: frontendmain/src/services/ApiServices.js `parentNotificationApi`
// Backend: parent/notification/controller/ParentNotificationController.java
//
// The parent inbox: every school event aimed at the child's class — scheduled, rescheduled,
// cancelled — and the evening-before reminder. Guarded hasRole('PARENT'), so an unverified parent
// gets a 403, which parentApi renders rather than treating as a dead session.

import { parentApi } from '../parentApi';

const BASE = '/api/parent/notifications';

/** `{ items:[{id, kind, title, body, eventId, eventStart, read, createdAt}], page, totalPages, unreadCount }` */
export function fetchParentNotifications(page = 0, signal) {
  return parentApi.get(BASE, { params: { page }, signal });
}

/** Just the badge number. Never throws — a failure is simply "no count". */
export async function fetchParentUnreadCount(signal) {
  try {
    const res = await parentApi.get(`${BASE}/unread-count`, { signal });
    return Number(res?.unreadCount) || 0;
  } catch {
    return 0;
  }
}

export function markParentNotificationRead(id) {
  return parentApi.post(`${BASE}/${id}/read`, {});
}

export function markAllParentNotificationsRead() {
  return parentApi.post(`${BASE}/read-all`, {});
}

/** Registers this phone's Expo push token for the signed-in parent. */
export function registerParentPushToken(token, platform) {
  return parentApi.put(`${BASE}/push-token`, { token, platform });
}

/**
 * A POST rather than a DELETE: the token carries '[' and ']', which a DELETE would have to put in a
 * query string. Called on logout while the session still exists.
 */
export function unregisterParentPushToken(token) {
  return parentApi.post(`${BASE}/push-token/unregister`, { token });
}
