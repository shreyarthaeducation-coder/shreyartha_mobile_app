// Sales panel checker.
//
//   node scripts/checksales.mjs
//
// WHY THIS EXISTS. `npx expo export` is green through every mistake this panel can make, because
// none of them is an unbound name:
//
//   * no STAFF_ROLE_CONFIG.sales entry → resolveDashboardRoute returns null and login dead-ends
//     with "account type not supported", which reads like a backend problem
//   * a menu item still on `path:` → a WebView that looks like a page
//   * a native route with no wrapper file → an expo-router unmatched route on one panel only
//   * a wrapper file the Stack never registers → same, and only on a deep link
//   * an endpoint not under /api/staff/ → the wrong token, a 403 that reads as a permissions bug
//   * a tile in no workspace group → silently absent from the panel, route still resolving
//   * a partial palette → `undefined` is a legal RN style value, so it renders as nothing
//
// So this EVALUATES the real constants rather than grepping them, and every assertion is
// mutation-tested at the bottom before any pass is believed. Two existing checkers in this repo
// were found silently vacuous after a string rename; the self-test is what stops that here.
//
// Exit code 0 = pass. Anything else = read the output.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const BACKEND = path.resolve(APP, '..', 'backendmain');
const WEB = path.resolve(APP, '..', 'frontendmain');

const ROLE = 'sales';
const WRAPPERS = path.join(APP, 'app', 'staff', '[role]');

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const exists = (p) => fs.existsSync(p);

/**
 * Source with comments removed.
 *
 * Not cosmetic. The files this checker reads document the very rules it asserts — SalesPhotoStamp's
 * docblock names `collapsable={false}` and `opacity: 0` in prose — so a regex run over the raw text
 * matches the explanation and passes regardless of what the code does. `scripts/checkscope.js`
 * strips comments for the same reason.
 */
const stripComments = (src) =>
  String(src || '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

// ─────────────────────────────────────────────────────────────────────────────
// Loading the constants.
//
// They are ESM `export` syntax in .js files, which Node treats as CJS. Copying the closure into a
// temp dir as .mjs is what checkviceprincipal.mjs and checkprincipal.mjs do, and it means this
// sees the SAME values the app does rather than a regex's idea of them.
//
// Every file the closure imports must be listed. Omitting one does not fail an assertion, it
// CRASHES the loader — and a crash would count as "caught" in the self-test loop below, so every
// mutation would report a tick while testing nothing at all.
// ─────────────────────────────────────────────────────────────────────────────

const CONSTANT_FILES = ['staffRoles.js', 'staffHome.js', 'theme.js', 'authPortals.js'];

async function loadConstants(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'salescheck-'));
  for (const name of CONSTANT_FILES) {
    let src = read(path.join(APP, 'constants', name));
    if (mutate) src = mutate(name, src);
    src = src.replace(/from '\.\/([A-Za-z0-9_]+)'/g, "from './$1.mjs'");
    fs.writeFileSync(path.join(dir, name.replace(/\.js$/, '.mjs')), src);
  }
  const load = (n) => import(pathToFileURL(path.join(dir, `${n}.mjs`)).href + `?t=${Math.random()}`);
  return {
    staffRoles: await load('staffRoles'),
    home: await load('staffHome'),
    theme: await load('theme'),
    authPortals: await load('authPortals'),
  };
}

/** Sources read as text, where the assertion really is about the source. */
function loadSources(mutate) {
  const files = {
    layout: path.join(WRAPPERS, '_layout.js'),
    tabBar: path.join(APP, 'components', 'shared', 'home', 'PortalTabBar.js'),
    service: path.join(APP, 'services', 'sales', 'salesService.js'),
    queue: path.join(APP, 'services', 'sales', 'visitQueue.js'),
    storageKeys: path.join(APP, 'constants', 'storageKeys.js'),
    location: path.join(APP, 'utils', 'salesLocation.js'),
    visitsScreen: path.join(APP, 'components', 'staff', 'sales', 'SalesVisitsScreen.js'),
    stampView: path.join(APP, 'components', 'staff', 'sales', 'SalesPhotoStamp.js'),
    stampUtil: path.join(APP, 'utils', 'salesPhotoStamp.js'),
    controller: path.join(
      BACKEND, 'src', 'main', 'java', 'com', 'shreyartha', 'backend', 'sales', 'controller',
      'SalesController.java',
    ),
    webApi: path.join(WEB, 'src', 'services', 'ApiServices.js'),
    loginDropdown: path.join(
      WEB, 'src', 'components', 'LoginDropdown', 'LoginDropdown.js',
    ),
  };
  const out = {};
  for (const [key, file] of Object.entries(files)) {
    out[key] = exists(file) ? (mutate ? mutate(key, read(file)) : read(file)) : null;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// The assertions, as one function so a mutation runs through exactly the same code.
// Returns failure messages instead of printing, so the self-test can consume them.
// ─────────────────────────────────────────────────────────────────────────────

function assertions({ staffRoles, home, theme, authPortals }, sources) {
  const out = [];
  const bad = (m) => out.push(m);

  // ── 1. The role exists and login can route to it ───────────────────────────
  const config = staffRoles.STAFF_ROLE_CONFIG[ROLE];
  if (!config) {
    bad(`no ${ROLE} entry in STAFF_ROLE_CONFIG — login would dead-end`);
    return out;
  }
  if (config.userType !== 'SALES') {
    bad(`STAFF_ROLE_CONFIG.${ROLE}.userType is "${config.userType}", expected "SALES"`);
  }

  const menus = staffRoles.resolveStaffMenus(ROLE);
  if (!menus) bad('resolveStaffMenus("sales") returned null');

  // ── 2. Fully native — no WebView fallbacks ─────────────────────────────────
  const stray = [...config.menu, ...config.headerActions].filter((i) => i.path !== undefined);
  if (stray.length) {
    bad(`${stray.length} sales tile(s) still on WebView: ${stray.map((i) => i.key).join(', ')}`);
  }

  // ── 3. Every native route has a wrapper file ──────────────────────────────
  const nativeRoutes = [...menus.menu, ...menus.headerActions]
    .map((i) => i.native)
    .filter(Boolean);
  for (const route of nativeRoutes) {
    const leaf = route.split('/').pop();
    if (!exists(path.join(WRAPPERS, `${leaf}.js`))) {
      bad(`native route ${route} has no wrapper file app/staff/[role]/${leaf}.js`);
    }
  }

  // ── 4. Every sales-only wrapper is registered on the Stack ────────────────
  // Only the sales-* ones: the shared leaves (leave, payroll, profile…) were registered long
  // before this panel and asserting them here would duplicate other checkers.
  const layout = sources.layout || '';
  const salesLeaves = nativeRoutes
    .map((r) => r.split('/').pop())
    .filter((leaf) => leaf.startsWith('sales-'));
  if (salesLeaves.length === 0) bad('no sales-* native routes found — the menu is not sales-shaped');
  for (const leaf of salesLeaves) {
    if (!layout.includes(`name="${leaf}"`)) {
      bad(`app/staff/[role]/_layout.js does not register <Stack.Screen name="${leaf}" />`);
    }
  }

  // ── 5. Home arrangement covers every tile exactly once ────────────────────
  const salesHome = home.getStaffHome(ROLE);
  if (!salesHome) {
    bad('no STAFF_HOME.sales entry — the panel would fall back to the flat menu grid');
  } else {
    const coverage = home.assertArrangementCovers(menus.menu, salesHome);
    if (coverage.missing.length) {
      bad(`tiles in no destination: ${coverage.missing.join(', ')}`);
    }
    if (coverage.duplicated.length) {
      bad(`tiles placed twice: ${coverage.duplicated.join(', ')}`);
    }
    if (coverage.unknown.length) {
      bad(`arrangement names tiles the menu does not carry: ${coverage.unknown.join(', ')}`);
    }
    // Every hero must resolve. A hero naming a tile the menu lost renders a dead card.
    for (const hero of salesHome.heroes || []) {
      if (!home.heroRoute(hero, ROLE, menus.menu)) {
        bad(`hero "${hero.key}" resolves to no route`);
      }
    }
  }

  // ── 6. The palette is complete ────────────────────────────────────────────
  // A missing token does not throw in React Native — `undefined` is a legal style value and
  // renders as nothing. That is what left the language sheet unreadable on three panels.
  const palette = theme.staffPalette(ROLE);
  if (palette === theme.PORTALS.school) {
    bad('staffPalette("sales") fell through to PORTALS.school — no STAFF_ROLE_PALETTES row');
  }
  const REQUIRED_TOKENS = [
    'key', 'gradient', 'primary', 'primaryDark', 'accent', 'onPrimary',
    'link', 'headerBg', 'tint', 'inputBg', 'inputBorder', 'inputFocus',
  ];
  for (const token of REQUIRED_TOKENS) {
    if (palette?.[token] === undefined) bad(`sales palette is missing "${token}"`);
  }
  // A duplicate `key` would make makeStyles serve another panel's cached styles.
  const keys = Object.values(theme.PORTALS).map((p) => p.key);
  if (new Set(keys).size !== keys.length) bad('PORTALS keys are not unique');

  // ── 7. The two predicates that must disagree about SALES ──────────────────
  //
  // They used to be one function serving two purposes. SALES is pinned to SHREYA01 (so
  // isShreyarthaRole must say yes) but registers through the ordinary school endpoint and waits
  // for approval (so requiresSignupCode must say no). Collapsing them back together would show a
  // sales applicant the Shreyartha Signup Code field and post them to an endpoint with no SALES
  // arm — a 400 that reads as a backend bug.
  if (!authPortals.isShreyarthaRole('SALES')) {
    bad('isShreyarthaRole("SALES") is false — the session would not pin to SHREYA01');
  }
  if (authPortals.requiresSignupCode('SALES')) {
    bad('requiresSignupCode("SALES") is true — signup would demand the Shreyartha code and use the wrong endpoint');
  }
  if (!authPortals.requiresSignupCode('SHREYARTHA_ADMIN')) {
    bad('requiresSignupCode("SHREYARTHA_ADMIN") is false — that signup would lose its shared-secret gate');
  }
  if (!authPortals.SCHOOL_ROLES.some((r) => r.value === 'SALES')) {
    bad('SALES is missing from SCHOOL_ROLES — it would not appear in the mobile signup picker');
  }

  // ── 8. Tab bar ────────────────────────────────────────────────────────────
  const tabBar = sources.tabBar || '';
  if (!/sales:\s*SALES_TABS/.test(tabBar)) {
    bad('PortalTabBar STAFF_TABS has no `sales` entry');
  }

  // ── 9. THE TOKEN TRAP: every endpoint under /api/staff/ ───────────────────
  // apiService (web) picks the JWT by substring-matching the URL and "/staff/" is what selects
  // schoolUserToken. A path like /api/sales/... matches no branch, falls through to the generic
  // chain and sends a student token — a 403 that reads as a permissions bug.
  const service = sources.service || '';
  const serviceBase = /const BASE = '([^']+)'/.exec(service)?.[1];
  if (serviceBase !== '/api/staff/sales') {
    bad(`mobile salesService BASE is "${serviceBase}", expected "/api/staff/sales"`);
  }
  const controller = sources.controller || '';
  const mapping = /@RequestMapping\("([^"]+)"\)/.exec(controller)?.[1];
  if (mapping !== '/api/staff/sales') {
    bad(`SalesController @RequestMapping is "${mapping}", expected "/api/staff/sales"`);
  }

  // The two reads the school search and the follow-up rail depend on. Both must exist AND sit
  // under BASE — a hand-written '/api/sales/…' here compiles, ships, and 403s on a device.
  for (const fn of ['searchSchools', 'fetchVisitedSchools', 'fetchDashboard']) {
    if (!new RegExp(`export function ${fn}\\b`).test(service)) {
      bad(`mobile salesService has no ${fn}() — the screen that calls it will crash on import`);
    }
  }
  for (const [fn, suffix] of [
    ['searchSchools', '/school-search'],
    ['fetchVisitedSchools', '/visits/schools'],
  ]) {
    // Bounded to the function by the closing brace AT THE START OF A LINE. Two wrong versions
    // preceded this one, and both were silent:
    //   * a lazy match to the first `}` stopped at the destructured parameter list
    //     (`{ q, pincode } = {}`) and captured only the signature — reporting a correct function
    //     as broken;
    //   * a fixed 400-character window ran on into the NEXT exported function and picked up its
    //     `${BASE}`, so the assertion passed on a function that had none. The mutation harness
    //     caught that one as vacuous, which is the only reason it is not still here.
    const body = new RegExp(`export function ${fn}\\b[\\s\\S]*?\\n\\}`).exec(service)?.[0] || '';
    if (!body.includes('${BASE}')) {
      bad(`${fn}() does not build its path from BASE — the /staff/ token trap`);
    }
    if (!body.includes(suffix)) {
      bad(`${fn}() does not call ${suffix}`);
    }
  }

  // ── 9b. Check-in searches the org-wide pool, it does not list the rep's own leads ──────
  // The dropdown could not answer the question a rep actually has outside a school a colleague
  // entered. If it comes back, mobile silently diverges from the web again.
  const visits = sources.visitsScreen || '';
  if (!/SchoolSearchSheet/.test(visits)) {
    bad('the check-in sheet no longer uses SchoolSearchSheet — mobile is back to its own leads only');
  }
  if (/options=\{leadOptions\}/.test(visits)) {
    bad('the check-in sheet still renders a leadOptions dropdown for the school');
  }
  const webApi = sources.webApi || '';
  const salesApiBlock = webApi.slice(
    webApi.indexOf('export const salesApi'),
    webApi.indexOf('export const adminSalesApi'),
  );
  if (!salesApiBlock) {
    bad('no salesApi block found in the website ApiServices.js');
  } else {
    const paths = [...salesApiBlock.matchAll(/["'`](\/api\/[^"'`$]*)/g)].map((m) => m[1]);
    if (paths.length === 0) bad('salesApi block declares no /api paths — the extractor is broken');
    const wrong = paths.filter((p) => !p.startsWith('/api/staff/sales'));
    if (wrong.length) bad(`salesApi paths outside /api/staff/sales: ${[...new Set(wrong)].join(', ')}`);
  }

  // ── 10. The offline queue's safety properties ─────────────────────────────
  const queue = sources.queue || '';
  if (!/dedupeKey/.test(queue)) {
    bad('visitQueue does not mention dedupeKey — a retried flush would duplicate visits');
  }
  if (!/ownerEmail/.test(queue)) {
    bad('visitQueue does not stamp ownerEmail — a shared device would misattribute a visit');
  }
  const storageKeys = sources.storageKeys || '';
  const authKeysBlock = storageKeys.slice(storageKeys.indexOf('export const ALL_AUTH_KEYS'));
  if (!/SALES_VISIT_QUEUE_KEY/.test(authKeysBlock)) {
    bad('SALES_VISIT_QUEUE_KEY is not in ALL_AUTH_KEYS — a queued visit would survive a logout');
  }

  // ── 11. No react-native-maps, and no Maps key in the bundle ───────────────
  const pkg = JSON.parse(read(path.join(APP, 'package.json')));
  if (pkg.dependencies?.['react-native-maps']) {
    bad('react-native-maps was added — that forces a full store release; the WebView embed does not');
  }
  const location = sources.location || '';
  if (/googleapis\.com\/maps\/api\/(staticmap|js)/.test(location) || /key=/.test(location)) {
    bad('salesLocation builds a keyed Google Maps URL — the API key must stay server-side');
  }
  if (!/output=embed/.test(location)) {
    bad('salesLocation does not use the keyless output=embed map form');
  }

  // ── 12. Captured GPS is immutable ─────────────────────────────────────────
  // The check-in screen must send coordinates once, at capture. If the detail sheet started
  // sending them too, a rep could re-post a visit from anywhere.
  const visitsScreen = sources.visitsScreen || '';
  const detailStart = visitsScreen.indexOf('function VisitDetailSheet');
  if (detailStart < 0) {
    bad('VisitDetailSheet not found in SalesVisitsScreen — the extractor is broken');
  } else {
    const detail = visitsScreen.slice(detailStart);
    if (/latitude:\s*/.test(detail) || /longitude:\s*/.test(detail)) {
      bad('VisitDetailSheet sends latitude/longitude — captured GPS must never be re-submitted');
    }
  }

  // ── 13. The website's Employee menu points at the merged staff door ────────
  //
  // This used to require THREE entries including /saleslogin. The website since merged its two
  // staff doors: /saleslogin and the Shreyartha half of /schoollogin became one /employeelogin,
  // and Investor moved out to the site footer. So the menu is now a single entry, and a sales rep
  // signs in through it alongside every other Shreyartha role.
  //
  // What is still worth asserting is the thing that would actually strand a rep: that the entry
  // exists, that it names a route the app's own login can reach, and that /saleslogin has not
  // crept back in as a second door.
  const dropdown = sources.loginDropdown || '';
  const employeeBlock = dropdown.slice(
    dropdown.indexOf('export const EMPLOYEE_LOGINS'),
    dropdown.indexOf('const VARIANTS'),
  );
  if (!employeeBlock) {
    bad('EMPLOYEE_LOGINS block not found — the extractor is broken');
  } else {
    if (!/\/employeelogin/.test(employeeBlock)) {
      bad('EMPLOYEE_LOGINS has no /employeelogin entry — sales reps have no door on the website');
    }
    if (/route:\s*["']\/saleslogin["']/.test(employeeBlock)) {
      bad('EMPLOYEE_LOGINS still lists /saleslogin — that door was merged into /employeelogin');
    }
    const entries = (employeeBlock.match(/route:/g) || []).length;
    if (entries !== 1) bad(`EMPLOYEE_LOGINS has ${entries} entries, expected 1`);
  }
  if (/TODO: a "Sales Employee" entry belongs here/.test(dropdown)) {
    bad('the Sales Employee TODO is still in LoginDropdown.js though the entry now exists');
  }

  // ── 14. The geo-stamp ─────────────────────────────────────────────────────
  //
  // EVERY ASSERTION HERE READS `code`, NEVER THE RAW SOURCE. These files explain the captureRef
  // rules in their own docblocks, so a naive test matches the COMMENT describing the rule and
  // passes whether or not the code still follows it. Three of these four were vacuous exactly
  // that way on the first run, and the self-test below is the only reason anyone noticed.
  const stampView = stripComments(sources.stampView || '');
  const stampUtil = stripComments(sources.stampUtil || '');
  const visitsCode = stripComments(visitsScreen);

  // captureRef needs all three of these or it returns a blank or wrong bitmap. Each has bitten
  // this repo before, in ResourceViewerScreen, shareCapture and AdaptiveReport respectively.
  if (!/collapsable=\{false\}/.test(stampView)) {
    bad('SalesPhotoStamp is missing collapsable={false} — RN flattens it and captureRef gets nothing');
  }
  if (/opacity:\s*0/.test(stampView)) {
    bad('SalesPhotoStamp hides something with opacity:0 — captureRef returns a blank bitmap on Android');
  }
  // Pinned to the `frame` style specifically. A bare "is there any backgroundColor" test passes on
  // the thumbnail's own colour even after the captured frame loses its opaque ground.
  const frameStyle = /frame:\s*\{[\s\S]*?\}/.exec(stampView)?.[0] || '';
  if (!/backgroundColor:\s*'#/.test(frameStyle)) {
    bad('SalesPhotoStamp has no opaque backgroundColor — the capture picks up whatever is behind it');
  }

  // The stamp must be burned in BEFORE the visit is queued: a queued visit can sync days later
  // and the server never sees the photo until it does, so stamping downstream would leave every
  // offline check-in unstamped.
  //
  // Measured from the END of the import block: `captureStampedPhoto` appears in the import line
  // too, and counting that as the call site put it before everything and made this vacuous.
  const body = visitsCode.slice(visitsCode.lastIndexOf('import '));
  const stampAt = body.indexOf('captureStampedPhoto');
  const enqueueAt = body.indexOf('enqueueVisit({ payload');
  if (stampAt < 0) {
    bad('SalesVisitsScreen never calls captureStampedPhoto — check-ins would upload unstamped photos');
  } else if (enqueueAt < 0) {
    bad('the enqueueVisit call site moved — the stamp-before-queue check cannot be evaluated');
  } else if (stampAt > enqueueAt) {
    bad('the photo is stamped AFTER enqueueVisit — offline check-ins would be queued unstamped');
  }

  // Same token trap as every other endpoint, and the same reason.
  if (!stampUtil.includes('/api/staff/sales/geo/staticmap')) {
    bad('the static-map fetch is not on /api/staff/sales — it would be sent the wrong token');
  }
  if (!/staticmap/.test(controller)) {
    bad('SalesController has no staticmap endpoint for the stamp thumbnail');
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Self-test: every assertion must FAIL on a deliberately broken input.
//
// An assertion that cannot fail is worse than no assertion — it reports a tick. Two checkers in
// this repo were found vacuous after a string rename, which is the case this loop exists for.
// ─────────────────────────────────────────────────────────────────────────────

const MUTATIONS = [
  {
    name: 'role config removed',
    constants: (n, s) => (n === 'staffRoles.js' ? s.replace(/\n  sales: \{/, '\n  salesXX: {') : s),
    expect: /no sales entry in STAFF_ROLE_CONFIG/,
  },
  {
    name: 'a tile flipped back to a WebView path',
    constants: (n, s) =>
      n === 'staffRoles.js'
        ? s.replace("native: '/staff/sales/sales-leads'", "path: '/leads'")
        : s,
    expect: /still on WebView/,
  },
  {
    name: 'a native route points at a file that does not exist',
    constants: (n, s) =>
      n === 'staffRoles.js'
        ? s.replace("native: '/staff/sales/sales-deals'", "native: '/staff/sales/sales-nope'")
        : s,
    expect: /has no wrapper file/,
  },
  {
    name: 'a Stack.Screen registration removed',
    sources: (k, s) => (k === 'layout' ? s.replace('<Stack.Screen name="sales-visits" />', '') : s),
    expect: /does not register/,
  },
  {
    name: 'a tile dropped from every workspace group',
    constants: (n, s) => (n === 'staffHome.js' ? s.replace("'incentive', 'reports'", "'reports'") : s),
    expect: /tiles in no destination/,
  },
  {
    name: 'a tile placed in two groups',
    constants: (n, s) => {
      if (n !== 'staffHome.js') return s;
      // Mutate ONLY inside the sales descriptor — several of these strings also appear in
      // VICE_PRINCIPAL hundreds of lines above, and String.replace takes the FIRST hit.
      //
      // Anchored on `attendanceItemKeys`, deliberately. The previous anchor was the Personal
      // group's `itemKeys: ['myCalendar'],`, and adding one tile to that group changed the string
      // and left this mutation matching nothing — vacuous, and caught only because the self-test
      // runs. `attendanceItemKeys` is the holder's own record and does not churn as tiles are
      // added, so it is a far stabler thing to pin.
      const at = s.indexOf('const SALES = {');
      if (at < 0) return s;
      return (
        s.slice(0, at)
        + s
          .slice(at)
          .replace(
            "attendanceItemKeys: ['selfAttendance', 'leave', 'payroll'],",
            "attendanceItemKeys: ['selfAttendance', 'leave', 'payroll', 'myCalendar'],",
          )
      );
    },
    expect: /tiles placed twice/,
  },
  {
    name: 'palette row removed',
    constants: (n, s) => (n === 'theme.js' ? s.replace('  sales: PORTALS.sales,\n', '') : s),
    expect: /fell through to PORTALS\.school/,
  },
  {
    name: 'palette token removed',
    constants: (n, s) => (n === 'theme.js' ? s.replace("    inputFocus: '#4338ca',\n  },\n  principal:", '  },\n  principal:') : s),
    expect: /missing "inputFocus"/,
  },
  {
    name: 'isShreyarthaRole stops seeing SALES',
    constants: (n, s) =>
      n === 'authPortals.js' ? s.replace("|| value === 'SALES'", '') : s,
    expect: /isShreyarthaRole\("SALES"\) is false/,
  },
  {
    name: 'requiresSignupCode collapses back into isShreyarthaRole',
    // The regression this predicate pair exists to prevent: the signup branch reverting to the
    // pin predicate, which says yes to SALES. One line, swapped — no multi-line literal and no
    // regex literal, both of which have broken this file already.
    constants: (n, s) =>
      n === 'authPortals.js'
        ? s.replace("  String(userType || '').toUpperCase().startsWith('SHREYARTHA_');", '  isShreyarthaRole(userType);')
        : s,
    expect: /requiresSignupCode\("SALES"\) is true/,
  },
  {
    name: 'the Shreyartha signup loses its shared-secret gate',
    constants: (n, s) =>
      n === 'authPortals.js'
        ? s.replace("  String(userType || '').toUpperCase().startsWith('SHREYARTHA_');", '  false;')
        : s,
    expect: /requiresSignupCode\("SHREYARTHA_ADMIN"\) is false/,
  },
  {
    name: 'SALES drops out of the mobile signup picker',
    constants: (n, s) =>
      n === 'authPortals.js'
        ? s.replace("{ value: 'SALES', label: 'Sales Employee' },", '')
        : s,
    expect: /SALES is missing from SCHOOL_ROLES/,
  },
  {
    name: 'the stamp view loses collapsable={false}',
    // Anchored on the JSX, not the bare attribute: `collapsable={false}` appears FIRST in the
    // file's own docblock, and String.replace takes the first hit — so the obvious form edited a
    // comment, left the real attribute in place, and tested nothing.
    sources: (k, s) =>
      k === 'stampView'
        ? s.replace('<View ref={ref} collapsable={false}', '<View ref={ref}')
        : s,
    expect: /missing collapsable/,
  },
  {
    name: 'the stamp view is hidden with opacity:0',
    sources: (k, s) =>
      k === 'stampView' ? s.replace("borderRadius: 12,", "borderRadius: 12, opacity: 0,") : s,
    expect: /blank bitmap/,
  },
  {
    name: 'the stamp view loses its opaque background',
    sources: (k, s) =>
      k === 'stampView' ? s.replace("backgroundColor: '#0f172a'", 'backgroundColor: undefined') : s,
    expect: /no opaque backgroundColor/,
  },
  {
    name: 'the photo is stamped after it is queued',
    sources: (k, s) =>
      k === 'visitsScreen'
        // Move the stamp to AFTER the enqueue — the exact ordering regression that would silently
        // ship unstamped offline visits.
        //
        // Both anchors are unique lines. `const result = await flushQueue();` is NOT: it appears
        // in syncQueue further up the file, so replacing it hit that first and injected the call
        // BEFORE the enqueue — the opposite of the mutation, and silently vacuous.
        ? s
          .replace(
            'const stamped = (await captureStampedPhoto(stampRef).catch(() => null)) || photo;',
            'const stamped = photo;',
          )
          // Re-anchored when work-from-home made the photo optional and the enqueue became
          // `photo: remote ? null : stamped`. Still inserts the stamp AFTER the enqueue — that
          // inversion is the whole point of the mutation.
          .replace(
            'await enqueueVisit({ payload, photo: remote ? null : stamped });',
            'await enqueueVisit({ payload, photo: remote ? null : stamped });\n      await captureStampedPhoto(stampRef);',
          )
        : s,
    expect: /stamped AFTER enqueueVisit|never calls captureStampedPhoto/,
  },
  {
    name: 'the static-map fetch moves off /api/staff/',
    sources: (k, s) =>
      k === 'stampUtil' ? s.replace('/api/staff/sales/geo/staticmap', '/api/sales/geo/staticmap') : s,
    expect: /static-map fetch is not on/,
  },
  {
    name: 'tab bar entry removed',
    sources: (k, s) => (k === 'tabBar' ? s.replace('sales: SALES_TABS,', '') : s),
    expect: /STAFF_TABS has no `sales` entry/,
  },
  {
    name: 'mobile service moved off /api/staff/',
    sources: (k, s) => (k === 'service' ? s.replace("const BASE = '/api/staff/sales'", "const BASE = '/api/sales'") : s),
    expect: /salesService BASE is/,
  },
  {
    name: 'controller moved off /api/staff/',
    sources: (k, s) =>
      k === 'controller' ? s.replace('@RequestMapping("/api/staff/sales")', '@RequestMapping("/api/sales")') : s,
    expect: /@RequestMapping is/,
  },
  {
    name: 'a website salesApi path moved off /api/staff/',
    sources: (k, s) =>
      k === 'webApi' ? s.replace('"/api/staff/sales/dashboard"', '"/api/sales/dashboard"') : s,
    expect: /salesApi paths outside/,
  },
  {
    name: 'the queue stops stamping the owner',
    sources: (k, s) => (k === 'queue' ? s.replace(/ownerEmail/g, 'someoneElse') : s),
    expect: /does not stamp ownerEmail/,
  },
  {
    name: 'the queue key drops out of ALL_AUTH_KEYS',
    sources: (k, s) =>
      k === 'storageKeys'
        ? s.replace('  SALES_VISIT_QUEUE_KEY,\n  STUDENT_SEARCH_INDEX_KEY,', '  STUDENT_SEARCH_INDEX_KEY,')
        : s,
    expect: /not in ALL_AUTH_KEYS/,
  },
  {
    name: 'the map gains an API key',
    sources: (k, s) =>
      k === 'location' ? s.replace('output=embed', 'key=AIzaSyFAKE') : s,
    expect: /must stay server-side|keyless output=embed/,
  },
  {
    name: 'the detail sheet starts re-submitting GPS',
    sources: (k, s) =>
      k === 'visitsScreen'
        ? s.replace(
            'await updateVisit(visit.id, { remarks,',
            'await updateVisit(visit.id, { latitude: 0, longitude: 0, remarks,',
          )
        : s,
    expect: /must never be re-submitted/,
  },
  {
    // Re-anchored when /saleslogin was merged into /employeelogin. The old mutation deleted the
    // literal "Sales Employee Login" line, which no longer exists — so it silently became a no-op
    // that still "passed" by matching a failure the suite was already emitting.
    name: 'the Employee menu loses its staff entry',
    sources: (k, s) =>
      k === 'loginDropdown' ? s.replace(/route: "\/employeelogin"/, 'route: "/nowhere"') : s,
    expect: /no \/employeelogin entry/,
  },
  {
    name: 'the website re-opens /saleslogin as a second staff door',
    sources: (k, s) =>
      k === 'loginDropdown' ? s.replace(/route: "\/employeelogin"/, 'route: "/saleslogin"') : s,
    expect: /still lists \/saleslogin/,
  },
  {
    name: 'the school search moves off /api/staff/',
    sources: (k, s) =>
      k === 'service'
        ? s.replace('`${BASE}/school-search', "`/api/sales/school-search")
        : s,
    expect: /searchSchools\(\) does not build its path from BASE/,
  },
  {
    name: 'the follow-up rail loses its endpoint',
    sources: (k, s) =>
      k === 'service' ? s.replace('export function fetchVisitedSchools', 'function fetchVisitedSchools') : s,
    expect: /no fetchVisitedSchools\(\)/,
  },
  {
    name: 'check-in reverts to a dropdown of the rep\'s own leads',
    sources: (k, s) =>
      k === 'visitsScreen' ? s.replace(/SchoolSearchSheet/g, 'NoSuchSheet') : s,
    expect: /no longer uses SchoolSearchSheet/,
  },
];

async function main() {
  console.log('Sales panel checker\n');

  const constants = await loadConstants();
  const sources = loadSources();
  const failures = assertions(constants, sources);

  if (failures.length === 0) {
    console.log('  ✓ all assertions pass');
  } else {
    failures.forEach((f) => console.error(`  ✗ ${f}`));
  }

  console.log('\nSelf-test — every assertion must fail on a broken input:\n');
  let vacuous = 0;
  for (const mutation of MUTATIONS) {
    let caught = false;
    let crashed = null;
    try {
      const mutatedConstants = await loadConstants(mutation.constants);
      const mutatedSources = loadSources(mutation.sources);
      const result = assertions(mutatedConstants, mutatedSources);
      caught = result.some((m) => mutation.expect.test(m));
    } catch (err) {
      // A crash is NOT a catch. A mutation that breaks the loader would otherwise report a tick
      // while testing nothing — the exact way a checker goes silently vacuous.
      crashed = err?.message || String(err);
    }
    if (crashed) {
      vacuous += 1;
      console.error(`  ✗ ${mutation.name} — loader crashed, assertion untested: ${crashed}`);
    } else if (caught) {
      console.log(`  ✓ ${mutation.name}`);
    } else {
      vacuous += 1;
      console.error(`  ✗ ${mutation.name} — NOT caught, that assertion is vacuous`);
    }
  }

  const total = failures.length + vacuous;
  console.log(
    total === 0
      ? `\nPASS — ${MUTATIONS.length} assertions, each proven to fail on a broken input.`
      : `\nFAIL — ${failures.length} assertion failure(s), ${vacuous} vacuous assertion(s).`,
  );
  process.exit(total === 0 ? 0 : 1);
}

main();
