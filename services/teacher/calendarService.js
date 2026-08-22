// services/teacher/calendarService.js
// Mirrors: frontendmain/src/School/shared/StaffMyCalendar.js
// Backend: school/staffattendance/controller/StaffAttendanceController.java
//
// Two independent monthly reads. Both are guarded for eight staff roles including TEACHER, and
// both answer failures with HTTP 400 + {success,message} — never 403 for a valid teacher.

import { staffApi } from '../staffApi';

/** `source` values on a calendar event, in the order the legend lists them. */
export const EVENT_SOURCE = {
  SCHOOL_EVENT: { label: 'School event', color: '#3b82f6' },
  NATIONAL_HOLIDAY: { label: 'National holiday', color: '#f59e0b' },
  LEAVE_APPROVED: { label: 'On leave', color: '#16a34a' },
  LEAVE_PENDING: { label: 'Leave pending', color: '#d97706' },
};

/**
 * Everything on the staff member's calendar for a month.
 *
 * The server merges three sources into one feed — school events, Google national holidays, and the
 * staff member's **own HR leave** — each wrapped in its own catch. So a missing Google key or an
 * unprovisioned HR module makes that slice silently disappear rather than failing the call.
 *
 * @param {number} month 1-based
 * @returns {Promise<Array<{ id: string, source: string, title: string, description: string,
 *   startDateTime: string, endDateTime: string, allDay: boolean,
 *   bannerImageUrl: string|null, targetClasses: string|null }>>}
 */
export async function fetchCalendarEvents({ year, month }, signal) {
  const res = await staffApi.get('/api/staff/events/calendar', {
    params: { year, month },
    signal,
  });
  return Array.isArray(res) ? res : [];
}

/**
 * The staff member's own marked attendance for a month.
 *
 * Returns a bare map with a key for **every** day of the month and `null` where nothing is marked,
 * so `Object.keys(...).length` tells you nothing — count non-null values.
 *
 * Values are only ever `PRESENT` or `ABSENT`. This reads the teacher *self*-attendance table, whose
 * validator permits nothing else; `INCOMPLETE` belongs to the separate login/logout table and can
 * never appear here, which makes the web's "Incomplete" branch dead code.
 *
 * @returns {Promise<Record<string, 'PRESENT'|'ABSENT'|null>>}
 */
export async function fetchAttendanceCalendar({ year, month }, signal) {
  const res = await staffApi.get('/api/staff/attendance/calendar', {
    params: { year, month },
    signal,
  });
  return res && typeof res === 'object' && !Array.isArray(res) ? res : {};
}

/** `"2026-08-14T09:00:00"` → `"2026-08-14"`, without constructing a Date. */
const dateKey = (value) => {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value || ''));
  return match ? match[1] : null;
};

/**
 * Index events by day, expanding multi-day ones across their whole range — a five-day leave
 * should paint five cells.
 */
export function groupEventsByDate(events) {
  const map = {};
  events.forEach((event) => {
    const start = dateKey(event.startDateTime);
    if (!start) return;
    const end = dateKey(event.endDateTime) || start;

    // Walk the range by calendar date rather than by adding 24h, so a DST-free but month-crossing
    // range still lands on the right days.
    const cursor = new Date(`${start}T00:00:00`);
    const last = new Date(`${end}T00:00:00`);
    let guard = 0;
    while (cursor <= last && guard < 400) {
      const pad = (n) => String(n).padStart(2, '0');
      const key = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`;
      (map[key] = map[key] || []).push(event);
      cursor.setDate(cursor.getDate() + 1);
      guard += 1;
    }
  });
  return map;
}
