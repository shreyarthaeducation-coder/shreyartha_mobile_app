// services/admin/evaluationService.js
// Mirrors: frontendmain/src/School/Admin/pages/StaffEvaluation/ (5 files, 756 lines)
// Backend: school/staffevaluation/controller/StaffEvaluationController.java — every method is
//          hasRole('SCHOOL_ADMIN'); a Principal arrives through the role hierarchy.
//
// THREE LEVELS ON THE WEB, THREE ROUTES: type cards → staff list → one member's breakdown, with the
// rating modal reachable from the last two. One screen here, because a phone back-stack of three
// pushes for what is really a drill-down reads worse than an in-place level change.
//
// WHAT THE ADMIN ACTUALLY SETS is only three of the six metrics: discipline, integrity and
// professionalism, each 1–5. The rest of the composite score is computed elsewhere from
// attendance, syllabus and so on — this page cannot influence them.

import { staffApi } from '../staffApi';

/** The three metrics the evaluate form writes. Keys are the POST body's field names. */
export const EVALUATION_METRICS = [
  { key: 'discipline', label: 'Discipline' },
  { key: 'integrity', label: 'Integrity' },
  { key: 'professionalism', label: 'Professionalism' },
];

/** Each metric is rated 1–5; the admin block contributes out of 15. */
export const RATING_MAX = 5;

/** Per-role accents, verbatim from the web's ROLE_CONFIG. */
export const EVAL_ROLE_COLOR = {
  TEACHER: '#3b82f6',
  COUNSELOR: '#8b5cf6',
  PRINCIPAL: '#ef4444',
  VICE_PRINCIPAL: '#f97316',
  ADMIN: '#10b981',
};

/**
 * Which staff categories exist in this school.
 *
 * ADMIN and SCHOOL_ADMIN are filtered out client-side, exactly as the web does — the endpoint
 * returns them, and nobody evaluates the administrator.
 */
export async function fetchStaffTypes(apiBase, signal) {
  const res = await staffApi.get(`${apiBase}/staff-types`, { signal });
  const hidden = ['ADMIN', 'SCHOOL_ADMIN'];
  return (Array.isArray(res) ? res : []).filter((role) => !hidden.includes(role));
}

/**
 * Staff of one category.
 *
 * @returns {Promise<Array<{ id, fullName, email, mobile, role, designation,
 *   hasAdminEvaluation: boolean }>>}
 */
export async function fetchEvaluationStaff(apiBase, role, signal) {
  const res = await staffApi.get(
    `${apiBase}/staff?role=${encodeURIComponent(role)}`,
    { signal },
  );
  return Array.isArray(res) ? res : [];
}

/**
 * One member's composite score and its breakdown.
 *
 * @returns {Promise<{ fullName, email, role, designation, department, totalScore,
 *   hasAdminEvaluation, adminEvaluationDetail: { discipline, integrity, professionalism }|null,
 *   metrics: Array<{ name, actualScore, maxScore, percentage }> }>}
 */
export function fetchEvaluationDetail(apiBase, staffId, signal) {
  return staffApi.get(`${apiBase}/staff/${staffId}/details`, { signal });
}

/** The ratings already recorded, if any. A 404/empty means "not yet evaluated" — not an error. */
export async function fetchAdminEvaluation(apiBase, staffId, signal) {
  try {
    const data = await staffApi.get(`${apiBase}/staff/${staffId}/admin-evaluation`, { signal });
    if (!data) return null;
    // The web treats an all-zero response as absent, so a fresh form starts unrated rather than
    // showing three phantom zeros.
    if (!data.discipline && !data.integrity && !data.professionalism) return null;
    return {
      discipline: data.discipline || 0,
      integrity: data.integrity || 0,
      professionalism: data.professionalism || 0,
    };
  } catch {
    return null;
  }
}

/** POST body is the bare `{discipline, integrity, professionalism}` object. */
export function submitEvaluation(apiBase, staffId, ratings) {
  return staffApi.post(`${apiBase}/staff/${staffId}/evaluate`, ratings);
}

/** All three are required — the web refuses a partial submission and so does this. */
export function validateRatings(ratings) {
  return EVALUATION_METRICS.every((metric) => Number(ratings?.[metric.key]) > 0)
    ? null
    : 'Please rate all three metrics.';
}

/**
 * A metric's score as a percentage of its own maximum.
 *
 * NOTE the admin block's fallback, which the web carries and which is easy to lose: when
 * `actualScore` is missing or zero but `adminEvaluationDetail` has ratings, the score is
 * `(sum / 15) * 5` — the three 1–5 ratings rescaled onto the metric's own five points.
 */
export function metricPercent(score, max) {
  if (!max) return 0;
  return Math.min(100, (Number(score) / Number(max)) * 100);
}

export function adminBlockScore(detail) {
  if (!detail) return 0;
  const { discipline = 0, integrity = 0, professionalism = 0 } = detail;
  if (!discipline && !integrity && !professionalism) return 0;
  return ((discipline + integrity + professionalism) / 15) * 5;
}

/** `VICE_PRINCIPAL` → `VICE PRINCIPAL`, as every staff page on the web renders it. */
export const prettyRoleName = (role) => String(role || '').replace(/_/g, ' ');
