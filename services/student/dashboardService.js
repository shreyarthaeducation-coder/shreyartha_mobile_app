// services/student/dashboardService.js
// Mirrors: frontendmain/src/student/platform/dashboard.js
//
// NOTE THE SPELLINGS — both namespaces are real and neither is a typo. See the header of
// services/studentApi.js. Everything here is `/api/students/` (plural) EXCEPT the entitlements
// call, which lives under `/api/me/`.

import { studentApi } from '../studentApi';

/**
 * The student's own record. Drives the welcome name and, via `schoolId`, the school badge.
 *
 * @returns {Promise<{ fullName, name, email, schoolId, ... }>}
 */
export function fetchStudentProfile(signal) {
  return studentApi.get('/api/students/profile', { signal });
}

/** School name + logo for the dashboard badge. Only meaningful when `profile.schoolId` is set. */
export function fetchSchoolInfo(schoolId, signal) {
  return studentApi.get(`/api/students/school-info/${schoolId}`, { signal });
}

/**
 * Plan state for the badge.
 *
 * `MyEntitlementsResponse` = `{ currentTier, hasActiveSubscription, features, activeCustomPlanName,
 * counsellingTotalAllowed, counsellingUsed }`. The DTO's own javadoc says to **prefer
 * `activeCustomPlanName` over `currentTier` for display**, which is what the web dashboard does.
 *
 * This is display only. Real gating is server-side, so never use `features` to hide a whole
 * screen — let the request 403 and show the server's message.
 */
export function fetchEntitlements(signal) {
  return studentApi.get('/api/me/entitlements', { signal });
}

/**
 * What the badge should say: a custom plan name, "Premium", or nothing (meaning "show Upgrade").
 *
 * @returns {{ label: string|null, premium: boolean }}
 */
export function planBadge(entitlements) {
  if (!entitlements) return { label: null, premium: false };
  if (entitlements.activeCustomPlanName) {
    return { label: entitlements.activeCustomPlanName, premium: false };
  }
  const tier = String(entitlements.currentTier || '').toUpperCase();
  const premium = entitlements.hasActiveSubscription || tier.includes('PREMIUM');
  return { label: premium ? 'Premium' : null, premium };
}
