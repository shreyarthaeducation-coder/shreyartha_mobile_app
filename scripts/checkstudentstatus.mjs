// Student Status in the app (10 Oct 2026).
//
// Evaluates utils/studentStatus.js for real, checks it reads tables the way the website's twin does,
// and reads the wiring: service, screen (drill, up one level, phone back, search), routes, menus and
// home placements. Every assertion is mutation-tested before a pass counts.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const WEB = path.resolve(APP, '../frontendmain/src/School/shared/StudentStatus/studentStatus.js');

let failures = 0;
const fail = (m) => {
  failures += 1;
  console.error(`  ✗ ${m}`);
};
const ok = (m) => console.log(`  ✓ ${m}`);
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

const FILES = {
  rules: 'utils/studentStatus.js',
  service: 'services/staff/studentStatusService.js',
  screen: 'components/staff/StudentStatusScreen.js',
  index: 'components/staff/index.js',
  teacherRoute: 'app/teacher/student-status.js',
  staffRoute: 'app/staff/[role]/student-status.js',
  teacherLayout: 'app/teacher/_layout.js',
  staffLayout: 'app/staff/[role]/_layout.js',
  teacherMenu: 'constants/teacherMenu.js',
  staffRoles: 'constants/staffRoles.js',
  staffHome: 'constants/staffHome.js',
};
const ROLES = ['principal', 'vice_principal', 'counselor', 'shreyartha_councellor', 'shreyartha_teacher'];

function loadSources(mutate) {
  const out = {};
  for (const [k, rel] of Object.entries(FILES)) {
    const src = read(path.join(APP, rel));
    out[k] = mutate ? mutate(k, src) : src;
  }
  return out;
}

async function evaluate(src, name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studentstatus-'));
  const file = path.join(dir, `${name}.mjs`);
  fs.writeFileSync(file, src);
  return import(pathToFileURL(file).href + `?t=${Math.random()}`);
}

// The website's file imports its API client; only the pure rules are compared.
const webRules = (src) => src.replace(/^import .*\n/m, '').replace(/export const statusApi = \{[\s\S]*?\n\};\n/, '');

const SCOPE = [{ schoolCode: 'S', schoolName: 'Sunrise', classes: [
  { classId: 7, className: 'Class 7', sections: [{ sectionId: 71, sectionName: 'A' }] },
  { classId: 8, className: 'Class 8', sections: [] },
] }];
const TABLE = {
  path: [{ node: 'overview', label: 'Overview' }, { node: 'academiciq', label: 'Academic IQ' }, { node: 'academiciq/practice', label: 'Practice Zone' }],
  students: [{ studentId: 1, name: 'Ravi Kumar', rollNumber: '1', cells: {} }],
};
const SUMMARIES = [{ done: 31, started: 40, total: 45 }, { done: 0, started: 3, total: 45 }, { done: 0, started: 0, total: 0 }, null];

async function assertions(s, web) {
  const problems = [];
  const check = (name, test) => {
    try {
      if (!test()) problems.push(name);
    } catch (e) {
      problems.push(`${name} (threw: ${e.message})`);
    }
  };
  let r;
  try {
    r = await evaluate(s.rules, 'rules');
  } catch (e) {
    return [`the rules do not evaluate: ${e.message}`];
  }

  check('up one level is the breadcrumb\'s previous step, and none at the overview',
    () => r.parentNode(TABLE) === 'academiciq' && r.parentNode({ path: [{ node: 'overview' }] }) === null);
  check('the summary says done, or started when nobody is done',
    () => r.summaryText(SUMMARIES[0]) === '31 of 45 done' && r.summaryText(SUMMARIES[1]) === '3 of 45 started'
      && r.summaryText(SUMMARIES[2]) === '—');
  check('a class with no sections is not offered', () => r.flattenScope(SCOPE)[0].classes.length === 1);
  check('a section is found in the scope', () => r.findSection(SCOPE, '71').cls.classId === 7 && r.findSection(SCOPE, 9) === null);
  check('rows are searchable by name', () => r.searchableRows(TABLE)[0].studentName === 'Ravi Kumar');
  check('the app reads a table as the website does',
    () => SUMMARIES.every((x) => r.summaryText(x) === web.summaryText(x))
      && r.parentNode(TABLE) === web.parentNode(TABLE)
      && JSON.stringify(r.flattenScope(SCOPE)) === JSON.stringify(web.flattenScope(SCOPE))
      && JSON.stringify(r.LEGEND) === JSON.stringify(web.LEGEND) && JSON.stringify(r.STATES) === JSON.stringify(web.STATES));

  check('the service calls scope and one section\'s level',
    () => s.service.includes("staffApi.get(`${BASE}/scope`, { signal })")
      && s.service.includes("staffApi.get(`${BASE}/sections/${sectionId}`, { params: { node: node || 'overview' }, signal })")
      && s.service.includes("const BASE = '/api/staff/student-status';"));

  check('a column marked ▸ opens its node', () => s.screen.includes('disabled={!c.drill}') && s.screen.includes('onPress={() => setNode(c.node)}'));
  check('up one level goes to the parent, and the phone back does the same',
    () => s.screen.includes('const parent = parentNode(table);') && s.screen.includes('if (parent) setNode(parent);')
      && s.screen.includes('useDrillBack(depth, up);') && s.screen.includes('const depth = table ? Math.max(0, (table.path?.length || 1) - 1) : 0;'));
  check('choosing a section starts at its overview', () => /setSectionId\(id\);\n\s+setNode\('overview'\);/.test(s.screen));
  check('the breadcrumb jumps to any level above', () => s.screen.includes('onPress={() => setNode(crumb.node)}'));
  check('the students can be searched', () => s.screen.includes('<StudentSearchBar search={studentSearch} />')
    && s.screen.includes('studentSearch.results.map((row) => (') && s.screen.includes('useStudentSearch(rows)'));
  check('a level is re-read when the section or level changes', () => s.screen.includes('}, [sectionId, node, reload]);'));
  check('the screen is exported', () => s.index.includes("export { default as StudentStatusScreen } from './StudentStatusScreen';"));

  check('the teacher has the route and the menu entry',
    () => s.teacherRoute.includes('<StudentStatusScreen homeRoute="/teacher" />')
      && s.teacherLayout.includes('<Stack.Screen name="student-status" />')
      && s.teacherMenu.includes("{ key: 'studentStatus', label: 'Student Status', icon: 'podium-outline', native: '/teacher/student-status' }"));
  check('the staff route serves exactly the five roles with classes',
    () => s.staffRoute.includes(`const ROLES = ${JSON.stringify(ROLES).replace(/"/g, "'").replace(/,/g, ', ')};`)
      && s.staffRoute.includes('if (!ROLES.includes(roleKey)) return null;')
      && s.staffLayout.includes('<Stack.Screen name="student-status" />'));
  for (const role of ROLES) {
    check(`${role} has the menu entry`, () => s.staffRoles.includes(`native: '/staff/${role}/student-status' }`));
  }
  check('the sales and Shreyartha admin menus do not', () => !/shreyartha_admin\/student-status|sales\/student-status/.test(s.staffRoles));
  check('every staff home places it (four in Student Support, the principal\'s in School)',
    () => (s.staffHome.match(/itemKeys: \['studentStatus', 'counselling'/g) || []).length === 4
      && s.staffHome.includes("'students', 'studentStatus', 'linkedColleges'"));

  return problems;
}

const swap = (key, from, to) => (k, src) => (k === key ? src.replace(from, to) : src);
const MUTATIONS = [
  { name: 'up one level goes to the overview', src: swap('rules', 'path[path.length - 2].node', "'overview'") },
  { name: 'started never shown', src: swap('rules', '  if (done === 0 && started > 0) return `${started} of ${total} started`;\n', '') },
  { name: 'classes without sections offered', src: swap('rules', '.filter((c) => (c.sections || []).length > 0)', '') },
  { name: 'the app words drift from the website', src: swap('rules', "PARTIAL: 'Started',", "PARTIAL: 'In progress',") },
  { name: 'the overview always', src: swap('service', "params: { node: node || 'overview' }", "params: { node: 'overview' }") },
  { name: 'drill opens nothing', src: swap('screen', 'onPress={() => setNode(c.node)}', 'onPress={() => {}}') },
  { name: 'the phone back leaves the screen', src: swap('screen', 'useDrillBack(depth, up);', '') },
  { name: 'a new section keeps the old level', src: swap('screen', "    setSectionId(id);\n    setNode('overview');", '    setSectionId(id);') },
  { name: 'the search narrows nothing', src: swap('screen', 'studentSearch.results.map((row) => (', 'rows.map((row) => (') },
  { name: 'a level is never re-read', src: swap('screen', '}, [sectionId, node, reload]);', '}, [sectionId, reload]);') },
  { name: 'the teacher route is unregistered', src: swap('teacherLayout', '<Stack.Screen name="student-status" />', '') },
  { name: 'the staff route serves anyone', src: swap('staffRoute', 'if (!ROLES.includes(roleKey)) return null;', '') },
  { name: 'the counsellor loses the entry', src: swap('staffRoles', "native: '/staff/counselor/student-status' }", "native: '/staff/counselor/students' }") },
  { name: 'the principal\'s home misses it', src: swap('staffHome', "'students', 'studentStatus', 'linkedColleges'", "'students', 'linkedColleges'") },
];

const web = await evaluate(webRules(read(WEB)), 'web');

console.log('Self-tests (each mutation must be caught):');
const pristine = loadSources();
for (const m of MUTATIONS) {
  const mutated = loadSources(m.src);
  if (!Object.keys(mutated).some((k) => mutated[k] !== pristine[k])) {
    fail(`INERT: ${m.name} — its anchor no longer matches anything`);
    continue;
  }
  const problems = await assertions(mutated, web);
  if (problems.length > 0) ok(m.name);
  else fail(`NOT CAUGHT: ${m.name}`);
}

console.log('\nStudent Status:');
const problems = await assertions(pristine, web);
if (problems.length === 0) ok('rules, service, screen, routes, menus and homes');
else problems.forEach(fail);

console.log(failures === 0 ? `\ncheckstudentstatus PASSED: ${MUTATIONS.length} mutations all caught.` : `\nFAIL — ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
