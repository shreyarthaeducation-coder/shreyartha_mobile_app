// Jyora / Shreya Speak / More like this checker.
//
//   node scripts/checkjyora.mjs
//
// WHY THIS EXISTS. Every failure mode in this phase is a plausible-looking success:
//
//   * `studentApi`'s default timeout is 15 s, but Jyora's server allows DeepSeek 120 s. A Jyora call
//     on the default aborts mid-generation and comes back as status 0 — which the app reports as
//     "you appear to be offline", on a request that was working. Retrying fails identically.
//   * The web component's prop is `staticContent`; the field the server reads is `contentHtml`.
//     `JyoraAIController` takes a bare Map and `getOrDefault(key, "")`, so a wrong key is NOT an
//     error — Jyora just explains the topic name with no material and the answer looks thin.
//   * `buildQuestionReadAloudText` letters options by ARRAY INDEX. Filtering blanks out first and
//     re-lettering renumbers every question that has a gap, so a student hears "Option B" while
//     reading "C".
//   * The audio controller is module scope. A per-instance guard compiles, runs, and lets two
//     screens play over each other — the same class of bug as the recorder mutex.
//
// The first two are checked against the JAVA source, not against another copy of the app's
// assumption. Exit code 0 = pass.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const WEB = path.resolve(APP, '..', 'frontendmain', 'src');
const JAVA = path.resolve(
  APP, '..', 'backendmain', 'src', 'main', 'java', 'com', 'shreyartha', 'backend',
);

const SRC = {
  service: 'services/student/jyoraService.js',
  controller: 'utils/audioController.js',
  voice: 'hooks/useShreyaVoice.js',
  recorder: 'hooks/useVoiceRecorder.js',
  speakBtn: 'components/student/ai/ShreyaSpeakButton.js',
  bar: 'components/student/ai/AiActionBar.js',
  sheet: 'components/student/ai/JyoraSheet.js',
  webBlock: 'components/student/ai/JyoraWebBlock.js',
  moreLike: 'components/student/ai/MoreLikeThisButton.js',
  readAloud: 'utils/readAloudText.js',
  practice: 'components/student/academiciq/PracticeZoneScreen.js',
  understanding: 'components/student/skillsedge/UnderstandingTest.js',
};

const JAVA_SRC = { jyora: path.join('infrastructure', 'jyora', 'JyoraAIController.java') };
const WEB_SRC = { modal: path.join('student', 'components', 'JyoraModal', 'JyoraModal.js') };

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
 * Load-bearing throughout: every one of these files DOCUMENTS the trap it avoids, naming
 * `staticContent`, the 15-second default and the per-instance guard in prose. A bare grep finds the
 * warning and reports the bug as still present.
 */
const codeOnly = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

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

const loadJava = (m) => {
  const out = {};
  for (const [k, rel] of Object.entries(JAVA_SRC)) {
    out[k] = m ? m(k, read(path.join(JAVA, rel))) : read(path.join(JAVA, rel));
  }
  return out;
};

const loadWeb = () => {
  const out = {};
  for (const [k, rel] of Object.entries(WEB_SRC)) out[k] = read(path.join(WEB, rel));
  return out;
};

async function loadService(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jyora-'));
  let src = read(path.join(APP, SRC.service));
  if (mutate) src = mutate(src);
  const calls = [];
  src = src.replace(
    /^import \{ studentApi \}.*$/m,
    'const calls = globalThis.__calls; const studentApi = { post: (e, b, o) => { calls.push({ endpoint: e, body: b, options: o }); return Promise.resolve({}); } };',
  );
  globalThis.__calls = calls;
  const file = path.join(dir, 'jyoraService.mjs');
  fs.writeFileSync(file, src);
  const mod = await import(`${pathToFileURL(file).href}?t=${Math.random()}`);
  return { mod, calls };
}

async function loadReadAloud(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ral-'));
  let src = read(path.join(APP, SRC.readAloud));
  if (mutate) src = mutate(src);
  src = src.replace(/from '\.\/htmlToText'/, "from './htmlToText.mjs'");
  fs.writeFileSync(path.join(dir, 'htmlToText.mjs'), read(path.join(APP, 'utils/htmlToText.js')));
  const file = path.join(dir, 'readAloudText.mjs');
  fs.writeFileSync(file, src);
  return import(`${pathToFileURL(file).href}?t=${Math.random()}`);
}

/** The keys JyoraAIController actually reads out of its request Map. */
function controllerKeys(java) {
  return new Set([...java.matchAll(/getOrDefault\(\s*"(\w+)"/g)].map((m) => m[1]));
}

async function assertions(svcPack, ral, src, java, web) {
  const out = [];
  const bad = (m) => out.push(m);
  const { mod: svc, calls } = svcPack;

  /* ── 1. THE REQUEST BODY MATCHES THE CONTROLLER ──────────────────────────── */

  const keys = controllerKeys(java.jyora);
  if (keys.size < 6) bad(`the controller-key extractor found only ${keys.size} keys — check it`);
  if (!keys.has('contentHtml')) {
    bad('JyoraAIController no longer reads `contentHtml` — the client is sending a field the server ignores');
  }

  calls.length = 0;
  await svc.explainTopic({ topicName: 'T', contentHtml: '<p>hi</p>' });
  const explain = calls.find((c) => c.endpoint.includes('/explain'));
  if (!explain) bad('explainTopic did not POST to /api/student/jyora/explain');
  else {
    for (const k of keys) {
      if (!(k in explain.body)) {
        bad(`explainTopic omits \`${k}\`, which the controller reads — it would silently default to ""`);
      }
    }
    if ('staticContent' in explain.body) {
      bad('explainTopic sends `staticContent` — that is the web PROP name; the server reads `contentHtml`');
    }
    if (explain.body.contentHtml !== '<p>hi</p>') bad('the content is not reaching `contentHtml`');

    // ── 2. THE TIMEOUT ──
    if (explain.options?.timeoutMs !== 120000) {
      bad(
        `explainTopic passes timeoutMs=${explain.options?.timeoutMs} — the server allows DeepSeek 120 s, ` +
          'and the 15 s default aborts a working request and reports it as being offline',
      );
    }
  }

  calls.length = 0;
  await svc.generateQuestions({ questionText: 'Q' });
  const gen = calls.find((c) => c.endpoint.includes('/generate-questions'));
  if (!gen) bad('generateQuestions did not POST to /api/student/jyora/generate-questions');
  else {
    if (gen.options?.timeoutMs !== 120000) {
      bad(`generateQuestions passes timeoutMs=${gen.options?.timeoutMs} — it needs the same 120 s`);
    }
    for (const f of ['subjectName', 'chapterName', 'topicName', 'questionText', 'optionA', 'optionB', 'optionC', 'optionD', 'correctAnswer', 'hint', 'bloomsLevel']) {
      if (!(f in gen.body)) bad(`generateQuestions omits \`${f}\` from QuestionGenRequest`);
    }
  }

  /* ── 3. THE FOLLOW-UP PROMPT IS THE WEB'S, VERBATIM ──────────────────────── */

  const webPrompt = web.modal.match(/followUpQuestion:\s*\n?\s*"([^"]+)"/)?.[1]
    || web.modal.match(/"(Explain this topic in more depth[^"]+)"/)?.[1];
  if (!webPrompt) bad('could not read the web follow-up prompt — check this assertion');
  else if (svc.EXPLORE_MORE_PROMPT !== webPrompt) {
    bad('EXPLORE_MORE_PROMPT differs from the web\'s literal string — the deepen-this answer changes');
  }

  /* ── 4. THE OPTION CONVERTERS ────────────────────────────────────────────── */

  const indexed = svc.questionContextFromIndexed({
    questionText: 'q',
    options: ['a', 'b', 'c', 'd'],
    correctOptionIndex: 2,
    explanation: 'why',
  });
  if (indexed.correctAnswer !== 'C') {
    bad(`questionContextFromIndexed produced correctAnswer=${indexed.correctAnswer}, expected the LETTER C`);
  }
  if (indexed.optionC !== 'c') bad('questionContextFromIndexed does not map options[] onto optionA..D');
  if (indexed.hint !== 'why') bad('questionContextFromIndexed drops `explanation` as the hint');

  const lettered = svc.questionContextFromLettered({ questionText: 'q', optionB: 'b', correctAnswer: 'B' });
  if (lettered.correctAnswer !== 'B' || lettered.optionB !== 'b') {
    bad('questionContextFromLettered mangles an already-lettered question');
  }

  /* ── 5. READ-ALOUD LETTERING IS BY ARRAY INDEX ───────────────────────────── */

  const gap = ral.buildQuestionReadAloudText('Stem?', ['first', '', 'third']);
  if (!gap.includes('Option A. first')) bad('the first option is not lettered A');
  if (!gap.includes('Option C. third')) {
    bad(`a blank option consumed its letter: got "${gap}". The web keeps the ARRAY INDEX, so a blank optionB means the third option is still C`);
  }
  if (gap.includes('Option B')) bad('a blank option was given a letter');
  if (!gap.startsWith('Stem?')) bad('the question stem is missing from the utterance');
  // Entities must be decoded or the student hears a literal "&nbsp;".
  if (ral.buildQuestionReadAloudText('a&nbsp;b', []).includes('&nbsp;')) {
    bad('HTML entities survive into the TTS text');
  }
  if (ral.buildQuestionReadAloudText('<p>tagged</p>', []) !== 'tagged') bad('HTML tags survive into the TTS text');

  /* ── 6. THE AUDIO CONTROLLER IS MODULE SCOPE ─────────────────────────────── */

  const ctrl = codeOnly(src.controller);
  if (!/^let active/m.test(ctrl)) bad('the audio controller no longer holds a module-scope handle');
  if (/useRef|useState/.test(ctrl)) {
    bad('the audio controller uses React state — it must be module scope, or it is per-instance again');
  }

  const voice = codeOnly(src.voice);
  if (!/registerActiveAudio\(/.test(voice)) {
    bad('useShreyaVoice does not register with the audio controller — two screens will play over each other');
  }
  // Registering AFTER createAsync would overlap for the length of the call.
  const speakBody = voice.slice(voice.indexOf('const speak'), voice.indexOf('const prefetch'));
  const regAt = speakBody.indexOf('registerActiveAudio');
  const createAt = speakBody.indexOf('Audio.Sound.createAsync');
  if (regAt < 0 || createAt < 0) bad('could not locate register/createAsync in speak() — check this assertion');
  else if (regAt > createAt) bad('playback is claimed AFTER the sound is created — the clips overlap');

  if (!/pause|resume/.test(voice)) bad('useShreyaVoice lost pause/resume');
  // A pause must NOT resolve speak()'s promise, or Learn with Shreya advances mid-line.
  if (/didJustFinish[\s\S]{0,120}status\.isPlaying === false/.test(voice)) {
    bad('speak() resolves on a pause — the caller would advance before the line finishes');
  }

  // The microphone must silence playback without needing a reference to the player.
  const rec = codeOnly(src.recorder);
  if (!/stopActiveAudio\(\)/.test(rec)) {
    bad('the recorder does not stop playback before opening the mic — Android records Shreya');
  }

  /* ── 7. NO DEAD ttsSupported BRANCH ──────────────────────────────────────── */

  if (/ttsSupported/.test(codeOnly(src.speakBtn))) {
    bad('a ttsSupported disabled branch was added — LanguageDto has no such field, so it can never fire');
  }

  /* ── 8. WIRING ───────────────────────────────────────────────────────────── */

  // The tag must END where the name ends. `/<MoreLikeThisButton/` alone is ALSO true of
  // `<MoreLikeThisButtonGone`, so renaming the component away slipped straight past the first
  // version of this check — the same prefix trap that made two earlier assertions vacuous.
  for (const key of ['practice', 'understanding']) {
    const s = codeOnly(src[key]);
    if (!/<ShreyaSpeakButton[\s/>]/.test(s)) bad(`${SRC[key]} has no Shreya Speak button`);
    if (!/<MoreLikeThisButton[\s/>]/.test(s)) bad(`${SRC[key]} has no More like this button`);
  }
  for (const key of ['bar', 'sheet']) {
    if (!/<ShreyaSpeakButton[\s/>]/.test(codeOnly(src[key]))) {
      bad(`${SRC[key]} has no Shreya Speak button`);
    }
  }
  // The understanding test must pass the RAW four-element array, not the pre-filtered optionsOf().
  const u = codeOnly(src.understanding);
  if (/buildQuestionReadAloudText\([^)]*optionsOf/.test(u)) {
    bad('UnderstandingTest reads aloud from optionsOf(), which re-letters after filtering blanks');
  }
  // Jyora's sheet must only mount a WebView when the field is present.
  const sheet = codeOnly(src.sheet);
  if (!/data\?\.diagramMermaid \?/.test(sheet) || !/data\?\.video\?\.videoId \?/.test(sheet)) {
    bad('JyoraSheet mounts its WebView blocks unconditionally — a text-only answer should never create one');
  }
  // The sheet itself must be mounted lazily, or every topic holds a sheet that can fire a 120 s call.
  if (!/\{open \? \(/.test(codeOnly(src.bar))) {
    bad('AiActionBar mounts JyoraSheet even when closed');
  }

  return out;
}

const MUTATIONS = [
  {
    name: 'THE BUG: the Jyora timeout left on the 15 s default',
    service: (s) => s.replace(/\{ timeoutMs: JYORA_TIMEOUT_MS \}/, '{}'),
  },
  {
    name: 'the generate-questions timeout left on the default',
    service: (s) => s.replace(/(\n\s*\{ timeoutMs: JYORA_TIMEOUT_MS \},\n\s*\);\n\}\n)$/m, '\n  );\n}\n'),
  },
  {
    name: 'JYORA_TIMEOUT_MS lowered below the server\'s DeepSeek read timeout',
    service: (s) => s.replace('JYORA_TIMEOUT_MS = 120000', 'JYORA_TIMEOUT_MS = 15000'),
  },
  {
    name: 'THE BUG: the content sent as `staticContent` (the web PROP name)',
    service: (s) => s.replace(/^      contentHtml,$/m, '      staticContent: contentHtml,'),
  },
  {
    name: 'a field the controller reads dropped from the body',
    service: (s) => s.replace(/^      chapterName,$/m, ''),
  },
  {
    name: 'the follow-up prompt reworded',
    service: (s) => s.replace('with additional examples', 'with more examples'),
  },
  {
    name: 'the indexed converter emitting an index instead of a letter',
    service: (s) => s.replace('String.fromCharCode(65 + (question?.correctOptionIndex || 0))', 'String(question?.correctOptionIndex || 0)'),
  },
  {
    name: 'the indexed converter dropping the explanation hint',
    service: (s) => s.replace("hint: question?.explanation || ''", "hint: ''"),
  },
  {
    name: 'THE BUG: read-aloud re-lettering after filtering blanks',
    readAloud: (s) =>
      s.replace(
        '  (options || []).forEach((option, index) => {\n    const text = htmlToText(option);\n    if (!text) return;',
        '  (options || []).filter((o) => htmlToText(o)).forEach((option, index) => {\n    const text = htmlToText(option);\n    if (!text) return;',
      ),
  },
  {
    name: 'read-aloud dropping the question stem',
    readAloud: (s) => s.replace('const parts = [htmlToText(questionText)].filter(Boolean);', 'const parts = [];'),
  },
  {
    name: 'read-aloud leaving HTML entities in the TTS text',
    readAloud: (s) => s.replace("import htmlToText from './htmlToText';", "const htmlToText = (h) => String(h || '').replace(/<[^>]+>/g, ' ').trim();"),
  },
  {
    name: 'THE BUG: the audio controller made per-instance',
    src: (k, s) => (k === 'controller' ? s.replace(/^let active = null;$/m, 'const active = { useRef: 1 };') : s),
  },
  {
    name: 'useShreyaVoice no longer registering with the controller',
    src: (k, s) => (k === 'voice' ? s.replaceAll('registerActiveAudio', 'noRegister') : s),
  },
  {
    name: 'playback claimed AFTER the sound is created (they overlap)',
    src: (k, s) =>
      k === 'voice'
        ? s.replace(
            '        await registerActiveAudio(handleRef.current);\n        if (epochRef.current !== epoch) return;\n\n        const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });',
            '        const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });\n        await registerActiveAudio(handleRef.current);',
          )
        : s,
  },
  {
    name: 'useShreyaVoice losing pause/resume',
    src: (k, s) => (k === 'voice' ? s.replaceAll('pause', 'halt').replaceAll('resume', 'go') : s),
  },
  {
    name: 'the recorder no longer silencing playback first',
    src: (k, s) => (k === 'recorder' ? s.replace('await stopActiveAudio();', '') : s),
  },
  {
    name: 'a dead ttsSupported disabled branch reintroduced',
    src: (k, s) =>
      k === 'speakBtn' ? s.replace('const showStop = speaking || paused;', 'const showStop = speaking || paused;\n  const off = lang?.ttsSupported === false;') : s,
  },
  {
    name: 'Practice Zone losing its More like this button',
    src: (k, s) => (k === 'practice' ? s.replace('<MoreLikeThisButton', '<MoreLikeThisButtonGone') : s),
  },
  {
    name: 'the understanding test reading aloud from the re-lettered optionsOf()',
    src: (k, s) =>
      k === 'understanding'
        ? s.replace(
            /text=\{buildQuestionReadAloudText\(q\.questionText, \[\s*q\.optionA,\s*q\.optionB,\s*q\.optionC,\s*q\.optionD,\s*\]\)\}/,
            'text={buildQuestionReadAloudText(q.questionText, optionsOf(q).map((o) => o[1]))}',
          )
        : s,
  },
  {
    name: 'JyoraSheet mounting a WebView for a text-only answer',
    src: (k, s) => (k === 'sheet' ? s.replace('data?.diagramMermaid ?', 'true ?') : s),
  },
  {
    name: 'AiActionBar holding a JyoraSheet on every topic',
    src: (k, s) => (k === 'bar' ? s.replace('{open ? (', '{true ? (') : s),
  },
  {
    name: 'the controller dropping contentHtml from its read keys',
    java: (k, s) => (k === 'jyora' ? s.replace('getOrDefault("contentHtml"', 'getOrDefault("staticContent"') : s),
  },
];

console.log('Self-tests (each mutation must be caught):');
for (const m of MUTATIONS) {
  let caught;
  try {
    const [svcPack, ral] = await Promise.all([loadService(m.service), loadReadAloud(m.readAloud)]);
    const problems = await assertions(svcPack, ral, loadSources(m.src, m.service), loadJava(m.java), loadWeb());
    caught = problems.length > 0;
  } catch {
    caught = true; // a mutation that will not even load is caught, loudly
  }
  if (caught) ok(m.name);
  else fail(`NOT CAUGHT: ${m.name} — the corresponding assertion is vacuous`);
}

console.log('\nJyora / Shreya Speak / More like this:');
{
  const [svcPack, ral] = await Promise.all([loadService(), loadReadAloud()]);
  const problems = await assertions(svcPack, ral, loadSources(), loadJava(), loadWeb());
  if (problems.length === 0) {
    ok('the request body matches every key JyoraAIController reads, incl. `contentHtml`');
    ok('both Jyora calls allow 120 s — the server\'s DeepSeek read timeout');
    ok('the follow-up prompt is byte-identical to the web\'s');
    ok('options convert index↔letter correctly, and read-aloud letters by ARRAY INDEX');
    ok('one clip at a time, module scope; the mic silences playback first');
    ok('WebViews mount only for a diagram or a video; the sheet only while open');
  } else problems.forEach(fail);
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL — ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
