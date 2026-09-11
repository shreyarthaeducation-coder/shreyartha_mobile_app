// services/sales/salesMetrics.js
//
// The four figures on the sales dashboard's "Sales Performance (This Month)" card, and the
// month-over-month deltas — where those exist.
//
// ══ THE RULE THIS MODULE EXISTS TO ENFORCE ═════════════════════════════════
// The approved design shows a "vs Last Month" delta under all four figures. The backend can
// support two of them:
//
//   Total Sales      `dashboard.monthlyRevenue` is TWELVE buckets, so last month is real.
//   Schools Visited  real, at the cost of a second `/reports/visits` call for the prior month.
//   Proposals Sent   `dashboard.dealsSubmitted` is a CURRENT count. No history exists anywhere.
//   Conversion       `dashboard.pipeline` is a snapshot of open stages. Same.
//
// So the last two carry `delta: null`, and `MetricRow` renders no change line for them at all. A
// fabricated 0% would read as "flat this month", which is a claim about the rep's performance that
// nothing in the data supports.
//
// ══ THE APRIL-FIRST TRAP ═══════════════════════════════════════════════════
// `monthlyRevenue` is indexed by FISCAL slot, not calendar month: slot 0 is APRIL. The backend
// says so in FiscalPeriods.monthSlot — "note this means monthIndex != Calendar month - 1" — and
// reading it with `getMonth()` silently returns a different month's revenue, which is the kind of
// wrong that looks perfectly plausible on a dashboard.

import { fetchDashboard, fetchVisitReport } from './salesService';

/** Fiscal slot (0 = April) for a calendar month 1-12. Mirrors FiscalPeriods.monthSlot. */
export function monthSlot(calendarMonth) {
  return calendarMonth >= 4 ? calendarMonth - 4 : calendarMonth + 8;
}

/** Percentage change from `previous` to `current`, or null when it cannot be computed. */
export function percentChange(current, previous) {
  const now = Number(current);
  const before = Number(previous);
  if (!Number.isFinite(now) || !Number.isFinite(before)) return null;
  // A previous month of zero has no meaningful percentage — every increase is "infinite" and
  // rendering ∞% or 100% would both be inventions. No delta line is the honest answer.
  if (before === 0) return null;
  return Math.round(((now - before) / Math.abs(before)) * 100);
}

/**
 * Conversion, as a whole-number percentage of the rep's own pipeline.
 *
 * Computed here rather than read from the server because the formula lives only in
 * `AdminSalesService.employeeReport`, which is `hasRole('ADMIN')` — a rep is refused it. The
 * arithmetic is the same one that endpoint uses: won ÷ all stages.
 *
 * Returns null on an empty pipeline. A rep with no leads at all has no conversion rate, and
 * showing 0% would say they are failing to convert leads they do not have.
 */
export function conversionPercent(pipeline) {
  if (!pipeline) return null;
  const values = Object.values(pipeline).map(Number).filter(Number.isFinite);
  const total = values.reduce((sum, n) => sum + n, 0);
  if (total <= 0) return null;
  const won = Number(pipeline.WON) || 0;
  return Math.round((won / total) * 100);
}

/** The bucket for a fiscal slot, or null when the payload does not carry it. */
function bucketAt(monthlyRevenue, slot) {
  if (!Array.isArray(monthlyRevenue) || slot < 0 || slot > 11) return null;
  // Match on `monthIndex` rather than trusting array position: the server builds twelve buckets in
  // order today, but a payload that ever arrives sparse or reordered would silently read the wrong
  // month, and nothing about the result would look wrong.
  return monthlyRevenue.find((b) => Number(b?.monthIndex) === slot) || null;
}

/**
 * Everything the performance card needs.
 *
 * Two calls in the common case, three when a prior-month comparison is possible:
 * `/dashboard`, plus `/reports/visits` for this month and last. The visit reports are what supply
 * DISTINCT schools — `dashboard.visitsThisMonth` counts VISITS, and `dashboard.schoolCount` counts
 * ASSIGNED schools, so neither answers "how many schools did I visit".
 *
 * Every field is independently optional: a failed visit report costs the Schools Visited figure
 * and nothing else.
 *
 * @param {Date} now injectable so a test can pin the month rather than depend on today's date
 */
export async function loadSalesMetrics(now = new Date()) {
  const dashboard = await fetchDashboard();

  const calendarMonth = now.getMonth() + 1;
  const slot = monthSlot(calendarMonth);
  const monthly = dashboard?.monthlyRevenue;

  const thisBucket = bucketAt(monthly, slot);
  // Slot 0 is April, the first month of the financial year, and it has no predecessor WITHIN this
  // year. Reaching back into last year's data would need another request and another FY, so April
  // simply shows no delta.
  const prevBucket = slot > 0 ? bucketAt(monthly, slot - 1) : null;

  const [visitsNow, visitsPrev] = await Promise.all([
    safeVisitReport(now.getFullYear(), calendarMonth),
    slot > 0 ? safeVisitReport(prevYear(now), prevMonth(calendarMonth)) : Promise.resolve(null),
  ]);

  return {
    dashboard,
    totalSalesInr: Number(thisBucket?.collectedInr) || 0,
    totalSalesDelta: percentChange(thisBucket?.collectedInr, prevBucket?.collectedInr),
    // `uniqueLeads` is the visit report's distinct-school count for the month.
    schoolsVisited: Number(visitsNow?.uniqueLeads) || 0,
    schoolsVisitedDelta: percentChange(visitsNow?.uniqueLeads, visitsPrev?.uniqueLeads),
    proposalsSent: Number(dashboard?.dealsSubmitted) || 0,
    conversion: conversionPercent(dashboard?.pipeline),
  };
}

async function safeVisitReport(year, month) {
  try {
    return await fetchVisitReport(year, month);
  } catch {
    // The figure is dropped, not faked — the caller renders 0 visits rather than a wrong number,
    // and the delta becomes null because percentChange refuses a non-finite input.
    return null;
  }
}

/** Calendar month before `calendarMonth` (1-12), wrapping December → January's predecessor. */
function prevMonth(calendarMonth) {
  return calendarMonth === 1 ? 12 : calendarMonth - 1;
}

/** The calendar year the previous month falls in — January's predecessor is last December. */
function prevYear(now) {
  return now.getMonth() + 1 === 1 ? now.getFullYear() - 1 : now.getFullYear();
}
