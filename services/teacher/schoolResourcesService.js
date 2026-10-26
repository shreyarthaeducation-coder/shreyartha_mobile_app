/**
 * School Resources for teachers and vice principals — the website's TeacherSchoolResources
 * (22 Oct 2026): the e-book the school's students read, for the subjects this teacher is assigned
 * to, with the Lesson Plan and without the Handwritten Notes. Read-only; the admin writes it.
 */
import { staffApi } from '../staffApi';
import { fetchChapters } from './resourceService';

export { fetchChapters };

/** The sections a teacher reads, in the website's order (TEACHER_SECTIONS). */
export const TEACHER_SECTIONS = [
  { key: 'lessonPlan', label: 'Lesson Plan' },
  { key: 'topicExplanation', label: 'Topic Explanation', media: true },
  { key: 'realLifeRelevance', label: 'Real Life Relevance', media: true },
  { key: 'importanceForBoard', label: 'Importance for Board' },
  { key: 'difficultConcept', label: 'Difficult Concept', media: true },
  { key: 'labActivity', label: 'Lab Activity', media: true },
];

/** `GET /api/teacher/profile` — for `assignedClasses`. */
export function fetchTeacherProfile(signal) {
  return staffApi.get('/api/teacher/profile', { signal });
}

/** One topic's content: each section's HTML plus `<key>VideoUrl` / `ImageUrl` / `PdfUrl`. */
export function fetchTeacherTopicContent(topicId, signal) {
  return staffApi.get(`/api/teacher/academic/topics/${topicId}/content`, { signal });
}

/**
 * The assigned subjects linked to the syllabus, one each however many sections share it, sorted by
 * class then name — the website's `subjectsFrom`.
 */
export function subjectsFrom(assignedClasses) {
  const byId = new Map();
  (assignedClasses || []).forEach((a) => {
    if (!a?.academicIqSubjectId) return;
    const section = a.sectionName ? `${a.className} ${a.sectionName}` : a.className;
    const prev = byId.get(a.academicIqSubjectId);
    if (prev) {
      if (section && !prev.sections.includes(section)) prev.sections.push(section);
      return;
    }
    byId.set(a.academicIqSubjectId, {
      id: a.academicIqSubjectId,
      className: a.className || '',
      subjectName: a.subjectName || '',
      sections: section ? [section] : [],
    });
  });
  return [...byId.values()].sort(
    (x, y) =>
      x.className.localeCompare(y.className, undefined, { numeric: true }) || x.subjectName.localeCompare(y.subjectName),
  );
}

/** Assignments whose subject is not linked to the syllabus — there is nothing to show for them. */
export const unlinkedFrom = (assignedClasses) => [
  ...new Set(
    (assignedClasses || []).filter((a) => !a?.academicIqSubjectId).map((a) => `${a.className} · ${a.subjectName}`),
  ),
];

/** Whether a section has anything to show: text, or any of its media. */
export const sectionHasContent = (content, key) =>
  Boolean(
    content &&
      (content[key] || content[`${key}VideoUrl`] || content[`${key}ImageUrl`] || content[`${key}PdfUrl`]),
  );
