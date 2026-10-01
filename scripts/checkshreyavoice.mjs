// Shreya's voice inside the shared chat sheet.
//
//   node scripts/checkshreyavoice.mjs
//
// WHY THIS EXISTS. On the website "Shreya Speak" used to sit in each panel's title bar AND the
// chatbot sat bottom-right — two Shreyas. It now lives in ONE place, the chat header, reading
// Shreya's latest reply. The app got the same button in `components/staff/ShreyaChatSheet.js`,
// which serves the teacher, Shreyartha teacher, principal, parent, student and partner portals.
// Every way this goes wrong is silent to `expo export`:
//
//   * a button with no `client` sends studentApi, which reads no parent/partner/staff token and
//     signs the user OUT on the 401 — a tap that ends someone's session;
//   * without `key={turn}` a new reply leaves the old clip paused inside the button, and the next
//     tap RESUMES the previous answer;
//   * the sheet is kept mounted while hidden in two places, so closing it is not an unmount — Shreya
//     keeps talking behind a closed sheet unless the open→closed edge stops her;
//   * the Principal's role (SCHOOL_ADMIN) is refused by /api/v1/translate/tts: a button there
//     would 403 on every tap;
//   * on the dark header the palette's `deep` is dark-on-dark, and two palettes lack it entirely;
//   * the teacher's quick actions were hard-coded for every portal, sending a parent to /homework.
//
// Exit code 0 = pass.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const JAVA = path.resolve(APP, '..', 'backendmain', 'src', 'main', 'java', 'com', 'shreyartha', 'backend');

const SRC = {
  sheet: 'components/staff/ShreyaChatSheet.js',
  speakButton: 'components/student/ai/ShreyaSpeakButton.js',
  staffConfigs: 'components/staff/home/shreyaConfigs.js',
  parentConfig: 'constants/parentChatbotConfig.js',
  studentConfig: 'constants/studentChatbotConfig.js',
  partnerConfig: 'constants/partnerChatbotConfig.js',
  latestTurn: 'utils/latestShreyaTurn.js',
  mic: 'components/staff/ShreyaChatMic.js',
  dictation: 'hooks/useChatDictation.js',
  transcribe: 'services/shared/transcribeService.js',
  appJson: 'app.json',
};

/** The backend guards the microphone depends on — read, not assumed. */
const JAVA_SRC = {
  transcribeController: path.join('speech', 'controller', 'SpeechTranscriptionController.java'),
  speechController: path.join('speech', 'controller', 'SpeechController.java'),
};

let failures = 0;
const fail = (m) => {
  failures += 1;
  console.error(`  ✗ ${m}`);
};
const ok = (m) => console.log(`  ✓ ${m}`);

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

/** Leading-boundary form: the naive block-comment regex eats `'audio/*'`. See checkdesign.mjs. */
const codeOnly = (t) => t.replace(/(^|\s)\/\*[\s\S]*?\*\//g, '$1').replace(/^\s*\/\/.*$/gm, '');

function loadSources(mutate) {
  const out = {};
  for (const [k, rel] of Object.entries(SRC)) {
    out[k] = mutate ? mutate(k, read(path.join(APP, rel))) : read(path.join(APP, rel));
  }
  return out;
}

function loadJava(mutate) {
  const out = {};
  for (const [k, rel] of Object.entries(JAVA_SRC)) {
    const text = read(path.join(JAVA, rel));
    out[k] = mutate ? mutate(k, text) : text;
  }
  return out;
}

/**
 * The roles one endpoint's @PreAuthorize names — bounded by the method signature, not a character
 * count (see checkspeech.mjs for why a fixed window once found "no guard" for a guard that exists).
 */
function rolesIn(src, mappingMarker) {
  const at = src.indexOf(mappingMarker);
  if (at < 0) return null;
  const end = src.indexOf('public ', at);
  const guard = src.slice(at, end < 0 ? undefined : end).match(/@PreAuthorize\("([^"]+)"\)/)?.[1];
  return guard ? new Set([...guard.matchAll(/hasRole\('([A-Z_]+)'\)/g)].map((m) => m[1])) : null;
}

/** utils/latestShreyaTurn.js, evaluated from the (possibly mutated) source text. */
async function loadLatestTurn(text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'turn-'));
  const file = path.join(dir, 'latestShreyaTurn.mjs');
  fs.writeFileSync(file, text);
  return import(`${pathToFileURL(file).href}?t=${Math.random()}`);
}

// The query is not part of the screen: `/counselling-report?tab=notes` is app/parent/counselling-report.js.
const screenExists = (portal, suffix) =>
  fs.existsSync(path.join(APP, 'app', portal, `${suffix.split('?')[0].replace(/^\//, '')}.js`));

function assertions(src, java, turnModule) {
  const out = [];
  const bad = (m) => out.push(m);
  const sheet = codeOnly(src.sheet);
  const button = codeOnly(src.speakButton);
  const dictation = codeOnly(src.dictation);
  const transcribe = codeOnly(src.transcribe);

  /* ── 1. WHAT IT READS ────────────────────────────────────────────────────── */
  const { latestShreyaTurn } = turnModule;
  if (typeof latestShreyaTurn !== 'function') {
    bad('utils/latestShreyaTurn.js no longer exports latestShreyaTurn');
  } else {
    const bot = (text, extra = {}) => ({ sender: 'bot', text, ...extra });
    const user = (text) => ({ sender: 'user', text });
    const cases = [
      [[bot('old', { history: true }), { divider: true }, bot('Hi Ravi')], 'Hi Ravi', 'reads history above the divider'],
      [[bot('Hi'), user('Fees'), bot('**Nothing** due.'), bot('Want to go deeper?')],
        'Nothing due.\n\nWant to go deeper?', 'does not join a summary with its prompt, or keeps the ** markers'],
      [[bot('Hi'), user('Fees'), { sender: 'bot', typing: true }], '', 'reads something while Shreya is still typing'],
    ];
    for (const [messages, want, why] of cases) {
      if (latestShreyaTurn(messages) !== want) bad(`latestShreyaTurn ${why}`);
    }
  }

  /* ── 2. THE HEADER BUTTON ────────────────────────────────────────────────── */
  const use = sheet.match(/<ShreyaSpeakButton\b[\s\S]*?\/>/);
  if (!use) {
    bad('the chat sheet has no Shreya Speak — the header is where read-aloud lives for the chat');
  } else {
    const jsx = use[0];
    if (!/client=\{ttsClient\}/.test(jsx)) {
      bad('the header Shreya Speak sends studentApi — a parent, partner or staff tap would sign them out');
    }
    if (!/key=\{turn\}/.test(jsx)) {
      bad('the header Shreya Speak is not keyed by the turn — after a new reply a tap resumes the OLD answer');
    }
    if (!/text=\{turn\}/.test(jsx)) bad("the header Shreya Speak does not read Shreya's latest turn");
    if (!/variant="onDark"/.test(jsx)) bad('the header Shreya Speak uses the light pill on the dark header');
  }
  if (!/const turn = useMemo\(\(\) => latestShreyaTurn\(messages\)/.test(sheet)) {
    bad("the sheet no longer derives the spoken text from Shreya's latest turn");
  }
  if (!/voiceEnabled && step !== 'loading' \? \(\s*<ShreyaSpeakButton/.test(sheet)) {
    bad('Shreya Speak is no longer gated on config.voice — the Principal would get a button that 403s');
  }
  if (!/const voiceEnabled = config\?\.voice !== false;/.test(sheet)) {
    bad('config.voice is no longer read — the Principal cannot turn the 403ing button off');
  }

  /* ── 3. CLOSING THE SHEET SILENCES HER ───────────────────────────────────── */
  if (!/if \(wasVisibleRef\.current && !visible\) stopActiveAudio\(\);/.test(sheet)) {
    bad('closing the sheet does not stop the audio — it stays mounted in two places, so Shreya talks on');
  }

  /* ── 4. THE PRINCIPAL HAS NO VOICE ───────────────────────────────────────── */
  const principal = codeOnly(src.staffConfigs).match(/\n {2}principal: \{[\s\S]*?\n {2}\},/)?.[0] || '';
  if (!/voice: false/.test(principal)) {
    bad('the Principal config has voice on — /api/v1/translate/tts refuses SCHOOL_ADMIN, every tap 403s');
  }

  /* ── 5. THE BUTTON ON A DARK HEADER ──────────────────────────────────────── */
  if (!/const iconColor = onDark \? '#ffffff' : palette\.deep;/.test(button)) {
    bad("the on-dark button still paints its icons with palette.deep — dark on dark, and black where the palette lacks it");
  }
  if (!/\{!onMessage && message \?/.test(button)) {
    bad('the button renders its own notice even when the sheet asked for it — the header grows a line');
  }

  /* ── 6. EVERY PORTAL'S SHORTCUTS EXIST IN THAT PORTAL ────────────────────── */
  if (/'\/homework'/.test(sheet.replace(/const TEACHER_QUICK_ACTIONS = \[[\s\S]*?\];/, ''))) {
    bad("the teacher's shortcuts are hard-coded outside TEACHER_QUICK_ACTIONS again");
  }
  if (!/quickActions\.map\(/.test(sheet)) bad('the free-chat shortcuts no longer come from config.quickActions');
  for (const [key, portal] of [['parentConfig', 'parent'], ['partnerConfig', 'partner'], ['studentConfig', 'student']]) {
    const text = codeOnly(src[key]);
    if (!/quickActions:/.test(text)) {
      bad(`${SRC[key]} has no quickActions — the sheet would offer that portal the teacher's /homework`);
    }
    for (const m of text.matchAll(/suffix: '([^']+)'/g)) {
      if (!screenExists(portal, m[1])) bad(`${SRC[key]} offers /${portal}${m[1]}, which has no screen`);
    }
  }

  /* ── 7. THE MICROPHONE ───────────────────────────────────────────────────── */
  // Mounted for the whole of free chat, gated on config.voice ONLY: gated on its own state it would
  // mount and unmount beside the focused input (which drops the Android keyboard), and ungated the
  // Principal gets a mic whose every upload is refused.
  if (!/\{voiceEnabled \? \(\s*<ShreyaChatMic\b/.test(sheet)) {
    bad('the mic is not gated on config.voice alone — the Principal gets one, or it remounts beside the input');
  }
  const micUse = sheet.match(/<ShreyaChatMic\b[\s\S]*?\/>/)?.[0] || '';
  if (!/onTranscript=\{appendTranscript\}/.test(micUse)) bad("the mic's words never reach the text box");
  if (!/onStatus=\{setMicStatus\}/.test(micUse)) bad('the sheet cannot see the mic, so nothing stops Shreya talking into it');
  if (!/languageCode=\{languageCodeOf\(language\)\}/.test(micUse)) {
    bad('the mic does not send the page language as a CODE — every question would be heard as English');
  }
  // Never sent by itself: mis-heard speech must be seen before Shreya answers it.
  const append = sheet.match(/const appendTranscript = useCallback\([\s\S]*?\}, \[\]\);/)?.[0] || '';
  if (!append) bad('appendTranscript is gone — the transcript has nowhere to land');
  else if (/submit\(|sendChatMessage/.test(append)) bad('a spoken question is sent without the user seeing it');
  if (!/disabled=\{!turn \|\| micStatus\.active\}/.test(sheet)) {
    bad('Shreya Speak stays live while someone is dictating — she would be recorded into the question');
  }
  if (!/editable=\{!sending && !micStatus\.active\}/.test(sheet)) {
    bad('the text box stays editable while listening — typed text and the transcript would collide');
  }

  // Transcribed from lastRecording, once per take, and never delivered late.
  if (!/const take = lastRecording;/.test(dictation)) {
    bad('dictation no longer reads the take from lastRecording — an auto-stopped take (stop() returns null) is lost');
  }
  if (!/transcribeSpeech\(take, languageCode\)/.test(dictation)) bad('dictation no longer transcribes the finished take');
  if (!/handledRef\.current === take/.test(dictation)) {
    bad('a take can be transcribed twice — a manual stop and lastRecording both fire');
  }
  if (!/epochRef\.current !== epoch/.test(dictation)) {
    bad('an answer arriving after cancel, a new take or unmount is still put in the box');
  }

  // The transport: the neutral client, the new endpoint.
  if (/studentApi/.test(transcribe)) {
    bad('transcription goes through studentApi — a parent, partner or staff tap would sign them out');
  }
  if (!/ttsClient\.multipart\(/.test(transcribe)) bad('transcription no longer uses the neutral client');
  if (!/'\/api\/v1\/speech\/transcribe'/.test(transcribe)) bad('transcription no longer posts to /api/v1/speech/transcribe');

  // The server has to agree, or every tap is a 403 no build can see.
  for (const [name, key, marker] of [
    ['/api/v1/speech/transcribe', 'transcribeController', '@PostMapping(value = "/transcribe"'],
    ['/api/v1/speech/token', 'speechController', '@GetMapping("/token")'],
  ]) {
    const roles = rolesIn(java[key], marker);
    if (!roles) {
      bad(`no @PreAuthorize found for ${name}`);
      continue;
    }
    for (const role of ['PARENT', 'TEACHER', 'PARTNER', 'SCHOOL_STUDENT']) {
      if (!roles.has(role)) bad(`${name} refuses ${role} — that panel's microphone 403s`);
    }
    if (roles.has('SCHOOL_ADMIN')) bad(`${name} admits SCHOOL_ADMIN, but the Principal has no voice anywhere`);
  }

  // App Review reads the prompt; it must describe what the mic is for now.
  let plist = '';
  try {
    plist = JSON.parse(src.appJson)?.expo?.ios?.infoPlist?.NSMicrophoneUsageDescription || '';
  } catch {
    bad('app.json does not parse');
  }
  // A WORD match: the prompt always begins "Shreyartha uses…", so a bare /Shreya/ was satisfied by
  // the brand name and passed with the sentence deleted — caught by this file's own self-test.
  if (!/\bShreya\b/.test(plist)) bad('the iOS microphone prompt does not mention asking Shreya by voice');

  return out;
}

const MUTATIONS = [
  {
    name: 'latestShreyaTurn walking past the history divider',
    src: (k, s) => (k === 'latestTurn' ? s.replace("if (!msg || msg.divider || msg.sender === 'user') break;", "if (!msg || msg.sender === 'user') break;") : s),
  },
  {
    name: 'latestShreyaTurn keeping the ** markers',
    src: (k, s) => (k === 'latestTurn' ? s.replace(".replace(/\\*\\*/g, '')", '') : s),
  },
  {
    name: 'the header button sending studentApi (no client)',
    src: (k, s) => (k === 'sheet' ? s.replace('client={ttsClient}', '') : s),
  },
  {
    name: 'the header button not keyed by the turn',
    src: (k, s) => (k === 'sheet' ? s.replace('key={turn}', '') : s),
  },
  {
    name: 'the header button shown to the Principal regardless of config.voice',
    src: (k, s) => (k === 'sheet' ? s.replace("voiceEnabled && step !== 'loading' ? (", "step !== 'loading' ? (") : s),
  },
  {
    name: 'closing the sheet leaving Shreya talking',
    src: (k, s) => (k === 'sheet' ? s.replace('if (wasVisibleRef.current && !visible) stopActiveAudio();', 'if (false) stopActiveAudio();') : s),
  },
  {
    name: 'the Principal given a voice that 403s',
    src: (k, s) => (k === 'staffConfigs' ? s.replace('voice: false,', 'voice: true,') : s),
  },
  {
    name: 'the on-dark icons painted with palette.deep again',
    src: (k, s) => (k === 'speakButton' ? s.replace("const iconColor = onDark ? '#ffffff' : palette.deep;", 'const iconColor = palette.deep;') : s),
  },
  {
    name: 'the teacher shortcuts hard-coded into the sheet again',
    src: (k, s) => (k === 'sheet' ? s.replace('{quickActions.map((action) => (', "{[{ label: 'x', suffix: '/homework' }].map((action) => (") : s),
  },
  {
    name: 'a parent shortcut to a screen the parent app does not have',
    src: (k, s) => (k === 'parentConfig' ? s.replace("suffix: '/counselling-report?tab=report'", "suffix: '/homework'") : s),
  },
  {
    name: 'the student config falling back to the teacher shortcuts',
    src: (k, s) => (k === 'studentConfig' ? s.replace('quickActions: [],', '') : s),
  },
  {
    name: 'the mic shown regardless of config.voice (the Principal gets one)',
    src: (k, s) => (k === 'sheet' ? s.replace(/\{voiceEnabled \? \(\s*<ShreyaChatMic/, '{true ? (<ShreyaChatMic') : s),
  },
  {
    name: 'a spoken question sent without the user seeing it',
    src: (k, s) =>
      k === 'sheet'
        ? s.replace(/(const appendTranscript = useCallback\(\(text\) => \{)/, '$1\n    submit();')
        : s,
  },
  {
    name: 'Shreya Speak left live while someone dictates',
    src: (k, s) => (k === 'sheet' ? s.replace('disabled={!turn || micStatus.active}', 'disabled={!turn}') : s),
  },
  {
    name: 'the text box editable while listening',
    src: (k, s) => (k === 'sheet' ? s.replace('editable={!sending && !micStatus.active}', 'editable={!sending}') : s),
  },
  {
    name: 'the mic sending the language object instead of its code',
    src: (k, s) => (k === 'sheet' ? s.replace('languageCode={languageCodeOf(language)}', 'languageCode={language}') : s),
  },
  {
    name: 'an auto-stopped take dropped (transcribing from stop() instead of lastRecording)',
    src: (k, s) => (k === 'dictation' ? s.replace('const take = lastRecording;', 'const take = null;') : s),
  },
  {
    name: 'a take transcribed twice',
    src: (k, s) =>
      k === 'dictation' ? s.replace('if (!take || handledRef.current === take) return;', 'if (!take) return;') : s,
  },
  {
    name: 'a late answer put in the box after cancel',
    src: (k, s) => (k === 'dictation' ? s.replaceAll('epochRef.current !== epoch', 'false') : s),
  },
  {
    name: 'transcription through studentApi (signs non-students out)',
    src: (k, s) =>
      k === 'transcribe'
        ? s.replace("import ttsClient from './ttsClient';", "import { studentApi as ttsClient } from '../studentApi';")
        : s,
  },
  {
    name: 'PARTNER refused by /transcribe',
    java: (k, s) => (k === 'transcribeController' ? s.replace(" or hasRole('PARTNER')\")", '")') : s),
  },
  {
    name: 'PARENT refused by /token',
    java: (k, s) =>
      k === 'speechController'
        ? s.replace(
            "hasRole('FREE_COLLEGE_STUDENT') or hasRole('PARENT') or hasRole('TEACHER') or hasRole('PARTNER')\")\n    public ResponseEntity<?> token(",
            "hasRole('FREE_COLLEGE_STUDENT') or hasRole('TEACHER') or hasRole('PARTNER')\")\n    public ResponseEntity<?> token(",
          )
        : s,
  },
  {
    name: 'the iOS mic prompt no longer saying what the mic is for',
    src: (k, s) => (k === 'appJson' ? s.replace(' and to let you ask Shreya your questions by voice', '') : s),
  },
];

console.log('Self-tests (each mutation must be caught):');
for (const m of MUTATIONS) {
  let caught;
  try {
    const sources = loadSources(m.src);
    caught = assertions(sources, loadJava(m.java), await loadLatestTurn(sources.latestTurn)).length > 0;
  } catch {
    caught = true; // a mutation that will not even load is caught, loudly
  }
  if (caught) ok(m.name);
  else fail(`NOT CAUGHT: ${m.name} — the corresponding assertion is vacuous`);
}

console.log('\nShreya voice in the chat sheet:');
{
  const sources = loadSources();
  const problems = assertions(sources, loadJava(), await loadLatestTurn(sources.latestTurn));
  if (problems.length === 0) {
    ok("header Shreya Speak reads Shreya's latest turn, through ttsClient, keyed per turn");
    ok('closing the sheet stops her; the Principal has no voice');
    ok("every portal's shortcuts are screens that exist in that portal");
    ok('the mic: free chat only, never auto-sends, one transcription per take, neutral client');
    ok('/transcribe and /token admit PARENT, TEACHER, PARTNER and students — not SCHOOL_ADMIN');
  } else problems.forEach(fail);
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL — ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
