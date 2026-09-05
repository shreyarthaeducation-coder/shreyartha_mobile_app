// Shared formatting for the native Sales screens.
//
// Mirrors frontendmain/src/Sales/platform/salesFormat.js so the two panels speak the same
// vocabulary — a rep who checks the web on a laptop and the app in the field must not see the
// same figure written two ways.

/** Indian grouping, e.g. ₹32,00,000. Paise only when the amount actually has them. */
export function inr(value, { decimals } = {}) {
  const n = Number(value || 0);
  const wantsDecimals = decimals ?? !Number.isInteger(n);
  return (
    '₹'
    + n.toLocaleString('en-IN', {
      minimumFractionDigits: wantsDecimals ? 2 : 0,
      maximumFractionDigits: wantsDecimals ? 2 : 0,
    })
  );
}

/** Compact rupees for a stat tile: ₹32.5L, ₹1.2Cr. Screen width is scarce here. */
export function inrShort(value) {
  const n = Number(value || 0);
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(2).replace(/\.00$/, '')}Cr`;
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2).replace(/\.00$/, '')}L`;
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return inr(n, { decimals: false });
}

export function shortDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function dateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** SALES → "Sales", FOLLOW_UP → "Follow up". */
export function humanise(value) {
  if (!value) return '—';
  const s = String(value).replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const LEAD_STAGE_TONE = {
  NEW: 'neutral',
  CONTACTED: 'info',
  NEGOTIATION: 'warning',
  WON: 'success',
  LOST: 'error',
};

/** The colour a visit chip takes on the calendar, by nature of visit. */
export const VISIT_TYPE_COLOR = {
  SALES: '#4338ca',
  FOLLOW_UP: '#0891b2',
  TRAINING: '#d97706',
  COUNSELLING: '#9333ea',
  // A muted teal rather than another saturated hue: a work-from-home day is a real logged day but
  // not a field visit, so it should read as present-but-different. Matches the web's chip colour.
  // Every key here MUST have an entry in VISIT_TYPES — the calendar legend reads this map, and a
  // missing key renders a dot with `backgroundColor: undefined`, i.e. invisible.
  WORK_FROM_HOME: '#0f766e',
};

/** A planned-but-not-yet-visited day. */
export const PLANNED_COLOR = '#94a3b8';

/** Output GST on everything this module sells. Mirrors the web's `salesFormat.js`. */
export const GST_PERCENT = 18;

/** The rate to show for a deal: its own snapshot if it has one, else the current rate. */
export function gstPercentOf(deal) {
  const pct = Number(deal?.gstPercent);
  return Number.isFinite(pct) && pct > 0 ? pct : GST_PERCENT;
}

/** "GST at 18%" — one label, so the deal preview and the quotation agree. */
export function gstLabel(deal) {
  return `GST at ${gstPercentOf(deal)}%`;
}

/**
 * Customer Reading — where a school sits in the funnel, as read by the rep after a visit.
 *
 * Replaced a 1–5 "closure likelihood" whose five word labels lived only in the reports screen and
 * were never shown at the point of input: the picker was bare digits under a one-line hint. These
 * labels ARE the picker now, because "Demo" is something a rep knows and "3 out of 5" is
 * something they have to guess at.
 *
 * 0 is the addition that mattered most — the old scale had nowhere to record a lost sale. Note
 * that 0 is a REAL value: never test a reading for truthiness.
 */
export const CUSTOMER_READINGS = [
  { value: 0, label: 'Sales lost', tone: 'error' },
  { value: 1, label: 'Meeting', tone: 'neutral' },
  { value: 2, label: 'Demo', tone: 'neutral' },
  { value: 3, label: 'Proposal', tone: 'warning' },
  { value: 4, label: 'Negotiation', tone: 'warning' },
  { value: 5, label: 'Closure / Sales win', tone: 'success' },
];

const READING_BY_VALUE = new Map(CUSTOMER_READINGS.map((r) => [r.value, r]));

/** True when a reading is actually set. `0` is a reading; `null`, `undefined` and `''` are not. */
export function hasReading(value) {
  return value !== null && value !== undefined && value !== '';
}

/** "Demo" for 2, "—" for unset. Never renders a bare number at a reader. */
export function readingLabel(value) {
  if (!hasReading(value)) return '—';
  return READING_BY_VALUE.get(Number(value))?.label ?? String(value);
}

/** A `StatusChip` tone, matching the web's pill colours. */
export function readingTone(value) {
  return READING_BY_VALUE.get(Number(value))?.tone ?? 'neutral';
}

/**
 * Slice colours for the funnel ring. Identical to the web's, so the same rep sees the same
 * picture on both clients.
 *
 * Readings 1–5 are an ORDINAL ramp — one blue hue, light to dark, "further down the funnel is
 * darker". They are stages of one process, so unrelated hues would make the chart harder to read
 * rather than easier. The two that are not stages get colours from outside the ramp: 0 is an exit
 * (status red) and "not yet rated" is an absence (neutral grey).
 *
 * Adjacent ramp steps are close by design, so the chart never relies on colour alone — every
 * slice is named and counted in the legend beside it.
 */
export const READING_COLORS = {
  0: '#d03b3b',
  1: '#86b6ef',
  2: '#5598e7',
  3: '#2a78d6',
  4: '#1c5cab',
  5: '#0d366b',
};

export const UNRATED_COLOR = '#9a9a93';

/**
 * Grades a school runs. "PRE" covers everything before class 1 — nursery, LKG, UKG — because a
 * rep sells to a school by segment and every school names its pre-primary differently.
 */
export const GRADE_OPTIONS = [
  { value: 'PRE', label: 'Pre-primary' },
  ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
];

const GRADE_ORDER = GRADE_OPTIONS.map((g) => g.value);

/** Sorts and de-duplicates a grade selection into the CSV the server stores. */
export function normaliseGrades(values) {
  const picked = new Set((values || []).map(String));
  return GRADE_ORDER.filter((g) => picked.has(g)).join(',');
}

export function parseGrades(csv) {
  if (!csv) return [];
  const picked = new Set(
    String(csv)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return GRADE_ORDER.filter((g) => picked.has(g));
}

/**
 * Compresses a stored grade list back into ranges for display: "6,7,8" → "6-8",
 * "PRE,1,2,3,9,10" → "Pre-primary, 1-3, 9-10".
 *
 * The server stores the list expanded so `grades LIKE '%,9,%'` can answer "which leads teach
 * grade 9"; compressing is a display concern and belongs here.
 */
export function formatGrades(csv) {
  const list = parseGrades(csv);
  if (!list.length) return '—';

  const out = [];
  let runStart = null;
  let runEnd = null;

  const flush = () => {
    if (runStart === null) return;
    out.push(runStart === runEnd ? runStart : `${runStart}-${runEnd}`);
    runStart = null;
    runEnd = null;
  };

  list.forEach((g) => {
    // "PRE" has no numeric successor, so it is never part of a run.
    if (g === 'PRE') {
      flush();
      out.push('Pre-primary');
      return;
    }
    if (runEnd !== null && Number(g) === Number(runEnd) + 1) {
      runEnd = g;
      return;
    }
    flush();
    runStart = g;
    runEnd = g;
  });
  flush();

  return out.join(', ');
}

/** True for the one visit type logged from a rep's own desk — no school, no GPS, no photo. */
export function isRemoteVisit(visitType) {
  return visitType === 'WORK_FROM_HOME';
}

/** ISO date for a month grid — `YYYY-MM-DD` for every day of the month, in order. */
export function monthDates(year, month) {
  const days = new Date(year, month, 0).getDate();
  return Array.from(
    { length: days },
    (_, i) => `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
  );
}
