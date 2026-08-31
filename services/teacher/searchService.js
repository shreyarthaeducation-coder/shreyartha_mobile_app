// services/teacher/searchService.js
//
// Search for the teacher panel — the fourth use of the shared matcher.
//
// ── NOTHING SERVER-SIDE ────────────────────────────────────────────────────
// There is no search mapping anywhere in the backend, for teacher data or otherwise. So the index
// is client-side, like the other three panels, and the RANKING is shared
// (`services/shared/searchMatch.js`) so it cannot drift between them.
//
// ── THE DESTINATIONS ARE READ, NEVER RETYPED ───────────────────────────────
// `TEACHER_MENU` is DERIVED from the workspace groups plus the attendance items plus the profile
// item, so it is exactly the sixteen tabs however the redesign regrouped them. Retyping the labels
// here is how a search result would keep naming a tab after the menu renamed it.
//
// ── THE INDEX CARRIES STUDENT NAMES ────────────────────────────────────────
// Fingerprinted to the session AND its key is in `ALL_AUTH_KEYS`: the fingerprint stops a stale
// read, the key list is what makes the data go away on logout. On a shared staffroom device both
// matter.

import AsyncStorage from '@react-native-async-storage/async-storage';
import staffApi from '../staffApi';
import { fingerprintOf } from '../shared/searchMatch';
import { TEACHER_SEARCH_INDEX_KEY } from '../../constants/storageKeys';
import { TEACHER_HEADER_ACTIONS, TEACHER_MENU } from '../../constants/teacherMenu';

const CACHE_KEY = TEACHER_SEARCH_INDEX_KEY;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Every destination the panel has: the sixteen tabs, the two header actions, and the two hubs the
 * redesign added.
 */
function destinations() {
  const rows = [
    ...TEACHER_MENU.filter((item) => item.native).map((item) => ({
      module: 'Sections',
      name: item.label,
      route: item.native,
    })),
    ...TEACHER_HEADER_ACTIONS.filter((item) => item.native).map((item) => ({
      module: 'Sections',
      name: item.label,
      route: item.native,
    })),
    { module: 'Sections', name: 'My Workspace', route: '/teacher/workspace' },
    { module: 'Sections', name: 'My Attendance', route: '/teacher/my-attendance' },
    { module: 'Your account', name: 'Support', route: '/teacher/support' },
    { module: 'Your account', name: 'Dashboard', route: '/teacher' },
  ];
  return rows.map((r) => ({ ...r, trail: '', kind: 'screen' }));
}

/**
 * Build the index, or return the cached one.
 *
 * One content read, through `staffApi.settleAll` — which this file used to hand-roll as
 * `Promise.allSettled`, because the client had no `settleAll` until the staff index needed one.
 * The contract is unchanged: a refusal costs its own rows and is named in `partial`, never the
 * feature. A teacher with no class assignments legitimately gets destinations only.
 */
export async function loadTeacherSearchIndex(force = false) {
  let token = null;
  try {
    token = await AsyncStorage.getItem('schoolUserToken');
  } catch {
    // Treated as no session; the fingerprint differs and the cache simply misses.
  }
  const fingerprint = fingerprintOf(token);

  if (!force) {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (
          cached?.fingerprint === fingerprint &&
          cached.expiresAt > Date.now() &&
          Array.isArray(cached.rows)
        ) {
          return { rows: cached.rows, partial: cached.partial || [] };
        }
      }
    } catch {
      // A corrupt cache is a cache miss, never an error the teacher sees.
    }
  }

  // ONE READ, NOT TWO. This used to also fetch /api/teacher/groups/classes and then do nothing
  // whatsoever with the payload — its only use was `if (!Array.isArray(classes)) partial.push(...)`,
  // so the request was paid for on every index build and its sole observable effect was the ability
  // to tell a teacher that "Class list could not be included" about rows the index was never going
  // to contain. The class and section names it would have carried are already here, on the
  // profile's `assignedClasses`, which is what the loop below indexes.
  const settled = await staffApi.settleAll({
    profile: staffApi.get('/api/teacher/profile'),
  });

  const rows = [];
  const partial = [];

  // Classes and subjects, from the assignments the profile already carries.
  const profile = settled.profile.data;
  if (profile) {
    const seen = new Set();
    (profile.assignedClasses || []).forEach((row) => {
      const label = [row?.className, row?.sectionName].filter(Boolean).join(' ');
      if (!label || seen.has(label)) return;
      seen.add(label);
      rows.push({
        module: 'Your classes',
        name: label,
        trail: row?.subjectName || '',
        route: '/teacher/attendance',
        kind: 'content',
      });
    });
  } else {
    partial.push('Your classes');
  }

  // Destinations go LAST. The matcher gives a screen a half-point edge so it wins a tie against
  // content of the same name; prepending them lets array order decide instead, which makes that
  // rule unobservable. See services/shared/searchMatch.js.
  rows.push(...destinations());

  try {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ fingerprint, expiresAt: Date.now() + CACHE_TTL_MS, rows, partial }),
    );
  } catch {
    // Storage full or unavailable — the index still works for this session.
  }

  return { rows, partial };
}

/** Drop the cached index. Called on logout with the rest of the session. */
export function clearTeacherSearchIndex() {
  return AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
}

export { searchIndex, groupResults } from '../shared/searchMatch';
