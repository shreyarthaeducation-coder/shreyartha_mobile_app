// Batch 1 checker — the three missed wirings, Practice Zone's chart, the exam gate, the tutorial.
//
//   node scripts/checkbatch1.mjs
//
// WHY THIS EXISTS. Batch 1 exists because a code audit found three things my own progress reports
// had wrong. Each of the items below fails in a way that reads as "fine":
//
//   * A Bloom's chart derived from the DATA rather than from the difficulty grows or loses bars
//     the website never shows, and looks entirely plausible either way.
//   * An inverted `entranceExamIds` check locks a student out of the exam they DID choose —
//     the empty-array branch means "all allowed", and reading it as "none allowed" is one `!` away.
//   * The Sound Studio tutorial must persist "once EVER" (AsyncStorage), using the WEBSITE's key so
//     a student who already saw it there is not shown it again. Both halves are one-line changes and
//     getting either wrong is invisible until a student complains.
//
// This item used to have a second half: the welcome interstitial, which had to persist "once per
// SESSION" (module memory) because its progress bars change. That screen was RETIRED by the
// dashboard redesign — the dashboard now carries its identity block and its bars permanently, which
// is strictly better than once a session — so `components/student/welcome/` no longer exists and
// those assertions were removed rather than left pointing at a deleted file. The contrast they drew
// is preserved in the comment at the top of SoundStudioTutorial.js.
//
// Exit code 0 = pass.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');

const SRC = {
  practiceConst: 'constants/practiceZone.js',
  practice: 'components/student/academiciq/PracticeZoneScreen.js',
  exam: 'components/student/academiciq/CompetitiveExamScreen.js',
  analytics: 'components/student/analytics/AnalyticsBody.js',
  subjectCareer: 'components/student/SubjectCareerScreen.js',
  psychometric: 'components/student/PsychometricScreen.js',
  tutorial: 'components/student/languagepro/SoundStudioTutorial.js',
  soundStudio: 'components/student/languagepro/SoundStudio.js',
};

let failures = 0;
const fail = (m) => {
  failures += 1;
  console.error(`  ✗ ${m}`);
};
const ok = (m) => console.log(`  ✓ ${m}`);

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

/**
 * Comments stripped. Load-bearing: several of these files DOCUMENT the trap they avoid, naming
 * `readinessIndex`, `AsyncStorage` and the data-derived filter in prose.
 */
const codeOnly = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function loadSources(mutate, mutateConst) {
  const out = {};
  for (const [k, rel] of Object.entries(SRC)) {
    let text = read(path.join(APP, rel));
    if (mutate) text = mutate(k, text);
    if (mutateConst && k === 'practiceConst') text = mutateConst(text);
    out[k] = text;
  }
  return out;
}

/** `practiceZone.js` is import-free, so it evaluates directly. */
async function loadConst(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'b1-'));
  let src = read(path.join(APP, SRC.practiceConst));
  if (mutate) src = mutate(src);
  const file = path.join(dir, 'practiceZone.mjs');
  fs.writeFileSync(file, src);
  return import(`${pathToFileURL(file).href}?t=${Math.random()}`);
}

/**
 * The exam gate, lifted out of the screen and evaluated.
 *
 * Reading it as text could only prove the shape; the empty-array branch is a BEHAVIOUR and has to
 * be run. The function is small and self-contained, so it is extracted by pattern and evaluated —
 * if the extraction ever fails, that is itself reported rather than silently passing.
 */
async function loadExamGate(src) {
  const body = src.match(/const isEntranceExamAllowed = \(examId\) => \{[\s\S]*?\n  \};/);
  if (!body) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'b1g-'));
  const file = path.join(dir, 'gate.mjs');
  fs.writeFileSync(
    file,
    `export function make(myExam) {\n  ${body[0].replace('const isEntranceExamAllowed =', 'const isEntranceExamAllowed =')}\n  return isEntranceExamAllowed;\n}`,
  );
  return import(`${pathToFileURL(file).href}?t=${Math.random()}`);
}

async function assertions(pz, src) {
  const out = [];
  const bad = (m) => out.push(m);

  /* ── 1. PRACTICE ZONE: THE CHART IS FIXED PER DIFFICULTY ─────────────────── */

  const LB = pz.LEVEL_BLOOMS;
  if (!LB) bad('LEVEL_BLOOMS is gone — the chart has nothing to key off');
  else {
    const expect = {
      basic: ['Remembering', 'Understanding'],
      intermediate: ['Applying', 'Analyzing'],
      advanced: ['Evaluating', 'Creating'],
    };
    for (const [level, levels] of Object.entries(expect)) {
      if (JSON.stringify(LB[level]) !== JSON.stringify(levels)) {
        bad(`LEVEL_BLOOMS.${level} is ${JSON.stringify(LB[level])}, expected ${JSON.stringify(levels)}`);
      }
    }
    // Each difficulty reports EXACTLY two levels, and no level is reported by two difficulties.
    const seen = new Set();
    for (const [level, levels] of Object.entries(LB)) {
      if (levels.length !== 2) bad(`LEVEL_BLOOMS.${level} has ${levels.length} levels, expected 2`);
      levels.forEach((l) => {
        if (seen.has(l)) bad(`Bloom's level "${l}" is claimed by two difficulties`);
        seen.add(l);
      });
    }
    if (seen.size !== 6) bad(`the three difficulties cover ${seen.size} Bloom's levels, expected all 6`);
  }

  const practice = codeOnly(src.practice);
  // THE BUG: deriving the chart's levels from the data rather than the difficulty.
  if (/BLOOMS_LEVELS\.filter\(/.test(practice)) {
    bad('the Bloom\'s levels are still filtered from the DATA — that is a different chart from the web\'s');
  }
  if (!/LEVEL_BLOOMS\[level\]/.test(practice)) {
    bad('the chart does not read LEVEL_BLOOMS[level]');
  }
  if (!/<GroupedBars[\s/>]/.test(practice)) bad('Practice Zone has no Bloom\'s bar chart');
  if (!/masteryStatus\(/.test(practice)) bad('the mastery badge is missing');
  // Practice Zone's remark table must stay its own — 6 of its 24 strings differ from Skills Edge's.
  if (!/practiceBloomsRemark\(/.test(practice)) {
    bad('Practice Zone no longer uses its OWN Bloom\'s remarks — merging the tables silently rewords six');
  }
  if (/bloomsRemark\(/.test(practice)) {
    bad("Practice Zone is using the shared bloomsRemark — that is Skills Edge's table, not its own");
  }

  /* ── 2. THE COMPETITIVE EXAM GATE ────────────────────────────────────────── */

  const exam = codeOnly(src.exam);
  if (!/const isEntranceExamAllowed/.test(exam)) bad('the exam-choice gate (gate 1) is missing');
  if (!/setMyExam\(/.test(exam)) bad('the profile exam response is not kept — the gate has nothing to read');
  if (!/hasExam/.test(exam)) bad('the no-exam-chosen banner is missing');

  const gateMod = await loadExamGate(src.exam);
  if (!gateMod) {
    bad('could not extract isEntranceExamAllowed for evaluation — check this assertion');
  } else {
    const allowed = (myExam) => gateMod.make(myExam);
    // THE INVERSION: an empty list means ALL are allowed, not none.
    if (allowed({ entranceExamIds: [] })(7) !== true) {
      bad('an EMPTY entranceExamIds locks every exam — the web reads it as "all allowed", and inverting it locks a student out of the exam they chose');
    }
    if (allowed(null)(7) !== true) bad('a failed profile read locks everything — it must fall open');
    if (allowed({ entranceExamIds: [7, 9] })(7) !== true) bad('a selected entrance exam is locked');
    if (allowed({ entranceExamIds: [7, 9] })(8) !== false) bad('an unselected entrance exam is open');
    // Ids come from a CSV column, so string/number must compare equal.
    if (allowed({ entranceExamIds: ['7'] })(7) !== true) {
      bad('a string id does not match a numeric one — the profile stores these as CSV');
    }
  }

  /* ── 3. THE READINESS INDEX IS GONE ──────────────────────────────────────── */

  const analytics = codeOnly(src.analytics);
  if (/readinessIndex|Readiness Index/.test(analytics)) {
    bad('the Readiness Index is back — it is hardcoded High/Medium/High/High for every student');
  }

  /* ── 4. THE TWO MISSED WIRINGS ───────────────────────────────────────────── */

  if (!/<AiActionBar[\s/>]/.test(codeOnly(src.subjectCareer))) {
    bad('Subject & Career still has no Jyora / Shreya Speak');
  }
  if (!/<ShreyaSpeakButton[\s/>]/.test(codeOnly(src.psychometric))) {
    bad('Psychometric questions still have no Shreya Speak');
  }
  // Psychometric has no right answer, so it must NOT get the question generator.
  if (/<MoreLikeThisButton[\s/>]/.test(codeOnly(src.psychometric))) {
    bad('Psychometric has a question generator — its items have no correct answer to vary');
  }

  /* ── 5. THE TWO OPPOSITE PERSISTENCE RULES ───────────────────────────────── */

  const tut = codeOnly(src.tutorial);
  if (!/AsyncStorage/.test(tut)) {
    bad('the Sound Studio tutorial does not persist — the web gates it on localStorage, i.e. once EVER');
  }
  if (!/soundStudioTutorialSeen/.test(tut)) {
    bad("the tutorial does not use the web's key, so a student who saw it on the site sees it again");
  }
  if (!/useSoundStudioTutorial/.test(codeOnly(src.soundStudio))) {
    bad('Sound Studio does not mount the tutorial');
  }
  if (!/openTutorial/.test(codeOnly(src.soundStudio))) {
    bad('there is no way to re-open the tutorial from Sound Studio');
  }

  return out;
}

const MUTATIONS = [
  {
    name: 'THE BUG: the chart derived from the data again',
    src: (k, s) =>
      k === 'practice' ? s.replace('LEVEL_BLOOMS[level] || []', 'BLOOMS_LEVELS.filter((l) => score.blooms[l].total > 0)') : s,
  },
  {
    name: 'a difficulty reporting the wrong Bloom\'s levels',
    constMut: (s) => s.replace("basic: ['Remembering', 'Understanding'],", "basic: ['Remembering', 'Applying'],"),
  },
  {
    name: 'a difficulty reporting three levels',
    constMut: (s) => s.replace("intermediate: ['Applying', 'Analyzing'],", "intermediate: ['Applying', 'Analyzing', 'Creating'],"),
  },
  {
    name: 'LEVEL_BLOOMS removed entirely',
    constMut: (s) => s.replace('export const LEVEL_BLOOMS', 'const UNUSED_LEVEL_BLOOMS'),
  },
  {
    name: 'the Bloom\'s bar chart removed',
    src: (k, s) => (k === 'practice' ? s.replace('<GroupedBars', '<GroupedBarsGone') : s),
  },
  {
    name: 'the mastery badge removed',
    src: (k, s) => (k === 'practice' ? s.replaceAll('masteryStatus(', 'noBadge(') : s),
  },
  {
    name: "Practice Zone switched to Skills Edge's Bloom's remarks",
    src: (k, s) => (k === 'practice' ? s.replaceAll('practiceBloomsRemark(', 'bloomsRemark(') : s),
  },
  {
    name: 'THE INVERSION: an empty entranceExamIds locking everything',
    src: (k, s) =>
      k === 'exam'
        ? s.replace('if (!Array.isArray(ids) || ids.length === 0) return true;', 'if (!Array.isArray(ids)) return true;')
        : s,
  },
  {
    name: 'a failed profile read locking everything',
    src: (k, s) =>
      k === 'exam'
        ? s.replace('if (!Array.isArray(ids) || ids.length === 0) return true;', 'if (!ids) return false;')
        : s,
  },
  {
    name: 'ids compared without string coercion (CSV vs number)',
    src: (k, s) =>
      k === 'exam' ? s.replace('return ids.map(String).includes(String(examId));', 'return ids.includes(examId);') : s,
  },
  {
    name: 'the exam-choice gate removed',
    src: (k, s) => (k === 'exam' ? s.replace('const isEntranceExamAllowed', 'const unusedGate') : s),
  },
  {
    name: 'the profile exam response no longer kept',
    src: (k, s) => (k === 'exam' ? s.replace('setMyExam(mine);', '') : s),
  },
  {
    name: 'THE BUG: the Readiness Index restored',
    src: (k, s) =>
      k === 'analytics' ? s.replace('  return (\n    <>', '  const readiness = analytics?.readinessIndex;\n  return (\n    <>') : s,
  },
  {
    name: 'Subject & Career losing its action bar again',
    src: (k, s) => (k === 'subjectCareer' ? s.replace('<AiActionBar', '<AiActionBarGone') : s),
  },
  {
    name: 'Psychometric losing Shreya Speak again',
    src: (k, s) => (k === 'psychometric' ? s.replace('<ShreyaSpeakButton', '<ShreyaSpeakButtonGone') : s),
  },
  {
    name: 'a question generator added to Psychometric',
    src: (k, s) =>
      k === 'psychometric' ? s.replace('<ShreyaSpeakButton', '<MoreLikeThisButton />\n              <ShreyaSpeakButton') : s,
  },
  {
    name: 'THE SWAP: the tutorial made session-only',
    src: (k, s) => (k === 'tutorial' ? s.replaceAll('AsyncStorage', 'MemoryOnly') : s),
  },
  {
    name: 'the tutorial using a key the website does not share',
    src: (k, s) => (k === 'tutorial' ? s.replace("'soundStudioTutorialSeen'", "'ssTutorialSeen'") : s),
  },
  {
    name: 'Sound Studio no longer mounting the tutorial',
    src: (k, s) => (k === 'soundStudio' ? s.replaceAll('useSoundStudioTutorial', 'noTutorial') : s),
  },
];

console.log('Self-tests (each mutation must be caught):');
for (const m of MUTATIONS) {
  let caught;
  try {
    const pz = await loadConst(m.constMut);
    caught = (await assertions(pz, loadSources(m.src, m.constMut))).length > 0;
  } catch {
    caught = true;
  }
  if (caught) ok(m.name);
  else fail(`NOT CAUGHT: ${m.name} — the corresponding assertion is vacuous`);
}

console.log('\nBatch 1:');
{
  const pz = await loadConst();
  const problems = await assertions(pz, loadSources());
  if (problems.length === 0) {
    ok("Practice Zone charts the two Bloom's levels of the DIFFICULTY, with mastery badges");
    ok("Practice Zone keeps its OWN remark table, not Skills Edge's");
    ok('the exam-choice gate locks unselected entrance exams and falls OPEN on an empty list');
    ok('the hardcoded Readiness Index is gone');
    ok('Subject & Career has Jyora + Speak; Psychometric has Speak only');
    ok("the tutorial persists once EVER, on the website's own key");
  } else problems.forEach(fail);
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL — ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
