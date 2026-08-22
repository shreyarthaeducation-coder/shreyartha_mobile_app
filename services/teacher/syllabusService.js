// services/teacher/syllabusService.js
// Mirrors: frontendmain/src/School/Teacher/pages/SyllabusCompletion.js
// Backend: teacher/controller/SyllabusCompletionController.java
//
// ONE CALL DOES EVERYTHING. The dashboard response carries the whole tree twice over:
//   classWiseCompletion[] → sectionWiseCompletion[] → subjectWiseCompletion[]   (the numbers)
//   classDetails[]        → sections[] → subjects[] → chapters[]                (the same numbers,
//                                                                               plus chapters)
// The web additionally calls `/subject?sectionId=&subjectId=` on every accordion expansion — but
// its own catch block falls back to reading `classDetails` locally, which proves the round trip is
// redundant. We skip it entirely: one fewer request per expansion, and one fewer failure mode
// (that endpoint 400s for a teacher whose TeacherClass assignment doesn't match exactly).

import { staffApi } from '../staffApi';

/** The three values `status` can hold. It is a plain String server-side, not an enum. */
export const SYLLABUS_STATUS = {
  COMPLETED: 'COMPLETED',
  IN_PROGRESS: 'IN_PROGRESS',
  NOT_COMPLETED: 'NOT_COMPLETED',
};

/**
 * The whole syllabus tree for the signed-in teacher.
 *
 * Takes no scope arguments — the backend resolves the teacher from the token and returns every
 * class they are assigned to.
 *
 * @returns {Promise<{
 *   totalTopics: number, completedTopics: number, inProgressTopics: number,
 *   notCompletedTopics: number, overallCompletionPercent: number,
 *   classWiseCompletion: Array<{ classId, className, totalTopics, completedTopics,
 *     inProgressTopics, notCompletedTopics, completionPercent, status,
 *     sectionWiseCompletion: Array<{ sectionId, sectionName, …, subjectWiseCompletion: [] }> }>,
 *   classDetails: Array<{ classId, className, sections: Array<{ sectionId, sectionName,
 *     subjects: Array<{ subjectId, subjectName, academicIqSubjectId, totalTopics, totalChapters,
 *       completedTopics, notCompletedTopics, completionPercent, status,
 *       chapters: Array<{ chapterId, chapterName, totalTopics, completedTopics,
 *         completionPercent, status }> }> }> }>
 * }>}
 */
export function fetchSyllabusCompletion(signal) {
  return staffApi.get('/api/teacher/syllabus-completion', { signal });
}

/**
 * Chapters for one subject, read out of the dashboard payload rather than re-fetched.
 *
 * `classDetails` is a parallel tree to `classWiseCompletion` — same ids, but it carries `chapters`.
 */
export function chaptersFor(data, classId, sectionId, subjectId) {
  const cls = (data?.classDetails || []).find((c) => c.classId === classId);
  const section = (cls?.sections || []).find((s) => s.sectionId === sectionId);
  const subject = (section?.subjects || []).find((s) => s.subjectId === subjectId);
  return subject?.chapters || [];
}

/**
 * `inProgressTopics` IS NOT A TOPIC COUNT — at every level it counts the *children* whose status is
 * IN_PROGRESS (classes at the root, sections within a class, subjects within a section). The web
 * shows it in a tile beside "Total Topics", comparing unlike things. Label it for what it is.
 */
export const IN_PROGRESS_LABEL = {
  root: 'Classes in progress',
  class: 'Sections in progress',
  section: 'Subjects in progress',
};

/* ── Shreyartha teacher (Portal B) ───────────────────────────────────────────────────────────
 *
 * Same response DTO as Portal A — `classWiseCompletion` + the parallel `classDetails` carrying
 * chapters — so every reader below works unchanged. Only the request differs: Portal A resolves
 * the teacher's whole assignment set from the token and takes no arguments, while Portal B is
 * **scoped to one school and one class** and must be told which.
 *
 * The sections it returns are SHREYA01 **virtual** sections: this hierarchy has no real section
 * tier, but the completion tree still nests one level there, and the web auto-selects the first.
 *
 * The `/completion/subject` sibling is skipped for the same reason it is skipped on Portal A — the
 * web's own catch block falls back to reading `classDetails` locally, which proves the round trip
 * is redundant.
 */
export function fetchShreya01SyllabusCompletion({ schoolId, classId }, signal) {
  return staffApi.get(`/api/shreya01/syllabuses/school/${schoolId}/class/${classId}/completion`, {
    signal,
  });
}
