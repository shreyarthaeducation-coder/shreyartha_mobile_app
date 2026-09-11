// scripts/checkexpenses.mjs
//
// "My Expenses" is for Shreyartha's own employees — Shreyartha teachers, Shreyartha counsellors and
// sales reps — and nobody else, on both the app and the website. And a claim must never present a
// straight-line estimate as a road distance, never price public transport without its fare, and
// never offer editing once submitted. None of that is visible to a build.
//
// Asserts on the constructs themselves (the menu entry, the flag, the JSX branch), never on a bare
// name that also appears elsewhere. Every mutation must plant — change bytes — or it is reported as
// inert, and must then turn at least one assertion red.
//
// Usage: node scripts/checkexpenses.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.resolve(APP, '..', 'frontendmain', 'src');

const FILES = {
  roles: path.join(APP, 'constants', 'staffRoles.js'),
  home: path.join(APP, 'constants', 'staffHome.js'),
  route: path.join(APP, 'app', 'staff', '[role]', 'travel-expenses.js'),
  screen: path.join(APP, 'components', 'staff', 'TravelExpensesScreen.js'),
  service: path.join(APP, 'services', 'travelExpenseService.js'),
  webSales: path.join(WEB, 'Sales', 'platform', 'SalesLayout.js'),
  webTeacher: path.join(WEB, 'School', 'ShreyarthaTeacher', 'ShreyarthaTeacherSidebar.js'),
  webShreyaCounsellor: path.join(WEB, 'School', 'ShreyarthaCounsellor', 'index.js'),
  webSchoolCounsellor: path.join(WEB, 'School', 'Counselor', 'index.js'),
  webSidebar: path.join(WEB, 'School', 'Counselor', 'components', 'CounselorSidebar.js'),
  webPage: path.join(WEB, 'School', 'shared', 'TravelExpenses.js'),
};

const load = () =>
  Object.fromEntries(
    Object.entries(FILES).map(([key, file]) => [key, fs.readFileSync(file, 'utf8').split('\r\n').join('\n')]),
  );

const EXPENSE_ROLES = ['sales', 'shreyartha_teacher', 'shreyartha_councellor'];
const OTHER_ROLES = ['principal', 'vice_principal', 'counselor'];

/** The text of one role's block in staffRoles.js / staffHome.js: from its key to the next role key. */
function roleBlock(src, key) {
  const start = src.search(new RegExp(`\\n  ${key}: \\{`));
  if (start < 0) return '';
  const rest = src.slice(start + 1);
  const next = rest.slice(1).search(/\n  [a-z_]+: \{/);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

/** staffHome.js declares each role as a top-level const. */
function homeBlock(src, constName) {
  const start = src.indexOf(`const ${constName} = {`);
  if (start < 0) return '';
  const next = src.indexOf('\nconst ', start + 10);
  return next < 0 ? src.slice(start) : src.slice(start, next);
}

const HOME_CONST = { sales: 'SALES', shreyartha_teacher: 'SHREYARTHA_TEACHER', shreyartha_councellor: 'SHREYARTHA_COUNCELLOR' };

const ASSERTIONS = [
  ...EXPENSE_ROLES.map((role) => ({
    name: `the ${role} menu carries My Expenses, native, on its own route`,
    test: (s) =>
      roleBlock(s.roles, role).includes(
        `{ key: 'expenses', label: 'My Expenses', icon: 'car-outline', native: '/staff/${role}/travel-expenses' }`,
      ),
  })),
  ...OTHER_ROLES.map((role) => ({
    name: `the ${role} menu does NOT carry My Expenses (not a Shreyartha employee)`,
    test: (s) => roleBlock(s.roles, role).length > 0 && !roleBlock(s.roles, role).includes("key: 'expenses'"),
  })),
  ...EXPENSE_ROLES.map((role) => ({
    name: `the ${role} home places the expenses tile`,
    test: (s) => /itemKeys: \[[^\]]*'expenses'[^\]]*\]/.test(homeBlock(s.home, HOME_CONST[role])),
  })),
  {
    name: 'the route renders the shared screen',
    test: (s) => s.route.includes('return <TravelExpensesScreen homeRoute='),
  },
  {
    name: 'a ticket photo is sent with its date and trip key',
    test: (s) =>
      s.service.includes("staffApi.multipart(`${BASE}/day/receipt`, { fields: { date, legKey }, files: { file } })"),
  },
  {
    name: 'a straight-line figure is badged in the app',
    test: (s) => /\{leg\.distanceSource === 'STRAIGHT_LINE' \? \(\s*<Text style=\{styles\.badge\}>straight-line<\/Text>/.test(s.screen),
  },
  {
    name: 'a straight-line figure is badged on the website',
    test: (s) => /leg\.distanceSource === "STRAIGHT_LINE" && \(\s*<span className="te-badge te-badge--warn"/.test(s.webPage),
  },
  {
    name: 'the fare field appears only for public transport',
    test: (s) => /\{mode === 'PUBLIC_TRANSPORT' \? \(\s*<>\s*<TextField\s+label="Fare you paid/.test(s.screen),
  },
  {
    name: 'editing controls sit behind `editable`',
    test: (s) => {
      const i = s.screen.indexOf('{editable ? (\n                    <>\n                      <Select');
      const footer = s.screen.indexOf('{editable ? (\n            <>\n              <Pressable\n                onPress={() => homeBase');
      return i > 0 && footer > i;
    },
  },
  {
    name: 'submitting asks for confirmation first',
    test: (s) => {
      const fn = s.screen.slice(s.screen.indexOf('const submit = () =>'), s.screen.indexOf('const attachTicket'));
      return fn.indexOf('Alert.alert(') >= 0 && fn.indexOf('Alert.alert(') < fn.indexOf('submitTravelDay(');
    },
  },
  {
    name: 'web: the Sales nav carries My Expenses',
    test: (s) => s.webSales.includes('{ key: "expenses", label: "My Expenses", icon: "🚗", path: "/sales/platform/dashboard/expenses" }'),
  },
  {
    name: 'web: the Shreyartha teacher sidebar carries My Expenses',
    test: (s) => /\{ key: "expenses",\s+label: "My Expenses",\s+path: `\$\{BASE\}\/expenses` \}/.test(s.webTeacher),
  },
  {
    name: 'web: the Shreyartha counsellor switches the flag on',
    test: (s) => s.webShreyaCounsellor.includes('includeTravelExpenses: true,'),
  },
  {
    name: 'web: the school counsellor does not',
    test: (s) => !s.webSchoolCounsellor.includes('includeTravelExpenses'),
  },
  {
    name: 'web: the counsellor sidebar adds the item only behind the flag',
    test: (s) => /if \(includeTravelExpenses\) \{\s+menuItems\.push\(\{\s+key: "expenses",/.test(s.webSidebar),
  },
];

const MUTATIONS = [
  ['the sales menu loses My Expenses', 'roles', "native: '/staff/sales/travel-expenses' }", "native: '/staff/sales/my-calendar' }"],
  [
    'My Expenses leaks into the principal menu',
    'roles',
    "  principal: {",
    "  principal: {\n    // key: 'expenses'",
  ],
  ['the teacher home drops the tile', 'home', "itemKeys: ['myCalendar', 'upskill', 'expenses'],", "itemKeys: ['myCalendar', 'upskill'],"],
  ['the receipt loses its trip key', 'service', 'fields: { date, legKey }', 'fields: { date }'],
  ['the app hides the straight-line badge', 'screen', "{leg.distanceSource === 'STRAIGHT_LINE' ? (", "{leg.distanceSource === 'ROAD' ? ("],
  ['the website hides the straight-line badge', 'webPage', 'leg.distanceSource === "STRAIGHT_LINE" && (', 'leg.distanceSource === "ROAD" && ('],
  ['the fare field shows for every mode', 'screen', "{mode === 'PUBLIC_TRANSPORT' ? (\n                        <>", "{mode ? (\n                        <>"],
  [
    'Save and Submit shown on a submitted claim',
    'screen',
    '{editable ? (\n            <>\n              <Pressable\n                onPress={() => homeBase',
    '{true ? (\n            <>\n              <Pressable\n                onPress={() => homeBase',
  ],
  [
    'submit without confirming',
    'screen',
    "  const submit = () =>\n    Alert.alert(",
    "  const submit = () =>\n    (() => {})(",
  ],
  ['web Sales nav loses it', 'webSales', '{ key: "expenses", label: "My Expenses"', '{ key: "expensesX", label: "My Expenses"'],
  ['school counsellors get it', 'webSchoolCounsellor', '      includeF2F', '      includeTravelExpenses\n      includeF2F'],
  ['the sidebar stops checking the flag', 'webSidebar', 'if (includeTravelExpenses) {', 'if (true) {'],
];

const run = (sources) => ASSERTIONS.filter((a) => !a.test(sources)).map((a) => a.name);

const sources = load();
const failing = run(sources);
if (failing.length) {
  console.error('checkexpenses FAILED:');
  failing.forEach((name) => console.error(`  ✗ ${name}`));
  process.exit(1);
}

let problems = 0;
for (const [name, key, from, to] of MUTATIONS) {
  if (!sources[key].includes(from)) {
    console.error(`  ✗ could not plant "${name}" — that mutation is inert and proves nothing`);
    problems += 1;
    continue;
  }
  const mutated = { ...sources, [key]: sources[key].replace(from, to) };
  if (mutated[key] === sources[key]) {
    console.error(`  ✗ "${name}" changed nothing — inert`);
    problems += 1;
    continue;
  }
  if (!run(mutated).length) {
    console.error(`  ✗ NOT CAUGHT: ${name}`);
    problems += 1;
  }
}

if (problems) {
  console.error(`checkexpenses: ${problems} mutation problem(s).`);
  process.exit(1);
}
console.log(`checkexpenses PASSED: ${ASSERTIONS.length} assertions, ${MUTATIONS.length} mutations all caught.`);
