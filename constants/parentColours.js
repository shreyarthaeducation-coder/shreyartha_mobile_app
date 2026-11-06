/**
 * The parent app's colours (4 Nov 2026): "a bit colourful, but professional and consistent".
 *
 * The parent purple (PORTALS.parent) stays the portal's own — headers, buttons, links. On top of it
 * every AREA of the parent app has one hue, used the same way everywhere it appears: the home's
 * quick action, its "All sections" tile, the stat on the child's report, and the accent on that
 * area's own screen. So a parent learns "fees are green, attendance is amber" once.
 *
 * Each hue is a soft wash (`bg`), a border one step stronger (`border`), and a strong ink (`fg`)
 * dark enough for text on white and on its own wash (all ≥ 4.5:1 on `bg`).
 */
export const PARENT_HUES = Object.freeze({
  violet: { fg: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe' },
  blue: { fg: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  teal: { fg: '#0f766e', bg: '#f0fdfa', border: '#99f6e4' },
  amber: { fg: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  rose: { fg: '#be123c', bg: '#fff1f2', border: '#fecdd3' },
  green: { fg: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
});

/** Which hue each area wears. One place, so a screen and its tile can never disagree. */
export const PARENT_AREA_HUE = Object.freeze({
  // The report: tests, report card and counselling.
  'view-report': 'violet',
  tests: 'violet',
  // Learning.
  'academic-progress': 'blue',
  academic: 'blue',
  'learning-activities': 'teal',
  homework: 'teal',
  skills: 'teal',
  recommendations: 'rose',
  psychometric: 'rose',
  // School life.
  'attendance-schedule': 'amber',
  attendance: 'amber',
  notifications: 'amber',
  // Money.
  fees: 'green',
  history: 'blue',
});

/** The hue for an area, the parent violet for anything unlisted. */
export function hueOf(area) {
  return PARENT_HUES[PARENT_AREA_HUE[area]] || PARENT_HUES.violet;
}
