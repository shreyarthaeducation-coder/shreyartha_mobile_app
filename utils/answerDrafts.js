import AsyncStorage from '@react-native-async-storage/async-storage';

// Answers kept on the phone while a test is being taken, so a dead battery, the app being closed
// or a lost connection does not lose them. The twin of the website's
// `student/testrunner/answerDrafts.js`. Used by ExamRunner; never sent anywhere.

const PREFIX = 'examDraft:v1:';
// A draft older than this belongs to an attempt the student walked away from.
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeBase64Url(input) {
  const s = input.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  let out = '';
  for (const ch of s) {
    const index = B64.indexOf(ch);
    if (index < 0) continue;
    value = (value << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((value >> bits) & 0xff);
    }
  }
  return out;
}

/** Who is signed in on this phone, from the student's token — a shared device never mixes drafts. */
export async function currentUserTag() {
  try {
    const token = (await AsyncStorage.getItem('studentToken')) || (await AsyncStorage.getItem('userToken')) || '';
    const payload = token.split('.')[1];
    if (!payload) return 'guest';
    return JSON.parse(decodeBase64Url(payload)).sub || 'guest';
  } catch {
    return 'guest';
  }
}

/** Order-independent: papers are often shuffled. */
export function draftKey(questionIds, user, scope = '') {
  const ids = [...(questionIds || [])].map(String).sort();
  if (ids.length === 0 || !user) return null;
  return `${PREFIX}${user}:${scope}:${ids.join(',')}`;
}

export async function loadDraft(key, now = Date.now()) {
  if (!key) return null;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (!draft || typeof draft.answers !== 'object' || now - (draft.savedAt || 0) > MAX_AGE_MS) {
      await AsyncStorage.removeItem(key);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export async function saveDraft(key, answers, current = 0, now = Date.now()) {
  if (!key) return;
  try {
    if (!answers || Object.keys(answers).length === 0) {
      await AsyncStorage.removeItem(key);
      return;
    }
    await AsyncStorage.setItem(key, JSON.stringify({ answers, current, savedAt: now }));
  } catch {
    // Storage unavailable: the test still works, it just is not kept.
  }
}

export async function clearDraft(key) {
  if (!key) return;
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}
