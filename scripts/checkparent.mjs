// Parent panel port checker.
//
//   node scripts/checkparent.mjs
//
// WHY THIS EXISTS. The parent port is mid-flight: some tiles are native, the rest still open the
// website through app/parent/feature.js. That mixed state is exactly where silent breakage lives —
// a tile flipped to `native:` with no route file, a route registered in the layout with no file
// behind it (an expo-router unmatched route), or a menu that has quietly drifted from the web
// sidebar it mirrors. None of those fail a build: `expo export` and `checkscope.js` see an unbound
// NAME, never a missing FILE or a wrong ORDER.
//
// It also guards the two things this port got wrong once already and would not notice again:
// the local-vs-UTC date shift in multi-day events, and counting attendance by keys instead of
// values.
//
// Exit code 0 = pass.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const WEB = path.resolve(APP, '..', 'frontendmain');
const ROUTES = path.join(APP, 'app', 'parent');

/** Files this checker reads as text (not evaluated). */
const SRC = {
  reportBody: 'components/staff/counsellor/ReportBody.js',
  staffReport: 'components/staff/CounsellorReportScreen.js',
  parentReport: 'components/parent/CounsellorReportScreen.js',
  parentLogin: 'app/auth/parent-login.js',
  authService: 'services/authService.js',
  analyticsBody: 'components/student/analytics/AnalyticsBody.js',
  studentAnalyticsScreen: 'components/student/AnalyticsScreen.js',
  parentAnalyticsScreen: 'components/parent/AcademicProgressScreen.js',
  parentAnalyticsService: 'services/parent/analyticsService.js',
  studentAnalyticsService: 'services/student/analyticsService.js',
  parentAccess: 'services/parent/accessService.js',
  feeService: 'services/parent/feeService.js',
  feesScreen: 'components/parent/FeesScreen.js',
  activitiesService: 'services/parent/activitiesService.js',
  chatSheet: 'components/staff/ShreyaChatSheet.js',
  chatLauncher: 'components/staff/ShreyaLauncher.js',
  parentShreya: 'services/parent/shreyaService.js',
  teacherShreya: 'services/teacher/shreyaService.js',
  shreyaApi: 'services/shreyaApi.js',
  parentMenuScreen: 'components/parent/ParentMenuScreen.js',
  chatbotConfig: 'constants/parentChatbotConfig.js',
};

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`  ✗ ${msg}`);
};
const ok = (msg) => console.log(`  ✓ ${msg}`);

// Mixed line endings live in this repo; normalise so source assertions cannot fail on that alone.
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

/** Stage the import-free constants as .mjs so they can be evaluated, not grepped. */
async function loadMenu(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'parent-'));
  let src = read(path.join(APP, 'constants', 'parentMenu.js'));
  if (mutate) src = mutate(src);
  fs.writeFileSync(path.join(dir, 'parentMenu.mjs'), src);
  return import(pathToFileURL(path.join(dir, 'parentMenu.mjs')).href + `?t=${Math.random()}`);
}

/**
 * Stage the calendar service with a stubbed transport, so its date maths is CALLED rather than
 * read. Its own utils/dates import is staged too — the fix for the UTC bug depends on it.
 */
/** The fee readers are pure but sit beside `parentApi` calls, so the transport is stubbed. */
async function loadFeeService(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'parentfee-'));
  fs.writeFileSync(
    path.join(dir, 'stub.mjs'),
    'export const parentApi = { get: async () => ({}), post: async () => ({}) }; export default parentApi;',
  );
  let src = read(path.join(APP, 'services', 'parent', 'feeService.js'));
  if (mutate) src = mutate(src);
  src = src.replace("from '../parentApi'", "from './stub.mjs'");
  fs.writeFileSync(path.join(dir, 'feeService.mjs'), src);
  return import(pathToFileURL(path.join(dir, 'feeService.mjs')).href + `?t=${Math.random()}`);
}

async function loadCalendar(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'parentcal-'));
  fs.mkdirSync(path.join(dir, 'utils'), { recursive: true });
  fs.copyFileSync(path.join(APP, 'utils', 'dates.js'), path.join(dir, 'utils', 'dates.mjs'));
  fs.writeFileSync(
    path.join(dir, 'stub.mjs'),
    'export const parentApi = { get: async () => [] };\nexport default parentApi;\n',
  );
  let src = read(path.join(APP, 'services', 'parent', 'calendarService.js'));
  if (mutate) src = mutate(src);
  src = src
    .replace("from '../parentApi'", "from './stub.mjs'")
    .replace("from '../../utils/dates'", "from './utils/dates.mjs'");
  fs.writeFileSync(path.join(dir, 'calendarService.mjs'), src);
  return import(pathToFileURL(path.join(dir, 'calendarService.mjs')).href + `?t=${Math.random()}`);
}

/** The web sidebar is the source of truth for the item set — extracted, never retyped. */
/**
 * The chatbot section table and the link resolver, EVALUATED — not read.
 *
 * Reading would not have caught the bug this checker exists for: the sheet built its "Open …"
 * button as basePath + ChapterLink.route, and the parent backend emits an absolute web path there
 * while the teacher backend emits a bare suffix. That produced
 * /parent/parent/platform/dashboard/attendance, which reads fine and navigates nowhere.
 */
async function loadChatbot(mutate) {
  const dataFile = path.join(APP, 'constants', 'parentChatbotData.js');
  if (!mutate) return import(pathToFileURL(dataFile).href);

  // Mutations run against a scratch copy, so the tree on disk is never touched.
  const tmp = path.join(APP, 'constants', `.__chk_${Math.random().toString(36).slice(2)}.js`);
  fs.writeFileSync(tmp, mutate(read(dataFile)));
  try {
    return await import(pathToFileURL(tmp).href);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

/** The 11 sections as the WEB declares them — the source of truth for keys and link targets. */
function webChatbotSections() {
  const src = read(
    path.join(WEB, 'src', 'Parent', 'platform', 'components', 'ParentChatbot', 'parentChatbotData.js'),
  );
  const out = [];
  for (const m of src.matchAll(/sectionKey:\s*"([^"]+)",\s*route:\s*"([^"]+)"/g)) {
    out.push({ sectionKey: m[1], route: m[2] });
  }
  return out;
}

/** Every route the parent backend can put in a ChapterLink, read out of the Java service. */
function backendLinkRoutes() {
  const src = read(
    path.resolve(
      APP, '..', 'backendmain', 'src', 'main', 'java', 'com', 'shreyartha', 'backend',
      'infrastructure', 'shreya', 'ParentShreyaContextService.java',
    ),
  );
  const prefix = src.match(/PARENT_DASHBOARD_ROUTE\s*=\s*"([^"]+)"/)?.[1];
  const routes = [];
  for (const m of src.matchAll(/parentPageLink\(\s*"[^"]*",\s*"([^"]*)"\s*\)/g)) {
    routes.push({ full: (prefix || '') + m[1], suffix: m[1] });
  }
  return { prefix, routes };
}

/** Every screen that actually exists under app/parent/, by route name. */
function routeNames() {
  return new Set(
    fs
      .readdirSync(ROUTES)
      .filter((f) => f.endsWith('.js') && f !== '_layout.js')
      .map((f) => f.replace(/\.js$/, '')),
  );
}

function webSidebarItems() {
  const src = read(path.join(WEB, 'src', 'Parent', 'platform', 'ParentLayout.js'));
  const block = src.slice(src.indexOf('const SIDEBAR_ITEMS'), src.indexOf('export default'));
  const items = [];
  for (const m of block.matchAll(/key:\s*"([^"]+)",\s*label:\s*"([^"]+)"/g)) {
    items.push({ key: m[1], label: m[2] });
  }
  return items;
}

/**
 * Code with comments removed.
 *
 * Every source assertion below must run through this. Twice now a check has failed on correct code
 * because the file's own docblock NAMED the thing it was explaining it does not use — ReportBody
 * naming `hydrateForm`, and the parent access service naming `studentApi` and `role-access` in the
 * long comment about why it avoids both. A checker that fires on documentation is worse than none:
 * it trains you to ignore it.
 */
const codeOnly = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function loadSources(mutate) {
  const out = {};
  for (const [key, rel] of Object.entries(SRC)) {
    out[key] = mutate ? mutate(key, read(path.join(APP, rel))) : read(path.join(APP, rel));
  }
  return out;
}

function assertions(menu, calendar, layoutSrc, src, fee, chatbot, routeNames) {
  const out = [];
  const bad = (m) => out.push(m);
  const { PARENT_MENU, PARENT_HEADER_ACTIONS } = menu;

  // ── 1. the menu still mirrors the web sidebar ─────────────────────────────
  const web = webSidebarItems();
  // Ten since Notifications joined the web sidebar (the parent inbox); the app menu carries it too.
  if (web.length !== 10) bad(`web sidebar extractor found ${web.length} items, expected 10`);

  // "home" is deliberately absent: the tile grid IS home, and its header already shows the child
  // card that page renders. Everything else must be present, in order.
  const expected = web.filter((i) => i.key !== 'home');
  const gotKeys = PARENT_MENU.map((i) => i.key).join(',');
  const wantKeys = expected.map((i) => i.key).join(',');
  if (gotKeys !== wantKeys) {
    bad(`menu keys/order differ.\n      app: ${gotKeys}\n      web: ${wantKeys}`);
  }
  if (PARENT_MENU.some((i) => i.key === 'home')) {
    bad('a "home" tile is back on the home screen — it navigates to the card already above it');
  }
  for (const item of expected) {
    const mine = PARENT_MENU.find((i) => i.key === item.key);
    if (mine && mine.label !== item.label) {
      bad(`label drift on "${item.key}": app "${mine.label}" vs web "${item.label}"`);
    }
  }
  if (!PARENT_HEADER_ACTIONS.some((a) => a.key === 'changePassword')) {
    bad('Change Password is missing from the header actions');
  }

  // ── 2. every native tile has a route file AND a Stack.Screen ──────────────
  const shellRoutes = ['index', 'pending-verification', 'change-password', 'feature'];
  const nativeNames = [...PARENT_MENU, ...PARENT_HEADER_ACTIONS]
    .filter((i) => i.native)
    .map((i) => i.native.split('/').pop());

  for (const name of [...nativeNames, ...shellRoutes]) {
    if (!fs.existsSync(path.join(ROUTES, `${name}.js`))) {
      bad(`route /parent/${name} has no file`);
    } else if (!new RegExp(`name="${name}"`).test(layoutSrc)) {
      bad(`/parent/${name} is not registered as a Stack.Screen — an unmatched route`);
    }
  }

  // A Stack.Screen with no file is the same bug from the other direction.
  for (const m of layoutSrc.matchAll(/<Stack\.Screen name="([^"]+)"/g)) {
    if (!fs.existsSync(path.join(ROUTES, `${m[1]}.js`))) {
      bad(`_layout registers "${m[1]}" but app/parent/${m[1]}.js does not exist`);
    }
  }

  // THE PANEL IS FULLY NATIVE. Every tile must be `native:`; the WebView bridge survives only for
  // the fee checkout, which is reached from inside FeesScreen and is not a menu item.
  const webviewTiles = PARENT_MENU.filter((i) => !i.native);
  if (webviewTiles.length) {
    bad(`${webviewTiles.length} tile(s) still on WebView: ${webviewTiles.map((i) => i.key).join(', ')}`);
  }

  // ── 3. the two date bugs this port already made once ──────────────────────
  const range = calendar.dateRangeKeys({
    startDateTime: '2026-08-20',
    endDateTime: '2026-08-22',
  });
  if (range.join(',') !== '2026-08-20,2026-08-21,2026-08-22') {
    bad(
      `multi-day events are shifted: got ${range.join(',')} — toISOString() converts local ` +
        'midnight to UTC, which is the previous day in IST',
    );
  }
  const rolled = calendar.dateRangeKeys({
    startDateTime: '2026-08-30',
    endDateTime: '2026-09-02',
  });
  if (rolled.length !== 4) bad(`a range across a month boundary lost days: ${rolled.join(',')}`);

  const summary = calendar.summariseAttendance({ a: 'PRESENT', b: null, c: 'ABSENT', d: null });
  if (summary.marked !== 2 || summary.present !== 1) {
    bad(
      `attendance is counted by keys, not values: ${JSON.stringify(summary)} — every day of the ` +
        'month is a key with null when unmarked',
    );
  }

  // ── 4. holiday detection keeps all four signals ───────────────────────────
  const holidaySignals = [
    { source: 'NATIONAL_HOLIDAY' },
    { isHoliday: true },
    { type: 'holiday' },
    { title: 'Diwali Holiday' },
  ];
  if (!holidaySignals.every((e) => calendar.isHolidayEvent(e))) {
    bad('isHolidayEvent lost one of its four signals — the field carrying it varies by source');
  }
  if (calendar.isHolidayEvent({ title: 'Sports Day' })) {
    bad('isHolidayEvent treats an ordinary event as a holiday');
  }

  // ── 5. the shared report body (P3) ────────────────────────────────────────
  const bodyCode = codeOnly(src.reportBody);
  //
  // The body was extracted out of the staff screen so the parent renders the identical ten
  // sections. Both of these must keep importing it, or the extraction is quietly un-shared and the
  // two copies start to drift — which is the whole thing it was done to prevent.
  if (!/from '\.\/counsellor\/ReportBody'/.test(codeOnly(src.staffReport))) {
    bad('the staff Counsellor Report no longer imports the shared ReportBody');
  }
  if (!/ReportBody/.test(codeOnly(src.parentReport))) {
    bad('the parent Counsellor Report no longer renders the shared ReportBody');
  }

  // The staff DTO calls the author `createdByName`; the parent DTO calls it `counsellorName`.
  // Reading only one makes the author silently vanish on the other portal.
  if (!/report\.counsellorName \|\| report\.createdByName/.test(bodyCode)) {
    bad('ReportBody no longer falls back across both DTO spellings of the author name');
  }

  // A read-only body must never turn "not assessed" into "rated zero".
  //
  // This used to be a blanket ban on `hydrateForm`, on the grounds that it backfills 0/''/[].
  // That ban is gone, because the report now spans TWO tables — the ten checkpoint sections in
  // `formData` and the AI narrative on the linked activity row — and hydrateForm's second
  // argument is the only thing that merges them. Banning it would have meant either duplicating
  // the merge or dropping section 11 from the read-only view.
  //
  // What the ban was actually protecting is asserted directly instead: every renderer must treat
  // a blank as an em-dash. `Stars` is the only one where a backfilled 0 could have read as a real
  // value, so its guard is pinned by name.
  if (!/parseReportForm/.test(bodyCode)) bad('ReportBody does not use parseReportForm');
  if (!/if \(n <= 0\) return/.test(bodyCode)) {
    bad('ReportBody\'s Stars no longer renders an em-dash for 0 — a backfilled rating would read as "rated zero"');
  }

  // Section 11 is the AI narrative, and it is only shown once the counsellor has PUBLISHED it.
  // An unreviewed draft about a child must not reach a parent because a client forgot to check.
  if (!/status === 'PUBLISHED'/.test(bodyCode)) {
    bad('ReportBody no longer gates the Griffin section on PUBLISHED — parents could see an unreviewed AI draft');
  }
  // Merely mentioning FORM_DATA_SECTIONS is not enough — `[...FORM_DATA_SECTIONS, GRIFFIN_SECTION]`
  // contains it too and shows section 11 unconditionally. The invariant is that the list is
  // CHOSEN by the publish flag.
  // The SECTION LIST specifically — not merely a mention of griffinVisible, which also appears on
  // the hydrateForm line and would keep a broken version passing.
  if (!/sections\s*=\s*griffinVisible\s*\?/.test(bodyCode)) {
    bad('ReportBody no longer chooses its section list on griffinVisible — section 11 would always render');
  }

  // The style split must stay clean: no body key left behind, no picker key dragged along.
  const bodyOnly = ['starRow', 'pillYes', 'chipWrap', 'gauges', 'reportTitle'];
  const pickerOnly = ['studentChip', 'schoolPicker', 'strip'];
  for (const key of bodyOnly) {
    if (new RegExp(`^  ${key}:`, 'm').test(src.staffReport)) {
      bad(`body style "${key}" was left behind in the staff screen`);
    }
    if (!new RegExp(`^  ${key}:`, 'm').test(src.reportBody)) {
      bad(`body style "${key}" did not make it into ReportBody`);
    }
  }
  for (const key of pickerOnly) {
    if (new RegExp(`^  ${key}:`, 'm').test(src.reportBody)) {
      bad(`picker style "${key}" was dragged into ReportBody`);
    }
  }

  // ── 6. parent sign-up (P3) ────────────────────────────────────────────────
  if (!/signupParent/.test(codeOnly(src.authService))) bad('authService has no signupParent');
  if (!/signupParent/.test(codeOnly(src.parentLogin))) bad('the parent login has no sign-up');
  // The terms box gates the button but is NOT a field on ParentSignupRequest.
  if (/terms:\s*signup\.terms/.test(src.parentLogin)) {
    bad('the parent signup payload sends `terms` — the backend DTO has no such field');
  }
  // Signup returns no token; entering the panel would land on a pending-verification dead end.
  if (/signupParent[\s\S]{0,600}router\.replace\('\/parent'\)/.test(src.parentLogin)) {
    bad('the parent signup navigates into the panel — it issues NO token, so it must return to Login');
  }
  // Every style the sign-up form references must exist. A missing key is `undefined`, which RN
  // silently accepts as a no-op — the build stays green and the form renders unstyled.
  for (const m of src.parentLogin.matchAll(/styles\.([a-zA-Z][a-zA-Z0-9]*)/g)) {
    if (!new RegExp(`^  ${m[1]}:`, 'm').test(src.parentLogin)) {
      bad(`parent login references styles.${m[1]}, which is not defined`);
    }
  }

  // ── 7. the shared analytics body (P4) ─────────────────────────────────────
  for (const [key, who] of [['studentAnalyticsScreen', 'student'], ['parentAnalyticsScreen', 'parent']]) {
    if (!/AnalyticsBody/.test(codeOnly(src[key]))) {
      bad(`the ${who} analytics screen no longer renders the shared AnalyticsBody`);
    }
  }

  // The cards MUST be injected by each portal. StudentCard is translucent — tuned for the student
  // panel's photographic background — and on the parent's opaque slate page it is near-invisible.
  // A default inside the body would render a screen that is correct and unreadable.
  if (/Card\s*=\s*(StudentCard|Card)[,\s}]/.test(codeOnly(src.analyticsBody))) {
    bad('AnalyticsBody defaults its Card prop — each portal must pass its own');
  }
  if (!/Card=\{StudentCard\}/.test(codeOnly(src.studentAnalyticsScreen))) {
    bad('the student analytics screen does not pass its translucent StudentCard');
  }
  if (!/showPsychometric=\{false\}/.test(codeOnly(src.parentAnalyticsScreen))) {
    bad('the parent analytics screen renders the psychometric section — that lives on its own tab, and the parent DTO is a different shape');
  }

  // ── 8. namespaces must not cross ──────────────────────────────────────────
  if (/\/api\/student/.test(codeOnly(src.parentAnalyticsService))) {
    bad('the parent analytics service reaches a /api/student path');
  }
  if (/\/api\/parent/.test(codeOnly(src.studentAnalyticsService))) {
    bad('the student analytics service reaches a /api/parent path');
  }
  // The body reads parts BY NAME, so the two services must agree on the keys.
  const keysOf = (text) => {
    const block = text.slice(text.indexOf('settleAll({'), text.indexOf('});', text.indexOf('settleAll({')));
    return new Set([...block.matchAll(/^\s{4}([a-zA-Z]+):/gm)].map((m) => m[1]));
  };
  const parentKeys = keysOf(codeOnly(src.parentAnalyticsService));
  const studentKeys = keysOf(codeOnly(src.studentAnalyticsService));
  for (const key of ['syllabus', 'progress', 'learningGaps', 'competitive', 'coding', 'skillsProfile', 'skillsProgress']) {
    if (!parentKeys.has(key)) bad(`the parent analytics map is missing the "${key}" key AnalyticsBody reads`);
    if (!studentKeys.has(key)) bad(`the student analytics map is missing the "${key}" key AnalyticsBody reads`);
  }

  // ── 9. THE TOKEN LANDMINE ─────────────────────────────────────────────────
  //
  // The single most valuable assertion in this phase. studentApi reads studentToken/userToken/
  // accessToken/token. Used under a parent session on a device where a student has ALSO signed in,
  // it picks up the stale student token — and if that token has expired, its 401 path wipes
  // ALL_AUTH_KEYS and redirects to the STUDENT login, throwing the parent out of their own portal.
  for (const key of ['parentAccess', 'parentAnalyticsService']) {
    const code = codeOnly(src[key]);
    if (/studentApi/.test(code)) {
      bad(`${SRC[key]} imports studentApi — under a parent session that can read a stale student token and log the parent out`);
    }
    if (!/parentApi/.test(code)) bad(`${SRC[key]} does not use parentApi`);
  }
  // Role access is a student-plan concept on a student-only endpoint; the parent page does not use it.
  if (/role-access/.test(codeOnly(src.parentAccess))) {
    bad('the parent access service reaches role-access — that endpoint is student-only');
  }

  // ── 10. fees (P5) ─────────────────────────────────────────────────────────
  const feeCode = codeOnly(src.feeService);
  const feesCode = codeOnly(src.feesScreen);

  // The web can print >100% when overpaid and NaN% when the total is zero.
  for (const [label, input, want] of [
    ['no record', { enrolled: false }, 0],
    ['zero total', { totalAmount: 0, paidAmount: 0 }, 0],
    ['overpaid', { totalAmount: 100, paidAmount: 140 }, 100],
    ['half paid', { totalAmount: 100, paidAmount: 50 }, 50],
    ['fully paid', { totalAmount: 100, paidAmount: 100 }, 100],
  ]) {
    const got = fee.paidPercent(input);
    if (got !== want) bad(`paidPercent(${label}) = ${got}, expected ${want}`);
  }

  // ONLINE payments never set paymentDate; createdAt may be ISO or an epoch number.
  if (fee.paymentDate({ paymentDate: '2026-08-20' }) !== '2026-08-20') {
    bad('paymentDate ignores an explicit paymentDate');
  }
  if (fee.paymentDate({ createdAt: '2026-08-20T10:00:00Z' }) !== '2026-08-20') {
    bad('paymentDate does not fall back to an ISO createdAt');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fee.paymentDate({ createdAt: 1755676800000 }))) {
    bad('paymentDate breaks on a numeric (epoch) createdAt — the web split("T") does too');
  }

  // The `{enrolled:false}` shape is ONE key; reading totals without the guard yields undefined.
  if (!/enrolled/.test(feesCode)) bad('the fees screen never checks `enrolled`');
  // The hand-off param is `label` for the parent; `title` yields the fallback header.
  if (/params:\s*\{\s*title:/.test(feesCode)) {
    bad('the fee checkout hand-off passes `title` — app/parent/feature.js reads `label`');
  }
  if (!/label: 'School Fees'/.test(feesCode)) bad('the fee checkout hand-off does not pass a label');
  if (!/paidPercent/.test(feesCode)) {
    bad('the fees screen computes its own percentage instead of the clamped, zero-guarded reader');
  }

  // ── 11. learning activities (P5) ──────────────────────────────────────────
  const actCode = codeOnly(src.activitiesService);
  if (!/learning-activities/.test(actCode)) {
    bad('the activities service does not call the composite endpoint');
  }
  // The five paths the website calls that 404. Porting any of them ships a dead tab.
  for (const dead of [
    'resources/subjects/',
    'resources/resources/',
    'resources/homework/',
    'personalised-resources',
  ]) {
    if (actCode.includes(dead)) {
      bad(`the activities service reaches "${dead}" — that endpoint does not exist on the backend`);
    }
  }
  // `assignedDate` exists only on personalised resources; `completed`, not `isCompleted`.
  if (!/assignedDate \|\| resource\?\.createdAt/.test(actCode)) {
    bad('activityDate does not fall back to createdAt — teacher resources have no assignedDate');
  }
  if (/isCompleted:/.test(actCode) || /\.isCompleted/.test(actCode)) {
    bad('the activities service reads `isCompleted` — Jackson serialises that field as `completed`');
  }

  // ── 9. the Shreya chatbot (P7) ────────────────────────────────────────────
  const { PARENT_SECTIONS } = chatbot;
  const webSections = webChatbotSections();

  if (webSections.length !== 11) {
    bad(`web chatbot extractor found ${webSections.length} sections, expected 11`);
  }

  // A renamed or reordered sectionKey breaks grounding SERVER-SIDE and silently: the backend's
  // switch falls through to the child overview, so every section answers about the same thing.
  const gotSectionKeys = PARENT_SECTIONS.map((x) => x.sectionKey).join(',');
  const wantSectionKeys = webSections.map((x) => x.sectionKey).join(',');
  if (gotSectionKeys !== wantSectionKeys) {
    bad(`chatbot sectionKeys drifted from the web\n      got:  ${gotSectionKeys}\n      want: ${wantSectionKeys}`);
  }

  // Each web `route` becomes a suffix against /parent, and every one must be a real native screen.
  for (let i = 0; i < PARENT_SECTIONS.length; i += 1) {
    const section = PARENT_SECTIONS[i];
    const web = webSections[i];
    if (!web) continue;
    const wantSuffix = web.route.replace('/parent/platform/dashboard', '');
    if (section.routeSuffix !== wantSuffix) {
      bad(`chatbot section "${section.sectionKey}" has routeSuffix "${section.routeSuffix}", web says "${wantSuffix}"`);
    }
    const screen = section.routeSuffix ? section.routeSuffix.replace(/^\//, '') : 'index';
    if (!routeNames.has(screen)) {
      bad(`chatbot section "${section.sectionKey}" points at /parent${section.routeSuffix} — no such screen`);
    }
  }

  // ── the ChapterLink shape trap ────────────────────────────────────────────
  // The teacher backend emits a bare suffix here; the parent backend emits a full web path. The
  // sheet navigates basePath + whatever it is given, so an unconverted parent route lands on
  // /parent/parent/platform/dashboard/... — a route that does not exist and never errors.
  const { prefix, routes } = backendLinkRoutes();
  if (prefix !== '/parent/platform/dashboard') {
    bad(`PARENT_DASHBOARD_ROUTE is now "${prefix}" — the resolver's prefix is stale`);
  }
  if (routes.length !== 4) {
    bad(`expected 4 parentPageLink() call sites in the Java service, found ${routes.length}`);
  }
  for (const r of routes) {
    const resolved = chatbot.resolveParentLink(r.full);
    if (resolved !== r.suffix) {
      bad(`resolveParentLink("${r.full}") = ${JSON.stringify(resolved)}, expected "${r.suffix}"`);
    }
    const screen = r.suffix ? r.suffix.replace(/^\//, '') : 'index';
    if (!routeNames.has(screen)) bad(`ChapterLink route ${r.full} has no native screen`);
  }
  // A student/web route the parent app cannot open must be dropped, not navigated to.
  if (chatbot.resolveParentLink('/student/platform/skillsedge') !== null) {
    bad('resolveParentLink accepts a non-parent route — the "Open …" button would go nowhere');
  }

  // ── transport ─────────────────────────────────────────────────────────────
  const parentSvc = codeOnly(src.parentShreya);
  if (!parentSvc.includes('/api/parent/shreya')) {
    bad('the parent Shreya service does not target /api/parent/shreya');
  }
  if (parentSvc.includes('/api/teacher/shreya') || parentSvc.includes('staffApi')) {
    bad('the parent Shreya service reaches for the TEACHER namespace or the staff client');
  }
  if (!codeOnly(src.teacherShreya).includes('/api/teacher/shreya')) {
    bad('the teacher Shreya service no longer targets /api/teacher/shreya');
  }
  if (!/CHAT_HISTORY_WINDOW\s*=\s*8/.test(codeOnly(src.shreyaApi))) {
    bad('CHAT_HISTORY_WINDOW is no longer 8 — the web sends the last 8 turns');
  }

  // ── the sheet is portal-agnostic ──────────────────────────────────────────
  const sheet = codeOnly(src.chatSheet);
  if (sheet.includes('parentChatbotData') || sheet.includes('parentApi')) {
    bad('ShreyaChatSheet imports parent code directly instead of taking it from config');
  }
  for (const [prop, dflt] of [
    ['sections', 'teacherSections'],
    ['buildExplanation', 'buildSectionExplanation'],
    ['service', 'teacherShreya'],
  ]) {
    if (!sheet.includes(`config?.${prop} || ${dflt}`)) {
      bad(`ShreyaChatSheet no longer takes \`${prop}\` from config with the teacher default`);
    }
  }
  if (!sheet.includes('toPageLink(data?.chapterLink)') || sheet.includes('goTo(msg.pageLink.route)')) {
    bad('ShreyaChatSheet navigates ChapterLink.route raw — the parent path would be double-prefixed');
  }
  // Autofocus inside an Android Modal reintroduces the documented keyboard-dismiss bug.
  if (/autoFocus/.test(sheet)) bad('ShreyaChatSheet has autoFocus — that breaks the Android keyboard');
  // Teal-in-a-purple-portal: the sheet and launcher must take the surrounding palette.
  for (const [key, label] of [['chatSheet', 'ShreyaChatSheet'], ['chatLauncher', 'ShreyaLauncher']]) {
    const code = codeOnly(src[key]);
    if (code.includes('PORTALS.school')) bad(`${label} hardcodes PORTALS.school — it stays teal inside the parent portal`);
    if (!code.includes('usePalette')) bad(`${label} does not read the portal palette`);
  }

  // ── mounted, with the parent's config ─────────────────────────────────────
  const home = codeOnly(src.parentMenuScreen);
  if (!codeOnly(src.chatbotConfig).includes('resolveLink: resolveParentLink')) {
    bad('PARENT_CHATBOT_CONFIG does not pass resolveParentLink — the sheet falls back to identity');
  }

  // THE FAB BECAME A CARD. The dashboard redesign replaced `<ShreyaLauncher />` with the design's
  // "For Support" card, which opens `ShreyaChatSheet` directly. The launcher was only ever mounted
  // on this one screen, so the card has identical reach — but the three things this assertion
  // actually protects are unchanged and are re-asserted here rather than left pointing at a tag
  // that no longer exists:
  //
  //   1. the sheet gets the PARENT's config, or a parent is served the teacher chatbot;
  //   2. it gets basePath="/parent", or every ChapterLink is double-prefixed;
  //   3. it is mounted BELOW the unverified redirect, or an unverified parent reaches a chat the
  //      website denies them.
  //
  // Read the TAG, not the file: `includes('<ShreyaChatSheet')` is also true of a renamed component,
  // and the config's NAME survives deleting the prop because the import line still mentions it.
  // `[\s\S]*?` rather than `[^>]*` because this mount is attribute-per-line.
  const mount = home.match(/<ShreyaChatSheet\b[\s\S]*?\/>/);
  if (!mount) bad('the parent home does not mount ShreyaChatSheet');
  else {
    if (!mount[0].includes('config={PARENT_CHATBOT_CONFIG}')) {
      bad('the parent home mounts the sheet without the parent config — a parent gets the teacher chatbot');
    }
    if (!mount[0].includes('basePath="/parent"')) bad('the parent chat does not pass basePath="/parent"');

    // The mount must sit after the redirect, or an unverified parent gets a chatbot the web denies.
    //
    // THE REDIRECT'S PRESENCE IS ASSERTED FIRST, and that is not padding. The previous version was
    // a bare `mount.index < home.indexOf(...)`, so DELETING the redirect made `indexOf` return -1
    // and the comparison false — the check passed precisely when the gate was gone. Reading the
    // `<Redirect>` tag rather than the bare string also stops a mention in prose from satisfying it.
    const gate = home.search(/<Redirect\b[^>]*pending-verification/);
    if (gate < 0) {
      bad('the unverified-parent redirect is gone — an unverified parent would reach the dashboard');
    } else if (mount.index < gate) {
      bad('ShreyaChatSheet is mounted before the unverified-parent redirect');
    }
    // The card is the only way in now, so it has to be there.
    if (!/<AssistantCard\b/.test(home)) {
      bad('the parent home has no Shreya card — the chat sheet has nothing to open it');
    }
  }

  return out;
}

const MUTATIONS = [
  {
    name: 'a tile pointed at a route file that does not exist',
    menu: (s) => s.replace("native: '/parent/counselor-notes'", "native: '/parent/nowhere'"),
  },
  {
    name: 'a tile reverted to WebView',
    menu: (s) =>
      s.replace("native: '/parent/fees' }", "path: `${PARENT_BASE}/fees` }"),
  },
  {
    name: 'a menu item dropped',
    menu: (s) => s.replace(/^.*key: 'attendance'.*$/m, ''),
  },
  {
    name: 'a label reworded away from the web sidebar',
    menu: (s) => s.replace("label: 'School Fees'", "label: 'Fees'"),
  },
  {
    name: 'the redundant Home tile added back',
    menu: (s) =>
      s.replace(
        "export const PARENT_MENU = [",
        "export const PARENT_MENU = [\n  { key: 'home', label: 'Home', icon: 'home-outline', native: '/parent/home' },",
      ),
  },
  {
    name: 'the UTC date shift reintroduced in multi-day events',
    calendar: (s) => s.replace('keys.push(toIsoDate(cursor));', 'keys.push(toDateKey(cursor.toISOString()));'),
  },
  {
    name: 'attendance counted by keys instead of values',
    calendar: (s) =>
      s.replace(
        'Object.values(map || {}).forEach((status) => {',
        'Object.keys(map || {}).forEach((status) => {',
      ),
  },
  {
    name: 'a holiday signal removed',
    calendar: (s) => s.replace("if (event.isHoliday === true) return true;", ''),
  },
  {
    name: 'the author-name fallback reduced to the staff spelling',
    src: (k, s) =>
      k === 'reportBody'
        ? s.replace('report.counsellorName || report.createdByName', 'report.createdByName')
        : s,
  },
  {
    name: 'ReportBody stops parsing the saved form',
    src: (k, s) => (k === 'reportBody' ? s.replace(/parseReportForm/g, 'noSuchHelper') : s),
  },
  {
    name: 'a backfilled rating of 0 starts rendering as "rated zero"',
    src: (k, s) => (k === 'reportBody' ? s.replace('if (n <= 0) return', 'if (n < 0) return') : s),
  },
  {
    name: 'the Griffin publish gate is dropped from the read-only body',
    src: (k, s) =>
      k === 'reportBody' ? s.replace("griffin?.status === 'PUBLISHED'", '!!griffin') : s,
  },
  {
    name: 'the read-only body maps every section, published or not',
    src: (k, s) =>
      k === 'reportBody'
        ? s.replace(
            'const sections = griffinVisible ? [...FORM_DATA_SECTIONS, GRIFFIN_SECTION] : FORM_DATA_SECTIONS;',
            'const sections = [...FORM_DATA_SECTIONS, GRIFFIN_SECTION];',
          )
        : s,
  },
  {
    name: 'the extraction un-shared (staff screen inlines it again)',
    src: (k, s) =>
      k === 'staffReport' ? s.replace("from './counsellor/ReportBody'", "from './Nowhere'") : s,
  },
  {
    name: 'a body style left behind in the staff screen',
    src: (k, s) => (k === 'staffReport' ? s.replace('  pickers: {', '  starRow: {') : s),
  },
  {
    name: 'the signup payload sends the terms flag',
    src: (k, s) =>
      k === 'parentLogin'
        ? s.replace('password: signup.password,', 'terms: signup.terms, password: signup.password,')
        : s,
  },
  {
    name: 'the parent access service switched to studentApi (the token landmine)',
    src: (k, s) => (k === 'parentAccess' ? s.replace(/parentApi/g, 'studentApi') : s),
  },
  {
    name: 'the parent analytics service reaching a student path',
    src: (k, s) =>
      k === 'parentAnalyticsService'
        ? s.replace('${BASE}/syllabus-completion', '/api/students/syllabus-completion')
        : s,
  },
  {
    name: 'a settleAll key renamed (silently empties that section)',
    src: (k, s) =>
      k === 'parentAnalyticsService' ? s.replace('    coding: parentApi', '    codingPro: parentApi') : s,
  },
  {
    name: 'the parent rendering the psychometric section',
    src: (k, s) =>
      // replaceAll, not replace: the FIRST occurrence is in the screen's docblock, so a
      // single replace mutates the comment and leaves the real prop in place.
      k === 'parentAnalyticsScreen' ? s.replaceAll('showPsychometric={false}', '') : s,
  },
  {
    name: 'the analytics extraction un-shared',
    src: (k, s) => (k === 'parentAnalyticsScreen' ? s.replace(/AnalyticsBody/g, 'Nothing') : s),
  },
  {
    name: 'the student screen no longer passing its translucent card',
    src: (k, s) =>
      k === 'studentAnalyticsScreen' ? s.replace('Card={StudentCard}', 'Card={null}') : s,
  },
  {
    name: 'the paid percentage unclamped (overpaid prints >100%)',
    fee: (s) => s.replace('Math.max(0, Math.min(100, Math.round((paid / total) * 100)))', 'Math.round((paid / total) * 100)'),
  },
  {
    name: 'the zero-total divide guard removed (prints NaN%)',
    fee: (s) => s.replace('if (total <= 0) return 0;', ''),
  },
  {
    name: 'paymentDate no longer falling back to createdAt',
    fee: (s) => s.replace("if (payment?.paymentDate) return String(payment.paymentDate).slice(0, 10);", "return String(payment?.paymentDate || '').slice(0, 10);"),
  },
  {
    name: 'the fee hand-off passing `title` instead of `label`',
    src: (k, s) =>
      k === 'feesScreen' ? s.replace("label: 'School Fees'", "title: 'School Fees'") : s,
  },
  {
    name: 'the activities service reaching one of the five 404 paths',
    src: (k, s) =>
      k === 'activitiesService'
        ? s.replace("'/api/parent/dashboard/learning-activities'", "'/api/parent/dashboard/personalised-resources'")
        : s,
  },
  {
    name: 'activityDate no longer falling back to createdAt',
    src: (k, s) =>
      k === 'activitiesService'
        ? s.replace('resource?.assignedDate || resource?.createdAt || null', 'resource?.assignedDate || null')
        : s,
  },
  {
    name: 'a sign-up style key deleted (renders unstyled, build stays green)',
    src: (k, s) => (k === 'parentLogin' ? s.replace('  tabRow: {', '  tabRowGone: {') : s),
  },

  /* ── P7, the Shreya chatbot ─────────────────────────────────────────────── */
  {
    name: 'a chatbot sectionKey renamed (the server silently grounds on the wrong section)',
    chatbot: (s) => s.replace('sectionKey: "attendance"', 'sectionKey: "attendence"'),
  },
  {
    name: 'a chatbot routeSuffix pointed at a screen that does not exist',
    chatbot: (s) => s.replace('routeSuffix: "/fees"', 'routeSuffix: "/school-fees"'),
  },
  {
    name: 'a chatbot routeSuffix silently disagreeing with the web',
    chatbot: (s) => s.replace('routeSuffix: "/attendance"', 'routeSuffix: "/schedule"'),
  },
  {
    name: 'resolveParentLink returning the raw route (the /parent/parent/... double prefix)',
    chatbot: (s) =>
      s.replace('return route.slice(WEB_DASHBOARD_PREFIX.length);', 'return route;'),
  },
  {
    name: 'resolveParentLink accepting a route from another portal',
    chatbot: (s) =>
      s.replace('if (!route.startsWith(WEB_DASHBOARD_PREFIX)) return null;', ''),
  },
  {
    name: 'the parent Shreya service pointed at the teacher namespace',
    src: (k, s) => (k === 'parentShreya' ? s.replace('/api/parent/shreya', '/api/teacher/shreya') : s),
  },
  {
    name: 'the chat history window widened past the 8 turns the web sends',
    src: (k, s) => (k === 'shreyaApi' ? s.replace('CHAT_HISTORY_WINDOW = 8', 'CHAT_HISTORY_WINDOW = 20') : s),
  },
  {
    name: 'ShreyaChatSheet hardwired back to the teacher sections',
    src: (k, s) =>
      k === 'chatSheet' ? s.replace('config?.sections || teacherSections', 'teacherSections') : s,
  },
  {
    name: 'ShreyaChatSheet hardwired back to the teacher transport',
    src: (k, s) => (k === 'chatSheet' ? s.replace('config?.service || teacherShreya', 'teacherShreya') : s),
  },
  {
    name: 'ShreyaChatSheet navigating ChapterLink.route raw again',
    src: (k, s) =>
      k === 'chatSheet'
        ? s
            .replaceAll('toPageLink(data?.chapterLink)', 'data?.chapterLink || null')
            .replace('goTo(msg.pageLink.suffix)', 'goTo(msg.pageLink.route)')
        : s,
  },
  {
    name: 'autoFocus added to the chat input (the Android keyboard-dismiss bug)',
    src: (k, s) => (k === 'chatSheet' ? s.replace('<TextInput', '<TextInput autoFocus') : s),
  },
  {
    name: 'the chat sheet pinned back to the teacher teal',
    src: (k, s) =>
      k === 'chatSheet' ? s.replace('const palette = usePalette();', 'const palette = PORTALS.school;') : s,
  },
  {
    name: 'the launcher FAB pinned back to the teacher teal',
    src: (k, s) => (k === 'chatLauncher' ? s.replaceAll('usePalette', 'PORTALS.school &&') : s),
  },
  {
    name: 'the chat mounted without the parent config (a parent gets the teacher chatbot)',
    src: (k, s) =>
      k === 'parentMenuScreen' ? s.replace('config={PARENT_CHATBOT_CONFIG}', '') : s,
  },
  {
    name: 'the chat not mounted at all',
    src: (k, s) => (k === 'parentMenuScreen' ? s.replace('<ShreyaChatSheet', '<ShreyaChatSheetGone') : s),
  },
  {
    // Deletes the gate outright. This is the case the old bare-indexOf assertion could not see:
    // with the string gone it returned -1 and the ordering comparison went false, so removing the
    // redirect entirely "passed".
    name: 'the unverified-parent redirect deleted (the gate disappears)',
    src: (k, s) =>
      k === 'parentMenuScreen'
        ? s.replace('if (verified === false) return <Redirect href="/parent/pending-verification" />;', '')
        : s,
  },
  {
    name: 'the Shreya card removed, leaving nothing to open the chat',
    src: (k, s) => (k === 'parentMenuScreen' ? s.replace('<AssistantCard', '<NoCard') : s),
  },
  {
    name: 'the parent chat pointed at the teacher base path',
    src: (k, s) => (k === 'parentMenuScreen' ? s.replace('basePath="/parent"', 'basePath="/teacher"') : s),
  },
  {
    name: 'the config no longer passing the link resolver (silently falls back to identity)',
    src: (k, s) => (k === 'chatbotConfig' ? s.replace('resolveLink: resolveParentLink,', '') : s),
  },
];

console.log('Self-tests (each mutation must be caught):');
for (const m of MUTATIONS) {
  let caught;
  try {
    const menu = await loadMenu(m.menu);
    const calendar = await loadCalendar(m.calendar);
    const fee = await loadFeeService(m.fee);
    const chatbot = await loadChatbot(m.chatbot);
    caught =
      assertions(menu, calendar, read(path.join(ROUTES, '_layout.js')), loadSources(m.src), fee, chatbot, routeNames())
        .length > 0;
  } catch {
    caught = true; // a mutation that will not even load is caught, loudly
  }
  if (caught) ok(m.name);
  else fail(`NOT CAUGHT: ${m.name} — the corresponding assertion is vacuous`);
}

console.log('\nParent panel:');
{
  const menu = await loadMenu();
  const calendar = await loadCalendar();
  const problems = assertions(
    menu,
    calendar,
    read(path.join(ROUTES, '_layout.js')),
    loadSources(),
    await loadFeeService(),
    await loadChatbot(),
    routeNames(),
  );
  if (problems.length === 0) {
    const native = menu.PARENT_MENU.filter((i) => i.native).length;
    ok(`${native} of ${menu.PARENT_MENU.length} tiles native; routes, menu and date maths all consistent`);
  } else problems.forEach(fail);
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL — ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
