// Student welcome interstitial checker.
//
//   node scripts/checkwelcome.mjs
//
// WHY THIS EXISTS. This screen's failure modes are all *silently plausible* — it would look
// finished while being wrong:
//
//   * `AsyncStorage` instead of a memory flag turns "once per session" into "once ever", and the
//     student never sees their progress again. Nothing crashes.
//   * A section rendered at 0% because its request FAILED tells a student their work has vanished.
//     "You have completed none of this" and "we could not read your progress" are different claims.
//   * The analytics spine carries hardcoded placeholders — codingPro (AI 80 / Robotics 60 /
//     Coding 75) and readinessIndex — that are IDENTICAL for every student on the platform. A bar
//     fed from those looks like real progress and is not.
//   * Language Lab has no percentage anywhere in the API. Inventing one from the level names
//     (Beginner→33, Average→66…) would produce a number no server ever computed.
//   * A Get Started button rendered inside the loading branch re-creates the exact tap-gate the
//     original port removed.
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
  flag: 'components/student/welcome/sessionFlag.js',
  screen: 'components/student/WelcomeScreen.js',
  list: 'components/student/welcome/SectionProgressList.js',
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

async function loadFlag(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flag-'));
  let src = read(path.join(APP, SRC.flag));
  if (mutate) src = mutate(src);
  const file = path.join(dir, 'sessionFlag.mjs');
  fs.writeFileSync(file, src);
  return import(`${pathToFileURL(file).href}?t=${Math.random()}`);
}

/** A `settleAll` result for one key. */
const okPart = (data) => ({ data, error: null, forbidden: false });
const failedPart = (forbidden = false) => ({ data: null, error: 'Could not load.', forbidden });

function assertions(svc, flag, src) {
  const out = [];
  const bad = (m) => out.push(m);

  /* ── 1. THE SESSION FLAG IS MEMORY, NOT STORAGE ──────────────────────────── */

  const flagSrc = codeOnly(src.flag);
  if (/AsyncStorage|async-storage/.test(flagSrc)) {
    bad('the welcome flag uses AsyncStorage — that is "once EVER", and the student never sees their progress again');
  }
  if (!/^let shownThisSession/m.test(flagSrc)) {
    bad('the module-scope session flag is gone');
  }
  // Behaviour, not just shape.
  flag.resetWelcomeForTests();
  if (flag.hasShownWelcome() !== false) bad('a fresh session reports the welcome as already shown');
  flag.markWelcomeShown();
  if (flag.hasShownWelcome() !== true) bad('markWelcomeShown does not stick within a session');

  // StudentHome must mark it when it DECIDES to show, not when it is dismissed — otherwise a
  // pull-to-refresh while the interstitial is open queues a second one.
  const home = codeOnly(src.home);
  if (!/markWelcomeShown\(\);\s*\n\s*setShowWelcome\(true\)/.test(home)) {
    bad('StudentHome does not mark the session BEFORE showing — a refresh can re-trigger the interstitial');
  }
  if (!/me\s*&&\s*!hasShownWelcome\(\)/.test(home)) {
    bad('StudentHome shows the welcome without a profile — an interstitial with no name, class or graph is worse than the tiles');
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
  if (!/languageSkills/.test(codeOnly(src.screen))) {
    bad('the screen no longer renders Language Lab as levels');
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

  /* ── 5. GET STARTED IS NEVER BEHIND THE LOAD ─────────────────────────────── */

  const screen = codeOnly(src.screen);
  // The CTA must be a sibling of the ScrollView, not inside a loading branch. Assert on structure:
  // it must appear after the ScrollView closes, and no `loading ?` may guard it.
  const scrollEnd = screen.lastIndexOf('</ScrollView>');
  const ctaAt = screen.indexOf('accessibilityLabel="Get started"');
  if (scrollEnd < 0 || ctaAt < 0) {
    bad('could not locate the Get Started button relative to the ScrollView — check this assertion');
  } else if (ctaAt < scrollEnd) {
    bad('Get Started moved inside the scrolling body — it must stay pinned and always reachable');
  }
  if (/loading\s*\?[\s\S]{0,400}Get Started/.test(screen)) {
    bad('Get Started is rendered behind the loading state — that is the tap-gate the port removed');
  }
  // The screen must not await anything before painting: identity comes from the passed-in profile.
  if (!/profile\?\.profilePicture/.test(screen)) {
    bad('the interstitial no longer renders the photo from the profile the dashboard already has');
  }

  /* ── 6. PALETTE ──────────────────────────────────────────────────────────── */

  // These screens live inside PORTALS.student. A hardcoded portal reference would freeze them.
  for (const key of ['screen', 'list']) {
    if (/PORTALS\./.test(codeOnly(src[key]))) {
      bad(`${SRC[key]} reaches for PORTALS directly instead of usePalette()/makeStyles`);
    }
  }

  return out;
}

const MUTATIONS = [
  {
    name: 'THE BUG: the session flag moved to AsyncStorage ("once ever")',
    src: (k, s) =>
      k === 'flag'
        ? s.replace('let shownThisSession = false;', "import AsyncStorage from '@react-native-async-storage/async-storage';\nlet shownThisSession = false;")
        : s,
  },
  {
    name: 'the session flag not sticking',
    flag: (s) => s.replace('shownThisSession = true;', 'shownThisSession = false;'),
  },
  {
    name: 'the session marked on dismiss instead of on show (a refresh re-triggers it)',
    src: (k, s) =>
      k === 'home' ? s.replace('markWelcomeShown();\n      setShowWelcome(true);', 'setShowWelcome(true);') : s,
  },
  {
    name: 'the interstitial shown without a profile',
    src: (k, s) => (k === 'home' ? s.replace('if (me && !hasShownWelcome())', 'if (!hasShownWelcome())') : s),
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
    name: 'THE BUG: Get Started moved inside the scrolling body',
    src: (k, s) =>
      k === 'screen'
        ? s.replace('      </ScrollView>\n\n      <Pressable\n        onPress={() => onDismiss?.(null)}', '      <Pressable\n        onPress={() => onDismiss?.(null)}')
        : s,
  },
  {
    name: 'the photo no longer taken from the already-fetched profile',
    src: (k, s) => (k === 'screen' ? s.replace('photoUrl={profile?.profilePicture}', 'photoUrl={undefined}') : s),
  },
  {
    name: 'Language Lab section dropped from the screen',
    src: (k, s) => (k === 'screen' ? s.replaceAll('languageSkills', 'noSkills') : s),
  },
  {
    name: 'the list hardcoding a portal palette',
    src: (k, s) =>
      k === 'list' ? s.replace('const palette = usePalette();', 'const palette = PORTALS.school;') : s,
  },
];

console.log('Self-tests (each mutation must be caught):');
for (const m of MUTATIONS) {
  let caught;
  try {
    const [svc, flag] = await Promise.all([loadService(m.service), loadFlag(m.flag)]);
    caught = assertions(svc, flag, loadSources(m.src, m.service)).length > 0;
  } catch {
    caught = true; // a mutation that will not even load is caught, loudly
  }
  if (caught) ok(m.name);
  else fail(`NOT CAUGHT: ${m.name} — the corresponding assertion is vacuous`);
}

console.log('\nStudent welcome interstitial:');
{
  const [svc, flag] = await Promise.all([loadService(), loadFlag()]);
  const problems = assertions(svc, flag, loadSources());
  if (problems.length === 0) {
    ok('once per session, in memory — not "once ever" in AsyncStorage');
    ok('a failed section is omitted, never drawn as 0%');
    ok("no placeholder numbers: Coding Pro is live-only, Language Lab stays levels, no readinessIndex");
    ok('5 guarded calls, not 10 — and never /api/psychometrics/results');
    ok('Get Started is pinned and reachable before the graph resolves');
  } else problems.forEach(fail);
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL — ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
