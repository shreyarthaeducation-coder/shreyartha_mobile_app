// Student batch, 9 Oct 2026: the phone's back button goes up one level, answers survive a dead
// battery or a lost connection, psychometric tests show their two attempts, mock tests open one
// after another, and nobody is offered the principal to evaluate.
//
// Runs the pure pieces for real (draft keys, attempts used) and reads the wiring of the rest.
// Every assertion is mutation-tested before a pass counts.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');

let failures = 0;
const fail = (m) => {
  failures += 1;
  console.error(`  ✗ ${m}`);
};
const ok = (m) => console.log(`  ✓ ${m}`);
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

const FILES = {
  hook: 'hooks/useDrillBack.js',
  skills: 'components/student/SkillsEdgeScreen.js',
  exam: 'components/student/academiciq/CompetitiveExamScreen.js',
  coding: 'components/student/CodingProScreen.js',
  shreya: 'components/student/languagepro/LearnWithShreya.js',
  psy: 'components/student/PsychometricScreen.js',
  psyService: 'services/student/psychometricService.js',
  runner: 'components/student/testrunner/ExamRunner.js',
  drafts: 'utils/answerDrafts.js',
  evaluation: 'services/admin/evaluationService.js',
  summaryCard: 'components/student/psychometric/PsychometricSummary.js',
  pkg: 'package.json',
};

function loadSources(mutate) {
  const out = {};
  for (const [k, rel] of Object.entries(FILES)) {
    const src = read(path.join(APP, rel));
    out[k] = mutate ? mutate(k, src) : src;
  }
  return out;
}

/** One exported function, cut out and evaluated on its own. */
function fn(src, signature, prelude = '') {
  const start = src.indexOf(`export function ${signature}`);
  if (start < 0) throw new Error(`${signature} not found`);
  const end = src.indexOf('\n}\n', start);
  // eslint-disable-next-line no-new-func
  return new Function(`${prelude}\nreturn ${src.slice(start, end + 2).replace('export function', 'function')}`)();
}

async function assertions(s) {
  const problems = [];
  const check = (name, test) => {
    try {
      if (!test()) problems.push(name);
    } catch (e) {
      problems.push(`${name} (threw: ${e.message})`);
    }
  };

  // ── 1. The phone's back button ──
  check('the hook listens to the hardware back button only while the screen is focused',
    () => s.hook.includes("BackHandler.addEventListener('hardwareBackPress'") && s.hook.includes('useFocusEffect(')
      && s.hook.includes('return () => sub.remove();'));
  check('at the top level it lets the navigator close the screen',
    () => s.hook.includes('if (depth <= 0) return false;'));
  check('below it, it goes up one level and keeps the screen open',
    () => /stepBack\(\);\s*return true;/.test(s.hook));
  check('Skills Edge counts certificate, module, objective, topic and skill',
    () => s.skills.includes('useDrillBack([certPanel, module, objective, topic, skill].filter(Boolean).length, back);'));
  check('Competitive Exam counts an open paper too, and closes it first',
    () => s.exam.includes('useDrillBack([activePaper, adaptiveOpen, topic, subExam].filter(Boolean).length, () => {')
      && /if \(activePaper\) setActivePaper\(null\);\s*else back\(\);/.test(s.exam));
  check('Coding Pro counts project, topic and curriculum',
    () => s.coding.includes('useDrillBack([projectPanel, topic, curriculum].filter(Boolean).length, back);'));
  check('Learn with Shreya counts chapter, day and level',
    () => s.shreya.includes("useDrillBack(view === 'chapter' ? 3 : view === 'level' ? (activeDayId ? 2 : 1) : 0, back);"));
  check('Psychometric counts report and test',
    () => s.psy.includes('useDrillBack([results, topic].filter(Boolean).length, back);'));

  // ── 2. Answers survive ──
  check('drafts are keyed by student and by the set of questions, in any order', () => {
    const draftKey = fn(s.drafts, 'draftKey(', (s.drafts.match(/const PREFIX = [^;]+;/) || [''])[0]);
    const a = draftKey([3, 1, 2], 'meera@x');
    return a === draftKey([1, 2, 3], 'meera@x') && a !== draftKey([1, 2, 3], 'ravi@x')
      && a !== draftKey([1, 2], 'meera@x') && draftKey([], 'meera@x') === null && draftKey([1], null) === null;
  });
  check('an old draft is dropped', () => /MAX_AGE_MS = 14 \* 24 \* 60 \* 60 \* 1000/.test(s.drafts)
    && s.drafts.includes('now - (draft.savedAt || 0) > MAX_AGE_MS'));
  check('the runner puts kept answers back one onAnswer at a time',
    () => s.runner.includes('const [[id, value], ...rest] = restoreQueue;') && s.runner.includes('if (answers[id] !== value) onAnswer?.(id, value);'));
  check('only answers that still fit the paper are put back',
    () => s.runner.includes("const option = q && (q.options || []).find((o) => String(o.key) === String(value));")
      && s.runner.includes('if (option && answers[q.id] == null) queue.push([q.id, option.key]);'));
  check('every answer is kept as it is given, and dropped once submitted',
    () => s.runner.includes('if (submitted) clearDraft(key);') && s.runner.includes('else saveDraft(key, answers, current);'));
  check('a Submit tapped offline waits and is sent on reconnect',
    () => s.runner.includes("online ? onSubmit : () => setPendingSubmit(true)")
      && /if \(online && pendingSubmit && !submitted\) \{\s*setPendingSubmit\(false\);\s*onSubmit\?\.\(\);/.test(s.runner));
  check('the student is told they are offline', () => s.runner.includes('You are offline. Your answers are being kept on this phone'));
  check('online state comes from expo-network, which is a dependency',
    () => s.runner.includes("import { useNetworkState } from 'expo-network';") && /"expo-network":/.test(s.pkg));

  // ── 3. Psychometric attempts ──
  check('attempts used: the server count, else one for a completed test', () => {
    const used = fn(s.psyService, 'attemptsUsed(');
    const progress = { attempts: { 5: 2 }, completed: new Set(['5', '7']) };
    return used(progress, 5) === 2 && used(progress, 7) === 1 && used(progress, 9) === 0;
  });
  check('progress reads attempts and the limit from the server',
    () => s.psyService.includes('attempts: res?.attempts && typeof res.attempts') && s.psyService.includes('max: res?.maxAttempts || MAX_PSYCHOMETRIC_ATTEMPTS'));
  check('the limit is two', () => s.psyService.includes('export const MAX_PSYCHOMETRIC_ATTEMPTS = 2;'));
  check('Retake is offered only while an attempt is left',
    () => s.psy.includes('{usedAt(topic?.id) < attempts.max ? (') && s.psy.includes('Both attempts used.'));
  check('a refused third attempt is said plainly', () => s.psy.includes('if (e?.status === 409) {'));
  check('the test list shows attempts used', () => s.psy.includes('Completed · attempt {usedAt(t.id)} of {attempts.max}'));
  check('My Analytics names the tests taken', () => s.summaryCard.includes("Tests taken: {data.testNames.join(', ')}"));

  // ── 4. Mock tests in order ──
  check('a locked paper says why instead of opening',
    () => /paper\.locked\s*\?\s*showToast\(paper\.lockReason/.test(s.exam) && s.exam.includes(': setActivePaper(paper)'));
  check('the list is refreshed after an attempt', () => s.exam.includes('if (subExam?.id) fetchMockTestPapers(subExam.id).then(setPapers)'));
  check('each card shows attempts and best score', () => s.exam.includes("{paper.attempts} attempt{paper.attempts === 1 ? '' : 's'} · best"));

  // ── 5. Nobody evaluates the principal ──
  check('the principal is not offered for evaluation',
    () => s.evaluation.includes("const hidden = ['ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL'];"));

  return problems;
}

const swap = (key, from, to) => (k, src) => (k === key ? src.replace(from, to) : src);
const MUTATIONS = [
  { name: 'back always swallowed', src: swap('hook', 'if (depth <= 0) return false;', '') },
  { name: 'back never steps', src: swap('hook', 'stepBack();\n        return true;', 'return true;') },
  { name: 'hook stays after the screen loses focus', src: swap('hook', 'return () => sub.remove();', 'return undefined;') },
  { name: 'Skills Edge forgets the module level', src: swap('skills', '[certPanel, module, objective, topic, skill]', '[certPanel, objective, topic, skill]') },
  { name: 'Skills Edge hook removed', src: swap('skills', 'useDrillBack([certPanel, module, objective, topic, skill].filter(Boolean).length, back);', '') },
  { name: 'open paper not counted', src: swap('exam', '[activePaper, adaptiveOpen, topic, subExam]', '[adaptiveOpen, topic, subExam]') },
  { name: 'Coding Pro hook removed', src: swap('coding', 'useDrillBack([projectPanel, topic, curriculum].filter(Boolean).length, back);', '') },
  { name: 'Learn with Shreya day ignored', src: swap('shreya', "(activeDayId ? 2 : 1)", '1') },
  { name: 'Psychometric hook removed', src: swap('psy', 'useDrillBack([results, topic].filter(Boolean).length, back);', '') },
  { name: 'drafts shared between students', src: swap('drafts', '${PREFIX}${user}:${scope}:', '${PREFIX}:${scope}:') },
  { name: 'drafts depend on question order', src: swap('drafts', '.map(String).sort();', '.map(String);') },
  { name: 'old drafts kept forever', src: swap('drafts', 'now - (draft.savedAt || 0) > MAX_AGE_MS', 'false') },
  { name: 'restore overwrites a newer answer', src: swap('runner', 'if (option && answers[q.id] == null) queue.push', 'if (option) queue.push') },
  { name: 'restore keeps a vanished option', src: swap('runner', 'if (option && answers[q.id] == null) queue.push([q.id, option.key]);', 'if (q) queue.push([q.id, value]);') },
  { name: 'draft kept after submit', src: swap('runner', 'if (submitted) clearDraft(key);', 'if (submitted) saveDraft(key, answers, current);') },
  { name: 'offline submit sent at once', src: swap('runner', "online ? onSubmit : () => setPendingSubmit(true)", 'onSubmit') },
  { name: 'pending submit never sent', src: swap('runner', '      setPendingSubmit(false);\n      onSubmit?.();', '      setPendingSubmit(false);') },
  { name: 'offline notice removed', src: swap('runner', 'You are offline. Your answers are being kept on this phone', 'Saving') },
  { name: 'expo-network dependency missing', src: swap('pkg', '"expo-network":', '"expo-netwrk":') },
  { name: 'attempts ignore the server count', src: swap('psyService', 'return progress.attempts[id] || (progress.completed.has(id) ? 1 : 0);', 'return progress.completed.has(id) ? 1 : 0;') },
  { name: 'limit raised to three', src: swap('psyService', 'export const MAX_PSYCHOMETRIC_ATTEMPTS = 2;', 'export const MAX_PSYCHOMETRIC_ATTEMPTS = 3;') },
  { name: 'Retake always offered', src: swap('psy', '{usedAt(topic?.id) < attempts.max ? (', '{true ? (') },
  { name: '409 shown as a generic failure', src: swap('psy', 'if (e?.status === 409) {', 'if (false) {') },
  { name: 'test names dropped from analytics', src: swap('summaryCard', "Tests taken: {data.testNames.join(', ')}", 'Tests taken') },
  { name: 'locked paper opens', src: swap('exam', 'paper.locked\n                  ? showToast(paper.lockReason', 'false\n                  ? showToast(paper.lockReason') },
  { name: 'list not refreshed after an attempt', src: swap('exam', 'if (subExam?.id) fetchMockTestPapers(subExam.id).then(setPapers)', 'if (false) fetchMockTestPapers(subExam.id).then(setPapers)') },
  { name: 'principal offered again', src: swap('evaluation', "const hidden = ['ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL'];", "const hidden = ['ADMIN', 'SCHOOL_ADMIN'];") },
];

console.log('Self-tests (each mutation must be caught):');
const pristine = loadSources();
for (const m of MUTATIONS) {
  const mutated = loadSources(m.src);
  const changed = Object.keys(mutated).some((k) => mutated[k] !== pristine[k]);
  if (!changed) {
    fail(`INERT: ${m.name} — its anchor no longer matches anything`);
    continue;
  }
  const problems = await assertions(mutated);
  if (problems.length > 0) ok(m.name);
  else fail(`NOT CAUGHT: ${m.name}`);
}

console.log('\nStudent batch (9 Oct 2026):');
const problems = await assertions(pristine);
if (problems.length === 0) ok('back button, kept answers, psychometric attempts, mock order, principal');
else problems.forEach(fail);

console.log(failures === 0 ? `\ncheckstudentbatch PASSED: ${MUTATIONS.length} mutations all caught.` : `\nFAIL — ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
