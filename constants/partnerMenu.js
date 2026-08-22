/**
 * The partner dashboard menu.
 *
 * Labels and order mirror the web sidebar verbatim
 * (frontendmain/src/Partner/platform/PartnerLayout.js → BASE_SIDEBAR_ITEMS), with one deliberate
 * removal documented below.
 *
 * Item shape matches constants/parentMenu.js and constants/studentMenu.js:
 *   { key, label, icon, native?, path? }
 *     native — an in-app route; rendered as a native screen
 *     path   — a web path opened through a WebView with the session injected
 *
 * ── "USER ACCESS" IS DELIBERATELY ABSENT ─────────────────────────────────────
 * `PartnerUserAccess.js` is 215 lines of hardcoded demo logins — usernames AND plaintext passwords —
 * under the comment "Placeholder demo logins — swap these for the real accounts before go-live".
 * It calls no API; the credentials are the page.
 *
 * A web page serves those on request and stops the moment someone edits the file. An app bundle
 * ships them to every device that installs it and keeps them in APKs no deploy can reach. That is a
 * materially different exposure for identical content, so the tile is not ported. Seven tiles here
 * plus the master-only tile below equals the web's eight sidebar items minus this one.
 *
 * ── "UPGRADE TO MASTER" IS ABSENT BECAUSE THE WEB HIDES IT TOO ───────────────
 * `PartnerUpgradeToMaster` is route-live but its sidebar entry is commented out, so the ₹1,00,000
 * Razorpay upgrade is unreachable on the website today. Mirroring that keeps the app free of a
 * payment surface — and therefore of a native payment SDK.
 */

const PARTNER_BASE = '/partner/platform/dashboard';

/**
 * Shown to every verified partner, MASTER or NORMAL.
 *
 * `native` is the in-app route and always exists. `web` is the same page on the website, and is
 * what that route's screen renders through `PartnerFeatureScreen` until its phase lands — so a
 * partner is never shown a tile that goes nowhere, and the menu never has to change as phases ship.
 * A tile is finished when its route file stops importing PartnerFeatureScreen; `web` stays for the
 * checker to keep verifying the path against the website's own router.
 */
export const PARTNER_MENU = [
  { key: 'overview', label: 'Dashboard', icon: 'home-outline', native: '/partner/overview', web: PARTNER_BASE },
  { key: 'school-analytics', label: 'School Analytics', icon: 'bar-chart-outline', native: '/partner/school-analytics', web: `${PARTNER_BASE}/school-analytics` },
  { key: 'monetization', label: 'Monetization', icon: 'cash-outline', native: '/partner/monetization', web: `${PARTNER_BASE}/monetization` },
  { key: 'plans', label: 'Plans for Students', icon: 'list-outline', native: '/partner/plans', web: `${PARTNER_BASE}/plans` },
  { key: 'school-plans', label: 'Plans for Schools', icon: 'business-outline', native: '/partner/school-plans', web: `${PARTNER_BASE}/school-plans` },
  { key: 'bank-info', label: 'Bank Information', icon: 'card-outline', native: '/partner/bank-info', web: `${PARTNER_BASE}/bank-info` },
];

/**
 * Appended only for `partnerType === 'MASTER'`.
 *
 * The gate is cosmetic, not a security boundary — `GET /api/partner/analytics/linked-partners`
 * refuses a NORMAL caller server-side. Note it refuses with **HTTP 400, not 403**
 * (`IllegalStateException` → `{success:false, message}`), so any screen reaching it must read
 * `message` rather than switch on the status.
 */
export const PARTNER_MASTER_MENU = [
  { key: 'linked-partners', label: 'Linked Partners', icon: 'people-outline', native: '/partner/linked-partners', web: `${PARTNER_BASE}/linked-partners` },
];

/** Every tile, tier ignored — what the route files and the checker enumerate over. */
export const ALL_PARTNER_TILES = [...PARTNER_MENU, ...PARTNER_MASTER_MENU];

/** The website path behind one tile key, used by the not-yet-native route screens. */
export function partnerWebPath(key) {
  return ALL_PARTNER_TILES.find((i) => i.key === key)?.web || PARTNER_BASE;
}

/**
 * The tiles a partner should see, given their tier.
 *
 * `partnerType` may legitimately be **unknown** (null) — the profile call failed and we have no
 * cached value. The web treats that as NORMAL, which silently drops the tab for a Master on a
 * network blip; here unknown simply means "not yet known to be MASTER", and the tile appears as
 * soon as a profile lands. See services/partner/profileService.js.
 */
export function partnerMenuFor(partnerType) {
  return partnerType === 'MASTER' ? [...PARTNER_MENU, ...PARTNER_MASTER_MENU] : [...PARTNER_MENU];
}

/**
 * The web renders these in the dashboard header rather than the sidebar.
 *
 * `PartnerLayout` has a "Terms & Conditions" header button that opens the same T&C the signup gate
 * shows. It is not a route — it opens a sheet — so it carries `sheet` instead of `native`/`path`.
 */
export const PARTNER_HEADER_ACTIONS = [
  { key: 'terms', label: 'Terms & Conditions', icon: 'document-text-outline', sheet: 'terms' },
];

export { PARTNER_BASE };
