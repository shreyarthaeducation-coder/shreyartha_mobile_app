/**
 * One resolver that tells a staff feature screen how to scope itself, for any role.
 *
 * Three portals now share the same screens, and they disagree on two things: the API namespace and
 * the shape of the scope picker. Without this, every route wrapper under `app/staff/[role]/` would
 * carry its own `if (counsellor) … else if (shreyartha_teacher) …` ladder — eight copies of the
 * same branch, each free to drift.
 *
 *   COUNSELOR              classSection   /api/counselor/**
 *   SHREYARTHA_COUNCELLOR  schoolClass    /api/shreya01/counsellor/**
 *   SHREYARTHA_TEACHER     schoolClass    /api/shreya01/**            ← added Aug 2026
 *   VICE_PRINCIPAL         classSection   /api/teacher/**  (the screens' own defaults)
 *
 * The descriptors are shaped differently on purpose and are NOT merged here: the counsellor
 * portals publish ONE `schoolsClasses` endpoint that every feature shares, while the Shreyartha
 * teacher publishes FOUR — one per feature namespace, populated from different assignment sources.
 * Flattening the second into the first would quietly hand every feature the same scope tree. This
 * resolver normalises them into a common result instead.
 */

import { getCounsellorPortal } from './counsellorPortals';
import { SHREYA01_TEACHER } from './shreya01TeacherPortal';
import { VICE_PRINCIPAL } from './vicePrincipalPortal';

/** Feature keys as the counsellor descriptor spells them, where they differ from ours. */
const COUNSELLOR_KEY = {
  counsellorReport: 'report',
  liveSchools: 'liveSessionScope',
};

/**
 * @param {string} roleKey  the lowercased `[role]` route segment
 * @param {string} feature  'attendance' | 'counselling' | 'counsellorReport' | 'groups'
 *                          | 'homework' | 'syllabus' | 'subjects' | 'liveSchools'
 * @returns {{ apiBase: string, schoolsEndpoint: string|undefined, scopeKind: string }|null}
 *          null when the role has no such feature — the caller renders nothing and the layout
 *          guard has already redirected.
 */
export function resolveFeatureScope(roleKey, feature) {
  const key = String(roleKey || '').toLowerCase();

  if (key === VICE_PRINCIPAL.key) {
    if (!VICE_PRINCIPAL.features.includes(feature)) return null;
    // `apiBase` and `schoolsEndpoint` are undefined ON PURPOSE. A JS default parameter fires on
    // undefined, so every screen falls back to its own teacher constant — which is exactly what
    // the web VP does, rendering the Teacher page components unchanged. Naming the paths here
    // instead would give VP a second copy of each one, free to drift from the teacher panel's.
    return { apiBase: undefined, schoolsEndpoint: undefined, scopeKind: VICE_PRINCIPAL.scope };
  }

  if (key === SHREYA01_TEACHER.key) {
    const entry = SHREYA01_TEACHER[feature];
    if (!entry) return null;
    // Flat string entries (counsellorReport, liveSchools) carry no scope tree of their own.
    if (typeof entry === 'string') {
      return { apiBase: entry, schoolsEndpoint: SHREYA01_TEACHER.liveSchools, scopeKind: SHREYA01_TEACHER.scope };
    }
    return { apiBase: entry.base, schoolsEndpoint: entry.schools, scopeKind: SHREYA01_TEACHER.scope };
  }

  const portal = getCounsellorPortal(key);
  if (!portal) return null;
  const apiBase = portal[COUNSELLOR_KEY[feature] || feature];
  if (!apiBase) return null;
  return {
    apiBase,
    // Undefined for the school-bound counsellor, which is correct — it uses ScopePicker and never
    // reads this.
    schoolsEndpoint: portal.schoolsClasses,
    scopeKind: portal.scope,
  };
}

/** True for any portal whose scope is School → Class with no section tier. */
export function isSchoolScoped(roleKey) {
  const key = String(roleKey || '').toLowerCase();
  if (key === SHREYA01_TEACHER.key) return SHREYA01_TEACHER.scope === 'schoolClass';
  return getCounsellorPortal(key)?.scope === 'schoolClass';
}
