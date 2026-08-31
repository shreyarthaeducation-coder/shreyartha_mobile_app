// services/studentApi.js
// The HTTP client for the native student panel. The student twin of services/staffApi.js.
//
// WHY THIS EXISTS INSTEAD OF services/apiService.js
// apiService treats ANY non-auth 401 *or 403* as "session dead": it wipes the auth keys and
// router.replace()s to the login screen. That is wrong for the student panel, where a 403 is a
// routine answer — a FREE_STUDENT reaching premium content, a non-school student reaching a
// school-scoped resource, an entitlement that lapsed. My Analytics alone fans out across nine
// endpoints, several of which legitimately 403 for a free student; through apiService, opening
// that page would log them out.
//
// So: 403 is an ordinary error you can render. Only a 401 on a request that actually carried a
// token ends the session.
//
// TOKEN. The student login mirrors the same JWT across four keys (studentToken / userToken /
// accessToken / token) because the web reads different ones in different places. We read them in
// that order rather than relying on apiService's substring routing, which only prefers
// `studentToken` as a *fallback* branch and would silently pick a staff token on a shared device.
//
// ENDPOINT SPELLING — THE TRAP TO KNOW BEFORE WRITING ANY SERVICE ON TOP OF THIS.
// The backend has BOTH `/api/students/…` (plural) and `/api/student/…` (singular), and they are
// different controllers, not a typo:
//   plural    the original student-record surface — profile, analytics, notifications, events,
//             resources, personalised-resources, school-info, projects, psychometric, survey,
//             syllabus-completion, skillsedge/certificates, voice-attempts
//   singular  everything added later — shreya, shreya-english, doubt, reflection, my-progress,
//             attendance, competitiveexam, coding/arena, coding/understanding, understanding,
//             skillsedge/understanding, universal-adaptive
// `EventsInfo.js` on the web calls both spellings in one file. Copy each path from the web page
// that uses it; never infer one from the other. Getting it wrong yields an empty screen, not an
// error, because a 404 body has no `message`.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { ALL_AUTH_KEYS } from '../constants/storageKeys';
import { API_BASE_URL } from './apiService';

const DEFAULT_TIMEOUT_MS = 15000;

/** Login mirrors one JWT across these; first non-empty wins. */
/* ── A SECOND SPELLING TRAP, AND IT IS NOT THE ONE ABOVE ────────────────────
 *
 * Beyond `/api/student/` vs `/api/students/`, there is a pair one LETTER apart that are different
 * FEATURES served by different controllers in different packages:
 *
 *   /api/students/personali**z**ed-resources  academic/PersonalizedResourcesController
 *       The student's own AcademicProfile selections, as a subjects→chapters→topics tree.
 *       No teacher involved. → services/student/academicIqService.js
 *
 *   /api/students/personali**s**ed-resources  student/StudentPersonalisedResourceController
 *       Flat resource RECORDS a teacher assigned to this student, with dates and completion.
 *       → services/student/personalisedResourceService.js
 *
 * Both return 200 with a list, so picking the wrong one gives a plausible empty screen rather than
 * an error. This cost one bug report against a screen that was working correctly.
 */

const TOKEN_KEYS = ['studentToken', 'userToken', 'accessToken', 'token'];

/**
 * Error thrown by every helper here.
 *
 * `status` is the HTTP status (0 for network/timeout failures) and `payload` is the parsed body
 * when there was one, so a caller can read fields beyond `message`.
 */
export class StudentApiError extends Error {
  constructor(message, status = 0, payload = null) {
    super(message);
    this.name = 'StudentApiError';
    this.status = status;
    this.payload = payload;
    // Mirrors the shape apiService throws, so code moved between clients keeps working.
    this.response = { status, data: payload };
  }

  /** A real answer for this student, not a broken request — render it, don't retry it. */
  get isForbidden() {
    return this.status === 403;
  }

  get isOffline() {
    return this.status === 0 && !this.aborted;
  }
}

/** Serialise a params object, skipping null/undefined/empty. */
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
    const entries = await AsyncStorage.multiGet(TOKEN_KEYS);
    for (const [, raw] of entries) {
      if (!raw) continue;
      const token = String(raw)
        .trim()
        .replace(/^["']|["']$/g, '')
        .replace(/^Bearer\s+/i, '')
        .trim();
      if (token) return token;
    }
    return null;
  } catch {
    return null;
  }
};

// A burst of parallel requests can all 401 at once — My Analytics fires nine — so collapse them
// into a single logout rather than nine racing redirects.
let expiryPromise = null;

const handleExpiry = async () => {
  if (expiryPromise) return expiryPromise;

  expiryPromise = (async () => {
    try {
      await AsyncStorage.multiRemove(ALL_AUTH_KEYS);
    } catch {
      // Still redirect even if storage misbehaves.
    }
    try {
      router.replace('/auth/student-login');
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
 * @param {string} endpoint path beginning with `/api/...`
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {any}    [options.body]
 * @param {object} [options.params]   appended via buildQuery
 * @param {AbortSignal} [options.signal]
 * @param {number} [options.timeoutMs]
 * @param {'json'|'blob'} [options.parse]
 */
async function request(
  endpoint,
  {
    method = 'GET',
    body,
    params,
    signal: callerSignal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    parse = 'json',
    headers: extraHeaders,
  } = {},
) {
  const token = await readToken();
  const url = `${API_BASE_URL}${endpoint}${params ? buildQuery(params) : ''}`;

  const headers = { Accept: 'application/json', ...(extraHeaders || {}) };
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
    const error = new StudentApiError(
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
    throw new StudentApiError(messageFrom(payload, response), 401, payload);
  }

  if (!response.ok) {
    // 403 lands here deliberately: it is an ordinary, renderable error, NOT a dead session.
    const payload = await parseBody(response);
    throw new StudentApiError(messageFrom(payload, response), response.status, payload);
  }

  if (parse === 'blob') return response.blob();
  if (response.status === 204) return null;
  return parseBody(response);
}

const withJsonBody = (method) => (endpoint, body, options = {}) =>
  request(endpoint, {
    ...options,
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

/**
 * Multipart upload.
 *
 * `json` entries exist for `@RequestPart("data")` endpoints: React Native labels a plain-string
 * part `text/plain`, which Spring rejects with a **415 before the handler runs**. Passing
 * `{ string, type }` makes RN emit an explicit `application/json` part, which is what the web
 * achieves with `new Blob([json], { type: 'application/json' })`.
 *
 * Endpoints taking flat `@RequestParam`s use `fields` instead. The student profile uploads
 * (`/api/students/upload/profile-picture`, `/upload/profile-video`) are `files` only.
 *
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
    // Uploads are slower than reads; the 15 s default is too tight for a video over mobile data.
    timeoutMs: 120000,
    ...options,
    method: options.method || 'POST',
    body: form,
  });
};

/**
 * Run several reads in parallel, each guarded on its own.
 *
 * My Analytics is the reason this exists: it fans out across nine endpoints and a free student
 * legitimately 403s on several of them. `Promise.all` would collapse the whole page for one
 * expected refusal, so this resolves to `{ key: { data, error } }` and lets the screen render
 * whatever came back.
 *
 * @param {Record<string, Promise<any>>} tasks
 * @returns {Promise<Record<string, { data: any, error: string|null, forbidden: boolean }>>}
 */
async function settleAll(tasks) {
  const keys = Object.keys(tasks);
  const results = await Promise.allSettled(keys.map((k) => tasks[k]));
  const out = {};
  keys.forEach((key, i) => {
    const r = results[i];
    out[key] =
      r.status === 'fulfilled'
        ? { data: r.value, error: null, forbidden: false }
        : { data: null, error: r.reason?.message || 'Could not load.', forbidden: !!r.reason?.isForbidden };
  });
  return out;
}

export const studentApi = {
  request,
  get: (endpoint, options) => request(endpoint, options),
  post: withJsonBody('POST'),
  put: withJsonBody('PUT'),
  patch: withJsonBody('PATCH'),
  del: (endpoint, options) => request(endpoint, { ...options, method: 'DELETE' }),
  multipart,
  blob: (endpoint, options) => request(endpoint, { ...options, parse: 'blob' }),
  settleAll,
};

export default studentApi;
