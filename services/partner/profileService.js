// services/partner/profileService.js
// The partner shell's identity call. One endpoint, fetched once by the layout.
//
// `GET /api/partner/profile` → PartnerProfileResponse:
//   { id, fullName, email, mobile, partnerCode, linkedSchoolCodes[], verified, partnerType,
//     masterPartnerUserId, masterPartnerName, masterPartnerCode,
//     termsAcceptedAt, termsVersion, masterUpgradedAt }
//
// The controller maps BOTH `/api/partner/profile` and `/api/partner/dashboard/profile` to the same
// handler, so the web's two-URL fallback buys nothing — one path is enough.
//
// THE WEB FETCHES THIS THREE TIMES on the dashboard route (PartnerLayout once, PartnerDashboard
// again, PartnerAnalytics reads what it needs separately). Here the shell fetches once and passes
// the result down.

import partnerApi from '../partnerApi';

/** @returns {Promise<object>} PartnerProfileResponse */
export function fetchProfile(signal) {
  return partnerApi.get('/api/partner/profile', { signal });
}

/**
 * The partner's tier, or **null when it is genuinely not known**.
 *
 * `PartnerLayout.js` does `profile?.partnerType || "NORMAL"`, so ANY fetch failure — a dropped
 * connection, a 500 — silently demotes a Master and removes their Linked Partners tab until the
 * next reload. Returning null instead lets the caller keep its last good value and show the tile
 * again the moment a profile lands. Nothing is unsafe about guessing wrong in either direction:
 * the endpoint refuses a NORMAL caller server-side regardless.
 */
export function partnerTypeOf(profile) {
  const type = profile?.partnerType;
  return typeof type === 'string' && type.trim() ? type.trim().toUpperCase() : null;
}

/**
 * Whether the account is verified, as the SERVER currently sees it.
 *
 * `UNVERIFIED_PARTNER` is granted nothing — no `@PreAuthorize` anywhere names it, and all five
 * partner controllers require `hasRole('PARTNER')` — so this must be settled before the panel
 * fetches anything, or an unverified partner gets a screen of errors instead of the pending page.
 *
 * Returns null when unknown, so a caller can fall back to what login stored rather than locking
 * someone out over a flaky network.
 */
export function verifiedOf(profile) {
  if (profile?.verified == null) return null;
  return !!profile.verified;
}

/** The header line under the partner's name: their referral code, which is the portal's identity. */
export function partnerSubtitle(profile) {
  const code = profile?.partnerCode || profile?.code;
  const schools = profile?.linkedSchoolCodes?.length || 0;
  const parts = [];
  if (code) parts.push(`Code ${code}`);
  if (schools) parts.push(`${schools} linked school${schools === 1 ? '' : 's'}`);
  return parts.join(' · ');
}
