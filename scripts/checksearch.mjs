// Platform search — the client-built index and its matcher.
//
//   node scripts/checksearch.mjs
//
// WHY THIS EXISTS. There is no search endpoint anywhere in the backend, so every rule this feature
// depends on lives in one client file and none of them are visible to a build:
//
//   * The index is PER USER. Every content tree applies a per-school topic-alias overlay, so two
//     students at different schools get different names for the same id. A cache that outlives a
//     logout shows one student their predecessor's vocabulary on a shared device.
//   * `settleAll`, not `Promise.all`. `/api/coding/tree` REQUIRES a student role while the others
//     tolerate anonymous — one expected 403 must cost one module's rows, not the feature.
//   * A partial index must SAY it is partial, or a student searching for a topic they know exists
//     is told it does not.
//   * The matcher is word-wise, not substring: "class 9 trig" has to find a topic whose class is in
//     its breadcrumb, and a joined-string `includes` needs the words in the right order.
//
// Exit code 0 = pass.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');

const SRC = {
  service: 'services/student/searchService.js',
  screen: 'components/student/SearchScreen.js',
  entry: 'components/shared/home/SearchEntry.js',
  keys: 'constants/storageKeys.js',
};

let failures = 0;
const fail = (m) => {
  failures += 1;
  console.error(`  ✗ ${m}`);
};
const ok = (m) => console.log(`  ✓ ${m}`);

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const codeOnly = (t) => t.replace(/(^|\s)\/\*[\s\S]*?\*\//g, '$1').replace(/^\s*\/\/.*$/gm, '');

function loadSources(mutate) {
  const out = {};
  for (const [k, rel] of Object.entries(SRC)) {
    out[k] = mutate ? mutate(k, read(path.join(APP, rel))) : read(path.join(APP, rel));
  }
  return out;
}

/**
 * The service with BOTH its dependencies stubbed, so `loadSearchIndex` can actually be run.
 *
 * `settleAll` is stubbed to answer with a fake tree for every source except Coding Pro, which is
 * refused — that is the real 403 a free student gets, and it is the case the `partial` list exists
 * for. AsyncStorage is a plain in-memory map so the cache path is exercised rather than skipped.
 */
async function loadService(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'search-'));
  let src = read(path.join(APP, SRC.service));
  if (mutate) src = mutate(src);

  // The REAL matcher is staged beside it, not stubbed. Every ranking assertion below runs against
  // services/shared/searchMatch.js itself — a stub here would turn this whole file into a test of
  // the test. It is re-exported by searchService, so `svc.searchIndex` still resolves.
  //
  // THE MUTATION IS APPLIED TO BOTH FILES. The matcher and the walker moved out of searchService
  // when the parent panel started building its own index; mutating only the service left five
  // ranking mutations hitting a file that no longer contains the code they target, and all five
  // "passed" while testing nothing. A replace that matches neither file is a harmless no-op.
  let matchSrc = read(path.join(APP, 'services/shared/searchMatch.js'));
  if (mutate) matchSrc = mutate(matchSrc);
  fs.writeFileSync(path.join(dir, 'searchMatch.mjs'), matchSrc);

  src = src
    .replace(/from '\.\.\/shared\/searchMatch'/g, "from './searchMatch.mjs'")
    .replace(/^import { STUDENT_SEARCH_INDEX_KEY }.*$/m, "const STUDENT_SEARCH_INDEX_KEY = 'studentSearchIndexV1';")
    .replace(
      /^import AsyncStorage.*$/m,
      `const __store = {};
       const AsyncStorage = {
         multiGet: async (keys) => keys.map((k) => [k, __store[k] ?? null]),
         getItem: async (k) => __store[k] ?? null,
         setItem: async (k, v) => { __store[k] = v; },
         removeItem: async (k) => { delete __store[k]; },
       };
       export const __store_forTests = __store;`,
    )
    .replace(
      /^import \{ studentApi \}.*$/m,
      // "Homework" appears BOTH as a content topic and as an app destination, on purpose: that
      // collision is the only case where the screens-outrank-content rule can be observed, and
      // without it the assertion would pass whether or not the rule existed.
      `const __TREE = [{
         id: 1, name: 'CBSE',
         classes: [{ id: 2, name: 'Class 9', subjects: [{ id: 3, name: 'Biology',
           chapters: [{ id: 4, name: 'Life Processes', topics: [
             { id: 5, name: 'Photosynthesis' },
             { id: 6, name: 'Homework' },
           ] }] }] }],
       }];
       const studentApi = {
         get: async () => __TREE,
         settleAll: async (tasks) => {
           const out = {};
           for (const k of Object.keys(tasks)) {
             out[k] = k === 'codingPro'
               ? { data: null, error: 'Forbidden', forbidden: true }
               : { data: __TREE, error: null, forbidden: false };
           }
           return out;
         },
       };`,
    );

  const file = path.join(dir, 'searchService.mjs');
  fs.writeFileSync(file, src);
  return import(`${pathToFileURL(file).href}?t=${Math.random()}`);
}

async function assertions(svc, src) {
  const out = [];
  const bad = (m) => out.push(m);

  /* ── 1. ONE FAILURE COSTS ONE MODULE, AND IS REPORTED ────────────────────── */

  const service = codeOnly(src.service);
  if (/Promise\.all\(/.test(service)) {
    bad('the index uses Promise.all — one expected 403 on /api/coding/tree would cost the whole feature');
  }
  if (!/settleAll/.test(service)) bad('the index does not fan out through settleAll');

  const { rows, partial } = await svc.loadSearchIndex(true);
  if (!Array.isArray(rows) || rows.length === 0) bad('loadSearchIndex returned nothing at all');
  if (!partial.includes('Coding Pro')) {
    bad('a refused module is not reported in `partial` — the student is told their topic does not exist');
  }
  if (rows.some((r) => r.module === 'Coding Pro')) {
    bad('rows appeared for the module that was refused');
  }
  if (!/index\.partial\.length/.test(codeOnly(src.screen))) {
    bad('the screen never renders the partial-index notice');
  }

  /* ── 2. THE INDEX IS PER USER ────────────────────────────────────────────── */

  if (!/fingerprint/.test(service)) {
    bad('the cache is not keyed to the session — on a shared device one student would read another\'s aliased tree');
  }
  if (!/expiresAt/.test(service)) bad('the cache never expires');
  // The key must be cleared with the rest of the session, or the fingerprint check is the only
  // thing standing between two accounts.
  if (!/studentSearchIndexV1/.test(codeOnly(src.keys))) {
    bad('the search cache key is not in storageKeys — it would survive a logout');
  }

  /* ── 3. THE INDEX CARRIES CONTENT *AND* SCREENS ──────────────────────────── */

  if (!rows.some((r) => r.kind === 'screen')) {
    bad('no app destinations are indexed — searching "homework" would find nothing');
  }
  if (!rows.some((r) => r.name === 'Photosynthesis')) {
    bad('the tree walker never reached a leaf topic');
  }
  const leaf = rows.find((r) => r.name === 'Photosynthesis');
  if (leaf && !/Class 9/.test(leaf.trail)) {
    bad(`the leaf's breadcrumb is "${leaf.trail}" — ancestors are missing, so "class 9 photosynthesis" cannot match`);
  }
  if (leaf && /Photosynthesis/.test(leaf.trail)) {
    bad('the node includes ITSELF in its breadcrumb — the row would read "Photosynthesis › Photosynthesis"');
  }

  /* ── 4. THE MATCHER ──────────────────────────────────────────────────────── */

  // Word-wise, and order-independent — the breadcrumb and the name are one haystack.
  if (svc.searchIndex(rows, 'class 9 photosynthesis').length === 0) {
    bad('a query mixing the breadcrumb and the name finds nothing — the matcher is a plain substring test');
  }
  if (svc.searchIndex(rows, 'PHOTOSYNTHESIS').length === 0) bad('the matcher is case-sensitive');
  if (svc.searchIndex(rows, '').length !== 0) bad('an empty query returns results');
  if (svc.searchIndex(rows, 'zzzznotathing').length !== 0) bad('a nonsense query returns results');
  // Every word must appear; two unrelated words must not match a row carrying only one.
  if (svc.searchIndex(rows, 'photosynthesis zzzz').length !== 0) {
    bad('a row matched on SOME of the words — every word has to appear or the results are noise');
  }
  // Screens outrank content at the same tier: "homework" is the name of a screen.
  const hw = svc.searchIndex(rows, 'homework');
  if (hw.length === 0 || hw[0].kind !== 'screen') {
    bad('searching for a screen name does not put the screen first');
  }
  // Every hit must be openable.
  if (svc.searchIndex(rows, 'photosynthesis').some((r) => !r.route)) {
    bad('a result has no route — the row would be a dead tap');
  }

  const groups = svc.groupResults(svc.searchIndex(rows, 'photosynthesis'));
  if (!groups.length || !groups[0].rows.length) bad('groupResults dropped the results');
  if (new Set(groups.map((g) => g.module)).size !== groups.length) {
    bad('groupResults emitted the same module twice');
  }

  /* ── 5. THE DASHBOARD BAR HANDS ITS QUERY OVER ───────────────────────────── */

  const entry = codeOnly(src.entry);
  if (!/onSubmitEditing/.test(entry)) {
    bad('the dashboard search bar ignores the keyboard\'s search key');
  }
  if (!/onSearch\?\.\(query\.trim\(\)\)/.test(entry)) {
    bad('the dashboard bar does not pass its query on — the student would type it twice');
  }
  if (!/q\b/.test(codeOnly(src.screen))) {
    bad('the results screen never reads the seeded query');
  }

  return out;
}

const MUTATIONS = [
  {
    name: 'the fan-out made all-or-nothing',
    svc: (s) => s.replace('await studentApi.settleAll(tasks)', 'await Promise.all(Object.values(tasks)).then(() => ({}))'),
    src: (k, s) => (k === 'service' ? s.replace('await studentApi.settleAll(tasks)', 'await Promise.all(Object.values(tasks))') : s),
  },
  {
    name: 'a refused module silently omitted instead of reported',
    svc: (s) => s.replace('partial.push(source.label);', ''),
  },
  {
    name: 'the cache no longer keyed to the session (one student reads another\'s tree)',
    svc: (s) => s.replace('cached?.fingerprint === fingerprint &&', 'true &&'),
    src: (k, s) => (k === 'service' ? s.replaceAll('fingerprint', 'constantKey') : s),
  },
  {
    name: 'the app destinations dropped from the index',
    svc: (s) => s.replace('rows.push(...DESTINATIONS);', ''),
  },
  {
    name: 'the walker stopping before the leaf topics',
    svc: (s) => s.replace("childKeys: ['classes', 'subjects', 'chapters', 'topics'],", "childKeys: ['classes', 'subjects'],"),
  },
  {
    name: 'a node putting ITSELF in its own breadcrumb',
    svc: (s) => s.replace('trail: trail.join(\' › \'),', "trail: nextTrail.join(' › '),"),
  },
  {
    name: 'THE MATCHER: reverted to a single ordered substring test',
    svc: (s) => s.replace('if (!words.every((w) => hay.includes(w))) continue;', 'if (!hay.includes(q)) continue;'),
  },
  {
    name: 'the matcher made case-sensitive',
    svc: (s) => s.replace("const q = String(query || '').trim().toLowerCase();", "const q = String(query || '').trim();"),
  },
  {
    name: 'an empty query returning the whole index',
    svc: (s) => s.replace('if (!q) return [];', ''),
  },
  {
    name: 'screens no longer outranking content on their own name',
    svc: (s) => s.replace("if (row.kind === 'screen') score -= 0.5;", ''),
  },
  {
    name: 'the dashboard bar dropping the typed query',
    src: (k, s) => (k === 'entry' ? s.replace('onSearch?.(query.trim())', 'onSearch?.()') : s),
  },
];

console.log('Self-tests (each mutation must be caught):');
for (const m of MUTATIONS) {
  let caught;
  try {
    const svc = await loadService(m.svc);
    caught = (await assertions(svc, loadSources(m.src))).length > 0;
  } catch {
    caught = true; // a mutation that will not even load is caught, loudly
  }
  if (caught) ok(m.name);
  else fail(`NOT CAUGHT: ${m.name} — the corresponding assertion is vacuous`);
}

console.log('\nPlatform search:');
{
  const svc = await loadService();
  const problems = await assertions(svc, loadSources());
  if (problems.length === 0) {
    ok('settleAll, so a refused module costs its own rows — and the screen says which');
    ok('the cache is fingerprinted to the session and cleared with it');
    ok('content AND app destinations are indexed, each leaf carrying its ancestors');
    ok('matching is word-wise and case-insensitive; every hit has a route');
    ok('the dashboard bar hands its query to the results screen');
  } else problems.forEach(fail);
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL — ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
