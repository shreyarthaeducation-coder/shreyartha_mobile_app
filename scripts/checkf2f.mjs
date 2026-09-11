// The mobile Face-to-Face counselling room.
//
//   node scripts/checkf2f.mjs
//
// ══ WHY THIS EXISTS ════════════════════════════════════════════════════════
// Every property below has already caused a real defect on the web, and not one of them is visible
// to a build, a bundle or a type:
//
//   · `stop()` not awaited before `/finish` — the server nulls the mic token and refuses the
//     upload, so the recording is lost. On the web this lost every turn shorter than the chunk
//     interval; here, where a turn is ONE file, it would lose every recording outright.
//   · the turn identity pinned at SEATING rather than at RECORD — a late upload is then filed
//     under whichever child is on screen when it lands. A dropped recording is a gap; a
//     cross-posted one is a safeguarding problem.
//   · an API root DERIVED from another. `/api/shreya01/counsellor-report` is not a prefix of
//     `/api/shreya01/counsellor/activity-reports`; deriving one compiles, ships and 404s.
//   · the transcript read as `text` rather than `labelledText` — the model is handed one
//     undifferentiated paragraph while being told to tell questions from answers.
//   · the recording cap read from useVoiceRecorder's Azure-derived 55 s, which would truncate
//     every counselling turn at under a minute.
//
// Exit code 0 = pass.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');

let failures = 0;
const fail = (m) => { failures += 1; console.error(`  ✗ ${m}`); };
const ok = (m) => console.log(`  ✓ ${m}`);

const read = (p) => fs.readFileSync(path.join(APP, p), 'utf8').replace(/\r\n/g, '\n');
const exists = (p) => fs.existsSync(path.join(APP, p));

/** Comment-stripped: every file here documents the very rules it is asserted on. */
const codeOnly = (s) =>
  String(s || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const SRC = {
  live: 'components/staff/f2f/LiveSessionTab.js',
  screen: 'components/staff/f2f/F2FScreen.js',
  basket: 'components/staff/f2f/StudentBasket.js',
  sheet: 'components/staff/f2f/CounsellingSheetTab.js',
  previous: 'components/staff/f2f/PreviousSessionsTab.js',
  recorderBar: 'components/staff/f2f/RecorderBar.js',
  turnRecorder: 'hooks/useTurnRecorder.js',
  f2fService: 'services/counsellor/f2fService.js',
  reportService: 'services/counsellor/activityReportService.js',
  route: 'app/staff/[role]/face-to-face.js',
  layout: 'app/staff/[role]/_layout.js',
  tabBar: 'components/shared/home/PortalTabBar.js',
};

/** The portal roots, EVALUATED — a regex's idea of them is not what the app calls. */
async function loadPortals(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f2fcheck-'));
  const rel = 'constants/counsellorPortals.js';
  let s = read(rel);
  if (mutate) s = mutate(rel, s);
  fs.writeFileSync(path.join(dir, 'p.mjs'), s);
  return import(`${pathToFileURL(path.join(dir, 'p.mjs')).href}?t=${Math.random()}`);
}

function assertions(portals, src) {
  const out = [];
  const bad = (m) => out.push(m);

  // ── 1. Both portals carry four INDEPENDENT roots ──────────────────────────
  for (const role of ['counselor', 'shreyartha_councellor']) {
    const p = portals.COUNSELLOR_PORTALS[role];
    if (!p) { bad(`${role}: no portal descriptor`); continue; }
    for (const key of ['f2f', 'activityReports', 'report']) {
      if (!p[key]) bad(`${role}: portal has no "${key}" root`);
    }
    if (!p.f2f || !p.activityReports) continue;

    // The trap in full: none of these may be a prefix of another. On the Shreyartha portal
    // `report` and `activityReports` differ by SEGMENT, which is exactly the case that tempts
    // somebody to build one from the other.
    if (p.activityReports.startsWith(`${p.report}/`) || p.report.startsWith(`${p.activityReports}/`)) {
      bad(`${role}: report and activityReports are nested — they are siblings`);
    }
    if (p.f2f.startsWith(`${p.activityReports}/`) || p.activityReports.startsWith(`${p.f2f}/`)) {
      bad(`${role}: f2f and activityReports are nested — the room is a SIBLING of the reports`);
    }
    // And the pairing that actually tempts somebody: the room hung off the report tree. The web's
    // `treePrefix` is the only root anybody remembers, so `${report}/f2f` is the natural guess, and
    // it compiles, ships and 404s.
    if (p.f2f.startsWith(`${p.report}/`) || p.report.startsWith(`${p.f2f}/`)) {
      bad(`${role}: f2f is nested under the report tree — it is a SIBLING of it`);
    }
    if (!p.f2f.endsWith('/f2f')) bad(`${role}: f2f root is "${p.f2f}"`);
    if (!p.activityReports.endsWith('/activity-reports')) {
      bad(`${role}: activityReports root is "${p.activityReports}"`);
    }
  }

  // ── 2. The FAB opens the room, and the room is not a tab ──────────────────
  const tabBar = codeOnly(src.tabBar);
  for (const role of ['counselor', 'shreyartha_councellor']) {
    if (!new RegExp(`${role}: \\{[^}]*face-to-face`).test(tabBar.replace(/\n/g, ' '))) {
      bad(`${role}: the centre FAB does not open the face-to-face room`);
    }
  }
  // A FAB destination that is ALSO a tab would render the bar on a screen that never padded for
  // it — checkstaffdashboard owns that rule generally; this pins the specific route.
  if (/route: '\/staff\/(counselor|shreyartha_councellor)\/face-to-face'[\s\S]{0,400}?_TABS/.test(tabBar)) {
    bad('face-to-face appears in a tab list as well as the FAB');
  }
  if (!exists(SRC.route)) bad('app/staff/[role]/face-to-face.js does not exist');
  if (!/Stack\.Screen name="face-to-face"/.test(read(SRC.layout))) {
    bad('the face-to-face route is not registered — it would render expo-router\'s Unmatched page');
  }
  // A barrel import in a route file is an app-wide import; that trap once boot-crashed the app.
  if (/from '\.\.\/\.\.\/\.\.\/components\/staff'/.test(read(SRC.route))) {
    bad('the face-to-face route imports through the components/staff barrel');
  }

  // ── 3. THE AWAIT. The single most destructive thing to get wrong. ─────────
  const live = codeOnly(src.live);
  const stopAt = live.indexOf('await recorder.stop()');
  const finishAt = live.indexOf('finishTurn(f2f');
  if (stopAt < 0) {
    bad('LiveSessionTab does not await recorder.stop() — the recording races /finish and is refused');
  } else if (finishAt >= 0 && stopAt > finishAt) {
    bad('recorder.stop() is awaited AFTER finishTurn — the mic token is already void by then');
  }

  // ── 4. The turn identity is pinned at RECORD, not at seating ─────────────
  const rec = codeOnly(src.turnRecorder);
  if (!/identityRef\.current = identity/.test(rec)) {
    bad('useTurnRecorder does not pin the turn identity at start');
  }
  if (!/const identity = identityRef\.current/.test(rec)) {
    bad('useTurnRecorder uploads against live state rather than the pinned identity');
  }
  // `start(identity)` must be handed the ACTIVE turn, not a participant seated earlier.
  if (!/recorder\.start\(\{ turnId: active\.turnId, micToken: active\.micToken \}\)/.test(live)) {
    bad('the recorder is started without the active turn identity');
  }

  // ── 5. stop() resolves only after the upload settles ─────────────────────
  if (!/await uploadRef\.current\(/.test(rec)) {
    bad('useTurnRecorder.stop() does not await the upload — the caller cannot sequence /finish');
  }
  if (!/setFailed\(\(n\) => n \+ 1\)/.test(rec)) {
    bad('a failed upload is not counted — a silent drop looks exactly like a success');
  }

  // ── 6. The cap is per-platform and NOT the Azure 55 s ────────────────────
  // Not merely that `capSecondsFor` is DEFINED — that it is what the hook actually hands
  // useVoiceRecorder. A literal here (55, or any other typed number) silently truncates every turn,
  // and the function sitting unused above it looks exactly like a cap that works.
  if (!/const maxSeconds = capSecondsFor\(\);/.test(rec)) {
    bad('the recording cap is not capSecondsFor() — a typed cap is not derived from the byte budget');
  }
  if (!/useVoiceRecorder\(\{ maxSeconds \}\)/.test(rec)) {
    bad('the derived cap is not passed to useVoiceRecorder — its own 55 s Azure default would apply');
  }
  if (/maxSeconds = MAX_RECORDING_SECONDS/.test(rec)) {
    bad("the turn recorder inherits useVoiceRecorder's 55 s Azure cap");
  }
  if (!/BYTES_PER_SECOND/.test(rec) || !/INLINE_BUDGET_BYTES/.test(rec)) {
    bad('the cap is a typed number rather than derived from what the backend can forward');
  }

  // ── 7. The transcript's LABELLED form, and the notes alongside it ────────
  if (!/labelledText/.test(live)) {
    bad('the transcript is read as `text` — the speaker tags the prompt relies on are discarded');
  }
  // EVERY draft call, not just the first. `generate` and `regenerate` build the payload separately,
  // and a redraft that quietly drops the notes is the harder of the two to notice: the counsellor
  // watches their own observation vanish from a report that already contained it.
  const drafts = (live.match(/generateReport\(reports, \{/g) || []).length;
  const withNotes = (live.match(/typedObservation: notes,/g) || []).length;
  if (drafts === 0) bad('nothing in the room drafts a report');
  else if (withNotes !== drafts) {
    bad(`the counsellor's typed notes reach ${withNotes} of ${drafts} draft calls — the box promises something it does not do`);
  }
  if (!/transcriptSpeakerCount/.test(live) || !/transcriptMinorityShare/.test(live)) {
    bad('the speaker counts are not forwarded — the prompt cannot judge how far to trust the labels');
  }

  // ── 7b. THE QUEUE ROW'S FIELD NAMES ──────────────────────────────────────
  // Found on device, and only because React warns about the missing `key`. The response DTO
  // (`F2FParticipantResponse`) is `id`/`name`/`grade`; the REQUEST DTO is `displayName`/
  // `gradeLabel`, and reading the request's vocabulary off a response is silent in two of its
  // three effects — a blank name, and `/participants/undefined/mic` on every Start.
  if (/key=\{p\.participantId\}/.test(live)) {
    bad('the queue row keys off p.participantId — the response DTO field is `id`');
  }
  if (!/key=\{p\.id\}/.test(live)) bad('the queue row has no stable key');
  if (/\bp\.displayName|\bp\.gradeLabel/.test(live)) {
    bad('the queue row reads the REQUEST DTO field names (displayName/gradeLabel) off a response');
  }
  if (!/grantMic\(f2f, session\.sessionUuid, participant\.id\)/.test(live)) {
    bad('grantMic is not passed participant.id — the URL would end in /undefined');
  }

  // ── 7c. TURN STATUS: there is no `DONE` ──────────────────────────────────
  // The terminal values are DRAFTED and COMPLETED. Testing for DONE is not an error anywhere —
  // it just makes every finished student look unfinished for ever, and pins "n of m done" at 0.
  if (/'DONE'|"DONE"/.test(live)) {
    bad('the room tests turnStatus against `DONE`, which is not one of the nine real values');
  }
  if (!/turnStatus === 'DRAFTED' \|\| p\.turnStatus === 'COMPLETED'/.test(live)) {
    bad('done-ness is not DRAFTED||COMPLETED');
  }

  // ── 7d. Web parity on the row's actions ──────────────────────────────────
  // A stranded turn (activeParticipantId still set after a sleep or a kill) makes every later
  // grantMic fail with "someone else is recording", permanently. Revoke is the only way out that
  // does not mean abandoning the session, and it has to be reachable from the row.
  if (!/state\?\.activeParticipantId === p\.id/.test(live)) {
    bad('the row cannot detect a stranded turn — the session would be unrecoverable');
  }
  if (!/takeMicBack/.test(live)) bad('there is no way to take the microphone back');
  if (!/Start again/.test(live)) bad('a finished student cannot be started again');
  if (!/dropParticipant/.test(live)) bad('a WAITING student cannot be removed');
  if (!/p\.turnStatus === 'WAITING' \?/.test(live)) {
    bad('Remove is not restricted to WAITING — the server refuses, and would orphan a turn row');
  }
  // Consent gates grantMic AND uploadSegment server-side: a turn started without it can never
  // receive audio, so the button must be disabled rather than merely failing later.
  if (!/disabled=\{busy \|\| !!active \|\| !consentObtained\}/.test(live)) {
    bad('the Start button is not gated on consent — the turn could never receive audio');
  }
  // `undefined` is a legal RN style value, so a missing palette key renders as the default and
  // nothing anywhere reports it. FEEDBACK has warningText, not warning.
  if (/FEEDBACK\.warning\b(?!Text|Bg|Border|OnBg)/.test(live)) {
    bad('FEEDBACK.warning does not exist — an undefined colour renders silently as the default');
  }

  // ── 8. Consent, and the walk-in that does not send a schoolId ────────────
  if (!/consentObtained/.test(live)) bad('the room has no consent control');
  if (!/isWalkIn \? \{\} : \{ schoolId \}/.test(live)) {
    bad('a walk-in sends a schoolId — the server must fall back to the counsellor\'s own school');
  }
  // One school per basket: the server validates against every linked school and will not catch it.
  if (!/basketSchoolId/.test(codeOnly(src.basket))) {
    bad('the basket does not enforce one school per session');
  }

  // ── 9. The upload contract ───────────────────────────────────────────────
  const svc = codeOnly(src.f2fService);
  if (!/files: \{ audio: file \}/.test(svc)) {
    bad('the segment upload does not name its part `audio`');
  }
  if (!/speaker: speaker \|\| 'UNKNOWN'/.test(svc)) {
    bad('a segment can be sent with a speaker label — an unverified tag is worse than none');
  }
  if (!/generateReport = false/.test(svc)) {
    bad('finishTurn defaults to generating a report — it would draft twice');
  }

  // ── 9b. The upload waits for RECOGNITION, not for the bytes ──────────────
  // The server transcribes inline and only then answers, so this response time is Google's, not
  // the network's. `multipart` defaults to 60 s (sized for a photo); on a real counselling turn
  // that expires mid-recognition, the client counts the recording failed and runs straight on to
  // /finish, and the transcript then lands after the report was drafted — the blank template, with
  // no clue why. A short test recording answers in seconds and hides the whole thing.
  if (!/SEGMENT_UPLOAD_TIMEOUT_MS/.test(svc)) {
    bad('the segment upload inherits the 60 s multipart default — too short for real recognition');
  }
  const capMs = /SEGMENT_UPLOAD_TIMEOUT_MS = (\d+)/.exec(svc);
  if (capMs && Number(capMs[1]) <= 300000) {
    bad(`the upload timeout (${capMs[1]}ms) does not outlast the server's own 300s ceiling`);
  }
  if (!/timeoutMs: SEGMENT_UPLOAD_TIMEOUT_MS/.test(svc)) {
    bad('the upload timeout constant is declared but not passed to multipart');
  }

  // ── 10. splitForm is used, and the CSV keeps all ten columns ─────────────
  // The import surviving is not the property under test — `splitForm` being CALLED on the body is.
  if (!/const \{ formData, griffin \} = splitForm\(form \|\| \{\}\);/.test(codeOnly(src.reportService))) {
    bad('saveReport does not split the form — the four narratives would be written into formData');
  }
  const sheet = codeOnly(src.sheet);
  if (!/SHEET_COLUMNS\.map/.test(sheet)) {
    bad('the CSV does not use SHEET_COLUMNS — the export must match the printed sheet');
  }
  if (!/\\ufeff|﻿/.test(sheet)) {
    bad('the CSV has no UTF-8 BOM — Excel would mangle every name with a diacritic');
  }

  return out;
}

const MUTATIONS = [
  {
    name: 'the recording is no longer awaited before the turn ends',
    src: (k, s) => (k === 'live' ? s.replace('await recorder.stop();', 'recorder.stop();') : s),
  },
  {
    name: 'the turn identity stops being pinned',
    src: (k, s) => (k === 'turnRecorder'
      ? s.replace('identityRef.current = identity && identity.turnId', 'identityRef.current = null && identity && identity.turnId')
      : s),
  },
  {
    name: 'the upload is fired and forgotten',
    src: (k, s) => (k === 'turnRecorder'
      ? s.replace('await uploadRef.current(', 'void uploadRef.current(')
      : s),
  },
  {
    name: 'the turn recorder falls back to the 55 s Azure cap',
    src: (k, s) => (k === 'turnRecorder'
      ? s.replace('const maxSeconds = capSecondsFor();', 'const maxSeconds = 55;')
      : s),
  },
  {
    name: 'the transcript is read as the flat blob again',
    src: (k, s) => (k === 'live' ? s.replace(/labelledText/g, 'text') : s),
  },
  {
    name: 'the typed notes are dropped',
    src: (k, s) => (k === 'live' ? s.replace('typedObservation: notes,', '') : s),
  },
  {
    name: 'a walk-in starts sending a schoolId',
    src: (k, s) => (k === 'live' ? s.replace('...(isWalkIn ? {} : { schoolId }),', '...{ schoolId },') : s),
  },
  {
    name: 'the FAB points back at the counselling sheet',
    src: (k, s) => (k === 'tabBar'
      ? s.replace("route: '/staff/counselor/face-to-face' }", "route: '/staff/counselor/counselling' }")
      : s),
  },
  {
    name: 'the segment part is renamed',
    src: (k, s) => (k === 'f2fService' ? s.replace('files: { audio: file }', 'files: { file }') : s),
  },
  {
    name: 'a segment claims the student was speaking',
    src: (k, s) => (k === 'f2fService'
      ? s.replace("speaker: speaker || 'UNKNOWN'", "speaker: speaker || 'STUDENT'")
      : s),
  },
  {
    name: 'saveReport stops splitting the form',
    src: (k, s) => (k === 'reportService'
      ? s.replace('const { formData, griffin } = splitForm(form || {});', 'const formData = form || {}; const griffin = {};')
      : s),
  },
  {
    name: 'the queue row keys off the request DTO field again (the device bug)',
    src: (k, s) => (k === 'live' ? s.replace('key={p.id}', 'key={p.participantId}') : s),
  },
  {
    name: 'the row reads displayName off a response again',
    src: (k, s) => (k === 'live' ? s.replace('<Text style={styles.rowName}>{p.name}</Text>', '<Text style={styles.rowName}>{p.displayName}</Text>') : s),
  },
  {
    name: 'grantMic goes back to participant.participantId',
    src: (k, s) => (k === 'live'
      ? s.replace('grantMic(f2f, session.sessionUuid, participant.id)', 'grantMic(f2f, session.sessionUuid, participant.participantId)')
      : s),
  },
  {
    name: 'done-ness reverts to the non-existent DONE status',
    src: (k, s) => (k === 'live'
      ? s.replace("const isDone = (p) => p.turnStatus === 'DRAFTED' || p.turnStatus === 'COMPLETED';", "const isDone = (p) => p.turnStatus === 'DONE';")
      : s),
  },
  {
    name: 'the stranded-turn escape hatch is removed',
    src: (k, s) => (k === 'live' ? s.replace('state?.activeParticipantId === p.id', 'false') : s),
  },
  {
    name: 'the Start button stops being gated on consent',
    src: (k, s) => (k === 'live'
      ? s.replace('disabled={busy || !!active || !consentObtained}', 'disabled={busy || !!active}')
      : s),
  },
  {
    name: 'a colour is read from a palette key that does not exist',
    src: (k, s) => (k === 'live' ? s.replace('FEEDBACK.warningText', 'FEEDBACK.warning') : s),
  },
  {
    name: 'the segment upload falls back to the 60 s photo timeout',
    src: (k, s) => (k === 'f2fService'
      ? s.replace('  }, { timeoutMs: SEGMENT_UPLOAD_TIMEOUT_MS });', '  });')
      : s),
  },
  {
    name: 'the upload timeout is cut below the server ceiling',
    src: (k, s) => (k === 'f2fService'
      ? s.replace('SEGMENT_UPLOAD_TIMEOUT_MS = 330000', 'SEGMENT_UPLOAD_TIMEOUT_MS = 60000')
      : s),
  },
  {
    name: 'the CSV loses its BOM',
    src: (k, s) => (k === 'sheet' ? s.replace('`﻿${header}', '`${header}') : s),
  },
  {
    name: 'the basket stops enforcing one school',
    src: (k, s) => (k === 'basket' ? s.replace(/basketSchoolId/g, 'anySchoolId') : s),
  },
  {
    name: 'an API root is derived from another',
    portals: (f, s) =>
      s.replace("f2f: '/api/shreya01/counsellor/f2f',", "f2f: '/api/shreya01/counsellor-report/f2f',"),
  },
];

function sourcesOf(mutate) {
  const out = {};
  for (const [k, rel] of Object.entries(SRC)) {
    let s;
    try { s = read(rel); } catch { s = ''; }
    out[k] = mutate ? mutate(k, s) : s;
  }
  return out;
}

async function main() {
  console.log('Self-tests (each mutation must be caught):');
  let vacuous = 0;

  for (const m of MUTATIONS) {
    const srcMutate = m.src || (() => undefined);
    const staged = m.src ? sourcesOf(m.src) : sourcesOf(null);
    const base = sourcesOf(null);

    // INERT vs NOT CAUGHT, told apart by name. A `.replace` whose anchor has been reworded is a
    // silent no-op, and reporting that as a vacuous ASSERTION sends the reader to the wrong file.
    let changed = false;
    if (m.src) {
      changed = Object.keys(base).some((k) => base[k] !== staged[k]);
    }
    let portals;
    if (m.portals) {
      const beforeMod = read('constants/counsellorPortals.js');
      changed = m.portals('constants/counsellorPortals.js', beforeMod) !== beforeMod;
      portals = await loadPortals(m.portals);
    } else {
      portals = await loadPortals(null);
    }

    if (!changed) {
      console.error(`  ✗ INERT: ${m.name} — its anchor no longer matches the source`);
      vacuous += 1;
      continue;
    }

    const found = assertions(portals, staged);
    if (found.length === 0) {
      console.error(`  ✗ NOT CAUGHT: ${m.name} — the corresponding assertion is vacuous`);
      vacuous += 1;
    } else {
      ok(m.name);
    }
    void srcMutate;
  }

  console.log('\nFace-to-Face counselling (mobile):');
  const portals = await loadPortals(null);
  const found = assertions(portals, sourcesOf(null));
  found.forEach(fail);
  if (!found.length) {
    console.log('  ✓ four independent API roots per portal, none derived from another');
    console.log('  ✓ the FAB opens the room; the room is registered and is not a tab');
    console.log('  ✓ the recording is awaited before the turn ends, and pinned at record-start');
    console.log('  ✓ the labelled transcript and the typed notes both reach the model');
    console.log('  ✓ the cap is derived per platform, not inherited from Azure');
  }

  const total = failures + vacuous;
  console.log(total === 0
    ? `\nPASS — ${MUTATIONS.length} assertions, each proven to fail on a broken input.`
    : `\nFAILED: ${failures} baseline, ${vacuous} vacuous/inert mutation(s).`);
  process.exit(total === 0 ? 0 : 1);
}

main();
