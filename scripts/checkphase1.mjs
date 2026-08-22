// Phase 1 checker — the four confirmed student-panel bugs.
//
//   node scripts/checkphase1.mjs
//
// WHY THIS EXISTS. All four bugs were invisible to `expo export` AND to `checkscope.js`, because
// none of them is an unbound identifier or a syntax error. Each is a *wrong value* or a *wrong
// order*:
//
//   1. Practice Zone read `q.level || q.difficultyLevel`. The DTO field is `difficulty`. Neither
//      name exists, so every question fell through to the 'basic' default: the Basic tab showed the
//      entire bank and Intermediate/Advanced were permanently empty.
//   2. Universal Adaptive was driven with the OTHER engine's protocol — a `sessionState` blob it
//      does not model, and a 15-question client cap it does not use. The run ended early and
//      reported 0 correct, because the summary was built from a `sessionState` that never arrives.
//   3. Coding Pro applied the college-only `classes[0]` fallback to school students too, so a
//      Class 6 student silently got the Class 9 syllabus.
//   4. `useVoiceRecorder`'s "already recording" guard was per-hook-INSTANCE while expo-av's
//      constraint is per-PROCESS, and `stop()` cleared its ref BEFORE awaiting the unload.
//
// Where a claim can be checked against the backend rather than against another copy of the same
// assumption, it is: the DTO field names and the adaptive request shape are both extracted from
// Java. A checker that only reads the app cannot see that the app disagrees with the server.
//
// Exit code 0 = pass.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const JAVA = path.resolve(
  APP, '..', 'backendmain', 'src', 'main', 'java', 'com', 'shreyartha', 'backend',
);

const SRC = {
  practiceConst: 'constants/practiceZone.js',
  practiceScreen: 'components/student/academiciq/PracticeZoneScreen.js',
  hook: 'hooks/useAdaptiveSession.js',
  academicSvc: 'services/student/academicIqService.js',
  codingSvc: 'services/student/codingProService.js',
  codingScreen: 'components/student/CodingProScreen.js',
  recorder: 'hooks/useVoiceRecorder.js',
  reflection: 'components/student/academiciq/MyReflection.js',
  ceScreen: 'components/student/academiciq/CompetitiveExamScreen.js',
  runner: 'components/student/academiciq/AdaptiveRunner.js',
  reportBody: 'components/shared/AdaptiveReportBody.js',
  staffReport: 'components/staff/adaptive/AdaptiveReport.js',
  langSvc: 'services/student/languageProService.js',
  langLanding: 'components/student/LanguageProScreen.js',
  langResources: 'components/student/languagepro/LanguageProResources.js',
};

const JAVA_SRC = {
  practiceDto: path.join('practice', 'payload', 'PracticeQuestionResponse.java'),
  answerReq: path.join('universaladaptive', 'payload', 'UniversalAdaptiveAnswerRequest.java'),
  adaptiveQuestionDto: path.join(
    'universaladaptive', 'payload', 'UniversalAdaptiveQuestionResponse.java',
  ),
  personalizedDto: path.join('languagepro', 'payload', 'LanguageProPersonalizedResponse.java'),
};

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`  ✗ ${msg}`);
};
const ok = (msg) => console.log(`  ✓ ${msg}`);

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

/**
 * Code with comments removed.
 *
 * Load-bearing throughout. Every one of these files DOCUMENTS the bug it fixes, naming the wrong
 * field, the wrong fallback and the wrong protocol in prose. A grep for `difficultyLevel` or for
 * `classes[0]` finds the explanation of why it is wrong and reports the bug as still present.
 */
const codeOnly = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** The body of a named `const x = useCallback(async (...) => {` / `= (…) => {` declaration. */
function fnBody(code, declaration) {
  const at = code.indexOf(declaration);
  if (at < 0) return '';
  let depth = 0;
  let started = false;
  for (let i = at; i < code.length; i += 1) {
    if (code[i] === '{') {
      depth += 1;
      started = true;
    } else if (code[i] === '}') {
      depth -= 1;
      if (started && depth === 0) return code.slice(at, i + 1);
    }
  }
  return code.slice(at);
}

/** Field names declared on a Java DTO/record — `private Type name;` and record components alike. */
function javaFields(src) {
  const names = new Set();
  for (const m of src.matchAll(/^\s*private\s+[\w<>,\s[\]]+?\s+(\w+)\s*;/gm)) names.add(m[1]);
  const record = src.match(/record\s+\w+\s*\(([^)]*)\)/s);
  if (record) {
    for (const part of record[1].split(',')) {
      const m = part.trim().match(/([\w$]+)$/);
      if (m) names.add(m[1]);
    }
  }
  return names;
}

/* ── Evaluating the two pure modules ──────────────────────────────────────────
   Static reading is not enough for these: the bugs were wrong VALUES, and a value is only proved
   by running the code. `practiceZone.js` is import-free; `codingProService.js` needs its transport
   stubbed and its two util imports rewritten to sit alongside it in the temp dir. */

async function loadPracticeConst(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pz-'));
  let src = read(path.join(APP, SRC.practiceConst));
  if (mutate) src = mutate(src);
  const file = path.join(dir, 'practiceZone.mjs');
  fs.writeFileSync(file, src);
  return import(`${pathToFileURL(file).href}?t=${Math.random()}`);
}

async function loadCodingSvc(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-'));
  let src = read(path.join(APP, SRC.codingSvc));
  if (mutate) src = mutate(src);
  src = src
    .replace(/^import \{ studentApi \}.*$/m, 'const studentApi = { get: async () => ({}) };')
    .replace(/from '\.\.\/\.\.\/utils\/classMatch'/, "from './classMatch.mjs'")
    .replace(/from '\.\.\/\.\.\/utils\/studentType'/, "from './studentType.mjs'");
  fs.writeFileSync(path.join(dir, 'classMatch.mjs'), read(path.join(APP, 'utils/classMatch.js')));
  fs.writeFileSync(path.join(dir, 'studentType.mjs'), read(path.join(APP, 'utils/studentType.js')));
  const file = path.join(dir, 'codingProService.mjs');
  fs.writeFileSync(file, src);
  return import(`${pathToFileURL(file).href}?t=${Math.random()}`);
}

function loadSources(mutate) {
  const out = {};
  for (const [key, rel] of Object.entries(SRC)) {
    let text = read(path.join(APP, rel));
    if (mutate) text = mutate(key, text);
    out[key] = text;
  }
  return out;
}

function loadJava(mutate) {
  const out = {};
  for (const [key, rel] of Object.entries(JAVA_SRC)) {
    let text = read(path.join(JAVA, rel));
    if (mutate) text = mutate(key, text);
    out[key] = text;
  }
  return out;
}

function assertions(pz, coding, src, java) {
  const out = [];
  const bad = (m) => out.push(m);

  /* ── 1. PRACTICE ZONE DIFFICULTY ─────────────────────────────────────────── */

  // The field name, proved against the DTO rather than against another copy of the assumption.
  const dtoFields = javaFields(java.practiceDto);
  if (dtoFields.size < 4) bad(`the PracticeQuestionResponse field extractor found only ${dtoFields.size} fields — check it`);
  if (!dtoFields.has('difficulty')) {
    bad('PracticeQuestionResponse no longer declares `difficulty` — the client filter is reading a field the server does not send');
  }
  for (const wrong of ['level', 'difficultyLevel']) {
    if (dtoFields.has(wrong)) {
      bad(`PracticeQuestionResponse now also declares \`${wrong}\` — resolve which field the filter should use`);
    }
  }

  // The behaviour. `{ level: 'advanced' }` MUST read as basic: if it does not, the filter is back
  // on the field that does not exist, and every question lands in Basic again.
  if (pz.questionLevel({ difficulty: 'Intermediate' }) !== 'intermediate') {
    bad('questionLevel does not read `difficulty` — this is the bug that emptied the Intermediate and Advanced tabs');
  }
  if (pz.questionLevel({ difficulty: '  ADVANCED ' }) !== 'advanced') {
    bad('questionLevel is not tolerant of case/whitespace — `testLevel` is free text with no enum');
  }
  if (pz.questionLevel({ level: 'advanced' }) !== 'basic') {
    bad('questionLevel still honours `q.level`, a field the DTO does not emit — that is the original bug');
  }
  if (pz.questionLevel({ difficultyLevel: 'advanced' }) !== 'basic') {
    bad('questionLevel still honours `q.difficultyLevel`, a field the DTO does not emit');
  }
  if (pz.questionLevel({}) !== 'basic' || pz.questionLevel(null) !== 'basic') {
    bad('questionLevel does not default an untagged question to basic — the server renders a null testLevel as "basic"');
  }

  // And the screen must actually route through it.
  const screen = codeOnly(src.practiceScreen);
  if (!/questionLevel\(q\)\s*===\s*level/.test(screen)) {
    bad('PracticeZoneScreen does not filter with questionLevel() — the fix is not wired up');
  }

  /* ── 2. THE PROGRESSIVE UNLOCK LADDER ────────────────────────────────────── */

  if (pz.isLevelLocked('basic', {}) !== false) bad('Basic must never be locked');
  if (pz.isLevelLocked('intermediate', {}) !== true) {
    bad('Intermediate is open with no Basic attempt recorded');
  }
  if (pz.isLevelLocked('intermediate', { basic: { score: 79 } }) !== true) {
    bad('Intermediate unlocks below 80% in Basic');
  }
  if (pz.isLevelLocked('intermediate', { basic: { score: 80 } }) !== false) {
    bad('Intermediate stays locked at exactly 80% in Basic — the threshold is inclusive');
  }
  // Advanced keys off INTERMEDIATE, not Basic. A perfect Basic score must not open it.
  if (pz.isLevelLocked('advanced', { basic: { score: 100 } }) !== true) {
    bad('Advanced unlocks from the Basic score — it must depend on Intermediate');
  }
  if (pz.isLevelLocked('advanced', { intermediate: { score: 80 } }) !== false) {
    bad('Advanced stays locked at 80% in Intermediate');
  }
  // The web reads `.score`, not `.passed`; a stale flag must not override the number.
  if (pz.isLevelLocked('intermediate', { basic: { score: 10, passed: true } }) !== true) {
    bad('isLevelLocked trusts a `passed` flag over the score — the web reads .score');
  }
  if (!/isLevelLocked\(/.test(screen)) bad('PracticeZoneScreen does not consult isLevelLocked — the tabs are still all open');
  for (const k of ['intermediate', 'advanced']) {
    if (!pz.LEVEL_LOCK_HINTS?.[k]) bad(`LEVEL_LOCK_HINTS is missing the ${k} hint`);
  }

  /* ── 3. THE TWO ADAPTIVE PROTOCOLS ───────────────────────────────────────── */

  // The request DTO, read from Java: exactly attemptId + selectedAnswerIndex, and NO sessionState.
  const answerFields = javaFields(java.answerReq);
  if (!answerFields.has('attemptId') || !answerFields.has('selectedAnswerIndex')) {
    bad('UniversalAdaptiveAnswerRequest no longer declares attemptId + selectedAnswerIndex');
  }
  if (answerFields.has('sessionState')) {
    bad('UniversalAdaptiveAnswerRequest now models sessionState — re-check which protocol this engine speaks');
  }

  const hook = codeOnly(src.hook);
  if (!/protocol\s*=\s*'session'/.test(hook)) {
    bad("useAdaptiveSession lost its protocol parameter (default 'session')");
  }
  if (!/serverLadder\s*=\s*protocol\s*===\s*'server'/.test(hook)) {
    bad('useAdaptiveSession no longer distinguishes the server-ladder protocol');
  }
  // The 'server' branch must send ONLY the two fields. Assert on the ternary, not on the words:
  // `sessionState` legitimately appears in the other branch of the same expression.
  const chooseBody = fnBody(hook, 'const choose = useCallback');
  if (!/serverLadder\s*\?\s*\{\s*selectedAnswerIndex:\s*optionIndex\s*\}/.test(chooseBody)) {
    bad('the server-ladder answer body is not exactly { selectedAnswerIndex } — it is sending state that engine does not model');
  }
  if (!/cap\s*=\s*serverLadder\s*\?\s*UNCAPPED/.test(hook)) {
    bad('the server-ladder run is capped client-side again — it must end only on assessmentComplete');
  }
  // The summary must come from the FLAT counters for 'server'; building it from sessionState is
  // what reported 0 correct.
  if (!/serverLadder\s*\n?\s*\?\s*buildServerSummary/.test(hook)) {
    bad('the server-ladder summary is not built by buildServerSummary — flat counters are being ignored');
  }
  if (!/data\.totalAnswered\s*\?\?/.test(hook) || !/data\.correctCount\s*\?\?/.test(hook)) {
    bad('buildServerSummary does not read the flat totalAnswered/correctCount');
  }
  if (!/if\s*\(data\.report\)\s*setReport/.test(hook)) {
    bad("the server's `report` is discarded again — it is the entire analysis screen");
  }

  // Each screen must ask for the protocol its endpoint actually speaks.
  const pScreen = codeOnly(src.practiceScreen);
  if (!/protocol:\s*'server'/.test(pScreen)) {
    bad('Practice Zone no longer requests the server protocol for Universal Adaptive');
  }
  if (/\btotal:\s*\w/.test(fnBody(pScreen, 'const adaptive = useAdaptiveSession'))) {
    bad('Practice Zone passes a `total` to a server-ladder engine — that cap truncates the run');
  }
  // ...and the other two must NOT be switched over: they genuinely carry a client-held session.
  for (const [key, name] of [['reflection', 'MyReflection'], ['ceScreen', 'Competitive Exam']]) {
    const s = codeOnly(src[key]);
    if (/protocol:\s*'server'/.test(s)) {
      bad(`${name} was switched to the server protocol — its endpoint carries a client-held sessionState`);
    }
    if (!/total:\s*\w/.test(s)) {
      bad(`${name} lost its question cap — only the client knows when that engine should stop`);
    }
  }

  // The service must stamp the attempt id and stop spreading the hook's body into the request.
  const svc = codeOnly(src.academicSvc);
  const engine = svc.slice(svc.indexOf('universalAdaptiveEngine'));
  if (/\.\.\.body/.test(engine)) {
    bad('universalAdaptiveEngine spreads the hook body into the request again — sessionState leaks back in');
  }
  if (!/attemptId:\s*attemptIdRef/.test(engine)) bad('universalAdaptiveEngine no longer sends attemptId');

  // An uncapped run must not render "of Infinity".
  const runner = codeOnly(src.runner);
  if (!/uncapped/.test(runner)) {
    bad('AdaptiveRunner ignores `uncapped` — an uncapped run renders "Question 3 of Infinity"');
  }

  /* ── 3b. THE QUESTION SHAPE — options[], NOT optionA…optionD ─────────────── */

  // Device-found: the question rendered with NO ANSWERS AT ALL. Every adaptive engine serialises
  // PracticeQuestionResponse (Universal via UniversalAdaptiveQuestionResponse, which mirrors it),
  // so `options` is a List<String>. Reading optionA..D returned an empty array.
  for (const [key, name] of [
    ['practiceDto', 'PracticeQuestionResponse'],
    ['adaptiveQuestionDto', 'UniversalAdaptiveQuestionResponse'],
  ]) {
    const f = javaFields(java[key]);
    if (!f.has('options')) bad(`${name} no longer declares \`options\` — the runner reads an array`);
    if (f.has('optionA')) {
      bad(`${name} now declares optionA — resolve which shape the adaptive runner should read`);
    }
  }
  // Assert on the CONSTRUCT: `optionA` legitimately survives in the fallback branch and in the
  // docblock, so a bare includes() would pass with the array branch deleted.
  if (!/Array\.isArray\(q\?\.options\)/.test(runner)) {
    bad('AdaptiveRunner does not read the `options` ARRAY — the question renders with no answers');
  }
  // Compare the position of the ARRAY GUARD against the first letter-field reference. Comparing
  // indexOf('options') was the first version and it was vacuous: the function is *named*
  // `optionsOf`, so that substring always matched at offset 9 and the check never fired.
  const optsFn = fnBody(runner, 'function optionsOf');
  const arrayAt = optsFn.indexOf('Array.isArray(q?.options)');
  const letterAt = optsFn.indexOf('q?.optionA');
  if (arrayAt >= 0 && letterAt >= 0 && arrayAt > letterAt) {
    bad('optionsOf tries optionA…optionD before the array — the array is the real shape');
  }

  /* ── 3c. ONE REPORT RENDERER, SHARED WITH THE TEACHER ────────────────────── */

  const body = codeOnly(src.reportBody);
  const staffReport = codeOnly(src.staffReport);
  if (!/AdaptiveReportBody/.test(staffReport)) {
    bad('the staff report no longer delegates to the shared body — that is a second renderer over one DTO');
  }
  if (!/AdaptiveReportBody/.test(runner)) {
    bad("the student never renders the server's analysis — the report is discarded at the UI");
  }
  // The shared body must be palette-driven, or it renders staff-teal inside the student panel.
  if (!/usePalette\(\)/.test(body)) bad('AdaptiveReportBody hardcodes a palette');
  if (/PORTALS\./.test(body)) {
    bad('AdaptiveReportBody reaches for a PORTALS palette directly instead of usePalette()');
  }
  // PORTALS.school has no deep/onDark/card tokens, so the shared body must not use them.
  for (const token of ['deep', 'onDark', 'card', 'glass', 'tile']) {
    if (new RegExp(`\\bp\\.${token}\\b`).test(body)) {
      bad(`AdaptiveReportBody uses p.${token}, which PORTALS.school does not define — undefined colour on staff screens`);
    }
  }

  /* ── 6. LANGUAGE PRO ─────────────────────────────────────────────────────── */

  const langSvc = codeOnly(src.langSvc);
  const personalizedFields = javaFields(java.personalizedDto);
  if (!personalizedFields.has('curriculums')) {
    bad('LanguageProPersonalizedResponse no longer declares `curriculums`');
  }
  // THE BUG: the endpoint returns an OBJECT, and the service coerced a non-array to [] — so it
  // returned an empty list every single time and the page could never have shown anything.
  const fetchP = fnBody(langSvc, 'export async function fetchPersonalized');
  if (/Array\.isArray\(res\)\s*\?\s*res\s*:\s*\[\]/.test(fetchP)) {
    bad('fetchPersonalized still coerces the response to an array — it returns [] every time');
  }
  for (const field of ['curriculums', 'previousClassCurriculums', 'allSkills']) {
    if (!fetchP.includes(field)) bad(`fetchPersonalized drops \`${field}\` from the payload`);
  }

  // Language Pro had the SAME college-only-fallback bug as Coding Pro.
  if (!/export function resolveLanguageClass/.test(langSvc)) {
    bad('resolveLanguageClass is gone — Language Pro is back to a blind class fallback');
  }
  const resolveLang = fnBody(langSvc, 'export function resolveLanguageClass');
  if (!/if \(isCollege\) return \(curriculum\.classes \|\| \[\]\)\[0\]/.test(resolveLang)) {
    bad('resolveLanguageClass no longer restricts the classes[0] fallback to college students');
  }
  if (/findMatchedClass\([^)]*\)\s*\|\|/.test(resolveLang)) {
    bad('resolveLanguageClass ORs a fallback onto the match — that is the wrong-class bug');
  }

  // The landing must be the web's three cards, and Sound Studio must NOT be one of them.
  const landing = codeOnly(src.langLanding);
  for (const card of ['Personalized Resources', 'Communicative English']) {
    if (!landing.includes(card)) bad(`the Language Pro landing is missing the "${card}" card`);
  }
  if (!/isCollege \? 'College Resources' : 'School Resources'/.test(landing)) {
    bad('the School/College Resources card is not relabelled for college students');
  }
  // The guard, not the word: "college" appears in prose all over this file.
  if (!/hidden:\s*isCollege/.test(landing)) {
    bad('Personalized Resources is not hidden for college students');
  }
  if (/router\.push\([^)]*sound-studio/.test(landing)) {
    bad('a Sound Studio card is back on the Language Pro landing — it belongs on the Learn with Shreya level map, ungated');
  }
  // School Resources must come from /tree. /api/languagepro/school is DEAD — it serves the
  // filtered personalized payload despite its name.
  if (/api\/languagepro\/school/.test(langSvc) || /api\/languagepro\/school/.test(codeOnly(src.langResources))) {
    bad('something calls /api/languagepro/school — that endpoint returns the FILTERED payload');
  }

  /* ── 4. CODING PRO CLASS RESOLUTION ──────────────────────────────────────── */

  const curriculum = {
    id: 1,
    classes: [{ id: 91, name: 'Class 9' }, { id: 61, name: 'Class VI' }],
  };
  // THE BUG: a school student whose class does not match must get null, NOT classes[0].
  if (coding.resolveCodingClass(curriculum, 'Class 6', false)?.id !== 61) {
    bad('resolveCodingClass does not match a school student to their own class');
  }
  if (coding.resolveCodingClass(curriculum, 'Nursery', false) !== null) {
    bad('an unmatched SCHOOL class still falls back to the first class — this is the bug that showed a Class 6 student the Class 9 syllabus');
  }
  if (coding.resolveCodingClass(curriculum, null, false) !== null) {
    bad('a school student with no class on their profile still gets the first class');
  }
  // College students genuinely have no grade concept: classes[0] is correct for them.
  if (coding.resolveCodingClass(curriculum, null, true)?.id !== 91) {
    bad('a college student no longer falls back to the first class — they have no grade to match');
  }
  if (!coding.noClassMatchMessage('Class 6').includes('Class 6')) {
    bad('the no-match message does not name the class it could not find');
  }
  if (!coding.noClassMatchMessage(null).includes('unknown')) {
    bad("the no-match message does not say 'unknown' for a missing class");
  }

  const cScreen = codeOnly(src.codingScreen);
  if (/findMatchedClass\([^)]*\)\s*\|\|/.test(cScreen)) {
    bad('CodingProScreen still ORs a fallback onto the class match — that is the bug');
  }
  if (!/resolveCodingClass\(/.test(cScreen)) bad('CodingProScreen does not use resolveCodingClass');
  if (!/noClassMatchMessage\(/.test(cScreen)) {
    bad('CodingProScreen never tells the student their class was not found');
  }
  // The two empty states must stay distinct — collapsing them re-hides a mismatched class label.
  if (!/!matchedClass\s*\?/.test(cScreen)) {
    bad('CodingProScreen no longer branches on a missing class — "not found" and "no chapters" are different problems');
  }

  /* ── 5. THE RECORDER MUTEX ───────────────────────────────────────────────── */

  const rec = codeOnly(src.recorder);
  if (!/^let releaseChain/m.test(rec)) {
    bad('the module-level release chain is gone — a per-instance guard cannot see expo-av\'s per-process constraint');
  }
  if (!/await releaseChain/.test(rec)) {
    bad('acquireMic does not await outstanding teardowns — this is the "Only one Recording object" race');
  }
  const startBody = fnBody(rec, 'const start = useCallback');
  const acquireAt = startBody.indexOf('acquireMic');
  const prepareAt = startBody.indexOf('prepareToRecordAsync');
  if (acquireAt < 0) bad('start() does not take the mic lock before preparing');
  else if (prepareAt >= 0 && acquireAt > prepareAt) {
    bad('start() prepares the recorder BEFORE taking the lock — the lock cannot prevent anything');
  }
  if (!/releaseMic\(idRef\.current\)/.test(startBody)) {
    bad('a failed prepare never releases the lock — every later recording would be refused');
  }

  // THE ORDERING BUG: the ref must be cleared AFTER the unload resolves, not before.
  const stopBody = fnBody(rec, 'const stop = useCallback');
  const unloadAt = stopBody.indexOf('stopAndUnloadAsync');
  const clearAt = stopBody.indexOf('recorderRef.current = null');
  if (unloadAt < 0) bad('stop() no longer unloads the recorder');
  else if (clearAt >= 0 && clearAt < unloadAt) {
    bad('stop() clears recorderRef BEFORE awaiting the unload — a fast re-tap prepares over a live recorder');
  }
  if (!/queueRelease\(/.test(stopBody)) bad('stop() does not release through the shared chain');

  // Unmount cannot await, so it must hand the unload to the chain instead of firing and forgetting.
  const cleanup = rec.slice(rec.indexOf('aliveRef.current = true'), rec.indexOf('const ensurePermission'));
  if (!/queueRelease\(/.test(cleanup)) {
    bad('unmount cleanup is fire-and-forget again — navigating away mid-take races the next screen');
  }

  return out;
}

/* ── Self-tests ───────────────────────────────────────────────────────────────
   Every assertion above is proved to bind to something by breaking exactly what it claims to
   watch and confirming the suite goes red. An assertion no mutation can trip is decoration. */

const MUTATIONS = [
  {
    name: 'THE BUG: the difficulty filter reading `level` again',
    pz: (s) => s.replace("String(question?.difficulty || 'basic')", "String(question?.level || 'basic')"),
  },
  {
    name: 'the difficulty filter also honouring `difficultyLevel`',
    pz: (s) =>
      s.replace(
        "String(question?.difficulty || 'basic')",
        "String(question?.difficulty || question?.difficultyLevel || 'basic')",
      ),
  },
  {
    name: 'the filter losing its case/whitespace tolerance',
    pz: (s) => s.replace('.trim()\n    .toLowerCase()', ''),
  },
  {
    name: 'the screen bypassing questionLevel()',
    src: (k, s) =>
      k === 'practiceScreen' ? s.replace('questionLevel(q) === level', "(q.difficulty || 'basic') === level") : s,
  },
  {
    name: 'Intermediate unlocking below 80%',
    pz: (s) => s.replace('p.basic.score < PASS_MARK', 'p.basic.score < 50'),
  },
  {
    name: 'Advanced keyed off the Basic score',
    pz: (s) => s.replace("if (level === 'advanced') return !p.intermediate || p.intermediate.score < PASS_MARK", "if (level === 'advanced') return !p.basic || p.basic.score < PASS_MARK"),
  },
  {
    name: 'the ladder trusting a stale `passed` flag',
    pz: (s) => s.replace('!p.basic || p.basic.score < PASS_MARK', '!p.basic || (!p.basic.passed && p.basic.score < PASS_MARK)'),
  },
  {
    name: 'Basic becoming lockable',
    pz: (s) => s.replace('return false; // basic, and anything unrecognised', 'return true;'),
  },
  {
    name: 'the tabs no longer consulting the ladder',
    src: (k, s) => (k === 'practiceScreen' ? s.replaceAll('isLevelLocked(', 'noLock(') : s),
  },
  {
    name: 'THE BUG: sessionState sent to the server-ladder engine again',
    src: (k, s) =>
      k === 'hook'
        ? s.replace('? { selectedAnswerIndex: optionIndex }', '? { sessionState, selectedAnswerIndex: optionIndex }')
        : s,
  },
  {
    name: 'THE BUG: the server-ladder run capped client-side again',
    src: (k, s) => (k === 'hook' ? s.replace('serverLadder ? UNCAPPED : total', 'total ?? 15') : s),
  },
  {
    name: 'the summary built from a sessionState that never arrives',
    src: (k, s) =>
      k === 'hook'
        ? s.replace('? buildServerSummary(data, questionNumber)', '? buildSessionSummary(data, isLast, questionNumber)')
        : s,
  },
  {
    name: "the server's report discarded again",
    src: (k, s) => (k === 'hook' ? s.replace('if (data.report) setReport(data.report);', '') : s),
  },
  {
    name: 'Practice Zone reverting to the session protocol',
    src: (k, s) => (k === 'practiceScreen' ? s.replace("protocol: 'server',", 'total: 15,') : s),
  },
  {
    name: 'Competitive Exam wrongly switched to the server protocol',
    src: (k, s) => (k === 'ceScreen' ? s.replace('total: ADAPTIVE_TOTAL,', "protocol: 'server',") : s),
  },
  {
    name: 'the engine spreading the hook body into the request again',
    src: (k, s) =>
      k === 'academicSvc'
        ? s.replace(
            'attemptId: attemptIdRef?.current ?? null,\n      selectedAnswerIndex: body?.selectedAnswerIndex ?? null,',
            '...body,\n      attemptId: attemptIdRef?.current ?? null,',
          )
        : s,
  },
  {
    name: 'AdaptiveRunner rendering "of Infinity"',
    src: (k, s) => (k === 'runner' ? s.replaceAll('uncapped', 'unusedFlag') : s),
  },
  {
    name: 'THE BUG: the college-only class fallback applied to everyone',
    coding: (s) =>
      s.replace(
        '  if (isCollege) return (curriculum.classes || [])[0] || null;\n  return findMatchedClass(curriculum, className);',
        '  return findMatchedClass(curriculum, className) || (curriculum.classes || [])[0] || null;',
      ),
  },
  {
    name: 'college students losing their unified-content fallback',
    coding: (s) => s.replace('if (isCollege) return (curriculum.classes || [])[0] || null;', ''),
  },
  {
    name: 'the screen ORing a fallback back on',
    src: (k, s) =>
      k === 'codingScreen'
        ? s.replace('resolveCodingClass(c, studentClass, isCollege)', 'findMatchedClass(c, studentClass) || (c.classes || [])[0]')
        : s,
  },
  {
    name: 'the two empty states collapsed into one',
    src: (k, s) => (k === 'codingScreen' ? s.replace('!matchedClass ?', 'false ?') : s),
  },
  {
    name: 'THE BUG: the mic lock removed, leaving the per-instance guard',
    src: (k, s) => (k === 'recorder' ? s.replace(/^let releaseChain.*$/m, 'const noChain = 0;') : s),
  },
  {
    name: 'acquireMic no longer waiting for outstanding teardowns',
    src: (k, s) => (k === 'recorder' ? s.replace('await releaseChain;', '') : s),
  },
  {
    name: 'the lock taken AFTER the recorder is prepared',
    src: (k, s) =>
      k === 'recorder' ? s.replace('await acquireMic(idRef.current);', '// moved below') : s,
  },
  {
    name: 'a failed prepare leaking the lock forever',
    src: (k, s) =>
      k === 'recorder'
        ? s.replace('      releaseMic(idRef.current);\n      return false;\n    }\n  }, [ensurePermission, maxSeconds]);', '      return false;\n    }\n  }, [ensurePermission, maxSeconds]);')
        : s,
  },
  {
    name: 'THE ORDERING BUG: stop() clearing the ref before the unload',
    src: (k, s) =>
      k === 'recorder'
        ? s.replace(
            '    const rec = recorderRef.current;\n    setRecording(false);\n    if (!rec) return null;',
            '    const rec = recorderRef.current;\n    recorderRef.current = null;\n    setRecording(false);\n    if (!rec) return null;',
          )
        : s,
  },
  {
    name: 'unmount cleanup fire-and-forget again',
    src: (k, s) =>
      k === 'recorder'
        ? s.replace(
            '        queueRelease(async () => {\n          await rec.stopAndUnloadAsync().catch(() => {});\n          releaseMic(id);\n        });',
            '        rec.stopAndUnloadAsync().catch(() => {});',
          )
        : s,
  },
  {
    name: 'the DTO losing its difficulty field',
    java: (k, s) => (k === 'practiceDto' ? s.replace(/private String difficulty;/, 'private String tier;') : s),
  },
  {
    name: 'THE DEVICE BUG: the runner reading optionA…optionD again',
    src: (k, s) =>
      k === 'runner' ? s.replace('if (Array.isArray(q?.options)) return nonEmpty(q.options);', '') : s,
  },
  {
    name: 'optionsOf trying the letter fields before the array',
    src: (k, s) =>
      k === 'runner'
        ? s.replace(
            '  if (Array.isArray(q?.options)) return nonEmpty(q.options);\n  return nonEmpty([q?.optionA, q?.optionB, q?.optionC, q?.optionD]);',
            '  const letters = nonEmpty([q?.optionA, q?.optionB, q?.optionC, q?.optionD]);\n  if (letters.length) return letters;\n  return Array.isArray(q?.options) ? nonEmpty(q.options) : [];',
          )
        : s,
  },
  {
    name: 'the question DTO losing its options array',
    java: (k, s) =>
      k === 'adaptiveQuestionDto' ? s.replace('private List<String> options;', 'private List<String> choices;') : s,
  },
  {
    name: 'the staff report keeping its own copy of the renderer',
    src: (k, s) => (k === 'staffReport' ? s.replaceAll('AdaptiveReportBody', 'InlineBody') : s),
  },
  {
    name: "the student discarding the server's analysis at the UI",
    src: (k, s) => (k === 'runner' ? s.replaceAll('AdaptiveReportBody', 'NoBody') : s),
  },
  {
    name: 'the shared report body hardcoding a palette',
    src: (k, s) =>
      k === 'reportBody' ? s.replace('const palette = usePalette();', 'const palette = PORTALS.school;') : s,
  },
  {
    name: 'the shared body using a token PORTALS.school does not define',
    src: (k, s) => (k === 'reportBody' ? s.replace('color: p.primaryDark', 'color: p.deep') : s),
  },
  {
    name: 'THE BUG: fetchPersonalized coercing the object to an empty array',
    src: (k, s) =>
      k === 'langSvc'
        ? s.replace(
            /export async function fetchPersonalized\(signal\) \{[\s\S]*?\n\}/,
            "export async function fetchPersonalized(signal) {\n  const res = await studentApi.get('/api/languagepro/personalized', { signal });\n  return Array.isArray(res) ? res : [];\n}",
          )
        : s,
  },
  {
    name: 'Language Pro reverting to a blind class fallback',
    src: (k, s) =>
      k === 'langSvc'
        ? s.replace(
            '  if (isCollege) return (curriculum.classes || [])[0] || null;\n  return findMatchedClass(curriculum, className);',
            '  return findMatchedClass(curriculum, className) || (curriculum.classes || [])[0] || null;',
          )
        : s,
  },
  {
    name: 'the Personalized Resources card losing its college guard',
    src: (k, s) => (k === 'langLanding' ? s.replace('hidden: isCollege,', 'hidden: false,') : s),
  },
  {
    name: 'the College Resources relabel dropped',
    src: (k, s) =>
      k === 'langLanding'
        ? s.replace("title: isCollege ? 'College Resources' : 'School Resources',", "title: 'School Resources',")
        : s,
  },
  {
    name: 'a Sound Studio card added back to the Language Pro landing',
    src: (k, s) =>
      k === 'langLanding'
        ? s.replace("to: '/student/learn-with-shreya',", "to: '/student/sound-studio',\n      alt: () => router.push('/student/sound-studio'),")
        : s,
  },
  {
    name: 'School Resources pointed at the dead /api/languagepro/school',
    src: (k, s) =>
      k === 'langSvc' ? s.replace("'/api/languagepro/tree'", "'/api/languagepro/school'") : s,
  },
  {
    name: 'the adaptive request DTO growing a sessionState',
    java: (k, s) =>
      k === 'answerReq' ? s.replace('private Integer selectedAnswerIndex;', 'private Integer selectedAnswerIndex;\n    private String sessionState;') : s,
  },
];

console.log('Self-tests (each mutation must be caught):');
for (const m of MUTATIONS) {
  let caught;
  try {
    const [pz, coding] = await Promise.all([loadPracticeConst(m.pz), loadCodingSvc(m.coding)]);
    caught = assertions(pz, coding, loadSources(m.src), loadJava(m.java)).length > 0;
  } catch {
    caught = true; // a mutation that will not even load is caught, loudly
  }
  if (caught) ok(m.name);
  else fail(`NOT CAUGHT: ${m.name} — the corresponding assertion is vacuous`);
}

console.log('\nPhase 1 — the four confirmed bugs:');
{
  const [pz, coding] = await Promise.all([loadPracticeConst(), loadCodingSvc()]);
  const problems = assertions(pz, coding, loadSources(), loadJava());
  if (problems.length === 0) {
    ok('Practice Zone filters on `difficulty` (the DTO field) and locks levels at 80%');
    ok('Universal Adaptive runs the server protocol: { attemptId, selectedAnswerIndex }, uncapped, report kept');
    ok('MyReflection and Competitive Exam keep the client-held session protocol and their caps');
    ok('Coding Pro falls back to classes[0] for COLLEGE students only');
    ok('the recorder holds a process-wide mic lock and clears its ref after the unload');
  } else problems.forEach(fail);
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL — ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
