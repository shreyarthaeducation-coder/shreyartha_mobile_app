/**
 * Which endpoint family each staff role prints psychometric reports through
 * (backend PsychometricReportController). Import-free on purpose, so a checker can evaluate it.
 *
 * The teacher's own route (/teacher/psychometric-print) names /api/teacher directly; these are the
 * app/staff/[role] roles. A role missing here has no print screen.
 */
export const PSYCHOMETRIC_PRINT_API = Object.freeze({
  // VICE_PRINCIPAL implies TEACHER, and the VP reads the teacher's Counselling Report.
  vice_principal: '/api/teacher/psychometric-reports',
  counselor: '/api/counselor/psychometric-reports',
  // Across the counsellor's linked schools — the screen offers a school picker for them.
  shreyartha_councellor: '/api/counselor/psychometric-reports',
  principal: '/api/school-admin/psychometric-reports',
});

export function psychometricPrintApiBase(role) {
  return PSYCHOMETRIC_PRINT_API[String(role || '').toLowerCase()] || null;
}

/** The print screen's route for a role's home, e.g. `/staff/counselor` → `/staff/counselor/psychometric-print`. */
export const psychometricPrintRoute = (homeRoute) => `${homeRoute}/psychometric-print`;
