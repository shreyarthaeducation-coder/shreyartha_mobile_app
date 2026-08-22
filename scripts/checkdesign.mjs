// Design-token checker — the student panel's visual budgets.
//
//   node scripts/checkdesign.mjs
//
// WHY THIS EXISTS. A design pass is the one change a build cannot validate: `expo export` is green
// for a screen rendered in unreadable colours, which is exactly how a duplicate `student:` key in
// PORTALS mis-themed every student screen for two phases without anything noticing.
//
// So this asserts BUDGETS, not appearance. Appearance needs eyes on a device; what a script can
// hold is "no new font size crept in", "no semantic colour was re-derived by hand", "no tap target
// shrank below the guideline". Those are the things that drift silently between phases.
//
// The ALLOW-LISTS ARE THE POINT. Every hex left in the panel is listed below with the reason it is
// identity rather than semantics. Adding to that list should feel like a decision, because it is.
// Exit code 0 = pass.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const PANEL = path.join(APP, 'components/student');
const THEME = path.join(APP, 'constants/theme.js');

let failures = 0;
const fail = (m) => {
  failures += 1;
  console.error(`  ✗ ${m}`);
};
const ok = (m) => console.log(`  ✓ ${m}`);

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

/** See checkbatch2/3: the naive block-comment regex eats `'video/*'` and `'image/*'`. */
const codeOnly = (t) =>
  t.replace(/(^|\s)\/\*[\s\S]*?\*\//g, '$1').replace(/^\s*\/\/.*$/gm, '');

/** Panel-relative, forward-slashed — the key every panel mutation is written against. */
const relOf = (f) => path.relative(PANEL, f).split(path.sep).join('/');

function panelFiles() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.js')) out.push(p);
    }
  })(PANEL);
  return out;
}

/** Evaluate theme.js so the budgets are checked against the REAL token values, not a grep. */
async function loadTheme(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'design-'));
  let src = read(THEME);
  if (mutate) src = mutate('theme', src);
  const file = path.join(dir, 'theme.mjs');
  fs.writeFileSync(file, src);
  return import(`${pathToFileURL(file).href}?t=${Math.random()}`);
}

/* ── The allow-lists ─────────────────────────────────────────────────────── */

/**
 * Colours that are IDENTITY, not semantics — they carry meaning specific to one feature and are
 * authored to match the website. Tokenising these would be a divergence, not a tidy-up.
 */
const IDENTITY_HEX = new Set([
  '#ffffff', '#000000', '#333333', '#1f2937', '#6b7280', // neutrals: button text, shadow, ink
  '#f8fafc', '#eff6ff', '#fffdf6', '#fff5f5', // near-white inset surfaces
  // Jyora's purple and Doubt Resolution's navy — each assistant's own brand, matched to the web
  '#7C3AED', '#5B21B6', '#4c1d95', '#faf5ff', '#ede9fe', '#7c5cff', '#4f46e5',
  '#162a6a',
  // My Analytics stat-strip series and the learning-gap levels — data colours, verbatim from the web
  '#4caf50', '#ff9800', '#3b82f6', '#2196f3', '#e8808f', '#facc15',
  // The Shreya avatar / mouth diagram palette — an illustration, not UI
  '#f6d8c3', '#e6ded0', '#e08585', '#d4707d', '#d4696c', '#b94f57', '#8e3340', '#5c1c27', '#78350f',
  '#ffeede',
  // Plan-badge and certificate tints, each tied to one badge
  '#d1fae5', '#34d399',
  '#9aa0a6', // BAND.none, defined once in theme and read from there
  '#ef4444', // EventsScreen's holiday marker — a calendar category, not an error state
]);

/** Sizes that are GLYPHS — an emoji or an icon rendered as text. Not type, so not on the scale. */
const GLYPH_SIZES = [
  ['CounselorScreen.js', 'emoji'],
  ['SoundStudioTutorial.js', 'icon'],
  ['SubjectCareerScreen.js', 'resultIcon'],
];

/* ── Assertions ──────────────────────────────────────────────────────────── */

/**
 * Panel-file mutations. Separate from the theme ones because these prove the *budgets* bite — that
 * a stray font size or a re-derived hex in any of 58 files is actually caught, rather than the
 * budget silently scanning nothing.
 */
function mutatePanel(key, src, panelMutation) {
  return panelMutation ? panelMutation(key, src) : src;
}

async function assertions(mutate, panelMutation) {
  const T = await loadTheme(mutate);
  const out = [];
  const bad = (m) => out.push(m);

  /* ── 1. The scale exists and is closed ─────────────────────────────────── */

  const scale = new Set(T.TYPE_SCALE);
  if (scale.size !== Object.keys(T.TYPE).length) {
    bad('TYPE has duplicate values — two roles resolving to the same size defeats the point of naming them');
  }
  if (!T.TOUCH || T.TOUCH.min < 44) {
    bad(`TOUCH.min is ${T.TOUCH?.min}, below the 44pt platform guideline`);
  }

  /* ── 2. BAND took the WEBSITE's amber ──────────────────────────────────── */

  // #f59e0b is what frontendmain's phonetics/scoreColor.js ships. #d97706 was one mobile screen's
  // drift, and consolidating onto it would have moved three features away from the web at once.
  if (T.BAND?.fair !== '#f59e0b') {
    bad(`BAND.fair is ${T.BAND?.fair}, not the website's #f59e0b — the consolidation must move toward the web, not average the mobile guesses`);
  }
  // DONE must stay pinned to BAND.good so "passed" and "complete" cannot drift apart.
  if (T.DONE !== T.BAND?.good) {
    bad('DONE is no longer BAND.good — the two greens this replaced will come back');
  }
  // The recording red is deliberately NOT the error red — but they currently share a VALUE, so
  // comparing values proves nothing (that assertion was vacuous, and the mutation that aliased them
  // sailed through). What matters is that RECORDING is declared as its own literal: that is what
  // lets a live mic and an error diverge later without hunting through four screens.
  //
  // THE MUTATION MUST REACH THIS GREP. Reading THEME straight off disk here left the assertion
  // testing the pristine file while the mutation only ever touched the evaluated copy — the same
  // vacuous-mutation trap every checker in this programme has hit at least once.
  const themeSrc = codeOnly(mutate ? mutate('theme', read(THEME)) : read(THEME));
  if (!/export const RECORDING = '#[0-9a-f]{6}';/i.test(themeSrc)) {
    bad('RECORDING is not declared as its own literal — aliasing it to FEEDBACK means a live mic can never stop looking like an error');
  }
  // Text-on-tint must actually be darker than text-on-white, or the roles are pointless.
  for (const [plain, onBg] of [['errorText', 'errorOnBg'], ['successText', 'successOnBg'], ['warningText', 'warningOnBg']]) {
    if (!T.FEEDBACK?.[onBg]) bad(`FEEDBACK.${onBg} is missing`);
    else if (T.FEEDBACK[onBg] === T.FEEDBACK[plain]) {
      bad(`FEEDBACK.${onBg} equals ${plain} — the on-tint variant exists because the plain one drops to ~3:1 on its own background`);
    }
  }

  /* ── 3. Per-file budgets across the panel ──────────────────────────────── */

  const strayType = [];
  const strayHex = [];

  for (const file of panelFiles()) {
    const rel = path.relative(PANEL, file).replace(/\\/g, '/');
    const src = codeOnly(mutatePanel(rel, read(file), panelMutation));

    // Font sizes must come from TYPE, except the listed glyph sizes.
    for (const m of src.matchAll(/(\w+): \{[^}]*?fontSize: (\d+(?:\.\d+)?)\b/g)) {
      const [, key, num] = m;
      if (GLYPH_SIZES.some(([f, k]) => rel.endsWith(f) && k === key)) continue;
      strayType.push(`${rel} ${key}: ${num}`);
    }
    // The bare form, outside a named style key.
    for (const m of src.matchAll(/fontSize: (\d+(?:\.\d+)?)\b/g)) {
      const num = m[1];
      const around = src.slice(Math.max(0, m.index - 120), m.index);
      const key = [...around.matchAll(/(\w+): \{/g)].pop()?.[1];
      if (GLYPH_SIZES.some(([f, k]) => rel.endsWith(f) && k === key)) continue;
      if (!strayType.some((s) => s.startsWith(`${rel} ${key}:`))) strayType.push(`${rel} ${key ?? '?'}: ${num}`);
    }

    for (const m of src.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
      const hex = m[0];
      if (IDENTITY_HEX.has(hex) || IDENTITY_HEX.has(hex.toLowerCase())) continue;
      strayHex.push(`${rel} ${hex}`);
    }
  }

  if (strayType.length) {
    bad(`${strayType.length} font size(s) outside the TYPE scale: ${[...new Set(strayType)].slice(0, 6).join(', ')}${strayType.length > 6 ? ' …' : ''}`);
  }
  if (strayHex.length) {
    bad(`${strayHex.length} hardcoded hex colour(s) with a token available: ${[...new Set(strayHex)].slice(0, 6).join(', ')}${strayHex.length > 6 ? ' …' : ''}`);
  }

  /* ── 4. The note style is single-sourced ───────────────────────────────── */

  const CANON = /empty: \{ fontSize: TYPE\.body, color: SLATE\[500\], lineHeight: 19 \}/;
  const dupes = panelFiles().filter((f) => CANON.test(mutatePanel(relOf(f), read(f), panelMutation)));
  if (dupes.length) {
    bad(`${dupes.length} file(s) re-declare the shared note style instead of using <StudentNote>: ${dupes.map((f) => path.basename(f)).join(', ')}`);
  }
  if (!/export function StudentNote/.test(read(path.join(PANEL, 'StudentCard.js')))) {
    bad('StudentNote is gone from StudentCard — the twelve duplicate note styles will grow back');
  }

  /* ── 5. Tap targets ────────────────────────────────────────────────────── */

  // Any minHeight BELOW the guideline on something that reads like a control.
  const short = [];
  for (const file of panelFiles()) {
    const rel = relOf(file);
    const src = codeOnly(mutatePanel(rel, read(file), panelMutation));
    for (const m of src.matchAll(/(\w+): \{[^}]*?minHeight: (\d+)\b/g)) {
      const [, key, num] = m;
      if (Number(num) >= T.TOUCH.min) continue;
      // A textarea, a card or a media box is sized, not tapped.
      if (/area|box|card|panel|preview|thumb|track|bar|link|chip/i.test(key)) continue;
      short.push(`${rel} ${key}: ${num}`);
    }
  }
  if (short.length) {
    bad(`${short.length} control(s) below TOUCH.min: ${short.join(', ')}`);
  }

  return out;
}

/* ── Mutations ───────────────────────────────────────────────────────────── */

const MUTATIONS = [
  ['BAND.fair drifts back to the non-web amber', (k, t) =>
    k === 'theme' ? t.replace(/fair: '#f59e0b'/, "fair: '#d97706'") : t],
  ['DONE unpinned from BAND.good', (k, t) =>
    k === 'theme' ? t.replace(/export const DONE = BAND\.good;/, "export const DONE = '#22c55e';") : t],
  ['RECORDING aliased to FEEDBACK instead of holding its own value', (k, t) =>
    k === 'theme' ? t.replace(/export const RECORDING = '#dc2626';/, 'export const RECORDING = FEEDBACK.errorText;') : t],
  ['the on-tint success variant flattened', (k, t) =>
    k === 'theme' ? t.replace(/successOnBg: '#166534'/, "successOnBg: '#16a34a'") : t],
  ['TOUCH.min lowered below the guideline', (k, t) =>
    k === 'theme' ? t.replace(/export const TOUCH = \{ min: 44 \};/, 'export const TOUCH = { min: 32 };') : t],
  ['two TYPE roles given the same size', (k, t) =>
    k === 'theme' ? t.replace(/heading: 15,/, 'heading: 13,') : t],
];

/** Mutations applied to PANEL files, proving each budget actually scans them. */
const PANEL_MUTATIONS = [
  ['a stray font size reappears in a screen', (rel, t) =>
    rel === 'SkillsEdgeScreen.js' ? t.replace('fontSize: TYPE.body', 'fontSize: 13.5') : t],
  ['a semantic hex is re-derived by hand', (rel, t) =>
    rel === 'MyProject.js' ? t.replace('color={FEEDBACK.errorText}', "color=\"#b91c1c\"") : t],
  ['a control shrinks below the tap guideline', (rel, t) =>
    rel === 'ai/ShreyaSpeakButton.js' ? t.replace('minHeight: TOUCH.min', 'minHeight: 30') : t],
  ['the shared note style is copied back into a screen', (rel, t) =>
    rel === 'MyProject.js'
      ? t.replace(
          '  loader: {',
          '  empty: { fontSize: TYPE.body, color: SLATE[500], lineHeight: 19 },\n  loader: {',
        )
      : t],
];

/* ── Run ─────────────────────────────────────────────────────────────────── */

console.log('Design tokens — the student panel\n');

const baseline = await assertions(null);
if (baseline.length) {
  console.log('BASELINE (current code):');
  baseline.forEach(fail);
} else {
  ok('baseline: every budget holds against the current code');
}

console.log('\nMUTATIONS (each must be caught):');
let vacuous = 0;
for (const [name, mutate] of MUTATIONS) {
  const caught = (await assertions(mutate)).filter((m) => !baseline.includes(m));
  if (caught.length) ok(`${name} — caught (${caught.length})`);
  else {
    vacuous += 1;
    fail(`${name} — NOT CAUGHT. This assertion is vacuous.`);
  }
}

for (const [name, pm] of PANEL_MUTATIONS) {
  const caught = (await assertions(null, pm)).filter((m) => !baseline.includes(m));
  if (caught.length) ok(`${name} — caught (${caught.length})`);
  else {
    vacuous += 1;
    fail(`${name} — NOT CAUGHT. This budget is not scanning the panel.`);
  }
}

console.log('');
if (failures) {
  console.error(`FAILED: ${baseline.length} baseline, ${vacuous} vacuous mutation(s).`);
  process.exit(1);
}
console.log(`PASSED: ${MUTATIONS.length + PANEL_MUTATIONS.length} mutations, all caught.`);
