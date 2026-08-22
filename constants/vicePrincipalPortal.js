/**
 * The Vice Principal portal descriptor.
 *
 * THIS FILE DELIBERATELY CARRIES NO API PATHS, and that is the whole design.
 *
 * The web VP dashboard is the teacher panel wearing a different sidebar:
 * frontendmain/src/School/Vice_Principal/VicePrincipalDashboard.js imports nine
 * School/Teacher/pages/* components plus Shreya01LiveClasses and StaffMyCalendar **unchanged**,
 * and SecurityConfig's role hierarchy declares `.role("VICE_PRINCIPAL").implies("TEACHER")`, so
 * every `/api/teacher/**` guard already admits a VP.
 *
 * Every shared screen in components/staff/ already DEFAULTS to the teacher namespace and the
 * `classSection` scope. Restating `/api/teacher/attendance` here would create a second copy of
 * each path, free to drift from the one the teacher panel actually uses. So the descriptor says
 * only two things: which features this role has, and what shape its scope picker takes.
 *
 * See constants/staffScope.js for how the "no paths" part is expressed — resolveFeatureScope
 * returns `undefined` for apiBase on purpose, which lets each screen's own default fire.
 *
 * Contrast with the other two descriptors, which DO carry paths because their portals genuinely
 * live on different namespaces: counsellorPortals.js and shreya01TeacherPortal.js.
 */

export const VICE_PRINCIPAL = {
  key: 'vice_principal',
  label: 'Vice Principal',

  /** ScopePicker shape: academic year → class → section. Same as the teacher panel. */
  scope: 'classSection',

  /**
   * Exactly the features VicePrincipalSidebar.js exposes, using our feature keys.
   *
   * NOT here, and deliberately so — the VP has backend authority for all of these but the web
   * sidebar exposes none of them, and the standing rule is to mirror the website:
   *   adaptiveAssessment  TeacherPracticeQuestionController is hasAnyRole('TEACHER','VICE_PRINCIPAL')
   *   upskill             on the sidebar but `disabled: true`, with no route registered
   *   leave / payroll     StaffHrController names VICE_PRINCIPAL; only the profile's HR tab uses it
   *   counsellorReport    teacher-only sidebar item
   */
  features: ['attendance', 'counselling', 'groups', 'homework', 'syllabus', 'liveSchools'],
};

/** True for the VP route segment. Kept as a function to match getCounsellorPortal's shape. */
export function isVicePrincipal(role) {
  return String(role || '').toLowerCase() === VICE_PRINCIPAL.key;
}
