// Every route the four redesigned panels navigate to resolves to a real file under app/.
//
//   node scripts/checkroutes.mjs
//
// WHY. Expo Router resolves paths at RUNTIME, from the file tree. `router.push('/teacher/workspce')`
// is a valid string, a valid call, and a valid build — it fails only when a finger lands on the tile,
// and then it fails as a blank screen rather than an error anyone would report precisely.
//
// This matters more than usual right now. The teacher pass REALLOCATED all sixteen menu items across
// new destinations, and the student, parent and partner passes each added a home screen whose whole
// job is to be the entry point to everything else. The characteristic bug of that work is a tile that
// quietly loses its only route — which nothing else here would catch.
//
// ── WHAT IS DELIBERATELY NOT CHECKED ────────────────────────────────────────
// Paths built from a variable (`router.push(item.native)`) are invisible to a source scan. The menu
// constants that feed those are checked where they are declared — `checkteacherdashboard.mjs` walks
// TEACHER_MENU's `native:` values — so this file covers the literals those checkers cannot see.
//
// Exit code 0 = pass.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const APP_DIR = path.join(APP, 'app');

/** Where navigation literals are collected from. */
const ROOTS = [
  // Every staff shell — the dynamic [role] segment resolves as a wildcard, see the table builder.
  'components/staff',
  'app/staff',
  'components/shared',
  'components/student',
  'components/parent',
  'components/partner',
  'components/teacher',
  'constants',
  'app/student',
  'app/parent',
  'app/partner',
  'app/teacher',
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

const rel = (p) => path.relative(APP, p).split(path.sep).join('/');
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

/**
 * The route table, built the way Expo Router builds it: from the files.
 *
 *   app/teacher/workspace.js  → /teacher/workspace
 *   app/teacher/index.js      → /teacher
 *   app/(tabs)/index.js       → /(tabs) and /          (a group is transparent in the URL)
 *   app/student/[id].js       → a DYNAMIC segment, matched separately
 *
 * `_layout.js` files declare no route of their own.
 */
function routeTable() {
  const stat = new Set();
  const dyn = [];

  for (const f of walk(APP_DIR)) {
    const base = path.basename(f);
    if (base === '_layout.js' || base.startsWith('+')) continue;

    let r = '/' + path.relative(APP_DIR, f).split(path.sep).join('/').replace(/\.js$/, '');
    r = r.replace(/\/index$/, '') || '/';

    if (/\[[^\]]+\]/.test(r)) {
      // `/student/topic/[id]` → a regex that accepts any one segment in that position.
      dyn.push(new RegExp('^' + r.replace(/\[[^\]]+\]/g, '[^/]+') + '$'));
      continue;
    }

    stat.add(r);
    // A group segment like `(tabs)` is real as a path AND transparent, so both spellings work.
    const bare = r.replace(/\/\([^)]+\)/g, '');
    if (bare !== r) stat.add(bare || '/');
  }
  return { stat, dyn };
}

const { stat, dyn } = routeTable();

/** Does `route` resolve? */
function resolves(route) {
  const clean = route.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  if (stat.has(clean)) return true;
  return dyn.some((re) => re.test(clean));
}

/**
 * Every navigation literal in a source file.
 *
 * Both quote styles and backtick strings are read, but a backtick containing `${` is skipped — its
 * value is not knowable here, and guessing would either produce noise or, worse, a false pass on a
 * prefix that happens to exist.
 */
function literals(src) {
  const out = [];
  const patterns = [
    // A navigation call, or a JSX href.
    /(?:router\.(?:push|replace|navigate)|href=)\s*\(?\s*(['"`])([^'"`]*)\1/g,
    // A route carried as DATA. Most tiles never name their destination at the call site — they do
    // `router.push(item.native)` — so the menu constants are where the real route set lives, and
    // scanning only call sites would check a small and unrepresentative slice of the panel.
    // `fallbackRoute` is ScreenScaffold's back target and is a real destination too.
    /\b(?:native|route|fallbackRoute|changePasswordRoute)\s*:\s*(['"`])([^'"`]*)\1/g,
    // BrandBar and friends take the same thing as a prop.
    /\b(?:changePasswordRoute|fallbackRoute)=\s*\{?\s*(['"`])([^'"`]*)\1/g,
  ];

  for (const re of patterns) {
    let m;
    while ((m = re.exec(src))) {
      const raw = m[2];
      if (!raw.startsWith('/')) continue; // relative, a web path, or a variable — not ours
      if (raw.includes('${')) continue; // interpolated
      out.push(raw);
    }
  }
  return out;
}

let failures = 0;

/* ── Self-test ───────────────────────────────────────────────────────────── */
console.log('Self-test (a broken route must be caught):');
{
  if (!stat.size) {
    failures += 1;
    console.error('  ✗ the route table is EMPTY — the scan would pass everything');
  } else if (!resolves('/teacher')) {
    failures += 1;
    console.error('  ✗ /teacher does not resolve — the table is built wrong, results are meaningless');
  } else if (resolves('/teacher/workspce')) {
    failures += 1;
    console.error('  ✗ a misspelled route resolved — the check is vacuous');
  } else {
    const found = literals("router.push('/teacher/workspce')");
    if (!found.includes('/teacher/workspce')) {
      failures += 1;
      console.error('  ✗ the literal scanner missed a router.push — the scan is vacuous');
    } else {
      console.log(`  ✓ table has ${stat.size} static + ${dyn.length} dynamic routes; a typo is rejected`);
    }
  }
}

/* ── The run ─────────────────────────────────────────────────────────────── */
console.log('\nNavigation literals across the four panels:');
const files = ROOTS.flatMap((r) => walk(path.join(APP, r)));
let count = 0;
let broken = 0;

for (const f of files) {
  const bad = [...new Set(literals(read(f)))].filter((r) => !resolves(r));
  count += literals(read(f)).length;
  if (bad.length) {
    broken += bad.length;
    failures += 1;
    console.error(`  ✗ ${rel(f)}`);
    bad.forEach((r) => console.error(`        ${r} — no file under app/ answers this`));
  }
}

if (!count) {
  failures += 1;
  console.error('  ✗ no navigation literals found at all — the roots list is wrong');
} else if (!broken) {
  console.log(`  ✓ ${count} literal route(s) checked, all resolve`);
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL — ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
