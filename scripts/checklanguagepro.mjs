// Checker for "in language pro it shows ICSE+CBSE — that should not show anywhere".
//
//   node scripts/checklanguagepro.mjs
//
// WHY THIS EXISTS, and why it does NOT grep for "ICSE".
//
// "ICSE+CBSE" appears nowhere in this repo's source. It is the `name` column of an admin-authored
// AdminLanguageProCurriculum row, returned verbatim by GET /api/languagepro/tree. Grepping for the
// literal would pass forever while the bug sat there in plain sight.
//
// What actually put it on screen was a STRUCTURAL divergence from the website: the web takes
// tree[0] and never renders its name, while this screen started with `curriculum === null` and
// fell through to a curriculum picker the web has no equivalent of. So the assertions below are
// about that structure — that School/College Resources auto-selects, that no render path prints a
// curriculum's `.name`, and that the auto-select still honours the access gate the picker used to
// apply.
//
// Exit code 0 = pass.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`  ✗ ${msg}`);
};
const ok = (msg) => console.log(`  ✓ ${msg}`);

const read = (p) => fs.readFileSync(path.join(APP, p), 'utf8').replace(/\r\n/g, '\n');
const SCREEN = 'components/student/languagepro/LanguageProResources.js';

/**
 * Strips comments before asserting. Without this every rule here would be satisfied by the
 * explanatory comments that mention `curriculum.name` — the checker would be grading its own
 * documentation.
 */
const code = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function runChecks(mutate) {
  const before = failures;
  const raw = mutate ? mutate(SCREEN, read(SCREEN)) : read(SCREEN);
  const src = code(raw);

  // 1. No render path may print a curriculum's board name.
  const nameRenders = [...src.matchAll(/\{\s*(?:c|cur|curriculum)\.name\s*\}/g)];
  if (nameRenders.length) {
    fail(`${SCREEN}: renders a curriculum .name (${nameRenders.length} site(s)) — that is the board name`);
  } else {
    ok('no curriculum .name is rendered anywhere');
  }
  // ...including inside the breadcrumb trail.
  if (/\[\s*curriculum\.name/.test(src)) {
    fail(`${SCREEN}: breadcrumb still leads with curriculum.name`);
  } else {
    ok('breadcrumb does not lead with the board name');
  }

  // 2. School/College Resources must auto-select, so the picker step never renders.
  if (!/if \(personalized \|\| gate\.loading \|\| curriculum \|\| curriculums\.length === 0\) return;/.test(src)) {
    fail(`${SCREEN}: no auto-select effect — the curriculum picker will render again`);
  } else {
    ok('School/College Resources auto-select the first curriculum');
  }

  // 3. The auto-select must respect what the picker used to enforce. Selecting the raw first
  //    element would open a hidden or locked curriculum that the student cannot access.
  const effect = src.slice(src.indexOf('if (personalized || gate.loading'));
  if (!/gate\.visible\('CURRICULUM', curriculums\)\[0\]/.test(effect)) {
    fail(`${SCREEN}: auto-select must pick from gate.visible(...), not the raw array`);
  } else {
    ok('auto-select honours the hidden-node filter');
  }
  if (!/gate\.level\('CURRICULUM', first\.id\) === ACCESS\.LOCKED/.test(effect)) {
    fail(`${SCREEN}: auto-select must not open a LOCKED curriculum`);
  } else {
    ok('auto-select honours the LOCKED gate');
  }

  // 4. Personalized keeps its list — that is the class-step-down content — but labelled by class.
  if (!/const label = \(c\.classes \|\| \[\]\)\[0\]\?\.name/.test(src)) {
    fail(`${SCREEN}: personalized rows must be labelled by class, not by c.name`);
  } else {
    ok('personalized rows are labelled by class');
  }
  if (!/renderCurriculums/.test(src)) {
    fail(`${SCREEN}: renderCurriculums removed — personalized step-down content would be unreachable`);
  } else {
    ok('the personalized curriculum list still exists');
  }

  // 5. The endpoints must stay identical to the website's — this was never a data-fetching bug,
  //    and "fixing" it by switching endpoints would break it in a new way.
  const svc = code(read('services/student/languageProService.js'));
  if (!svc.includes("'/api/languagepro/tree'")) {
    fail('languageProService no longer calls /api/languagepro/tree');
  } else {
    ok('still fetches /api/languagepro/tree, exactly as the web does');
  }
  // GET /api/languagepro/school exists but its body calls the personalized service — a known trap.
  if (/['"]\/api\/languagepro\/school['"]/.test(svc)) {
    fail('languageProService calls /api/languagepro/school — that endpoint is dead (returns personalized data)');
  } else {
    ok('does not call the dead /api/languagepro/school endpoint');
  }

  // 6. No board name may reappear as hardcoded copy anywhere the student can see.
  //
  // `src` for the screen, not a fresh read: re-reading from disk here would ignore the mutation
  // under test, which is precisely how this assertion first shipped silently vacuous.
  const copySources = [
    ['constants/pageData.js', code(mutate ? mutate('constants/pageData.js', read('constants/pageData.js'))
                                          : read('constants/pageData.js'))],
    [SCREEN, src],
  ];
  for (const [f, text] of copySources) {
    const hits = [...text.matchAll(/\b(ICSE|CBSE)\b/g)];
    if (hits.length) {
      fail(`${f}: ${hits.length} hardcoded board name(s) in user-visible copy`);
    } else {
      ok(`${f}: no hardcoded board names`);
    }
  }

  return failures === before;
}

const MUTATIONS = [
  {
    name: 'the picker prints the board name again',
    mutate: (p, s) => s.replace('<Text style={styles.linkTitle}>{label}</Text>',
                                '<Text style={styles.linkTitle}>{c.name}</Text>'),
  },
  {
    name: 'the breadcrumb leads with the board name again',
    mutate: (p, s) => s.replace('const trail = [matchedClass?.name',
                                'const trail = [curriculum.name, matchedClass?.name'),
  },
  {
    name: 'the auto-select effect is removed (picker step returns)',
    mutate: (p, s) => s.replace(
      'if (personalized || gate.loading || curriculum || curriculums.length === 0) return;',
      'if (true) return;'),
  },
  {
    name: 'auto-select ignores the hidden-node filter',
    mutate: (p, s) => s.replace("gate.visible('CURRICULUM', curriculums)[0]", 'curriculums[0]'),
  },
  {
    name: 'auto-select opens a LOCKED curriculum',
    mutate: (p, s) => s.replace(
      "if (!first || gate.level('CURRICULUM', first.id) === ACCESS.LOCKED) return;",
      'if (!first) return;'),
  },
  {
    name: 'a board name is hardcoded back into the screen',
    mutate: (p, s) => s.replace("|| 'Recommended resources'", "|| 'ICSE+CBSE'"),
  },
];

console.log('Language Pro — no board picker, no board name\n');
runChecks();

console.log('\nmutation tests (each must FAIL the checks above)\n');
let uncaught = 0;
for (const { name, mutate } of MUTATIONS) {
  const saved = failures;
  const e = console.error;
  const l = console.log;
  console.error = () => {};
  console.log = () => {};
  const stillPasses = runChecks(mutate);
  console.error = e;
  console.log = l;
  failures = saved;
  if (stillPasses) {
    uncaught += 1;
    console.error(`  ✗ NOT CAUGHT: ${name}`);
  } else {
    console.log(`  ✓ caught: ${name}`);
  }
}

const total = failures + uncaught;
console.log(total === 0 ? '\nAll Language Pro checks passed.'
                        : `\n${failures} failure(s), ${uncaught} uncaught mutation(s).`);
process.exit(total === 0 ? 0 : 1);
