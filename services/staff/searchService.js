// services/staff/searchService.js
//
// Search for the redesigned staff shells. There is no search endpoint anywhere in the backend — not
// for any role — so every panel builds and caches its own index client-side. This is the fifth.
//
// ══ ONE SERVICE FOR ALL FOUR STAFF ROLES, NOT FOUR ═════════════════════════
// From the search subsystem's point of view vice principal, counselor, shreyartha_teacher and
// shreyartha_councellor are one role with a variable. They share a client (`staffApi`), a token
// (`schoolUserToken`), a route namespace (`/staff/${roleKey}/…`) and a menu resolver
// (`resolveStaffMenus`). `roleKey` plays exactly the part `partnerType` already plays in the partner
// service — an argument, not a fifth file.
//
// The existing four services are deliberately NOT retrofitted onto a factory to match. `checksearch`
// mutates the student service by textual replacement of specific lines; collapsing that file into a
// config object would turn every one of its mutations into a no-op, passing while testing nothing.
// Its own header records that having happened once already.
//
// ══ CONTENT ROWS ARE PER ROLE, AND ONLY THE VP HAS ANY YET ═════════════════
// The other three get a destinations-only index until their own redesign phases, where their trees
// can actually be tested. A smaller honest index beats an invented fetch.

import AsyncStorage from '@react-native-async-storage/async-storage';
import staffApi from '../staffApi';
import { STAFF_SEARCH_INDEX_KEY } from '../../constants/storageKeys';
import { fingerprintOf } from '../shared/searchMatch';
import { resolveStaffMenus } from '../../constants/staffRoles';
import { getStaffHome } from '../../constants/staffHome';
import { fetchLiveSchools } from '../teacher/liveSessionService';
import { fetchReportTree } from '../counsellor/reportService';

const TTL_MS = 24 * 60 * 60 * 1000;

/**
 * What each role can contribute beyond its own screen names.
 *
 * `vice_principal` uses the SHREYA01 school tree rather than the obvious `assignedClasses`, and the
 * distinction matters: a VP holds `TeacherClass` rows only if somebody used Assign Class, so for
 * most VPs that list is empty and an index built on it would be destinations-only while claiming to
 * be more. The whole-school tree explicitly admits VICE_PRINCIPAL server-side, so it returns rows
 * for a VP with no assignments at all.
 *
 * Names only, never rosters — the teacher's service sets the precedent and says why: pulling every
 * student would be one request per section.
 */
/**
 * `[{schoolId, schoolName, classes:[{classId, className}]}]` → one row per school and class.
 *
 * Shared by the Vice Principal and the Shreyartha Counsellor, whose sources are different endpoints
 * returning the identical shape.
 *
 * EVERY ROW NEEDS A `route`. A row without one renders perfectly, ranks perfectly, and does nothing
 * at all when tapped — there is no error and no clue. The destination is the panel's Mark Attendance
 * screen, which is where a class name is actionable; the teacher's index makes the same choice for
 * the same reason.
 */
function schoolRows(schools, roleKey) {
  const route = `/staff/${roleKey}/attendance`;
  const out = [];
  for (const school of schools || []) {
    const schoolName = String(school?.schoolName || '').trim();
    if (schoolName) {
      out.push({ module: 'Schools', name: schoolName, trail: '', route, kind: 'content' });
    }
    for (const cls of school?.classes || []) {
      const className = String(cls?.className || '').trim();
      if (className) {
        out.push({ module: 'Classes', name: className, trail: schoolName, route, kind: 'content' });
      }
    }
  }
  return out;
}

const CONTENT_SOURCES = {
  vice_principal: [
    {
      key: 'schools',
      label: 'Schools and classes',
      load: (signal) => fetchLiveSchools(signal),
      /**
       * `[{schoolId, schoolName, classes:[{classId, className}]}]` → one row per school and class.
       *
       * EVERY ROW NEEDS A `route`. A row without one renders perfectly, ranks perfectly, and does
       * nothing at all when tapped — there is no error and no clue. The destination is the panel's
       * Mark Attendance screen, which is where a class name is actionable; the teacher's index makes
       * the same choice for the same reason.
       */
      rows: (schools, roleKey) => schoolRows(schools, roleKey),
    },
  ],

  /**
   * The counsellor's report tree is the best content source any of these roles has: ONE call, no
   * parameters, and it returns the whole school → class → year → section hierarchy already scoped to
   * the sections this counsellor is assigned.
   *
   * Names only. Two shape traps live in that tree and neither matters here because neither id is
   * read: `classId` hangs off the YEAR node rather than the class, and a class with no academic year
   * collapses into a year literally labelled `UNASSIGNED`. Indexing labels sidesteps both.
   */
  counselor: [
    {
      key: 'reportTree',
      label: 'Your classes',
      load: (signal) => fetchReportTree('/api/counselor/counsellor-report', signal),
      rows: (schools, roleKey) => {
        const route = `/staff/${roleKey}/attendance`;
        const out = [];
        const seen = new Set();
        const push = (module, name, trail) => {
          const key = `${module}|${name}|${trail}`;
          if (!name || seen.has(key)) return;
          seen.add(key);
          out.push({ module, name, trail, route, kind: 'content' });
        };
        for (const school of schools || []) {
          const schoolName = String(school?.schoolName || '').trim();
          push('Schools', schoolName, '');
          for (const cls of school?.classes || []) {
            const className = String(cls?.className || '').trim();
            push('Classes', className, schoolName);
            // A class repeats once per academic year, so its sections repeat too — hence the dedupe
            // above rather than a plain push.
            for (const year of cls?.years || []) {
              for (const section of year?.sections || []) {
                const sectionName = String(section?.sectionName || '').trim();
                if (sectionName) push('Sections', `${className} ${sectionName}`.trim(), schoolName);
              }
            }
          }
        }
        return out;
      },
    },
  ],

  /**
   * Portal B's scope tree — the SAME endpoint its Live Counselling screen calls, returning the
   * identical `[{schoolId, schoolName, classes:[{classId, className}]}]` shape as the VP's source.
   *
   * So the row builder is `vice_principal`'s, reused by reference rather than copied. That is not
   * a tidiness point: two textual copies would let one drift, and a search index that quietly stops
   * emitting a route looks exactly like a query with no matches. Only the endpoint differs, which
   * is the whole reason `fetchLiveSchools` takes one.
   */
  shreyartha_councellor: [
    {
      key: 'schools',
      label: 'Schools and classes',
      load: (signal) => fetchLiveSchools(signal, '/api/shreya01/counsellor/schools-classes'),
      rows: (schools, roleKey) => schoolRows(schools, roleKey),
    },
  ],
};

/**
 * Every destination the panel has: its menu, its header actions, and the hubs the redesign added.
 *
 * DERIVED from `resolveStaffMenus`, never retyped — a renamed tile renames its search result too,
 * and a tile that stops existing stops being findable. The redesign destinations are added only for
 * a role that actually has them, so a role still on `StaffMenuScreen` cannot be sent to a route it
 * has no wrapper for.
 */
function destinations(roleKey, config, home) {
  const rows = [
    ...config.menu
      .filter((item) => item.native)
      .map((item) => ({ module: 'Sections', name: item.label, route: item.native })),
    ...config.headerActions
      .filter((item) => item.native)
      .map((item) => ({ module: 'Sections', name: item.label, route: item.native })),
  ];

  if (home) {
    rows.push(
      { module: 'Sections', name: 'My Workspace', route: `/staff/${roleKey}/workspace` },
      { module: 'Sections', name: 'My Attendance', route: `/staff/${roleKey}/my-attendance` },
      { module: 'Your account', name: 'Support', route: `/staff/${roleKey}/support` },
      { module: 'Your account', name: 'Dashboard', route: `/staff/${roleKey}` },
    );
  }

  return rows.map((r) => ({ ...r, trail: '', kind: 'screen' }));
}

/**
 * Build the index for a role, or return the cached one.
 *
 * @param {string} roleKey the `[role]` URL segment
 * @param {boolean} [force] skip the read, still write
 * @returns {Promise<{ rows: Array<object>, partial: string[] }>} `partial` names the sources that
 *   refused, so the screen can say what is missing rather than silently returning less.
 */
export async function loadStaffSearchIndex(roleKey, force = false) {
  const role = String(roleKey || '').toLowerCase();
  const config = resolveStaffMenus(role);
  if (!config) return { rows: [], partial: [] };

  const home = getStaffHome(role);

  let token = '';
  try {
    token = (await AsyncStorage.getItem('schoolUserToken')) || '';
  } catch {
    // No token means no fingerprint; the cache below simply always misses.
  }

  // The role is folded in alongside the token. One static cache key serves all four roles — it has
  // to, because a computed key would never be cleared on logout — and a session only ever holds one
  // staff role, so this is belt and braces rather than load-bearing. It costs one string concat and
  // it makes the safety a property of the code rather than of an argument about sessions.
  const fingerprint = fingerprintOf(`${token}|${role}`);

  if (!force) {
    try {
      const raw = await AsyncStorage.getItem(STAFF_SEARCH_INDEX_KEY);
      const cached = raw ? JSON.parse(raw) : null;
      if (
        cached?.fingerprint === fingerprint
        && cached.expiresAt > Date.now()
        && Array.isArray(cached.rows)
      ) {
        return { rows: cached.rows, partial: cached.partial || [] };
      }
    } catch {
      // A corrupt cache is a miss, never an error the user sees.
    }
  }

  const sources = CONTENT_SOURCES[role] || [];
  const rows = [];
  const partial = [];

  if (sources.length) {
    const tasks = {};
    for (const source of sources) tasks[source.key] = source.load();
    const settled = await staffApi.settleAll(tasks);

    for (const source of sources) {
      const result = settled[source.key];
      if (result?.data) {
        rows.push(...source.rows(result.data, role));
      } else {
        // A refusal costs its own rows and never the feature — which is the whole reason this is
        // settleAll and not Promise.all.
        partial.push(source.label);
      }
    }
  }

  // DESTINATIONS LAST, and this is not cosmetic. The matcher breaks ties by giving a screen row a
  // -0.5, so if destinations came first they would already be winning by position and removing that
  // rule would change nothing observable — the assertion protecting it would be vacuous.
  rows.push(...destinations(role, config, home));

  try {
    await AsyncStorage.setItem(
      STAFF_SEARCH_INDEX_KEY,
      JSON.stringify({ fingerprint, expiresAt: Date.now() + TTL_MS, rows, partial }),
    );
  } catch {
    // A cache that cannot be written still returns a usable index this time round.
  }

  return { rows, partial };
}

/**
 * Drop the cached index.
 *
 * Note the four equivalents on the other panels are dead code — nothing calls any of them, because
 * logout goes through `ALL_AUTH_KEYS`, which lists every search key. This one is here for symmetry
 * and for a caller that wants a forced rebuild without a logout; do not mistake it for the thing
 * that protects the cache across users.
 */
export const clearStaffSearchIndex = () =>
  AsyncStorage.removeItem(STAFF_SEARCH_INDEX_KEY).catch(() => {});

export { searchIndex, groupResults } from '../shared/searchMatch';
