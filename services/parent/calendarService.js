// services/parent/calendarService.js
// Mirrors: Parent/platform/pages/ParentAttendanceCalendar.js and ParentSchedule.js
// Backend: parent/controller/ParentDashboardController.java
//
// ONE SERVICE FOR TWO WEB PAGES. Attendance and Schedule are ~70% duplicate code on the web with
// divergent, accidental differences rather than designed ones:
//
//                      Attendance                     Schedule
//   events source      GET /events/calendar?y&m       GET /events        (all of them, once)
//   attendance         GET /attendance/calendar       the same call
//   month/year picker  yes                            no
//   event badges       yes, multi-day expanded        no
//   holiday styling    yes                            no
//
// Schedule is strictly the weaker of the two, so both native screens render one component
// (components/parent/ParentCalendarScreen) over the month-scoped event source. Schedule gains
// the month picker, the badges and the holiday styling, and the two can never drift again.

import { parentApi } from '../parentApi';
import { toIsoDate } from '../../utils/dates';

/**
 * Attendance for a month.
 *
 * Returns a FLAT map — `{ "YYYY-MM-DD": "PRESENT" | "ABSENT" }` — not a list. Failures are
 * swallowed to an empty map on purpose, exactly as the web does: the dots are best-effort and a
 * child who is not a school student has no attendance at all, which must not blank the calendar.
 */
export async function fetchAttendanceMap({ year, month }, signal) {
  try {
    const res = await parentApi.get('/api/parent/dashboard/attendance/calendar', {
      params: { year, month },
      signal,
    });
    return res && typeof res === 'object' ? res : {};
  } catch {
    return {};
  }
}

/** Events for one month — the richer source, used by both native screens. */
export async function fetchMonthEvents({ year, month }, signal) {
  const res = await parentApi.get('/api/parent/dashboard/events/calendar', {
    params: { year, month },
    signal,
  });
  return Array.isArray(res) ? res : [];
}

/** Every event, unscoped. The Schedule page's original source; kept for reference, unused. */
export async function fetchAllEvents(signal) {
  const res = await parentApi.get('/api/parent/dashboard/events', { signal });
  return Array.isArray(res) ? res : [];
}

/**
 * Leading `YYYY-MM-DD` off a date-ish value, WITHOUT constructing a Date first.
 *
 * This is the web's own guard and it is load-bearing: `new Date("2026-08-20")` is UTC midnight and
 * renders as the 19th anywhere west of Greenwich, which would shift every dot and badge by a day.
 * Only fall back to Date parsing when there is no leading ISO date to take.
 */
export function toDateKey(value) {
  if (!value) return '';
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value));
  if (match) return match[1];
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Every date key an event covers, so a multi-day event badges on all of its days. */
export function dateRangeKeys(event) {
  const start = toDateKey(event?.startDateTime || event?.startDate || event?.date);
  if (!start) return [];
  const end = toDateKey(event?.endDateTime || event?.endDate) || start;
  if (end <= start) return [start];

  const keys = [];
  const cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  // `toIsoDate` reads the LOCAL calendar fields. An earlier version of this loop used
  // `cursor.toISOString()`, which converts to UTC — in IST that is 18:30 the previous day, so
  // every multi-day event badged one day early. The very shift toDateKey exists to prevent.
  //
  // A malformed range must not spin forever; a year is more than any cell can need.
  let guard = 0;
  while (cursor <= last && guard < 400) {
    keys.push(toIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }
  return keys;
}

/**
 * Is this a holiday rather than a school event?
 *
 * Four independent signals, all of which the web checks, because the field that carries it depends
 * on where the row came from.
 */
export function isHolidayEvent(event) {
  if (!event) return false;
  if (event.source === 'NATIONAL_HOLIDAY') return true;
  if (event.isHoliday === true) return true;
  const kind = String(event.type || event.eventType || event.category || '').toUpperCase();
  if (kind === 'HOLIDAY' || kind === 'NATIONAL_HOLIDAY') return true;
  return /holiday/i.test(String(event.title || ''));
}

/** Group events by every date they cover. */
export function groupEventsByDate(events) {
  const byDate = {};
  (events || []).forEach((event) => {
    dateRangeKeys(event).forEach((key) => {
      (byDate[key] = byDate[key] || []).push(event);
    });
  });
  return byDate;
}

/** Present / absent / marked counts over a month's map. */
export function summariseAttendance(map) {
  let present = 0;
  let absent = 0;
  Object.values(map || {}).forEach((status) => {
    if (status === 'PRESENT') present += 1;
    else if (status === 'ABSENT') absent += 1;
  });
  return { present, absent, marked: present + absent };
}

/** Non-holiday event dot colours, cycled by index exactly as the web does. */
export const EVENT_COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#ef4444', '#06b6d4'];
export const HOLIDAY_COLOR = '#f59e0b';
