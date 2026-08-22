/**
 * Money and day formatting for the HR screens.
 *
 * `formatRupees` is copied verbatim from `frontendmain/src/School/shared/hr/hrConstants.js`, and
 * the hand-rolled digit grouping is deliberate rather than lazy: `Intl.NumberFormat("en-IN")`
 * needs full ICU, which Hermes on Android ships trimmed, so the lakh/crore grouping silently
 * degrades to Western thousands on exactly the devices this app targets.
 *
 * Same reasoning for `formatShortDate` — the web's `toLocaleDateString("en-IN", …)` is replaced
 * with an explicit `DD MMM YYYY`.
 */

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));

/** `1234567.5` → `"₹12,34,567.50"`. Sign precedes the symbol, as on the web. */
export function formatRupees(value, { decimals = 2 } = {}) {
  const n = Number(value);
  if (value === null || value === undefined || Number.isNaN(n)) return '-';

  const negative = n < 0;
  const fixed = Math.abs(n).toFixed(decimals);
  const [whole, frac] = fixed.split('.');

  let grouped;
  if (whole.length <= 3) {
    grouped = whole;
  } else {
    const last3 = whole.slice(-3);
    let rest = whole.slice(0, -3);
    const chunks = [];
    while (rest.length > 2) {
      chunks.unshift(rest.slice(-2));
      rest = rest.slice(0, -2);
    }
    grouped = `${[rest, ...chunks].filter(Boolean).join(',')},${last3}`;
  }

  return `${negative ? '-' : ''}₹${grouped}${frac ? `.${frac}` : ''}`;
}

/** Whole days print bare, halves get one decimal: `2` / `1.5`. */
export function formatDays(value) {
  const n = Number(value);
  if (value === null || value === undefined || Number.isNaN(n)) return '-';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function dayLabel(value) {
  return Number(value) === 1 ? 'day' : 'days';
}

/** `"2026-08-14"` → `"14 Aug 2026"`. Accepts a date-only or datetime string. */
export function formatShortDate(value) {
  if (!value) return '-';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!match) return String(value);
  const [, y, m, d] = match;
  return `${Number(d)} ${MONTH_SHORT[Number(m) - 1]} ${y}`;
}

/** `"2026-08"` style label for a payslip period. */
export function formatPeriod(year, month) {
  if (!year || !month) return '-';
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

// ── leave years ─────────────────────────────────────────────────────────────
//
// The leave year runs 1 April – 31 March, so April onward belongs to the year starting that April.
// Ported from hrConstants.js, but WITHOUT its `todayIso()`, which used toISOString() and is
// therefore UTC — we take the date from local time instead.

export function currentLeaveYear(date = new Date()) {
  const startYear = date.getMonth() + 1 >= 4 ? date.getFullYear() : date.getFullYear() - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/** Most recent first, current year at index 0. */
export function recentLeaveYears(count = 4) {
  const start = Number(currentLeaveYear().split('-')[0]);
  return Array.from({ length: count }, (_, i) => {
    const y = start - i;
    return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
  });
}

/**
 * Usage meter for a leave balance.
 *
 * Note "entitled" here is `opening + accrued + adjusted`, which is the honest total — the web's
 * balance card labels bare `accrued` as "Entitled" while its meter uses this, so the two disagree
 * whenever opening or adjusted is non-zero. We use this definition for both.
 */
export function balanceUsage(balance) {
  const entitled =
    Number(balance?.opening || 0) + Number(balance?.accrued || 0) + Number(balance?.adjusted || 0);
  const consumed = Number(balance?.used || 0) + Number(balance?.pending || 0);
  if (!(entitled > 0)) return { percent: 0, entitled: 0, consumed };
  return {
    percent: Math.min(100, Math.round((consumed / entitled) * 100)),
    entitled,
    consumed,
  };
}
