// Admin HR + Fee Management port checker (Principal, and HR for the Vice Principal).
//
//   node scripts/checkadminhr.mjs
//
// WHY THIS EXISTS. Three things here fail silently rather than loudly:
//
//  1. **The VP/fees asymmetry.** `SchoolAdminHrController` names VICE_PRINCIPAL, so a VP may
//     approve leave and run payroll. `SchoolAdminFeeController` does not, and VICE_PRINCIPAL
//     implies only TEACHER — so Fee Management on a VP menu is a screen that renders and then 403s
//     on every call. Nothing in a build or a scope check can see that.
//  2. **Two HR namespaces with identical verbs.** `/api/staff/hr` is MY leave and MY payslips;
//     `/api/school-admin/hr` is everyone's. Swap them and a principal sees their own leave on a
//     screen titled "Pending Approval", with no error.
//  3. **Endpoint drift.** Every path here is compared against the Java controllers by script, so a
//     renamed route is caught now rather than on a device.
//
// Exit code 0 = pass.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const WEB = path.resolve(APP, '..', 'frontendmain');
const JAVA = path.resolve(
  APP, '..', 'backendmain', 'src', 'main', 'java', 'com', 'shreyartha', 'backend',
);
const ROUTES = path.join(APP, 'app', 'staff', '[role]');

const SRC = {
  hrService: 'services/admin/hrAdminService.js',
  feeService: 'services/admin/schoolFeeAdminService.js',
  leaveScreen: 'components/staff/admin/AdminLeaveScreen.js',
  payrollScreen: 'components/staff/admin/AdminPayrollScreen.js',
  feeScreen: 'components/staff/admin/FeeManagementScreen.js',
  leaveRoute: 'app/staff/[role]/leave-management.js',
  payrollRoute: 'app/staff/[role]/payroll-management.js',
  feeRoute: 'app/staff/[role]/fees.js',
  layout: 'app/staff/[role]/_layout.js',
  barrel: 'components/staff/index.js',
};

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`  ✗ ${msg}`);
};
const ok = (msg) => console.log(`  ✓ ${msg}`);

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

/**
 * Code with comments removed.
 *
 * Load-bearing here more than anywhere: these files' docblocks NAME `/api/staff/hr`, name the VP,
 * name `toISOString`, and name `react-native-pdf` — all while explaining why each is avoided. Six
 * assertions across this project's checkers have already fired on documentation.
 */
const codeOnly = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

async function loadModule(rel, mutate, shimRequire = false) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adminhr-'));
  let src = read(path.join(APP, rel));
  if (mutate) src = mutate(src);
  if (shimRequire) src = `const require = () => null;\n${src}`;
  const file = path.join(dir, `${path.basename(rel, '.js')}.mjs`);
  fs.writeFileSync(file, src);
  return import(`${pathToFileURL(file).href}?t=${Math.random()}`);
}

const loadRoles = (m) => loadModule('constants/staffRoles.js', m, true);
const loadPortals = (m) => loadModule('constants/schoolAdminPortals.js', m);

/** The endpoint suffixes a Java controller actually declares, plus its class-level guard. */
function javaController(relPath, base) {
  const src = read(path.join(JAVA, relPath));
  const guard = src.match(/@PreAuthorize\("([^"]+)"\)/)?.[1] || '';
  const paths = new Set();
  for (const m of src.matchAll(
    /@(?:Get|Post|Put|Patch|Delete)Mapping\(\s*(?:value\s*=\s*)?"([^"]*)"/g,
  )) {
    paths.add(base + m[1]);
  }
  return { guard, paths, src };
}

/** Every literal API path a source file builds, with `${ADMIN}` / `${FEES}` resolved. */
function pathsIn(src, constName, constValue) {
  const code = codeOnly(src);
  const out = new Set();
  const re = new RegExp('`\\$\\{' + constName + '\\}([^`]*)`', 'g');
  for (const m of code.matchAll(re)) {
    // Drop template holes (`/employees/${id}/profile` → `/employees/{id}/profile`).
    out.add(constValue + m[1].replace(/\$\{[^}]+\}/g, '{}'));
  }
  return out;
}

/** The web's SCHOOL_ADMIN sidebar labels — the source of truth for what the three are called. */
function webAdminLabels() {
  const src = read(
    path.join(WEB, 'src', 'School', 'Admin', 'components', 'SchoolAdminSidebar.js'),
  );
  return [...codeOnly(src).matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);
}

function routeNames() {
  return new Set(
    fs
      .readdirSync(ROUTES)
      .filter((f) => f.endsWith('.js') && f !== '_layout.js')
      .map((f) => f.replace(/\.js$/, '')),
  );
}

function loadSources(mutate) {
  const out = {};
  for (const [key, rel] of Object.entries(SRC)) {
    out[key] = mutate ? mutate(key, read(path.join(APP, rel))) : read(path.join(APP, rel));
  }
  return out;
}

function assertions(roles, portals, src) {
  const out = [];
  const bad = (m) => out.push(m);
  const files = routeNames();
  const STAFF_ROLES = roles.STAFF_ROLE_CONFIG;
  const principal = STAFF_ROLES.principal;
  const vp = STAFF_ROLES.vice_principal;
  const keysOf = (r) => (r.menu || []).map((i) => i.key);

  // ── 1. the three tiles exist, with the web's own labels ───────────────────
  const labels = webAdminLabels();
  const WANT = {
    fees: 'Fee Management',
    leaveManagement: 'Leave Management',
    payrollManagement: 'Payroll Management',
  };
  for (const [key, label] of Object.entries(WANT)) {
    if (!labels.includes(label)) {
      bad(`the web SCHOOL_ADMIN sidebar no longer has a "${label}" entry — recheck the port`);
    }
    const tile = (principal.menu || []).find((i) => i.key === key);
    if (!tile) bad(`the principal menu has no "${key}" tile`);
    else if (tile.label !== label) {
      bad(`principal tile "${key}" is labelled "${tile.label}", the web says "${label}"`);
    } else if (!tile.native) {
      bad(`principal tile "${key}" is not native`);
    }
  }

  // ── 2. THE VP ASYMMETRY, asserted in both directions ──────────────────────
  // HR yes (the controller names VICE_PRINCIPAL); fees no (SCHOOL_ADMIN only, and
  // VICE_PRINCIPAL implies TEACHER, not SCHOOL_ADMIN).
  const vpKeys = keysOf(vp);
  for (const key of ['leaveManagement', 'payrollManagement']) {
    if (!vpKeys.includes(key)) bad(`the vice principal menu has no "${key}" tile`);
  }
  if (vpKeys.includes('fees')) {
    bad('FEE MANAGEMENT IS ON THE VP MENU — a VP token 403s on every /api/school-admin/fees call');
  }
  if (portals.SCHOOL_ADMIN_PORTALS.vice_principal?.fees) {
    bad('the vice_principal descriptor carries a `fees` base — it must not');
  }
  if (!portals.SCHOOL_ADMIN_PORTALS.vice_principal?.hr) {
    bad('the vice_principal descriptor has no `hr` base');
  }
  if (!portals.SCHOOL_ADMIN_PORTALS.principal?.fees) {
    bad('the principal descriptor has no `fees` base');
  }
  if (!portals.SCHOOL_ADMIN_PORTALS.principal?.hr) {
    bad('the principal descriptor has no `hr` base');
  }
  // The fee ROUTE must gate on `fees`, not on the descriptor merely existing — the VP descriptor
  // is truthy now, so `if (!portal)` would let a VP deep-link straight into the screen.
  if (!/portal\?\.fees/.test(codeOnly(src.feeRoute))) {
    bad('app/staff/[role]/fees.js does not gate on portal?.fees — a VP deep link would render it');
  }
  for (const key of ['leaveRoute', 'payrollRoute']) {
    if (!/portal\?\.hr/.test(codeOnly(src[key]))) bad(`${SRC[key]} does not gate on portal?.hr`);
  }

  // Every OTHER admin route must guard on its own key too, for the same reason.
  for (const name of files) {
    const text = read(path.join(ROUTES, `${name}.js`));
    if (!text.includes('getAdminPortal')) continue;
    if (/if \(!portal\)/.test(codeOnly(text))) {
      bad(`app/staff/[role]/${name}.js still guards on \`!portal\` — truthy for a VP with no base`);
    }
  }

  // ── 3. routes exist and are registered, both ways ─────────────────────────
  for (const name of ['fees', 'leave-management', 'payroll-management']) {
    if (!files.has(name)) bad(`app/staff/[role]/${name}.js is missing`);
    else if (!new RegExp(`name="${name}"`).test(src.layout)) {
      bad(`/staff/[role]/${name} is not registered as a Stack.Screen — an unmatched route`);
    }
  }
  for (const m of src.layout.matchAll(/<Stack\.Screen name="([^"]+)"/g)) {
    if (!files.has(m[1])) bad(`_layout registers "${m[1]}" but no such route file exists`);
  }
  // ...and the other direction, for EVERY file in the folder: a route file with no Stack.Screen is
  // an expo-router unmatched route. All 38 were registered before this change; keep it that way.
  for (const name of files) {
    if (!new RegExp(`name="${name}"`).test(src.layout)) {
      bad(`app/staff/[role]/${name}.js has no Stack.Screen — an unmatched route`);
    }
  }
  // The self-service screens must survive — they are a different audience on a different namespace.
  for (const name of ['leave', 'payroll']) {
    if (!files.has(name)) bad(`app/staff/[role]/${name}.js (self-service HR) was removed`);
  }
  for (const name of ['AdminLeaveScreen', 'AdminPayrollScreen', 'FeeManagementScreen']) {
    if (!codeOnly(src.barrel).includes(name)) bad(`${name} is not exported from components/staff`);
  }
  // Every tile's route must resolve.
  for (const role of [principal, vp]) {
    for (const item of role.menu || []) {
      if (!item.native) continue;
      const name = item.native.split('/').pop();
      if (!files.has(name)) bad(`tile "${item.key}" points at ${item.native} — no route file`);
    }
  }

  // ── 4. TWO NAMESPACES, NEVER CROSSED ──────────────────────────────────────
  const hr = codeOnly(src.hrService);
  const fee = codeOnly(src.feeService);
  if (!hr.includes("'/api/school-admin/hr'")) {
    bad('the admin HR service does not target /api/school-admin/hr');
  }
  if (hr.includes('/api/staff/hr')) {
    bad('the ADMIN HR service reaches /api/staff/hr — that is the self-service namespace');
  }
  if (!fee.includes("'/api/school-admin/fees'")) {
    bad('the fee service does not target /api/school-admin/fees');
  }
  // ...and the self-service service must not drift the other way.
  const selfHr = codeOnly(read(path.join(APP, 'services', 'teacher', 'hrService.js')));
  if (selfHr.includes('/api/school-admin')) {
    bad('services/teacher/hrService reaches /api/school-admin — that is the approver namespace');
  }
  for (const key of ['leaveScreen', 'payrollScreen']) {
    if (codeOnly(src[key]).includes('services/teacher/hrService')) {
      bad(`${SRC[key]} imports the SELF-SERVICE hr service — it must use services/admin/hrAdminService`);
    }
  }

  // ── 5. every path exists on the Java controller ───────────────────────────
  const hrJava = javaController(
    path.join('hr', 'controller', 'SchoolAdminHrController.java'),
    '/api/school-admin/hr',
  );
  const feeJava = javaController(
    path.join('schoolfee', 'controller', 'SchoolAdminFeeController.java'),
    '/api/school-admin/fees',
  );
  if (!/VICE_PRINCIPAL/.test(hrJava.guard)) {
    bad(`SchoolAdminHrController no longer names VICE_PRINCIPAL (guard: ${hrJava.guard}) — the VP tiles are now wrong`);
  }
  if (/VICE_PRINCIPAL/.test(feeJava.src)) {
    bad('SchoolAdminFeeController now mentions VICE_PRINCIPAL — the fees-off-VP rule may be stale');
  }
  const normalise = (p) => p.replace(/\{[^}]*\}/g, '{}').replace(/\/$/, '');
  const javaHrPaths = new Set([...hrJava.paths].map(normalise));
  const javaFeePaths = new Set([...feeJava.paths].map(normalise));
  for (const p of pathsIn(src.hrService, 'ADMIN', '/api/school-admin/hr')) {
    if (!javaHrPaths.has(normalise(p))) bad(`hrAdminService calls ${p}, which SchoolAdminHrController does not declare`);
  }
  for (const p of pathsIn(src.feeService, 'FEES', '/api/school-admin/fees')) {
    if (!javaFeePaths.has(normalise(p))) bad(`schoolFeeAdminService calls ${p}, which SchoolAdminFeeController does not declare`);
  }

  // ── 6. the wire details that change results without erroring ──────────────
  // `salary-preview` must send all three params — includeConveyance defaults true on the web and
  // `metro` switches the HRA slab, so dropping either returns a different salary.
  // Look inside the `params: { ... }` object, NOT the whole function: the signature destructures
  // `includeConveyance` as well, so deleting the params entry leaves a plain includes() still true
  // and the mutation slips past.
  const previewBlock = hr.slice(hr.indexOf('export function previewSalary'));
  const paramsAt = previewBlock.indexOf('params: {');
  const paramsObj =
    paramsAt < 0 ? '' : previewBlock.slice(paramsAt, previewBlock.indexOf('},', paramsAt));
  for (const param of ['monthlyGross', 'metro', 'includeConveyance']) {
    if (!new RegExp(`\\b${param}\\s*[,:]`).test(paramsObj)) {
      bad(`previewSalary does not send "${param}" — the computed salary would silently differ`);
    }
  }
  // The controller defaults an omitted leave status to PENDING, so "all" must be explicit.
  if (!hr.includes("LEAVE_STATUS_ALL = 'ALL'")) {
    bad('the ALL sentinel is gone — an unfiltered leave call silently returns only PENDING');
  }
  if (!codeOnly(src.leaveScreen).includes("'ALL'")) {
    bad('the leave screen never asks for ALL — the "All Requests" tab would show only pending');
  }
  // Notes is a PATCH mapping; the web calls PUT and gets a 405.
  if (!/staffApi\.patch\(`\$\{FEES\}\/payments\/\$\{paymentId\}\/notes`/.test(fee)) {
    bad('updatePaymentNotes is not a PATCH — the mapping is @PatchMapping and PUT returns 405');
  }
  // No toISOString anywhere: it reads the date in UTC and shifts the month/day in IST.
  for (const key of ['hrService', 'feeService', 'leaveScreen', 'payrollScreen', 'feeScreen']) {
    if (/toISOString/.test(codeOnly(src[key]))) {
      bad(`${SRC[key]} calls toISOString() — dates here are local wall clocks`);
    }
  }
  // Locking a payroll run and deleting a structure are irreversible; window.confirm does not exist
  // in React Native, so the confirmation must be an Alert.
  if (!/Alert\.alert/.test(codeOnly(src.payrollScreen))) {
    bad('locking a payroll run has no confirmation — window.confirm does not exist in React Native');
  }
  if (!/Alert\.alert/.test(codeOnly(src.feeScreen))) {
    bad('deleting a fee structure has no confirmation');
  }
  if (/window\.confirm/.test(codeOnly(src.payrollScreen) + codeOnly(src.feeScreen))) {
    bad('window.confirm was ported literally — it is undefined in React Native');
  }

  // ── 7. the PDF import that boot-crashed the app once ──────────────────────
  for (const key of ['hrService', 'payrollScreen']) {
    if (/from 'react-native-pdf'|require\('react-native-pdf'\)/.test(src[key])) {
      bad(`${SRC[key]} imports react-native-pdf — that boot-crashes every route via the staff barrel`);
    }
  }
  if (!codeOnly(src.payrollScreen).includes('downloadAndShare')) {
    bad('payslip PDFs no longer go through utils/downloadFile — the web getBlob has no RN equivalent');
  }

  // ── 8. palette and style keys ─────────────────────────────────────────────
  // Principal is red and VP orange via staffPalette(); a hardcoded palette shows the wrong brand.
  for (const key of ['leaveScreen', 'payrollScreen', 'feeScreen']) {
    const code = codeOnly(src[key]);
    if (code.includes('PORTALS.school')) bad(`${SRC[key]} hardcodes PORTALS.school`);
    if (!code.includes('usePalette')) bad(`${SRC[key]} does not read the portal palette`);
    const whole = src[key];
    const at = whole.indexOf('const useStyles = makeStyles(');
    if (at < 0) {
      bad(`${SRC[key]} defines no stylesheet`);
      continue;
    }
    const defined = new Set(
      [...whole.slice(at).matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9]*):/gm)].map((m) => m[1]),
    );
    for (const m of code.matchAll(/styles\.([a-zA-Z][a-zA-Z0-9]*)/g)) {
      if (!defined.has(m[1])) bad(`${SRC[key]} references styles.${m[1]}, which is not defined`);
    }
    if (/autoFocus/.test(code)) bad(`${SRC[key]} has autoFocus — it breaks the Android keyboard`);
  }

  return out;
}

const MUTATIONS = [
  {
    name: 'FEE MANAGEMENT ADDED TO THE VP MENU (a guaranteed 403 on every call)',
    roles: (s) =>
      s.replace(
        "      { key: 'leaveManagement', label: 'Leave Management', icon: 'calendar-number-outline', native: '/staff/vice_principal/leave-management' },",
        "      { key: 'fees', label: 'Fee Management', icon: 'cash-outline', native: '/staff/vice_principal/fees' },\n      { key: 'leaveManagement', label: 'Leave Management', icon: 'calendar-number-outline', native: '/staff/vice_principal/leave-management' },",
      ),
  },
  {
    name: 'a `fees` base added to the vice_principal descriptor',
    portals: (s) =>
      s.replace(
        "    hr: `${SCHOOL_ADMIN}/hr`,\n  },\n};",
        "    hr: `${SCHOOL_ADMIN}/hr`,\n    fees: `${SCHOOL_ADMIN}/fees`,\n  },\n};",
      ),
  },
  {
    name: 'the fee route gating on the descriptor instead of the fees key',
    src: (k, s) => (k === 'feeRoute' ? s.replace('if (!portal?.fees)', 'if (!portal)') : s),
  },
  {
    name: 'an older admin route left on the loose `!portal` guard',
    src: (k, s) => s,
    // Applied directly to a route file below rather than through `src`, since that map holds only
    // the files this port added.
    rawRoute: ['students.js', 'if (!portal?.classes) return null;', 'if (!portal) return null;'],
  },
  {
    name: 'a tile relabelled away from the web wording',
    roles: (s) => s.replace("label: 'Payroll Management'", "label: 'Payroll'"),
  },
  {
    name: 'the principal losing Fee Management again',
    roles: (s) =>
      s.replace(
        "      { key: 'fees', label: 'Fee Management', icon: 'cash-outline', native: '/staff/principal/fees' },\n",
        '',
      ),
  },
  {
    name: 'a tile pointed at a route with no file',
    roles: (s) => s.replace("native: '/staff/principal/fees'", "native: '/staff/principal/fee'"),
  },
  {
    name: 'THE NAMESPACE SWAP: the admin HR service pointed at /api/staff/hr',
    src: (k, s) => (k === 'hrService' ? s.replaceAll("'/api/school-admin/hr'", "'/api/staff/hr'") : s),
  },
  {
    name: 'the leave screen importing the self-service HR service',
    src: (k, s) =>
      k === 'leaveScreen'
        ? s.replace("'../../../services/admin/hrAdminService'", "'../../../services/teacher/hrService'")
        : s,
  },
  {
    name: 'an endpoint the Java controller does not declare',
    src: (k, s) => (k === 'hrService' ? s.replace('`${ADMIN}/employees`', '`${ADMIN}/staff`') : s),
  },
  {
    name: 'a fee endpoint renamed away from the controller',
    src: (k, s) => (k === 'feeService' ? s.replace('`${FEES}/structures`', '`${FEES}/fee-structures`') : s),
  },
  {
    name: 'salary-preview dropping includeConveyance (every salary silently changes)',
    src: (k, s) =>
      k === 'hrService' ? s.replace('      includeConveyance: String(!!includeConveyance),\n', '') : s,
  },
  {
    name: 'the ALL sentinel removed (the All Requests tab shows only pending)',
    src: (k, s) => (k === 'hrService' ? s.replace("LEAVE_STATUS_ALL = 'ALL'", "LEAVE_STATUS_ALL = ''") : s),
  },
  {
    name: 'updatePaymentNotes reverted to PUT (the 405 the website still has)',
    src: (k, s) => (k === 'feeService' ? s.replace('staffApi.patch(`${FEES}/payments', 'staffApi.put(`${FEES}/payments') : s),
  },
  {
    name: 'toISOString() used for a local calendar date',
    src: (k, s) =>
      k === 'payrollScreen'
        ? s.replace(
            'function firstOfThisMonth() {',
            'function firstOfThisMonth() {\n  return new Date().toISOString().slice(0, 8) + "01";',
          )
        : s,
  },
  {
    name: 'the payroll lock confirmation removed (irreversible on one tap)',
    src: (k, s) => (k === 'payrollScreen' ? s.replaceAll('Alert.alert', 'noAlert') : s),
  },
  {
    name: 'window.confirm ported literally into a screen',
    src: (k, s) =>
      k === 'feeScreen' ? s.replace('Alert.alert(', 'window.confirm(') : s,
  },
  {
    name: 'react-native-pdf imported at the top of the payroll screen',
    src: (k, s) => (k === 'payrollScreen' ? `import Pdf from 'react-native-pdf';\n${s}` : s),
  },
  {
    name: 'payslip PDFs no longer routed through downloadAndShare',
    src: (k, s) => (k === 'payrollScreen' ? s.replaceAll('downloadAndShare', 'fetchBlob') : s),
  },
  {
    name: 'an admin screen hardcoded to the school teal',
    src: (k, s) =>
      k === 'feeScreen' ? s.replace('const palette = usePalette();', 'const palette = PORTALS.school;') : s,
  },
  {
    name: 'a style key deleted (renders unstyled, build stays green)',
    src: (k, s) => (k === 'leaveScreen' ? s.replace('  balanceRow: {', '  balanceRowGone: {') : s),
  },
  {
    name: 'autoFocus added to an admin form',
    src: (k, s) => (k === 'feeScreen' ? s.replace('secureTextEntry', 'autoFocus secureTextEntry') : s),
  },
  {
    name: 'the self-service leave route deleted',
    layoutOnly: true,
    src: (k, s) => (k === 'layout' ? s.replace('<Stack.Screen name="leave" />', '') : s),
    // Removing only the registration is not enough for assertion 3's "file exists" half, so the
    // registration check is what must catch this.
  },
  {
    name: 'an admin screen dropped from the staff barrel',
    src: (k, s) =>
      k === 'barrel'
        ? s.replace("export { default as FeeManagementScreen } from './admin/FeeManagementScreen';", '')
        : s,
  },
];

/** Some mutations touch a route file this port did not add; apply and restore around the run. */
function withRawRoute(mutation, fn) {
  if (!mutation.rawRoute) return fn();
  const [file, from, to] = mutation.rawRoute;
  const p = path.join(ROUTES, file);
  const original = fs.readFileSync(p, 'utf8');
  fs.writeFileSync(p, original.replace(from, to));
  try {
    return fn();
  } finally {
    fs.writeFileSync(p, original);
  }
}

console.log('Self-tests (each mutation must be caught):');
for (const m of MUTATIONS) {
  let caught;
  try {
    const [roles, portals] = await Promise.all([loadRoles(m.roles), loadPortals(m.portals)]);
    caught = withRawRoute(
      m,
      () => assertions(roles, portals, loadSources(m.src)).length > 0,
    );
  } catch {
    caught = true; // a mutation that will not even load is caught, loudly
  }
  if (caught) ok(m.name);
  else fail(`NOT CAUGHT: ${m.name} — the corresponding assertion is vacuous`);
}

console.log('\nAdmin HR + Fees:');
{
  const [roles, portals] = await Promise.all([loadRoles(), loadPortals()]);
  const problems = assertions(roles, portals, loadSources());
  if (problems.length === 0) {
    const STAFF_ROLES = roles.STAFF_ROLE_CONFIG;
    ok(
      `principal ${STAFF_ROLES.principal.menu.length} tiles (Fees + Leave + Payroll), ` +
        `vice principal ${STAFF_ROLES.vice_principal.menu.length} (HR only, no fees); ` +
        'every endpoint matches its Java controller',
    );
  } else problems.forEach(fail);
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL — ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
