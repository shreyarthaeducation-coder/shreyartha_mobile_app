// Every `styles.X` in the redesigned panels resolves to a key that actually exists.
//
//   node scripts/checkstylekeys.mjs
//
// WHY. React Native flattens style arrays and IGNORES `undefined` entries. So
//
//     <Text style={[styles.label, active && styles.lableActive]}>
//
// is not an error, not a warning, and not a crash — it is a typo that silently does nothing, and the
// element renders in the base style forever. This is the same failure shape as a missing palette
// token (see checkpalette.mjs) and the same one recorded elsewhere in this repo as "a missing branch
// is a silent no-op": the app looks fine to every automated gate and is wrong on the device.
//
// A rename is the usual way in. Rename `pressed` to `isPressed` in the stylesheet and every call
// site keeps compiling.
//
// Exit code 0 = pass.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');

/** The four redesigned panels plus the kit they share. */
const ROOTS = [
  // Every staff shell. Mechanical, so unlike checkdesign this can take the whole tree.
  'components/staff',
  'app/staff',
  'components/shared',
  'components/student',
  'components/parent',
  'components/partner',
  'components/teacher',
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
 * Split a source file into { defined, used }.
 *
 * The stylesheet is assumed to be the LAST thing in the file — `const useStyles = makeStyles(...)`
 * or `StyleSheet.create(...)` — which is the convention every file in these roots follows. Keys are
 * read at two-space indentation (top level of the object); uses are read from everything ABOVE the
 * stylesheet, so a key referenced by another key inside the sheet is not miscounted as a use.
 */
function analyse(src) {
  const decl = src.indexOf('const useStyles');
  const create = src.indexOf('StyleSheet.create');
  const at = decl >= 0 ? decl : create;
  if (at < 0) return null;

  const defined = new Set();
  const sheet = src.slice(at);
  const dre = /^ {2}([A-Za-z][A-Za-z0-9_]*):/gm;
  let m;
  while ((m = dre.exec(sheet))) defined.add(m[1]);

  const used = new Set();
  const body = src.slice(0, at);
  const ure = /\bstyles\.([A-Za-z][A-Za-z0-9_]*)/g;
  while ((m = ure.exec(body))) used.add(m[1]);

  return { defined, used, missing: [...used].filter((k) => !defined.has(k)) };
}

let failures = 0;

/* ── Self-test ───────────────────────────────────────────────────────────── */
console.log('Self-test (a planted typo must be caught):');
{
  const good = read(path.join(APP, 'components/shared/home/PortalTabBar.js'));
  const planted = good.replace('styles.pressed]', 'styles.pressedTypoPlanted]');
  if (planted === good) {
    failures += 1;
    console.error('  ✗ could not plant a typo — the self-test is inert, fix it before trusting the run');
  } else {
    const r = analyse(planted);
    if (!r || !r.defined.size) {
      failures += 1;
      console.error('  ✗ the stylesheet parser found no keys — the scan is vacuous');
    } else if (!r.missing.includes('pressedTypoPlanted')) {
      failures += 1;
      console.error('  ✗ a planted typo went unnoticed — the scan is vacuous');
    } else {
      console.log(`  ✓ planted typo caught (${r.defined.size} keys parsed from PortalTabBar)`);
    }
  }
}

/* ── The run ─────────────────────────────────────────────────────────────── */
console.log('\nStyle keys across the four panels:');
const files = ROOTS.flatMap((r) => walk(path.join(APP, r)));
let scanned = 0;
let bad = 0;

for (const f of files) {
  const r = analyse(read(f));
  if (!r) continue; // no stylesheet in this file
  scanned += 1;
  if (r.missing.length) {
    bad += 1;
    failures += 1;
    console.error(`  ✗ ${rel(f)}`);
    r.missing.forEach((k) => console.error(`        styles.${k} — used, never defined`));
  }
}

if (!scanned) {
  failures += 1;
  console.error('  ✗ no files with stylesheets were found — the roots list is wrong');
} else if (!bad) {
  console.log(`  ✓ ${scanned} file(s) scanned, every styles.X resolves`);
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL — ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
