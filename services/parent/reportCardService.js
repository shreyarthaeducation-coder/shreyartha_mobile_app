// services/parent/reportCardService.js
//
// The four headline figures on the parent dashboard's "My Child's Report" card.
//
// ══ THE DESIGN ASKS FOR FOUR PERCENTAGES. THREE OF THEM DO NOT EXIST. ═══════
// Every one of these was checked against the backend before it was written, and this file is where
// the findings live so nobody has to re-derive them:
//
//   Overall Performance   The design shows a letter grade ("A / Excellent"). **`letterGrade` has
//                         ZERO hits across the entire backend** — no A/B/C grading is computed
//                         anywhere. The nearest field, `StudentAnalyticsResponse.readinessIndex`,
//                         is a HARDCODED PLACEHOLDER: its own DTO javadoc records that every
//                         student in the system reads Academic "High" / Competitive "Medium".
//                         `StudentAnalyticsSummary` deliberately excludes it for that reason, and
//                         so does this. It is returned as `{ soon: true }`.
//
//   Attendance            REAL, but **one month only**. `/attendance/calendar` requires a year and
//                         a month and returns raw per-day statuses; there is no aggregate endpoint,
//                         and no term concept to aggregate over. Reported with an explicit
//                         "This month" note so it is never mistaken for an all-time figure, and
//                         omitted entirely when the month has no marked days — 0 % because nobody
//                         has taken a register yet is a different statement from 0 % attended.
//
//   Assignments           REAL as a **COUNT, never a percentage**. `/learning-activities` returns
//                         the assigned homework; a parent cannot see submission state at all
//                         (`HomeworkSubmission` is exposed only through the STUDENT controller), so
//                         any "% complete" would be invented. "12 set" is true; "85 % done" is not.
//
//   Assessments           REAL. `/psychometric` gives `completedCount` / `totalTopics`. Shown as
//                         "8 of 10" rather than converted to a percentage — it is a questionnaire
//                         completion count, not a score, and a percent sign would imply marks.
//
// Real exam marks (`ExamResult.marksObtained`) exist but live behind `/api/school-admin/reports`
// and `/api/teacher/reports`. `Exam.visibleToParents` is set by admins and **read by no parent code
// path anywhere** — the feature is scaffolded and its parent half was never built. Do not reach for
// it here.

import { parentApi } from '../parentApi';
import { summariseAttendance } from './calendarService';

/**
 * Everything the report card needs, fanned out and independently guarded.
 *
 * `settleAll`, never `Promise.all`: `/psychometric` and `/learning-activities` can each fail for a
 * child with no school linkage, and one refusal must cost one figure rather than the whole card.
 *
 * @param {Date} [now] injectable for tests — the attendance call needs a concrete year and month
 */
export async function loadReportFigures(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  return parentApi.settleAll({
    attendance: parentApi.get('/api/parent/dashboard/attendance/calendar', {
      params: { year, month },
    }),
    activities: parentApi.get('/api/parent/dashboard/learning-activities'),
    psychometric: parentApi.get('/api/parent/dashboard/psychometric'),
  });
}

/** A `settleAll` entry, defensively. */
const part = (parts, key) => parts?.[key] || { data: null, error: null, forbidden: false };

/**
 * The four stat tiles, in the design's order.
 *
 * A figure whose call FAILED is returned as `{ soon: true }` rather than as a zero — "we could not
 * read this" and "this is zero" are different claims, and showing the second when the first is true
 * tells a parent something false about their child.
 *
 * @returns {Array<{key,label,value?,note?,soon?}>}
 */
export function reportStats(parts, strings = {}) {
  const stats = [];

  // 1. Overall Performance — permanently absent. See the header.
  stats.push({ key: 'overall', label: strings.statOverall || 'Overall', soon: true });

  // 2. Attendance — this month, from real per-day statuses.
  const attendance = part(parts, 'attendance').data;
  const summary = attendance ? summariseAttendance(attendance) : null;
  if (summary && summary.marked > 0) {
    stats.push({
      key: 'attendance',
      label: strings.statAttendance || 'Attendance',
      value: `${Math.round((summary.present / summary.marked) * 100)}%`,
      note: strings.thisMonth || 'This month',
    });
  } else {
    stats.push({ key: 'attendance', label: strings.statAttendance || 'Attendance', soon: true });
  }

  // 3. Homework — a COUNT. There is no submission state for a parent to turn into a percentage.
  const activities = part(parts, 'activities').data;
  const homework = Array.isArray(activities?.homework) ? activities.homework : null;
  if (homework) {
    stats.push({
      key: 'homework',
      label: strings.statHomework || 'Homework',
      value: String(homework.length),
      note: strings.setSoFar || 'Set so far',
    });
  } else {
    stats.push({ key: 'homework', label: strings.statHomework || 'Homework', soon: true });
  }

  // 4. Psychometric — completion, not a score.
  const psych = part(parts, 'psychometric').data;
  if (psych && Number.isFinite(Number(psych.totalTopics)) && Number(psych.totalTopics) > 0) {
    stats.push({
      key: 'psychometric',
      label: strings.statPsychometric || 'Psychometric',
      value: `${Number(psych.completedCount) || 0}/${Number(psych.totalTopics)}`,
      note: strings.completed || 'Completed',
    });
  } else {
    stats.push({ key: 'psychometric', label: strings.statPsychometric || 'Psychometric', soon: true });
  }

  return stats;
}
