// The psychometric summary on My Analytics.
//
// The screen asks GET /api/psychometrics/results with no topic. Until Oct 2026 the server refused
// that call, so the card never appeared for anyone. The server now answers with every test taken
// (answers, not scores) and the summary is scored on the device.
//
// This RUNS the scoring engine and the summary builder on real inputs, and reads the wiring of the
// card and the service. Every assertion is mutation-tested before a pass counts.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const CONTROLLER = path.resolve(APP, '..', 'backendmain', 'src', 'main', 'java', 'com', 'shreyartha', 'backend',
  'psychometric', 'controller', 'PsychometricPublicController.java');

let failures = 0;
const fail = (m) => {
  failures += 1;
  console.error(`  ✗ ${m}`);
};
const ok = (m) => console.log(`  ✓ ${m}`);
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

const FILES = {
  scoring: 'constants/psychometricScoring.js',
  summary: 'constants/psychometricSummary.js',
  card: 'components/student/psychometric/PsychometricSummary.js',
  service: 'services/student/analyticsService.js',
};

function loadSources(mutate) {
  const out = {};
  for (const [k, rel] of Object.entries(FILES)) {
    const src = read(path.join(APP, rel));
    out[k] = mutate ? mutate(k, src) : src;
  }
  const ctl = read(CONTROLLER);
  out.controller = mutate ? mutate('controller', ctl) : ctl;
  return out;
}

/** The builder, evaluated for real beside the scoring engine it imports. */
async function loadBuilder(sources) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'psysum-'));
  fs.writeFileSync(path.join(dir, 'psychometricScoring.mjs'), sources.scoring);
  const file = path.join(dir, 'psychometricSummary.mjs');
  fs.writeFileSync(file, sources.summary.replace("from './psychometricScoring'", "from './psychometricScoring.mjs'"));
  return import(pathToFileURL(file).href + `?t=${Math.random()}`);
}

/** `hasPsychometricResults`, cut out of the service and evaluated on its own. */
function loadHasResults(service) {
  const start = service.indexOf('export function hasPsychometricResults(results) {');
  if (start < 0) throw new Error('hasPsychometricResults not found');
  const end = service.indexOf('\n}\n', start);
  // eslint-disable-next-line no-new-func
  return new Function(`${service.slice(start, end + 2).replace('export function', 'return function')}`)();
}

const q = (id, skillsMeasured, bloomTaxonomy) => ({ id, questionText: `Q${id}`, questionOrder: id, skillsMeasured, bloomTaxonomy });
const a = (questionId, answer) => ({ questionId, answer });
const THREE_C = {
  topicName: 'The 3C Personality Blueprint',
  questions: [q(1, 'Self-awareness'), q(2, 'Growth mindset'), q(3, 'Critical thinking')],
  answers: [a(1, 'Yes'), a(2, 'No'), a(3, 'Yes')],
  answeredAt: '2026-10-05T10:00:00',
};
const LPM = {
  topicName: 'Learning-Productivity Matrix (LPM)',
  questions: [q(21, 'Critical thinking'), q(22, 'Creativity')],
  answers: [a(21, 'Maybe'), a(22, 'Yes')],
  answeredAt: '2026-10-06T18:48:56',
};
const STREAM = {
  topicName: 'Stream Aptitude Evaluator',
  questions: [q(41, 'x', 'Science'), q(42, 'x', 'Commerce'), q(43, 'x', 'Arts')],
  answers: [a(41, 'Maybe'), a(42, 'Yes'), a(43, 'No')],
  answeredAt: '2026-10-04T09:00:00',
};
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);

async function assertions(src) {
  const problems = [];
  const check = (name, fn) => {
    try {
      if (!fn()) problems.push(name);
    } catch (e) {
      problems.push(`${name} (threw: ${e.message})`);
    }
  };

  let build;
  try {
    ({ buildPsychometricSummary: build } = await loadBuilder(src));
  } catch (e) {
    return [`the summary builder does not evaluate: ${e.message}`];
  }

  check('nothing answered is no summary at all, never a sheet of zeros',
    () => build(undefined) === null && build([]) === null && build([{ ...THREE_C, answers: [] }]) === null);
  check('each test is scored by its own engine', () => {
    const s = build([THREE_C, LPM]);
    return s.personalityBlueprint.selfAwareness === 100 && s.personalityBlueprint.growthMindset === 0
      && s.learningProductivityMatrix.criticalThinking === 50 && s.learningProductivityMatrix.creativity === 100;
  });
  check('the summary says which tests were taken', () => {
    const s = build([THREE_C, LPM]);
    return same(s.taken, { '3c': true, lpm: true }) && s.testsTaken === 2;
  });
  check('a test not taken stays empty even where its skills overlap one that was', () => {
    const s = build([THREE_C]);
    return s.learningProductivityMatrix === null && s.skillProficiency === null && s.careerInterestMapping === null
      && s.primaryStream === null && s.taken.lpm === undefined;
  });
  check('the 3C slice comes only from the 3C test', () => build([LPM]).personalityBlueprint === null);
  check('a test with only blank answers was not taken', () => build([{ ...LPM, answers: [a(21, ''), a(22, null)] }]) === null);
  check('the stream scored highest is named', () => {
    const s = build([STREAM]);
    return same(s.careerInterestMapping, { science: 50, commerce: 100, humanities: 0, skillBased: 0 }) && s.primaryStream === 'commerce';
  });
  check('no stream is named when every stream is zero', () => {
    const s = build([{ ...STREAM, answers: [a(41, 'No'), a(42, 'No'), a(43, 'No')] }]);
    return s.taken.streamAptitude === true && s.primaryStream === null;
  });
  check('readiness is averaged over the tests taken only', () => {
    const one = build([LPM]);
    const both = build([LPM, { ...THREE_C, answers: [a(1, 'No'), a(2, 'No'), a(3, 'No')] }]);
    return one.overallReadiness > 0 && both.overallReadiness === Math.round(one.overallReadiness / 2);
  });
  check('No to everything is a real 0% on a taken test', () => {
    const s = build([{ ...LPM, answers: [a(21, 'No'), a(22, 'No')] }]);
    return s.taken.lpm === true && s.overallReadiness === 0;
  });
  check('the summary is dated by the latest answer', () => {
    const s = build([THREE_C, LPM, STREAM]);
    return s.assessmentDate === new Date('2026-10-06T18:48:56').toLocaleDateString();
  });
  check('blank answers are ignored', () => {
    const s = build([{ ...LPM, answers: [a(21, ''), a(22, 'Yes'), null] }]);
    return s.learningProductivityMatrix.creativity === 100 && s.learningProductivityMatrix.criticalThinking === 0;
  });

  // ── The service: does the card show at all? ──
  check('the screen asks for every test at once (no topic)', () => src.service.includes("psychResults: studentApi.get('/api/psychometrics/results'),"));
  check('the card appears for a student with answers, in the shape the server sends', () => {
    const has = loadHasResults(src.service);
    return has({ topics: [{ answers: [a(1, 'Yes')] }], hasResults: true }) === true;
  });
  check('…and not for a student with none', () => {
    const has = loadHasResults(src.service);
    return has({ topics: [], hasResults: false }) === false && has({ topics: [{ answers: [] }] }) === false && has(null) === false;
  });
  check('the older scored shapes still count', () => {
    const has = loadHasResults(src.service);
    return has({ results: {} }) === true && has({ overallReadiness: 0 }) === true && has({}) === false;
  });

  // ── The card ──
  check('the card scores the server answer with the builder',
    () => src.card.includes("import { buildPsychometricSummary } from '../../../constants/psychometricSummary';")
      && src.card.includes('if (Array.isArray(payload.topics)) return buildPsychometricSummary(payload.topics);'));
  check('categories of a test not taken are not listed as development areas',
    () => src.card.includes('if (!has(SLICE_TEST[slice])) return;')
      && src.card.includes("personalityBlueprint: '3c',") && src.card.includes("learningProductivityMatrix: 'lpm',")
      && src.card.includes("skillProficiency: 'skillCompass',"));
  check('no stream is claimed before the stream test', () => src.card.includes("title: 'Stream not decided yet',")
    && src.card.includes('Take the “Stream Aptitude Evaluator” to see which stream fits you best.'));

  // ── The server side of the contract ──
  check('the server answers without a topic', () => src.controller.includes('@RequestParam(required = false) Long topicId')
    && src.controller.includes('if (topicId == null) return ResponseEntity.ok(allResults(student));'));
  check('…with what the scoring engine reads', () => ['body.put("topics", topics);', 'topic.put("topicName",', 'topic.put("questions", questions);',
    'topic.put("answers", answers);', 'topic.put("answeredAt",', 'item.put("skillsMeasured", q.getSkillsMeasured());', 'item.put("bloomTaxonomy", q.getBloomTaxonomy());']
    .every((line) => src.controller.includes(line)));

  return problems;
}

const swap = (key, from, to) => (k, s) => (k === key ? s.replace(from, to) : s);
const MUTATIONS = [
  { name: 'an empty test still makes a summary', src: swap('summary', 'if (Object.keys(given).length === 0) return;', '') },
  { name: 'no summary guard at all', src: swap('summary', 'if (types.length === 0) return null;', '') },
  { name: '3C slice taken from any test', src: swap('summary', "byType['3c']?.personalityBlueprint || null", 'Object.values(byType)[0].personalityBlueprint') },
  { name: 'LPM slice taken from the 3C test', src: swap('summary', 'byType.lpm?.learningProductivityMatrix || null', "(byType.lpm || byType['3c'])?.learningProductivityMatrix || null") },
  { name: 'taken flags dropped', src: swap('summary', '    taken[type] = true;\n', '') },
  { name: 'tests counted wrongly', src: swap('summary', 'testsTaken: types.length,', 'testsTaken: 6,') },
  { name: 'stream defaults to science', src: swap('summary', "      : null;\n\n  const date", "      : 'science';\n\n  const date") },
  { name: 'stream named when all zero', src: swap('summary', 'streams && streamTotal > 0', 'streams') },
  { name: 'lowest stream named', src: swap('summary', 'streams[key] > streams[best]', 'streams[key] < streams[best]') },
  { name: 'readiness averaged over six tests', src: swap('summary', ') / types.length,\n    ),', ') / 6,\n    ),') },
  { name: 'date taken from the first test', src: swap('summary', '(!latest || topic.answeredAt > latest)', '!latest') },
  { name: 'blank answers scored', src: swap('summary', 'a.questionId != null && a.answer) given', 'a.questionId != null) given') },
  { name: 'answers keyed by position', src: swap('summary', 'given[a.questionId] = a.answer;', 'given[Object.keys(given).length] = a.answer;') },
  { name: 'Maybe scored as nothing', src: swap('scoring', "    case 'Maybe':\n      return 1;", "    case 'Maybe':\n      return 0;") },
  { name: 'the screen stops asking', src: swap('service', "    psychResults: studentApi.get('/api/psychometrics/results'),\n", '') },
  { name: 'the card hidden for the server shape', src: swap('service', 'if (Array.isArray(results.topics)) return results.topics.some((t) => (t.answers || []).length > 0);', '') },
  { name: 'the card shown for a student with no answers', src: swap('service', 'results.topics.some((t) => (t.answers || []).length > 0)', 'true') },
  { name: 'older shapes dropped', src: swap('service', 'return !!(results.results || results.overallReadiness !== undefined);', 'return false;') },
  { name: 'the card ignores the server shape', src: swap('card', '  if (Array.isArray(payload.topics)) return buildPsychometricSummary(payload.topics);\n', '') },
  { name: 'untaken tests listed as development areas', src: swap('card', '    if (!has(SLICE_TEST[slice])) return;\n', '') },
  { name: 'Science claimed before the stream test', src: swap('card', "title: 'Stream not decided yet',", "title: 'Science – Primary Fit',") },
  { name: 'the server requires a topic again', src: swap('controller', '@RequestParam(required = false) Long topicId', '@RequestParam Long topicId') },
  { name: 'the server skips the all-tests answer', src: swap('controller', '            if (topicId == null) return ResponseEntity.ok(allResults(student));\n', '') },
  { name: 'the server omits the skills the engine scores by', src: swap('controller', '                item.put("skillsMeasured", q.getSkillsMeasured());\n                item.put("bloomTaxonomy", q.getBloomTaxonomy());\n                questions.add(item);', '                questions.add(item);') },
  { name: 'the server omits when the test was answered', src: swap('controller', '            topic.put("answeredAt", answeredAt == null ? null : answeredAt.toString());\n', '') },
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

console.log('\nPsychometric summary on My Analytics:');
const problems = await assertions(pristine);
if (problems.length === 0) ok('built from the student’s real answers; tests not taken are not scored');
else problems.forEach(fail);

console.log(failures === 0 ? `\ncheckpsychsummary PASSED: ${MUTATIONS.length} mutations all caught.` : `\nFAIL — ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
