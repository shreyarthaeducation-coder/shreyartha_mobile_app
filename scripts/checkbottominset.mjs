// Nothing the user must tap sits under the phone's navigation bar.
//
//   node scripts/checkbottominset.mjs
//
// WHY. Expo SDK 57 draws Android apps edge to edge. A "Save grades" bar pinned to the bottom of a
// screen slid under the 3-button bar (26 Oct 2026) — and so did every bottom sheet's buttons.
//
//   1. Screens: app/_layout.js wraps the navigator in <BottomInsetGuard>, which pads the whole
//      app above the bar once. Remove it and every pinned footer is back under the bar.
//   2. Modals: React Native 0.86 draws a Modal edge to edge in a window of its own, outside that
//      padding. Every Modal whose panel is pinned to the bottom (justifyContent: 'flex-end', or a
//      full-screen page with an actions row) must add useModalBottomInset(), or wrap itself in a
//      native <SafeAreaView> that includes the 'bottom' edge.
//
// Exit code 0 = pass.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const problems = [];

// ── 1. The root guard ───────────────────────────────────────────────────────
const layout = fs.readFileSync(path.join(APP, 'app/_layout.js'), 'utf8');
const open = layout.indexOf('<BottomInsetGuard>');
const stack = layout.indexOf('<Stack ');
const close = layout.indexOf('</BottomInsetGuard>');
const stackEnd = layout.indexOf('</Stack>');
if (open < 0 || close < 0 || !(open < stack && stackEnd < close)) {
  problems.push('app/_layout.js: the navigator is not wrapped in <BottomInsetGuard>');
}

const guard = fs.readFileSync(path.join(APP, 'components/shared/BottomInsetGuard.js'), 'utf8');
if (!/paddingBottom:\s*insets\.bottom/.test(guard) || !/bottom:\s*0\s*\}/.test(guard)) {
  problems.push('BottomInsetGuard: must pad by insets.bottom and hand descendants bottom: 0');
}

// ── 2. Every Modal pinned to the bottom ─────────────────────────────────────
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

/** Full-screen modals whose bottom row holds buttons — they have no flex-end to give them away. */
const FULL_PAGE_WITH_ACTIONS = ['components/staff/sales/SalesTutorialSheet.js'];

let modals = 0;
for (const file of [...walk(path.join(APP, 'app')), ...walk(path.join(APP, 'components'))]) {
  const src = fs.readFileSync(file, 'utf8');
  if (!src.includes('<Modal')) continue;
  modals++;
  const rel = path.relative(APP, file).split(path.sep).join('/');
  const pinned = /justifyContent:\s*'flex-end'/.test(src) || FULL_PAGE_WITH_ACTIONS.includes(rel);
  if (!pinned) continue;
  const hook = /useModalBottomInset\(\)/.test(src) && /bottomPadding\(/.test(src);
  const nativeBottom = /<SafeAreaView[^>]*edges=\{\[[^\]]*'bottom'/.test(src);
  if (!hook && !nativeBottom) {
    problems.push(`${rel}: a Modal pinned to the bottom with no bottom inset (useModalBottomInset + bottomPadding, or SafeAreaView with 'bottom')`);
  }
}

if (modals < 20) problems.push(`only ${modals} files with a <Modal> found — the scan is not looking where it should`);

if (problems.length) {
  console.error('checkbottominset: FAIL');
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log(`checkbottominset: OK — root guard in place, ${modals} modal files checked`);
