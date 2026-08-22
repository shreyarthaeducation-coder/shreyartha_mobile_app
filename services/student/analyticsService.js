// services/student/analyticsService.js
// Mirrors: frontendmain/src/student/platform/MyAnalytics/MyAnalytics.js
//
// ONE SPINE PLUS ENRICHMENTS, not a dozen equal reads. `GET /api/students/analytics` returns
// StudentAnalyticsResponse and already carries most of the page; the other calls each refine one
// section. Two consequences worth knowing before touching this:
//
//   * The **Language Lab section has no endpoint of its own** — it renders `analytics.languageLab`
//     (`{ level, skillLevels: {Listening, Speaking, Reading, Writing} }`) entirely.
//   * **Coding Pro falls back to `analytics.codingPro`** when `/api/coding/topics/progress` fails,
//     which the web relies on. Do not treat that failure as an empty section.
//
// TWO FETCHES WERE REMOVED HERE, and the reasoning matters if you are tempted to re-add them.
// `/api/skillsedge/tree` and `/api/psychometrics/progress` were fetched on every load and read
// nowhere in the app. The WEB does consume both — the tree to look up a chapter by skill name, and
// the progress call to derive its own psychometric completion count — but this screen renders those
// two sections by other means entirely (Skills Edge from `skills/profile` + `skillsedge/topics/
// progress`; psychometric from `PsychometricSummary` over `psychometrics/results`). So they were
// two round trips per load buying nothing. Re-add one only alongside the section that needs it.
//
// EVERY ENRICHMENT IS OPTIONAL. A free student legitimately 403s on several — the web already
// wraps three in individual `.catch()`es. `loadAnalytics` uses `studentApi.settleAll` so one
// refusal degrades one section rather than blanking the page.
//
// SPELLINGS: plural `/api/students/…` for analytics + syllabus-completion; singular
// `/api/student/…` for my-progress, reflection and competitiveexam; and the psychometric,
// skillsedge, skills and coding trees carry no student prefix at all. All three are real.

import { studentApi } from '../studentApi';

/** The spine. Everything else on the screen refines a section of this. */
export function fetchAnalytics(signal) {
  return studentApi.get('/api/students/analytics', { signal });
}

/**
 * The home screen's at-a-glance card.
 *
 * A strict subset of `/api/students/analytics`, exposed separately so the home screen does not
 * download every exam tab, skill map and career preference to render one sentence and four chips.
 *
 * Returns facts, never a finished sentence — the subject ("You…" vs the parent portal's "Your
 * candidate…") is applied by the component, because both portals are served the identical payload
 * by the identical backend method.
 */
export function fetchAnalyticsSummary(signal) {
  return studentApi.get('/api/students/analytics/summary', { signal });
}

/**
 * Load the spine, then every enrichment in parallel and independently guarded.
 *
 * The spine is awaited first and on purpose: if it fails there is no page, so that one error is
 * worth surfacing. Everything after it degrades quietly.
 *
 * @returns {Promise<{ analytics: object|null, spineError: string|null, parts: Record<string, {data, error, forbidden}> }>}
 */
export async function loadAnalytics() {
  let analytics = null;
  let spineError = null;
  try {
    analytics = await fetchAnalytics();
  } catch (e) {
    spineError = e?.message || 'Could not load your analytics.';
  }

  const parts = await studentApi.settleAll({
    syllabus: studentApi.get('/api/students/syllabus-completion'),
    progress: studentApi.get('/api/student/my-progress'),
    // Fetched but NOT rendered on this screen — the web's My Analytics has an Academic IQ change
    // log that the native student screen has never had. Kept because it is a MISSING SECTION here,
    // not spare weight: the parent's Academic Progress renders exactly this data. Drop it only
    // together with a decision not to build that section.
    iqHistory: studentApi.get('/api/academic/profile/history'),
    learningGaps: studentApi.get('/api/student/reflection/learning-gaps'),
    competitive: studentApi.get('/api/student/competitiveexam/analytics'),
    coding: studentApi.get('/api/coding/topics/progress'),
    skillsProfile: studentApi.get('/api/skills/profile'),
    skillsProgress: studentApi.get('/api/skillsedge/topics/progress'),
    // Re-added for My Analytics' FOCUS TOPIC pills. `selectedTopics` stores topic IDS, and only
    // the tree can turn those into names. It was removed in an earlier pass as "fetched and read
    // nowhere", which was true then. The parent service has no equivalent endpoint, so
    // AnalyticsBody renders the pills only when this key is present — the parent shows the skill
    // rows without them rather than blanking.
    skillsTree: studentApi.get('/api/skillsedge/tree'),
    psychResults: studentApi.get('/api/psychometrics/results'),
  });

  return { analytics, spineError, parts };
}

/**
 * Mock tests for one entrance exam. **Lazy — fired when a student expands that exam**, not on
 * load, because a student can have several and each is its own round trip.
 */
export function fetchMockTests(entranceExamId, signal) {
  return studentApi.get(`/api/student/competitiveexam/mocktest/entrance-exam/${entranceExamId}`, {
    signal,
  });
}

/* ── Readers, so the screen does not repeat the fallback logic ──────────── */

/** `{ competitiveExam: {...} }` or the object itself — the web accepts both. */
export const competitiveOf = (part) => part?.competitiveExam || part || null;

/**
 * Coding Pro streams, preferring the live progress call and falling back to the spine.
 *
 * @returns {Array<{ key, name, percent, completed, total, rating, gapsCount }>}
 */
export function codingStreams(progress, analytics) {
  const STREAMS = [
    { key: 'ai', name: 'AI', color: '#2196f3' },
    { key: 'robotics', name: 'Robotics', color: '#ff9800' },
    { key: 'coding', name: 'Coding', color: '#4caf50' },
  ];
  return STREAMS.map((s) => {
    const live = progress?.[s.key];
    const fallback = analytics?.codingPro?.[s.key];
    return {
      ...s,
      percent: live ? live.percentage || 0 : fallback?.percent || 0,
      completed: live?.completed ?? null,
      total: live?.total ?? null,
      rating: fallback?.rating || 0,
      gapsCount: fallback?.gapsCount || 0,
    };
  });
}

/** Has the student finished the psychometric assessment? Drives summary vs "take it" prompt. */
export function hasPsychometricResults(results) {
  return !!(results && (results.results || results.overallReadiness !== undefined));
}
