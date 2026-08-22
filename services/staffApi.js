// services/staffApi.js
// The HTTP client for the native school-staff screens (teacher panel and the app/staff/[role]
// shells). Everything the teacher panel fetches goes through here.
//
// WHY THIS EXISTS INSTEAD OF services/apiService.js
// apiService treats ANY non-auth 401 *or 403* as "session dead": it wipes the auth keys and
// router.replace()s to the login screen. That is wrong for the staff panels, where a 403 is a
// routine answer — role guards that omit the SHREYARTHA_* roles, unverified staff (an
// UNVERIFIED_TEACHER can reach only /api/teacher/profile and /api/school/academic-years), and any
// scope the caller isn't assigned to. Routing a feature screen through apiService means one
// unlucky tap logs the teacher out. Two modules already hand-rolled raw fetch to dodge this
// (staffAttendanceService.js, components/staff/StaffChangePasswordScreen.js); this module is that
// workaround done once, properly.
//
// So: 403 is an ordinary error you can render. Only a 401 on a request that actually carried a
// token ends the session, and that path runs the attendance end-ping first (see handleExpiry).
//
// Backend conventions this client is shaped around:
//   * Almost every failure is HTTP 400 with { success: false, message } — controllers wrap their
//     bodies in try/catch, so even "not found" arrives as a 400. Read `message`, don't switch on
//     the status code.
//   * The JWT carries only the user's email; there is no refresh-token endpoint, so a real 401 is
//     terminal.
//   * Dates are ISO strings with no timezone suffix; month params are 1-12.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { ALL_AUTH_KEYS } from '../constants/storageKeys';
import { endStaffAttendanceSession } from './staffAttendanceService';
import { API_BASE_URL } from './apiService';

const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Error thrown by every helper here.
 *
 * `status` is the HTTP status (0 for network/timeout failures) and `payload` is the parsed body
 * when there was one, so a caller can read fields beyond `message`.
 */
export class StaffApiError extends Error {
  constructor(message, status = 0, payload = null) {
    super(message);
    this.name = 'StaffApiError';
    this.status = status;
    this.payload = payload;
    // Mirrors the shape apiService throws, so code moved between the two clients keeps working.
    this.response = { status, data: payload };
  }

  get isForbidden() {
    return this.status === 403;
  }

  /** True for network/timeout failures, where there is no status to reason about. */
  get isOffline() {
    return this.status === 0 && !this.aborted;
  }
}

/** Serialise a params object, skipping null/undefined/empty. Ported from studentService.js. */
export const buildQuery = (params = {}) => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const normalized = typeof value === 'string' ? value.trim() : value;
    if (normalized === '') return;
    query.append(key, String(normalized));
  });

  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
};

const readToken = async () => {
  try {
    const raw = await AsyncStorage.getItem('schoolUserToken');
    if (!raw) return null;
    const token = String(raw)
      .trim()
      .replace(/^["']|["']$/g, '')
      .replace(/^Bearer\s+/i, '')
      .trim();
    return token || null;
  } catch {
    return null;
  }
};

// A burst of parallel requests can all 401 at once; collapse them into one logout.
let expiryPromise = null;

/**
 * End the session for real. Only reached from a 401 on a request that carried a token.
 *
 * Ordering matches hooks/useStaffLogout: the attendance end-ping is authenticated, so it has to
 * run before the token is cleared.
 */
const handleExpiry = async () => {
  if (expiryPromise) return expiryPromise;

  expiryPromise = (async () => {
    try {
      await endStaffAttendanceSession(); // needs the token — must precede the key wipe
    } catch {
      // Never let the attendance ping block the logout.
    }
    try {
      await AsyncStorage.multiRemove(ALL_AUTH_KEYS);
    } catch {
      // Still redirect even if storage misbehaves.
    }
    try {
      router.replace('/auth/school-login');
    } catch {
      // Router may not be mounted yet.
    }
  })();

  try {
    await expiryPromise;
  } finally {
    expiryPromise = null;
  }
  return undefined;
};

const parseBody = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) return await response.json();
    const text = await response.text();
    return text || null;
  } catch {
    return null;
  }
};

const messageFrom = (payload, response) => {
  if (payload && typeof payload === 'object' && payload.message) return String(payload.message);
  if (typeof payload === 'string' && payload.trim()) return payload.trim();
  return response.statusText || `Request failed (${response.status})`;
};

/**
 * The one request path.
 *
 * @param {string} endpoint  path beginning with `/api/...`
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {any}    [options.body]        already-encoded body (JSON string or FormData)
 * @param {object} [options.headers]
 * @param {object} [options.params]      appended via buildQuery
 * @param {number} [options.timeoutMs]
 * @param {AbortSignal} [options.signal] caller's signal, e.g. from a screen unmounting
 * @param {'json'|'blob'|'none'} [options.parse]
 */
const request = async (endpoint, options = {}) => {
  const {
    method = 'GET',
    body,
    headers: extraHeaders,
    params,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal: callerSignal,
    parse = 'json',
  } = options;

  const token = await readToken();
  const url = `${API_BASE_URL}${endpoint}${params ? buildQuery(params) : ''}`;

  const headers = { ...(extraHeaders || {}) };
  // FormData must set its own multipart boundary — never force a Content-Type on it.
  if (body !== undefined && !(body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onCallerAbort = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener('abort', onCallerAbort);
  }

  let response;
  try {
    response = await fetch(url, { method, headers, body, signal: controller.signal });
  } catch (err) {
    // Distinguish a caller-side cancellation (screen unmounted — say nothing) from our own
    // timeout, which reads to the user exactly like being offline.
    const cancelled = err?.name === 'AbortError' && !!callerSignal?.aborted;
    const error = new StaffApiError(
      cancelled
        ? 'Request cancelled.'
        : 'Could not reach the server. Check your connection and try again.',
      0,
      null,
    );
    error.aborted = cancelled;
    throw error;
  } finally {
    clearTimeout(timer);
    if (callerSignal) callerSignal.removeEventListener('abort', onCallerAbort);
  }

  if (response.status === 401) {
    const payload = await parseBody(response);
    // No token means we were never signed in on this request — almost certainly a stray background
    // fetch. Tearing the session down here would yank the screen out from under the user.
    if (token) await handleExpiry();
    throw new StaffApiError(messageFrom(payload, response), 401, payload);
  }

  if (!response.ok) {
    // 403 lands here deliberately: it is an ordinary, renderable error, NOT a dead session.
    const payload = await parseBody(response);
    throw new StaffApiError(messageFrom(payload, response), response.status, payload);
  }

  if (parse === 'none' || response.status === 204) return null;
  if (parse === 'blob') return response.blob();
  return parseBody(response);
};

const withJsonBody = (method) => (endpoint, body, options = {}) =>
  request(endpoint, {
    ...options,
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

/**
 * Multipart upload.
 *
 * `json` entries are the reason this helper exists. Several teacher endpoints take their payload
 * as `@RequestPart("data")` — a JSON *part*, not form fields (POST /api/teacher/resources/upload,
 * PUT /api/teacher/resources/{id}, the personalised-resources upload). React Native's FormData
 * labels a plain-string part `text/plain`, which Spring rejects with a 415. Passing
 * `{ string, type }` makes RN emit the part with an explicit `content-type: application/json`,
 * which is what the web achieves with `new Blob([json], { type: 'application/json' })`.
 *
 * Endpoints that take flat @RequestParams instead (e.g.
 * POST /api/shreya01/homework/class/{classId}/upload) should use `fields`, not `json`.
 *
 * @param {string} endpoint
 * @param {object} [parts]
 * @param {object} [parts.json]   name -> object, sent as an application/json part
 * @param {object} [parts.fields] name -> scalar, sent as a plain form field
 * @param {object} [parts.files]  name -> { uri, name, type }
 */
const multipart = (endpoint, { json, fields, files } = {}, options = {}) => {
  const form = new FormData();

  Object.entries(json || {}).forEach(([key, value]) => {
    form.append(key, { string: JSON.stringify(value), type: 'application/json' });
  });
  Object.entries(fields || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    form.append(key, String(value));
  });
  Object.entries(files || {}).forEach(([key, file]) => {
    if (file?.uri) form.append(key, file);
  });

  return request(endpoint, {
    // Uploads are slower than reads; the 15 s default is too tight for a photo over mobile data.
    timeoutMs: 60000,
    ...options,
    method: options.method || 'POST',
    body: form,
  });
};

export const staffApi = {
  request,
  get: (endpoint, options) => request(endpoint, options),
  post: withJsonBody('POST'),
  put: withJsonBody('PUT'),
  patch: withJsonBody('PATCH'),
  del: (endpoint, options) => request(endpoint, { ...options, method: 'DELETE' }),
  multipart,
  blob: (endpoint, options) => request(endpoint, { ...options, parse: 'blob' }),
};

export default staffApi;
