// The three restored teacher-facing features: Teacher's Resources, Homework, Personalised Resources.
//
//   node scripts/checkresources.mjs
//
// WHY THIS EXISTS. Every failure mode in this area is a 200 with a plausible empty list. There is
// nothing to crash and nothing for `expo export` to see.
//
//   * `/api/students/personali**s**ed-resources` and `/api/students/personali**z**ed-resources` are
//     ONE LETTER APART, live in different packages, and return different things. Swapping them
//     gives you a working screen showing the wrong feature — which is exactly the bug report that
//     started this work: "personalised resources isn't fetching", filed against a screen that was
//     fetching correctly, for a feature that had never been built.
//   * A subject row carries TWO ids. Chapters hang off `academicIqSubjectId`, items are scoped by
//     `id`. Swapping them returns an empty tree, not an error.
//   * `subjectId` is a required @RequestParam on three endpoints. Omitting it is a 400 whose body
//     carries no `message`, which studentApi renders as a silently empty screen.
//   * `assignedDate` through `toISOString()` shifts the calendar dot by a day east of Greenwich.
//     The parent port shipped exactly this bug once already.
//   * The DTO's flag is `completed`. The WEBSITE reads `isCompleted`, a property that does not
//     exist, so its tick never lights — copying the web here would copy a live bug.
//
// Exit code 0 = pass.

// THE CHECKER RUNS WEST OF GREENWICH, DELIBERATELY.
//
// `new Date("2026-08-24")` parses as UTC midnight. In a UTC+X zone that is still the 24th locally,
// so the bug it causes is INVISIBLE on a machine in India — where this repo is developed. Running
// the date assertions under a negative offset is the only way they can fail when they should:
// without this line, deleting the bare-LocalDate fast path passes every test here and ships a
// calendar that is a day out for anyone in the Americas.
//
// Set before the first Date is constructed, which is why it is above the imports' side effects.
process.env.TZ = 'America/New_York';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');

const SRC = {
  personalised: 'services/student/personalisedResourceService.js',
  resources: 'services/student/resourceService.js',
  academicIq: 'services/student/academicIqService.js',
  teacherScreen: 'components/student/resources/TeacherResourcesScreen.js',
  personalScreen: 'components/student/resources/PersonalisedResourcesScreen.js',
  iqScreen: 'components/student/academiciq/ResourcesScreen.js',
  menu: 'constants/studentMenu.js',
};

let failures = 0;
const fail = (m) => {
  failures += 1;
  console.error(`  ✗ ${m}`);
};
const ok = (m) => console.log(`  ✓ ${m}`);

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

/**
 * Comments stripped before every source assertion.
 *
 * LOAD-BEARING HERE. Both services document the `s`/`z` trap in prose and name BOTH spellings in
 * their headers, so a bare grep for the wrong one finds the warning and reports the bug as present.
 * The naive block-comment regex also eats `'image/*'`, so the leading-boundary form is used.
 */
const codeOnly = (t) =>
  t.replace(/(^|\s)\/\*[\s\S]*?\*\//g, '$1').replace(/^\s*\/\/.*$/gm, '');

function loadSources(mutate) {
  const out = {};
  for (const [k, rel] of Object.entries(SRC)) {
    out[k] = mutate ? mutate(k, read(path.join(APP, rel))) : read(path.join(APP, rel));
  }
  return out;
}

/** Stage a service as .mjs with its transport stubbed, so its pure helpers can be RUN. */
async function loadPersonalised(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'res-'));
  let src = read(path.join(APP, SRC.personalised));
  if (mutate) src = mutate(src);
  src = src.replace(
    /^import \{ studentApi \}.*$/m,
    'const studentApi = { get: async () => [], put: async () => ({}) };',
  );
  const file = path.join(dir, 'personalised.mjs');
  fs.writeFileSync(file, src);
  return import(`${pathToFileURL(file).href}?t=${Math.random()}`);
}

/** studentMenu.js is import-free apart from `require` for images. */
async function loadMenu(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'resmenu-'));
  let src = read(path.join(APP, SRC.menu));
  if (mutate) src = mutate(src);
  const file = path.join(dir, 'studentMenu.mjs');
  fs.writeFileSync(file, `const require = () => null;\n${src}`);
  return import(`${pathToFileURL(file).href}?t=${Math.random()}`);
}

function assertions(svc, menu, src) {
  const out = [];
  const bad = (m) => out.push(m);

  /* ── 1. THE ONE-LETTER TRAP ──────────────────────────────────────────────── */

  const personalised = codeOnly(src.personalised);
  const academicIq = codeOnly(src.academicIq);

  if (!/personalised-resources/.test(personalised)) {
    bad('personalisedResourceService does not call the British `s` endpoint — it is serving the wrong feature');
  }
  if (/personalized-resources/.test(personalised)) {
    bad('personalisedResourceService reaches for the `z` endpoint — that is the Academic IQ tree, not assigned resources');
  }
  if (!/personalized-resources/.test(academicIq)) {
    bad('academicIqService no longer calls the `z` endpoint');
  }
  if (/personalised-resources/.test(academicIq)) {
    bad('academicIqService reaches for the `s` endpoint — that is the teacher-assigned list, not the profile tree');
  }
  // Both must be complete: the toggle needs complete AND uncomplete, or a tick cannot be undone.
  for (const verb of ['complete', 'uncomplete']) {
    if (!new RegExp(`'${verb}'`).test(personalised)) {
      bad(`the personalised service has no ${verb} path — a tick that cannot be reversed`);
    }
  }

  /* ── 2. THE LOCAL DATE KEY ───────────────────────────────────────────────── */

  if (/toISOString/.test(personalised)) {
    bad('the personalised service uses toISOString() — that converts to UTC and moves the calendar dot a day');
  }

  // Behaviour, not shape. An 11pm local timestamp must stay on ITS day.
  const evening = new Date(2026, 7, 24, 23, 30, 0); // 24 Aug 2026, 23:30 local
  if (svc.dateKey(evening) !== '2026-08-24') {
    bad(`dateKey(23:30 on the 24th) = ${svc.dateKey(evening)}, expected 2026-08-24 — the day has shifted`);
  }
  // A bare LocalDate must be returned untouched: `new Date("2026-08-24")` parses as UTC midnight,
  // which is the same shift by another route.
  if (svc.resourceDateKey({ assignedDate: '2026-08-24' }) !== '2026-08-24') {
    bad('resourceDateKey re-parses a bare LocalDate and shifts it');
  }
  // assignedDate wins over createdAt — a teacher can set work today for next Monday.
  const both = svc.resourceDateKey({ assignedDate: '2026-09-01', createdAt: '2026-08-24T10:00:00' });
  if (both !== '2026-09-01') {
    bad(`resourceDateKey preferred createdAt over assignedDate (${both}) — work would show on the day it was typed`);
  }
  if (svc.resourceDateKey({}) !== null) bad('resourceDateKey invents a date for a row that has none');

  const grouped = svc.groupByDate([
    { id: 1, assignedDate: '2026-08-24' },
    { id: 2, assignedDate: '2026-08-24' },
    { id: 3, assignedDate: '2026-08-25' },
    { id: 4 },
  ]);
  if (grouped['2026-08-24']?.length !== 2 || grouped['2026-08-25']?.length !== 1) {
    bad('groupByDate does not group rows by their assigned day');
  }
  if (Object.values(grouped).flat().some((r) => r.id === 4)) {
    bad('groupByDate placed a dateless row on some day');
  }

  /* ── 3. THE DTO'S FLAG IS `completed` ────────────────────────────────────── */

  const personalScreen = codeOnly(src.personalScreen);
  if (/isCompleted/.test(personalScreen)) {
    bad('the screen reads `isCompleted` — the WEBSITE does that and its tick never lights; the DTO field is `completed`');
  }
  if (!/updated\?\.completed/.test(personalScreen)) {
    bad('the toggle does not merge the server response — completedAt is the server\'s to decide');
  }

  /* ── 4. THE TWO SUBJECT IDS, AND THE REQUIRED subjectId ──────────────────── */

  const resources = codeOnly(src.resources);
  const teacherScreen = codeOnly(src.teacherScreen);

  if (!/academicIqSubjectId/.test(teacherScreen)) {
    bad('the screen does not read academicIqSubjectId — chapters hang off the ACADEMIC id, not subject.id');
  }
  if (!/fetchChapters\(subject\.academicIqSubjectId\)/.test(teacherScreen)) {
    bad('fetchChapters is not called with the academic id');
  }
  if (!/fetchTopicItems\(tab, topic\.id, subject\.id\)/.test(teacherScreen)) {
    bad('fetchTopicItems is not scoped by subject.id — items use the SCHOOL id, not the academic one');
  }
  if (!/params: \{ subjectId \}/.test(resources)) {
    bad('subjectId is not sent as a query param — a 400 with no message renders as an empty screen');
  }
  // Both item endpoints and /homework/all need it. Three call sites, one guard each.
  const paramSites = (resources.match(/params: \{ subjectId/g) || []).length;
  if (paramSites < 2) {
    bad(`only ${paramSites} call(s) send subjectId; the topic reader and /homework/all both require it`);
  }
  // homeworkId is a @RequestParam, not a part.
  if (!/homework\/submit\$\{buildIdQuery/.test(resources)) {
    bad('homeworkId is not in the query string — it is a @RequestParam, and a form field is a different binding path');
  }
  if (/fields: \{ homeworkId/.test(resources)) {
    bad('homeworkId is being sent as a multipart field rather than a query parameter');
  }
  // The double segment is real: BASE ends in /resources and the controller repeats it.
  if (!/\$\{BASE\}\/\$\{segment\}\/topic\//.test(resources)) {
    bad('the topic path no longer builds from BASE + segment — /resources/resources/topic is correct, not a typo');
  }

  /* ── 5. A 403 IS RENDERED, NOT SWALLOWED ─────────────────────────────────── */

  for (const [key, label] of [['teacherScreen', "Teacher's Resources"], ['personalScreen', 'Personalised Resources']]) {
    if (!/isForbidden/.test(codeOnly(src[key]))) {
      bad(`${label} does not branch on isForbidden — college students get a 403 and would see an empty list`);
    }
  }

  /* ── 6. THE ACADEMIC IQ SCREEN NO LONGER BLAMES THE TEACHER ──────────────── */

  const iqScreen = codeOnly(src.iqScreen);
  if (/teacher has not assigned/i.test(iqScreen)) {
    bad('the Academic IQ empty state still blames the teacher — that endpoint reads the STUDENT\'s own profile');
  }
  if (!/lastSavedAt/.test(iqScreen)) {
    bad('the lastSavedAt hint is missing — it is how a student learns their profile was never saved');
  }

  /* ── 7. THE WORKSPACE LINKS ──────────────────────────────────────────────── */

  const links = menu.STUDENT_TEACHER_LINKS;
  if (!Array.isArray(links) || links.length !== 3) {
    bad(`STUDENT_TEACHER_LINKS has ${links?.length} entries, expected the web's 3 floating buttons`);
  } else {
    const routes = links.map((l) => l.native || '');
    if (!routes.some((r) => r.includes('tab=resources'))) bad("no link opens Teacher's Resources");
    if (!routes.some((r) => r.includes('tab=homework'))) bad('no link opens Homework');
    if (!routes.some((r) => r.includes('/personalised-resources'))) {
      bad('no link opens Personalised Resources — or it points at the `z` spelling');
    }
    if (routes.some((r) => r.includes('personalized-resources'))) {
      bad('a workspace link points at the `z` endpoint route — that is the Academic IQ tree');
    }
  }

  return out;
}

const MUTATIONS = [
  {
    name: 'THE TRAP: the personalised service switched to the `z` endpoint',
    svc: (s) => s.replaceAll('personalised-resources', 'personalized-resources'),
    src: (k, s) => (k === 'personalised' ? s.replaceAll('personalised-resources', 'personalized-resources') : s),
  },
  {
    name: 'THE TRAP: the Academic IQ service switched to the `s` endpoint',
    src: (k, s) => (k === 'academicIq' ? s.replace("'/api/students/personalized-resources'", "'/api/students/personalised-resources'") : s),
  },
  {
    name: 'THE DATE BUG: the calendar key routed through toISOString()',
    svc: (s) =>
      s.replace(
        'return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;',
        'return d.toISOString().slice(0, 10);',
      ),
    src: (k, s) =>
      k === 'personalised'
        ? s.replace(
            'return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;',
            'return d.toISOString().slice(0, 10);',
          )
        : s,
  },
  {
    name: 'a bare LocalDate re-parsed through Date (UTC midnight shift)',
    svc: (s) => s.replace('if (bare) return `${bare[1]}-${bare[2]}-${bare[3]}`;', ''),
  },
  {
    name: 'createdAt preferred over assignedDate',
    svc: (s) => s.replace('resource?.assignedDate || resource?.createdAt', 'resource?.createdAt || resource?.assignedDate'),
  },
  {
    name: 'a dateless row bucketed anyway',
    svc: (s) => s.replace('if (!key) return;', "const k2 = key || 'unknown'; if (!k2) return;").replace('if (!map[key]) map[key] = [];\n    map[key].push(r);', 'if (!map[key || "unknown"]) map[key || "unknown"] = [];\n    map[key || "unknown"].push(r);'),
  },
  {
    name: "the website's non-existent isCompleted copied across",
    src: (k, s) => (k === 'personalScreen' ? s.replaceAll('r.completed', 'r.isCompleted') : s),
  },
  {
    name: 'chapters fetched with the school subject id instead of the academic one',
    src: (k, s) =>
      k === 'teacherScreen' ? s.replace('fetchChapters(subject.academicIqSubjectId)', 'fetchChapters(subject.id)') : s,
  },
  {
    name: 'THE SILENT 400: subjectId dropped from the topic reader',
    src: (k, s) => (k === 'resources' ? s.replace('params: { subjectId },', '') : s),
  },
  {
    name: 'homeworkId moved from the query string into a multipart field',
    src: (k, s) =>
      k === 'resources'
        ? s.replace('`${BASE}/homework/submit${buildIdQuery(homeworkId)}`', '`${BASE}/homework/submit`')
        : s,
  },
  {
    name: 'a 403 swallowed into an empty list',
    src: (k, s) => (k === 'personalScreen' ? s.replaceAll('isForbidden', 'isOffline') : s),
  },
  {
    name: 'the Academic IQ empty state blaming the teacher again',
    src: (k, s) =>
      k === 'iqScreen'
        ? s.replace(
            "'These are the subjects, chapters and topics you picked in your Academic IQ profile. Choose some there and they will appear here.'",
            "'Your teacher has not assigned any resources to you yet.'",
          )
        : s,
  },
  {
    name: 'the lastSavedAt hint dropped again',
    src: (k, s) => (k === 'iqScreen' ? s.replaceAll('lastSavedAt', 'unusedField') : s),
  },
  {
    name: 'a workspace link pointed at the `z` route',
    menu: (s) => s.replace("native: '/student/personalised-resources',", "native: '/student/personalized-resources',"),
  },
  {
    name: 'one of the three floating buttons lost in the port',
    menu: (s) => s.replace(/\{\s*key: 'homework',[\s\S]*?\},\n/, ''),
  },
];

console.log('Self-tests (each mutation must be caught):');
for (const m of MUTATIONS) {
  let caught;
  try {
    const [svc, menu] = await Promise.all([loadPersonalised(m.svc), loadMenu(m.menu)]);
    caught = assertions(svc, menu, loadSources(m.src)).length > 0;
  } catch {
    caught = true; // a mutation that will not even load is caught, loudly
  }
  if (caught) ok(m.name);
  else fail(`NOT CAUGHT: ${m.name} — the corresponding assertion is vacuous`);
}

console.log('\nTeacher resources, homework and personalised resources:');
{
  const [svc, menu] = await Promise.all([loadPersonalised(), loadMenu()]);
  const problems = assertions(svc, menu, loadSources());
  if (problems.length === 0) {
    ok('the `s` and `z` endpoints are wired to their own features and never cross');
    ok('calendar keys are LOCAL — an evening assignment stays on its own day');
    ok('the DTO flag is `completed`, and the server response is merged rather than assumed');
    ok('chapters use academicIqSubjectId, items use subject.id, and subjectId is always sent');
    ok('homeworkId rides the query string, where the @RequestParam binding expects it');
    ok('a 403 is rendered as a reason, not as an empty list');
    ok("the Academic IQ empty state names the real cause, and all 3 floating buttons are back");
  } else problems.forEach(fail);
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL — ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
