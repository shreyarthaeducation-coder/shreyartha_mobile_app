// services/student/welcomeService.js
// Feeds components/student/WelcomeScreen.js — the once-per-session welcome interstitial.
//
// ── WHY THIS IS NOT `analyticsService.loadAnalytics()` ───────────────────────
// That loader is 10 round trips and FOUR of them buy this screen nothing: `iqHistory`,
// `learningGaps`, `skillsProfile` and `psychResults` feed sections the welcome screen does not
// render. Calling it here would put six unused requests in front of a student on every cold start.
// The readers below (`codingStreams`, `competitiveOf`) ARE reused, so the fallback rules stay in
// one place.
//
// ── EVERY NUMBER ON THIS SCREEN IS REAL ─────────────────────────────────────
// `GET /api/students/analytics` carries hardcoded placeholders that are identical for every student
// on the platform — `codingPro` (AI 80 / Robotics 60 / Coding 75), `readinessIndex`
// (High/Medium/High/High) and `academicIQ.learningGapsCount = 3`, all marked "placeholder" in
// `StudentAnalyticsService.java`. None of them may become a bar here. Coding Pro is therefore taken
// from the live `/api/coding/topics/progress` and **dropped entirely when that call fails**, rather
// than falling back to the spine's fiction the way My Analytics does.
//
// Two sections cannot be bars at all and must not be invented:
//
//   Language Lab   has NO percentage anywhere in the API — only
//                  `languageLab.skillLevels {Listening, Speaking, Reading, Writing}` with values
//                  Beginner / Average / Proficient / Not Set, and no endpoint of its own. Mapping
//                  those onto 33/66/100 would be a number no server ever computed. It is rendered
//                  as level chips instead — see `languageSkills()`.
//   Psychometric   `GET /api/psychometrics/results` DOES NOT EXIST. `psychometric/controller/`
//                  serves only /tree, /topics/{id}/questions and /submit; the student cannot read
//                  their own results back at all. It returns as a bar when that endpoint is added.

import { studentApi } from '../studentApi';
import { fetchAnalytics, codingStreams, competitiveOf } from './analyticsService';

/** Where each bar sends the student when tapped. */
const ROUTES = {
  syllabus: '/student/academic-iq',
  progress: '/student/academic-iq',
  competitive: '/student/competitive-exam',
  skills: '/student/skills-edge',
  coding: '/student/coding-pro',
};

/**
 * The spine, then five guarded enrichments — not ten.
 *
 * The spine is awaited alone because it carries the Academic IQ fallbacks and the Language Lab
 * levels. Everything after it goes through `settleAll`, so a free student's expected 403 costs one
 * bar rather than the whole graph.
 */
export async function loadWelcomeProgress() {
  let analytics = null;
  try {
    analytics = await fetchAnalytics();
  } catch {
    // Not fatal: the identity block comes from the profile the dashboard already has, and the
    // enrichments below can still produce bars on their own.
    analytics = null;
  }

  const parts = await studentApi.settleAll({
    syllabus: studentApi.get('/api/students/syllabus-completion'),
    progress: studentApi.get('/api/student/my-progress'),
    competitive: studentApi.get('/api/student/competitiveexam/analytics'),
    coding: studentApi.get('/api/coding/topics/progress'),
    skillsProgress: studentApi.get('/api/skillsedge/topics/progress'),
  });

  return { analytics, parts };
}

/** Mean of a list of percentages, rounded. `null` when there is nothing to average. */
function mean(values) {
  const nums = values.filter((v) => Number.isFinite(v));
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

/**
 * The bars, in display order.
 *
 * A section is OMITTED when its data did not arrive — never rendered as 0%. Those are different
 * statements: "you have completed none of this" versus "we could not read your progress", and
 * showing the first when the second is true tells a student their work has vanished.
 *
 * A section that genuinely has no work yet (no competitive exam chosen, no topics attempted) DOES
 * appear at 0% — that is a true statement about a section they can still open.
 *
 * @returns {Array<{ key, label, percent, route }>}
 */
export function sectionRows(analytics, parts) {
  const part = (k) => parts?.[k] || { data: null, error: null, forbidden: false };
  const rows = [];

  const academic = analytics?.academicIQ;

  // Academic IQ — the dedicated endpoints are more precise than the spine, but the spine is a
  // legitimate fallback for BOTH of these (unlike coding, whose spine value is fabricated).
  const syllabus = part('syllabus').data?.completionPercent ?? academic?.syllabusCompletionPercent;
  if (Number.isFinite(syllabus)) {
    rows.push({ key: 'syllabus', label: 'Syllabus Completion', percent: syllabus, route: ROUTES.syllabus });
  }

  const progress = part('progress').data?.progressPercent ?? academic?.progressPercent;
  if (Number.isFinite(progress)) {
    rows.push({ key: 'progress', label: 'My Progress', percent: progress, route: ROUTES.progress });
  }

  // Competitive Exam — `completedPercent` is 0 for a student who has not chosen an exam, which is
  // true and worth showing; the row is dropped only when the call itself failed.
  const competitive = competitiveOf(part('competitive').data) || analytics?.competitiveExam;
  if (competitive) {
    rows.push({
      key: 'competitive',
      label: 'Competitive Exam',
      percent: competitive.completedPercent || 0,
      route: ROUTES.competitive,
    });
  }

  // Skills Edge — an object keyed by topic name, each `{ percentage }`.
  const skills = part('skillsProgress').data;
  if (skills && typeof skills === 'object') {
    const avg = mean(
      Object.values(skills)
        .filter((v) => v && typeof v === 'object')
        .map((v) => Number(v.percentage)),
    );
    if (avg !== null) {
      rows.push({ key: 'skills', label: 'Skills Edge', percent: avg, route: ROUTES.skills });
    }
  }

  // Coding Pro — LIVE DATA ONLY. `codingStreams` falls back to the spine's placeholder when the
  // progress call fails, so the row is gated on the call having actually succeeded first.
  const codingData = part('coding').data;
  if (codingData) {
    const avg = mean(codingStreams(codingData, null).map((s) => Number(s.percent)));
    if (avg !== null) {
      rows.push({ key: 'coding', label: 'Coding Pro', percent: avg, route: ROUTES.coding });
    }
  }

  return rows;
}

/** The four Language Lab skills as LEVELS. There is no percentage to show — see the file header. */
export function languageSkills(analytics) {
  const levels = analytics?.languageLab?.skillLevels;
  if (!levels || typeof levels !== 'object') return [];
  return Object.entries(levels)
    .filter(([, level]) => level && level !== 'Not Set')
    .map(([skill, level]) => ({ skill, level: String(level) }));
}

/** "Class 6 · Science" from the profile the dashboard already holds. Either half may be missing. */
export function identitySubtitle(profile) {
  const parts = [];
  if (profile?.currentClass) parts.push(`Class ${profile.currentClass}`);
  if (profile?.stream) parts.push(profile.stream);
  return parts.join(' · ');
}
