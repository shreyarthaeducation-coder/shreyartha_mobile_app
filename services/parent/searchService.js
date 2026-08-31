// services/parent/searchService.js
//
// Search for the parent panel.
//
// ── SAME PATTERN AS THE STUDENT'S, DIFFERENT SOURCES ───────────────────────
// There is no search endpoint anywhere in the backend — zero search mappings across every
// controller — so this index is built on the client too. The MATCHER is shared
// (`services/shared/searchMatch.js`) because the ranking must not drift between panels; only what
// goes into the index differs.
//
// A parent's searchable world is much smaller than a student's: the eight portal sections, and
// their own child's syllabus and assigned work. There is no point fanning out over six content
// trees — a parent cannot open a topic, only read about their child's progress through it.
//
// ── THE INDEX IS PER PARENT ────────────────────────────────────────────────
// `/academic-profile` is the CHILD's tree, and the child's topic names carry the per-school alias
// overlay. On a shared device one parent's index must never answer another's searches, so the cache
// is fingerprinted to the session AND its key is in `ALL_AUTH_KEYS`. Both guards are needed: the
// fingerprint stops a stale read, the key list is what makes the data go away.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { parentApi } from '../parentApi';
import { fingerprintOf, flattenTree } from '../shared/searchMatch';
import { PARENT_SEARCH_INDEX_KEY } from '../../constants/storageKeys';
import { PARENT_MENU } from '../../constants/parentMenu';

const CACHE_KEY = PARENT_SEARCH_INDEX_KEY;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * The child's academic tree.
 *
 * `AcademicIQResponse` nests subjects → chapters → topics. Hits route to Academic Progress, which
 * renders that same tree and drives its own drill state — inventing a deep-link parameter that
 * screen does not read would be a link that silently does nothing.
 */
const TREE_SOURCE = {
  key: 'academic',
  label: "Your child's syllabus",
  endpoint: '/api/parent/dashboard/academic-profile',
  childKeys: ['subjects', 'chapters', 'topics'],
  route: '/parent/academic-progress',
};

/**
 * The portal's own destinations.
 *
 * Built from `PARENT_MENU` rather than retyped, so a menu label that changes to match the web
 * sidebar changes here too — `checkparent.mjs` §1 asserts those labels verbatim against the
 * website, and a second hardcoded copy would quietly disagree with it.
 *
 * The extras below are real screens that are not sidebar items: the two fee segments, the account
 * screen, and the dashboard itself.
 */
function destinations() {
  const rows = PARENT_MENU.filter((item) => item.native).map((item) => ({
    module: 'Sections',
    name: item.label,
    route: item.native,
  }));

  rows.push(
    { module: 'Sections', name: 'Pay Fees', route: '/parent/fees' },
    { module: 'Sections', name: 'Payment History', route: '/parent/fees?tab=history' },
    { module: 'Your account', name: 'Change Password', route: '/parent/change-password' },
    { module: 'Your account', name: 'Dashboard', route: '/parent' },
  );

  return rows.map((r) => ({ ...r, trail: '', kind: 'screen' }));
}

/**
 * Build the index, or return the cached one.
 *
 * @param {boolean} force skip the cache — used by pull-to-refresh
 * @returns {Promise<{ rows: Array, partial: string[] }>} `partial` names what could not be included
 */
export async function loadParentSearchIndex(force = false) {
  let token = null;
  try {
    token = await AsyncStorage.getItem('parentUserToken');
  } catch {
    // Treated as no session; the fingerprint simply differs and the cache misses.
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
      // A corrupt cache is a cache miss, never an error the parent sees.
    }
  }

  // `settleAll`, never `Promise.all`: an unlinked child 404s on both of these, which is a normal
  // state — it must cost the content rows, not the destinations, and certainly not the screen.
  const settled = await parentApi.settleAll({
    tree: parentApi.get(TREE_SOURCE.endpoint),
    activities: parentApi.get('/api/parent/dashboard/learning-activities'),
  });

  const rows = [];
  const partial = [];

  const tree = settled.tree;
  if (tree?.data) flattenTree(tree.data, TREE_SOURCE, [], rows);
  else partial.push(TREE_SOURCE.label);

  // Assigned work, by title. Three lists, each landing on its own tab of Learning Activities.
  const activities = settled.activities?.data;
  if (activities) {
    const LISTS = [
      ['teacherResources', "Teacher's resources"],
      ['homework', 'Homework'],
      ['personalisedResources', 'Personalised resources'],
    ];
    LISTS.forEach(([key, label]) => {
      (Array.isArray(activities[key]) ? activities[key] : []).forEach((item) => {
        if (!item?.title) return;
        rows.push({
          module: label,
          name: String(item.title),
          trail: [item.subjectName, item.topicName].filter(Boolean).join(' › '),
          route: `/parent/learning-activities?tab=${key}`,
          kind: 'content',
        });
      });
    });
  } else {
    partial.push('Learning activities');
  }

  // Destinations go LAST. The matcher gives a screen a half-point edge so it wins a tie against
  // content of the same name — prepending them would let array order decide instead, which makes
  // that rule unobservable and free to rot. See services/shared/searchMatch.js.
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
export function clearParentSearchIndex() {
  return AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
}

export { searchIndex, groupResults } from '../shared/searchMatch';
