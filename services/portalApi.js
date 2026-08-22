// services/portalApi.js
// A factory for portal HTTP clients. Currently backs services/parentApi.js and
// services/partnerApi.js.
//
// WHY A FACTORY, AND WHY IT DOES NOT REPLACE staffApi/studentApi.
// Those two are the same design as this — and as each other — but each carries a portal-specific
// side effect that does not generalise: staffApi must fire the authenticated self-attendance
// end-ping BEFORE wiping the keys, and studentApi reads a JWT mirrored across four different
// storage keys. They are also shipped, device-tested code. Rewriting them onto this factory would
// put working panels at risk for tidiness. The parent and partner clients have neither quirk, so
// they share one implementation instead of becoming a third and fourth copy of ~300 lines.
//
// WHY NOT services/apiService.js — the same reason the other two exist. apiService treats ANY
// non-auth 401 *or 403* as "session dead": it wipes the auth keys and redirects. A 403 is routine
// here (an unverified parent hitting /api/parent/fees, a child who is not a school student hitting
// attendance), and through apiService each of those would log the user out.
//
// So: 403 is an ordinary error you can render. Only a 401 on a request that actually carried a
// token ends the session.
//
// TOKEN. Read from one explicit key, not apiService's substring routing. That routing matches
// `endpoint.includes('/parent/')`, which is correct today but would hand a future path like
// `/api/parent/teacher/...` the SCHOOL token, and its generic fallback branch prefers the student
// token — so on a shared device the wrong session can win.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { ALL_AUTH_KEYS } from '../constants/storageKeys';
import { API_BASE_URL } from './apiService';

const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Error thrown by every helper a portal client exposes.
 *
 * `status` is the HTTP status (0 for network/timeout failures) and `payload` is the parsed body
 * when there was one, so a caller can read fields beyond `message`.
 */
export class PortalApiError extends Error {
  constructor(message, status = 0, payload = null, name = 'PortalApiError') {
    super(message);
    this.name = name;
    this.status = status;
    this.payload = payload;
    // Mirrors the shape apiService throws, so code moved between clients keeps working.
    this.response = { status, data: payload };
  }

  /** A real answer for this user, not a broken request — render it, don't retry it. */
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

/**
 * Almost every failure in this backend is HTTP 400 with `{ success: false, message }` — including
 * not-found, and including the partner's master-only refusal, which answers 400 rather than 403.
 * Read `message`; don't switch on the status code.
 */
const messageFrom = (payload, response) => {
  if (payload && typeof payload === 'object' && payload.message) return String(payload.message);
  if (typeof payload === 'string' && payload.trim()) return payload.trim();
  return response.statusText || `Request failed (${response.status})`;
};

const normalizeToken = (raw) =>
  String(raw || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^Bearer\s+/i, '')
    .trim() || null;

/**
 * Build a client.
 *
 * @param {object} config
 * @param {string} config.name       for the error class name, e.g. 'Parent'
 * @param {string} config.tokenKey   the ONE AsyncStorage key holding this portal's JWT
 * @param {string} config.loginRoute where an expired session lands
 */
export function createPortalApi({ name, tokenKey, loginRoute }) {
  const errorName = `${name}ApiError`;

  const fail = (message, status, payload) =>
    new PortalApiError(message, status, payload, errorName);

  const readToken = async () => {
    try {
      return normalizeToken(await AsyncStorage.getItem(tokenKey));
    } catch {
      return null;
    }
  };

  // A burst of parallel requests can all 401 at once — the parent's Academic Progress fires nine —
  // so collapse them into a single logout rather than nine racing redirects.
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
        router.replace(loginRoute);
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

  /**
   * The one request path.
   *
   * @param {string} endpoint path beginning with `/api/...`
   * @param {object} [options]
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
      const error = fail(
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
      // No token means we were never signed in on this request — almost certainly a stray
      // background fetch. Tearing the session down here would yank the screen out from under
      // the user.
      if (token) await handleExpiry();
      throw fail(messageFrom(payload, response), 401, payload);
    }

    if (!response.ok) {
      // 403 lands here deliberately: it is an ordinary, renderable error, NOT a dead session.
      const payload = await parseBody(response);
      throw fail(messageFrom(payload, response), response.status, payload);
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
   * `fields` is for flat `@RequestParam` endpoints; `json` is for `@RequestPart("data")` ones,
   * where React Native's plain-string part would be labelled `text/plain` and rejected with a 415
   * before the handler runs. The only upload in these two portals — the partner's UPI image — is
   * `@RequestParam("file")`, so it uses `files` alone.
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
      // Uploads are slower than reads; the 15 s default is too tight over mobile data.
      timeoutMs: 60000,
      ...options,
      method: options.method || 'POST',
      body: form,
    });
  };

  /**
   * Run several reads in parallel, each guarded on its own.
   *
   * The parent's Academic Progress is the reason this is here: it fans out across nine endpoints
   * and several legitimately fail for a child who is not a school student. `Promise.all` would
   * collapse the whole page for one expected refusal.
   *
   * @param {Record<string, Promise<any>>} tasks
   * @returns {Promise<Record<string, { data, error, forbidden }>>}
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
          : {
              data: null,
              error: r.reason?.message || 'Could not load.',
              forbidden: !!r.reason?.isForbidden,
            };
    });
    return out;
  }

  return {
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
}
