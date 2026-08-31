// Staff search-index checker.
//
//   node scripts/checkstaffsearch.mjs
//
// WHY THIS EXISTS, AND WHY IT IS NOT PART OF checksearch.mjs.
//
// Search fails in a way no build can see: an index that returns nothing looks exactly like a query
// with no matches. `expo export` is green through a service that fetches the wrong endpoint, drops
// every content row, or caches one role's rows under another's key — and so is checkscope, which
// sees unbound NAMES, never wrong VALUES.
//
// checksearch.mjs covers the STUDENT service only, and its harness is hardwired to that file's
// import block: a named `{ studentApi }`, a `STUDENT_SEARCH_INDEX_KEY` import, and no constants
// import at all because its destinations are inline. The staff service differs on all three — a
// DEFAULT `staffApi` import, its own key, and a two-levels-up `constants/` import whose whole point
// is that destinations are derived from the real menu rather than retyped. Absorbing it would mean
// rewriting that harness around two shapes; a sibling costs less and keeps each honest.
//
// Exit code 0 = pass. Anything else = read the output.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');

let failures = 0;
const fail = (m) => {
  failures += 1;
  console.error(`  ✗ ${m}`);
};
const ok = (m) => console.log(`  ✓ ${m}`);

// Normalised: this repo has mixed line endings, and an assertion that depends on which one a file
// happens to carry is a false failure waiting to happen.
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

const SRC = {
  service: 'services/staff/searchService.js',
  screen: 'components/shared/search/SearchResultsScreen.js',
  route: 'app/staff/[role]/search.js',
  entry: 'components/shared/home/SearchEntry.js',
  home: 'components/staff/home/StaffHomeScreen.js',
  keys: 'constants/storageKeys.js',
};

/** Comment-stripped, so a rule can never be satisfied by prose describing it. */
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * Stage the real service with its transport, storage and key stubbed — and its CONSTANTS REAL.
 *
 * `constants/staffRoles.js`, `staffHome.js` and `theme.js` are copied in rather than faked, for the
 * same reason checksearch stages the real matcher: the assertion that matters most here is that
 * destinations come from the menu and are never retyped, and a fixture menu would make that
 * assertion a test of the fixture. `searchMatch.js` is staged for the same reason, and the mutation
 * is applied to it too — mutating only the service left five of checksearch's ranking mutations
 * hitting a file that no longer contained their target, and all five "passed" while testing nothing.
 */
async function loadService(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'staffsearch-'));

  const stage = (rel, name) => {
    let s = read(path.join(APP, rel));
    if (mutate) s = mutate(s);
    // Sibling constants import each other; point those at the .mjs copies.
    s = s.replace(/from '\.\/([A-Za-z0-9_]+)'/g, "from './$1.mjs'");
    fs.writeFileSync(path.join(dir, `${name}.mjs`), s);
  };

  stage('services/shared/searchMatch.js', 'searchMatch');
  for (const n of ['staffRoles', 'staffHome', 'theme']) stage(`constants/${n}.js`, n);

  let src = read(path.join(APP, SRC.service));
  if (mutate) src = mutate(src);

  src = src
    .replace(/from '\.\.\/shared\/searchMatch'/g, "from './searchMatch.mjs'")
    .replace(/from '\.\.\/\.\.\/constants\/([A-Za-z0-9_]+)'/g, "from './$1.mjs'")
    .replace(
      /^import \{ STAFF_SEARCH_INDEX_KEY \}.*$/m,
      "const STAFF_SEARCH_INDEX_KEY = 'staffSearchIndexV1';",
    )
    .replace(
      /^import AsyncStorage.*$/m,
      `const __store = { schoolUserToken: 'tok-abc' };
       const AsyncStorage = {
         multiGet: async (keys) => keys.map((k) => [k, __store[k] ?? null]),
         getItem: async (k) => __store[k] ?? null,
         setItem: async (k, v) => { __store[k] = v; },
         removeItem: async (k) => { delete __store[k]; },
       };
       export const __store_forTests = __store;`,
    )
    // A DEFAULT import here, unlike the student service's named one. Tolerant of both forms because
    // this codebase uses each in different services and a lazy port would match neither.
    .replace(
      /^import (?:staffApi|\{ staffApi \}) from '\.\.\/staffApi';$/m,
      `const staffApi = {
         get: async () => [],
         // The REAL envelope: { data, error, forbidden } per key. Returning the raw value here
         // instead makes every source look refused — a stub bug that reads exactly like a service
         // bug, and it was one on this file's first run.
         settleAll: async (tasks) => {
           const out = {};
           for (const k of Object.keys(tasks)) {
             try {
               out[k] = { data: await tasks[k], error: null, forbidden: false };
             } catch (e) {
               out[k] = { data: null, error: e?.message || 'failed', forbidden: !!e?.isForbidden };
             }
           }
           return out;
         },
       };`,
    )
    // The one real fetch. "My Calendar" is BOTH a school name here and a menu tile, deliberately:
    // that collision is the only case where the screens-outrank-content rule is observable, and
    // without it the assertion would pass whether or not the rule existed.
    .replace(
      /^import \{ fetchLiveSchools \}.*$/m,
      // Refusable on demand. `partial` only means anything when something actually refuses, and an
      // assertion that only ever sees the happy path cannot tell a reported refusal from a silent
      // one — which is exactly how the "refused source silently omitted" mutation went vacuous.
      // KEYED ON THE ENDPOINT, which is the only way the Portal B assertion means anything. Both
      // roles call this same function and the shapes are identical, so a stub that ignored its
      // second argument would happily let the Shreyartha counsellor read the teacher's whole-school
      // tree — schools it does not cover — and report a perfectly healthy index.
      `const fetchLiveSchools = async (signal, endpoint = '/api/shreya01/schools') => {
         if (__store.__refuse) { const e = new Error('Forbidden'); e.isForbidden = true; throw e; }
         if (endpoint === '/api/shreya01/counsellor/schools-classes') {
           return [{ schoolId: 9, schoolName: 'Portal B Academy',
                     classes: [{ classId: 4, className: 'Class 7' }] }];
         }
         return [{
           schoolId: 1, schoolName: 'Springfield High',
           classes: [{ classId: 2, className: 'Class 9' }, { classId: 3, className: 'My Calendar' }],
         }];
       };`,
    )
    // The counsellor's tree. Deliberately shaped to exercise BOTH traps the service claims to
    // survive: 'Class 9' appears under two academic years (so its sections repeat and only the
    // dedupe stops '9 A' being emitted twice), and one year is the literal 'UNASSIGNED' the backend
    // emits for a class with no academic year — which must still contribute its sections.
    .replace(
      /^import \{ fetchReportTree \}.*$/m,
      `const fetchReportTree = async () => {
         if (__store.__refuse) { const e = new Error('Forbidden'); e.isForbidden = true; throw e; }
         return [{
           schoolId: 1, schoolName: 'Springfield High',
           classes: [{
             className: 'Class 9',
             years: [
               { yearLabel: '2025-26', sections: [{ sectionId: 1, sectionName: 'A' }] },
               { yearLabel: 'UNASSIGNED', sections: [{ sectionId: 1, sectionName: 'A' },
                                                     { sectionId: 2, sectionName: 'B' }] },
             ],
           }],
         }];
       };`,
    );

  const file = path.join(dir, 'searchService.mjs');
  fs.writeFileSync(file, src);
  return import(`${pathToFileURL(file).href}?t=${Math.random()}`);
}

/**
 * The raw sources the grep-style assertions read.
 *
 * THE MUTATION IS APPLIED TO THE SERVICE SOURCE HERE TOO, and that is not a detail. Without it the
 * text assertions read the pristine file from disk while the staged module is the mutated one, so
 * every source-level mutation "passes" while testing nothing. That exact failure has now happened
 * in four checkers in this repo; it is why this file re-reads rather than caches.
 */
function sources(mutate) {
  const out = {};
  for (const [k, rel] of Object.entries(SRC)) {
    const raw = read(path.join(APP, rel));
    out[k] = mutate && k === 'service' ? mutate(raw) : raw;
  }
  return out;
}

async function assertions(svc, src) {
  const out = [];
  const bad = (m) => out.push(m);

  const { rows, partial } = await svc.loadStaffSearchIndex('vice_principal', true);

  // ── 1. Both halves are in the index ────────────────────────────────────────
  if (!rows.length) bad('the index is empty');
  if (!rows.some((r) => r.kind === 'screen')) {
    bad('no destinations indexed — searching a section name would find nothing');
  }
  if (!rows.some((r) => r.kind === 'content')) {
    bad('no content rows — the index is destinations-only, so a class name finds nothing');
  }
  if (!rows.some((r) => r.name === 'Class 9' && r.trail === 'Springfield High')) {
    bad('a class row is missing its school breadcrumb');
  }
  if (partial.length) bad(`nothing refused, yet partial reports: ${partial.join(', ')}`);

  // A REFUSAL IS REPORTED, AND COSTS ONLY ITS OWN ROWS. Asserted against a forced refusal rather
  // than the happy path: `partial` is empty when nothing refuses, so an assertion that only ever
  // sees success cannot tell a reported refusal from a silently swallowed one.
  svc.__store_forTests.__refuse = '1';
  const refused = await svc.loadStaffSearchIndex('vice_principal', true);
  delete svc.__store_forTests.__refuse;
  if (!refused.partial.length) bad('a refused tree is not reported — the user is told nothing');
  if (!refused.rows.some((r) => r.kind === 'screen')) {
    bad('one refusal cost the destinations too — the fan-out is all-or-nothing');
  }

  // ── 1b. The counsellor's tree, which is a different SHAPE, not a second copy ──
  //
  // The VP's source is flat (school → class); the counsellor's nests two levels deeper
  // (school → class → year → section) and repeats every class once per academic year. Asserting
  // only the VP would leave the whole counsellor branch — the deeper loop and its dedupe — covered
  // by nothing at all, since one role's index says nothing about another's.
  const cslr = await svc.loadStaffSearchIndex('counselor', true);
  if (!cslr.rows.some((r) => r.kind === 'content')) {
    bad('the counsellor index is destinations-only — its report tree contributed nothing');
  }
  if (!cslr.rows.some((r) => r.name === 'Class 9 A' && r.trail === 'Springfield High')) {
    bad('a counsellor section row is missing — sections must be indexed, not just classes');
  }
  // The UNASSIGNED year is the one a class with no academic year lands in. Its sections are real
  // sections and dropping them would hide every class a school has not rolled over yet.
  if (!cslr.rows.some((r) => r.name === 'Class 9 B')) {
    bad('sections under the UNASSIGNED year were skipped — an unrolled class is unfindable');
  }
  // 'Class 9 A' appears under BOTH years in the fixture. One row, or the counsellor sees the same
  // section listed once per academic year the school has ever had.
  const dupes = cslr.rows.filter((r) => r.kind === 'content' && r.name === 'Class 9 A').length;
  if (dupes !== 1) bad(`'Class 9 A' indexed ${dupes} times — the year loop is not deduped`);
  // Every content row needs a route. A row without one ranks, renders, and does nothing on tap —
  // no error, no clue. This was a real bug in the VP branch before this checker caught it.
  for (const r of cslr.rows) {
    if (!r.route) { bad(`counsellor row "${r.name}" has no route — tapping it does nothing`); break; }
  }

  // ── 1c. Portal B reads ITS OWN scope tree ─────────────────────────────────
  //
  // The Shreyartha counsellor shares a row builder AND a fetcher with the VP; only the endpoint
  // differs. That makes "which endpoint" the single thing worth asserting, because getting it wrong
  // fails silently and plausibly: the default source returns a full, correct-looking school tree —
  // it is simply the teacher's, listing schools this counsellor does not cover.
  const portalB = await svc.loadStaffSearchIndex('shreyartha_councellor', true);
  if (!portalB.rows.some((r) => r.name === 'Portal B Academy')) {
    bad('the Shreyartha counsellor is not reading /api/shreya01/counsellor/schools-classes');
  }
  if (portalB.rows.some((r) => r.name === 'Springfield High')) {
    bad('the Shreyartha counsellor is reading the DEFAULT school tree — schools it does not cover');
  }
  if (!portalB.rows.some((r) => r.name === 'Class 7' && r.route)) {
    bad('a Portal B class row is missing or has no route');
  }

  // ── 2. Destinations are DERIVED from the menu, never retyped ───────────────
  //
  // The whole point of reading resolveStaffMenus rather than listing labels: a renamed tile renames
  // its search result, and a removed tile stops being findable. Asserted against a label the
  // service source does not contain, so a retyped list could not satisfy it.
  const { resolveStaffMenus } = await import(
    pathToFileURL(path.join(APP, 'constants/staffRoles.js')).href
  ).catch(() => ({}));
  if (resolveStaffMenus) {
    const menu = resolveStaffMenus('vice_principal').menu;
    for (const item of menu) {
      if (!rows.some((r) => r.kind === 'screen' && r.name === item.label)) {
        bad(`menu tile "${item.label}" is not in the search index`);
      }
    }
  }
  if (/'My Leave'|"My Leave"/.test(codeOnly(src.service))) {
    bad('the service hardcodes a menu label — destinations must come from resolveStaffMenus');
  }

  // ── 3. Destinations are appended LAST ──────────────────────────────────────
  //
  // Not cosmetic. The matcher breaks ties by giving a screen row -0.5; if destinations came first
  // they would already win by position, and removing that rule would change nothing observable.
  const firstScreen = rows.findIndex((r) => r.kind === 'screen');
  const lastContent = rows.map((r) => r.kind).lastIndexOf('content');
  if (firstScreen !== -1 && lastContent !== -1 && firstScreen < lastContent) {
    bad('destinations are not appended last — the screens-beat-content tie-break becomes unobservable');
  }

  // ── 4. Ranking, through the REAL matcher ───────────────────────────────────
  const hits = svc.searchIndex(rows, 'my calendar');
  if (!hits.length) bad('"my calendar" matched nothing');
  else if (hits[0].kind !== 'screen') bad('a content row outranked the screen of the same name');
  if (svc.searchIndex(rows, '').length !== 0) bad('an empty query returned rows');
  if (svc.searchIndex(rows, 'zzzznotathing').length !== 0) bad('a nonsense query returned rows');
  if (svc.searchIndex(rows, 'class 9 zzzz').length !== 0) {
    bad('every word must appear — "class 9 zzzz" should match nothing');
  }
  if (svc.searchIndex(rows, 'CLASS 9').length === 0) bad('matching is case-sensitive');
  // THE ORDER-INDEPENDENCE CASE, and the only one that can see the difference. Every other query
  // here behaves identically under a word-wise test and an ordered substring test, which is why the
  // substring mutation was vacuous until this line existed: "9 class" matches "Class 9" only if
  // each word is looked for separately.
  if (svc.searchIndex(rows, '9 class').length === 0) {
    bad('matching is an ordered substring test — words must match in any order');
  }
  if (svc.searchIndex(rows, 'class 9').some((r) => !r.route)) bad('a hit has no route');

  // ── 5. The cache is keyed to the session AND the role ──────────────────────
  const code = codeOnly(src.service);
  if (!/fingerprint/.test(code)) bad('the index is not fingerprinted — it would outlive its session');
  if (!/expiresAt/.test(code)) bad('the cached index never expires');
  if (!/schoolUserToken/.test(code)) bad('the fingerprint is not derived from the session token');
  if (!/\|\$\{role\}|role\}`/.test(code)) {
    bad('the role is not folded into the fingerprint — one panel could serve another its rows');
  }
  if (!/STAFF_SEARCH_INDEX_KEY/.test(codeOnly(src.keys))) {
    bad('storageKeys.js does not declare STAFF_SEARCH_INDEX_KEY');
  }
  // A computed key is never cleared on logout: ALL_AUTH_KEYS is a static array handed to
  // multiRemove, so a template literal here is a data leak on a shared staffroom device.
  if (/STAFF_SEARCH_INDEX_KEY\s*=\s*`/.test(src.keys)) {
    bad('STAFF_SEARCH_INDEX_KEY is a template literal — a computed key survives logout');
  }
  const keysCode = codeOnly(src.keys);
  const allAuth = keysCode.slice(keysCode.indexOf('ALL_AUTH_KEYS'));
  if (!/STAFF_SEARCH_INDEX_KEY/.test(allAuth)) {
    bad('STAFF_SEARCH_INDEX_KEY is not in ALL_AUTH_KEYS — the index survives logout');
  }

  // ── 6. A refusal costs its own rows, never the feature ─────────────────────
  if (/Promise\.all\(/.test(code)) bad('the fan-out is Promise.all — one refusal loses every row');
  if (!/settleAll/.test(code)) bad('the fan-out does not use settleAll');

  // ── 7. The wiring ──────────────────────────────────────────────────────────
  if (!/onSubmitEditing/.test(codeOnly(src.entry))) bad('SearchEntry does not submit on the keyboard');
  if (!/q\b/.test(codeOnly(src.screen))) bad('the results screen does not read the ?q= seed');
  if (!/index\.partial\.length/.test(codeOnly(src.screen))) {
    bad('the results screen never tells the user what could not be included');
  }
  if (!/staff\/\$\{roleKey\}\/search|\/search/.test(codeOnly(src.home))) {
    bad('the dashboard has no search entry pointing at the search route');
  }
  if (!/getStaffHome\(roleKey\)\?\.search/.test(codeOnly(src.route))) {
    bad('the search route is not gated on the descriptor — a role without search would get an index');
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────

const MUTATIONS = [
  {
    // Portal B pointed at the default tree. The index still fills, still ranks, and still routes —
    // it just lists the wrong schools. Nothing about the shape of the result gives that away.
    name: 'Portal B reading the default school tree',
    mutate: (s) => s.replace(
      "      load: (signal) => fetchLiveSchools(signal, '/api/shreya01/counsellor/schools-classes'),",
      '      load: (signal) => fetchLiveSchools(signal),'),
  },
  {
    // The whole counsellor branch removed. Its rows are its own — a green VP index proves nothing
    // about it, which is why this mutation exists separately from 'content rows dropped'.
    name: 'the counsellor tree contributing nothing',
    mutate: (s) => s.replace("      load: (signal) => fetchReportTree('/api/counselor/counsellor-report', signal),",
                             '      load: async () => [],'),
  },
  {
    // Classes indexed but not their sections. Reads as a working index and answers "Class 9"
    // correctly — it fails only on the query a counsellor actually types, which is the section.
    name: 'counsellor sections skipped (classes only)',
    mutate: (s) => s.replace("                if (sectionName) push('Sections', `${className} ${sectionName}`.trim(), schoolName);", ''),
  },
  {
    // The dedupe removed. Every section reappears once per academic year the school has ever had,
    // and nothing errors — the list just quietly grows with the school's age.
    name: 'the year-loop dedupe removed',
    mutate: (s) => s.replace('          if (!name || seen.has(key)) return;\n          seen.add(key);',
                             '          if (!name) return;'),
  },
  {
    name: 'content rows dropped (a destinations-only index)',
    mutate: (s) => s.replace('rows.push(...source.rows(result.data, role));', ''),
  },
  {
    name: 'destinations dropped',
    mutate: (s) => s.replace('rows.push(...destinations(role, config, home));', ''),
  },
  {
    name: 'destinations no longer appended last',
    mutate: (s) =>
      s.replace(
        'const rows = [];\n  const partial = [];',
        'const rows = [...destinations(role, config, home)];\n  const partial = [];',
      ),
  },
  {
    name: 'a menu label retyped instead of derived',
    mutate: (s) =>
      s.replace(
        ".map((item) => ({ module: 'Sections', name: item.label, route: item.native })),\n    ...config.headerActions",
        ".map((item) => ({ module: 'Sections', name: 'My Leave', route: item.native })),\n    ...config.headerActions",
      ),
  },
  {
    name: 'the fan-out made all-or-nothing',
    mutate: (s) => s.replace('await staffApi.settleAll(tasks)', 'await Promise.all([]).then(() => ({}))'),
  },
  {
    name: 'a refused source silently omitted',
    mutate: (s) => s.replace('partial.push(source.label);', ''),
  },
  {
    name: 'the cache no longer keyed to the session',
    mutate: (s) => s.replaceAll('fingerprint', 'constantKey'),
  },
  {
    name: 'the role dropped from the fingerprint (one panel serves another its rows)',
    mutate: (s) => s.replace('fingerprintOf(`${token}|${role}`)', 'fingerprintOf(token)'),
  },
  {
    name: 'the matcher reverted to an ordered substring test',
    mutate: (s) => s.replace(/words\.every\([\s\S]*?\)\)/, 'hay.includes(q)'),
  },
  {
    name: 'the matcher made case-sensitive',
    mutate: (s) => s.replace("const q = String(query || '').trim().toLowerCase();", "const q = String(query || '').trim();"),
  },
  {
    name: 'an empty query returning the whole index',
    mutate: (s) => s.replace('if (!q) return [];', ''),
  },
  {
    name: 'screens no longer outranking content',
    mutate: (s) => s.replace(/if \(row\.kind === 'screen'\) score -= 0\.5;/, ''),
  },
];

console.log('Self-tests (each mutation must be caught):');
for (const m of MUTATIONS) {
  let caught;
  try {
    const svc = await loadService(m.mutate);
    caught = (await assertions(svc, sources(m.mutate))).length > 0;
  } catch {
    caught = true; // a mutation that will not even load is caught, loudly
  }
  if (caught) ok(m.name);
  else fail(`NOT CAUGHT: ${m.name} — the corresponding assertion is vacuous`);
}

console.log('\nStaff search:');
const svc = await loadService();
const problems = await assertions(svc, sources());
if (problems.length === 0) {
  ok('destinations derived from the real menu, appended last, with content rows beneath');
  ok('the cache is fingerprinted to the session AND the role, and cleared with it');
  ok('a refused tree costs its own rows and is reported, never the feature');
  ok('matching is word-wise and case-insensitive; screens outrank content of the same name');
} else problems.forEach(fail);

console.log(failures ? `\nFAIL — ${failures} problem(s)` : '\nPASS');
process.exit(failures ? 1 : 0);
