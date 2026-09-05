// services/sales/salesService.js
// Mirrors: frontendmain/src/services/ApiServices.js (`salesApi`)
// Backend:  sales/controller/SalesController.java
//
// EVERY FAILURE FROM THIS CONTROLLER IS HTTP 400 with {success:false, message} — its handle()
// wrapper turns IllegalArgument/IllegalState into 400 and everything else into a generic 500.
// There is no 404 and no per-resource 403, so never branch on the status code here; read `message`.
//
// Built on staffApi, not apiService: a 403 is an ordinary renderable error there rather than a
// dead session, and the sales panel signs in with the school-staff token.

import { staffApi, buildQuery } from '../staffApi';

const BASE = '/api/staff/sales';

// ── Dashboard ───────────────────────────────────────────────────────────────

export function fetchDashboard(signal) {
  return staffApi.get(`${BASE}/dashboard`, { signal });
}

export function fetchProfile(signal) {
  return staffApi.get(`${BASE}/profile`, { signal });
}

// ── Tutorial ────────────────────────────────────────────────────────────────

/**
 * Whether to show the first-login walkthrough.
 *
 * The decision is the SERVER's, not the device's: a rep who was taught on the website must not be
 * taught again here. That is the whole reason this is an endpoint rather than an AsyncStorage key.
 */
export function fetchOnboarding(signal) {
  return staffApi.get(`${BASE}/onboarding`, { signal });
}

/** Records that the rep finished (`completed: true`) or skipped it. Skipping counts as seen. */
export function acknowledgeOnboarding(completed) {
  return staffApi.post(`${BASE}/onboarding/ack`, { completed: !!completed });
}

// ── LEAD ────────────────────────────────────────────────────────────────────

export function fetchLeads(signal) {
  return staffApi.get(`${BASE}/leads`, { signal });
}

export function fetchLead(leadId, signal) {
  return staffApi.get(`${BASE}/leads/${leadId}`, { signal });
}

/**
 * Creates a prospect.
 *
 * A same-name-same-pincode clash comes back on the created lead as `duplicateWarning[]` rather
 * than as an error — the save succeeds either way. Surface it, do not treat it as a failure.
 */
export function createLead(payload) {
  return staffApi.post(`${BASE}/leads`, payload);
}

export function updateLead(leadId, payload) {
  return staffApi.put(`${BASE}/leads/${leadId}`, payload);
}

export function deleteLead(leadId) {
  return staffApi.del(`${BASE}/leads/${leadId}`);
}

/**
 * The school search behind check-in — the ONE read in this module that is not scoped to the
 * signed-in rep.
 *
 * It pools every lead the team has entered, so a rep standing outside a school a colleague
 * already logged can find it. Returns `{leadId, schoolName, board, city, state, pincode, grades,
 * mine}`; `mine: false` means the row belongs to another rep. Selecting one does not take it from
 * them — the server clones it into a lead of the searcher's own on check-in.
 *
 * Both params are optional and independent: a rep may know the name, the PIN, or both. `buildQuery`
 * drops whichever is empty.
 */
export function searchSchools({ q, pincode } = {}, signal) {
  return staffApi.get(`${BASE}/school-search${buildQuery({ q, pincode })}`, { signal });
}

export function fetchFollowUps(signal) {
  return staffApi.get(`${BASE}/leads/follow-ups`, { signal });
}

// ── Visits ──────────────────────────────────────────────────────────────────

export function fetchVisits(signal) {
  return staffApi.get(`${BASE}/visits`, { signal });
}

/**
 * Logs a completed visit.
 *
 * `dedupeKey` is required for anything that might be retried — the offline queue always sends
 * one. The server returns the ORIGINAL visit for a key it has already seen, so a duplicate flush
 * is a no-op rather than a second visit on the rep's count.
 *
 * `checkInAt` should be the moment the rep actually checked in, not the moment of the request: a
 * queued visit may sync days later and would otherwise land on the wrong date.
 */
export function checkIn(payload) {
  return staffApi.post(`${BASE}/visits`, payload);
}

export function checkOut(visitId, payload) {
  return staffApi.post(`${BASE}/visits/${visitId}/checkout`, payload || {});
}

export function updateVisit(visitId, payload) {
  return staffApi.put(`${BASE}/visits/${visitId}`, payload);
}

export function planVisit(payload) {
  return staffApi.post(`${BASE}/visits/plan`, payload);
}

/**
 * Every school this rep has actually visited, most recent first — the follow-up rail.
 *
 * Each row carries the details of that school's LAST visit (`lastMetPersonName`, `lastRemarks`,
 * …) so a follow-up check-in can be prefilled instead of re-typed. That is the whole point: the
 * commonest thing a rep does was also the most tedious.
 */
export function fetchVisitedSchools(signal) {
  return staffApi.get(`${BASE}/visits/schools`, { signal });
}

export function fetchVisitCalendar(year, month, signal) {
  return staffApi.get(`${BASE}/visits/calendar${buildQuery({ year, month })}`, { signal });
}

/**
 * Attaches the check-in photo.
 *
 * A plain `files` part, not `json`: the endpoint takes @RequestParam("file"), so this must NOT go
 * through the application/json part trick that the teacher resource uploads need.
 */
export function uploadVisitPhoto(visitId, file) {
  return staffApi.multipart(`${BASE}/visits/${visitId}/photo`, { files: { file } });
}

// ── Schools, catalogue, deals ───────────────────────────────────────────────

export function fetchMySchools(signal) {
  return staffApi.get(`${BASE}/schools`, { signal });
}

export function fetchProducts(signal) {
  return staffApi.get(`${BASE}/products`, { signal });
}

export function fetchDeals(signal) {
  return staffApi.get(`${BASE}/deals`, { signal });
}

export function fetchDeal(dealId, signal) {
  return staffApi.get(`${BASE}/deals/${dealId}`, { signal });
}

export function createDeal(payload) {
  return staffApi.post(`${BASE}/deals`, payload);
}

export function updateDeal(dealId, payload) {
  return staffApi.put(`${BASE}/deals/${dealId}`, payload);
}

export function submitDeal(dealId) {
  return staffApi.post(`${BASE}/deals/${dealId}/submit`);
}

export function deleteDeal(dealId) {
  return staffApi.del(`${BASE}/deals/${dealId}`);
}

export function fetchQuotation(dealId, signal) {
  return staffApi.get(`${BASE}/deals/${dealId}/quotation`, { signal });
}

// ── Incentive ───────────────────────────────────────────────────────────────

export function fetchIncentiveSummary(financialYear, signal) {
  return staffApi.get(`${BASE}/incentive/summary${buildQuery({ financialYear })}`, { signal });
}

export function fetchIncentiveLedger(financialYear, signal) {
  return staffApi.get(`${BASE}/incentive/ledger${buildQuery({ financialYear })}`, { signal });
}

export function fetchIncentiveYears(signal) {
  return staffApi.get(`${BASE}/incentive/years`, { signal });
}

// ── Reports ─────────────────────────────────────────────────────────────────

export function fetchClosureReport(financialYear, signal) {
  return staffApi.get(`${BASE}/reports/closure${buildQuery({ financialYear })}`, { signal });
}

export function fetchVisitReport(year, month, signal) {
  return staffApi.get(`${BASE}/reports/visits${buildQuery({ year, month })}`, { signal });
}

// ── Geo ─────────────────────────────────────────────────────────────────────

/**
 * Server-side reverse geocoding.
 *
 * The FALLBACK only. expo-location's own reverseGeocodeAsync uses the OS geocoder — no API key,
 * no network round trip — so utils/salesLocation.js tries that first and only lands here when it
 * returns nothing. Returns `{ available: false }` when the server has no key configured.
 */
export function reverseGeocode(latitude, longitude, signal) {
  return staffApi.get(`${BASE}/geo/reverse${buildQuery({ lat: latitude, lng: longitude })}`, {
    signal,
  });
}

/**
 * A rep picks exactly one per visit, and the calendar colour-codes on it.
 *
 * WORK_FROM_HOME is the odd one out: it has no school, no GPS and no site photo, so both the
 * check-in sheet and the server relax those requirements for it alone. Every value here must also
 * appear in `VISIT_TYPE_COLOR` (components/staff/sales/salesFormat.js) or the calendar legend
 * renders that entry's dot with no background colour.
 */
export const VISIT_TYPES = [
  { value: 'SALES', label: 'Sales' },
  { value: 'FOLLOW_UP', label: 'Follow up' },
  { value: 'TRAINING', label: 'Training' },
  { value: 'COUNSELLING', label: 'Counselling' },
  { value: 'WORK_FROM_HOME', label: 'Work from home' },
];

export const LEAD_STAGES = [
  { value: 'NEW', label: 'New' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'NEGOTIATION', label: 'Negotiation' },
  { value: 'WON', label: 'Won' },
  { value: 'LOST', label: 'Lost' },
];

export const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'NEFT_RTGS', label: 'NEFT / RTGS' },
  { value: 'UPI', label: 'UPI' },
  { value: 'DD', label: 'Demand draft' },
  { value: 'RAZORPAY', label: 'Razorpay (online)' },
  { value: 'OTHER', label: 'Other' },
];

export const DEAL_STATUS_TONE = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  APPROVED: 'info',
  COLLECTED: 'success',
  REJECTED: 'error',
};

export const INCENTIVE_STATUS_TONE = {
  PENDING: 'warning',
  APPROVED: 'info',
  PAID: 'success',
  REVERSED: 'error',
};
