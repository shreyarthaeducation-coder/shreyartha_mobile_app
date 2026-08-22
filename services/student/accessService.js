// services/student/accessService.js
// Mirrors: frontendmain/src/services/useStudentHiddenNodes.js
//          + frontendmain/src/hooks/useRoleAccess.js
//
// The two gates every student content tree passes through. Subject & Career and Skills Edge use
// them here; Academic IQ, Psychometric and Coding Pro all use the same two, so this is shared
// infrastructure rather than screen-local code.
//
// 1. HIDDEN NODES — `GET /api/public/hidden-nodes/{MODULE}` → `{ ENTITY_TYPE: [ids] }`.
//    Admin-hidden ids, per module. Nodes in here are removed from the tree entirely.
//
// 2. ROLE ACCESS — `GET /api/students/role-access` → `{ defaultLevel, rules[] }`.
//    Per-node ACCESSIBLE | LOCKED | HIDDEN. A LOCKED node is rendered but not openable (that is
//    the upsell); a HIDDEN one is removed like a hidden node.
//
// The staff side already does the hidden-nodes half in services/teacher/upskillService.js
// (`fetchHiddenNodes`); this is the same shape on `studentApi` instead of `staffApi`.

import { studentApi } from '../studentApi';

/** `module` values used by the student trees. */
export const ACCESS_MODULE = {
  SUBJECT_CAREER: 'SUBJECT_CAREER',
  SKILLS_EDGE: 'SKILLS_EDGE',
  ACADEMIC_IQ: 'ACADEMIC_IQ',
};

export const ACCESS = {
  ACCESSIBLE: 'ACCESSIBLE',
  LOCKED: 'LOCKED',
  HIDDEN: 'HIDDEN',
};

/**
 * Admin-hidden node ids for one module.
 *
 * DEGRADES TO "SHOW EVERYTHING" on any failure, exactly as the web hook does. Blanking a content
 * tree because an auxiliary call failed would be far worse than showing a node an admin meant to
 * hide, and this endpoint is public — a failure here is a network problem, not a permission one.
 *
 * @returns {Promise<Record<string, Set<number>>>} entityType -> set of hidden ids
 */
export async function fetchHiddenNodes(module, signal) {
  try {
    const res = await studentApi.get(`/api/public/hidden-nodes/${module}`, { signal });
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

/* ── Role access ───────────────────────────────────────────────────────────
   MODULE-SCOPE CACHE, deliberately, copying the web's `_cache`/`_promise`.

   `getNodeAccess` is called once per node per render — Skills Edge alone calls it at four tree
   levels — and the rules are a single per-student document that cannot change mid-session. A
   per-mount fetch would refire on every drill step and every screen push. The in-flight promise is
   cached too, so two screens mounting together share one request. */

let cache = null;
let inFlight = null;

const EMPTY = { defaultLevel: ACCESS.ACCESSIBLE, rules: [] };

/** Drop the cache — call on logout, or the next student inherits these rules. */
export function clearRoleAccessCache() {
  cache = null;
  inFlight = null;
}

export function fetchRoleAccess() {
  if (cache) return Promise.resolve(cache);
  if (!inFlight) {
    inFlight = studentApi
      .get('/api/students/role-access')
      .then((data) => {
        // Two live shapes: a bare rules array, or `{ defaultLevel, rules }`.
        if (Array.isArray(data)) return { defaultLevel: ACCESS.ACCESSIBLE, rules: data };
        if (data && Array.isArray(data.rules)) {
          return { defaultLevel: data.defaultLevel ?? ACCESS.ACCESSIBLE, rules: data.rules };
        }
        return EMPTY;
      })
      .catch(() => EMPTY)
      .then((parsed) => {
        cache = parsed;
        inFlight = null;
        return parsed;
      });
  }
  return inFlight;
}

/**
 * The access level configured for one node.
 *
 * FALLS BACK TO `defaultLevel`, NEVER TO `ACCESSIBLE`. `defaultLevel` is `LOCKED` for students on
 * a monthly custom plan — everything is locked unless an admin explicitly unlocked it at their
 * month — so defaulting an unmatched node to accessible would hand out the whole catalogue.
 */
export function nodeAccess(access, component, entityType, entityId) {
  const rules = access?.rules || [];
  const rule = rules.find(
    (r) =>
      r.component === component &&
      r.entityType === entityType &&
      String(r.entityId) === String(entityId),
  );
  return rule?.accessLevel ?? access?.defaultLevel ?? ACCESS.ACCESSIBLE;
}

/**
 * Collapse several levels into one — **the most restrictive wins**.
 *
 * Subject & Career reads a preference's curriculum, chapter AND topic and takes the worst of the
 * three: locking a chapter has to lock every topic under it, or the lock is trivially bypassed by
 * deep-linking a child.
 */
export function strictest(levels) {
  if (levels.includes(ACCESS.HIDDEN)) return ACCESS.HIDDEN;
  if (levels.includes(ACCESS.LOCKED)) return ACCESS.LOCKED;
  return ACCESS.ACCESSIBLE;
}

/**
 * Does this component have any restriction worth telling the student about?
 *
 * Drives the limited-access banner. Deliberately scoped to one component rather than using a
 * global "is limited" flag — the web made that distinction so the banner does not appear on a
 * section where nothing is actually restricted.
 */
export function hasComponentRestrictions(access, component) {
  if (!access) return false;
  if (access.defaultLevel === ACCESS.LOCKED) return true;
  return (access.rules || []).some(
    (r) =>
      r.component === component &&
      (r.accessLevel === ACCESS.LOCKED || r.accessLevel === ACCESS.HIDDEN),
  );
}
