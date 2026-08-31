// Speak-to-Counselor port checker.
//
//   node scripts/checkcounselor.mjs
//
// WHY THIS EXISTS. This change closed the last student WebView hand-off that had no browser-only
// reason, and it touches three things a build cannot see: a menu entry flipped from `path:` to
// `native:` (a wrong route is an expo-router unmatched route, not a crash), ~80 strings copied from
// the web (a drifted one is just different text), and a NEW AsyncStorage key (a key missing from
// ALL_AUTH_KEYS leaks into the next user's session — the bug STAFF_PHOTO_KEY and partnerUserType
// each had).
//
// It also pins the two things this port could silently get wrong at the wire: the LocalDateTime
// shape the backend parses, and the ChapterLink routes, which are absolute WEB paths here.
//
// Exit code 0 = pass.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const WEB = path.resolve(APP, '..', 'frontendmain');
const BACKEND = path.resolve(APP, '..', 'backendmain');
const ROUTES = path.join(APP, 'app', 'student');

const SRC = {
  screen: 'components/student/CounselorScreen.js',
  route: 'app/student/counselor.js',
  layout: 'app/student/_layout.js',
  counselorService: 'services/student/counselorService.js',
  shreyaService: 'services/student/shreyaService.js',
  chatbotConfig: 'constants/studentChatbotConfig.js',
  barrel: 'components/student/index.js',
  // Speak to Counselor moved here from STUDENT_HEADER_ACTIONS in the dashboard redesign: it is the
  // footer's Support tab now. The old list no longer exists, so an assertion still naming it would
  // pass while covering nothing.
  tabBar: 'components/shared/home/PortalTabBar.js',
};

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`  ✗ ${msg}`);
};
const ok = (msg) => console.log(`  ✓ ${msg}`);

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

/**
 * Code with comments removed. Every source assertion runs through this — five assertions across
 * this port's siblings have fired on a docblock that NAMED the thing it was explaining is avoided.
 * This file has the same exposure: the screen's docblock names `toISOString` while explaining that
 * it is never used, and names the web flourishes it does not port.
 */
const codeOnly = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Stage an import-free module as .mjs so it can be evaluated, not grepped. */
async function loadModule(abs, mutate, shimRequire = false) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'couns-'));
  let src = read(abs);
  if (mutate) src = mutate(src);
  if (shimRequire) src = `const require = () => null;\n${src}`;
  const file = path.join(dir, `${path.basename(abs, '.js')}.mjs`);
  fs.writeFileSync(file, src);
  return import(`${pathToFileURL(file).href}?t=${Math.random()}`);
}

const loadMenu = (m) => loadModule(path.join(APP, 'constants', 'studentMenu.js'), m, true);
const loadKeys = (m) => loadModule(path.join(APP, 'constants', 'storageKeys.js'), m);
const loadChatData = (m) => loadModule(path.join(APP, 'constants', 'studentChatbotData.js'), m);
const loadWebChatData = () =>
  loadModule(
    path.join(WEB, 'src', 'student', 'components', 'StudentChatbot', 'studentChatbotData.js'),
  );

/**
 * The chatbot config imports the service, which imports the HTTP client — none of which loads
 * outside Metro. Only `resolveStudentLink` is needed here, and it is a pure function, so the
 * imports are stripped and the two exports it depends on are stubbed.
 */
async function loadLinkResolver(mutate) {
  let src = read(path.join(APP, 'constants', 'studentChatbotConfig.js'));
  if (mutate) src = mutate(src);
  src = src
    .replace(/^import[\s\S]*?from '\.\/studentChatbotData';$/m, 'const STUDENT_SECTIONS = [];')
    .replace(/^import \* as studentShreya from .*$/m, 'const studentShreya = {};')
    .replace('buildExplanation: buildStudentSectionExplanation,', 'buildExplanation: null,');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clink-'));
  const file = path.join(dir, 'cfg.mjs');
  fs.writeFileSync(file, src);
  return import(`${pathToFileURL(file).href}?t=${Math.random()}`);
}

/** The 10 topics as the WEB declares them, extracted from counselor.js. */
function webQueryOptions() {
  const src = read(path.join(WEB, 'src', 'student', 'platform', 'counselor.js'));
  const from = src.indexOf('const QUERY_OPTIONS');
  const block = src.slice(from, src.indexOf('];', from));
  return [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/** The 3 contact modes as the web's shared constants declare them. */
function webPreferredModes() {
  const src = read(path.join(WEB, 'src', 'common', 'preferredModes.js'));
  const from = src.indexOf('export const PREFERRED_MODES');
  const block = src.slice(from, src.indexOf('];', from));
  return [...block.matchAll(/value:\s*"([^"]+)",\s*label:\s*"([^"]+)"/g)].map((m) => ({
    value: m[1],
    label: m[2],
  }));
}

/** Every route the STUDENT backend can put in a ChapterLink, read out of the Java service. */
function backendLinkRoutes() {
  const src = read(
    path.join(
      BACKEND, 'src', 'main', 'java', 'com', 'shreyartha', 'backend',
      'infrastructure', 'shreya', 'ShreyaContextService.java',
    ),
  );
  const routes = [];
  for (const m of src.matchAll(/public static final String (\w*_ROUTE)\s*=\s*"([^"]+)"/g)) {
    routes.push({ name: m[1], route: m[2] });
  }
  return routes;
}

function routeNames() {
  return new Set(
    fs
      .readdirSync(ROUTES)
      .filter((f) => f.endsWith('.js') && f !== '_layout.js')
      .map((f) => f.replace(/\.js$/, '')),
  );
}

function loadSources(mutate) {
  const out = {};
  for (const [key, rel] of Object.entries(SRC)) {
    out[key] = mutate ? mutate(key, read(path.join(APP, rel))) : read(path.join(APP, rel));
  }
  return out;
}

function assertions(menu, keys, chat, webChat, links, src) {
  const out = [];
  const bad = (m) => out.push(m);
  const files = routeNames();

  // ── 1. Speak to Counselor is a native footer tab, and NOTHING student-side is on a path ────
  //
  // It was a chip in STUDENT_HEADER_ACTIONS until the dashboard redesign; that list is gone and the
  // screen is now the Support tab. The tab bar imports react-native so it cannot be evaluated the
  // way studentMenu.js is — asserted on source, comments stripped.
  // SCOPED TO THE STUDENT LIST. The bar is shared with the teacher panel now, and both portals
  // declare a `support` key — so a bare grep for one still matches after the student's is deleted.
  const tabBar = codeOnly(src.tabBar);
  const studentTabs = tabBar.match(/export const STUDENT_TABS = \[[\s\S]*?\];/);
  if (!studentTabs) {
    bad('STUDENT_TABS is gone from the shared footer — the student panel has no tab list');
  } else {
    if (!/route:\s*'\/student\/counselor'/.test(studentTabs[0])) {
      bad('no student footer tab points at /student/counselor — Speak to Counselor is unreachable');
    }
    if (!/key:\s*'support'/.test(studentTabs[0])) {
      bad('the Support tab is gone from the student footer');
    }
  }

  // The three surviving student WebView hand-offs (Coding Arena, and Plans twice) are buttons in
  // components, not menu entries — every menu should be entirely native.
  for (const [name, list] of [
    ['STUDENT_MENU', menu.STUDENT_MENU],
    ['STUDENT_TEACHER_LINKS', menu.STUDENT_TEACHER_LINKS],
  ]) {
    const web = (list || []).filter((i) => !i.native);
    if (web.length) bad(`${name} still has WebView entries: ${web.map((i) => i.key).join(', ')}`);
  }

  // ── 2. routes: counselor added, the dead `learn` gone, both directions ────
  if (!files.has('counselor')) bad('app/student/counselor.js does not exist');
  if (!/name="counselor"/.test(src.layout)) {
    bad('/student/counselor is not registered as a Stack.Screen — an unmatched route');
  }
  if (files.has('learn')) bad('app/student/learn.js is back — it is the superseded WebView shell');
  if (/name="learn"/.test(src.layout)) {
    bad('_layout still registers "learn"');
  }
  for (const m of src.layout.matchAll(/<Stack\.Screen name="([^"]+)"/g)) {
    if (!files.has(m[1])) bad(`_layout registers "${m[1]}" but app/student/${m[1]}.js does not exist`);
  }
  if (!codeOnly(src.barrel).includes('CounselorScreen')) {
    bad('components/student/index.js does not export CounselorScreen');
  }

  // ── 3. THE STORAGE LEAK ───────────────────────────────────────────────────
  // The screen writes a new key so the shared chat sheet can greet by name. A key the login writes
  // and the logout does not clear survives into the next user's session.
  const screen = codeOnly(src.screen);
  const written = [...screen.matchAll(/setItem\('([A-Za-z]+)'/g)].map((m) => m[1]);
  if (!written.includes('studentUserName')) {
    bad('CounselorScreen no longer seeds studentUserName — the chat greets "Hi there"');
  }
  for (const key of written) {
    if (!keys.ALL_AUTH_KEYS.includes(key)) {
      bad(`CounselorScreen writes "${key}" but ALL_AUTH_KEYS never clears it — it leaks to the next student`);
    }
  }
  const cfg = codeOnly(src.chatbotConfig);
  const nameKey = cfg.match(/nameKey:\s*'([^']+)'/)?.[1];
  if (nameKey !== 'studentUserName') {
    bad(`the chat config greets from ${JSON.stringify(nameKey)}, which nothing writes`);
  }

  // ── 4. the 9 chatbot sections are verbatim ────────────────────────────────
  const got = chat.STUDENT_SECTIONS;
  const want = webChat.STUDENT_SECTIONS;
  if (want.length !== 9) bad(`the web chatbot has ${want.length} sections, expected 9`);
  if (got.length !== want.length) {
    bad(`shipped ${got.length} chatbot sections, the web has ${want.length}`);
  } else {
    for (let i = 0; i < want.length; i += 1) {
      for (const f of ['label', 'sectionKey', 'overview', 'functionality']) {
        if (got[i][f] !== want[i][f]) {
          bad(`chatbot section ${want[i].sectionKey}: ${f} differs from the web`);
        }
      }
      if ((got[i].services || []).join('|') !== (want[i].services || []).join('|')) {
        bad(`chatbot section ${want[i].sectionKey}: services differ from the web`);
      }
      // A renamed sectionKey does not error — the backend grounds the reply on the wrong section.
      const screenName = got[i].routeSuffix?.replace(/^\//, '').split('?')[0];
      if (!files.has(screenName)) {
        bad(`chatbot section ${got[i].sectionKey} points at /student${got[i].routeSuffix} — no such screen`);
      }
    }
  }

  // The fallback renderer must match the web CHAR FOR CHAR. The student's says
  // "Services available:" where the parent's identical-looking one says "What you'll find:" — the
  // two must never be merged.
  for (let i = 0; i < Math.min(got.length, want.length); i += 1) {
    const a = webChat.buildSectionExplanation(want[i]);
    const b = chat.buildStudentSectionExplanation(got[i]);
    if (a !== b) {
      bad(
        `the fallback text for ${want[i].sectionKey} differs from the web\n` +
          `      web: ${JSON.stringify(a.slice(0, 160))}\n` +
          `      got: ${JSON.stringify(b.slice(0, 160))}`,
      );
      break;
    }
  }

  // ── 5. ChapterLink routes are absolute WEB paths for the student ──────────
  // Prefixing one with basePath would give /student/student/platform/... — a route that throws
  // nothing and navigates nowhere. Same trap the parent chatbot hit.
  const backendRoutes = backendLinkRoutes();
  if (backendRoutes.length < 2) {
    bad(`expected at least 2 *_ROUTE constants in ShreyaContextService, found ${backendRoutes.length}`);
  }
  for (const r of backendRoutes) {
    const resolved = links.resolveStudentLink(r.route);
    if (resolved == null) {
      bad(`resolveStudentLink has no mapping for ${r.name} (${r.route}) — that link would be dropped`);
      continue;
    }
    if (resolved.startsWith('/student/')) {
      bad(`resolveStudentLink returned "${resolved}" for ${r.name} — that double-prefixes to /student/student/...`);
    }
    const screenName = resolved.replace(/^\//, '').split('?')[0];
    if (!files.has(screenName)) bad(`${r.name} resolves to /student${resolved} — no such screen`);
  }
  if (links.resolveStudentLink('/parent/platform/dashboard/fees') !== null) {
    bad('resolveStudentLink accepts a route from another portal');
  }
  if (links.resolveStudentLink(null) !== null) bad('resolveStudentLink does not guard a null route');

  // ── 6. the form vocabulary is the web's ───────────────────────────────────
  const svc = codeOnly(src.counselorService);
  const shippedOptions = [
    ...svc.slice(svc.indexOf('QUERY_OPTIONS'), svc.indexOf('];', svc.indexOf('QUERY_OPTIONS')))
      .matchAll(/'([^']+)'/g),
  ].map((m) => m[1]);
  const webOptions = webQueryOptions();
  if (webOptions.length !== 10) bad(`web QUERY_OPTIONS extractor found ${webOptions.length}, expected 10`);
  if (shippedOptions.join('|') !== webOptions.join('|')) {
    bad(
      `QUERY_OPTIONS drifted from the web (counsellors read this text in another portal)\n` +
        `      got:  ${shippedOptions.join(' / ')}\n` +
        `      want: ${webOptions.join(' / ')}`,
    );
  }
  const shippedModes = [
    ...svc.slice(svc.indexOf('PREFERRED_MODES'), svc.indexOf('];', svc.indexOf('PREFERRED_MODES')))
      .matchAll(/value:\s*'([^']+)',\s*label:\s*'([^']+)'/g),
  ].map((m) => `${m[1]}:${m[2]}`);
  const webModes = webPreferredModes().map((m) => `${m.value}:${m.label}`);
  if (webModes.length !== 3) bad(`web PREFERRED_MODES extractor found ${webModes.length}, expected 3`);
  if (shippedModes.join('|') !== webModes.join('|')) {
    bad(`PREFERRED_MODES drifted from the web — the backend 400s on anything else`);
  }

  // ── 7. the LocalDateTime wire shape ───────────────────────────────────────
  // CounselorQueryRequest.preferredDateTime is a LocalDateTime — a wall clock with no zone.
  // toISOString() rewrites local midnight to 18:30 the previous day in IST.
  for (const key of ['counselorService', 'screen']) {
    if (/toISOString/.test(codeOnly(src[key]))) {
      bad(`${SRC[key]} calls toISOString() — preferredDateTime is a zoneless LocalDateTime`);
    }
  }
  if (!/mode="datetime"/.test(screen)) {
    bad('the booking form no longer uses DateTimeField mode="datetime" — the wire format is hand-joined again');
  }
  if (!/minimumDate=/.test(screen)) {
    bad('the booking form lost its minimumDate — a session can be booked in the past');
  }

  // ── 8. a submit failure has to be visible ─────────────────────────────────
  // The toast is rendered by StudentScaffold, which sits BEHIND the FormSheet modal, so an error
  // toasted while the sheet is open cannot be seen.
  // `load` has its own catch/finally EARLIER in the file, so the closing brace must be searched for
  // from the submit catch onwards — indexOf from 0 finds load's and yields an empty slice.
  const catchAt = screen.indexOf('} catch (e) {');
  const catchBlock = catchAt < 0 ? '' : screen.slice(catchAt, screen.indexOf('} finally {', catchAt));
  if (catchAt < 0) bad('the submit handler has no catch block');
  if (!catchBlock.includes('setSubmitError')) {
    bad('a submit failure is not shown inside the sheet — a toast behind the modal is invisible');
  }
  if (catchBlock.includes('showToast')) {
    bad('a submit failure is toasted while the sheet is still open — it renders behind the modal');
  }

  // ── 9. transport ──────────────────────────────────────────────────────────
  const shreya = codeOnly(src.shreyaService);
  if (!shreya.includes('/api/student/shreya')) {
    bad('the student Shreya service does not target /api/student/shreya');
  }
  if (shreya.includes('/api/parent/shreya') || shreya.includes('/api/teacher/shreya')) {
    bad('the student Shreya service reaches another portal namespace');
  }
  if (!shreya.includes('createShreyaService')) {
    bad('the student Shreya service does not reuse the shared transport factory');
  }
  if (!svc.includes('/api/student/counselor-queries')) {
    bad('the counselor service does not target /api/student/counselor-queries');
  }

  // ── 10. style keys, and no autoFocus ──────────────────────────────────────
  const whole = src.screen;
  const at = whole.indexOf('const useStyles = makeStyles(');
  if (at < 0) bad('CounselorScreen defines no stylesheet');
  else {
    const defined = new Set(
      [...whole.slice(at).matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9]*):/gm)].map((m) => m[1]),
    );
    for (const m of screen.matchAll(/styles\.([a-zA-Z][a-zA-Z0-9]*)/g)) {
      if (!defined.has(m[1])) bad(`CounselorScreen references styles.${m[1]}, which is not defined`);
    }
  }
  if (/autoFocus/.test(screen)) {
    bad('CounselorScreen has autoFocus — an Android Modal with a focused input dismisses the keyboard');
  }

  return out;
}

const MUTATIONS = [
  {
    name: 'the Support tab pointed at a route with no file',
    src: (k, s) =>
      k === 'tabBar' ? s.replace("route: '/student/counselor'", "route: '/student/counsellor'") : s,
  },
  {
    // Targets the STUDENT list specifically. A bare replace hits whichever list comes first in the
    // file, which is exactly how this mutation went vacuous when the teacher's tabs were added.
    name: 'the Support tab removed from the STUDENT footer',
    src: (k, s) =>
      k === 'tabBar'
        ? s.replace(/(STUDENT_TABS = \[[\s\S]*?)key: 'support'/, "$1key: 'settings'")
        : s,
  },
  {
    name: 'a workspace teacher link flipped back to the website',
    menu: (s) =>
      s.replace(
        "native: '/student/personalised-resources',",
        'path: `${STUDENT_BASE}/personalised-resources`,',
      ),
  },
  {
    name: 'THE STORAGE LEAK: studentUserName dropped from ALL_AUTH_KEYS',
    keys: (s) => s.replace("  'studentUserName',\n", ''),
  },
  {
    name: 'the screen no longer seeding the name the chat greets with',
    src: (k, s) => (k === 'screen' ? s.replace("setItem('studentUserName'", "setItem('tmpName'") : s),
  },
  {
    name: 'the chat config greeting from a key nothing writes',
    src: (k, s) => (k === 'chatbotConfig' ? s.replace("nameKey: 'studentUserName'", "nameKey: 'studentName'") : s),
  },
  {
    name: 'a chatbot sectionKey renamed (the server grounds on the wrong section)',
    chat: (s) => s.replace('"sectionKey": "skills-edge"', '"sectionKey": "skillsedge"'),
  },
  {
    name: 'a word changed in a chatbot section',
    chat: (s) => s.replace('central hub', 'central place'),
  },
  {
    name: 'a chatbot section pointed at a screen that does not exist',
    chat: (s) => s.replace('"routeSuffix": "/coding-pro"', '"routeSuffix": "/coding"'),
  },
  {
    // The parent's renderer says "What you'll find:" — merging the two would silently reword nine
    // fallbacks. The extractor caught this once already.
    name: 'the fallback renderer switched to the parent portal wording',
    chat: (s) => s.replace('**Services available:**', "**What you'll find:**"),
  },
  {
    name: 'a ChapterLink route left unmapped (the button is silently dropped)',
    src: (k, s) =>
      k === 'chatbotConfig' ? s.replace("'/student/platform/skillsedge': '/skills-edge',", '') : s,
  },
  {
    name: 'a ChapterLink route mapped to a full path (the /student/student/... double prefix)',
    src: (k, s) =>
      k === 'chatbotConfig'
        ? s.replace("'/student/platform/skillsedge': '/skills-edge',", "'/student/platform/skillsedge': '/student/skills-edge',")
        : s,
  },
  {
    name: 'resolveStudentLink accepting a route from another portal',
    src: (k, s) => (k === 'chatbotConfig' ? s.replace('LINK_ROUTES[route] ?? null', "LINK_ROUTES[route] ?? '/'") : s),
  },
  {
    name: 'a query topic reworded away from the shared vocabulary',
    src: (k, s) => (k === 'counselorService' ? s.replace("'Assessment Insights'", "'Assessment Insight'") : s),
  },
  {
    name: 'a preferred mode the backend rejects',
    src: (k, s) => (k === 'counselorService' ? s.replace("value: 'WHATSAPP'", "value: 'WHATS_APP'") : s),
  },
  {
    name: 'toISOString() used for the zoneless LocalDateTime',
    src: (k, s) =>
      k === 'counselorService'
        ? s.replace('export function submitCounselorQuery', 'export const stamp = () => new Date().toISOString();\nexport function submitCounselorQuery')
        : s,
  },
  {
    name: 'the datetime field replaced with a hand-joined date and time',
    src: (k, s) => (k === 'screen' ? s.replace('mode="datetime"', 'mode="date"') : s),
  },
  {
    name: 'the past-date guard removed from the booking form',
    src: (k, s) => (k === 'screen' ? s.replace('minimumDate={new Date()}', '') : s),
  },
  {
    name: 'a submit failure toasted behind the open modal',
    src: (k, s) =>
      k === 'screen'
        ? s.replace(
            "setSubmitError(e?.message || 'Failed to submit. Please try again.');",
            "showToast(e?.message || 'Failed to submit. Please try again.', 'error');",
          )
        : s,
  },
  {
    name: 'the student Shreya service pointed at the parent namespace',
    src: (k, s) => (k === 'shreyaService' ? s.replace('/api/student/shreya', '/api/parent/shreya') : s),
  },
  {
    name: 'the counselor service pointed at the wrong endpoint',
    src: (k, s) =>
      // replaceAll, not replace: the file's header comment names this endpoint too, and codeOnly
      // strips comments — mutating only the first occurrence leaves the real call intact and the
      // mutation silently tests nothing. Fifth instance of that trap across these checkers.
      k === 'counselorService'
        ? s.replaceAll('/api/student/counselor-queries', '/api/student/counselor-query')
        : s,
  },
  {
    name: 'the dead learn.js WebView shell restored to the layout',
    src: (k, s) =>
      k === 'layout' ? s.replace('<Stack.Screen name="counselor" />', '<Stack.Screen name="learn" />') : s,
  },
  {
    name: 'CounselorScreen dropped from the barrel',
    src: (k, s) => (k === 'barrel' ? s.replace("export { default as CounselorScreen } from './CounselorScreen';", '') : s),
  },
  {
    name: 'a style key deleted (renders unstyled, build stays green)',
    src: (k, s) => (k === 'screen' ? s.replace('  errorBox: {', '  errorBoxGone: {') : s),
  },
  {
    name: 'autoFocus added to the query textarea',
    src: (k, s) => (k === 'screen' ? s.replace('multiline', 'autoFocus multiline') : s),
  },
];

console.log('Self-tests (each mutation must be caught):');
for (const m of MUTATIONS) {
  let caught;
  try {
    const [menu, keys, chat, webChat, links] = await Promise.all([
      loadMenu(m.menu),
      loadKeys(m.keys),
      loadChatData(m.chat),
      loadWebChatData(),
      loadLinkResolver(m.src ? (s) => m.src('chatbotConfig', s) : undefined),
    ]);
    caught = assertions(menu, keys, chat, webChat, links, loadSources(m.src)).length > 0;
  } catch {
    caught = true; // a mutation that will not even load is caught, loudly
  }
  if (caught) ok(m.name);
  else fail(`NOT CAUGHT: ${m.name} — the corresponding assertion is vacuous`);
}

console.log('\nSpeak to Counselor:');
{
  const [menu, keys, chat, webChat, links] = await Promise.all([
    loadMenu(),
    loadKeys(),
    loadChatData(),
    loadWebChatData(),
    loadLinkResolver(),
  ]);
  const problems = assertions(menu, keys, chat, webChat, links, loadSources());
  if (problems.length === 0) {
    ok(
      `native; ${chat.STUDENT_SECTIONS.length} chatbot sections verbatim, ` +
        `${menu.STUDENT_MENU.length} workspace tiles + ${menu.STUDENT_TEACHER_LINKS.length} teacher links all native, ` +
        'and Speak to Counselor is the footer Support tab',
    );
  } else problems.forEach(fail);
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL — ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
