// services/student/codingProService.js
// Mirrors: frontendmain/src/student/platform/CodingPro/{CodingPro,CodingProMyAssessment}.js
//
// ── THREE NAMESPACES ─────────────────────────────────────────────────────────
//   /api/coding/                  the content tree, topic content, completion  (BARE)
//   /api/student/coding/          the understanding assessment                 (SINGULAR)
//   /api/students/profile         the student's class name                     (PLURAL)
//
// Each copied from the web line that calls it. See the header of services/studentApi.js.
//
// NOT HERE: the Coding Arena (`/api/student/coding/arena/*`). It needs a code editor and Monaco is
// browser-only, so the Arena stays on the WebView for now — deliberately, not by omission.

import { studentApi } from '../studentApi';
import { findMatchedClass } from '../../utils/classMatch';
import { isCollegeStudent } from '../../utils/studentType';

/* ── Tree and content ──────────────────────────────────────────────────── */

/** Curriculums (streams) → classes → chapters → topics. */
export function fetchTree(signal) {
  return studentApi.get('/api/coding/tree', { signal }).then((r) => (Array.isArray(r) ? r : []));
}

/**
 * The student's class NAME plus whether they are a college student.
 *
 * Coding Pro has no `classId` to match on — unlike Academic IQ, which reads `curriculumId` and
 * `classId` straight off `/api/academic/profile`. Here the name is compared against the
 * curriculum's class names through `utils/classMatch`.
 *
 * **Both fields are needed, not just the name.** `isCollege` decides whether an unmatched class
 * falls back to the first class or refuses — see `resolveCodingClass` below.
 *
 * @returns {Promise<{className: string|null, isCollege: boolean}>}
 */
export async function fetchStudentClass(signal) {
  const profile = await studentApi.get('/api/students/profile', { signal });
  return {
    className: profile?.currentClass || profile?.class || null,
    isCollege: isCollegeStudent(profile),
  };
}

/**
 * Which class of a curriculum this student should see.
 *
 * ── THE FALLBACK IS COLLEGE-ONLY ─────────────────────────────────────────────
 * Verbatim from the web (`CodingPro.js:152-154`):
 *
 *     const cls = isCollegeStudent()
 *       ? (curriculum.classes || [])[0] || null
 *       : findMatchedClass(curriculum, studentClass);
 *
 * College students have no grade concept, so one unified set of content is correct for them.
 * A SCHOOL student whose class does not match gets `null`, and the web renders
 * "No content found for your class (N)." (`CodingPro.js:308-311`).
 *
 * This port previously applied the college fallback to everyone:
 *     findMatchedClass(c, studentClass) || (c.classes || [])[0] || null
 * so a Class 6 student whose class label did not match was silently shown whichever class the admin
 * published first — Class 9 in the reported case. Showing the wrong class's syllabus is far worse
 * than showing nothing, because nothing in the UI says the class is wrong.
 *
 * @returns {object|null} null means "tell the student we found nothing for their class"
 */
export function resolveCodingClass(curriculum, className, isCollege) {
  if (!curriculum) return null;
  if (isCollege) return (curriculum.classes || [])[0] || null;
  return findMatchedClass(curriculum, className);
}

/** The web's exact empty-state wording for an unmatched school class. */
export const noClassMatchMessage = (className) =>
  `No content found for your class (${className || 'unknown'}).`;

/** `{ lessonPlan, topicExplanation, realLifeRelevance }` — three tabs, not Academic IQ's six. */
export function fetchTopicContent(topicId, signal) {
  return studentApi.get(`/api/coding/topics/${topicId}/content`, { signal });
}

/** Toggles server-side; `{ completed }` comes back. */
export function toggleTopicComplete(topicId) {
  return studentApi.post(`/api/coding/topics/${topicId}/toggle-complete`);
}

/**
 * Completed topic ids — **scoped to one curriculum**, not global.
 *
 * `streamId` is the curriculum id. Switching curriculum has to re-read this; reusing the previous
 * curriculum's set would tick topics the student has not done.
 */
export async function fetchCompletedTopics(streamId, signal) {
  const res = await studentApi.get('/api/coding/topics/completed', {
    params: { streamId },
    signal,
  });
  const ids = Array.isArray(res) ? res : res?.completedTopicIds || [];
  return new Set(ids);
}

/** The three content tabs, labels verbatim. */
export const CONTENT_TABS = [
  { key: 'lessonPlan', label: 'Lesson Plan' },
  { key: 'topicExplanation', label: 'Topic Explanation' },
  { key: 'realLifeRelevance', label: 'Real Life Relevance' },
];

/* ── Assessment — SINGULAR `/api/student/coding/` ──────────────────────────
   Scored by the shared `scoreUnderstanding` (services/student/understandingScoring.js): identical
   marks / negativeMarks / floor-at-0 algorithm, letter `correctAnswer`. Only the Bloom's REMARK
   prose is specific to Coding Pro — see constants/codingProBlooms.js. */

export function fetchUnderstandingQuestions(topicId, signal) {
  return studentApi
    .get(`/api/student/coding/understanding/${topicId}/questions`, { signal })
    .then((r) => (Array.isArray(r) ? r : []));
}

/** The Arena's web route, opened through app/student/feature.js until it is ported. */
export const ARENA_WEB_PATH = '/student/platform/coding/practice';
