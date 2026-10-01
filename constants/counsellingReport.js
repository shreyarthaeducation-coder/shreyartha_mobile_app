/**
 * The Counselling Report's tabs, in the order both panels show them — the native form of the web's
 * frontendmain/src/School/shared/counsellingReport/counsellingReportPaths.js.
 *
 * One Counselling Report screen replaced three parent tiles (Assessment Results, Counselor Notes,
 * Counsellor Report) and two teacher tiles (Counselling Needs and Notes, Counsellor Report). The
 * web opens a tab by path (`…/counselling-report/notes`); the app by query
 * (`/parent/counselling-report?tab=notes`), because the three tabs live inside one native screen.
 * The keys are the web's, so a web link converts by moving its last segment into `tab`.
 *
 * Import-free on purpose: scripts/checkparent.mjs evaluates it.
 */
export const COUNSELLING_REPORT_TABS = Object.freeze({
  PSYCHOMETRIC: 'psychometric',
  NOTES: 'notes',
  REPORT: 'report',
});

export const COUNSELLING_REPORT_TAB_ORDER = [
  COUNSELLING_REPORT_TABS.PSYCHOMETRIC,
  COUNSELLING_REPORT_TABS.NOTES,
  COUNSELLING_REPORT_TABS.REPORT,
];

/**
 * The staff report's tabs (teacher, vice principal). Since 1 Oct 2026 Counselling Needs and Notes is
 * a Student Support tile of its own again, beside this report, so the staff report has two tabs — the
 * parent's keeps all three. Mirrors the web's STAFF_COUNSELLING_REPORT_TABS.
 */
export const STAFF_COUNSELLING_REPORT_TAB_ORDER = [
  COUNSELLING_REPORT_TABS.PSYCHOMETRIC,
  COUNSELLING_REPORT_TABS.REPORT,
];

/**
 * The tab a link asked for, or the first — the Psychometric Result the report leads with — when it
 * asked for none or for one that does not exist.
 *
 * @param order the tabs this screen actually has; the parent's three when not given
 */
export function counsellingReportTab(requested, order = COUNSELLING_REPORT_TAB_ORDER) {
  return order.includes(requested)
    ? requested
    : COUNSELLING_REPORT_TAB_ORDER[0];
}
