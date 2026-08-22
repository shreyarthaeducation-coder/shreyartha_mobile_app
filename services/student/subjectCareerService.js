// services/student/subjectCareerService.js
// Mirrors: frontendmain/src/student/platform/SubjectCareer/SubjectCareer.js
//
// SUBJECT & CAREER HAS NO CONTENT TREE OF ITS OWN. It renders the student's **saved career
// preferences** — the same three priority slots the Profile → Career tab writes — and loads the
// admin's content for whichever one is tapped. A student with no saved preferences is not an
// error state: they are sent to their profile to pick some.
//
// Everything here is on `/api/subjectcareer/` (SubjectCareerStudentController), guarded for the
// five student roles + ADMIN. Note this is a THIRD spelling alongside `/api/student/` and
// `/api/students/` — see the header of services/studentApi.js.
//
// The preference list itself comes from `/api/students/career-preferences` via careerService.

import { studentApi } from '../studentApi';
import { shuffleArray } from '../../utils/shuffle';

const BASE = '/api/subjectcareer';

/**
 * The five content tabs, in the web's fixed priority order.
 *
 * This array IS the spec — `LO_TYPES_PRIORITY` in the web component. The labels double as the
 * switch keys there, so they are kept verbatim (including the spacing of
 * "About Courses/ Eligibility/ Future Job Options") and paired with a stable `key` for us.
 */
export const LO_TYPES = [
  { key: 'about', label: 'About Courses/ Eligibility/ Future Job Options', short: 'About' },
  { key: 'skillMatch', label: 'Skill Match Meter', short: 'Skill Match' },
  { key: 'india', label: 'Colleges in India', short: 'India' },
  { key: 'abroad', label: 'Colleges Abroad', short: 'Abroad' },
  { key: 'scholarship', label: 'Scholarship Details', short: 'Scholarships' },
];

/** The Skill Match answers and their weights. Order matters — it is the button order. */
export const SKILL_MATCH_OPTIONS = [
  { value: 'Yes', points: 2, icon: '✓' },
  { value: 'Maybe', points: 1, icon: '~' },
  { value: 'No', points: 0, icon: '✗' },
];

export const COLLEGE_TYPES = [
  { value: 'GOVERNMENT', label: 'Government' },
  { value: 'PRIVATE', label: 'Private' },
];

/* ── Lookups ───────────────────────────────────────────────────────────────
   NEITHER TAKES A PARAMETER. `/states` returns every state, not a country's states.

   The DTOs are `SubjectCareerState { id, stateName }` and `SubjectCareerCountry { id,
   countryName }` — there is **no `name` field on either**. Reading `.name` yields undefined, and
   in React Native an object reaching a <Text> child throws rather than degrading, so the label is
   normalised here once instead of at each call site. */

export async function fetchStates(signal) {
  const res = await studentApi.get(`${BASE}/states`, { signal });
  return (Array.isArray(res) ? res : []).map((s) => ({ id: s.id, name: s.stateName }));
}

export async function fetchCountries(signal) {
  const res = await studentApi.get(`${BASE}/countries`, { signal });
  return (Array.isArray(res) ? res : []).map((c) => ({ id: c.id, name: c.countryName }));
}

/* ── Topic content ─────────────────────────────────────────────────────── */

/** `{ aboutCourses, aboutCoursesVideoUrl, aboutCoursesImageUrl, aboutCoursesPdfUrl }` */
export function fetchTopicContent(topicId, signal) {
  return studentApi.get(`${BASE}/topiccontent/${topicId}`, { signal });
}

/**
 * Skill Match questions, shuffled — the web shuffles on arrival, so the server order carries no
 * meaning and nothing downstream may rely on it.
 */
export async function fetchSkillMatchQuestions(topicId, signal) {
  const res = await studentApi.get(`${BASE}/topiccontent/${topicId}/questions`, { signal });
  return shuffleArray(Array.isArray(res) ? res : []);
}

/** `[{ id, scholarshipName, applyLink, videoUrl }]` */
export async function fetchScholarships(topicId, signal) {
  const res = await studentApi.get(`${BASE}/topiccontent/${topicId}/scholarships`, { signal });
  return Array.isArray(res) ? res : [];
}

/** `[{ id, collegeName, websiteLink, videoUrl }]` — India needs BOTH a state and a type. */
export async function fetchIndiaColleges(topicId, stateId, collegeType, signal) {
  const res = await studentApi.get(`${BASE}/topiccontent/${topicId}/colleges/india`, {
    params: { stateId, collegeType },
    signal,
  });
  return Array.isArray(res) ? res : [];
}

export async function fetchAbroadColleges(topicId, countryId, signal) {
  const res = await studentApi.get(`${BASE}/topiccontent/${topicId}/colleges/abroad`, {
    params: { countryId },
    signal,
  });
  return Array.isArray(res) ? res : [];
}

/* ── Colleges NOT scoped to a topic ────────────────────────────────────────
   A different pair of endpoints from the two above: every college an admin has added anywhere,
   rather than the ones attached to one career topic. The University profile tab uses these to
   populate its university pickers. Same query parameters, no `/topiccontent/{id}` segment. */

export async function fetchAllIndiaColleges(stateId, collegeType, signal) {
  const res = await studentApi.get(`${BASE}/colleges/india`, {
    params: { stateId, collegeType },
    signal,
  });
  return Array.isArray(res) ? res : [];
}

export async function fetchAllAbroadColleges(countryId, signal) {
  const res = await studentApi.get(`${BASE}/colleges/abroad`, { params: { countryId }, signal });
  return Array.isArray(res) ? res : [];
}

/* ── Skill Match scoring (client-side only) ────────────────────────────────
   THERE IS NO SUBMIT ENDPOINT. The web computes this locally and never persists it — leaving the
   tab loses the answers. Do not invent storage for it; a score that survives here but not on the
   website would be a difference the student notices. */

export function skillMatchScore(questions, answers) {
  const maxScore = (questions?.length || 0) * 2;
  let totalScore = 0;
  Object.values(answers || {}).forEach((answer) => {
    const opt = SKILL_MATCH_OPTIONS.find((o) => o.value === answer);
    totalScore += opt?.points || 0;
  });
  return {
    totalScore,
    maxScore,
    percentage: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
  };
}

/** The web's four verbatim result messages, at 80 / 60 / 40. */
export function skillMatchMessage(percentage) {
  if (percentage >= 80) return '🌟 Excellent! This career path seems like a great fit for you!';
  if (percentage >= 60) return '👍 Good match! You have potential in this field.';
  if (percentage >= 40) return '🤔 Moderate match. Consider exploring more about this career.';
  return '💡 This might not be the best fit. Explore other options too!';
}
