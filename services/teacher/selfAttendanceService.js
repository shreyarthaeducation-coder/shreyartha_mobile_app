// services/teacher/selfAttendanceService.js
// Mirrors: frontendmain/src/School/Teacher/pages/TeacherSelfAttendance.js
//
// The staff member's own monthly attendance sheet. NOT the same thing as
// services/staffAttendanceService.js, which pings /api/staff/attendance/start|end to open and
// close a session at login/logout. That session IS shown here now, though: the sheet's `details`
// carries each day's sign-in time and place beside the mark.
//
// Backend: TeacherSelfAttendanceController. Its @PreAuthorize admits TEACHER, COUNSELOR,
// PRINCIPAL, VICE_PRINCIPAL, SCHOOL_ADMIN and all four SHREYARTHA_* roles, so one screen serves
// every staff shell. Every handler catches its own exceptions and answers 400 with
// { success, message } — only the guard itself can 403.

import { staffApi } from '../staffApi';
import { captureVisitLocation, resolvePincode } from '../../utils/salesLocation';

export const ATTENDANCE_STATUS = {
  PRESENT: 'PRESENT',
  // A working day, not an absence — the server has accepted it for a while; the app could not send it.
  WORK_FROM_HOME: 'WORK_FROM_HOME',
  ABSENT: 'ABSENT',
};

/**
 * The month sheet.
 *
 * `attendance` comes back pre-seeded with every date in the month (value null when unmarked), and
 * `dates` is the authoritative day list — build the calendar from it rather than from a local Date
 * loop.
 *
 * `details` holds, only for days that have something to say: when and where the day was marked
 * (`markedAt`, `latitude`, `longitude`, `resolvedAddress`, `pincode`, `locationStatus`), whether a
 * school check-in marked it (`source: 'CHECK_IN'`, `placeName`, `locked`), and the day's sign-in
 * (`loginAt`, `logoutAt`, `loginLatitude`, `loginLongitude`, `loginLocationStatus`). An older server
 * sends no `details` at all.
 *
 * @param {number} year
 * @param {number} month 1-12 (the API is not 0-indexed)
 * @param {AbortSignal} [signal]
 */
export function fetchSelfAttendanceSheet(year, month, signal) {
  return staffApi.get('/api/teacher/self-attendance/sheet', {
    params: { year, month },
    signal,
  });
}

/**
 * Where the person is as they mark, as the fields the mark request takes.
 *
 * High accuracy with a 12 s wait (`captureVisitLocation`), then the OS geocoder for the address and
 * pincode — no key needed, so the server's geocoder is only a fallback. Never throws: a refused
 * prompt or a dead GPS still lets the mark save, carrying the reason instead of a place.
 *
 * @returns {Promise<{ locationStatus: 'ok'|'denied'|'unavailable'|'error', latitude?: number,
 *   longitude?: number, accuracy?: number, resolvedAddress?: string, pincode?: string }>}
 */
export async function captureMarkLocation() {
  const fix = await captureVisitLocation();
  if (fix.status !== 'ok') return { locationStatus: fix.status };

  const place = await resolvePincode(fix.latitude, fix.longitude);
  return {
    locationStatus: 'ok',
    latitude: fix.latitude,
    longitude: fix.longitude,
    accuracy: fix.accuracy,
    resolvedAddress: place.address || undefined,
    pincode: place.pincode || undefined,
  };
}

/**
 * Mark or change one day. An upsert server-side — re-marking a date replaces the previous value.
 *
 * The server stamps the time; `location` is what `captureMarkLocation` returned. It refuses (400,
 * with a message naming the school and time) to change a day a school check-in marked present, and
 * there is no server-side Sunday lock or future-date rule — those stay the screen's job, as on the web.
 *
 * @param {string} date "YYYY-MM-DD"
 * @param {'PRESENT'|'ABSENT'|'WORK_FROM_HOME'} status
 * @param {object} [location]
 */
export function markSelfAttendance(date, status, location = {}) {
  return staffApi.post('/api/teacher/self-attendance/mark', { date, status, ...location });
}
