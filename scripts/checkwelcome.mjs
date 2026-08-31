// Student progress-bar checker — the strip on the dashboard's My Analytics card.
//
//   node scripts/checkwelcome.mjs
//
// WHY THIS EXISTS. This screen's failure modes are all *silently plausible* — it would look
// finished while being wrong:
//
//   * A section rendered at 0% because its request FAILED tells a student their work has vanished.
//     "You have completed none of this" and "we could not read your progress" are different claims.
//   * The analytics spine carries hardcoded placeholders — codingPro (AI 80 / Robotics 60 /
//     Coding 75) and readinessIndex — that are IDENTICAL for every student on the platform. A bar
//     fed from those looks like real progress and is not.
//   * Language Lab has no percentage anywhere in the API. Inventing one from the level names
//     (Beginner→33, Average→66…) would produce a number no server ever computed.
//
// RETARGETED. These bars used to live in a once-per-session welcome interstitial, and this file
// also policed that screen's session flag and its Get Started button. The dashboard redesign
// RETIRED the interstitial — the new dashboard carries the identity block it existed for, and the
// bars now sit on the My Analytics hero card where they are visible every time. Those assertions
// were removed rather than left pointing at deleted files. Everything else here is unchanged,
// because the rules it protects were never about that screen: they are about welcomeService.js,
// which still feeds the bars.
//
// Exit code 0 = pass.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');

const SRC = {
  service: 'services/student/welcomeService.js',
  strip: 'components/student/home/ProgressStrip.js',
  home: 'components/student/StudentHome.js',
};

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`  ✗ ${msg}`);
};
const ok = (msg) => console.log(`  ✓ ${msg}`);

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

/**
 * Code with comments stripped.
 *
 * Load-bearing here: every one of these files DOCUMENTS the trap it avoids, naming `AsyncStorage`,
 * `33/66/100` and `readinessIndex` in prose. A bare grep finds the warning and reports the bug as
 * present.
 */
const codeOnly = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * @param mutate        applied to every source file, keyed by name
 * @param mutateService applied to welcomeService.js ON TOP of that.
 *
 * The second parameter is not optional bookkeeping. A `service:` mutation edits the module that
 * gets EVALUATED, while the text assertions read the file separately — so without this, three
 * mutations changed the evaluated behaviour while every grep kept reading the pristine file, and
 * all three "passed" while testing nothing. Same trap as scripts/checkspeech.mjs.
 */
function loadSources(mutate, mutateService) {
  const out = {};
  for (const [key, rel] of Object.entries(SRC)) {
    let text = read(path.join(APP, rel));
    if (mutate) text = mutate(key, text);
    if (mutateService && key === 'service') text = mutateService(text);
    out[key] = text;
  }
  return out;
}

/* ── Evaluating the two pure modules ──────────────────────────────────────────
   The bugs above are wrong VALUES and wrong BEHAVIOUR, and only running the code proves those. */

async function loadService(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'welcome-'));
  let src = read(path.join(APP, SRC.service));
  if (mutate) src = mutate(src);
  src = src
    .replace(/^import \{ studentApi \}.*$/m, 'const studentApi = { get: async () => ({}) };')
    .replace(/from '\.\/analyticsService'/, "from './analyticsService.mjs'");
  // Only the two pure readers are needed; the transport is stubbed out.
  let analytics = read(path.join(APP, 'services/student/analyticsService.js'));
  analytics = analytics.replace(/^import \{ studentApi \}.*$/m, 'const studentApi = { get: async () => ({}), settleAll: async () => ({}) };');
  fs.writeFileSync(path.join(dir, 'analyticsService.mjs'), analytics);
  const file = path.join(dir, 'welcomeService.mjs');
  fs.writeFileSync(file, src);
  return import(`${pathToFileURL(file).href}?t=${Math.random()}`);
}

/** A `settleAll` result for one key. */
const okPart = (data) => ({ data, error: null, forbidden: false });
const failedPart = (forbidden = false) => ({ data: null, error: 'Could not load.', forbidden });

function assertions(svc, src) {
  const out = [];
  const bad = (m) => out.push(m);

  /* ── 1. THE BARS ARE ON THE DASHBOARD, AND NEVER GATE IT ─────────────────── */

  const home = codeOnly(src.home);
  if (!/<ProgressStrip/.test(home)) {
    bad('the dashboard no longer renders ProgressStrip — the progress bars have nowhere to live');
  }
  // The bars are an ENRICHMENT. They must load in their own wave, so six extra round trips can
  // never delay or blank the dashboard the way the retired interstitial's load once did.
  if (!/const loadProgress = useCallback/.test(home)) {
    bad('the progress load is not its own wave — it must not gate the first paint');
  }
  if (/loadWelcomeProgress\(\)[\s\S]{0,200}setLoading\(false\)/.test(home)) {
    bad('setLoading is waiting on loadWelcomeProgress — the dashboard would hold for six requests it does not need');
  }
  // The identity fan-out must stay settled, not all-or-nothing: a free student legitimately 403s.
  if (/Promise\.all\(/.test(home)) {
    bad('StudentHome uses Promise.all — one expected 403 would blank the whole dashboard');
  }

  const strip = codeOnly(src.strip);
  // The strip RENDERS rows; it must not compute a percentage of its own, or the "every bar is real"
  // guarantee moves out of welcomeService where it is enforced.
  if (/analytics|codingPro|readinessIndex|skillLevels/.test(strip)) {
    bad('ProgressStrip reaches into the analytics payload — it must render only the rows it is given');
  }
  if (!/Math\.min\(100/.test(strip)) {
    bad('ProgressStrip does not clamp its percentage — a server value above 100 overflows the track');
  }
  if (!/rows\.length/.test(strip)) {
    bad('ProgressStrip has no empty state — with no rows it would render an empty card');
  }

  /* ── 2. NO FABRICATED NUMBERS ────────────────────────────────────────────── */

  const svcSrc = codeOnly(src.service);
  // Language Lab: any numeric level map is an invented percentage.
  if (/Beginner['"]?\s*:\s*\d/.test(svcSrc) || /Proficient['"]?\s*:\s*\d/.test(svcSrc)) {
    bad('a level→percentage map appeared — Language Lab has no percentage in the API, so that number is invented');
  }
  // The spine's placeholders must never reach a bar.
  if (/readinessIndex/.test(svcSrc)) {
    bad('welcomeService reads readinessIndex — it is hardcoded High/Medium/High/High for every student');
  }
  // `languageSkills` must keep returning LEVELS. Evaluated, not grepped: the trap is a number, and
  // only running it proves nothing numeric comes out.
  const skills = svc.languageSkills({
    languageLab: { skillLevels: { Listening: 'Beginner', Speaking: 'Not Set', Reading: 'Proficient' } },
  });
  if (!Array.isArray(skills)) bad('languageSkills no longer returns a list');
  else {
    if (skills.some((s) => Number.isFinite(Number(s.level)))) {
      bad('languageSkills returned a NUMBER — Language Lab has no percentage in the API, so that is invented');
    }
    if (skills.some((s) => s.level === 'Not Set')) {
      bad('languageSkills is reporting "Not Set" as a level — the web hides those rather than showing four blanks');
    }
  }

  /* ── 3. A FAILED SECTION IS OMITTED, NOT ZEROED ──────────────────────────── */

  const analytics = { academicIQ: { syllabusCompletionPercent: 40, progressPercent: 30 } };
  const allFailed = {
    syllabus: failedPart(),
    progress: failedPart(),
    competitive: failedPart(true),
    coding: failedPart(true),
    skillsProgress: failedPart(),
  };

  // With no spine and everything failed there must be NO rows at all.
  const none = svc.sectionRows(null, allFailed);
  if (none.length !== 0) {
    bad(`a total failure still produced ${none.length} row(s) — those bars would read as "you have done nothing"`);
  }

  // Coding must NOT fall back to the spine's fabricated numbers, even though `codingStreams` can.
  //
  // Two separate cases, and the first version of this check only exercised the easy one:
  //
  //   (a) the whole call failed  → no row at all
  //   (b) the call SUCCEEDED but is missing a stream → the missing streams must read 0, NOT the
  //       spine's 60/75. `codingStreams` falls back PER STREAM, so passing `analytics` as its
  //       second argument silently mixes real and fabricated numbers into one average. Case (a)
  //       alone could not detect that, because it never reaches the mapper.
  const placeholderSpine = {
    codingPro: { ai: { percent: 80 }, robotics: { percent: 60 }, coding: { percent: 75 } },
  };

  if (svc.sectionRows(placeholderSpine, allFailed).some((r) => r.key === 'coding')) {
    bad('Coding Pro fell back to the spine placeholder (AI 80 / Robotics 60 / Coding 75) — identical for every student');
  }

  const partialCoding = svc.sectionRows(placeholderSpine, {
    ...allFailed,
    coding: okPart({ ai: { percentage: 30 } }), // robotics and coding genuinely absent
  });
  const partial = partialCoding.find((r) => r.key === 'coding');
  if (!partial) {
    bad('a partial coding payload produced no row at all');
  } else if (partial.percent !== 10) {
    bad(
      `Coding Pro averaged ${partial.percent}% from a partial payload — expected 10% (30/0/0). ` +
        'Anything higher means the spine placeholder was mixed in for the missing streams.',
    );
  }

  // The spine IS a legitimate fallback for Academic IQ, whose numbers are real.
  const fromSpine = svc.sectionRows(analytics, allFailed);
  if (!fromSpine.some((r) => r.key === 'syllabus' && r.percent === 40)) {
    bad('Academic IQ lost its legitimate spine fallback');
  }

  // A section with no work yet is 0% and PRESENT — that is a true statement.
  const noExam = svc.sectionRows(null, {
    ...allFailed,
    competitive: okPart({ completedPercent: 0 }),
  });
  const ce = noExam.find((r) => r.key === 'competitive');
  if (!ce || ce.percent !== 0) {
    bad('a student with no competitive exam loses the row entirely — 0% is true and should show');
  }

  // Averages.
  const avg = svc.sectionRows(null, {
    ...allFailed,
    coding: okPart({ ai: { percentage: 30 }, robotics: { percentage: 60 }, coding: { percentage: 90 } }),
    skillsProgress: okPart({ Calligraphy: { percentage: 50 }, Chess: { percentage: 100 } }),
  });
  if (avg.find((r) => r.key === 'coding')?.percent !== 60) {
    bad('Coding Pro does not average its three streams');
  }
  if (avg.find((r) => r.key === 'skills')?.percent !== 75) {
    bad('Skills Edge does not average its per-topic percentages');
  }

  // Every row must be able to open something.
  for (const row of avg) {
    if (!row.route || !row.route.startsWith('/student/')) {
      bad(`section row "${row.key}" has no in-app route — the bar is not tappable`);
    }
  }

  /* ── 4. THE TRIMMED CALL SET ─────────────────────────────────────────────── */

  // The four enrichments this screen does not render must not be requested.
  for (const dead of ['iqHistory', 'learningGaps', 'skillsProfile', 'psychResults']) {
    if (svcSrc.includes(dead)) {
      bad(`welcomeService fetches \`${dead}\`, which this screen never renders`);
    }
  }
  if (/loadAnalytics\(/.test(svcSrc)) {
    bad('welcomeService calls loadAnalytics() — 10 round trips, 4 of them unused here');
  }
  // Psychometric has no readable endpoint at all.
  if (/psychometrics\/results/.test(svcSrc)) {
    bad('welcomeService calls /api/psychometrics/results — that endpoint does not exist');
  }

  /* ── 5. PALETTE ──────────────────────────────────────────────────────────── */

  // These screens live inside PORTALS.student. A hardcoded portal reference would freeze them.
  for (const key of ['strip', 'home']) {
    if (/PORTALS\./.test(codeOnly(src[key]))) {
      bad(`${SRC[key]} reaches for PORTALS directly instead of usePalette()/makeStyles`);
    }
  }

  return out;
}

const MUTATIONS = [
  {
    name: 'THE SWAP: the progress bars made to gate the dashboard again',
    src: (k, s) =>
      k === 'home' ? s.replace('const loadProgress = useCallback', 'const loadProgressRenamed = useCallback') : s,
  },
  {
    name: 'the identity fan-out made all-or-nothing (one 403 blanks the dashboard)',
    src: (k, s) => (k === 'home' ? s.replace('Promise.allSettled(', 'Promise.all(') : s),
  },
  {
    name: 'the dashboard dropping the progress strip',
    src: (k, s) => (k === 'home' ? s.replace('<ProgressStrip', '<OldBars') : s),
  },
  {
    name: 'the strip computing its own numbers from the analytics payload',
    src: (k, s) =>
      k === 'strip'
        ? s.replace('export default function ProgressStrip', 'const readinessIndex = 1;\nexport default function ProgressStrip')
        : s,
  },
  {
    name: 'the strip no longer clamping a percentage above 100',
    src: (k, s) =>
      k === 'strip'
        ? s.replace('Math.max(0, Math.min(100, Math.round(Number(row.percent) || 0)))', 'Math.round(Number(row.percent) || 0)')
        : s,
  },
  {
    name: 'THE BUG: Language Lab levels mapped onto invented percentages',
    src: (k, s) =>
      k === 'service'
        ? s.replace('export function languageSkills(analytics) {', 'const LEVEL_PCT = { Beginner: 33, Average: 66, Proficient: 100 };\nexport function languageSkills(analytics) {')
        : s,
  },
  {
    name: "THE BUG: Coding Pro falling back to the spine's placeholder",
    service: (s) => s.replace('codingStreams(codingData, null)', 'codingStreams(codingData, analytics)'),
  },
  {
    name: 'the coding row emitted even when the progress call failed',
    service: (s) => s.replace('if (codingData) {', 'if (true) {'),
  },
  {
    name: 'a failed section rendered as 0% instead of being omitted',
    service: (s) =>
      s.replace(
        "const syllabus = part('syllabus').data?.completionPercent ?? academic?.syllabusCompletionPercent;",
        "const syllabus = part('syllabus').data?.completionPercent ?? academic?.syllabusCompletionPercent ?? 0;",
      ),
  },
  {
    name: 'the competitive row dropped when the student has no exam yet',
    service: (s) => s.replace('if (competitive) {', 'if (competitive?.completedPercent) {'),
  },
  {
    name: 'Coding Pro reporting only its first stream',
    service: (s) =>
      s.replace('mean(codingStreams(codingData, null).map((s) => Number(s.percent)))', 'Number(codingStreams(codingData, null)[0]?.percent)'),
  },
  {
    name: 'Skills Edge reporting a single topic instead of the mean',
    service: (s) =>
      s.replace(
        '    const avg = mean(\n      Object.values(skills)',
        '    const avg = (() => Number(Object.values(skills)[0]?.percentage))(); const unused = mean(\n      Object.values(skills)',
      ),
  },
  {
    name: 'a section row losing its route (the bar stops being tappable)',
    service: (s) => s.replace("  skills: '/student/skills-edge',", "  skills: '',"),
  },
  {
    name: 'readinessIndex (hardcoded for every student) read into the graph',
    service: (s) => s.replace('const academic = analytics?.academicIQ;', 'const academic = analytics?.academicIQ; const r = analytics?.readinessIndex;'),
  },
  {
    name: 'the four unused enrichments added back',
    service: (s) =>
      s.replace(
        "    syllabus: studentApi.get('/api/students/syllabus-completion'),",
        "    psychResults: studentApi.get('/api/psychometrics/results'),\n    syllabus: studentApi.get('/api/students/syllabus-completion'),",
      ),
  },
  {
    name: 'the heavy loadAnalytics() reused wholesale',
    service: (s) => s.replace('export async function loadWelcomeProgress() {', 'export async function loadWelcomeProgress() { await loadAnalytics();'),
  },
  {
    name: 'THE BUG: Language Lab "Not Set" reported as a real level',
    service: (s) =>
      s.replace(".filter(([, level]) => level && level !== 'Not Set')", '.filter(([, level]) => !!level)'),
  },
  {
    name: 'the strip hardcoding a portal palette',
    src: (k, s) =>
      k === 'strip'
        ? s.replace('const styles = useStyles();', 'const styles = useStyles(); const p = PORTALS.school;')
        : s,
  },
];

console.log('Self-tests (each mutation must be caught):');
for (const m of MUTATIONS) {
  let caught;
  try {
    const svc = await loadService(m.service);
    caught = assertions(svc, loadSources(m.src, m.service)).length > 0;
  } catch {
    caught = true; // a mutation that will not even load is caught, loudly
  }
  if (caught) ok(m.name);
  else fail(`NOT CAUGHT: ${m.name} — the corresponding assertion is vacuous`);
}

console.log('\nStudent progress bars:');
{
  const svc = await loadService();
  const problems = assertions(svc, loadSources());
  if (problems.length === 0) {
    ok('the bars live on the dashboard and load in their own wave — they never gate the paint');
    ok('a failed section is omitted, never drawn as 0%');
    ok('no placeholder numbers: Coding Pro is live-only, Language Lab stays levels, no readinessIndex');
    ok('5 guarded calls, not 10 — and never /api/psychometrics/results');
    ok('the strip renders only the rows it is given, clamped, with an empty state');
  } else problems.forEach(fail);
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL — ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
