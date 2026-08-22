// Vice Principal native-port checker.
//
//   node scripts/checkviceprincipal.mjs
//
// WHY THIS EXISTS. The VP port has no new screens and almost no new logic — it is entirely
// *wiring*, and every mistake it can make is silent:
//
//   * a menu item still on `path:` renders a WebView that looks fine
//   * `groups.js` falling through to the counsellor branch renders Wellness Groups, a plausible
//     page against the wrong API
//   * a `schoolClass` scope renders a School chip and then 200-empty lists
//   * `role="counselor"` offers eight counselling types the server will reject
//   * a native route with no file is an expo-router unmatched route
//
// `npx expo export` is green through all five, and so is checkscope.js — neither sees a wrong
// VALUE, only an unbound NAME. So this evaluates the real constants and reads the real wrapper
// sources, and every assertion is mutation-tested below before any pass is believed.
//
// Exit code 0 = pass. Anything else = read the output.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const WEB = path.resolve(APP, '..', 'frontendmain');

const ROLE = 'vice_principal';
const WRAPPERS = path.join(APP, 'app', 'staff', '[role]');

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`  ✗ ${msg}`);
};
const ok = (msg) => console.log(`  ✓ ${msg}`);

// Normalised: the repo has mixed line endings, and a source assertion that depends on which one a
// file happens to carry is a false failure waiting to happen.
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

// ─────────────────────────────────────────────────────────────────────────────
// Loading the constants.
//
// The four constants files are import-free or import only each other, and they are ESM `export`
// syntax in .js files, which Node treats as CJS. Copying the closure into a temp dir as .mjs is
// what checkteachergroups.mjs / checkshreya01teacher.mjs do, and it means the checker sees the
// SAME values the app does rather than a regex's idea of them.
// ─────────────────────────────────────────────────────────────────────────────

const CONSTANT_FILES = [
  'staffRoles.js',
  'vicePrincipalPortal.js',
  'counsellorPortals.js',
  'shreya01TeacherPortal.js',
  'staffScope.js',
];

/** @param {(name: string, src: string) => string} [mutate] applied to each file's source */
async function loadConstants(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vpcheck-'));
  for (const name of CONSTANT_FILES) {
    let src = read(path.join(APP, 'constants', name));
    if (mutate) src = mutate(name, src);
    // Rewrite relative sibling imports to the .mjs copies.
    src = src.replace(/from '\.\/([A-Za-z0-9_]+)'/g, "from './$1.mjs'");
    fs.writeFileSync(path.join(dir, name.replace(/\.js$/, '.mjs')), src);
  }
  const load = (n) => import(pathToFileURL(path.join(dir, `${n}.mjs`)).href + `?t=${Math.random()}`);
  return {
    staffRoles: await load('staffRoles'),
    vp: await load('vicePrincipalPortal'),
    scope: await load('staffScope'),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The assertions, as one function so a mutation can be run through exactly the same code.
// Returns the list of failure messages instead of printing, so self-tests can consume it.
// ─────────────────────────────────────────────────────────────────────────────

/** The web sidebar is the source of truth for the item set — extracted, never retyped. */
function webSidebarItems() {
  const src = read(
    path.join(WEB, 'src', 'School', 'Vice_Principal', 'components', 'VicePrincipalSidebar.js'),
  );
  const block = src.slice(src.indexOf('const menuItems'), src.indexOf('return ('));
  const items = [];
  const re = /key:\s*"([^"]+)"[\s\S]*?label:\s*"([^"]+)"([\s\S]*?)(?=\{\s*key:|\]\s*;)/g;
  let m;
  while ((m = re.exec(block))) {
    items.push({ key: m[1], label: m[2], disabled: /disabled:\s*true/.test(m[3]) });
  }
  return items;
}

function assertions({ staffRoles, vp, scope }, sources) {
  const out = [];
  const bad = (m) => out.push(m);

  const config = staffRoles.STAFF_ROLE_CONFIG[ROLE];
  if (!config) {
    bad(`no ${ROLE} entry in STAFF_ROLE_CONFIG`);
    return out;
  }

  // ── 1. Fully native ────────────────────────────────────────────────────────
  const webItems = webSidebarItems();
  if (webItems.length < 5) bad(`web sidebar extractor found only ${webItems.length} items`);
  const expected = webItems.filter((i) => !i.disabled);
  if (expected.length === webItems.length) {
    bad('web sidebar extractor found no `disabled: true` item — Upskill should be one');
  }

  const stray = [...config.menu, ...config.headerActions].filter((i) => i.path !== undefined);
  if (stray.length) bad(`${stray.length} item(s) still on WebView: ${stray.map((i) => i.key).join(', ')}`);

  // ── 2. Menu mirrors the web sidebar, in order ──────────────────────────────
  //
  // TWO TILES DELIBERATELY GO BEYOND IT, pinned to the END so the mirror above stays exact.
  // `SchoolAdminHrController` names VICE_PRINCIPAL in its class-level guard, so a VP genuinely is a
  // leave approver and payroll admin — the backend was built for it and the flat web sidebar just
  // never mounted it. **Fee Management is NOT among them**: that controller is
  // `hasRole('SCHOOL_ADMIN')` and VICE_PRINCIPAL implies only TEACHER, so it would 403 on every
  // call. scripts/checkadminhr.mjs asserts that asymmetry in both directions.
  const BEYOND_WEB = ['leaveManagement', 'payrollManagement'];
  const tail = config.menu.slice(-BEYOND_WEB.length).map((i) => i.key);
  if (tail.join(',') !== BEYOND_WEB.join(',')) {
    bad(
      `the two beyond-the-web HR tiles must be the LAST two, in order.\n` +
        `      got:  ${tail.join(',')}\n      want: ${BEYOND_WEB.join(',')}`,
    );
  }
  if (config.menu.some((i) => i.key === 'fees')) {
    bad('Fee Management is on the VP menu — a VP token 403s on every /api/school-admin/fees call');
  }

  const gotKeys = config.menu
    .slice(0, config.menu.length - BEYOND_WEB.length)
    .map((i) => i.key)
    .join(',');
  const wantKeys = expected.map((i) => i.key).join(',');
  if (gotKeys !== wantKeys) bad(`menu keys/order differ.\n      app: ${gotKeys}\n      web: ${wantKeys}`);

  for (const item of expected) {
    const mine = config.menu.find((i) => i.key === item.key);
    if (mine && mine.label !== item.label) {
      bad(`label drift on "${item.key}": app "${mine.label}" vs web "${item.label}"`);
    }
  }
  const disabledOnWeb = webItems.filter((i) => i.disabled).map((i) => i.key);
  for (const key of disabledOnWeb) {
    if (config.menu.some((i) => i.key === key)) bad(`"${key}" is disabled on the web sidebar but present in the app menu`);
  }

  // ── 3. Not grouped ─────────────────────────────────────────────────────────
  if (config.groups) bad('VP config declares `groups` — the web sidebar is a flat list');

  // ── 4. Scope resolution ────────────────────────────────────────────────────
  for (const feature of vp.VICE_PRINCIPAL.features) {
    const r = scope.resolveFeatureScope(ROLE, feature);
    if (!r) {
      bad(`resolveFeatureScope('${ROLE}', '${feature}') returned null`);
      continue;
    }
    if (r.scopeKind !== 'classSection') {
      bad(`'${feature}' scopeKind is "${r.scopeKind}", expected "classSection"`);
    }
    // The whole point of the descriptor: no second copy of the teacher paths.
    if (r.apiBase !== undefined) bad(`'${feature}' apiBase is "${r.apiBase}", expected undefined`);
    if (r.schoolsEndpoint !== undefined) bad(`'${feature}' schoolsEndpoint should be undefined`);
  }
  if (scope.resolveFeatureScope(ROLE, 'counsellorReport') !== null) {
    bad('resolveFeatureScope resolved a feature the VP sidebar does not have (counsellorReport)');
  }
  if (scope.isSchoolScoped(ROLE)) bad('isSchoolScoped(vice_principal) is true — VP uses ScopePicker');

  // ── 5. Every native route has a file, and is registered ────────────────────
  const layout = sources['_layout.js'];
  for (const item of [...config.menu, ...config.headerActions]) {
    if (!item.native) continue;
    const name = item.native.split('/').pop();
    if (!fs.existsSync(path.join(WRAPPERS, `${name}.js`))) {
      bad(`"${item.key}" points at /${name}, which has no wrapper file`);
    } else if (!new RegExp(`name="${name}"`).test(layout)) {
      bad(`"${name}" is not registered as a Stack.Screen in _layout.js`);
    }
  }

  // ── 6. The two wrappers whose fallback would silently serve the wrong screen ─
  // Match the CALL, not the bare name — the import line also contains `isVicePrincipal`, and an
  // earlier draft of this check happily passed on a groups.js whose VP branch had been deleted.
  const groups = sources['groups.js'];
  const vpBlock = groups.match(/if \(isVicePrincipal\(roleKey\)\) \{([\s\S]*?)\n {2}\}/);
  const vpAt = groups.indexOf('isVicePrincipal(roleKey)');
  const wellnessAt = groups.indexOf('<WellnessGroupsScreen');
  if (!vpBlock) bad('groups.js has no vice-principal branch — VP would fall through to Wellness Groups');
  else {
    if (!/<StudentGroupsScreen/.test(vpBlock[1])) {
      bad('groups.js VP branch does not render StudentGroupsScreen');
    }
    if (/<WellnessGroupsScreen/.test(vpBlock[1])) bad('groups.js VP branch renders Wellness Groups');
    if (wellnessAt >= 0 && vpAt > wellnessAt) {
      bad('groups.js checks the VP after the Wellness fallback — VP would get Wellness Groups');
    }
  }

  const counselling = sources['counselling.js'];
  if (!/isVicePrincipal\(roleKey\)/.test(counselling)) {
    bad('counselling.js does not name the VP — it would pass role="counselor" (8 types, 6 unsavable)');
  }
  if (!/teacherFlavoured\s*\?\s*'teacher'\s*:\s*'counselor'/.test(counselling)) {
    bad('counselling.js no longer picks the role from the teacher-flavoured flag');
  }

  const homework = sources['homework.js'];
  if (!/group="all"/.test(homework)) bad('homework.js VP branch does not request the four-tab group');

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Self-tests: every mutation below MUST be caught. A checker that has never failed proves
// nothing (see feedback-verify-before-claiming).
// ─────────────────────────────────────────────────────────────────────────────

const MUTATIONS = [
  {
    name: 'one menu item left on WebView',
    constants: (n, s) =>
      n === 'staffRoles.js'
        ? s.replace(
            "{ key: 'reports', label: 'Test and Examination', icon: 'clipboard-outline', native: '/staff/vice_principal/reports' }",
            "{ key: 'reports', label: 'Test and Examination', icon: 'clipboard-outline', path: '/reports' }",
          )
        : s,
  },
  {
    name: 'a menu item dropped',
    constants: (n, s) =>
      n === 'staffRoles.js'
        ? s.replace(/^.*key: 'syllabus'.*$/m, '')
        : s,
  },
  {
    // The single most dangerous mistake in this change: fees on a VP menu is a screen that
    // renders and then 403s on every call, because SchoolAdminFeeController is SCHOOL_ADMIN-only.
    name: 'Fee Management added to the VP menu (a guaranteed 403)',
    constants: (n, s) =>
      n === 'staffRoles.js'
        ? s.replace("      { key: 'leaveManagement', label: 'Leave Management', icon: 'calendar-number-outline', native: '/staff/vice_principal/leave-management' },", "      { key: 'fees', label: 'Fee Management', icon: 'cash-outline', native: '/staff/vice_principal/fees' },\\n      { key: 'leaveManagement', label: 'Leave Management', icon: 'calendar-number-outline', native: '/staff/vice_principal/leave-management' },")
        : s,
  },
  {
    // Matched by ROUTE, not by key: the principal's payrollManagement line comes first in this
    // file, so a bare key match deletes the wrong role's tile and the mutation tests nothing.
    name: 'the VP losing Payroll Management',
    constants: (n, s) =>
      n === 'staffRoles.js'
        ? s.replace(/^.*'\/staff\/vice_principal\/payroll-management'.*$/m, '')
        : s,
  },
  {
    name: 'VP given a schoolClass scope',
    constants: (n, s) =>
      n === 'vicePrincipalPortal.js' ? s.replace("scope: 'classSection'", "scope: 'schoolClass'") : s,
  },
  {
    name: 'VP given a hardcoded apiBase',
    constants: (n, s) =>
      n === 'staffScope.js'
        ? s.replace(
            'return { apiBase: undefined, schoolsEndpoint: undefined, scopeKind: VICE_PRINCIPAL.scope };',
            "return { apiBase: '/api/teacher/attendance', schoolsEndpoint: undefined, scopeKind: VICE_PRINCIPAL.scope };",
          )
        : s,
  },
  {
    name: 'a label reworded away from the web sidebar',
    constants: (n, s) =>
      n === 'staffRoles.js' ? s.replace("label: 'Create Group'", "label: 'Student Groups'") : s,
  },
  {
    name: 'the disabled Upskill item added back',
    constants: (n, s) =>
      n === 'staffRoles.js'
        ? s.replace(
            "{ key: 'myCalendar', label: 'My Calendar', icon: 'calendar-outline', native: '/staff/vice_principal/my-calendar' },",
            "{ key: 'myCalendar', label: 'My Calendar', icon: 'calendar-outline', native: '/staff/vice_principal/my-calendar' },\n      { key: 'upskill', label: 'Upskill Your Self', icon: 'school-outline', native: '/staff/vice_principal/upskill' },",
          )
        : s,
  },
  {
    name: 'groups.js falling through to Wellness Groups',
    sources: (n, s) => (n === 'groups.js' ? s.replace(/if \(isVicePrincipal[\s\S]*?\n  \}\n/, '') : s),
  },
  {
    name: 'groups.js VP branch pointed at the wrong screen',
    sources: (n, s) =>
      n === 'groups.js' ? s.replace('<StudentGroupsScreen homeRoute', '<WellnessGroupsScreen homeRoute') : s,
  },
  {
    name: 'counselling.js reverted to role="counselor"',
    sources: (n, s) =>
      n === 'counselling.js'
        ? s.replace('roleKey === SHREYA01_TEACHER.key || isVicePrincipal(roleKey)', 'roleKey === SHREYA01_TEACHER.key')
        : s,
  },
  {
    name: 'homework.js VP branch reduced to two tabs',
    sources: (n, s) => (n === 'homework.js' ? s.replace('group="all"', 'group="homework"') : s),
  },
  {
    name: 'the reports route unregistered in _layout.js',
    sources: (n, s) => (n === '_layout.js' ? s.replace('<Stack.Screen name="reports" />', '') : s),
  },
];

const WRAPPER_FILES = ['_layout.js', 'groups.js', 'counselling.js', 'homework.js'];

function loadSources(mutate) {
  const out = {};
  for (const f of WRAPPER_FILES) {
    out[f] = mutate ? mutate(f, read(path.join(WRAPPERS, f))) : read(path.join(WRAPPERS, f));
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────

console.log('Self-tests (each mutation must be caught):');
for (const m of MUTATIONS) {
  let caught;
  try {
    const mods = await loadConstants(m.constants);
    caught = assertions(mods, loadSources(m.sources)).length > 0;
  } catch {
    caught = true; // a mutation that fails to even load is caught, loudly
  }
  if (caught) ok(m.name);
  else fail(`NOT CAUGHT: ${m.name} — the corresponding assertion is vacuous`);
}

console.log('\nVice Principal port:');
const real = assertions(await loadConstants(), loadSources());
if (real.length === 0) {
  const cfg = (await loadConstants()).staffRoles.STAFF_ROLE_CONFIG[ROLE];
  ok(`${cfg.menu.length} menu items + ${cfg.headerActions.length} header action, all native`);
} else real.forEach(fail);

// ── Regression: the four finished panels, and the untouched tab sets ─────────
console.log('\nRegression:');
{
  const { staffRoles } = await loadConstants();
  // `principal` joined this list on 20 Aug 2026, when its own pass finished. Only the Shreyartha
  // admin is still WebView.
  for (const role of ['counselor', 'shreyartha_councellor', 'shreyartha_teacher', 'principal']) {
    const c = staffRoles.STAFF_ROLE_CONFIG[role];
    const strays = [...c.menu, ...c.headerActions].filter((i) => i.path !== undefined);
    if (strays.length) fail(`${role} regressed: ${strays.map((i) => i.key).join(', ')} back on WebView`);
    else ok(`${role} still fully native`);
  }
  {
    const c = staffRoles.STAFF_ROLE_CONFIG.shreyartha_admin;
    if (c.menu.every((i) => i.path === undefined)) {
      fail('shreyartha_admin unexpectedly has no WebView items — it is not ported yet');
    } else ok('shreyartha_admin still WebView (the last panel)');
  }

  const screen = read(path.join(APP, 'components', 'staff', 'TeacherResourcesScreen.js'));
  for (const [key, first] of [['homework', 'assign'], ['resources', 'resources']]) {
    const block = screen.slice(screen.indexOf(`  ${key}: [`));
    if (!block.startsWith(`  ${key}: [\n    { value: '${first}'`)) {
      fail(`TABS.${key} changed — the existing portals' tab sets must be untouched`);
    } else ok(`TABS.${key} unchanged`);
  }
  if (!/^\s{2}all: \[/m.test(screen)) fail('TABS.all is missing');
  else ok('TABS.all present');
  if (!/group === 'all' \? tab === 'assign' \|\| tab === 'submitted'/.test(screen)) {
    fail("the `all` group does not derive its resource TYPE from the active tab — uploads would be mistyped");
  } else ok('`all` derives HOMEWORK/RESOURCE from the active tab');
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL — ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
