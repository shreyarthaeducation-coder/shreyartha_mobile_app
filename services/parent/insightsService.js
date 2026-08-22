// services/parent/insightsService.js
// Mirrors: Parent/platform/pages/ParentCounselorNotes.js and ParentAssessmentResults.js
// Backend: parent/controller/ParentDashboardController.java
//
// Two small read-only surfaces that share nothing but their size, kept in one service so the
// parent panel does not accumulate a file per screen.

import { parentApi } from '../parentApi';

/**
 * Counselling sessions the counsellor has shared with this parent.
 *
 * @returns {Promise<Array<{ id, counselorName, counsellingType, sessionDate, counselorNotes,
 *   caseStatus, createdAt }>>}
 *
 * THE WEB RENDERS FOUR FIELDS THE DTO NEVER SENDS — `followUpDate`, `improvementScore`,
 * `sessionMode` and a bare `date` — each behind a truthiness guard, so they are permanently
 * invisible. `ParentCounselorNoteResponse` has exactly the seven fields above. They are not
 * rendered here; adding UI for data the server cannot produce is how the web ended up with four
 * dead branches.
 */
export async function fetchCounselorNotes(signal) {
  const res = await parentApi.get('/api/parent/dashboard/counselor-notes', { signal });
  return Array.isArray(res) ? res : [];
}

/**
 * The child's personal statement, read off the analytics payload.
 *
 * The web's Assessment Results page pulls the whole `/analytics` response purely for
 * `personalStatement`. Kept as-is rather than pointed at `/assessment-results`, which exists and
 * returns a richer DTO but which the web does not call — switching endpoints would change what a
 * parent sees, and that is a product decision, not a port decision.
 */
export async function fetchPersonalStatement(signal) {
  const res = await parentApi.get('/api/parent/dashboard/analytics', { signal });
  return res?.personalStatement || '';
}

/**
 * Psychometric completion.
 *
 * The controller assembles this inline, so the shape is exact and flat — and `chapterName` is
 * always the literal "Psychometric Assessment".
 *
 * @returns {Promise<{ chapterName, completedCount, totalTopics, hasCompletedAssessment }>}
 */
export async function fetchPsychometric(signal) {
  const res = await parentApi.get('/api/parent/dashboard/psychometric', { signal });
  return {
    chapterName: res?.chapterName || 'Psychometric Assessment',
    completedCount: res?.completedCount || 0,
    totalTopics: res?.totalTopics || 0,
    hasCompletedAssessment: !!res?.hasCompletedAssessment,
  };
}

/** Percent complete, guarding the divide-by-zero the web guards too. */
export const psychometricPercent = (p) =>
  p?.totalTopics > 0 ? Math.round((p.completedCount / p.totalTopics) * 100) : 0;
