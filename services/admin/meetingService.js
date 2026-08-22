// services/admin/meetingService.js
// Mirrors: frontendmain/src/School/shared/StaffLiveMeeting.js
// Backend: school/meeting/StaffMeetingController.java
//          @PreAuthorize("hasRole('SCHOOL_ADMIN') or hasRole('PRINCIPAL')") at class level.
//
// NOT UNDER /api/school-admin. The controller is mapped at /api/school/staff-meetings so the
// frontend's token rule attaches the school-user token. `meetings` is therefore its own key in
// constants/schoolAdminPortals.js and must never be folded into the admin base.
//
// SIBLING OF LIVE CLASSES, NOT A PARAMETERISATION OF IT. The session lifecycle is identical
// (SCHEDULED → ONGOING → COMPLETED/CANCELLED, a Google Meet link, a notify ping), but
// LiveClassesScreen's entire spine is {schoolId, classId} and a staff meeting has NO class scope
// at all — the school comes from the token, and attendees are STAFF picked from GET /staff.
//
// Google Meet links only generate when GOOGLE_CALENDAR_ENABLED is on. Otherwise the row still
// saves with a null link and the flow succeeds — a missing link is NOT a failure.

import { staffApi } from '../staffApi';

export const MEETING_PAGE_SIZE = 10;

/** Status colours, verbatim from the web. */
export const MEETING_STATUS = {
  SCHEDULED: { label: 'Scheduled', color: '#3b82f6', tone: 'info' },
  ONGOING: { label: 'Ongoing', color: '#f59e0b', tone: 'warning' },
  COMPLETED: { label: 'Completed', color: '#22c55e', tone: 'success' },
  CANCELLED: { label: 'Cancelled', color: '#ef4444', tone: 'error' },
};

/**
 * Which statuses a meeting can move to next.
 *
 * A map, not a dropdown of every status: COMPLETED and CANCELLED are terminal, and the web renders
 * one button per allowed transition rather than a free choice.
 */
export const NEXT_MEETING_STATUSES = {
  SCHEDULED: ['ONGOING', 'CANCELLED'],
  ONGOING: ['COMPLETED', 'CANCELLED'],
};

export const DURATION_OPTIONS = [30, 45, 60, 75, 90, 120];

/**
 * One page of meetings.
 *
 * @returns {Promise<{ items: Array<{ meetingId, title, meetingDate, meetingTime,
 *   durationMinutes, status, googleMeetLink, attendees: Array<{ staffId, staffName }> }>,
 *   total: number }>}
 */
export async function fetchMeetings(apiBase, { page = 0, status } = {}, signal) {
  const query = `?page=${page}&size=${MEETING_PAGE_SIZE}${status ? `&status=${status}` : ''}`;
  const res = await staffApi.get(`${apiBase}${query}`, { signal });
  return { items: res?.content || [], total: res?.totalElements || 0 };
}

/**
 * The attendee picker's list — every verified staff member in the school except the caller.
 *
 * Note the envelope: `{ staff: [...] }`, and each row is `{staffId, staffName, userType}` —
 * `staffName`, not `name`.
 */
export async function fetchMeetingStaff(apiBase, signal) {
  const res = await staffApi.get(`${apiBase}/staff`, { signal });
  return res?.staff || [];
}

/**
 * A month of meetings, grouped by day.
 *
 * `from`/`to` are inclusive dates. Empty days are omitted from `calendar`, so this is a LIST of
 * days that have meetings, not a dense month — the same shape the live-sessions calendar returns.
 *
 * @returns {Promise<{ calendar: Array<{ date, meetings: Array<{ meetingId, time, title,
 *   status }> }> }>}
 */
export function fetchMeetingCalendar(apiBase, { from, to }, signal) {
  return staffApi.get(`${apiBase}/calendar?from=${from}&to=${to}`, { signal });
}

/** `attendeeIds` is a plain array of staff ids; the server resolves them to SchoolUser rows. */
export function createMeeting(apiBase, { title, meetingDate, meetingTime, durationMinutes, attendeeIds }) {
  return staffApi.post(apiBase, {
    title,
    meetingDate,
    meetingTime,
    durationMinutes: parseInt(durationMinutes, 10),
    attendeeIds,
  });
}

export function updateMeetingStatus(apiBase, meetingId, status) {
  return staffApi.put(`${apiBase}/${meetingId}/status`, { status });
}

/** Returns `{ emailsSent, whatsappSent }` — the counts are the only confirmation there is. */
export function notifyAttendees(apiBase, meetingId) {
  return staffApi.post(`${apiBase}/${meetingId}/notify`, {});
}

/** First and last day of a month, as the calendar endpoint's inclusive bounds. */
export function monthBounds(year, month) {
  const pad = (n) => String(n).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(lastDay)}` };
}
