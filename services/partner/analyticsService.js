// services/partner/analyticsService.js
// Everything under /api/partner/analytics/** — School Analytics, Monetization, Linked Partners
// and the Dashboard's earnings chart.
//
// Ports frontendmain/src/services/ApiServices.js `partnerApi` (the analytics half) plus the
// row-shaping the four web screens do inline.
//
// THE ONE TRAP, restated because it costs an afternoon: `linked-partners` refuses a NORMAL caller
// with **HTTP 400, not 403**. PartnerAnalyticsService throws IllegalStateException("Only Master
// Partners can view linked partners.") and the controller maps that to 400 + {success, message}.
// Any `err.status === 403` check silently turns a clear message into "something went wrong".

import partnerApi from '../partnerApi';

/**
 * Students who used this partner's code at a given school.
 *
 * Row: { studentId, studentName, email, currentClass, section, subscriptionType,
 *        subscriptionStatus, partnerCodeUsed, purchasedAt, expiresAt, amountPaid }
 */
export function fetchSchoolStudents(schoolCode, signal) {
  return partnerApi.get(
    `/api/partner/analytics/schools/${encodeURIComponent(schoolCode)}/students`,
    { signal },
  );
}

/**
 * Every commissionable subscription attributed to this partner.
 *
 * Row: { subscriptionId, studentName, subscriptionType, partnerCode,
 *        commissionType: 'PRIMARY' | 'MASTER_OVERRIDE', sourcePartnerName, sourcePartnerCode,
 *        purchasedAt, expiresAt, status, amountPaid, commissionPercent, revenue }
 */
export function fetchMonetization(signal) {
  return partnerApi.get('/api/partner/analytics/monetization', { signal });
}

/**
 * Master-only: the NORMAL partners sitting under this one.
 *
 * Row: { partnerUserId, fullName, partnerCode, email, mobile, verified }
 *
 * Throws a PortalApiError with status 400 (not 403) for a NORMAL caller — read `.payload.message`.
 */
export function fetchLinkedPartners(signal) {
  return partnerApi.get('/api/partner/analytics/linked-partners', { signal });
}

/** Indian financial years in which this partner earned anything: [{ startYear, label }]. */
export function fetchEarningFinancialYears(signal) {
  return partnerApi.get('/api/partner/analytics/earnings/financial-years', { signal });
}

/**
 * Twelve monthly buckets for one financial year.
 * Row: { label, primary, masterOverride, total }
 */
export function fetchMonthlyEarnings(startYear, signal) {
  return partnerApi.get('/api/partner/analytics/earnings/monthly', {
    params: startYear != null ? { startYear } : undefined,
    signal,
  });
}

// ── Shaping the web screens do inline ───────────────────────────────────────────────────────────

/**
 * Total paid across a student list.
 *
 * Mirrors PartnerSchoolAnalytics's footer. Note this counts EVERY row, including cancelled ones —
 * that screen is a roster of who subscribed, not a revenue report. Monetization is where
 * cancellations are excluded, and the two totals are supposed to differ.
 */
export function totalPaid(rows) {
  return (rows || []).reduce((sum, r) => sum + Number(r?.amountPaid || 0), 0);
}

/**
 * Subscription-type breakdown for the dashboard's pie.
 *
 * Counts ONLY rows whose `partnerCodeUsed` matches this partner's own code, case-insensitively —
 * the endpoint returns every student at the school, including ones who came through a different
 * partner, and the web chart applies exactly this filter (PartnerAnalytics.js).
 *
 * @returns {Array<{ label: string, value: number }>}
 */
export function subscriptionBreakdown(rows, partnerCode) {
  const code = String(partnerCode || '').toUpperCase();
  const counts = new Map();
  for (const r of rows || []) {
    if (!code) continue;
    if (String(r?.partnerCodeUsed || '').toUpperCase() !== code) continue;
    const key = r?.subscriptionType || 'Unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].map(([label, value]) => ({ label, value }));
}

/**
 * Monetization stat tiles.
 *
 * CANCELLED is excluded from both revenue and the collected total, matching PartnerMonetization —
 * a refunded subscription pays no commission. It is still counted in `total` so the tile row and
 * the table below it agree on how many rows exist.
 */
export function monetizationTotals(rows) {
  const list = rows || [];
  const live = list.filter((r) => String(r?.status || '').toUpperCase() !== 'CANCELLED');
  return {
    total: list.length,
    active: live.length,
    cancelled: list.length - live.length,
    collected: live.reduce((s, r) => s + Number(r?.amountPaid || 0), 0),
    revenue: live.reduce((s, r) => s + Number(r?.revenue || 0), 0),
    primary: live.filter((r) => String(r?.commissionType || '').toUpperCase() === 'PRIMARY').length,
    override: live.filter(
      (r) => String(r?.commissionType || '').toUpperCase() === 'MASTER_OVERRIDE',
    ).length,
  };
}
