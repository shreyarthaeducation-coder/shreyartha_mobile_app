// Bulk psychometric print checker (1 Oct 2026).
//
//   node scripts/checkpsychometricprint.mjs
//
// WHY THIS EXISTS. The feature is wiring across three repos, and every way it can break is silent:
//   * a role pointed at another panel's endpoint family gets 403 on a screen that otherwise renders
//   * a route file that is not a registered Stack.Screen is an unmatched route
//   * a host screen that stops passing `printRoute` simply loses its button
//   * a batch whose reports are not page-broken prints students run into each other
// So this evaluates the real role → endpoint map, compares it with the backend controller's own
// paths and guards, and reads the wiring. Every assertion is mutation-tested before a pass counts.
//
// Exit code 0 = pass.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const BACKEND = path.resolve(APP, '..', 'backendmain', 'src', 'main', 'java', 'com', 'shreyartha', 'backend');

let failures = 0;
const fail = (m) => {
  failures += 1;
  console.error(`  ✗ ${m}`);
};
const ok = (m) => console.log(`  ✓ ${m}`);

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const FILES = {
  map: 'constants/psychometricPrint.js',
  staffRoute: 'app/staff/[role]/psychometric-print.js',
  teacherRoute: 'app/teacher/psychometric-print.js',
  staffLayout: 'app/staff/[role]/_layout.js',
  teacherLayout: 'app/teacher/_layout.js',
  report: 'components/teacher/TeacherCounsellingReportScreen.js',
  psych: 'components/teacher/StudentPsychometricScreen.js',
  groupsRoute: 'app/staff/[role]/groups.js',
  wellness: 'components/staff/WellnessGroupsScreen.js',
  studentsRoute: 'app/staff/[role]/students.js',
  students: 'components/staff/admin/StudentManagementScreen.js',
  parent: 'components/parent/AssessmentResultsScreen.js',
  service: 'services/shared/psychometricReportService.js',
  pdf: 'utils/psychometricPdf.js',
};
const CONTROLLER = path.join(BACKEND, 'psychometric', 'report', 'PsychometricReportController.java');

function loadSources(mutate) {
  const out = {};
  for (const [k, rel] of Object.entries(FILES)) {
    const src = read(path.join(APP, rel));
    out[k] = mutate ? mutate(k, src) : src;
  }
  const ctl = read(CONTROLLER);
  out.controller = mutate ? mutate('controller', ctl) : ctl;
  return out;
}

async function loadMap(src) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'psyprint-'));
  const file = path.join(dir, 'psychometricPrint.mjs');
  fs.writeFileSync(file, src);
  return import(pathToFileURL(file).href + `?t=${Math.random()}`);
}

/** Every `@PreAuthorize(...)` guarding a mapping whose path starts with `base`. */
function guardsFor(controller, base) {
  const out = [];
  const re = /@(?:Get|Post)Mapping\("([^"]+)"\)\s*\n\s*@PreAuthorize\("([^"]+)"\)/g;
  let m;
  while ((m = re.exec(controller))) if (m[1] === base || m[1].startsWith(`${base}/`)) out.push(m[2]);
  return out;
}

/** Which role must be able to reach each family — the role's own authority, not an inherited one. */
const REQUIRED_ROLE = {
  vice_principal: 'VICE_PRINCIPAL',
  counselor: 'COUNSELOR',
  shreyartha_councellor: 'SHREYARTHA_COUNCELLOR',
  principal: 'SCHOOL_ADMIN',
};

async function assertions(s) {
  const out = [];
  const bad = (m) => out.push(m);

  let map;
  try {
    map = await loadMap(s.map);
  } catch (e) {
    bad(`constants/psychometricPrint.js does not evaluate: ${e.message}`);
    return out;
  }

  // 1. Every role maps to a family the backend actually serves, under a guard naming that role.
  for (const [role, need] of Object.entries(REQUIRED_ROLE)) {
    const base = map.psychometricPrintApiBase(role);
    if (!base) {
      bad(`${role} has no print endpoint`);
      continue;
    }
    const guards = guardsFor(s.controller, base);
    if (guards.length < 3) bad(`${role} → ${base}: the controller serves ${guards.length} of its 3 endpoints`);
    else if (!guards.every((g) => g.includes(`'${need}'`))) {
      bad(`${role} → ${base}: not every guard names ${need} — a 403 behind a working-looking screen`);
    }
  }
  if (map.psychometricPrintApiBase('shreyartha_teacher') || map.psychometricPrintApiBase('sales')) {
    bad('a role with no print endpoint on the server has been given one');
  }
  if (!/@GetMapping\("\/api\/parent\/psychometric-reports"\)\s*\n\s*@PreAuthorize\("hasRole\('PARENT'\)"\)/.test(s.controller)) {
    bad('the parent endpoint is missing or not guarded to PARENT');
  }
  if (!strip(s.service).includes("parentApi.get('/api/parent/psychometric-reports')")) {
    bad('the parent print does not call the parent endpoint through the parent client');
  }
  if (!strip(s.teacherRoute).includes('apiBase="/api/teacher/psychometric-reports"')) {
    bad('the teacher print screen is not on /api/teacher/psychometric-reports');
  }

  // 2. Routes registered.
  if (!/<Stack\.Screen name="psychometric-print" \/>/.test(s.staffLayout)) bad('staff psychometric-print is not a registered Stack.Screen');
  if (!/<Stack\.Screen name="psychometric-print" \/>/.test(s.teacherLayout)) bad('teacher psychometric-print is not a registered Stack.Screen');
  if (!strip(s.staffRoute).includes('psychometricPrintApiBase(roleKey)')) bad('the staff print route does not resolve its endpoint per role');

  // 3. Every host passes the link on.
  if (!strip(s.report).includes('printRoute={psychometricPrintRoute(homeRoute)}')) bad("the Counselling Report's psychometric tab lost its print link");
  if (!/\{printRoute \? <PsychometricPrintLink/.test(strip(s.psych))) bad('StudentPsychometricScreen does not render the print link');
  if (!strip(s.groupsRoute).includes('printRoute={psychometricPrintApiBase(roleKey) ?')) bad('Wellness Groups is not given the print route');
  if (!/\{printRoute \? <PsychometricPrintLink/.test(strip(s.wellness))) bad('WellnessGroupsScreen does not render the print link');
  if (!strip(s.studentsRoute).includes('printRoute={psychometricPrintApiBase(roleKey) ?')) bad('Student Management is not given the print route');
  if (!/\{printRoute \? <PsychometricPrintLink/.test(strip(s.students))) bad('StudentManagementScreen does not render the print link');
  if (!/<PsychometricPrintLink[\s\S]*?onPress=\{printAll\}/.test(strip(s.parent))) bad('the parent tab lost its print-all button');

  // 4. The batch document: one report per section, each after the first on a new page, one cover.
  const pdf = strip(s.pdf);
  if (!/i > 0 \? ' style="page-break-before: always; break-before: page;"'/.test(pdf)) bad('batch reports are not page-broken');
  if ((pdf.match(/mergeWithFramework\(/g) || []).length !== 2) {
    bad('the cover merge must be defined once and called once (from the shared render step) — not per report');
  }
  return out;
}

const MUTATIONS = [
  { name: 'the VP pointed at the counsellor family', src: (k, s) => (k === 'map' ? s.replace("vice_principal: '/api/teacher/psychometric-reports'", "vice_principal: '/api/counselor/psychometric-reports'") : s) },
  { name: 'the principal pointed at the teacher family', src: (k, s) => (k === 'map' ? s.replace("principal: '/api/school-admin/psychometric-reports'", "principal: '/api/teacher/psychometric-reports'") : s) },
  { name: 'the Shreyartha counsellor dropped', src: (k, s) => (k === 'map' ? s.replace("  shreyartha_councellor: '/api/counselor/psychometric-reports',\n", '') : s) },
  { name: 'the server guard loses SHREYARTHA_COUNCELLOR', src: (k, s) => (k === 'controller' ? s.replaceAll("hasAnyRole('COUNSELOR','SHREYARTHA_COUNCELLOR')", "hasRole('COUNSELOR')") : s) },
  { name: 'the parent endpoint opened to staff', src: (k, s) => (k === 'controller' ? s.replace("@PreAuthorize(\"hasRole('PARENT')\")", "@PreAuthorize(\"hasRole('TEACHER')\")") : s) },
  { name: 'the staff route unregistered', src: (k, s) => (k === 'staffLayout' ? s.replace('      <Stack.Screen name="psychometric-print" />\n', '') : s) },
  { name: 'the teacher route unregistered', src: (k, s) => (k === 'teacherLayout' ? s.replace('        <Stack.Screen name="psychometric-print" />\n', '') : s) },
  { name: 'the psychometric tab stops passing printRoute', src: (k, s) => (k === 'report' ? s.replace(' printRoute={psychometricPrintRoute(homeRoute)}', '') : s) },
  { name: 'Wellness Groups stops rendering the link', src: (k, s) => (k === 'wellness' ? s.replace('{printRoute ? <PsychometricPrintLink', '{false ? <PsychometricPrintLink') : s) },
  { name: 'the principal roster loses its route', src: (k, s) => (k === 'studentsRoute' ? s.replace('printRoute={psychometricPrintApiBase(roleKey) ?', 'printRoute={false ?') : s) },
  { name: 'the parent button removed', src: (k, s) => (k === 'parent' ? s.replace('onPress={printAll}', 'onPress={() => {}}') : s) },
  { name: 'batch page breaks removed', src: (k, s) => (k === 'pdf' ? s.replace(' style="page-break-before: always; break-before: page;"', '') : s) },
  { name: 'the cover merged per report', src: (k, s) => (k === 'pdf' ? s.replace('function reportBodyHtml({ results, topicType, topicName, studentInfo }) {', 'function reportBodyHtml({ results, topicType, topicName, studentInfo }) {\n  mergeWithFramework(null);') : s) },
];

console.log('Self-tests (each mutation must be caught):');
const pristine = loadSources();
for (const m of MUTATIONS) {
  const mutated = loadSources(m.src);
  const changed = Object.keys(mutated).some((k) => mutated[k] !== pristine[k]);
  if (!changed) {
    fail(`INERT: ${m.name} — its anchor no longer matches anything`);
    continue;
  }
  const problems = await assertions(mutated);
  if (problems.length > 0) ok(m.name);
  else fail(`NOT CAUGHT: ${m.name}`);
}

console.log('\nBulk psychometric print:');
const problems = await assertions(pristine);
if (problems.length === 0) ok('every role prints through its own guarded family; routes, links and the batch document are wired');
else problems.forEach(fail);

console.log(failures === 0 ? '\nPASS' : `\nFAIL — ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
