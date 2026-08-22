// services/partner/plansService.js
// "Plans for Students" — the admin-managed custom plans a partner shows to families.
//
// ⚠️ THIS TAB DOES NOT LIVE UNDER /api/partner. It calls `GET /api/custom-plans`, the same public
// endpoint the website's plans page uses (frontendmain/src/services/customPlansApi.js). It is the
// only partner screen whose data is not partner-scoped, which is why it is in its own service
// rather than in analyticsService — a reader looking for it under /api/partner/analytics will not
// find it, and that surprise is worth a file boundary.

import partnerApi from '../partnerApi';

/**
 * @returns {Promise<Array<object>>} plan:
 *   { id, name, className, stream, duration: 'MONTHLY'|'YEARLY'|'BOTH', companyPriceInr,
 *     discountInr, discountedPriceInr, monthlyDiscountedPriceInr, partnerCodeDiscountPercent,
 *     details, imageUrl }
 */
export async function fetchCustomPlans(signal) {
  const data = await partnerApi.get('/api/custom-plans', { signal });
  // The web does `Array.isArray(data) ? data : []`. Kept, because an object here would otherwise
  // reach `.map` — the same coercion bug that made fetchPersonalized return nothing.
  return Array.isArray(data) ? data : [];
}

/** Web parity: STREAM_ORDER from PartnerPlans.js, used to order the stream chips. */
export const STREAM_ORDER = ['SCIENCE', 'ARTS', 'COMMERCE', 'SKILLS_EDGE', 'COMPETITIVE_EXAMS'];

export const STREAM_LABELS = {
  SCIENCE: 'Science',
  ARTS: 'Arts',
  COMMERCE: 'Commerce',
  SKILLS_EDGE: 'Skills Edge',
  COMPETITIVE_EXAMS: 'Competitive Exams',
};

export const streamLabel = (stream) => STREAM_LABELS[stream] || stream || '—';

/**
 * Distinct class names, ordered by the number inside them.
 *
 * "Class 10" must follow "Class 9", which a plain string sort gets wrong — hence the digit
 * extraction, copied from PartnerPlans.js. A name with no digits sorts as 0 and lands first,
 * which is also what the web does.
 */
export function availableClasses(plans) {
  const names = [...new Set((plans || []).map((p) => p.className).filter(Boolean))];
  return names.sort((a, b) => {
    const na = parseInt(a.match(/\d+/)?.[0] ?? '0', 10);
    const nb = parseInt(b.match(/\d+/)?.[0] ?? '0', 10);
    return na - nb;
  });
}

/** Streams available within one class, in STREAM_ORDER. */
export function availableStreams(plans, className) {
  if (!className) return [];
  const base = (plans || []).filter((p) => p.className === className);
  const streams = [...new Set(base.map((p) => p.stream).filter(Boolean))];
  return streams.sort((a, b) => STREAM_ORDER.indexOf(a) - STREAM_ORDER.indexOf(b));
}

/** The plans matching both filters. */
export function filterPlans(plans, className, stream) {
  return (plans || []).filter(
    (p) => (!className || p.className === className) && (!stream || p.stream === stream),
  );
}
