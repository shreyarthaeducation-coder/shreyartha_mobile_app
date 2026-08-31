// services/student/resourceService.js
// Mirrors: frontendmain/src/student/components/StudentResources/StudentResourcesModal.js
// Server:  backendmain/.../student/controller/StudentResourceController.java
//
// Teacher's Resources and Homework — two of the three controls the website floats over every
// `/student/platform/*` page. They were orphaned rather than dropped when the mobile panel went
// fully native: the web mounts them by route prefix, and no route in the app loads that prefix any
// more. See constants/studentMenu.js → STUDENT_TEACHER_LINKS.
//
// ── THESE ARE THE STUDENT'S ENDPOINTS, NOT THE TEACHER'S ────────────────────
// `/api/students/resources/*` is `@PreAuthorize` FREE_STUDENT / SCHOOL_STUDENT / PREMIUM_STUDENT.
// The teacher's own `/api/teacher/resources/*` returns the SAME DTO class
// (`TeacherResourceResponse`) from the same tables, so pointing a student screen at it fails on
// authorization and never on shape — which is the hardest kind of wrong path to notice. There is a
// second, upload-side teacher family too (`/api/teacher/student-analytics/personalised-resources`),
// already used by components/staff/StudentAnalyticsScreen.js through `staffApi`. Nothing here may
// touch either.
//
// COLLEGE STUDENTS GET A 403 on every call in this file. That is the server's rule, not an
// oversight, and the screens must render it as "not available on your account" rather than as an
// empty list. `StudentApiError.isForbidden` distinguishes it.
//
// ── TWO IDS, AND THEY ARE NOT INTERCHANGEABLE ──────────────────────────────
// A subject row carries BOTH `id` (the school's subject) and `academicIqSubjectId` (the curriculum
// subject it maps to). Chapters hang off the ACADEMIC id; homework and resources are scoped by the
// SCHOOL id. The web reads `selectedSubject.academicIqSubjectId` for chapters and
// `selectedSubject.id` for everything else, and a subject with no academic mapping is a real state
// it guards for. Swapping them returns an empty tree rather than an error.
//
// ── `subjectId` IS REQUIRED, AND OMITTING IT LOOKS LIKE "NOTHING HERE" ──────
// Three endpoints declare `@RequestParam Long subjectId` with no default. A missing one is a 400
// whose body is `{success:false, message}` — which studentApi surfaces — but a NULL one serialises
// out of the query string entirely and produces the same 400 with a message about a missing
// parameter, shown to a student as a failed screen. The callers below take it as a positional
// argument so it cannot be forgotten.

import { studentApi } from '../studentApi';

const BASE = '/api/students/resources';

/** The two tabs, in the web's order. `type` is what the server filters on internally. */
export const RESOURCE_TABS = [
  { key: 'resources', label: "Teacher's Resources" },
  { key: 'homework', label: 'Homework' },
];

/**
 * The student's subjects for their class and section.
 *
 * @returns {Promise<Array<{ id, name, academicIqSubjectId, ... }>>}
 */
export async function fetchSubjects(signal) {
  const res = await studentApi.get(`${BASE}/subjects`, { signal });
  return Array.isArray(res) ? res : [];
}

/**
 * Chapters (each with its topics) for a subject.
 *
 * Takes the ACADEMIC id — `subject.academicIqSubjectId`, not `subject.id`. See the header.
 * Returns `[]` for a subject that has no academic mapping rather than calling with `undefined`,
 * which would hit `/subjects/undefined/chapters` and 400.
 */
export async function fetchChapters(academicSubjectId, signal) {
  if (!academicSubjectId) return [];
  const res = await studentApi.get(`${BASE}/subjects/${academicSubjectId}/chapters`, { signal });
  return Array.isArray(res) ? res : [];
}

/**
 * Resources or homework for one topic.
 *
 * The resources path really is `/resources/resources/topic/{id}` — `BASE` already ends in
 * `/resources` and the controller's own mapping repeats it. It is not a typo.
 *
 * Homework comes back FILTERED by the server to the student's ability band plus anything with
 * `targetGroupLevel = null`; resources are unfiltered. Neither is filtered again here.
 *
 * @param {'resources'|'homework'} tab
 * @param {number} topicId
 * @param {number} subjectId  the SCHOOL subject id — required, see the header
 */
export async function fetchTopicItems(tab, topicId, subjectId, signal) {
  const segment = tab === 'homework' ? 'homework' : 'resources';
  const res = await studentApi.get(`${BASE}/${segment}/topic/${topicId}`, {
    params: { subjectId },
    signal,
  });
  return Array.isArray(res) ? res : [];
}

/** Every homework for a subject, across all topics — feeds the calendar. */
export async function fetchAllHomework(subjectId, signal) {
  const res = await studentApi.get(`${BASE}/homework/all`, { params: { subjectId }, signal });
  return Array.isArray(res) ? res : [];
}

/** This student's submission for one homework, or null when they have not turned it in. */
export function fetchSubmission(homeworkId, signal) {
  return studentApi.get(`${BASE}/homework/submission/${homeworkId}`, { signal });
}

/**
 * Turn in homework, with an optional file.
 *
 * `homeworkId` IS A `@RequestParam`, NOT A PART. It goes in the query string. `studentApi.multipart`
 * would happily append it as a form field via `fields`, and Spring's binding of a form field to a
 * `@RequestParam` on a multipart request is not the same code path as a query parameter — the query
 * string is the one both the web client and the controller's own signature agree on.
 *
 * The file part is named `file` and is genuinely optional: a student may submit a text-only
 * "done" with no attachment, which is what `required = false` on the `@RequestPart` allows.
 *
 * @param {number} homeworkId
 * @param {{uri, name, type}|null} file  from utils/filePicker — `type` must be set or the server
 *                                       cannot tell what it received
 */
export function submitHomework(homeworkId, file) {
  return studentApi.multipart(
    `${BASE}/homework/submit${buildIdQuery(homeworkId)}`,
    file ? { files: { file } } : {},
  );
}

/** Take a submission back. Path parameter, so no query string here. */
export function unsubmitHomework(homeworkId) {
  return studentApi.post(`${BASE}/homework/unsubmit/${homeworkId}`);
}

/**
 * `?homeworkId=…`, built here rather than through `studentApi`'s `params` option, because
 * `multipart` forwards `options` to `request` and mixing a params object with a FormData body is a
 * combination nothing else in the app exercises. One local literal is easier to be sure of.
 */
function buildIdQuery(homeworkId) {
  return `?homeworkId=${encodeURIComponent(homeworkId)}`;
}
