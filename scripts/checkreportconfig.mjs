// Counsellor-report schema parity: mobile vs the website.
//
//   node scripts/checkreportconfig.mjs
//
// WHY THIS EXISTS. `constants/counsellorReportConfig.js` has said "keep it in step with the web's"
// since it was written, and nothing checked. It drifted, silently, for months:
//
//   * THREE multiselects lost their `options` array — Strengths, Areas Needing Improvement and
//     Counsellor Recommendations. `Chips` defaults to `options = []`, so those three sections
//     rendered as a bare heading with nothing under them and a mobile counsellor could not fill
//     them in AT ALL. Nobody noticed, because a missing option list looks like an empty section.
//   * A handful of labels drifted ("Self Confidence" vs "Self-Confidence").
//
// Neither shows up in a build, a lint or an `expo export`. Both are exactly what comparing the
// two files catches in a second.
//
// The two files are NOT required to be identical — the mobile chart set differs deliberately, and
// mobile has its own `parseReportForm`. What must match is the DOCUMENT: the same sections, in
// the same order, with the same fields, types and option lists, so a report reads the same on
// both platforms.

import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');
const WEB = join(APP, '..', 'frontendmain');

const MOBILE_CONFIG = join(APP, 'constants', 'counsellorReportConfig.js');
const WEB_CONFIG = join(WEB, 'src', 'School', 'shared', 'counsellorReportConfig.js');

let failures = 0;
const bad = (msg) => {
  failures += 1;
  console.log(`  ✗ ${msg}`);
};

/**
 * The web config imports `./F2F/activityReportConfig` extensionlessly, which webpack resolves and
 * node does not. Rather than shell out to a bundler, both files are read as text and the two
 * exports we compare are evaluated in isolation.
 *
 * That is deliberate: this checker must not depend on either app's build working, or it stops
 * being runnable exactly when something is broken.
 */
async function loadSections(path, label) {
  const src = readFileSync(path, 'utf8');
  // Rewrite the extensionless relative import so node can resolve it.
  const patched = src.replace(
    /from ["']\.\/F2F\/activityReportConfig["']/,
    `from ${JSON.stringify(pathToFileURL(join(dirname(path), 'F2F', 'activityReportConfig.js')).href)}`,
  );
  const url = `data:text/javascript;base64,${Buffer.from(patched).toString('base64')}`;
  try {
    return await import(url);
  } catch (e) {
    bad(`could not evaluate the ${label} config: ${e.message}`);
    return null;
  }
}

/** A comparable shape: order, keys, types and options, with presentation left out. */
function describe(sections) {
  return sections.map((s) => ({
    key: s.key,
    title: s.title,
    fields: s.fields.map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      options: f.options ? [...f.options] : null,
      optionLabels: f.optionLabels ? { ...f.optionLabels } : null,
      allowOther: !!f.allowOther,
      otherKey: f.otherKey || null,
    })),
  }));
}

const mobile = await loadSections(MOBILE_CONFIG, 'mobile');
const web = await loadSections(WEB_CONFIG, 'web');

if (mobile && web) {
  const m = describe(mobile.REPORT_SECTIONS);
  const w = describe(web.REPORT_SECTIONS);

  // ── Sections ──────────────────────────────────────────────────────────────
  const mKeys = m.map((s) => s.key);
  const wKeys = w.map((s) => s.key);
  if (mKeys.join(',') !== wKeys.join(',')) {
    bad(`section keys differ.\n      mobile: ${mKeys.join(', ')}\n      web:    ${wKeys.join(', ')}`);
  }

  // ── Fields, per section ───────────────────────────────────────────────────
  for (const wSec of w) {
    const mSec = m.find((s) => s.key === wSec.key);
    if (!mSec) continue; // already reported above
    if (mSec.title !== wSec.title) {
      bad(`section "${wSec.key}" title differs — mobile "${mSec.title}", web "${wSec.title}"`);
    }
    const mfKeys = mSec.fields.map((f) => f.key).join(',');
    const wfKeys = wSec.fields.map((f) => f.key).join(',');
    if (mfKeys !== wfKeys) {
      bad(`section "${wSec.key}" fields differ.\n      mobile: ${mfKeys}\n      web:    ${wfKeys}`);
      continue;
    }
    for (const wf of wSec.fields) {
      const mf = mSec.fields.find((f) => f.key === wf.key);
      if (mf.type !== wf.type) {
        bad(`field "${wf.key}" type differs — mobile "${mf.type}", web "${wf.type}"`);
      }
      if (mf.label !== wf.label) {
        bad(`field "${wf.key}" label differs — mobile "${mf.label}", web "${wf.label}"`);
      }
      // The one that actually bit: a null options array renders an empty section.
      const mo = mf.options ? mf.options.join('|') : null;
      const wo = wf.options ? wf.options.join('|') : null;
      if (mo !== wo) {
        bad(
          `field "${wf.key}" options differ — mobile ${mf.options ? `${mf.options.length} option(s)` : 'NONE'}, `
            + `web ${wf.options ? `${wf.options.length} option(s)` : 'NONE'}`,
        );
      }
      if (JSON.stringify(mf.optionLabels) !== JSON.stringify(wf.optionLabels)) {
        bad(`field "${wf.key}" optionLabels differ`);
      }
      if (mf.allowOther !== wf.allowOther || mf.otherKey !== wf.otherKey) {
        bad(`field "${wf.key}" allowOther/otherKey differ`);
      }
    }
  }

  // ── The Griffin split ─────────────────────────────────────────────────────
  // Not cosmetic. If the six narrative keys are not separated out of the form, they are written
  // into counsellor_reports.form_data — the wrong table, bypassing the DRAFT/PUBLISHED gate that
  // keeps an unreviewed AI draft about a child away from their parent.
  if (mobile.GRIFFIN_KEYS.join(',') !== web.GRIFFIN_KEYS.join(',')) {
    bad('GRIFFIN_KEYS differ between mobile and web');
  }
  if (mobile.FORM_DATA_SECTIONS.length !== web.FORM_DATA_SECTIONS.length) {
    bad('FORM_DATA_SECTIONS length differs');
  }
  const blank = mobile.buildEmptyForm();
  const { formData, griffin } = mobile.splitForm(blank);
  const leaked = mobile.GRIFFIN_KEYS.filter((k) => k in formData);
  if (leaked.length) {
    bad(`splitForm leaks Griffin keys into formData: ${leaked.join(', ')} — these would be written to the wrong table`);
  }
  if (mobile.GRIFFIN_KEYS.some((k) => !(k in griffin))) {
    bad('splitForm drops a Griffin key entirely — it would never reach the narrative row');
  }
  if (blank.pronoun !== 'they') {
    bad(`buildEmptyForm seeds pronoun "${blank.pronoun}" — it must default to they/them rather than guess a child's gender`);
  }
}

// ── Mutation self-test ──────────────────────────────────────────────────────
// A checker nobody has seen fail is a checker nobody should trust. Each case below is applied to
// the comparison in memory; every one must be caught.
const MUTATIONS = [
  {
    name: 'a multiselect loses its options (the bug this was written for)',
    mutate: (w) => {
      const c = describe(w.REPORT_SECTIONS);
      const f = c.flatMap((s) => s.fields).find((x) => x.options);
      f.options = null;
      return c;
    },
    expect: /options differ/,
  },
  {
    name: 'a section is dropped',
    mutate: (w) => describe(w.REPORT_SECTIONS).slice(0, -1),
    expect: /section keys differ/,
  },
  {
    name: 'a field label drifts',
    mutate: (w) => {
      const c = describe(w.REPORT_SECTIONS);
      c[0].fields[0].label = 'Drifted';
      return c;
    },
    expect: /label differs/,
  },
  {
    name: 'a field type changes',
    mutate: (w) => {
      const c = describe(w.REPORT_SECTIONS);
      c[0].fields[0].type = 'text';
      return c;
    },
    expect: /type differs/,
  },
];

if (mobile && web) {
  console.log('\n  mutation self-test');
  for (const mut of MUTATIONS) {
    const messages = [];
    const realBad = (msg) => messages.push(msg);
    // Re-run the field comparison against a mutated "mobile" side.
    const mutated = mut.mutate(web);
    const w = describe(web.REPORT_SECTIONS);
    const mKeys = mutated.map((s) => s.key).join(',');
    const wKeys = w.map((s) => s.key).join(',');
    if (mKeys !== wKeys) realBad('section keys differ');
    for (const wSec of w) {
      const mSec = mutated.find((s) => s.key === wSec.key);
      if (!mSec) continue;
      if (mSec.title !== wSec.title) realBad('title differs');
      for (const wf of wSec.fields) {
        const mf = mSec.fields.find((f) => f.key === wf.key);
        if (!mf) continue;
        if (mf.type !== wf.type) realBad(`field "${wf.key}" type differs`);
        if (mf.label !== wf.label) realBad(`field "${wf.key}" label differs`);
        const mo = mf.options ? mf.options.join('|') : null;
        const wo = wf.options ? wf.options.join('|') : null;
        if (mo !== wo) realBad(`field "${wf.key}" options differ`);
      }
    }
    const caught = messages.some((msg) => mut.expect.test(msg));
    console.log(`  ${caught ? '✓' : '✗ NOT CAUGHT —'} ${mut.name}`);
    if (!caught) failures += 1;
  }
}

console.log('');
if (failures) {
  console.log(`FAIL — ${failures} problem(s). The two schemas must describe the same document.`);
  process.exit(1);
}
console.log('PASS — mobile and web describe the same counsellor report.');
