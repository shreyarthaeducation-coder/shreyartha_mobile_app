// Palette-token coverage — does every portal actually HAVE what the shared kit reads?
//
//   node scripts/checkpalette.mjs
//
// WHY THIS EXISTS. `components/shared/home/*` is now mounted by four portals with three different
// palettes, and a palette is a plain object. Reading a token a portal does not define yields
// `undefined`, which React Native does not warn about — it silently means "no value":
//
//     backgroundColor: undefined  → a transparent surface
//     borderTopColor: undefined   → no border at all
//     color: undefined            → RN's default BLACK
//
// So a footer bar can render as a transparent strip with black labels floating over the content
// beneath it, and `expo export` is green, `checkscope` is green, and the design checker — which
// polices hardcoded hexes, not missing tokens — is green too.
//
// This is not hypothetical. `components/ui/AnalyticsSummaryCard` read `color: p.onDark` with no
// fallback and rendered black-on-purple on the parent home for an entire release, and the parent
// palette only gained the token when that card was traced.
//
// ── HOW A READ IS JUDGED SAFE ───────────────────────────────────────────────
// A rule may read a token the portal lacks IF a sibling `<key>Light` rule sets the same property —
// that is the `tone="light"` mechanism, and the override wins. Anything else is a real hole.
//
// Exit code 0 = pass.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');

/**
 * Which palette each portal's screens resolve to.
 *
 * The teacher is the one worth spelling out: `app/teacher/_layout.js` mounts NO `PaletteProvider`,
 * so `usePalette()` falls through to its default — `PORTALS.school`. Partner deliberately reuses
 * `PORTALS.parent` (the two auth stylesheets are byte-identical) rather than adding a near-duplicate
 * key, which is what once silently mis-themed every student screen.
 *
 * ── THE FOUR STAFF SHELLS WERE NOT SCANNED AT ALL UNTIL THE STAFF REDESIGN ──
 * This map had four entries and the staff palettes were never checked against the shared kit. That
 * was survivable while the staff shells rendered `WelcomeHeader` and a tile grid — none of which
 * reads a dark-glass token. The moment they mount `BrandBar`, `IdentityCard`, `HeroCard`,
 * `AssistantCard`, `SearchEntry`, `SectionDivider` and `PortalTabBar`, they are exposed to exactly
 * the bug this file exists to catch: a palette that lacks a token renders `undefined`, which React
 * Native treats as "unset" — transparent surfaces, missing borders, and text in default BLACK.
 *
 * All five staff palettes define only the twelve base tokens (no `glassDark`, no `onDark`, no
 * `pageBg`), which is precisely why every staff panel must mount the kit at `tone="light"`. The
 * `<key>Light` sibling rule below is what makes that safe, and this map is what proves it.
 *
 * `principal` and `shreyartha_admin` are listed too: they still render `StaffMenuScreen`, but they
 * share `StaffProfileScreen` and `StaffFeatureScreen` with the redesigned four, so a token added to
 * a shared screen must resolve for them as well.
 */
const PORTAL_OF = {
  student: 'student',
  parent: 'parent',
  partner: 'parent',
  teacher: 'school',
  counselor: 'counsellor',
  shreyartha_councellor: 'shreyarthaCounsellor',
  shreyartha_teacher: 'shreyarthaTeacher',
  vice_principal: 'vicePrincipal',
  principal: 'principal',
  shreyartha_admin: 'school',
};

/** The shared components every redesigned dashboard mounts. */
const SHARED = [
  'components/shared/home/AssistantCard.js',
  'components/shared/home/BrandBar.js',
  'components/shared/home/HeroCard.js',
  'components/shared/home/IdentityCard.js',
  'components/shared/home/PortalTabBar.js',
  'components/shared/home/SearchEntry.js',
  'components/shared/home/SectionDivider.js',
  'components/shared/home/StatStrip.js',
  'components/shared/ComingSoon.js',
  'components/shared/LanguagePicker.js',
];

let failures = 0;
const fail = (m) => {
  failures += 1;
  console.error(`  ✗ ${m}`);
};
const ok = (m) => console.log(`  ✓ ${m}`);

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

/** Evaluate theme.js so the palettes are the REAL objects, not a grep of them. */
async function loadTheme() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pal-'));
  const file = path.join(dir, 'theme.mjs');
  fs.writeFileSync(file, read(path.join(APP, 'constants/theme.js')));
  return import(`${pathToFileURL(file).href}?t=${Math.random()}`);
}

/**
 * Split a `makeStyles((p) => ({ … }))` block into its top-level `key: { body }` rules.
 *
 * Braces are WALKED rather than matched with `[^}]*`, because a rule containing `shadowOffset:
 * { width: 0, height: 2 }` would otherwise be truncated at the inner brace and its later
 * properties — the ones that actually read palette tokens — would go unscanned.
 */
function styleRules(src) {
  const from = src.indexOf('const useStyles');
  if (from < 0) return [];
  const block = src.slice(from);
  const rules = [];
  const re = /^ {2}([A-Za-z][\w]*):\s*\{/gm;
  let m;
  while ((m = re.exec(block))) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < block.length && depth > 0) {
      if (block[i] === '{') depth += 1;
      else if (block[i] === '}') depth -= 1;
      i += 1;
    }
    rules.push({ key: m[1], body: block.slice(re.lastIndex, i - 1) });
  }
  return rules;
}

/**
 * Every unguarded read of a token the given palette lacks.
 *
 * NOTE THE REGEXES ARE BUILT BY CONCATENATION, not from a template literal. In a template literal
 * `\b` is a BACKSPACE character and `\w`/`\s` collapse to bare letters — the first version of this
 * audit did exactly that and reported a clean sweep over a file that was visibly broken. Same trap
 * the partner checker's shell heredoc hit.
 */
function holes(src, palette) {
  const rules = styleRules(src);
  const byKey = new Map(rules.map((r) => [r.key, r]));
  const out = [];

  for (const rule of rules) {
    // `(\w+): p.someToken` — the property, and the token it is set from.
    const re = new RegExp('(\\w+):\\s*p\\.(\\w+)', 'g');
    let m;
    while ((m = re.exec(rule.body))) {
      const [, prop, token] = m;
      if (palette[token] !== undefined) continue; // the portal has it

      const light = byKey.get(`${rule.key}Light`);
      const overridden = light && new RegExp(prop + ':').test(light.body);
      if (!overridden) out.push({ rule: rule.key, prop, token });
    }
  }
  return { rules, out };
}

const T = await loadTheme();

/* ── Self-test: prove the scan can fail ──────────────────────────────────── */
//
// A style checker that finds nothing is indistinguishable from one that scans nothing. This mutates
// a known-good file into a known-bad one and requires the scan to notice.
console.log('Self-test (the scan must catch a planted hole):');
{
  const good = read(path.join(APP, 'components/shared/home/HeroCard.js'));
  const planted = good.replace(
    '  card: { borderRadius: 20,',
    '  card: { backgroundColor: p.notARealToken, borderRadius: 20,',
  );
  if (planted === good) {
    fail('could not plant a hole in HeroCard — the self-test is inert, fix it before trusting the run');
  } else {
    const { rules, out } = holes(planted, T.PORTALS.student);
    if (!rules.length) fail('the rule splitter found no styles at all — the scan is vacuous');
    else if (!out.some((h) => h.token === 'notARealToken')) {
      fail('a planted missing token went unnoticed — the scan is vacuous');
    } else ok(`planted hole caught (${rules.length} rules parsed)`);
  }
}

/* ── The real run ────────────────────────────────────────────────────────── */

console.log('\nShared kit against every portal palette:');
let totalHoles = 0;
for (const [portal, paletteKey] of Object.entries(PORTAL_OF)) {
  const palette = T.PORTALS[paletteKey];
  const lines = [];

  for (const rel of SHARED) {
    const { out } = holes(read(path.join(APP, rel)), palette);
    const seen = new Set();
    out.forEach((h) => {
      const sig = `${rel.split('/').pop()} → ${h.rule}.${h.prop} = p.${h.token}`;
      if (!seen.has(sig)) {
        seen.add(sig);
        lines.push(sig);
      }
    });
  }

  if (lines.length) {
    totalHoles += lines.length;
    fail(`${portal} (PORTALS.${paletteKey}) reads ${lines.length} token(s) its palette does not define:`);
    lines.forEach((l) => console.error(`        ${l}`));
  } else {
    ok(`${portal} (PORTALS.${paletteKey}) — every token it reads is defined`);
  }
}

console.log(
  failures === 0 ? '\nPASS' : `\nFAIL — ${totalHoles} unguarded read(s) across ${failures} portal(s)`,
);
process.exit(failures === 0 ? 0 : 1);
