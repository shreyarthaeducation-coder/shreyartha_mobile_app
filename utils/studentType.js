// utils/studentType.js
// Source: frontendmain/src/services/authUtils.js — `isCollegeStudent` / `isSchoolStudent`.
//
// ── WHY THIS IS NOT READ FROM THE TOKEN ──────────────────────────────────────
// The web reads the JWT role (`ROLE_COLLEGE_STUDENT` / `ROLE_FREE_COLLEGE_STUDENT`). Mobile has no
// role claim decoded anywhere, and the app already derives this from the profile record in
// `components/student/profile/CareerTab.js` and `services/student/psychometricService.js`. Keeping
// one profile-based source of truth is better than adding a second, JWT-based one for a third
// screen — but it does mean **the profile must be loaded before you can ask**.
//
// ── WHY IT MATTERS BEYOND COSMETICS ──────────────────────────────────────────
// College students take a genuinely different branch in three places, not just a different label:
//
//   Coding Pro      no Class concept at all — take `curriculum.classes[0]` and skip grade matching.
//                   A SCHOOL student must NOT get that fallback: the web shows
//                   "No content found for your class (N)." instead. Applying the college fallback
//                   to everyone is what showed a Class 6 student the Class 9 syllabus.
//   Psychometric    skips class matching entirely and takes `fullTree[0]`.
//   Language Pro    Personalized Resources is hidden; "School Resources" reads "College Resources".

/**
 * Is this a college (rather than school) student?
 *
 * @param {object|null} studentProfile a `/api/students/profile` record
 * @returns {boolean} false when the profile is missing — an unknown student is treated as a school
 *          student, which is the SAFER default: it withholds content rather than showing the wrong
 *          class's content.
 */
export function isCollegeStudent(studentProfile) {
  return !!(studentProfile?.isCollegeStudent || studentProfile?.collegeName);
}

/** The inverse, spelled out so call sites read as intent rather than negation. */
export function isSchoolStudent(studentProfile) {
  return !isCollegeStudent(studentProfile);
}
