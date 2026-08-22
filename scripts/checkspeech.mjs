// Speech / Sound Studio checker.
//
//   node scripts/checkspeech.mjs
//
// WHY THIS EXISTS. Sound Studio shipped silent, and nothing anywhere reported it:
//
//   * `synthesizeToFile` sent `en-US` to /api/v1/translate/tts, which only accepts the two-letter
//     codes in SupportedLanguage.java — a 400 on every call;
//   * both /tts and /speech/assess were guarded to three of the five student roles, so a college
//     student got 403 on playback AND scoring;
//   * every one of those failures was swallowed by a bare `catch {}` justified as "best-effort".
//
// A build cannot see a wrong VALUE, and a checker that only reads the app cannot see that the value
// disagrees with a Java enum. So the language codes and the role lists are BOTH extracted from the
// backend and compared.
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
  speechService: 'services/student/speechService.js',
  voiceHook: 'hooks/useShreyaVoice.js',
  detailPanel: 'components/student/languagepro/PhonemeDetailPanel.js',
  soundStudio: 'components/student/languagepro/SoundStudio.js',
  recorder: 'hooks/useVoiceRecorder.js',
};

const JAVA_SRC = {
  translate: path.join('translate', 'controller', 'TranslateController.java'),
  speech: path.join('speech', 'controller', 'SpeechController.java'),
  languages: path.join('translate', 'model', 'SupportedLanguage.java'),
  counselorQuery: path.join('student', 'controller', 'StudentCounselorQueryController.java'),
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
 * Load-bearing here: speechService's docblock spells out BOTH conventions ("en" and "en-US") while
 * explaining that they must not be unified, so a naive grep for 'en-US' finds the documentation.
 */
const codeOnly = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** The two-letter codes SupportedLanguage.java actually declares. */
function supportedLanguages(mutate) {
  let src = read(path.join(JAVA, JAVA_SRC.languages));
  if (mutate) src = mutate(src);
  // Enum constants carry their code as the first string literal: HINDI("hi", …).
  const codes = new Set();
  for (const m of src.matchAll(/^\s*[A-Z_]+\(\s*"([a-z-]+)"/gm)) codes.add(m[1]);
  return codes;
}

/**
 * The student roles the @PreAuthorize on ONE endpoint names.
 *
 * Bounded by the method signature, not by a character count. A fixed window was the first version
 * and it silently found no guard at all: the five-role string is ~150 characters, so the guard sat
 * just past the end of it — and a checker that reports "no guard" for a guard that exists is worse
 * than none.
 */
function rolesIn(src, mappingMarker) {
  const at = src.indexOf(mappingMarker);
  if (at < 0) return null;
  const endOfMethodHead = src.indexOf('public ', at);
  if (endOfMethodHead < 0) return null;
  const between = src.slice(at, endOfMethodHead);
  const guard = between.match(/@PreAuthorize\("([^"]+)"\)/)?.[1];
  if (!guard) return null;
  return new Set([...guard.matchAll(/hasRole\('([A-Z_]+)'\)/g)].map((m) => m[1]));
}

async function loadService(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'speech-'));
  let src = read(path.join(APP, SRC.speechService));
  if (mutate) src = mutate(src);
  // Strip the transport and the filesystem — only the exported constants are evaluated.
  src = src
    .replace(/^import .*expo-file-system.*$/m, 'const FileSystem = { cacheDirectory: "/tmp/" };')
    .replace(/^import \{ studentApi \}.*$/m, 'const studentApi = {};');
  const file = path.join(dir, 'speechService.mjs');
  fs.writeFileSync(file, src);
  return import(`${pathToFileURL(file).href}?t=${Math.random()}`);
}

async function loadCatalog(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cat-'));
  let src = read(path.join(APP, 'constants', 'phonemeCatalog.js'));
  if (mutate) src = mutate(src);
  const file = path.join(dir, 'catalog.mjs');
  fs.writeFileSync(file, src);
  return import(`${pathToFileURL(file).href}?t=${Math.random()}`);
}

/**
 * @param mutate       applied to every source file, keyed by name
 * @param mutateService applied to speechService.js ON TOP of that.
 *
 * The second parameter exists because a `service:` mutation edits the module that gets EVALUATED,
 * and the source assertions read the file separately — so without it a service mutation changed the
 * evaluated constants while the text assertions kept reading the pristine file, and two mutations
 * "passed" while testing nothing.
 */
function loadSources(mutate, mutateService) {
  const out = {};
  for (const [key, rel] of Object.entries(SRC)) {
    let text = read(path.join(APP, rel));
    if (mutate) text = mutate(key, text);
    if (mutateService && key === 'speechService') text = mutateService(text);
    out[key] = text;
  }
  return out;
}

function loadJava(mutate) {
  const out = {};
  for (const [key, rel] of Object.entries(JAVA_SRC)) {
    out[key] = mutate ? mutate(key, read(path.join(JAVA, rel))) : read(path.join(JAVA, rel));
  }
  return out;
}

/** The chart axes, copied from SoundStudio.js — a phoneme off these axes renders nowhere. */
const MANNERS = ['stop', 'nasal', 'fricative', 'affricate', 'approximant'];
const PLACES = ['lips', 'teeth', 'ridge', 'back'];
const VOWEL_ROWS = ['high', 'mid', 'low'];
const VOWEL_COLS = ['front', 'central', 'back'];

function assertions(service, catalog, langs, src, java) {
  const out = [];
  const bad = (m) => out.push(m);

  // ── 1. THE BUG THAT MADE IT SILENT ────────────────────────────────────────
  // TTS goes through our own SupportedLanguage enum, which holds only two-letter codes.
  if (langs.size < 10) bad(`SupportedLanguage extractor found only ${langs.size} codes — check it`);
  if (!langs.has(service.TTS_LANGUAGE)) {
    bad(
      `TTS_LANGUAGE is "${service.TTS_LANGUAGE}", which SupportedLanguage.java does not declare — ` +
        `/api/v1/translate/tts answers 400 UNSUPPORTED_LANGUAGE. Valid: ${[...langs].join(', ')}`,
    );
  }

  // ── 2. ...AND THE CONVENTION IT MUST NOT BE UNIFIED WITH ──────────────────
  // Azure wants BCP-47. Making these two agree "for consistency" breaks whichever one loses.
  if (service.ASSESS_LANGUAGE !== 'en-US') {
    bad(`ASSESS_LANGUAGE is "${service.ASSESS_LANGUAGE}" — Azure wants the BCP-47 tag en-US`);
  }
  if (service.TTS_LANGUAGE === service.ASSESS_LANGUAGE) {
    bad('TTS_LANGUAGE and ASSESS_LANGUAGE are equal — they are two different vocabularies');
  }
  const svc = codeOnly(src.speechService);
  if (!/synthesizeToFile\([^)]*language = TTS_LANGUAGE/.test(svc)) {
    bad('synthesizeToFile no longer defaults to TTS_LANGUAGE');
  }
  if (!/assessPronunciation\([^)]*language = ASSESS_LANGUAGE/.test(svc)) {
    bad('assessPronunciation no longer defaults to ASSESS_LANGUAGE');
  }
  // The voice hook had the same wrong default; it must share the constant, not restate a literal.
  const hook = codeOnly(src.voiceHook);
  if (!/language = TTS_LANGUAGE/.test(hook)) {
    bad('useShreyaVoice does not default to TTS_LANGUAGE — Learn with Shreya goes silent again');
  }
  if (/'en-US'/.test(hook)) bad('useShreyaVoice hardcodes en-US — that is the TTS bug returning');

  // ── 3. FAILURES MUST BE VISIBLE ───────────────────────────────────────────
  // A bare `catch {}` on the speak path is what hid all of this.
  const panel = codeOnly(src.detailPanel);
  if (/catch\s*\{\s*\}/.test(panel)) {
    bad('PhonemeDetailPanel has a bare `catch {}` — that is exactly what hid the silent TTS');
  }
  // Look inside say()'s CATCH, not the whole function: `showToast` also appears in its dependency
  // array, so a block-wide includes() stayed true after the report was deleted.
  const sayBlock = panel.slice(panel.indexOf('const say'), panel.indexOf('const toggleRecord'));
  const sayCatchAt = sayBlock.indexOf('} catch');
  const sayCatch = sayCatchAt < 0 ? '' : sayBlock.slice(sayCatchAt, sayBlock.indexOf('} finally', sayCatchAt));
  if (!sayCatch.includes('showToast')) {
    bad('the speak path does not report its failure — a tap that does nothing looks like a dead button');
  }
  if (/catch\s*\{\s*\}/.test(hook)) bad('useShreyaVoice swallows its failure silently again');
  if (!hook.includes('setError')) bad('useShreyaVoice no longer records why a line failed');
  if (!/\berror\b/.test(hook.slice(hook.lastIndexOf('return {')))) {
    bad('useShreyaVoice does not expose `error`, so no screen can surface it');
  }
  // The scoring failure has to name the cause, or the three candidates are indistinguishable.
  const catchAt = panel.indexOf('} catch (e) {', panel.indexOf('const toggleRecord'));
  const scoreCatch = catchAt < 0 ? '' : panel.slice(catchAt, panel.indexOf('} finally {', catchAt));
  if (!scoreCatch.includes('take.type')) {
    bad('a failed assess does not report the audio format sent — 403 / 415 / codec look identical');
  }
  // The CONDITIONAL, not the word: `e.status` also appears inside the message template, so a bare
  // includes('status') stayed true after the branch was disabled.
  if (!/e\?\.status\s*\?/.test(scoreCatch)) {
    bad('a failed assess does not report the HTTP status — that is what separates 403 from 415');
  }

  // ── 4. BOTH ENDPOINTS MUST ACCEPT ALL FIVE STUDENT ROLES ──────────────────
  const canonical = rolesIn(java.counselorQuery, '@PostMapping("/counselor-queries")');
  if (!canonical || canonical.size !== 5) {
    bad(`could not read the canonical five-role list (got ${canonical ? canonical.size : 'null'})`);
  } else {
    for (const [name, key, marker] of [
      ['/api/v1/translate/tts', 'translate', '@PostMapping("/tts")'],
      ['/api/v1/speech/assess', 'speech', '@PostMapping(value = "/assess"'],
    ]) {
      const roles = rolesIn(java[key], marker);
      if (!roles) {
        bad(`no @PreAuthorize found for ${name}`);
        continue;
      }
      const missing = [...canonical].filter((r) => !roles.has(r));
      if (missing.length) {
        bad(`${name} refuses ${missing.join(', ')} — those students get 403`);
      }
    }
  }

  // ── 5. referenceText is a form field, not a document part ─────────────────
  if (/@RequestPart\(\s*value\s*=\s*"referenceText"/.test(java.speech)) {
    bad('referenceText is back on @RequestPart — RN sends it with no Content-Type, risking a 415');
  }
  if (!/@RequestParam\(\s*value\s*=\s*"referenceText"/.test(java.speech)) {
    bad('referenceText is not bound with @RequestParam');
  }
  // ...but the audio genuinely is a file and must stay @RequestPart.
  if (!/@RequestPart\("audio"\)/.test(java.speech)) {
    bad('the audio part is no longer @RequestPart — a MultipartFile needs it');
  }

  // ── 6. the chart still resolves ───────────────────────────────────────────
  const { CONSONANTS = [], VOWELS = [], DIPHTHONGS = [] } = catalog;
  if (CONSONANTS.length + VOWELS.length + DIPHTHONGS.length < 35) {
    bad(`the phoneme catalogue holds only ${CONSONANTS.length + VOWELS.length + DIPHTHONGS.length} sounds`);
  }
  for (const p of CONSONANTS) {
    if (!MANNERS.includes(p.manner) || !PLACES.includes(p.place)) {
      bad(`consonant ${p.id} (${p.manner}/${p.place}) lands on no chart cell — it renders nowhere`);
    }
  }
  for (const p of VOWELS) {
    if (!VOWEL_ROWS.includes(p.gridPos?.row) || !VOWEL_COLS.includes(p.gridPos?.col)) {
      bad(`vowel ${p.id} lands on no chart cell — it renders nowhere`);
    }
  }
  // SoundCell reads examples[0].word with no guard.
  for (const p of [...CONSONANTS, ...VOWELS, ...DIPHTHONGS]) {
    if (!p.examples?.[0]?.word) bad(`phoneme ${p.id} has no examples[0].word — SoundCell throws`);
  }

  // ── 7. the Android recording contract ─────────────────────────────────────
  // Not a correctness claim — AMR-WB is still unverified against Azure — but the pieces have to
  // agree with each other, or the Content-Type lies about the bytes.
  const rec = codeOnly(src.recorder);
  if (!/outputFormat: Audio\.AndroidOutputFormat\.AMR_WB/.test(rec)
    || !/audioEncoder: Audio\.AndroidAudioEncoder\.AMR_WB/.test(rec)) {
    bad('the Android container and encoder no longer agree — Android silently falls back');
  }
  if (!/android: 'audio\/amr-wb'/.test(rec)) {
    bad('the Android MIME no longer matches the encoder — Azure is told the wrong format');
  }
  // Scoped to the ANDROID block: iOS also records mono, so a file-wide match stayed true when only
  // Android was switched to stereo.
  const androidAt = rec.indexOf('android: {');
  const androidBlock = androidAt < 0 ? '' : rec.slice(androidAt, rec.indexOf('ios: {', androidAt));
  if (!/numberOfChannels: 1/.test(androidBlock)) {
    bad('Android AMR is not mono — numberOfChannels must be 1 or the encoder rejects it');
  }

  return out;
}

const MUTATIONS = [
  {
    name: 'THE BUG: TTS_LANGUAGE set back to the BCP-47 tag',
    service: (s) => s.replace("TTS_LANGUAGE = 'en'", "TTS_LANGUAGE = 'en-US'"),
  },
  {
    name: 'TTS_LANGUAGE set to a code the backend enum does not declare',
    service: (s) => s.replace("TTS_LANGUAGE = 'en'", "TTS_LANGUAGE = 'eng'"),
  },
  {
    name: 'the two conventions unified "for consistency"',
    service: (s) => s.replace("ASSESS_LANGUAGE = 'en-US'", "ASSESS_LANGUAGE = 'en'"),
  },
  {
    name: 'synthesizeToFile hardcoding a literal again',
    service: (s) => s.replace('language = TTS_LANGUAGE', "language = 'en-US'"),
  },
  {
    name: 'assessPronunciation losing the Azure locale',
    service: (s) => s.replace('language = ASSESS_LANGUAGE', "language = 'en'"),
  },
  {
    name: 'useShreyaVoice reverting to its en-US default',
    src: (k, s) => (k === 'voiceHook' ? s.replace('language = TTS_LANGUAGE', "language = 'en-US'") : s),
  },
  {
    name: 'the speak path swallowing its error again',
    src: (k, s) =>
      k === 'detailPanel'
        ? s.replace("showToast?.(e?.message || 'That word could not be played.', 'error');", '')
        : s,
  },
  {
    name: 'a bare catch {} restored in the panel',
    src: (k, s) =>
      k === 'detailPanel' ? s.replace('} catch (e) {', '} catch {}\n      if (false) {') : s,
  },
  {
    name: 'useShreyaVoice dropping its error state',
    src: (k, s) => (k === 'voiceHook' ? s.replaceAll('setError', 'noop') : s),
  },
  {
    // Strips `error` from the hook's return WHATEVER else it exposes. The first version matched the
    // exact return line, so adding pause/resume to the hook turned this mutation into a no-op and
    // it silently stopped testing anything. Never pin a mutation to an unrelated part of the line.
    name: 'useShreyaVoice no longer exposing error to screens',
    src: (k, s) =>
      k === 'voiceHook'
        ? s.replace(/(return \{[^}]*?),?\s*\berror\b(\s*\};)/, '$1$2')
        : s,
  },
  {
    // replaceAll: the format appears in BOTH branches of the message, so replacing one left the
    // other in place and the mutation tested nothing.
    name: 'a failed assess hiding the audio format',
    src: (k, s) => (k === 'detailPanel' ? s.replaceAll('sent ${take.type}', 'sent audio') : s),
  },
  {
    name: 'a failed assess hiding the HTTP status',
    src: (k, s) => (k === 'detailPanel' ? s.replace('e?.status ?', 'false ?') : s),
  },
  {
    name: 'college students refused by /tts again',
    java: (k, s) =>
      k === 'translate'
        ? s.replace(
            "@PostMapping(\"/tts\")\n    @PreAuthorize(\"hasRole('FREE_STUDENT') or hasRole('SCHOOL_STUDENT') or hasRole('PREMIUM_STUDENT') or hasRole('COLLEGE_STUDENT') or hasRole('FREE_COLLEGE_STUDENT')\")",
            "@PostMapping(\"/tts\")\n    @PreAuthorize(\"hasRole('FREE_STUDENT') or hasRole('SCHOOL_STUDENT') or hasRole('PREMIUM_STUDENT')\")",
          )
        : s,
  },
  {
    name: 'college students refused by /speech/assess again',
    java: (k, s) =>
      k === 'speech'
        ? s.replace(
            "or hasRole('PREMIUM_STUDENT') or hasRole('COLLEGE_STUDENT') or hasRole('FREE_COLLEGE_STUDENT')\")\n    public ResponseEntity<?> assess",
            "or hasRole('PREMIUM_STUDENT')\")\n    public ResponseEntity<?> assess",
          )
        : s,
  },
  {
    name: 'referenceText moved back to @RequestPart (the 415 risk)',
    java: (k, s) =>
      k === 'speech'
        ? s.replace('@RequestParam(value = "referenceText"', '@RequestPart(value = "referenceText"')
        : s,
  },
  {
    name: 'the audio part downgraded from @RequestPart',
    java: (k, s) => (k === 'speech' ? s.replace('@RequestPart("audio")', '@RequestParam("audio")') : s),
  },
  {
    name: 'a phoneme given a chart coordinate the grid has no column for',
    catalog: (s) => s.replace('"place": "ridge"', '"place": "alveolar"'),
  },
  {
    name: 'a phoneme stripped of its example word',
    catalog: (s) => s.replace(/"examples": \[\s*\{\s*"word": "pen",[\s\S]*?\],/, '"examples": [],'),
  },
  {
    name: 'the Android encoder and container disagreeing',
    src: (k, s) =>
      k === 'recorder'
        ? s.replace('audioEncoder: Audio.AndroidAudioEncoder.AMR_WB', 'audioEncoder: Audio.AndroidAudioEncoder.AAC')
        : s,
  },
  {
    name: 'the Android MIME lying about the codec',
    src: (k, s) => (k === 'recorder' ? s.replace("android: 'audio/amr-wb'", "android: 'audio/m4a'") : s),
  },
  {
    name: 'AMR recorded in stereo (the encoder rejects it)',
    src: (k, s) => (k === 'recorder' ? s.replace('numberOfChannels: 1', 'numberOfChannels: 2') : s),
  },
];

console.log('Self-tests (each mutation must be caught):');
for (const m of MUTATIONS) {
  let caught;
  try {
    const [service, catalog] = await Promise.all([loadService(m.service), loadCatalog(m.catalog)]);
    caught =
      assertions(
        service,
        catalog,
        supportedLanguages(m.languages),
        loadSources(m.src, m.service),
        loadJava(m.java),
      ).length > 0;
  } catch {
    caught = true; // a mutation that will not even load is caught, loudly
  }
  if (caught) ok(m.name);
  else fail(`NOT CAUGHT: ${m.name} — the corresponding assertion is vacuous`);
}

console.log('\nSpeech / Sound Studio:');
{
  const [service, catalog] = await Promise.all([loadService(), loadCatalog()]);
  const langs = supportedLanguages();
  const problems = assertions(service, catalog, langs, loadSources(), loadJava());
  if (problems.length === 0) {
    const { CONSONANTS, VOWELS, DIPHTHONGS } = catalog;
    ok(
      `TTS "${service.TTS_LANGUAGE}" (of ${langs.size} backend codes) vs Azure "${service.ASSESS_LANGUAGE}"; ` +
        `both endpoints open to all 5 student roles; ` +
        `${CONSONANTS.length + VOWELS.length + DIPHTHONGS.length} phonemes all on the chart`,
    );
  } else problems.forEach(fail);
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL — ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
