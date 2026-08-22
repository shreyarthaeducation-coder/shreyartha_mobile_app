// services/student/profileService.js
// Mirrors: frontendmain/src/student/platform/profile.js (the tab shell)
//          + platform/profile/*.js (the eight tab forms)
//
// EIGHT tabs, each its own endpoint and its own record. The shell shows a completion dot per tab,
// computed from that tab's own response — see `tabComplete` below.
//
// SPELLINGS: `/api/students/` (plural) for the student record, career-preferences and the survey;
// `/api/education|university|academic|skills|additional/profile` (no student prefix at all) for
// the five sub-profiles. All three shapes are real. See the header of services/studentApi.js.
//
// SAVE SEMANTICS: the five sub-profiles are **POST when the record does not exist yet, PUT when it
// does** — the web decides by whether its GET returned anything. `saveProfileSection` carries that
// rule so no caller has to remember it. `/api/students/profile` is PUT-only (the record always
// exists, it is the student themselves).

import { studentApi } from '../studentApi';

/** Every tab's read endpoint, in the web's tab order. */
export const PROFILE_ENDPOINTS = {
  personal: '/api/students/profile',
  academic: '/api/academic/profile',
  education: '/api/education/profile',
  university: '/api/university/profile',
  skillsedge: '/api/skills/profile',
  additional: '/api/additional/profile',
  career: '/api/students/career-preferences',
  survey: '/api/students/survey/responses',
};

export function fetchProfileSection(key, signal) {
  return studentApi.get(PROFILE_ENDPOINTS[key], { signal });
}

/**
 * Save a sub-profile.
 *
 * @param {string} key       one of PROFILE_ENDPOINTS
 * @param {object} payload
 * @param {boolean} exists   whether the GET returned a record — decides POST vs PUT
 */
export function saveProfileSection(key, payload, exists) {
  const url = PROFILE_ENDPOINTS[key];
  // The student's own record always exists and only accepts PUT; career-preferences is POST-only.
  if (key === 'personal') return studentApi.put(url, payload);
  if (key === 'career') return studentApi.post(url, payload);
  return exists ? studentApi.put(url, payload) : studentApi.post(url, payload);
}

/**
 * Is this tab "done"? The web computes a different predicate per tab — these are its rules,
 * copied exactly, because they drive the completion dots students use to know what is left.
 */
export function tabComplete(key, data) {
  if (!data) return false;
  switch (key) {
    case 'personal':
      return !!(data.fullName && data.email);
    case 'academic':
      // THE FIELD IS `preparingCompetitiveExam`.
      //
      // Both clients tested `data.competitiveExam`, a property `AcademicIQResponse` does not have
      // (its fields are `preparingCompetitiveExam`, `competitiveExamId`, `competitiveExamName`).
      // So this dot could never light up — on the website either. The web's copy of the bug is
      // reported, not changed, at the user's request.
      return !!data.preparingCompetitiveExam;
    case 'education':
      return !!(data.class10School && data.class10Year && data.class10Percentage);
    case 'university':
      return !!(data.studyLocation && data.coursePref1 && data.whyThisCourse);
    case 'skillsedge':
      return Array.isArray(data.importantSkills) && data.importantSkills.length > 0;
    case 'additional':
      // The web's `anyTruthy` — this tab is optional, so any answer counts as engaged with.
      return Object.values(data).some((v) =>
        Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== '',
      );
    case 'survey':
      // Student Reflection. The web has no predicate for this because it has no such tab — the
      // questions live inside its Personal Details form. `/survey/responses` returns a
      // `{questionId: optionId}` map, so "done" is simply "has answered anything"; the submit is
      // one-shot and locks, so a non-empty map means it is finished, not in progress.
      //
      // Without this case it fell to `default: false` and the tab could never show its dot — which
      // mattered little when it was last, and is glaring now that it sits second.
      return Object.keys(data).length > 0;
    default:
      return false;
  }
}

/* ── Uploads ───────────────────────────────────────────────────────────────
   Multipart with a bare `file` part. The 415 trap from the staff panels does not apply here —
   these take a plain file, not a `@RequestPart("data")` JSON part — but the picker must still set
   `type`, or the backend cannot tell what it received. */

export function uploadProfilePicture(file) {
  return studentApi.multipart('/api/students/upload/profile-picture', { files: { file } });
}

/** Remove the picture. Nulls the column and deletes the S3 object server-side. */
export function removeProfilePicture() {
  return studentApi.del('/api/students/upload/profile-picture');
}

/** Remove the video. Same contract as the picture. */
export function removeProfileVideo() {
  return studentApi.del('/api/students/upload/profile-video');
}

/**
 * The intro video — a DIFFERENT endpoint and a DIFFERENT cap from the picture.
 *
 * Photo: `image/*`, 5 MB. Video: `video/*`, **50 MB**. Both mirror `StudentController`'s own
 * checks exactly, so the client refuses before uploading rather than after. `multipart` already
 * defaults to a 120-second timeout, which a 50 MB upload needs.
 */
export function uploadProfileVideo(file) {
  return studentApi.multipart('/api/students/upload/profile-video', { files: { file } });
}

/* ── Lookups ───────────────────────────────────────────────────────────────
   `fetchStates` / `fetchCountries` used to live here and now live in
   services/student/subjectCareerService.js, which owns the whole `/api/subjectcareer` namespace
   and normalises `stateName` / `countryName` (neither DTO has a `name`) at the boundary.

   They were removed rather than re-exported because the versions here were wrong twice over: they
   returned the raw DTOs, and they were wired into the University tab as a country → state pair
   that does not exist. The real cascade there is region → colleges, on
   `/api/subjectcareer/colleges/{india,abroad}`. See components/student/profile/UniversityTab.js. */
