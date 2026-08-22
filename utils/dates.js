/**
 * Date helpers for the staff screens.
 *
 * The backend speaks ISO date strings: `LocalDate` serialises as "2026-08-13" and `LocalDateTime`
 * as "2026-08-13T10:15:30" with NO timezone suffix. Both are wall-clock values in the school's
 * local time, which is why every parse here appends "T00:00:00" and lets the JS engine read it as
 * local. `new Date("2026-08-13")` would parse as UTC midnight and render as the 12th anywhere west
 * of Greenwich — that is exactly the off-by-one-day bug this module exists to prevent. The web
 * pages do the same thing (`new Date(dateStr + "T00:00:00")`).
 */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "2026-08-13" (or an ISO datetime) -> a local-time Date. Returns null for anything unparseable. */
export function parseIsoDate(value) {
  if (!value) return null;
  const datePart = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  const date = new Date(`${datePart}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Date -> "2026-08-13", using local calendar fields (never toISOString, which shifts to UTC). */
export function toIsoDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Today as "YYYY-MM-DD" in local time. */
export function todayIso() {
  return toIsoDate(new Date());
}

/** Step an ISO date by whole days, rolling across month and year boundaries. */
export function addDays(value, days) {
  const date = parseIsoDate(value);
  if (!date) return value;
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** 0 = Monday … 6 = Sunday. Indian school calendars start the week on Monday. */
export function mondayFirstIndex(value) {
  const date = parseIsoDate(value);
  if (!date) return 0;
  return (date.getDay() + 6) % 7;
}

export function isSunday(value) {
  const date = parseIsoDate(value);
  return !!date && date.getDay() === 0;
}

/** "2026-08-13" -> 13 */
export function dayOfMonth(value) {
  const date = parseIsoDate(value);
  return date ? date.getDate() : null;
}

/**
 * Parse a backend `LocalDateTime` into a local-time Date.
 *
 * Two things make this fiddlier than it looks. Jackson **omits zero seconds**, so the same field
 * arrives as both `"2026-08-15T21:00"` and `"2026-08-15T21:00:30"`. And there is never a timezone
 * suffix — the value is wall-clock time — so handing it straight to `new Date()` would have some
 * engines read it as UTC and shift the hour.
 */
export function parseLocalDateTime(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(raw);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const date = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s || 0),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Date -> `"2026-08-15T21:00:00"`, the only shape `FlexibleLocalDateTimeDeserializer` accepts
 * besides the minute-precision form. No `Z`, no offset, no fractional seconds — adding any of them
 * is a 400.
 */
export function toLocalDateTimeString(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/** "2026-08-15T21:00" -> "Fri, 15 August 2026, 9:00 pm" */
export function formatLongDateTime(value) {
  const date = parseLocalDateTime(value);
  if (!date) return '';
  const hours = date.getHours();
  const suffix = hours >= 12 ? 'pm' : 'am';
  const display = hours % 12 === 0 ? 12 : hours % 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${formatLongDate(toIsoDate(date))}, ${display}:${minutes} ${suffix}`;
}

/** "2026-08-13" -> "Thu, 13 August 2026" */
export function formatLongDate(value) {
  const date = parseIsoDate(value);
  if (!date) return '';
  const weekday = WEEKDAY_NAMES[date.getDay()].slice(0, 3);
  return `${weekday}, ${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

export { MONTH_NAMES, WEEKDAY_NAMES };
