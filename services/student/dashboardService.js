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
 * A null `label` no longer means "hide the badge and show Upgrade instead" — the dashboard renders
 * the Upgrade button either way now, because a subscriber can still move up to a custom plan. Null
 * here means only "there is no pill to draw".
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

/**
 * The plan name shown under the profile photo.
 *
 * Deliberately NOT `planBadge().label`: that is null for a free student, because there is no pill
 * to draw for them. This line always says something, and for a free student "Free" is the true
 * answer — the whole point of putting the plan under the photo is that it is always visible.
 *
 * Falls back to `currentTier` when a tier exists but is neither custom nor premium, so an unknown
 * future tier reads as itself rather than being flattened to "Free".
 *
 * @returns {string} never empty
 */
export function planName(entitlements) {
  if (!entitlements) return 'Free';
  if (entitlements.activeCustomPlanName) return entitlements.activeCustomPlanName;
  const tier = String(entitlements.currentTier || '').trim();
  if (entitlements.hasActiveSubscription || tier.toUpperCase().includes('PREMIUM')) return 'Premium';
  if (!tier || tier.toUpperCase() === 'FREE') return 'Free';
  // Title-case an unrecognised tier ("SCHOOL" → "School") rather than shouting it at the user.
  return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
}
