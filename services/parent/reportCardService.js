// services/parent/reportCardService.js
//
// The four headline figures on the parent dashboard's "My Child's Report" card.
//
// Each was checked against the backend before it was written:
//
//   Tests          REAL (4 Nov 2026). `/api/parent/test-analysis` lists the tests the child's
//                  subject teachers shared with parents, with the child's marks. Shown as the
//                  average percentage of those the child sat and has marks for. It replaced an
//                  "Overall" tile that could only ever say "Coming soon": no letter grade is
//                  computed anywhere, and `readinessIndex` is a hardcoded placeholder.
//
//   Attendance     REAL, but **one month only**. `/attendance/calendar` needs a year and a month and
//                  returns per-day statuses; there is no term aggregate. Labelled "This month", and a
//                  month with no register taken is a dash, not 0 %.
//
//   Homework       REAL as a **COUNT, never a percentage**. A parent cannot see submission state
//                  (`HomeworkSubmission` is exposed only to the student), so "85 % done" would be
//                  invented. "12 set" is true.
//
//   Psychometric   REAL. `/psychometric` gives `completedCount` / `totalTopics`, shown as "3/6", not a
//                  percentage of a score it isn't.

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
    // The tests the child's teachers shared with parents (4 Nov 2026) — the real marks behind the
    // first tile, which used to say "Coming soon".
    tests: parentApi.get('/api/parent/test-analysis'),
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
 * The average percentage of the shared tests the child sat and has marks for, and how many.
 * Absent, not-yet-marked and zero-mark-total tests are left out rather than counted as 0 %.
 */
export function testAverage(tests) {
  const marked = (Array.isArray(tests) ? tests : []).filter(
    (t) => t && t.status !== 'ABSENT' && Number.isFinite(Number(t.marksObtained)) && Number(t.totalMarks) > 0
      && t.marksObtained !== null,
  );
  if (marked.length === 0) return null;
  const sum = marked.reduce((acc, t) => acc + (Number(t.marksObtained) / Number(t.totalMarks)) * 100, 0);
  return { percent: Math.round(sum / marked.length), count: marked.length };
}

/**
 * The four stat tiles. Nothing here ever says "Coming soon" (4 Nov 2026): a figure is real, or it
 * is a dash with the plain reason — nothing to show yet, or the call failed. "We could not read
 * this" and "this is zero" are different claims, so neither is ever shown as a 0.
 *
 * @returns {Array<{key,label,value,note,empty?}>}
 */
export function reportStats(parts, strings = {}) {
  const stats = [];
  const unread = strings.couldNotLoad || "Couldn't load";
  const dash = (key, label, note) => ({ key, label, value: '—', note, empty: true });

  // 1. Tests — the average of the tests teachers shared with parents.
  const tests = part(parts, 'tests');
  const avg = tests.data ? testAverage(tests.data.tests) : null;
  const testsLabel = strings.statTests || 'Tests';
  if (avg) {
    stats.push({
      key: 'tests',
      label: testsLabel,
      value: `${avg.percent}%`,
      note: avg.count === 1 ? strings.oneTest || 'Average of 1 test' : `${strings.averageOf || 'Average of'} ${avg.count} ${strings.testsWord || 'tests'}`,
    });
  } else if (tests.data) {
    stats.push(dash('tests', testsLabel, strings.noTestsYet || 'No tests shared yet'));
  } else if (/not enrolled|no child is linked/i.test(String(tests.error || ''))) {
    // The server's own answer for an ordinary state (a 400 with these words), not a failure.
    stats.push(dash('tests', testsLabel, strings.notInClass || 'Not in a class this year'));
  } else {
    stats.push(dash('tests', testsLabel, unread));
  }

  // 2. Attendance — this month, from real per-day statuses.
  const attendance = part(parts, 'attendance');
  const summary = attendance.data ? summariseAttendance(attendance.data) : null;
  const attendanceLabel = strings.statAttendance || 'Attendance';
  if (summary && summary.marked > 0) {
    stats.push({
      key: 'attendance',
      label: attendanceLabel,
      value: `${Math.round((summary.present / summary.marked) * 100)}%`,
      note: strings.thisMonth || 'This month',
    });
  } else {
    stats.push(dash('attendance', attendanceLabel, attendance.data ? strings.notMarked || 'Not marked this month' : unread));
  }

  // 3. Homework — a COUNT. There is no submission state for a parent to turn into a percentage.
  const activities = part(parts, 'activities').data;
  const homework = Array.isArray(activities?.homework) ? activities.homework : null;
  const homeworkLabel = strings.statHomework || 'Homework';
  if (homework) {
    stats.push({
      key: 'homework',
      label: homeworkLabel,
      value: String(homework.length),
      note: strings.setSoFar || 'Set so far',
    });
  } else {
    stats.push(dash('homework', homeworkLabel, unread));
  }

  // 4. Psychometric — completion, not a score.
  const psych = part(parts, 'psychometric').data;
  const psychLabel = strings.statPsychometric || 'Psychometric';
  if (psych && Number.isFinite(Number(psych.totalTopics)) && Number(psych.totalTopics) > 0) {
    stats.push({
      key: 'psychometric',
      label: psychLabel,
      value: `${Number(psych.completedCount) || 0}/${Number(psych.totalTopics)}`,
      note: strings.completed || 'Completed',
    });
  } else {
    stats.push(dash('psychometric', psychLabel, psych ? strings.notStarted || 'Not started' : unread));
  }

  return stats;
}
