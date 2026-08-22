// services/parent/accessService.js
// Mirrors the hidden-nodes half of services/student/accessService.js, on the parent's transport.
//
// ── WHY THIS EXISTS RATHER THAN REUSING THE STUDENT ONE ──────────────────────
// `services/student/accessService.js` and `hooks/useStudentAccess.js` both go through `studentApi`,
// which reads its token from `studentToken` / `userToken` / `accessToken` / `token`. Under a parent
// session that is wrong in two ways, and the second one is not cosmetic:
//
//   1. With no student session it sends NO Authorization header. The hidden-nodes endpoint sits
//      under `/api/public/` but is NOT permitAll — SecurityConfig has no matcher for it, so it
//      falls through to `.anyRequest().authenticated()` and 401s. The call would always fail.
//
//   2. On a device where a student has ALSO signed in, it finds that student's stale token and
//      sends it. If that token has expired, `studentApi`'s 401 path fires `handleExpiry()`, which
//      wipes ALL_AUTH_KEYS and redirects to the STUDENT login — **throwing the signed-in parent
//      out of the parent portal**, with no error a user could act on.
//
// So the parent gets its own reader on `parentApi`. Same contract, right token.
//
// ── ROLE ACCESS IS DELIBERATELY NOT PORTED ───────────────────────────────────
// The student service also fetches `/api/students/role-access` for LOCKED/HIDDEN entitlement rules.
// That is a student-plan concept, the endpoint is student-only, and the parent's web page does not
// use it — it filters on hidden nodes alone. Porting it would mean asking a student-scoped endpoint
// about a parent, which is exactly the confusion described above.

import { parentApi } from '../parentApi';

/**
 * Admin-hidden node ids for one module.
 *
 * DEGRADES TO "SHOW EVERYTHING" on any failure, exactly as the student version and the web hook do.
 * Blanking a content tree because an auxiliary call failed would be far worse than showing a node
 * an admin meant to hide.
 *
 * @param {'ACADEMIC_IQ'|'COMPETITIVE_EXAM'|'SKILLS_EDGE'} module
 * @returns {Promise<Record<string, Set<number>>>} entityType -> set of hidden ids
 */
export async function fetchHiddenNodes(module, signal) {
  try {
    const res = await parentApi.get(`/api/public/hidden-nodes/${module}`, { signal });
    if (!res || typeof res !== 'object') return {};
    const out = {};
    Object.entries(res).forEach(([key, ids]) => {
      out[key] = new Set((Array.isArray(ids) ? ids : []).map(Number));
    });
    return out;
  } catch {
    return {};
  }
}

/**
 * Is this node hidden?
 *
 * `hidden` is the map above. An absent entity type means nothing of that type is hidden, which is
 * the same "show it" default as a failed fetch.
 */
export function isHidden(hidden, entityType, entityId) {
  const set = hidden?.[entityType];
  return !!set && set.has(Number(entityId));
}

/** Drop hidden entries from a list, keyed by `getId` (defaults to `.id`). */
export function visible(hidden, entityType, list, getId = (n) => n?.id) {
  if (!Array.isArray(list)) return [];
  return list.filter((node) => !isHidden(hidden, entityType, getId(node)));
}
