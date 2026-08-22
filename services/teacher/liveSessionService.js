// services/teacher/liveSessionService.js
// Mirrors: frontendmain/src/School/Teacher/pages/SHREYA01/Shreya01LiveClasses.js
// Backend: shreya01/controller/Shreya01LiveSessionController.java
//
// Live Classes is Google Meet via the Google Calendar API — there is NO video SDK anywhere in this
// feature. The backend books a Meet conference and stores the URL; "joining" is opening a link.
// When GOOGLE_CALENDAR_ENABLED is off the session still saves, with a null link.
//
// This screen lives under /api/shreya01/ even though the plain Teacher dashboard mounts it, which
// is why it is the one screen in the panel that would port to the Shreyartha Teacher shell nearly
// for free.

import { staffApi } from '../staffApi';

export const SESSION_STATUS_META = {
  SCHEDULED: { label: 'Scheduled', color: '#3b82f6' },
  ONGOING: { label: 'Ongoing', color: '#f59e0b' },
  COMPLETED: { label: 'Completed', color: '#22c55e' },
  CANCELLED: { label: 'Cancelled', color: '#ef4444' },
};

/**
 * Which statuses a session can move to. Mirrors the backend's VALID_TRANSITIONS exactly —
 * COMPLETED and CANCELLED are terminal, so their rows show no action buttons at all.
 */
export const NEXT_STATUSES = {
  SCHEDULED: ['ONGOING', 'CANCELLED'],
  ONGOING: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export const SESSION_PAGE_SIZE = 10;
export const DURATION_OPTIONS = [30, 45, 60, 75, 90, 120];

/**
 * Schools the teacher is linked to, each with its classes nested.
 *
 * THERE IS NO SECTION TIER. The service returns
 * `[{ schoolId, schoolCode, schoolName, classes: [{ classId, className }] }]` and nothing else —
 * the web's section selector reads `selectedClass.sections`, a key that is never present, so that
 * whole branch is dead code and `sectionId` in the create payload is always null. This is
 * deliberate: every role that reaches this screen gets the whole-school student tree.
 */
export const LIVE_SCHOOLS_ENDPOINT = '/api/shreya01/schools';

/**
 * @param {AbortSignal} [signal]
 * @param {string} [endpoint] the scope source. The Shreyartha counsellor's Live Counselling screen
 *   passes `/api/shreya01/counsellor/schools-classes`, which returns the **identical** shape — the
 *   session endpoints below are shared between Live Classes and Live Counselling, and only the
 *   list of schools differs. Defaults to the teacher/counsellor Live Classes source.
 */
export async function fetchLiveSchools(signal, endpoint = LIVE_SCHOOLS_ENDPOINT) {
  const res = await staffApi.get(endpoint, { signal });
  return Array.isArray(res) ? res : [];
}

/**
 * One page of sessions. Spring `Page` — read `content` and `totalElements`.
 *
 * @returns {Promise<{ content: Array<object>, totalElements: number }>}
 */
export async function fetchSessions({ schoolId, classId, page = 0, status }, signal) {
  const res = await staffApi.get(
    `/api/shreya01/live-sessions/school/${schoolId}/class/${classId}`,
    { params: { page, size: SESSION_PAGE_SIZE, status: status || undefined }, signal },
  );
  return { content: res?.content || [], totalElements: res?.totalElements || 0 };
}

/**
 * Students for the attendee picker.
 *
 * A single page of 200 with no `page` param — the web never paginates here, so a class with more
 * than 200 students silently loses the rest. Surfaced in the UI rather than hidden.
 */
export async function fetchClassStudents({ schoolId, classId }, signal) {
  const res = await staffApi.get(
    `/api/shreya01/schools/${schoolId}/classes/${classId}/students`,
    { params: { size: 200 }, signal },
  );
  return res?.content || [];
}

/**
 * Schedule a session.
 *
 * @param {{ sessionDate: string, sessionTime: string, durationMinutes: number,
 *           selectedStudentIds: number[] }} payload
 *        `sessionDate` is `yyyy-MM-dd`, `sessionTime` is `HH:mm` — both `@NotBlank` server-side.
 * @returns {Promise<object>} the full session, whose `googleMeetLink` may be **null** if the
 *        Calendar call failed; the save still succeeds, so never claim a link was generated.
 */
export function createSession({ schoolId, classId }, payload) {
  return staffApi.post(`/api/shreya01/live-sessions/school/${schoolId}/class/${classId}`, {
    ...payload,
    sectionId: null, // no section tier exists — see fetchLiveSchools
  });
}

export function updateSessionStatus(sessionId, status) {
  return staffApi.put(`/api/shreya01/live-sessions/${sessionId}/status`, { status });
}

/** Emails + WhatsApp to the attendees. 400s when the session has no Meet link. */
export function notifyStudents(sessionId) {
  return staffApi.post(`/api/shreya01/live-sessions/${sessionId}/notify-students`, {});
}

/**
 * Sessions across a date range, grouped by day.
 *
 * The response is a LIST, not a date-keyed map:
 * `{ schoolId, from, to, calendar: [{ date, sessions: [{ sessionId, classId, className, time,
 *    studentCount, status }] }] }` — and **days with no sessions are omitted entirely**, so this
 * renders as a grouped list rather than a month grid.
 *
 * Note the per-day session objects use `status`, while the list endpoint's rows use
 * `sessionStatus`. Two names for the same field.
 */
export async function fetchSessionCalendar({ schoolId, from, to }, signal) {
  const res = await staffApi.get(`/api/shreya01/live-sessions/school/${schoolId}/calendar`, {
    params: { from, to },
    signal,
  });
  return Array.isArray(res?.calendar) ? res.calendar : [];
}
