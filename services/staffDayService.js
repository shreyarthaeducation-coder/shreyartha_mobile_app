import * as Location from 'expo-location';
import staffApi from './staffApi';
import { captureLocation } from './staffAttendanceService';

/**
 * The working day as buttons — Start, End and Resume my day (3 Oct 2026). The native form of the
 * functions at the foot of frontendmain/src/School/shared/staffAttendanceUtils.js.
 *
 * WHY THIS IS NOT IN staffAttendanceService.js. That module runs inside login, logout and the
 * session-expiry path, so every export there swallows every error and returns nothing: attendance
 * must never block signing in or out. A BUTTON is the opposite — the person pressed it and has to
 * be told what happened — so these go through `staffApi` and return the server's record or throw
 * with its message. They also cannot live there for a plainer reason: `staffApi` imports that
 * module (its 401 path ends the session), so importing `staffApi` back would be a cycle.
 *
 * One record per person per IST day (`staff_attendance`): `loginAt`, `logoutAt` (null while the day
 * is open), `status` (PRESENT / INCOMPLETE, set when it ends), `durationMs`, `minimumHours` (what a
 * full day is at this school), `resumeCount`, `firstLogoutAt`, and the two locations as the JSON
 * strings they were stored as.
 */

const BASE = '/api/staff/attendance';

// The reading is shown back to the person as "where you ended your day", and they are waiting on
// the button anyway — so the same care sign-in takes, not logout's fast Balanced fix.
const BUTTON_LOCATION = { accuracy: Location.Accuracy.High, timeoutMs: 10000 };

/** Today's record, or null when the day has not been started. */
export async function fetchTodaySession(signal) {
  const res = await staffApi.get(`${BASE}/today`, { signal });
  return res?.data || null;
}

/** Starts the day now, with where the person is. Already started → returned unchanged. */
export async function startDayNow() {
  const location = await captureLocation(BUTTON_LOCATION);
  const res = await staffApi.post(`${BASE}/start`, { loginAt: new Date().toISOString(), location });
  return res?.data || null;
}

/**
 * Ends the day now, with where the person is — what logging out records, without logging out. A
 * later logout then changes nothing: the server keeps the first end.
 */
export async function endDayNow() {
  const location = await captureLocation(BUTTON_LOCATION);
  const res = await staffApi.post(`${BASE}/end`, { logoutAt: new Date().toISOString(), location });
  return res?.data || null;
}

/** Reopens a day that was ended. The server keeps the first end time and counts the resumes. */
export async function resumeDayNow() {
  const res = await staffApi.post(`${BASE}/resume`, {});
  return res?.data || null;
}

/** A stored session location (JSON string) as `{ lat, lng, status }`; never throws. */
export function parseSessionLocation(locationJson) {
  if (!locationJson) return null;
  try {
    const loc = typeof locationJson === 'string' ? JSON.parse(locationJson) : locationJson;
    return {
      status: loc.status || 'unavailable',
      lat: typeof loc.lat === 'number' ? loc.lat : null,
      lng: typeof loc.lng === 'number' ? loc.lng : null,
    };
  } catch {
    return null;
  }
}

/** "3h 10m", "45m", "0m". */
export function formatDuration(ms) {
  const minutes = Math.max(0, Math.floor((Number(ms) || 0) / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}
