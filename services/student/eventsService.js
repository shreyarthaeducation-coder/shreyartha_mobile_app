// services/student/eventsService.js
// Mirrors: frontendmain/src/student/platform/EventsInfo/EventsInfo.js
//
// THIS SCREEN IS THE CANONICAL EXAMPLE OF THE SPELLING TRAP. It calls both namespaces:
//   /api/students/events/calendar     PLURAL   — the month's events
//   /api/student/attendance/calendar  SINGULAR — the attendance overlay
//   /api/students/notifications       PLURAL   — the live banner
// Neither is a typo, and getting one wrong yields an EMPTY screen rather than an error, because a
// 404 body carries no `message`. See the header of services/studentApi.js.
//
// Note also that plain `/api/students/events` is a different endpoint from
// `/api/students/events/calendar` — the month view needs the `/calendar` sub-path.

import { studentApi } from '../studentApi';
import { addDays } from '../../utils/dates';

/**
 * The month's events.
 *
 * THE RESPONSE SHAPE IS NOT STABLE, which is why the web has a `normalizeEventsResponse` helper
 * and we have its port below: the endpoint may hand back a bare array, `{data: []}`,
 * `{data: {data: []}}`, or an object whose event lists live under any of several keys — school
 * events, national holidays and occasions are separate collections that the UI merges.
 *
 * @param {{ year: number, month: number }} period `month` is **1-based**, as everywhere here.
 */
export async function fetchEventsForMonth({ year, month }, signal) {
  const res = await studentApi.get('/api/students/events/calendar', {
    params: { year, month },
    signal,
  });
  return normalizeEvents(res);
}

/** Ported verbatim from the web's `normalizeEventsResponse` — see the note above. */
export function normalizeEvents(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;

  const container =
    response?.data && typeof response.data === 'object' ? response.data : response;
  if (!container || typeof container !== 'object') return [];

  const combined = [];
  ['events', 'holidays', 'nationalHolidays', 'occasions', 'items', 'results', 'content'].forEach(
    (key) => {
      if (Array.isArray(container[key])) combined.push(...container[key]);
    },
  );
  return combined;
}

/**
 * The attendance overlay for the month.
 *
 * Two shapes, both live: the current `{ class: {...}, counselling: {...} }` and a legacy flat map
 * that means class attendance only. The web handles both and so does this — a flat map from an
 * older deployment would otherwise render as no attendance at all.
 *
 * @returns {Promise<{ classAttendance: Record<string,string>, counselling: Record<string,string> }>}
 */
export async function fetchAttendanceForMonth({ year, month }, signal) {
  const res = await studentApi.get('/api/student/attendance/calendar', {
    params: { year, month },
    signal,
  });
  if (!res || typeof res !== 'object') return { classAttendance: {}, counselling: {} };
  if (res.class || res.counselling) {
    return { classAttendance: res.class || {}, counselling: res.counselling || {} };
  }
  return { classAttendance: res, counselling: {} };
}

/** The live-notification banner. Best-effort: an empty list is a normal, quiet day. */
export async function fetchNotifications(signal) {
  const res = await studentApi.get('/api/students/notifications', { signal });
  if (Array.isArray(res)) return res;
  return Array.isArray(res?.notifications) ? res.notifications : [];
}

/* ── Event field readers ───────────────────────────────────────────────────
   Events arrive from several sources (school events, Google-sourced national holidays, school
   occasions) and do not share field names. These readers are the web's, kept so a holiday from
   one source and an event from another both land on the right day. */

const toDateKey = (value) => (value ? String(value).slice(0, 10) : '');

export const eventStartKey = (event) =>
  toDateKey(event?.date || event?.eventDate || event?.holidayDate || event?.startDate || event?.startDateTime);

export const eventEndKey = (event) =>
  toDateKey(event?.endDate || event?.endDateTime) || eventStartKey(event);

export const eventTitle = (event) =>
  event?.title || event?.name || event?.occasion || 'Event';

export const eventId = (event, index) =>
  String(
    event?.id ??
      event?.eventId ??
      event?.googleEventId ??
      `${eventTitle(event)}-${eventStartKey(event)}-${index}`,
  );

export function isHoliday(event) {
  const type = String(event?.type || event?.eventType || event?.category || '').toUpperCase();
  return event?.isHoliday === true || type === 'HOLIDAY' || type === 'NATIONAL_HOLIDAY';
}

/**
 * Group events by every date they span, so a five-day event dots all five days.
 *
 * @returns {Record<string, object[]>} keyed "YYYY-MM-DD"
 */
export function groupEventsByDate(events = []) {
  const map = {};
  events.forEach((event) => {
    const start = eventStartKey(event);
    if (!start) return;
    const end = eventEndKey(event) || start;
    // Walk the span with `addDays`, which is local-time. `toISOString()` here would shift the
    // date a day west of Greenwich — the exact bug the Live Classes port had to fix.
    // Lexical comparison is safe because these are ISO dates.
    let cursor = start;
    let guard = 0;
    while (cursor <= end && guard < 366) {
      (map[cursor] = map[cursor] || []).push(event);
      cursor = addDays(cursor, 1);
      guard += 1;
    }
  });
  return map;
}
