// constants/analytics.js
// The pure derivations behind My Analytics.
// Mirrors: frontendmain/src/student/platform/MyAnalytics/MyAnalytics.js
//
// These live apart from the component for two reasons: they are the parts that must match the
// website EXACTLY (student-facing remark strings, star ladders, fallback chains), and they are the
// only parts a checker can evaluate rather than grep.

import { REFLECTION_OPTIONS } from '../services/student/academicIqService';

/* ── Star ladders ──────────────────────────────────────────────────────────
   TWO DIFFERENT LADDERS, and both are computed CLIENT-side on the web.

   This screen previously rendered the SERVER's `syllabusRating` / `progressRating` instead. The
   syllabus one at least agreed most of the time; `progressRating` is **never read by the website
   at all**, so mobile was showing a number the web has no equivalent for. */

/** Syllabus Completion: 90 / 70 / 50 / 30. Fed the RAW percent, not the rounded one. */
export function syllabusStars(percent) {
  const p = Number(percent) || 0;
  if (p >= 90) return 5;
  if (p >= 70) return 4;
  if (p >= 50) return 3;
  if (p >= 30) return 2;
  return p > 0 ? 1 : 0;
}

/** My Progress: 80 / 60 / 40 / 20 — a full 10 points lower at every rung. */
export function progressStars(percent) {
  const p = Number(percent) || 0;
  if (p >= 80) return 5;
  if (p >= 60) return 4;
  if (p >= 40) return 3;
  if (p >= 20) return 2;
  return p > 0 ? 1 : 0;
}

/**
 * The syllabus percentage.
 *
 * ── THE FIELD IS `overallCompletionPercent` ─────────────────────────────────
 * `/api/students/syllabus-completion` returns `overallCompletionPercent`. This screen read
 * `completionPercent`, which that payload does not contain, so the value ALWAYS fell through to the
 * spine's coarser `academicIQ.syllabusCompletionPercent` and the dedicated endpoint bought nothing.
 * Third wrong-field-name bug in this programme, after Practice Zone's `difficulty` and the adaptive
 * runner's `options`.
 */
export function syllabusPercent(syllabusPart, academicIQ) {
  const live = syllabusPart?.overallCompletionPercent;
  return Number.isFinite(live) ? live : academicIQ?.syllabusCompletionPercent || 0;
}

export function progressPercent(progressPart, academicIQ) {
  const live = progressPart?.progressPercent;
  return Number.isFinite(live) ? live : academicIQ?.progressPercent || 0;
}

/* ── Learning gaps ─────────────────────────────────────────────────────────── */

/**
 * The four levels, their colours and their template lines.
 *
 * Derived from `REFLECTION_OPTIONS` rather than retyped: those are the same four levels, with the
 * same colours and the same sentences, already verified verbatim against the web when My Reflection
 * was ported. Two copies of four student-facing strings is exactly how the three Bloom's remark
 * tables drifted apart.
 */
export const GAP_LEVELS = REFLECTION_OPTIONS.map((o) => ({
  key: o.level,
  label: o.level,
  color: o.color,
  template: o.description,
}));

/* ── Competitive exam ──────────────────────────────────────────────────────── */

/**
 * Completed %, with the web's full fallback chain:
 *   the selected exam's own completionPercent
 *     → the server's overall completedPercent
 *       → the sum-of-tabs ratio
 *         → 0
 *
 * The third step matters: a server that returns no overall figure still has per-exam topic counts,
 * and dropping straight to 0 would tell a student who has completed half their syllabus that they
 * have done nothing.
 */
export function completedPercentOf(ce, selectedTab) {
  if (Number.isFinite(selectedTab?.completionPercent)) {
    return Math.round(selectedTab.completionPercent);
  }
  if (Number.isFinite(ce?.completedPercent)) return Math.round(ce.completedPercent);

  const tabs = ce?.examTabs || ce?.tabs || [];
  const total = tabs.reduce((s, t) => s + (t.totalTopics || 0), 0);
  const done = tabs.reduce((s, t) => s + (t.completedTopics || 0), 0);
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

/** A mock counts as attempted only when it is not GREY AND carries a score. */
export const attemptedMocks = (tab) =>
  (tab?.mockTestSubjects || [])
    .flatMap((s) => s.mockTests || [])
    .filter((m) => m.status !== 'GREY' && m.scorePercent != null);

/**
 * My Progress %.
 *
 * When an exam is selected this is **recomputed on the client** as the mean score of that exam's
 * attempted mocks — the server's `myProgressPercent` is an all-exams figure and would not change
 * when the student filters. With no exam selected, or none attempted, the server's value stands
 * (and may be null, which the caller renders as an em dash rather than 0%).
 */
export function progressPercentOf(ce, selectedTab) {
  const mocks = selectedTab ? attemptedMocks(selectedTab) : [];
  if (selectedTab && mocks.length > 0) {
    return Math.round(mocks.reduce((s, m) => s + (m.scorePercent || 0), 0) / mocks.length);
  }
  return ce?.myProgressPercent ?? null;
}

/** The three weakest attempted mocks — the selected exam's, or the server's precomputed list. */
export function weakMocksOf(ce, selectedTab) {
  const mocks = selectedTab ? attemptedMocks(selectedTab) : [];
  if (selectedTab && mocks.length > 0) {
    // Copy before sorting: the caller's array is the session's data, not scratch space.
    return [...mocks].sort((a, b) => (a.scorePercent || 0) - (b.scorePercent || 0)).slice(0, 3);
  }
  return ce?.bottomThreeMockTests || [];
}

/** Verbatim from the web. Note the comma in "Top 1,000" and the British "Practising". */
export function getProgressRemark(pct) {
  if (pct >= 95) return 'Exceptional! You are on track for a Top 100 rank in India.';
  if (pct >= 90) return 'Excellent! Keep pushing towards a Top 1,000 rank in India.';
  if (pct >= 85) return 'Very Good! With consistent practice, you can achieve an even higher rank.';
  if (pct >= 80) return 'Good Progress! Focus on accuracy and regular revision to improve further.';
  if (pct >= 70) return 'Keep Improving! More practice will help you unlock your full potential.';
  return 'Keep Practising! Consistent effort will show results soon.';
}

/** Shown when there is no progress figure at all. */
export const NO_PROGRESS_REMARK =
  'Complete some practice or mock tests to see your progress score.';

/** GREEN ≥80% · RED <80% · GREY not attempted. Anything unrecognised is GREY, as on the web. */
export function mockStatusStyle(status) {
  switch (String(status || 'GREY').toUpperCase()) {
    case 'GREEN':
      return { bg: '#e8f5e9', border: '#4caf50', fg: '#2e7d32' };
    case 'RED':
      return { bg: '#ffebee', border: '#f44336', fg: '#c62828' };
    default:
      return { bg: '#f5f5f5', border: '#bdbdbd', fg: '#616161' };
  }
}

/* ── Syllabus / progress trees ─────────────────────────────────────────────── */

/**
 * Subject and chapter nodes colour by a three-state `status`; a TOPIC uses the plain `completed`
 * boolean instead. Mixing those up is easy and looks right — a topic has no `status` field, so
 * reading one would make every topic render as "not started".
 */
export function statusStyle(status) {
  switch (String(status || '').toUpperCase()) {
    case 'COMPLETED':
      return { bg: '#e8f5e9', fg: '#2e7d32', bar: '#4caf50' };
    case 'IN_PROGRESS':
      return { bg: '#fff3e0', fg: '#e65100', bar: '#ff9800' };
    default:
      return { bg: '#f5f5f5', fg: '#9e9e9e', bar: '#e0e0e0' };
  }
}

/** `reflectedByStudent ? ✅ : coveredByTeacher ? 📖 : ⬜` — the precedence is the web's. */
export function progressTopicIcon(topic) {
  if (topic?.reflectedByStudent) return '✅';
  if (topic?.coveredByTeacher) return '📖';
  return '⬜';
}

/** The reflection-level pill colours, keyed by the level the student chose. */
export const REFLECTION_BADGE = {
  Proficient: '#4caf50',
  Progressing: '#ff9800',
  Developing: '#ffc107',
  Beginner: '#f44336',
};

export const PENDING_REFLECTION = 'Pending Reflection';
