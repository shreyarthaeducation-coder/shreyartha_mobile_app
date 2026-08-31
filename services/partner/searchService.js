// services/partner/searchService.js
//
// Search for the partner panel — the third use of the shared matcher.
//
// ── NOTHING SERVER-SIDE, FOR ANY PORTAL ────────────────────────────────────
// There is no search mapping anywhere in the backend, over partner data or otherwise. Even the
// admin partner listing returns the whole table unfiltered and the web UI filters it in the browser.
// So this index is client-side, like the student's and the parent's, and the RANKING is shared
// (`services/shared/searchMatch.js`) so it cannot drift between panels.
//
// ── A PARTNER'S INDEX IS THE MOST SENSITIVE OF THE THREE ───────────────────
// It carries student names and per-subscription revenue. It is fingerprinted to the session AND its
// key is in `ALL_AUTH_KEYS` — the fingerprint stops a stale read, the key list is what makes the
// data go away on logout. On a shared device both matter.
//
// ── THE PARTNER API NEVER RETURNS SCHOOL NAMES ─────────────────────────────
// `PartnerAnalyticsService` does not inject `SchoolRepository`, so `linkedSchoolCodes` is a list of
// CODE strings and nothing more. The website's linked-schools page renders the raw codes too. A
// school row here is therefore its code, and searching for a school by name cannot work until an
// endpoint exposes one.

import AsyncStorage from '@react-native-async-storage/async-storage';
import partnerApi from '../partnerApi';
import { fingerprintOf } from '../shared/searchMatch';
import { PARTNER_SEARCH_INDEX_KEY } from '../../constants/storageKeys';
import { partnerMenuFor, PARTNER_HEADER_ACTIONS } from '../../constants/partnerMenu';

const CACHE_KEY = PARTNER_SEARCH_INDEX_KEY;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * The panel's own destinations.
 *
 * Built from `partnerMenuFor(tier)` rather than retyped. `checkpartner.mjs` §1 asserts those labels
 * verbatim against the live website sidebar, and a second hardcoded copy here would quietly
 * disagree with it the first time a label changed. Passing the tier also means a NORMAL partner
 * never gets a Linked Partners hit for a screen that would refuse them.
 */
function destinations(partnerType) {
  const rows = partnerMenuFor(partnerType)
    .filter((item) => item.native)
    .map((item) => ({ module: 'Sections', name: item.label, route: item.native }));

  // The T&C entry opens a sheet rather than a route, so it is indexed at the dashboard.
  PARTNER_HEADER_ACTIONS.forEach((action) => {
    rows.push({ module: 'Sections', name: action.label, route: '/partner' });
  });

  rows.push(
    { module: 'Your account', name: 'Change Password', route: '/partner/change-password' },
    { module: 'Your account', name: 'Dashboard', route: '/partner' },
  );

  return rows.map((r) => ({ ...r, trail: '', kind: 'screen' }));
}

/**
 * Build the index, or return the cached one.
 *
 * @param {string|null} partnerType the tier, so the destination list matches what they can open
 * @param {boolean} force skip the cache — used by pull-to-refresh
 */
export async function loadPartnerSearchIndex(partnerType, force = false) {
  let token = null;
  try {
    token = await AsyncStorage.getItem('partnerUserToken');
  } catch {
    // Treated as no session; the fingerprint differs and the cache simply misses.
  }
  const fingerprint = fingerprintOf(token);

  if (!force) {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (
          cached?.fingerprint === fingerprint &&
          cached.expiresAt > Date.now() &&
          Array.isArray(cached.rows)
        ) {
          return { rows: cached.rows, partial: cached.partial || [] };
        }
      }
    } catch {
      // A corrupt cache is a cache miss, never an error the partner sees.
    }
  }

  // `settleAll`, never `Promise.all`: `/analytics/monetization` can fail on its own and must cost
  // the student rows rather than the whole feature.
  const settled = await partnerApi.settleAll({
    profile: partnerApi.get('/api/partner/profile'),
    monetization: partnerApi.get('/api/partner/analytics/monetization'),
  });

  const rows = [];
  const partial = [];

  const profile = settled.profile?.data;
  if (profile) {
    (profile.linkedSchoolCodes || []).forEach((schoolCode) => {
      if (!schoolCode) return;
      rows.push({
        module: 'Your schools',
        name: String(schoolCode),
        // Codes only — the partner API never returns a school NAME. See the file header.
        trail: 'School code',
        route: '/partner/school-analytics',
        kind: 'content',
      });
    });
  } else {
    partial.push('Your schools');
  }

  const monetization = settled.monetization?.data;
  if (Array.isArray(monetization)) {
    // One row per SUBSCRIPTION, so a student who renewed appears twice. Deduped by student so the
    // results read as people rather than as transactions.
    const seen = new Set();
    monetization.forEach((row) => {
      const name = row?.studentName;
      if (!name || seen.has(String(row.studentId))) return;
      seen.add(String(row.studentId));
      rows.push({
        module: 'Your students',
        name: String(name),
        trail: [row.subscriptionType, row.partnerCode].filter(Boolean).join(' › '),
        route: '/partner/monetization',
        kind: 'content',
      });
    });
  } else {
    partial.push('Your students');
  }

  // Destinations go LAST. The matcher gives a screen a half-point edge so it wins a tie against
  // content of the same name; prepending them would let array order decide instead, which makes
  // that rule unobservable and free to rot. See services/shared/searchMatch.js.
  rows.push(...destinations(partnerType));

  try {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ fingerprint, expiresAt: Date.now() + CACHE_TTL_MS, rows, partial }),
    );
  } catch {
    // Storage full or unavailable — the index still works for this session.
  }

  return { rows, partial };
}

/** Drop the cached index. Called on logout with the rest of the session. */
export function clearPartnerSearchIndex() {
  return AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
}

export { searchIndex, groupResults } from '../shared/searchMatch';
