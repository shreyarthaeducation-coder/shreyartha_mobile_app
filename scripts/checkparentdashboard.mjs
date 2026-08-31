// The redesigned parent dashboard.
//
//   node scripts/checkparentdashboard.mjs
//
// WHY THIS EXISTS. The parent design asks for six things the backend cannot provide, and the
// tempting failure in every case is to render something plausible instead of nothing. None of the
// following is visible to `expo export`, and each one would look finished:
//
//   * An "Overall Performance: A" letter grade. **`letterGrade` has ZERO hits across the backend.**
//     The nearest field, `readinessIndex`, is a hardcoded placeholder identical for every student —
//     its own DTO javadoc says so — so wiring it up would show every parent in the country the same
//     grade for their child.
//   * An attendance percentage. Real, but ONE MONTH at a time and only when a register has actually
//     been taken. `0 %` because nobody has marked anything is a different claim from `0 %` attended.
//   * An assignments percentage. A parent **cannot see submission state at all** —
//     `HomeworkSubmission` is exposed only through the student controller — so any "% done" is
//     invented. The count is true; the percentage is not.
//   * Notifications and Download Reports. No parent endpoint exists for either; the student
//     notifications route is student-role only and a parent JWT gets a 403. They must render inert,
//     because a greyed tile that still navigates promises twice.
//   * The parent's own email. `ParentUserResponse` is returned by the LOGIN and nowhere else —
//     there is no `GET /api/parent/me` — so if login does not store it, the row can never fill. And
//     because it is personal, it must die with the session or the next parent on a shared device
//     reads it.
//
// Exit code 0 = pass.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');

const SRC = {
  home: 'components/parent/ParentMenuScreen.js',
  identity: 'components/shared/home/IdentityCard.js',
  quick: 'components/parent/home/QuickActions.js',
  report: 'components/parent/home/ChildReportCard.js',
  reportService: 'services/parent/reportCardService.js',
  comingSoon: 'components/shared/ComingSoon.js',
  searchService: 'services/parent/searchService.js',
  searchScreen: 'components/parent/ParentSearchScreen.js',
  login: 'app/auth/parent-login.js',
  layout: 'app/parent/_layout.js',
  fees: 'components/parent/FeesScreen.js',
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
 * LOAD-BEARING, and it has already bitten once here. The leading-boundary form is used because the
 * naive regex eats `'image/*'` — and separately, a slash-star sequence inside a LINE comment opens
 * a block comment as far as this function is concerned. A note in ParentMenuScreen reading
 * "under /api/parent/**" silently swallowed every line of JSX after it, and checkparent reported a
 * component that was plainly on screen as missing. Keep wildcards out of line comments there.
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

/** Stage the report service with its transport stubbed, so `reportStats` can be RUN. */
async function loadReportService(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdash-'));
  let src = read(path.join(APP, SRC.reportService));
  if (mutate) src = mutate(src);

  // The real `summariseAttendance` is staged alongside — the attendance figure is computed from it,
  // and stubbing it would make the percentage assertion a test of the stub.
  fs.writeFileSync(
    path.join(dir, 'calendarService.mjs'),
    read(path.join(APP, 'services/parent/calendarService.js')).replace(
      /^import .*$/gm,
      '',
    ),
  );
  src = src
    .replace(/^import \{ parentApi \}.*$/m, 'const parentApi = { get: async () => ({}), settleAll: async () => ({}) };')
    .replace("from './calendarService'", "from './calendarService.mjs'");

  const file = path.join(dir, 'reportCardService.mjs');
  fs.writeFileSync(file, src);
  return import(`${pathToFileURL(file).href}?t=${Math.random()}`);
}

/** A `settleAll` entry. */
const okPart = (data) => ({ data, error: null, forbidden: false });
const failedPart = () => ({ data: null, error: 'Could not load.', forbidden: false });

function assertions(svc, src) {
  const out = [];
  const bad = (m) => out.push(m);

  /* ── 1. NO FABRICATED FIGURES ────────────────────────────────────────────── */

  const service = codeOnly(src.reportService);
  if (/readinessIndex/.test(service)) {
    bad('the report card reads readinessIndex — it is hardcoded identical for every student on the platform');
  }
  if (/letterGrade|['"][ABCD][+-]?['"]\s*[,;)]/.test(service)) {
    bad('a letter grade appeared — nothing in the backend computes one');
  }

  // Behaviour, not shape. A full month of real statuses must produce the real percentage…
  const full = svc.reportStats(
    {
      attendance: okPart({ '2026-08-03': 'PRESENT', '2026-08-04': 'PRESENT', '2026-08-05': 'ABSENT', '2026-08-06': null }),
      activities: okPart({ homework: [{ id: 1 }, { id: 2 }, { id: 3 }] }),
      psychometric: okPart({ completedCount: 8, totalTopics: 10 }),
    },
    {},
  );
  const byKey = Object.fromEntries(full.map((s) => [s.key, s]));

  if (byKey.overall?.soon !== true) {
    bad('Overall Performance is not marked coming soon — no letter grading exists anywhere');
  }
  if (byKey.attendance?.value !== '67%') {
    bad(`attendance = ${byKey.attendance?.value}, expected 67% (2 present of 3 MARKED, ignoring the unmarked day)`);
  }
  if (!/month/i.test(byKey.attendance?.note || '')) {
    bad('the attendance figure is not labelled as one month — it would read as an all-time rate');
  }
  if (byKey.homework?.value !== '3') {
    bad(`homework = ${byKey.homework?.value}, expected the COUNT "3" — a parent cannot see submission state`);
  }
  if (/%/.test(byKey.homework?.value || '')) {
    bad('homework is being reported as a percentage — that number cannot be computed for a parent');
  }
  if (byKey.psychometric?.value !== '8/10') {
    bad(`psychometric = ${byKey.psychometric?.value}, expected "8/10" — a completion count, not a score`);
  }

  // …and a FAILED call must be omitted, never zeroed.
  const failed = svc.reportStats(
    { attendance: failedPart(), activities: failedPart(), psychometric: failedPart() },
    {},
  );
  if (!failed.every((s) => s.soon === true)) {
    bad('a figure whose call FAILED is rendered as a number — "we could not read this" is not "this is zero"');
  }

  // A month with no register taken is not 0 % attendance.
  const unmarked = svc.reportStats({ attendance: okPart({ '2026-08-03': null }) }, {});
  const att = unmarked.find((s) => s.key === 'attendance');
  if (att?.soon !== true) {
    bad(`an unmarked month reported attendance as ${att?.value} — nobody has taken a register yet`);
  }

  /* ── 2. THE COMING-SOON SURFACES ARE INERT ───────────────────────────────── */

  const quick = codeOnly(src.quick);
  if (!/action\.soon/.test(quick)) bad('the quick actions have no coming-soon branch');
  // The soon branch must render a View, never a Pressable.
  //
  // Anchored on the `if` block's own closing brace at eight spaces. An earlier version stopped at
  // the first `\n{8 spaces});`, which the branch's own `return (…)` does not match — it closes at
  // ten — so the match ran on into the Pressable return below it and reported a false positive.
  const soonBlock = quick.match(/if \(action\.soon\) \{[\s\S]*?\n {8}\}/);
  if (!soonBlock) bad('could not locate the coming-soon branch — check this assertion');
  else if (/Pressable/.test(soonBlock[0])) {
    bad('a coming-soon tile is a Pressable — a greyed tile that still navigates promises twice');
  }

  const home = codeOnly(src.home);
  for (const key of ['notifications', 'reports']) {
    const entry = home.match(new RegExp(`key: '${key}',[\\s\\S]*?\\n    \\}`));
    if (!entry) bad(`the ${key} quick action is gone`);
    else if (!/soon: true/.test(entry[0])) {
      bad(`the ${key} tile is not marked coming soon — no parent endpoint exists for it`);
    }
    else if (/route:/.test(entry[0])) {
      bad(`the ${key} tile carries a route despite having no backing endpoint`);
    }
  }
  // The term chip must not be a control — nothing filters by term.
  const report = codeOnly(src.report);
  const term = report.match(/<View style={styles\.term}>[\s\S]*?<\/View>/);
  if (!term) bad('the academic-year chip is gone from the report card');
  else if (/Pressable/.test(term[0])) {
    bad('the term chip is tappable — no parent endpoint accepts a term, so it can filter nothing');
  }

  /* ── 3. THE IDENTITY CARD ────────────────────────────────────────────────── */

  // Six rows, and the parent's own two come from storage because no endpoint returns them.
  for (const key of ['parentName', 'email', 'studentName', 'grade', 'stream', 'school']) {
    if (!new RegExp(`key: '${key}'`).test(home)) {
      bad(`the parent identity card no longer shows ${key} — the design calls for all six rows`);
    }
  }
  if (!/parentUserEmail/.test(codeOnly(src.login))) {
    bad('the login does not store parentUserEmail — the Email ID row could never be filled');
  }
  // A parent has no photo field anywhere, so the card must not be handed one.
  const cardUse = home.match(/<IdentityCard[\s\S]*?\/>/);
  if (cardUse && /photoUrl=/.test(cardUse[0])) {
    bad('the parent identity card is passed a photoUrl — ParentUser has no photo column and no upload endpoint');
  }

  /* ── 4. NOTHING LOST FROM THE PORTAL ─────────────────────────────────────── */

  if (!/PARENT_MENU\.map/.test(home)) {
    bad('the eight-tile grid is gone — five sections would have no entry point at all');
  }
  if (!/confirmLogout/.test(home)) bad('Log Out is gone from the parent dashboard');
  if (/onPress=\{\s*logout\s*\}/.test(home)) {
    bad('the dashboard calls the bare storage-wipe — it does not navigate, so the parent stays on a signed-out screen');
  }
  // The fan-out must stay settled: an unlinked child 404s on all three report calls.
  if (/Promise\.all\(/.test(home)) {
    bad('the parent dashboard uses Promise.all — an unlinked child would blank the whole screen');
  }
  if (!/settleAll/.test(service)) {
    bad('the report figures are not fanned out through settleAll');
  }
  if (/Promise\.all\(/.test(service)) {
    bad('the report service uses Promise.all — an unlinked child 404s on all three calls at once');
  }

  /* ── 5. ROUTES RESOLVE ───────────────────────────────────────────────────── */

  const layout = src.layout;
  for (const name of ['search']) {
    if (!new RegExp(`name="${name}"`).test(layout)) bad(`/parent/${name} is not registered as a Stack.Screen`);
    if (!fs.existsSync(path.join(APP, 'app', 'parent', `${name}.js`))) {
      bad(`app/parent/${name}.js does not exist, but the layout registers it`);
    }
  }
  // Every route the dashboard pushes must exist as a file.
  for (const m of home.matchAll(/route: '\/parent\/([a-z-]+)/g)) {
    if (!fs.existsSync(path.join(APP, 'app', 'parent', `${m[1]}.js`))) {
      bad(`the dashboard links to /parent/${m[1]}, which has no route file`);
    }
  }
  // The Payment History tile promises the history; the fee screen has to honour the parameter.
  if (!/tab === 'history'/.test(codeOnly(src.fees))) {
    bad('FeesScreen ignores ?tab=history — the Payment History tile would land at the top of the page');
  }

  /* ── 6. SEARCH IS PER PARENT ─────────────────────────────────────────────── */

  const search = codeOnly(src.searchService);
  if (!/fingerprint/.test(search)) {
    bad("the parent search cache is not keyed to the session — one parent would read another family's syllabus");
  }
  if (!/PARENT_SEARCH_INDEX_KEY/.test(search)) bad('the parent search cache key is not declared in storageKeys');
  if (/Promise\.all\(/.test(search)) {
    bad('the parent search index uses Promise.all — an unlinked child 404s and would cost the whole feature');
  }
  if (!/PARENT_MENU/.test(search)) {
    bad('the search destinations are retyped rather than built from PARENT_MENU — they would drift from the web labels');
  }

  return out;
}

const MUTATIONS = [
  {
    // Mutates the SOURCE the text assertion reads, not only the module that gets evaluated.
    // Targeting `svc` alone left this vacuous: the staged copy changed while the grep kept reading
    // the pristine file.
    name: 'THE BUG: the hardcoded readiness index wired into a stat tile',
    src: (k, s) =>
      k === 'reportService' ? s.replace('const stats = [];', 'const stats = []; const readinessIndex = 1;') : s,
  },
  {
    name: 'a letter grade invented for Overall Performance',
    svc: (s) =>
      s.replace(
        "stats.push({ key: 'overall', label: strings.statOverall || 'Overall', soon: true });",
        "stats.push({ key: 'overall', label: 'Overall', value: 'A' });",
      ),
  },
  {
    name: 'attendance counting every day rather than the MARKED ones',
    svc: (s) => s.replace('summary.present / summary.marked', 'summary.present / Object.keys(attendance).length'),
  },
  {
    name: 'an unmarked month reported as 0% attendance',
    svc: (s) => s.replace('summary && summary.marked > 0', 'summary'),
  },
  {
    name: 'THE INVENTED NUMBER: homework reported as a percentage',
    svc: (s) =>
      s.replace('value: String(homework.length),', "value: `${Math.round(homework.length * 8.5)}%`,"),
  },
  {
    name: 'a failed call rendered as zero instead of being omitted',
    svc: (s) => s.replace('if (homework) {', 'if (true) { const homework = []; '),
  },
  {
    name: 'the attendance figure losing its "this month" qualifier',
    svc: (s) => s.replace("note: strings.thisMonth || 'This month',", "note: '',"),
  },
  {
    name: 'a coming-soon tile made tappable',
    src: (k, s) =>
      k === 'quick'
        ? s.replace('            <View\n              key={action.key}', '            <Pressable\n              key={action.key}')
        : s,
  },
  {
    name: 'the Notifications tile given a route it cannot serve',
    src: (k, s) =>
      k === 'home' ? s.replace("      icon: 'notifications-outline',", "      route: '/parent/nowhere',\n      icon: 'notifications-outline',") : s,
  },
  {
    name: 'the term chip made a control (it can filter nothing)',
    src: (k, s) =>
      k === 'report'
        ? s.replace('<View style={styles.term}>', '<Pressable style={styles.term}>').replace('</View>\n      </View>', '</Pressable>\n      </View>')
        : s,
  },
  {
    name: 'the parent email row dropped from the identity card',
    src: (k, s) => (k === 'home' ? s.replace("key: 'email'", "key: 'dropped'") : s),
  },
  {
    name: 'the login no longer storing the email (the row can never fill)',
    src: (k, s) => (k === 'login' ? s.replace("'parentUserEmail'", "'unusedKey'") : s),
  },
  {
    name: 'a parent photo invented on the identity card',
    src: (k, s) =>
      k === 'home' ? s.replace('          name={parent.name}', '          name={parent.name}\n          photoUrl={parent.photo}') : s,
  },
  {
    name: 'THE LOSS: the eight-tile grid deleted with the redesign',
    src: (k, s) => (k === 'home' ? s.replace('PARENT_MENU.map', 'NO_MENU.map') : s),
  },
  {
    name: 'Log Out dropped from the dashboard',
    src: (k, s) => (k === 'home' ? s.replaceAll('confirmLogout', 'noLogout') : s),
  },
  {
    name: 'the report fan-out made all-or-nothing',
    src: (k, s) =>
      k === 'reportService' ? s.replace('parentApi.settleAll({', 'Promise.all({') : s,
  },
  {
    // The dashboard has no Promise.all to swap, so the mutation has to INTRODUCE one. Swapping a
    // string the file never contained is how a guard ends up testing nothing.
    name: 'a Promise.all introduced on the dashboard itself',
    src: (k, s) =>
      k === 'home'
        ? s.replace('const load = useCallback(async () => {', 'const load = useCallback(async () => { await Promise.all([]);')
        : s,
  },
  {
    name: 'the fee screen ignoring ?tab=history',
    src: (k, s) => (k === 'fees' ? s.replace("tab === 'history'", "tab === 'never'") : s),
  },
  {
    name: 'the parent search cache shared between accounts',
    src: (k, s) => (k === 'searchService' ? s.replaceAll('fingerprint', 'constantKey') : s),
  },
  {
    name: 'the search destinations retyped instead of read from PARENT_MENU',
    src: (k, s) => (k === 'searchService' ? s.replaceAll('PARENT_MENU', 'HARDCODED') : s),
  },
];

console.log('Self-tests (each mutation must be caught):');
for (const m of MUTATIONS) {
  let caught;
  try {
    const svc = await loadReportService(m.svc);
    caught = assertions(svc, loadSources(m.src)).length > 0;
  } catch {
    caught = true; // a mutation that will not even load is caught, loudly
  }
  if (caught) ok(m.name);
  else fail(`NOT CAUGHT: ${m.name} — the corresponding assertion is vacuous`);
}

console.log('\nParent dashboard:');
{
  const svc = await loadReportService();
  const problems = assertions(svc, loadSources());
  if (problems.length === 0) {
    ok('no fabricated figures: no letter grade, no readiness index, no invented percentage');
    ok('attendance is real, one month, and omitted when no register has been taken');
    ok('a failed call is omitted rather than drawn as zero');
    ok('the coming-soon surfaces are inert — nothing greyed still navigates');
    ok('all six identity rows, with the email stored at login and cleared with the session');
    ok('the eight sections keep an entry point, and Log Out navigates');
    ok('every dashboard route has a file, and Payment History lands on the history');
    ok("search is fingerprinted per parent and built from the web's own menu labels");
  } else problems.forEach(fail);
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL — ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
