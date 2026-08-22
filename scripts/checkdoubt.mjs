// Doubt Resolution checker.
//
//   node scripts/checkdoubt.mjs
//
// WHY THIS EXISTS. Five failure modes here all look like something other than what they are:
//
//   * A SUBJECT MISMATCH IS A 200 with `session: null`. A port that assumes 200 ⇒ session throws on
//     the very next line, on a completely ordinary answer.
//   * The staged POSTs are DeepSeek round trips (120 s server-side), and `/resolution` is DeepSeek
//     THEN a fal FLUX image, serially (~180 s). On the client's 15 s default the request aborts,
//     reports "you appear to be offline", and the SERVER KEEPS GOING AND CACHES — so the retry
//     returns a finished answer out of nowhere.
//   * S3 accepts PNG/JPEG/GIF/WebP/SVG only, ≤5 MB. An iPhone photo is HEIC and is refused.
//   * The staged POSTs return ad-hoc Maps, not the DTO the GET returns; assigning instead of
//     merging silently drops the rest of the session.
//   * `renderDoubtText`'s regex is `[^*]+`, so `**a*b**` and a lone `**` stay literal.
//
// The multipart part names are checked against the JAVA controller, not against another copy of the
// app's assumption. Exit code 0 = pass.

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
  service: 'services/student/doubtService.js',
  image: 'utils/doubtImage.js',
  text: 'utils/doubtText.js',
  sheet: 'components/student/ai/DoubtSheet.js',
  bar: 'components/student/ai/AiActionBar.js',
  picker: 'utils/filePicker.js',
};

const JAVA_SRC = {
  controller: path.join('infrastructure', 'doubt', 'DoubtResolutionController.java'),
  service: path.join('infrastructure', 'doubt', 'DoubtResolutionService.java'),
};

let failures = 0;
const fail = (m) => {
  failures += 1;
  console.error(`  ✗ ${m}`);
};
const ok = (m) => console.log(`  ✓ ${m}`);

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

// The `/*` must be preceded by whitespace. `utils/filePicker.js` — which this suite reads — holds
// the MIME filters 'image/*' and 'video/*', and a naive stripper treats each as opening a block
// comment and eats the rest of the file, silently hollowing out the picker assertions below.
const codeOnly = (t) =>
  t.replace(/(^|\s)\/\*[\s\S]*?\*\//g, '$1').replace(/^\s*\/\/.*$/gm, '');

/**
 * @param mutate        applied to every source file, keyed by name
 * @param mutateService applied to doubtService.js on top of that
 * @param mutateText    applied to doubtText.js on top of that
 *
 * The last two are not bookkeeping. `service:` and `text:` mutations edit the modules that get
 * EVALUATED, while the grep assertions read the files separately — so without threading them here,
 * such a mutation changes the behaviour under test while every text assertion keeps reading the
 * pristine file. Three mutations in this suite went vacuous for exactly that reason, and the same
 * trap has now appeared in checkspeech, checkwelcome and checkjyora.
 */
function loadSources(mutate, mutateService, mutateText) {
  const out = {};
  for (const [k, rel] of Object.entries(SRC)) {
    let text = read(path.join(APP, rel));
    if (mutate) text = mutate(k, text);
    if (mutateService && k === 'service') text = mutateService(text);
    if (mutateText && k === 'text') text = mutateText(text);
    out[k] = text;
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

async function loadService(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doubt-'));
  let src = read(path.join(APP, SRC.service));
  if (mutate) src = mutate(src);
  const calls = [];
  globalThis.__doubtCalls = calls;
  src = src
    .replace(
      /^import \{ studentApi \}.*$/m,
      `const calls = globalThis.__doubtCalls;
       const rec = (kind) => (endpoint, a, b) => { calls.push({ kind, endpoint, a, b }); return Promise.resolve({}); };
       const studentApi = { get: rec('get'), post: rec('post'), multipart: rec('multipart') };`,
    )
    .replace(
      /^import \{ normaliseDoubtImage \}.*$/m,
      "const normaliseDoubtImage = async (uri) => ({ uri, name: 'doubt.jpg', type: 'image/jpeg' });",
    );
  const file = path.join(dir, 'doubtService.mjs');
  fs.writeFileSync(file, src);
  const mod = await import(`${pathToFileURL(file).href}?t=${Math.random()}`);
  return { mod, calls };
}

async function loadText(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dtext-'));
  let src = read(path.join(APP, SRC.text));
  if (mutate) src = mutate(src);
  const file = path.join(dir, 'doubtText.mjs');
  fs.writeFileSync(file, src);
  return import(`${pathToFileURL(file).href}?t=${Math.random()}`);
}

/** The `@RequestParam` names the create endpoint declares. */
function createParams(java) {
  const at = java.indexOf('@PostMapping("/sessions")');
  if (at < 0) return new Set();
  const block = java.slice(at, java.indexOf('public ', at) + 400);
  return new Set([...block.matchAll(/@RequestParam\(\s*(?:value\s*=\s*)?"(\w+)"/g)].map((m) => m[1]));
}

/** `requireStage(session, N)` call sites, keyed by the enclosing method name. */
function stageGates(java) {
  const out = {};
  for (const m of java.matchAll(/(?:public|private)\s+[\w<>,\s]+\s+(\w+)\s*\([^)]*\)\s*\{([\s\S]{0,900}?)requireStage\([^,]+,\s*(\d)\)/g)) {
    out[m[1]] = Number(m[3]);
  }
  return out;
}

async function assertions(pack, text, src, java) {
  const out = [];
  const bad = (m) => out.push(m);
  const { mod: svc, calls } = pack;

  /* ── 1. THE MULTIPART CONTRACT ───────────────────────────────────────────── */

  const params = createParams(java.controller);
  if (params.size < 4) bad(`the @RequestParam extractor found only ${params.size} params — check it`);
  if (!params.has('file')) bad('the create endpoint no longer declares a `file` param');

  calls.length = 0;
  await svc.createSession({ uri: 'x', source: 'SCHOOL', subjectName: 'Maths', topicName: 'T' });
  const create = calls.find((c) => c.kind === 'multipart');
  if (!create) bad('createSession did not use multipart');
  else {
    const parts = create.a || {};
    if (!parts.files?.file) bad('the image is not sent as the `file` part');
    if (parts.json) bad('createSession sends a `json` part — these are @RequestParams, which never bind from JSON');
    for (const p of params) {
      if (p === 'file') continue;
      if (!(p in (parts.fields || {}))) bad(`\`${p}\` is not sent as a form field, but the controller declares it`);
    }
    // Blank context must be OMITTED — an empty subjectName switches the mismatch check on with
    // nothing to compare against.
    if (parts.fields?.chapterName !== undefined) {
      bad('a blank chapterName is sent rather than omitted');
    }
    if (create.b?.timeoutMs !== svc.DOUBT_LONG_TIMEOUT_MS) {
      bad(`createSession timeout is ${create.b?.timeoutMs} — vision + S3 needs the long one`);
    }
  }

  /* ── 2. TIMEOUTS ON EVERY STAGE ──────────────────────────────────────────── */

  const stageCalls = [
    ['attempt', () => svc.submitAttempt(1, 'a'), svc.DOUBT_TIMEOUT_MS],
    ['resolution', () => svc.getResolution(1), svc.DOUBT_LONG_TIMEOUT_MS],
    ['questions', () => svc.getQuestions(1), svc.DOUBT_TIMEOUT_MS],
    ['verify', () => svc.submitVerification(1, ['A', 'B'], ['x', 'y', 'z']), svc.DOUBT_TIMEOUT_MS],
    ['explore', () => svc.getExplore(1), svc.DOUBT_TIMEOUT_MS],
    ['solution', () => svc.getSolution(1), svc.DOUBT_TIMEOUT_MS],
  ];
  for (const [name, run, expected] of stageCalls) {
    calls.length = 0;
    await run();
    const c = calls.find((x) => x.kind === 'post');
    if (!c) bad(`${name} did not POST`);
    else if (c.b?.timeoutMs !== expected) {
      bad(`${name} passes timeoutMs=${c.b?.timeoutMs}, expected ${expected} — the 15 s default aborts a working request`);
    }
  }
  if (svc.DOUBT_TIMEOUT_MS < 120000) bad('DOUBT_TIMEOUT_MS is below the server\'s 120 s DeepSeek read timeout');
  if (svc.DOUBT_LONG_TIMEOUT_MS <= svc.DOUBT_TIMEOUT_MS) {
    bad('DOUBT_LONG_TIMEOUT_MS is not longer — /resolution runs DeepSeek AND FLUX serially');
  }

  /* ── 3. STAGE GATES MATCH THE SERVER ─────────────────────────────────────── */

  const serverGates = stageGates(java.service);
  const expectedGates = { getResolution: 2, getQuestions: 2, submitVerification: 2, getExplore: 3, getSolution: 4 };
  for (const [method, n] of Object.entries(expectedGates)) {
    if (serverGates[method] !== undefined && serverGates[method] !== n) {
      bad(`the server now gates ${method} at stage ${serverGates[method]}, not ${n} — the client's cards are out of step`);
    }
  }
  for (const [key, n] of Object.entries(svc.STAGE_REQUIRED)) {
    if (key === 'attempt') continue;
    if (![2, 3, 4].includes(n)) bad(`STAGE_REQUIRED.${key} = ${n} is not a stage the server enforces`);
  }
  const sheet = codeOnly(src.sheet);
  // A locked card must render NO body — the web renders only the head plus the lock note.
  if (!/unlocked \? <View style=\{styles\.stageBody\}>/.test(sheet)) {
    bad('a locked stage card still renders its body');
  }

  /* ── 4. THE 200-WITH-NULL-SESSION ────────────────────────────────────────── */

  if (!/belongsToSubject === false/.test(sheet)) {
    bad('the sheet does not branch on `belongsToSubject === false` — a mismatch would crash on session.id');
  }
  // The guard must come BEFORE any use of res.session.
  const submitBody = sheet.slice(sheet.indexOf('const submitDoubt'), sheet.indexOf('const runStage'));
  const guardAt = submitBody.indexOf('belongsToSubject === false');
  const useAt = submitBody.indexOf('res.session');
  if (guardAt >= 0 && useAt >= 0 && guardAt > useAt) {
    bad('`res.session` is read before the mismatch guard');
  }
  if (!/!res\?\.session/.test(submitBody)) {
    bad('the sheet does not handle a null session outside the mismatch case');
  }

  /* ── 5. MERGE, NOT ASSIGN ────────────────────────────────────────────────── */

  const merged = svc.mergeSession({ id: 1, extractedQuestion: 'q', stage: 1 }, { resolutionText: 'r', stage: 2 });
  if (merged.extractedQuestion !== 'q') {
    bad('mergeSession drops fields the staged POST did not return — those Maps are partial');
  }
  if (merged.stage !== 2 || merged.resolutionText !== 'r') bad('mergeSession does not apply the patch');
  if (!/mergeSession\(/.test(sheet)) bad('the sheet assigns stage responses instead of merging them');

  /* ── 6. TIMEOUT RECOVERY RE-GETS ─────────────────────────────────────────── */

  const svcSrc = codeOnly(src.service);
  if (!/isOffline/.test(svcSrc) || !/fetchSession\(sessionId\)/.test(svcSrc)) {
    bad('a timed-out stage call does not recover by re-GETting — a re-POST risks a second paid generation');
  }

  /* ── 7. THE IMAGE IS ALWAYS JPEG ─────────────────────────────────────────── */

  const img = codeOnly(src.image);
  if (!/SaveFormat\.JPEG/.test(img)) bad('the image normaliser does not force JPEG — HEIC would 400');
  if (/if \(longest <= MAX_SIDE.*\)\s*return/.test(img)) {
    bad('the normaliser short-circuits without re-encoding — a small HEIC would pass through and 400');
  }
  // The CONSTRUCT, not the word: renaming `resize` to `noresize` leaves the substring `resize`
  // intact, so a bare /resize/ stayed true while the resize was gone.
  if (!/actions\.push\(\{ resize:/.test(img)) {
    bad('the normaliser never resizes — a phone photo exceeds the 5 MB cap');
  }
  if (!/name: 'doubt\.jpg'/.test(img)) bad("the uploaded filename is no longer doubt.jpg");

  /* ── 8. THE MARKDOWN-LITE RENDERER ───────────────────────────────────────── */

  const seg = (s) => text.doubtSegments(s);
  const bolds = (s) => seg(s).filter((x) => x.bold).map((x) => x.text);
  if (JSON.stringify(bolds('a **b** c')) !== JSON.stringify(['b'])) bad('**bold** is not bolded');
  if (seg('a **b** c').map((x) => x.text).join('') !== 'a b c') bad('text is lost around a bold run');
  // `[^*]+` means an asterisk INSIDE the delimiters breaks the pair.
  if (bolds('**a*b**').length !== 0) bad('`**a*b**` was bolded — the web\'s [^*]+ does not match it');
  // A lone `**` stays literal rather than swallowing the rest.
  if (!seg('a ** b').map((x) => x.text).join('').includes('**')) bad('a lone ** was swallowed');
  if (seg('one\ntwo').map((x) => x.text).join('').indexOf('\n') < 0) bad('newlines are stripped');
  if (seg('').length !== 0 || seg(null).length !== 0) bad('blank input does not produce an empty list');

  /* ── 9. SOURCES AND THE PICKERS ──────────────────────────────────────────── */

  if (!svc.SOURCES.PERSONALIZED) {
    bad('SOURCES is missing PERSONALIZED — it is in the entity javadoc and the web uses it');
  }
  for (const s of ['SCHOOL', 'COMPETITIVE', 'JYORA', 'CHATBOT']) {
    if (!svc.SOURCES[s]) bad(`SOURCES is missing ${s}`);
  }
  const picker = codeOnly(src.picker);
  if (!/export async function takePhoto/.test(picker)) bad('takePhoto() is missing — there is no camera route');
  if (!/requestCameraPermissionsAsync/.test(picker)) bad('takePhoto does not request camera permission');
  // The doubt pickers must NOT crop; that option belongs to the profile avatar only.
  const takeBody = picker.slice(picker.indexOf('export async function takePhoto'), picker.indexOf('export async function pickImage'));
  if (/allowsEditing/.test(takeBody)) bad('takePhoto crops — a 1:1 crop would cut off half the question');
  const pickImgBody = picker.slice(picker.indexOf('export async function pickImage'), picker.indexOf('export async function pickPhoto'));
  if (/allowsEditing/.test(pickImgBody)) bad('pickImage crops — that is pickPhoto\'s avatar behaviour');

  /* ── 10. WIRING ──────────────────────────────────────────────────────────── */

  const bar = codeOnly(src.bar);
  if (!/<DoubtSheet[\s/>]/.test(bar)) bad('AiActionBar does not mount DoubtSheet');
  if (!/\{doubtOpen \? \(/.test(bar)) bad('DoubtSheet is mounted even when closed');
  // The capture must happen before the sheet opens, not inside it.
  const openBody = bar.slice(bar.indexOf('const openDoubt'), bar.indexOf('return ('));
  if (!/captureRef\(/.test(openBody)) bad('the screen capture no longer happens before the sheet opens');
  if (openBody.indexOf('captureRef(') > openBody.indexOf('setDoubtOpen(true)')) {
    bad('the sheet opens before the capture — that captures a view behind a Modal');
  }

  return out;
}

const MUTATIONS = [
  {
    name: 'THE BUG: a stage POST left on the 15 s default',
    service: (s) => s.replace('{ timeoutMs },', '{},'),
  },
  {
    name: 'createSession left on the default timeout',
    service: (s) => s.replace('{ timeoutMs: DOUBT_LONG_TIMEOUT_MS },', '{},'),
  },
  {
    name: '/resolution downgraded to the short timeout',
    service: (s) => s.replace("stagePost(id, 'resolution', {}, DOUBT_LONG_TIMEOUT_MS)", "stagePost(id, 'resolution')"),
  },
  {
    name: 'DOUBT_TIMEOUT_MS dropped below the server read timeout',
    service: (s) => s.replace('DOUBT_TIMEOUT_MS = 120000', 'DOUBT_TIMEOUT_MS = 30000'),
  },
  {
    name: 'the context values sent as a json part instead of form fields',
    service: (s) => s.replace(/      fields: \{/, '      json: {'),
  },
  {
    name: 'a blank chapterName sent rather than omitted',
    service: (s) => s.replace('chapterName: chapterName || undefined,', "chapterName: chapterName || '',"),
  },
  {
    name: 'the image sent under the wrong part name',
    service: (s) => s.replace('files: { file },', 'files: { image: file },'),
  },
  {
    name: 'a timed-out stage call re-POSTing instead of re-GETting',
    service: (s) => s.replace('return await fetchSession(sessionId);', 'throw e;'),
  },
  {
    name: 'SOURCES losing PERSONALIZED',
    service: (s) => s.replace("  PERSONALIZED: 'PERSONALIZED',\n", ''),
  },
  {
    name: 'mergeSession assigning instead of merging',
    service: (s) => s.replace('return { ...(prev || {}), ...patch };', 'return patch;'),
  },
  {
    name: 'THE BUG: the mismatch guard removed (crashes on session.id)',
    src: (k, s) => (k === 'sheet' ? s.replace('res?.belongsToSubject === false', 'false') : s),
  },
  {
    name: 'the null-session guard removed',
    src: (k, s) => (k === 'sheet' ? s.replace('if (!res?.session) {', 'if (false) {') : s),
  },
  {
    name: 'a locked stage card rendering its body',
    src: (k, s) =>
      k === 'sheet'
        ? s.replace('{unlocked ? <View style={styles.stageBody}>{children}</View> : null}', '<View style={styles.stageBody}>{children}</View>')
        : s,
  },
  {
    name: 'the sheet assigning stage responses instead of merging',
    src: (k, s) => (k === 'sheet' ? s.replaceAll('mergeSession(', 'noMerge(') : s),
  },
  {
    name: 'THE BUG: the normaliser short-circuiting a small image (HEIC passes through)',
    src: (k, s) =>
      k === 'image'
        ? s.replace('  const actions = [];', '  if (longest <= MAX_SIDE) return { uri, name: "doubt.jpg", type: "image/jpeg" };\n  const actions = [];')
        : s,
  },
  {
    name: 'the normaliser emitting PNG instead of JPEG',
    src: (k, s) => (k === 'image' ? s.replace('SaveFormat.JPEG', 'SaveFormat.PNG') : s),
  },
  {
    name: 'the normaliser no longer resizing',
    src: (k, s) => (k === 'image' ? s.replaceAll('resize', 'noresize') : s),
  },
  {
    // BOLD_EXACT is the load-bearing one: it decides whether a split part is a bold RUN. Mutating
    // only BOLD is harmless precisely because BOLD_EXACT re-checks with the same character class —
    // which is the point of having it, and why the first version of this mutation tested nothing.
    name: 'THE BUG: bold matching across an inner asterisk',
    text: (s) => s.replace('const BOLD_EXACT = /^\\*\\*[^*]+\\*\\*$/;', 'const BOLD_EXACT = /^\\*\\*.+\\*\\*$/;'),
  },
  {
    name: 'the shape re-tested by hand instead of with the same pattern',
    text: (s) =>
      s.replace(
        'BOLD_EXACT.test(part)',
        "part.startsWith('**') && part.endsWith('**') && part.length > 4",
      ),
  },
  {
    name: 'newlines stripped from the AI reply',
    text: (s) => s.replace('  return String(text)', "  return String(text).replace(/\\n/g, ' ')"),
  },
  {
    name: 'takePhoto forcing the avatar 1:1 crop',
    src: (k, s) =>
      k === 'picker'
        ? s.replace("    quality: 0.9, // Re-encoded by utils/doubtImage anyway; keep detail for the OCR until then.", '    allowsEditing: true,\n    aspect: [1, 1],\n    quality: 0.9,')
        : s,
  },
  {
    name: 'the camera route removed entirely',
    src: (k, s) => (k === 'picker' ? s.replace('export async function takePhoto', 'async function unusedTakePhoto') : s),
  },
  {
    name: 'DoubtSheet mounted even when closed',
    src: (k, s) => (k === 'bar' ? s.replace('{doubtOpen ? (', '{true ? (') : s),
  },
  {
    name: 'THE BUG: the sheet opened before the capture (captures behind a Modal)',
    src: (k, s) =>
      k === 'bar'
        ? s.replace(
            '    let shot = null;\n    if (contentRef?.current) {',
            '    setDoubtOpen(true);\n    let shot = null;\n    if (contentRef?.current) {',
          )
        : s,
  },
  {
    name: 'the server moving a stage gate the client still assumes',
    java: (k, s) => (k === 'service' ? s.replace('requireStage(session, 4)', 'requireStage(session, 3)') : s),
  },
  {
    name: 'the controller renaming the file param',
    java: (k, s) => (k === 'controller' ? s.replace('@RequestParam("file")', '@RequestParam("photo")') : s),
  },
];

console.log('Self-tests (each mutation must be caught):');
for (const m of MUTATIONS) {
  let caught;
  try {
    const [pack, text] = await Promise.all([loadService(m.service), loadText(m.text)]);
    const problems = await assertions(pack, text, loadSources(m.src, m.service, m.text), loadJava(m.java));
    caught = problems.length > 0;
  } catch {
    caught = true;
  }
  if (caught) ok(m.name);
  else fail(`NOT CAUGHT: ${m.name} — the corresponding assertion is vacuous`);
}

console.log('\nDoubt Resolution:');
{
  const [pack, text] = await Promise.all([loadService(), loadText()]);
  const problems = await assertions(pack, text, loadSources(), loadJava());
  if (problems.length === 0) {
    ok('multipart part names match the controller\'s @RequestParams; context goes in `fields`');
    ok('every stage carries an explicit timeout; create and resolution carry the longer one');
    ok('a subject mismatch is handled as a 200 with a null session, before session is read');
    ok('stage responses are MERGED; a timed-out call re-GETs rather than re-POSTing');
    ok('every image is re-encoded to JPEG and capped — HEIC and 8 MB photos both survive');
    ok('markdown-lite matches the web: **a*b** and a lone ** stay literal, newlines preserved');
    ok('camera and gallery routes exist and neither crops');
  } else problems.forEach(fail);
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL — ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
