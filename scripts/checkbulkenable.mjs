// Bulk enable of psychometric tests in Wellness Groups (10 Oct 2026).
//
// Evaluates utils/psychometricBulkEnable.js for real, checks it agrees with the website's twin on
// the same inputs, and reads the sheet's wiring. Every assertion is mutation-tested first.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const WEB = path.resolve(APP, '../frontendmain/src/School/shared/PsychometricBulkEnable/bulkEnable.js');

let failures = 0;
const fail = (m) => {
  failures += 1;
  console.error(`  ✗ ${m}`);
};
const ok = (m) => console.log(`  ✓ ${m}`);
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

const FILES = {
  rules: 'utils/psychometricBulkEnable.js',
  sheet: 'components/staff/counsellor/BulkEnableSheet.js',
  screen: 'components/staff/WellnessGroupsScreen.js',
  service: 'services/counsellor/psychometricService.js',
};

function loadSources(mutate) {
  const out = {};
  for (const [k, rel] of Object.entries(FILES)) {
    const src = read(path.join(APP, rel));
    out[k] = mutate ? mutate(k, src) : src;
  }
  return out;
}

async function evaluate(src, name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bulkenable-'));
  const file = path.join(dir, `${name}.mjs`);
  fs.writeFileSync(file, src);
  return import(pathToFileURL(file).href + `?t=${Math.random()}`);
}

const SET = {
  psychometricClassId: 70,
  chapters: [
    { chapterId: 1, chapterName: 'Learning', topics: [{ topicId: 11 }, { topicId: 12 }] },
    { chapterId: 2, chapterName: 'Interests', topics: [{ topicId: 13 }] },
  ],
};
const SECTIONS = [
  { sectionId: 101, sectionName: 'A', students: 2, openCounts: { 11: 2, 12: 1, 13: 1 } },
  { sectionId: 102, sectionName: 'B', students: 3, openCounts: { 11: 3, 12: 3, 13: 3 } },
];
const LINES = [
  [{ sectionName: 'A', students: 2, studentsChanged: 2, opened: 1, closed: 3, sawEverything: 1 }, false],
  [{ sectionName: 'B', students: 30, studentsChanged: 0, opened: 0, closed: 0, sawEverything: 0 }, false],
  [{ sectionName: 'C', students: 0 }, false],
  [{ sectionName: 'A', students: 2, studentsChanged: 1, opened: 2, closed: 0, sawEverything: 0 }, true],
];
const HEADS = [{ openTests: 0, totalTests: 3, className: 'Class 7' }, { openTests: 3, totalTests: 3, className: 'Class 7' },
  { openTests: 1, totalTests: 3, className: 'Class 7' }];

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

  check('a test starts ticked only when open for every chosen student',
    () => [...r.defaultTicks(SET, SECTIONS, [101])].join() === '11'
      && [...r.defaultTicks(SET, SECTIONS, [102])].join() === '11,12,13'
      && [...r.defaultTicks(SET, SECTIONS, [])].length === 0);
  check('counts cover the chosen sections only',
    () => r.studentsIn(SECTIONS, [101, 102]) === 5 && r.openCount(SECTIONS, [101, 102], 12) === 4
      && r.openCount(SECTIONS, [101], 13) === 1);
  check('the preview names the change and who saw everything before',
    () => r.describeSection(LINES[0][0]).includes('1 student had every test open before')
      && r.describeSection(LINES[1][0]).endsWith('already set this way, nothing changes.'));
  check('the headline names the all-closed case', () => /will be closed/.test(r.headline(HEADS[0])));
  check('the app and the website say the same thing', () => {
    const same = (f, ...args) => JSON.stringify([...[].concat(r[f](...args))]) === JSON.stringify([...[].concat(web[f](...args))]);
    return LINES.every(([line, applied]) => r.describeSection(line, applied) === web.describeSection(line, applied))
      && HEADS.every((h) => r.headline(h) === web.headline(h))
      && [[101], [102], [101, 102]].every((ids) => [...r.defaultTicks(SET, SECTIONS, ids)].join() === [...web.defaultTicks(SET, SECTIONS, ids)].join())
      && same('topicIdsOf', SET);
  });

  // Service: the three endpoints.
  check('the service calls the three bulk-enable endpoints',
    () => s.service.includes('`${BASE}/bulk-enable/options`, { params: { classId }, signal }')
      && s.service.includes('`${BASE}/bulk-enable/preview`, body, { signal }')
      && s.service.includes('staffApi.post(`${BASE}/bulk-enable`, body)'));

  // The sheet.
  check('the sheet sends exactly the ticked tests',
    () => s.sheet.includes('openTopicIds: allIds.filter((id) => ticked.has(id))'));
  check('Apply waits for a preview and refuses a no-op',
    () => s.sheet.includes('submitDisabled={!preview || changes === 0}') && s.sheet.includes("'Nothing to change'"));
  check('the sheet opens on the section on screen, else every section',
    () => s.sheet.includes('ids.includes(initialSectionId) ? [initialSectionId] : ids'));
  check('a streamed class must be chosen, not guessed',
    () => s.sheet.includes('res?.testSets?.length === 1 ? res.testSets[0] : null'));
  check('the preview is re-fetched whenever the choice changes', () => /\}, \[body\]\);/.test(s.sheet));

  // The screen.
  check('Wellness Groups offers the sheet once a class is chosen',
    () => s.screen.includes("import BulkEnableSheet from './counsellor/BulkEnableSheet';")
      && s.screen.includes('{scope.classId ? (') && s.screen.includes('onPress={() => setBulkOpen(true)}'));
  check('the sheet gets the class and the section on screen',
    () => s.screen.includes('classId={scope.classId}') && s.screen.includes('initialSectionId={scope.sectionId}'));

  return problems;
}

const swap = (key, from, to) => (k, src) => (k === key ? src.replace(from, to) : src);
const MUTATIONS = [
  { name: 'ticked when open for anyone', src: swap('rules', 'openCount(sections, chosenIds, id) === students', 'openCount(sections, chosenIds, id) > 0') },
  { name: 'unchosen sections counted', src: swap('rules', '.filter((s) => chosen.has(s.sectionId))\n    .reduce((n, s) => n + (s.openCounts', '.reduce((n, s) => n + (s.openCounts') },
  { name: 'saw-everything note dropped', src: swap('rules', '  if (sawEverything) {', '  if (false) {') },
  { name: 'app wording drifts from the website', src: swap('rules', 'already set this way, nothing changes.', 'nothing to do.') },
  { name: 'every test sent, ticked or not', src: swap('sheet', 'openTopicIds: allIds.filter((id) => ticked.has(id))', 'openTopicIds: allIds') },
  { name: 'Apply without a preview', src: swap('sheet', 'submitDisabled={!preview || changes === 0}', 'submitDisabled={false}') },
  { name: 'section on screen ignored', src: swap('sheet', 'ids.includes(initialSectionId) ? [initialSectionId] : ids', 'ids') },
  { name: 'a streamed class takes the first set', src: swap('sheet', 'res?.testSets?.length === 1 ? res.testSets[0] : null', 'res?.testSets?.[0] || null') },
  { name: 'the preview never refreshes', src: swap('sheet', '}, [body]);', '}, []);') },
  { name: 'the preview endpoint writes', src: swap('service', '`${BASE}/bulk-enable/preview`, body, { signal }', '`${BASE}/bulk-enable`, body, { signal }') },
  { name: 'the button is gone', src: swap('screen', 'onPress={() => setBulkOpen(true)}', 'onPress={() => {}}') },
  { name: 'the section on screen is not passed', src: swap('screen', 'initialSectionId={scope.sectionId}', '') },
];

const web = await evaluate(read(WEB), 'web');

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

console.log('\nBulk enable:');
const problems = await assertions(pristine, web);
if (problems.length === 0) ok('rules, sheet, service and Wellness Groups wiring');
else problems.forEach(fail);

console.log(failures === 0 ? `\ncheckbulkenable PASSED: ${MUTATIONS.length} mutations all caught.` : `\nFAIL — ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
