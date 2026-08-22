// services/student/careerService.js
// Mirrors: frontendmain/src/student/platform/profile/{CareerPreferences,SkillsEdge,StudentSurvey}.js
//
// The three profile tabs that are not static forms. Grouped here because each is small and they
// share nothing with the config-driven five.
//
// PATH SURPRISE, verified in the backend: the career cascade lives at **bare `/api`** —
// `SubjectandCareerPublicController` is `@RequestMapping("/api")` and serves `/api/curriculums`,
// `/api/curriculums/{id}/chapters` and `/api/chapters/{id}/topics`. There is no student prefix and
// no admin prefix. The similarly-named `/api/admin/academictree/curriculums` and
// `/api/school-admin/academic-iq/curriculums` are ADMIN and SCHOOL_ADMIN only — pointing the
// student cascade at either returns 403.

import { studentApi } from '../studentApi';
import { skillsProfileBody } from '../../constants/profileRules';

/* ── Career preferences: Curriculum → Chapter → Topic, three priority slots ── */

/** `scope` is "SCHOOL" or "COLLEGE", chosen from the student's own record. */
export async function fetchCurriculums(scope, signal) {
  const res = await studentApi.get('/api/curriculums', { params: { scope }, signal });
  return Array.isArray(res) ? res : [];
}

export async function fetchChapters(curriculumId, signal) {
  const res = await studentApi.get(`/api/curriculums/${curriculumId}/chapters`, { signal });
  return Array.isArray(res) ? res : [];
}

export async function fetchTopics(chapterId, signal) {
  const res = await studentApi.get(`/api/chapters/${chapterId}/topics`, { signal });
  return Array.isArray(res) ? res : [];
}

export async function fetchCareerPreferences(signal) {
  const res = await studentApi.get('/api/students/career-preferences', { signal });
  return Array.isArray(res) ? res : [];
}

/**
 * Save the preferences.
 *
 * A **bare array**, not an object — `[{ priority, curriculumId, chapterId, topicId }]`, priorities
 * 1-3, and **incomplete slots are dropped** rather than sent with nulls. POST-only; there is no PUT.
 */
export function saveCareerPreferences(slots) {
  const payload = slots
    .map((s, i) => ({
      priority: i + 1,
      curriculumId: s.curriculumId ? Number(s.curriculumId) : null,
      chapterId: s.chapterId ? Number(s.chapterId) : null,
      topicId: s.topicId ? Number(s.topicId) : null,
    }))
    .filter((p) => p.curriculumId && p.chapterId && p.topicId);
  return studentApi.post('/api/students/career-preferences', payload);
}

/* ── Skills Edge: importantSkills, sourced from the live tree ─────────────── */

/**
 * The Skills Edge content tree. Its top level is what the student picks from — the same tree the
 * teacher's Upskill port reads, so shapes are already known.
 */
export async function fetchSkillsTree(signal) {
  const res = await studentApi.get('/api/skillsedge/tree', { signal });
  return Array.isArray(res) ? res : [];
}

export async function fetchSkillsProfile(signal) {
  return studentApi.get('/api/skills/profile', { signal });
}

/** Same POST-if-new / PUT-if-exists rule as the other sub-profiles. */
/**
 * Save the Skills Edge profile.
 *
 * ── TAKES THE WHOLE PROFILE, NOT JUST THE SKILLS ────────────────────────────
 * This used to accept `importantSkills` alone and send `{ importantSkills }`. The endpoint REPLACES
 * the record rather than patching it, so every mobile save silently destroyed `selectedTopics`,
 * `englishCommunication` and `isRelatedToJob` — including values the student had set on the
 * website. No error, nothing on screen.
 *
 * The signature now demands the whole profile so a caller cannot omit a field by accident, and
 * `skillsProfileBody` fills every key explicitly.
 *
 * @param {object} profile {importantSkills, selectedTopics, englishCommunication, isRelatedToJob}
 */
export function saveSkillsProfile(profile, exists) {
  const body = skillsProfileBody(profile);
  return exists
    ? studentApi.put('/api/skills/profile', body)
    : studentApi.post('/api/skills/profile', body);
}

/* ── Student survey ──────────────────────────────────────────────────────── */

/**
 * The survey questions.
 *
 * Returns `List<SurveyCategoryResponse>` — **the very same DTO the counsellor's Wellness Groups
 * reads for its index columns**. This is the student-facing side of the survey whose results the
 * counsellor later sees as LOW/MODERATE/HIGH wellness bands, which is why the shapes match:
 * `{ id, name, indexName, shortCode, questions: [{ id, questionText, questionOrder,
 *    options: [{ id, optionText, marks, displayOrder }] }] }`
 * See services/counsellor/surveyService.js — do not re-derive it.
 */
export async function fetchSurveyQuestions(signal) {
  const res = await studentApi.get('/api/students/survey/questions', { signal });
  return Array.isArray(res) ? res : [];
}

/** Prior answers as `{ [questionId]: optionId }` — a bare map, not a list. */
export async function fetchSurveyResponses(signal) {
  const res = await studentApi.get('/api/students/survey/responses', { signal });
  return res && typeof res === 'object' ? res : {};
}

/** `{ responses: [{ questionId, selectedOptionId }] }`. The survey locks once submitted. */
export function submitSurvey(answers) {
  const responses = Object.entries(answers || {})
    .filter(([, optionId]) => optionId)
    .map(([questionId, optionId]) => ({
      questionId: Number(questionId),
      selectedOptionId: Number(optionId),
    }));
  return studentApi.post('/api/students/survey/submit', { responses });
}
