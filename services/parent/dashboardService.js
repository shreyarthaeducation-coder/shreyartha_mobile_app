// services/parent/dashboardService.js
// Mirrors: frontendmain/src/Parent/platform/pages/ParentHome.js
// Backend: parent/controller/ParentDashboardController.java — every handler is hasRole('PARENT')
//          and resolves the child from the JWT.
//
// This is the parent panel's identity read. The shell uses it for two things the web does not:
// the child's name and photo in the Welcome header, and a LIVE verification flag.
//
// WHY LIVE. The web reads `parentUserVerified` out of localStorage, written once at login and
// never refreshed, so an admin verifying an account mid-session leaves the parent locked out until
// they log in again. `LinkedStudentResponse` carries `parentVerified`, so we prefer that and fall
// back to the stored value only when the call fails.

import { parentApi } from '../parentApi';

/**
 * The linked child.
 *
 * @returns {Promise<{ studentId, fullName, email, profilePicture, currentClass, stream,
 *   section, schoolName, parentVerified }>}
 */
export function fetchLinkedStudent(signal) {
  return parentApi.get('/api/parent/dashboard/linked-student', { signal });
}

/**
 * "Class 9 · Science" from whichever fields exist.
 *
 * The web's ParentHome labels the second row "Stream" but falls back to `section` when there is no
 * stream — so a section letter can appear under a "Stream" heading. Here they are just joined,
 * which avoids mislabelling either.
 */
export function studentSubtitle(student) {
  if (!student) return '';
  const klass = student.currentClass ? `Class ${student.currentClass}` : '';
  return [klass, student.stream || student.section, student.schoolName]
    .filter(Boolean)
    .join(' · ');
}
