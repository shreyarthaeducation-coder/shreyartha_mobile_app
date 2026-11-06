// services/parent/testAnalysisService.js
//
// View Report's Test & Analysis tab (4 Nov 2026) — the website's parent Test & Exam Analysis
// (frontendmain Parent/platform/pages/ParentTestAnalysis.js and ParentReportCard.js).
//
// Every endpoint resolves the child from the parent's own login; none takes a student id, so there
// is nothing to change to see another child. What a parent may see is decided on the server on
// every request: a test appears once its subject teacher shares it, the analysis carries only the
// parts that teacher chose (`shownParts`), and a report card appears once the school shares the
// class's cards with parents.

import { parentApi } from '../parentApi';

/** `{ studentName, schoolName, schoolLogo, tests: [StudentExamSummary] }` */
export const fetchSharedTests = (signal) => parentApi.get('/api/parent/test-analysis', { signal });

/** One test's Detailed Analysis, with the parts the teacher shared. */
export const fetchTestAnalysis = (examId) => parentApi.get(`/api/parent/test-analysis/exams/${examId}`);

/** `[{ id, yearLabel, current }]`, newest first — the years the child was in a class. */
export const fetchReportCardYears = (signal) => parentApi.get('/api/parent/report-card/years', { signal });

/** The child's report card for a year (the school's current year when none is given). */
export const fetchReportCard = (academicYearId, signal) =>
  parentApi.get('/api/parent/report-card', {
    params: academicYearId ? { academicYearId } : undefined,
    signal,
  });

/** "72%" for a test the child sat with marks entered; "Absent" / "Not marked yet" otherwise. */
export function testScore(test) {
  if (test?.status === 'ABSENT') return { text: 'Absent', percent: null };
  const got = Number(test?.marksObtained);
  const outOf = Number(test?.totalMarks);
  if (test?.marksObtained == null || !Number.isFinite(got) || !(outOf > 0)) {
    return { text: 'Not marked yet', percent: null };
  }
  const percent = Math.round((got / outOf) * 100);
  return { text: `${got}/${outOf} · ${percent}%`, percent };
}
