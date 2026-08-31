// services/partner/dashboardService.js
//
// The figures on the redesigned partner dashboard, and the tier rule the panel has always had.
//
// ══ TWO ENDPOINTS THE WEBSITE NEVER CALLS ══════════════════════════════════
// `GET /api/partner/earnings/summary` and `GET /api/partner/earnings` are implemented, secured with
// `hasRole('PARTNER')`, and **completely unconsumed** — `frontendmain`'s `partnerApi` has no binding
// for either. They are the right source for the revenue block and cost nothing to adopt.
//
// ══ WHAT THE DESIGN ASKS FOR THAT DOES NOT EXIST ═══════════════════════════
//   Active Schools /    **No status of any kind exists.** `linkedSchoolCodes` is a bare
//   Pending Schools     `List<String>` of code strings — no per-link flag — and the `School` entity
//                       has no status column either. There is nothing to derive these from, so they
//                       are returned `{ soon: true }` rather than drawn as zeros.
//
//   Total Students      No aggregate endpoint. The literal figure would mean calling
//                       `/analytics/schools/{code}/students` once PER LINKED SCHOOL and summing —
//                       a dozen requests and megabytes of roster JSON on a cold start to render one
//                       number. Instead the single `/analytics/monetization` call the dashboard
//                       already makes carries a `studentId` per row, so a DISTINCT count of those
//                       is one request. It is a different figure and is labelled as one:
//                       **"Your Students"** — students who subscribed on this partner's code.
//
//   Pending Payout      No server field. `PartnerEarningStatus` is PENDING (captured, Razorpay not
//                       yet settled) / APPROVED (settled, safe to pay out) / PAID / REVERSED, so
//                       money owed is `pending + approved`. Composed here, and the card says so.
//
//   This Month          No dedicated endpoint. `/analytics/earnings/monthly` returns twelve
//                       zero-padded IST buckets Apr→Mar for one financial year; the current month
//                       is picked out of them.
//
// ══ DO NOT SUM /analytics/monetization FOR REVENUE ═════════════════════════
// It joins earnings→subscriptions and **drops any earning whose subscription row is missing**
// (`if (sub == null) continue;`), so a client-side sum of `revenue` reads LOWER than
// `lifetimeNetAmount`. The two are computed differently on purpose. `/earnings/summary` is the
// authority for the four revenue tiles; `/monetization` is a per-row report.

import partnerApi from '../partnerApi';
import { formatRupees } from '../../utils/currency';

/**
 * Everything the two hero cards need, fanned out and independently guarded.
 *
 * `settleAll`, never `Promise.all`. Every one of these is `hasRole('PARTNER')` and an unverified
 * account holds `ROLE_UNVERIFIED_PARTNER`, which is granted nothing — so all three 403 together for
 * a partner who has not been approved. The screen's verification gate resolves before this runs,
 * but a NORMAL partner can also legitimately be refused things, and one refusal must cost one
 * figure rather than the whole dashboard.
 */
export function loadDashboardFigures() {
  return partnerApi.settleAll({
    summary: partnerApi.get('/api/partner/earnings/summary'),
    monetization: partnerApi.get('/api/partner/analytics/monetization'),
    monthly: partnerApi.get('/api/partner/analytics/earnings/monthly'),
  });
}

/** A `settleAll` entry, defensively. */
const part = (parts, key) => parts?.[key] || { data: null, error: null, forbidden: false };

/**
 * The partner's tier, preferring the server but never demoting on a failure.
 *
 * ── THIS IS THE PANEL'S OLDEST RULE AND IT IS EASY TO UNDO ──────────────────
 * The website does `profile?.partnerType || "NORMAL"`, so any dropped connection **silently demotes
 * a Master** and takes their Linked Partners tab away until they reload. The app seeds from what
 * login stored and only overwrites when the server actually named a tier.
 *
 * Extracted here from an inline `if (liveType) setPartnerType(liveType);` so it can be CALLED by
 * the checker. A string match on that line proved the line existed; it never proved the behaviour,
 * and it broke the moment the load was reflowed.
 *
 * @param {string|null} live   what `partnerTypeOf(profile)` returned — null when unknown
 * @param {string|null} stored what login wrote to `partnerUserType`
 */
export function resolveTier(live, stored) {
  if (live) return String(live).trim().toUpperCase();
  if (stored) return String(stored).trim().toUpperCase();
  return null;
}

/** How many schools this partner is linked to. Free — it is already on the profile. */
export function schoolCount(profile) {
  const codes = profile?.linkedSchoolCodes;
  return Array.isArray(codes) ? codes.length : 0;
}

/**
 * Distinct students who subscribed on this partner's code.
 *
 * DISTINCT, because one student can hold more than one subscription row over time and counting rows
 * would inflate the figure every renewal. Returns null when the call failed, so the caller can show
 * "coming soon" rather than a zero that reads as "nobody signed up".
 */
export function studentCount(parts) {
  const rows = part(parts, 'monetization').data;
  if (!Array.isArray(rows)) return null;
  const ids = new Set();
  rows.forEach((r) => {
    if (r?.studentId != null) ids.add(String(r.studentId));
  });
  return ids.size;
}

/**
 * The My Schools strip.
 *
 * Two real figures and two that cannot exist. See the header for why Active and Pending have no
 * data source at all — this is not a porting gap, there is no column anywhere to read.
 */
export function schoolStats(profile, parts, strings = {}) {
  const students = studentCount(parts);
  return [
    {
      key: 'schools',
      label: strings.statSchools || 'Schools',
      value: String(schoolCount(profile)),
      note: strings.linkedToYou || 'Linked to you',
    },
    students == null
      ? { key: 'students', label: strings.statStudents || 'Your Students', soon: true }
      : {
          key: 'students',
          label: strings.statStudents || 'Your Students',
          value: String(students),
          note: strings.onYourCode || 'On your code',
        },
    { key: 'active', label: strings.statActive || 'Active', soon: true },
    { key: 'pending', label: strings.statPendingSchools || 'Pending', soon: true },
  ];
}

/**
 * Earnings for the current calendar month, out of the twelve financial-year buckets.
 *
 * The buckets are Apr→Mar, so `monthIndex` is NOT the calendar month — April is index 0. Deriving
 * the offset rather than indexing by `getMonth()` is the difference between reading August and
 * reading November. Falls back to matching the `label` when `monthIndex` is absent.
 *
 * @returns {number|null} null when the call failed or the month is not in the returned year
 */
export function thisMonthEarnings(parts, now = new Date()) {
  const rows = part(parts, 'monthly').data;
  if (!Array.isArray(rows) || rows.length === 0) return null;

  // Indian financial year starts in April: Apr→0, May→1 … Jan→9, Feb→10, Mar→11.
  const wanted = (now.getMonth() - 3 + 12) % 12;
  const byIndex = rows.find((r) => Number(r?.monthIndex) === wanted);
  if (byIndex) return Number(byIndex.total) || 0;

  // Older responses may carry only a label. Match the month name defensively.
  const monthName = now.toLocaleString('en-US', { month: 'short' }).toLowerCase();
  const byLabel = rows.find((r) => String(r?.label || '').toLowerCase().startsWith(monthName));
  return byLabel ? Number(byLabel.total) || 0 : null;
}

/**
 * The My Revenue strip.
 *
 * A figure whose call FAILED is `{ soon: true }`, never `₹0` — "we could not read your earnings"
 * and "you have earned nothing" are different statements, and showing the second when the first is
 * true tells a partner their money has vanished.
 *
 * Rupees are rendered with no decimals here: `formatRupees` defaults to two, which turns
 * `₹24,75,000` into `₹24,75,000.00` and overflows a quarter-width tile. Paise never matter at this
 * altitude; the per-row screens keep them.
 */
export function revenueStats(parts, now = new Date(), strings = {}) {
  const summary = part(parts, 'summary').data;
  const money = (v) => formatRupees(v, { decimals: 0 });

  const stats = [];

  if (summary) {
    stats.push({
      key: 'total',
      label: strings.statTotal || 'Total',
      value: money(summary.lifetimeNetAmount),
      note: strings.sinceJoining || 'Since joining',
    });
    stats.push({
      key: 'paid',
      label: strings.statPaid || 'Paid',
      value: money(summary.paidAmount),
      note: strings.paidToDate || 'Paid to date',
    });
    // COMPOSED: there is no `pendingPayout` field. PENDING is captured-but-unsettled and APPROVED is
    // settled-and-payable; both are money owed, so the note names what it covers.
    const owed = (Number(summary.pendingAmount) || 0) + (Number(summary.approvedAmount) || 0);
    stats.push({
      key: 'pending',
      label: strings.statPending || 'Pending',
      value: money(owed),
      note: strings.awaitingPayout || 'Awaiting payout',
    });
  } else {
    ['total', 'paid', 'pending'].forEach((key) => {
      stats.push({ key, label: strings[`stat${key[0].toUpperCase()}${key.slice(1)}`] || key, soon: true });
    });
  }

  const month = thisMonthEarnings(parts, now);
  stats.push(
    month == null
      ? { key: 'month', label: strings.statMonth || 'This month', soon: true }
      : {
          key: 'month',
          label: strings.statMonth || 'This month',
          value: money(month),
          note: strings.thisMonth || 'Earned this month',
        },
  );

  return stats;
}

/**
 * When this partner joined.
 *
 * ── THERE IS NO JOIN DATE ON THE RECORD ────────────────────────────────────
 * `PartnerUser` has thirteen fields and none is a `createdAt`; the linked `User` has only
 * `id, email, password, roles` and no timestamp either. `termsAcceptedAt` is stamped
 * `Instant.now()` inside `PartnerAuthService.registerPartner()`, so for anyone who signed up
 * through the app or the site it IS the moment they joined.
 *
 * It is nullable — an older row, or an account an admin created by another path — and null returns
 * null so the card can say "Not set" rather than print a guess or an epoch date.
 */
export function joinedOn(profile) {
  const raw = profile?.termsAcceptedAt;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * The partner's display code, or null when an admin has not assigned one.
 *
 * `partnerCode` is nullable admin-typed free text — there is no generator and **no `PRT#####`
 * format**, whatever the design mock shows. A partner who has not been assigned one yet is a real
 * and common state, and printing "null" or an empty row is how it gets reported as a bug.
 */
export function partnerCodeOf(profile) {
  const code = profile?.partnerCode;
  return typeof code === 'string' && code.trim() ? code.trim() : null;
}
