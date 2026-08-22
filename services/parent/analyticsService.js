// services/parent/analyticsService.js
// Mirrors: Parent/platform/pages/ParentAcademicProgress.js
// Backend: parent/controller/ParentDashboardController.java
//
// THE SAME DATA AS THE STUDENT'S MY ANALYTICS, NOT MERELY A SIMILAR SHAPE. Every endpoint below
// resolves the linked child and then calls the very same service method the student endpoint
// calls:
//
//     public StudentAnalyticsResponse getAnalytics(String parentEmail) {
//         Student student = resolveLinkedStudent(parentEmail);
//         return studentAnalyticsService.getStudentAnalytics(student.getEmail());
//     }
//
// All eleven are like that — same DTO, same underlying service. That is why one shared
// `components/student/analytics/AnalyticsBody` renders both portals: there is nothing to translate.
//
// SPINE PLUS ENRICHMENTS, mirroring services/student/analyticsService.js. `/analytics` carries most
// of the page and is awaited alone, because without it there is no page. Everything after it
// degrades quietly through `parentApi.settleAll` — a child who is not a school student legitimately
// has no attendance, no syllabus and no coding progress, and none of those should blank the screen.
//
// ONE PATH HAS NO STUDENT TWIN: `/academic-profile` feeds Part A, the selected subject → chapter →
// topic tree that only the parent page shows.

import { parentApi } from '../parentApi';

const BASE = '/api/parent/dashboard';

/** The spine. Everything else on the screen refines a section of this. */
export function fetchAnalytics(signal) {
  return parentApi.get(`${BASE}/analytics`, { signal });
}

/**
 * The parent home's at-a-glance card — the linked child's snapshot.
 *
 * Identical payload to the student's own `/api/students/analytics/summary`; the server resolves
 * the linked child from the authenticated parent, so there is no studentId to pass. A parent whose
 * child is not linked yet gets a 404 with a message — a normal state, not a failure, so callers
 * should render it rather than treat it as an error.
 */
export function fetchAnalyticsSummary(signal) {
  return parentApi.get(`${BASE}/analytics-summary`, { signal });
}

/** Part A — the child's selected Academic IQ subjects, chapters and topics. */
export function fetchAcademicProfile(signal) {
  return parentApi.get(`${BASE}/academic-profile`, { signal });
}

/**
 * Load the spine, then every enrichment in parallel and independently guarded.
 *
 * The KEYS MUST MATCH the student service's, because `AnalyticsBody` reads them by name —
 * `syllabus`, `progress`, `learningGaps`, `competitive`, `coding`, `skillsProfile`,
 * `skillsProgress`. Renaming one here silently empties that section rather than erroring.
 *
 * `psychResults` is deliberately absent: the parent's psychometric lives on its own Assessment
 * Results tab and comes back flat, so the parent screen passes `showPsychometric={false}`.
 *
 * @returns {Promise<{ analytics, spineError, parts }>}
 */
export async function loadParentAnalytics() {
  let analytics = null;
  let spineError = null;
  try {
    analytics = await fetchAnalytics();
  } catch (e) {
    spineError = e?.message || "Could not load your child's progress.";
  }

  const parts = await parentApi.settleAll({
    syllabus: parentApi.get(`${BASE}/syllabus-completion`),
    progress: parentApi.get(`${BASE}/my-progress`),
    learningGaps: parentApi.get(`${BASE}/learning-gaps`),
    competitive: parentApi.get(`${BASE}/ce-analytics`),
    coding: parentApi.get(`${BASE}/coding-progress`),
    skillsProfile: parentApi.get(`${BASE}/skills-profile`),
    skillsProgress: parentApi.get(`${BASE}/skills-module-progress`),
    // Rendered by the parent page's "Academic IQ history" block. The student screen fetches the
    // same data and never shows it — a gap on the student side, not spare weight here.
    iqHistory: parentApi.get(`${BASE}/academic-iq-history`),
  });

  return { analytics, spineError, parts };
}

/**
 * Mock tests for one entrance exam. **Lazy — fired when the parent expands that exam**, not on
 * load, because a child can have several and each is its own round trip.
 */
export function fetchMockTests(entranceExamId, signal) {
  return parentApi.get(`${BASE}/ce-mocktest/entrance-exam/${entranceExamId}`, { signal });
}
