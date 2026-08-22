// services/counsellor/surveyService.js
// Mirrors: frontendmain/src/School/Counselor/pages/CounselorGroups.js
//          frontendmain/src/School/ShreyarthaCounsellor/ShreyarthaCounsellorGroups.js
// Backend: survey/controller/CounselorSurveyController.java
//
// "Wellness Groups" on both counsellor sidebars. NOTE THE NAME COLLISION: this shares NOTHING with
// the teacher's "Create Group" (ability bands over /api/teacher/groups). It is the wellbeing-survey
// index screen — different endpoints, different data, different purpose.
//
// NAMESPACES ARE MIXED ON PURPOSE. Categories, the override write and the override delete live on
// `/api/counselor/survey/*` for BOTH portals — those methods are guarded
// `hasAnyRole('COUNSELOR','SHREYARTHA_COUNCELLOR')` and have no shreya01 twin. Only the per-class
// index READ differs, because only that one is scoped. `ShreyarthaCounsellorGroups.js` does exactly
// this. Pointing the shared paths at `/api/shreya01/` returns 404.

import { staffApi } from '../staffApi';
import { SHARED_COUNSELLOR_API } from '../../constants/counsellorPortals';

/** Risk bands, matching the web's RISK_COLORS. */
export const RISK_LEVELS = {
  LOW: { label: 'Low', color: '#166534', bg: '#dcfce7' },
  MODERATE: { label: 'Moderate', color: '#92400e', bg: '#fef3c7' },
  HIGH: { label: 'High', color: '#991b1b', bg: '#fee2e2' },
};

export const RISK_ORDER = ['LOW', 'MODERATE', 'HIGH'];

export const riskMeta = (level) => RISK_LEVELS[level] || { label: '—', color: '#64748b', bg: '#f1f5f9' };

/**
 * The index columns the admin has defined.
 *
 * @returns {Promise<Array<{ id, name, indexName, shortCode, displayOrder,
 *   lowMax, moderateMax, lowMessage, moderateMessage, highMessage }>>}
 */
export async function fetchSurveyCategories(signal) {
  const res = await staffApi.get(SHARED_COUNSELLOR_API.surveyCategories, { signal });
  return Array.isArray(res) ? res : [];
}

/**
 * Every student in the scope with their index values.
 *
 * @returns {Promise<Array<{ studentId, studentName, studentEmail,
 *   indices: Record<string, { categoryId, categoryName, indexName, shortCode, level,
 *                             totalMarks, maxMarks, overridden, message }> }>>}
 */
export async function fetchStudentIndices({ endpoint, scope, scopeKind = 'classSection' }, signal) {
  const params =
    scopeKind === 'schoolClass'
      ? { classId: scope.classId }
      : { className: scope.className, sectionName: scope.sectionName };

  const res = await staffApi.get(endpoint, { params, signal });
  return Array.isArray(res) ? res : [];
}

/** Counsellor override of a computed band. `level` is LOW | MODERATE | HIGH. */
export function updateStudentIndex({ studentId, categoryId, level }) {
  return staffApi.post(SHARED_COUNSELLOR_API.surveyIndexUpdate, { studentId, categoryId, level });
}

/** Drop the override and fall back to the computed band. */
export function removeIndexOverride({ studentId, categoryId }) {
  return staffApi.del(SHARED_COUNSELLOR_API.surveyIndexOverride, {
    params: { studentId, categoryId },
  });
}

/**
 * The chart series, derived — NOT fetched.
 *
 * `GET /survey/indices/graph` exists but neither web page calls it; both compute the same numbers
 * from the `indices` map they already hold. Fetching it would be a second round trip for data
 * already in memory, and the two could then disagree.
 *
 * The `moderateMax * 1.5` fallback is the web's, for categories with no `maxMarks`.
 *
 * @returns {Array<{ label: string, value: number, level: string }>} value is a 0–100 percentage
 */
export function indexChartData(student, categories = []) {
  return categories.map((category) => {
    const detail = student?.indices?.[category.shortCode];
    if (!detail) return { label: category.shortCode, value: 0, level: null };

    const total = detail.totalMarks ?? 0;
    const max = detail.maxMarks;
    let value = 0;
    if (max && max > 0) {
      value = Math.round((total / max) * 100);
    } else {
      const moderateMax = category.moderateMax ?? 0;
      if (moderateMax > 0 && total >= 0) {
        value = Math.min(100, Math.round((total / (moderateMax * 1.5)) * 100));
      }
    }
    return { label: category.shortCode, value, level: detail.level };
  });
}

/** The band a student's row is summarised by: the worst band across their indices. */
export function worstLevel(student) {
  const levels = Object.values(student?.indices || {}).map((d) => d.level);
  return RISK_ORDER.slice().reverse().find((level) => levels.includes(level)) || null;
}
