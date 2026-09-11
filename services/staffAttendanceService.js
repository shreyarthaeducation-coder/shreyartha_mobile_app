import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import {
  STAFF_ATTENDANCE_ACTIVE_KEY,
  STAFF_ATTENDANCE_HISTORY_KEY,
} from '../constants/storageKeys';

/**
 * Staff self-attendance — the mobile counterpart of
 * frontendmain/src/School/shared/staffAttendanceUtils.js.
 *
 * Logging in as staff opens an attendance session (with a location fix); logging out closes it.
 * Without this, teachers signing in through the app would silently stop generating attendance
 * records that the web portal creates.
 *
 * IMPORTANT — this module deliberately uses raw `fetch`, never `services/apiService`.
 * apiService treats any non-auth 401/403 as "session dead" and force-logs-the-user-out. But a
 * 403 here is EXPECTED and harmless: the backend gates /api/staff/attendance/** on verified
 * staff roles, so unverified staff and all SHREYARTHA_* roles legitimately get 403. Routing this
 * through apiService would log a teacher out moments after they logged in. The web swallows the
 * same error; so do we.
 *
 * Every export is wrapped so it can never throw or block the login/logout flow.
 */

const BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  Constants.expoConfig?.extra?.apiBaseUrl ||
  'https://shreyartha.com'
).replace(/\/+$/, '');

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const LOCATION_TIMEOUT_MS = 5000; // matches the web's geolocation { timeout: 5000 }
const SIGN_IN_LOCATION_TIMEOUT_MS = 10000;
const REQUEST_TIMEOUT_MS = 10000;

/**
 * Best-effort location fix. Never throws — always resolves to a status object with the exact
 * shape the backend already receives from the web client.
 *
 * @returns {Promise<{status:'ok'|'denied'|'error'|'unavailable', lat?:number, lng?:number,
 *                    accuracy?:number, message?:string, capturedAt:string}>}
 */
export async function captureLocation({
  accuracy = Location.Accuracy.Balanced,
  timeoutMs = LOCATION_TIMEOUT_MS,
} = {}) {
  const capturedAt = new Date().toISOString();
  try {
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) return { status: 'unavailable', capturedAt };

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { status: 'denied', message: 'Location permission not granted', capturedAt };
    }

    // getCurrentPositionAsync has no timeout option, so race it — a slow GPS lock must never
    // hold up the login.
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy }),
      new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);

    if (!position?.coords) {
      return { status: 'error', message: 'Location request timed out', capturedAt };
    }

    return {
      status: 'ok',
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      capturedAt,
    };
  } catch (e) {
    return { status: 'error', message: e?.message || 'Location unavailable', capturedAt };
  }
}

/** Raw authenticated POST that swallows everything, including the expected 403. */
async function postAttendance(path, body) {
  const token = await AsyncStorage.getItem('schoolUserToken');
  if (!token) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    // Response status is intentionally ignored — see the module note on 403.
  } catch (_e) {
    // Network failure must not affect login/logout either.
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Open an attendance session. Call fire-and-forget right after a successful staff login.
 *
 * @param {{name:string, email:string, role:string, schoolCode:string}} userData
 */
export async function startStaffAttendanceSession(userData = {}) {
  try {
    // High accuracy and a longer wait than sign-out gets: this reading is now shown to the staff
    // member as "where you signed in", and nothing waits on it — the caller fires and forgets.
    // Sign-out keeps the fast Balanced default, because the session-expiry path awaits it.
    const loginLocation = await captureLocation({
      accuracy: Location.Accuracy.High,
      timeoutMs: SIGN_IN_LOCATION_TIMEOUT_MS,
    });
    const loginAt = new Date().toISOString();

    await postAttendance('/api/staff/attendance/start', { loginAt, location: loginLocation });

    const session = {
      name: userData.name || '',
      email: userData.email || '',
      role: String(userData.role || '').toUpperCase(),
      schoolCode: userData.schoolCode || '',
      loginAt,
      loginLocation,
    };
    await AsyncStorage.setItem(STAFF_ATTENDANCE_ACTIVE_KEY, JSON.stringify(session));
  } catch (_e) {
    // Attendance tracking must never block the login flow.
  }
}

/**
 * Close the attendance session. MUST be called BEFORE the auth keys are cleared — the end-ping
 * needs the token that logout is about to remove.
 */
export async function endStaffAttendanceSession() {
  try {
    const logoutLocation = await captureLocation();
    const logoutAt = new Date().toISOString();

    await postAttendance('/api/staff/attendance/end', { logoutAt, location: logoutLocation });

    const sessionStr = await AsyncStorage.getItem(STAFF_ATTENDANCE_ACTIVE_KEY);
    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      const durationMs = new Date(logoutAt).getTime() - new Date(session.loginAt).getTime();
      const record = {
        ...session,
        logoutAt,
        logoutLocation,
        durationMs,
        durationHours: durationMs / (1000 * 60 * 60),
        status: durationMs >= SIX_HOURS_MS ? 'PRESENT' : 'INCOMPLETE',
      };

      const historyStr = await AsyncStorage.getItem(STAFF_ATTENDANCE_HISTORY_KEY);
      const history = historyStr ? JSON.parse(historyStr) : [];
      history.unshift(record);
      await AsyncStorage.setItem(STAFF_ATTENDANCE_HISTORY_KEY, JSON.stringify(history));
    }
  } catch (_e) {
    // Attendance tracking must never block the logout flow.
  } finally {
    // Clear the active session even if anything above failed, so a stale session can't linger.
    try {
      await AsyncStorage.removeItem(STAFF_ATTENDANCE_ACTIVE_KEY);
    } catch (_e) {
      /* nothing further we can do */
    }
  }
}

/** Locally cached completed sessions, newest first. Offline fallback for the web history view. */
export async function getStaffAttendanceHistory(roleFilter) {
  try {
    const historyStr = await AsyncStorage.getItem(STAFF_ATTENDANCE_HISTORY_KEY);
    const history = historyStr ? JSON.parse(historyStr) : [];
    if (!roleFilter) return history;
    return history.filter(
      (r) => String(r.role || '').toUpperCase() === String(roleFilter).toUpperCase(),
    );
  } catch (_e) {
    return [];
  }
}
