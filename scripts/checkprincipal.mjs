// Principal native-port checker.
//
//   node scripts/checkprincipal.mjs
//
// WHY THIS EXISTS. The Principal panel is 13 new screens over a namespace the app had never
// called, and every mistake it can make is silent:
//
//   * a menu item still on `path:` renders a WebView that looks fine
//   * `meetings` folded into the admin base 404s — and an empty list is what you see
//   * pointing `reports` at the VP's route gives a screen scoped to one teacher's own classes,
//     with no create, edit or publish control, which still renders
//   * a palette swap makes a panel the wrong colour with no error anywhere
//   * a native route with no file is an expo-router unmatched route
//
// `npx expo export` is green through all five, and so is checkscope.js — neither sees a wrong
// VALUE, only an unbound NAME. So this evaluates the real constants and reads the real wrapper
// sources, and every assertion is mutation-tested below before any pass is believed.
//
// Exit code 0 = pass.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const WEB = path.resolve(APP, '..', 'frontendmain');
const ROLE = 'principal';
const WRAPPERS = path.join(APP, 'app', 'staff', '[role]');

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`  ✗ ${msg}`);
};
const ok = (msg) => console.log(`  ✓ ${msg}`);

// Mixed line endings live in this repo; a source assertion that depends on which one a file
// happens to carry is a false failure waiting to happen.
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

const CONSTANT_FILES = [
  'staffRoles.js',
  'schoolAdminPortals.js',
  'vicePrincipalPortal.js',
  'counsellorPortals.js',
  'shreya01TeacherPortal.js',
  'staffScope.js',
  'theme.js',
];

/** @param {(name: string, src: string) => string} [mutate] */
async function loadConstants(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcheck-'));
  for (const name of CONSTANT_FILES) {
    let src = read(path.join(APP, 'constants', name));
    if (mutate) src = mutate(name, src);
    src = src.replace(/from '\.\/([A-Za-z0-9_]+)'/g, "from './$1.mjs'");
    fs.writeFileSync(path.join(dir, name.replace(/\.js$/, '.mjs')), src);
  }
  const load = (n) => import(pathToFileURL(path.join(dir, `${n}.mjs`)).href + `?t=${Math.random()}`);
  return {
    staffRoles: await load('staffRoles'),
    admin: await load('schoolAdminPortals'),
    theme: await load('theme'),
  };
}

const WRAPPER_FILES = ['_layout.js', 'admin-reports.js', 'live-meeting.js', 'classes.js'];

function loadSources(mutate) {
  const out = {};
  for (const f of WRAPPER_FILES) {
    out[f] = mutate ? mutate(f, read(path.join(WRAPPERS, f))) : read(path.join(WRAPPERS, f));
  }
  return out;
}

/** The web sidebar is the source of truth for the item set — extracted, never retyped. */
function webSidebarItems() {
  const src = read(
    path.join(WEB, 'src', 'School', 'Principal', 'components', 'PrincipalSidebar.js'),
  );
  const block = src.slice(src.indexOf('const menuItems'), src.indexOf('return ('));
  const items = [];
  const re = /key:\s*"([^"]+)"[\s\S]*?label:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(block))) items.push({ key: m[1], label: m[2] });
  return items;
}

function assertions({ staffRoles, admin, theme }, sources) {
  const out = [];
  const bad = (m) => out.push(m);

  const config = staffRoles.STAFF_ROLE_CONFIG[ROLE];
  if (!config) {
    bad('no principal entry in STAFF_ROLE_CONFIG');
    return out;
  }

  // ── 1. fully native ────────────────────────────────────────────────────────
  const stray = [...config.menu, ...config.headerActions].filter((i) => i.path !== undefined);
  if (stray.length) {
    bad(`${stray.length} item(s) still on WebView: ${stray.map((i) => i.key).join(', ')}`);
  }

  // ── 2. mirrors the web sidebar, in order ───────────────────────────────────
  const web = webSidebarItems();
  if (web.length < 10) bad(`sidebar extractor found only ${web.length} items`);

  // The web's key is `academicIQAliases`; ours is `academicIqAliases`. Keys are internal React
  // keys, never shown, so the casing difference is cosmetic — compared case-insensitively rather
  // than churning a shipped constant. Labels, which ARE shown, must match exactly.
  const norm = (k) => String(k).toLowerCase();

  // FIVE TILES DELIBERATELY GO BEYOND THE WEB SIDEBAR, and they are pinned to the END of the menu
  // so the mirror above them stays exact and reviewable.
  //
  // The first three are the APPROVER side: Fee / Leave / Payroll Management are mounted on
  // SchoolAdminDashboard, and a Principal token is authorised for all three
  // (`PRINCIPAL implies SCHOOL_ADMIN`; the fee controller is `hasRole('SCHOOL_ADMIN')`, the HR one
  // `hasAnyRole('SCHOOL_ADMIN','VICE_PRINCIPAL')`) — only PrincipalSidebar was ever missing them.
  //
  // The last two are SELF-SERVICE, added with the dashboard redesign: `StaffHrController` names all
  // eight staff roles, so a Principal has always been able to file their own leave and read their
  // own payslips. Same "website gap, not a permission" call already made for the VP and both
  // counsellors. scripts/checkadminhr.mjs owns the detail; this file only guards the mirror.
  const BEYOND_WEB = ['fees', 'leaveManagement', 'payrollManagement', 'leave', 'payroll'];
  const tail = config.menu.slice(-BEYOND_WEB.length).map((i) => i.key);
  if (tail.join(',') !== BEYOND_WEB.join(',')) {
    bad(
      `the five beyond-the-web tiles must be the LAST five, in order.\n` +
        `      got:  ${tail.join(',')}\n      want: ${BEYOND_WEB.join(',')}`,
    );
  }

  // ── THE APPROVER / SELF-SERVICE LABEL SPLIT ─────────────────────────────────
  //
  // The Principal is now the second role carrying BOTH halves, so the labels are the only thing
  // separating them on the panel. Two namespaces that share verb names: "… Management" administers
  // other staff on `/api/school-admin/hr`, "My …" is the holder's own on `/api/staff/hr`. Swap them
  // and a Principal sees their own leave request filed under a queue of other people's, with no
  // error anywhere. Asserted in BOTH directions, because only one direction is a half-check.
  const labelOf = (key) => config.menu.find((i) => i.key === key)?.label || '';
  for (const key of ['leaveManagement', 'payrollManagement']) {
    const label = labelOf(key);
    if (!/Management$/.test(label)) {
      bad(`"${key}" is the approver queue but is labelled "${label}" — it must end in "Management"`);
    }
    if (/^My /.test(label)) bad(`"${key}" is the approver queue but is labelled "${label}"`);
  }
  for (const key of ['leave', 'payroll']) {
    const label = labelOf(key);
    if (!/^My /.test(label)) {
      bad(`"${key}" is self-service but is labelled "${label}" — it must start with "My "`);
    }
    if (/Management$/.test(label)) bad(`"${key}" is self-service but is labelled "${label}"`);
  }
  const mirrored = config.menu.slice(0, config.menu.length - BEYOND_WEB.length);
  const gotKeys = mirrored.map((i) => norm(i.key)).join(',');
  const wantKeys = web.map((i) => norm(i.key)).join(',');
  if (gotKeys !== wantKeys) {
    bad(`menu keys/order differ.\n      app: ${gotKeys}\n      web: ${wantKeys}`);
  }
  for (const item of web) {
    const mine = config.menu.find((i) => norm(i.key) === norm(item.key));
    if (mine && mine.label !== item.label) {
      bad(`label drift on "${item.key}": app "${mine.label}" vs web "${item.label}"`);
    }
  }

  // ── 3. absent on purpose ───────────────────────────────────────────────────
  // `queries` belongs to SHREYARTHA_ADMIN, not the Principal.
  for (const forbidden of ['queries']) {
    if (config.menu.some((i) => i.key === forbidden)) {
      bad(`"${forbidden}" is not a Principal tile`);
    }
  }

  // ── 3b. THE TWO HR NAMESPACES MUST NOT CROSS ────────────────────────────────
  //
  // This assertion USED to be "the Principal has no `leave` or `payroll` tile at all", which was
  // right while the panel carried only the approver side: the short key would have pointed a
  // Principal at their own leave where the queue was meant. The redesign gave the panel BOTH
  // halves, so the ban became wrong — but the danger it was guarding did not go away, it just moved
  // from the key to the ROUTE. So the check moved with it, and is now stricter than the ban was:
  // each of the four tiles must point into its own namespace, which the ban never verified at all.
  const routeOf = (key) => config.menu.find((i) => i.key === key)?.native || '';
  const NAMESPACES = [
    ['leave', '/leave', ['/leave-management']],
    ['payroll', '/payroll', ['/payroll-management']],
    ['leaveManagement', '/leave-management', []],
    ['payrollManagement', '/payroll-management', []],
  ];
  for (const [key, suffix, notSuffixes] of NAMESPACES) {
    const route = routeOf(key);
    if (!route) { bad(`"${key}" has no route`); continue; }
    if (notSuffixes.some((n) => route.endsWith(n)) || !route.endsWith(suffix)) {
      bad(`"${key}" routes to ${route} — it must end in ${suffix}`);
    }
  }
  if (config.groups) bad('principal config declares `groups` — the web sidebar is a flat list');

  // ── 4. the descriptor ──────────────────────────────────────────────────────
  const portal = admin.getAdminPortal(ROLE);
  if (!portal) {
    bad('getAdminPortal("principal") returned null');
  } else {
    if (!portal.meetings) bad('descriptor has no `meetings` key');
    else if (portal.meetings.startsWith('/api/school-admin')) {
      bad('`meetings` was folded under /api/school-admin — StaffMeetingController is at /api/school');
    }
    for (const key of ['classes', 'verification', 'reports', 'events', 'staffAttendance',
      'staffEvaluation', 'linkedUniversities', 'topicAliases', 'languageProAliases',
      'codingProAliases', 'academicYearWrites']) {
      if (!portal[key]) bad(`descriptor is missing "${key}"`);
      else if (!portal[key].startsWith('/api/school-admin')) {
        bad(`"${key}" is "${portal[key]}", expected an /api/school-admin path`);
      }
    }
    // The teacher's exam namespace would render but return a different role's data.
    if (portal.reports.includes('/teacher')) bad('`reports` points at the teacher namespace');
  }

  // The three alias managers differ ONLY in depth; collapsing that hides or invents a tier.
  const trees = admin.ALIAS_TREES || {};
  if (trees.topicAliases?.levels?.length !== 3) {
    bad('Academic IQ aliases must be 3 levels deep (subject → chapter → topic)');
  }
  if (trees.languageProAliases?.levels?.length !== 2) {
    bad('Language Pro aliases must be 2 levels deep (chapter → topic) — it has no subject tier');
  }
  if (trees.codingProAliases?.levels?.length !== 2) {
    bad('Coding Pro aliases must be 2 levels deep — it has no subject tier');
  }

  // ── 5. every native route has a file, and is registered ────────────────────
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

  // ── 6. the exam-route collision ────────────────────────────────────────────
  // `reports.js` is the VICE PRINCIPAL's teacher exam screen. The principal needs the admin one.
  const reportsItem = config.menu.find((i) => i.key === 'reports');
  if (reportsItem && /\/reports$/.test(reportsItem.native || '')) {
    bad('principal "reports" points at the VP teacher screen; it needs the admin exam screen');
  }
  if (!/AdminExamsScreen/.test(sources['admin-reports.js'])) {
    bad('admin-reports.js does not render AdminExamsScreen');
  }
  if (!/portal\.meetings/.test(sources['live-meeting.js'])) {
    bad('live-meeting.js does not take its base from the descriptor');
  }
  if (!/academicYearWrites/.test(sources['classes.js'])) {
    bad('classes.js does not pass the academic-year WRITE base (creates would hit the read path)');
  }

  // ── 7. palettes ────────────────────────────────────────────────────────────
  //
  // Every staff panel wears the accent from its OWN web dashboard CSS. Two of these were corrected
  // during the staff redesign and the old values are worth naming, because both were plausible:
  //   shreyartha_teacher    was 'school'     — it had no map row at all, so it fell through to the
  //                                            default and rendered identically to app/teacher.
  //   shreyartha_councellor was 'counsellor' — inherited from the SCHOOL counsellor's CSS during the
  //                                            counsellor port, but this panel's own CSS is teal.
  // `teacher` and `shreyartha_admin` stay on 'school' deliberately: the former has no provider at
  // all, the latter has not been redesigned yet.
  const expected = {
    principal: 'principal',
    vice_principal: 'vicePrincipal',
    counselor: 'counsellor',
    shreyartha_councellor: 'shreyarthaCounsellor',
    teacher: 'school',
    shreyartha_teacher: 'shreyarthaTeacher',
    shreyartha_admin: 'school',
  };
  for (const [role, key] of Object.entries(expected)) {
    const got = theme.staffPalette(role)?.key;
    if (got !== key) bad(`staffPalette("${role}") is "${got}", expected "${key}"`);
  }
  // A duplicate literal key silently shadowed a whole palette once before; keys must be unique.
  const seen = new Set();
  for (const value of Object.values(theme.PORTALS)) {
    if (seen.has(value.key)) bad(`duplicate palette key "${value.key}"`);
    seen.add(value.key);
  }

  return out;
}

const MUTATIONS = [
  {
    // THE SWAP THIS PANEL EXISTS TO PREVENT. The Principal now carries both HR halves, so a
    // Principal whose "My Leave" tile points at /leave-management sees a queue of other people's
    // requests where their own record belongs — and nothing errors, because they are authorised
    // for both. Only the route tells them apart.
    name: 'My Leave pointed at the approver queue',
    constants: (n, s) =>
      n === 'staffRoles.js'
        ? s.replace("native: '/staff/principal/leave' }", "native: '/staff/principal/leave-management' }")
        : s,
  },
  {
    // The reverse crossing, asserted separately because one direction is a half-check.
    name: 'Payroll Management pointed at the payslip screen',
    constants: (n, s) =>
      n === 'staffRoles.js'
        ? s.replace(
            "{ key: 'payrollManagement', label: 'Payroll Management', icon: 'wallet-outline', native: '/staff/principal/payroll-management' }",
            "{ key: 'payrollManagement', label: 'Payroll Management', icon: 'wallet-outline', native: '/staff/principal/payroll' }",
          )
        : s,
  },
  {
    // Labels are the only thing separating the two halves on the panel itself — the routes are
    // invisible to the user. A self-service tile labelled like an approver queue is a Principal
    // tapping "Leave Management" and landing in their own record.
    name: 'a self-service tile relabelled as if it were the approver queue',
    constants: (n, s) =>
      n === 'staffRoles.js'
        // PINNED TO THE PRINCIPAL'S OWN ROUTE.  appears in
        // FOUR role configs, so a plain string replace mutates whichever comes first — which was a
        // counsellor's, leaving the Principal's untouched and this mutation vacuous. Third time
        // that trap has surfaced in this batch.
        ? s.replace(
            "{ key: 'leave', label: 'My Leave', icon: 'today-outline', native: '/staff/principal/leave' }",
            "{ key: 'leave', label: 'Leave Management', icon: 'today-outline', native: '/staff/principal/leave' }",
          )
        : s,
  },
  {
    name: 'one menu item left on WebView',
    constants: (n, s) =>
      n === 'staffRoles.js'
        ? s.replace(
            "{ key: 'events', label: 'Events', icon: 'megaphone-outline', native: '/staff/principal/events' }",
            "{ key: 'events', label: 'Events', icon: 'megaphone-outline', path: '/events' }",
          )
        : s,
  },
  {
    name: 'a menu item dropped',
    constants: (n, s) => (n === 'staffRoles.js' ? s.replace(/^.*key: 'linkedColleges'.*$/m, '') : s),
  },
  {
    name: 'a beyond-the-web tile duplicated into the mirrored region',
    constants: (n, s) =>
      n === 'staffRoles.js'
        ? s.replace(
            "{ key: 'liveMeeting', label: 'Live Meeting', icon: 'videocam-outline', native: '/staff/principal/live-meeting' },",
            "{ key: 'liveMeeting', label: 'Live Meeting', icon: 'videocam-outline', native: '/staff/principal/live-meeting' },\n      { key: 'fees', label: 'Fee Management', icon: 'cash-outline', native: '/staff/principal/fees' },",
          )
        : s,
  },
  {
    // Exercises the tail assertion the mirror check now depends on: the three beyond-the-web
    // tiles must be the LAST three, in order, or the mirrored slice above them stops lining up.
    name: 'the beyond-the-web tiles reordered',
    constants: (n, s) =>
      n === 'staffRoles.js'
        ? s
            .replace("      { key: 'fees', label: 'Fee Management', icon: 'cash-outline', native: '/staff/principal/fees' },\
", '')
            .replace("      { key: 'myCalendar', label: 'My Calendar', icon: 'calendar-outline', native: '/staff/principal/my-calendar' },", "      { key: 'fees', label: 'Fee Management', icon: 'cash-outline', native: '/staff/principal/fees' },\
      { key: 'myCalendar', label: 'My Calendar', icon: 'calendar-outline', native: '/staff/principal/my-calendar' },")
        : s,
  },
  {
    // Matched by ROUTE, not by key: `leaveManagement` now appears under both the principal and the
    // vice principal, and a bare key match would depend on which one happens to come first.
    name: 'the Principal losing Leave Management again',
    constants: (n, s) =>
      n === 'staffRoles.js'
        ? s.replace(/^.*'\/staff\/principal\/leave-management'.*$/m, '')
        : s,
  },
  {
    name: 'meetings folded under /api/school-admin',
    constants: (n, s) =>
      n === 'schoolAdminPortals.js'
        ? s.replace("meetings: '/api/school/staff-meetings'", "meetings: `${SCHOOL_ADMIN}/staff-meetings`")
        : s,
  },
  {
    name: 'reports pointed at the teacher namespace',
    constants: (n, s) =>
      n === 'schoolAdminPortals.js'
        ? s.replace('reports: `${SCHOOL_ADMIN}/reports`', "reports: '/api/teacher/reports'")
        : s,
  },
  {
    name: 'the alias depth difference collapsed',
    constants: (n, s) =>
      n === 'schoolAdminPortals.js'
        ? s.replace(
            "    title: 'Language Pro Aliases',\n    levels: ['chapters', 'topics'],",
            "    title: 'Language Pro Aliases',\n    levels: ['subjects', 'chapters', 'topics'],",
          )
        : s,
  },
  {
    name: 'principal reports pointed at the VP route',
    constants: (n, s) =>
      n === 'staffRoles.js'
        ? s.replace("native: '/staff/principal/admin-reports' }", "native: '/staff/principal/reports' }")
        : s,
  },
  {
    name: 'principal and vice principal palettes swapped',
    constants: (n, s) =>
      n === 'theme.js'
        ? s.replace(
            "  principal: PORTALS.principal,\n  vice_principal: PORTALS.vicePrincipal,",
            "  principal: PORTALS.vicePrincipal,\n  vice_principal: PORTALS.principal,",
          )
        : s,
  },
  {
    name: 'a label reworded away from the web sidebar',
    constants: (n, s) =>
      n === 'staffRoles.js'
        ? s.replace("label: 'Linked Colleges'", "label: 'Partner Colleges'")
        : s,
  },
  {
    name: 'live-meeting.js hardcoding its own base',
    sources: (n, s) =>
      n === 'live-meeting.js' ? s.replace('portal.meetings', "'/api/school/staff-meetings'") : s,
  },
  {
    name: 'classes.js losing the academic-year write base',
    sources: (n, s) =>
      n === 'classes.js' ? s.replace(/academicYearWrites=\{[^}]*\}/g, '') : s,
  },
  {
    name: 'the live-meeting route unregistered in _layout.js',
    sources: (n, s) =>
      n === '_layout.js' ? s.replace('<Stack.Screen name="live-meeting" />', '') : s,
  },
];

console.log('Self-tests (each mutation must be caught):');
for (const m of MUTATIONS) {
  // ── WHY `planted` EXISTS ──────────────────────────────────────────────────
  // A mutation whose anchor string no longer matches the file changes nothing. The assertions
  // then run against the real source, find no problem, and this loop prints ✓ for an assertion it
  // never exercised — a silently disabled test that looks like a passing one.
  //
  // The `catch` below makes that worse rather than better: it treats ANY loader failure as a
  // catch. One mutation in this file wrote `\\n` inside a double-quoted string, which is a literal
  // backslash-n rather than a newline. The search anchor matched nothing, and the replacement
  // spliced a backslash into staffRoles.js, so the mutated module was a SyntaxError — swallowed
  // here and reported as ✓. The tail-order assertion it claimed to guard had never once run.
  //
  // So track whether the transformer actually altered a file, and treat "changed nothing" as a
  // failure. This is the pattern scripts/checkauth.mjs has always used.
  let planted = false;
  const track = (fn) =>
    fn &&
    ((n, s) => {
      const out = fn(n, s);
      if (out !== s) planted = true;
      return out;
    });

  let caught;
  try {
    const mods = await loadConstants(track(m.constants));
    caught = assertions(mods, loadSources(track(m.sources))).length > 0;
  } catch {
    caught = true; // a mutation that will not even load is caught, loudly
  }
  if (!planted) fail(`INERT: ${m.name} — the mutation matched nothing, so it proves nothing`);
  else if (caught) ok(m.name);
  else fail(`NOT CAUGHT: ${m.name} — the corresponding assertion is vacuous`);
}

console.log('\nPrincipal port:');
const real = assertions(await loadConstants(), loadSources());
if (real.length === 0) {
  const cfg = (await loadConstants()).staffRoles.STAFF_ROLE_CONFIG[ROLE];
  ok(`${cfg.menu.length} menu items, all native, mirroring PrincipalSidebar.js`);
} else real.forEach(fail);


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — the services, CALLED rather than grepped.
//
// The wiring checks above prove a screen points at the right base. These prove the request that
// actually leaves the app is the right SHAPE. The two that matter most: `createEvent` must send
// flat fields (a `json` part 415s before the handler runs), and `createSubjects` must hit
// `bulk-with-ids` — the plain `/bulk` twin silently drops academicIqSubjectId, which every
// curriculum feature downstream depends on.
// ─────────────────────────────────────────────────────────────────────────────

const RECORDING_TRANSPORT = `export const calls = [];
const rec = (method) => async (endpoint, body, options) => {
  calls.push({ method, endpoint, body, options });
  return globalThis.__reply ? globalThis.__reply({ method, endpoint }) : {};
};
export const staffApi = {
  get: async (endpoint, options) => { calls.push({ method: 'GET', endpoint, options });
    return globalThis.__reply ? globalThis.__reply({ method: 'GET', endpoint }) : []; },
  post: rec('POST'), put: rec('PUT'), patch: rec('PATCH'),
  del: async (endpoint, options) => { calls.push({ method: 'DELETE', endpoint, options }); return {}; },
  multipart: async (endpoint, parts, options) => {
    calls.push({ method: 'MULTIPART', endpoint, parts, options });
    return { url: 'https://s3/logo.jpg' };
  },
  blob: rec('BLOB'),
};
export default staffApi;
`;

/** Copy the admin services into a temp tree whose staffApi records every call. */
async function stageServices(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'psvc-'));
  fs.mkdirSync(path.join(dir, 'services', 'admin'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'constants'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'services', 'staffApi.mjs'), RECORDING_TRANSPORT);
  fs.writeFileSync(
    path.join(dir, 'constants', 'schoolAdminPortals.mjs'),
    read(path.join(APP, 'constants', 'schoolAdminPortals.js')),
  );
  const adminDir = path.join(APP, 'services', 'admin');
  for (const f of fs.readdirSync(adminDir)) {
    let src = read(path.join(adminDir, f));
    if (mutate) src = mutate(f, src);
    src = src
      .replace("from '../staffApi'", "from '../staffApi.mjs'")
      .replace("from '../../constants/schoolAdminPortals'", "from '../../constants/schoolAdminPortals.mjs'");
    fs.writeFileSync(path.join(dir, 'services', 'admin', f.replace(/\.js$/, '.mjs')), src);
  }
  // NO cache-busting query here, deliberately. Each call gets a fresh mkdtemp directory, so the
  // URLs are already unique — and a `?t=` suffix on these imports would NOT reach the services'
  // own bare `from '../staffApi.mjs'`, giving the recorder and the service two different module
  // instances and an always-empty `calls` array. (That bug made every mutation below look
  // "caught" when the real run was simply crashing.)
  return {
    load: (n) => import(pathToFileURL(path.join(dir, 'services', 'admin', n + '.mjs')).href),
    api: () => import(pathToFileURL(path.join(dir, 'services', 'staffApi.mjs')).href),
  };
}

async function serviceAssertions(staged) {
  const out = [];
  const bad = (m) => out.push(m);
  const { calls } = await staged.api();
  const last = () => calls[calls.length - 1];
  const eq = (a, b, m) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) bad(m + ' — got ' + JSON.stringify(a));
  };

  const cls = await staged.load('classService');
  const payload = cls.buildSubjectPayload({
    academicNames: ['Maths'],
    codingNames: ['Python'],
    customName: 'Pottery',
    codes: { Maths: ' M1 ', Python: 'PY1' },
    customCode: 'ART1',
    subjectType: 'PRACTICAL',
    catalogueSubjects: [{ id: 7, name: 'Maths' }],
    codingCurriculums: [{ id: 9, name: 'Python' }],
  });
  eq(payload[0].academicIqSubjectId, 7, 'a catalogue subject must carry its academicIqSubjectId');
  eq(payload[1].codingCurriculumId, 9, 'a coding subject must carry its codingCurriculumId');
  eq(payload[2].academicIqSubjectId, null, 'a custom subject carries neither id');
  eq(payload[0].subjectCode, 'M1', 'subject codes are trimmed');
  try {
    cls.buildSubjectPayload({
      academicNames: ['Maths'],
      codes: {},
      catalogueSubjects: [{ id: 7, name: 'Maths' }],
    });
    bad('a subject with no code was accepted — the backend takes the batch or none of it');
  } catch {
    /* expected */
  }
  calls.length = 0;
  await cls.createSubjects('/api/school-admin/classes', { sectionId: 3, subjects: payload });
  eq(
    last().endpoint,
    '/api/school-admin/classes/subjects/bulk-with-ids',
    'createSubjects must use bulk-with-ids; the plain /bulk twin drops academicIqSubjectId',
  );
  eq(cls.availableSections({ sections: [{ sectionName: 'A' }] }).length, 5, 'availableSections excludes what exists');

  const exams = await staged.load('examService');
  eq(exams.clampMark('120', 100), '100', 'clampMark must clamp above the maximum');
  eq(exams.clampMark('abc', 100), '', 'clampMark must reject letters');
  calls.length = 0;
  await exams.saveMarks('/api/school-admin/reports', 5, [
    { studentId: 1, status: 'PRESENT', marksObtained: '42' },
    { studentId: 2, status: 'ABSENT', marksObtained: '99' },
  ]);
  eq(calls.length, 2, 'saveMarks is one request per student');
  eq(last().endpoint, '/api/school-admin/reports/exams/5/results/2', 'saveMarks writes to /results/{studentId}');
  eq(last().body.marksObtained, null, 'an ABSENT student sends null marks, not the typed value');

  const events = await staged.load('eventService');
  calls.length = 0;
  await events.createEvent('/api/school-admin/events', {
    title: ' Annual Day ',
    description: '',
    startDateTime: '2026-09-01T10:00:00',
    endDateTime: '2026-09-01T12:00:00',
    targetClasses: ['9', '10'],
    bannerImage: { uri: 'file://b.jpg' },
  });
  eq(
    Object.keys(last().parts || {}).sort(),
    ['fields', 'files'],
    'createEvent must send flat fields, never a json part (415)',
  );
  eq(last().parts.fields.targetClasses, '9,10', 'targetClasses is a comma-joined string of NAMES');
  eq(
    events.validateEvent({
      title: 'x',
      startDateTime: '2026-09-01T12:00:00',
      endDateTime: '2026-09-01T10:00:00',
      targetClasses: ['9'],
      bannerImage: {},
    }),
    'End date & time must be after start date & time.',
    'validateEvent rejects an end before the start',
  );
  eq(
    events.bannerUrl({ bannerImagePath: '/uploads/a b.jpg' }, 'https://x'),
    'https://x/uploads/a%20b.jpg',
    'bannerUrl prefixes and encodes a relative path',
  );

  const meetings = await staged.load('meetingService');
  eq(meetings.monthBounds(2026, 2), { from: '2026-02-01', to: '2026-02-28' }, 'monthBounds must respect month length');
  eq(meetings.NEXT_MEETING_STATUSES.COMPLETED, undefined, 'COMPLETED must be terminal');

  const aliases = await staged.load('aliasService');
  calls.length = 0;
  await aliases.saveAlias('/api/school-admin/topic-aliases', 4, { aliasName: ' Trig ', displayOrder: '' });
  eq(last().body, { aliasName: 'Trig', displayOrder: null }, 'a blank display order sends null, not an empty string');
  eq(
    aliases.countAliases([{ chapters: [{ topics: [{ aliasName: 'x' }, {}] }] }], ['chapters', 'topics']),
    { total: 2, aliased: 1 },
    'countAliases walks the configured depth',
  );

  const overview = await staged.load('overviewService');
  calls.length = 0;
  await overview.uploadSchoolLogo('/api/school-admin/classes', { uri: 'file://a.jpg' });
  eq(calls.map((c) => c.method), ['MULTIPART', 'PUT'], 'the logo uploads first, then is written onto the school');
  eq(calls[1].body, { schoolLogo: 'https://s3/logo.jpg' }, 'the uploaded URL is what gets stored');

  const attendance = await staged.load('adminAttendanceService');
  eq(
    attendance.summarise({ attendance: { a: 'PRESENT', b: true, c: 'ABSENT' } }, ['a', 'b', 'c', 'd']),
    { present: 2, absent: 1, percent: 67 },
    'true counts as PRESENT and unmarked days count as neither',
  );

  const evaluation = await staged.load('evaluationService');
  eq(evaluation.adminBlockScore({ discipline: 5, integrity: 5, professionalism: 5 }), 5, 'adminBlockScore rescales 15/15 onto five points');
  eq(
    evaluation.validateRatings({ discipline: 5, integrity: 4, professionalism: 0 }),
    'Please rate all three metrics.',
    'all three metrics are required',
  );

  return out;
}

const SERVICE_MUTATIONS = [
  {
    name: 'createEvent switched to a json part (the 415 trap)',
    mutate: (f, s) => (f === 'eventService.js' ? s.replace('fields: {', 'json: {') : s),
  },
  {
    name: 'createSubjects pointed at /subjects/bulk',
    // Targets the CALL, not the doc comment above it that also names both endpoints — a plain
    // string replace hits the comment first and leaves the request untouched, which made this
    // mutation pass vacuously on its first run.
    mutate: (f, s) =>
      f === 'classService.js'
        ? s.replace('post(`${apiBase}/subjects/bulk-with-ids`', 'post(`${apiBase}/subjects/bulk`')
        : s,
  },
  {
    name: 'clampMark stops clamping',
    mutate: (f, s) =>
      f === 'examService.js' ? s.replace('if (max != null && value > max) return String(max);', '') : s,
  },
  {
    name: 'a blank alias display order sent as an empty string',
    mutate: (f, s) =>
      f === 'aliasService.js'
        ? s.replace("displayOrder === '' || displayOrder == null ? null : Number(displayOrder)", 'displayOrder')
        : s,
  },
  {
    name: 'the logo URL never written onto the school',
    mutate: (f, s) =>
      f === 'overviewService.js'
        ? s.replace('await staffApi.put(`${apiBase}/school-logo`, { schoolLogo: res.url });', '')
        : s,
  },
  {
    name: 'a subject with no code allowed through',
    mutate: (f, s) =>
      f === 'classService.js'
        ? s.replace('if (missing) throw new Error(`Please enter a subject code for ${missing.subjectName}.`);', '')
        : s,
  },
];

console.log('\nSelf-tests — services (each mutation must be caught):');
for (const m of SERVICE_MUTATIONS) {
  let caught;
  try {
    caught = (await serviceAssertions(await stageServices(m.mutate))).length > 0;
  } catch {
    caught = true;
  }
  if (caught) ok(m.name);
  else fail('NOT CAUGHT: ' + m.name + ' — the corresponding assertion is vacuous');
}

console.log('\nService behaviour:');
{
  const problems = await serviceAssertions(await stageServices());
  if (problems.length === 0) ok('every admin service sends the request the backend expects');
  else problems.forEach(fail);
}

console.log('\nRegression — the finished panels:');
{
  const { staffRoles } = await loadConstants();
  for (const role of ['counselor', 'shreyartha_councellor', 'shreyartha_teacher', 'vice_principal']) {
    const c = staffRoles.STAFF_ROLE_CONFIG[role];
    const strays = [...c.menu, ...c.headerActions].filter((i) => i.path !== undefined);
    if (strays.length) fail(`${role} regressed: ${strays.map((i) => i.key).join(', ')} back on WebView`);
    else ok(`${role} still fully native`);
  }
  const admin = staffRoles.STAFF_ROLE_CONFIG.shreyartha_admin;
  if (admin.menu.every((i) => i.path === undefined)) {
    fail('shreyartha_admin unexpectedly has no WebView items — it is not ported yet');
  } else ok('shreyartha_admin still WebView (the last panel)');
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL — ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
