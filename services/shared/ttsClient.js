// services/shared/ttsClient.js
//
// The client read-aloud uses, in every portal.
//
// ── WHY THIS EXISTS RATHER THAN `studentApi` OR `createPortalApi` ───────────
// `studentApi` (services/apiService.js) reads only the student token keys, so a parent, teacher or
// partner tapping Shreya Speak would send no Authorization header — and `/api/v1/translate/tts` is
// authenticated, so the button would fail for exactly the people it was added for. Worse, on a
// 401/403 it wipes every auth key and sends the user to the sign-in screen: a button that refuses
// to speak would log somebody out mid-page.
//
// `createPortalApi` fixes the second half only for 403. Its 401 branch still tears the session
// down, and it binds to ONE token key, while this button is mounted in five panels.
//
// So this is deliberately small and does neither: it attaches whichever portal token is present,
// and it never clears storage and never navigates. A failure here is a message under a button.
//
// `/api/v1/translate/batch` (translate-before-speak) is public and needs no token, but goes through
// the same client so both halves of one tap behave identically.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE_URL } from '../apiService';

const TIMEOUT_MS = 20000;

/**
 * Whichever session is signed in, in the order a shared device is most likely to hold one.
 *
 * Normally only one is present — every login clears the others first (services/portalSession.js).
 * The order is a tie-break for the case where one did not.
 */
const TOKEN_KEYS = [
  'studentToken',
  'schoolUserToken',
  'parentUserToken',
  'partnerUserToken',
  'userToken',
];

async function readAnyToken() {
  for (const key of TOKEN_KEYS) {
    try {
      const raw = await AsyncStorage.getItem(key);
      const token = raw ? String(raw).trim().replace(/^["']|["']$/g, '').replace(/^Bearer\s+/i, '') : '';
      if (token) return token;
    } catch {
      // A key that will not read is simply not the one in use.
    }
  }
  return null;
}

/** POSTs JSON and returns the parsed body. Throws an Error carrying `status` on failure. */
export async function ttsPost(endpoint, body) {
  const token = await readAnyToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new Error('Could not reach the voice service. Check your connection.');
  } finally {
    clearTimeout(timer);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    // NOTE: no session teardown, no redirect — see the header. A 403 here means this role is not
    // allowed to use text-to-speech, which is worth saying out loud but is not a dead session.
    const error = new Error(
      payload?.message
        || (response.status === 403
          ? 'Read aloud is not available for this account.'
          : 'The voice service is unavailable right now.'),
    );
    error.status = response.status;
    throw error;
  }
  return payload;
}

export const ttsClient = { post: ttsPost };

export default ttsClient;
