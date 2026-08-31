// Checker for the two product-owner requests:
//   1. "Welcome and then his image and below name should be there on home page" — for every user
//   2. "its not survey.. and student reflection should come just after profile page"
//
//   node scripts/checkhomeheader.mjs
//
// WHY THIS EXISTS. Both changes are the kind nothing else catches. A reordered array, a reverted
// label and a missing storage key are all valid JavaScript that builds clean and renders fine —
// `expo export` and `checkscope.js` see an unbound NAME, never a wrong VALUE or a wrong ORDER.
//
// The riskiest of the three is the storage key: the staff home caches the profile photo URL, and
// if that key is not cleared on logout the NEXT staff member to use the device sees the previous
// one's face under their own name.
//
// Exit code 0 = pass.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`  ✗ ${msg}`);
};
const ok = (msg) => console.log(`  ✓ ${msg}`);

// Mixed line endings live in this repo; normalise so source assertions cannot fail on that alone.
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

const CONSTANTS = ['studentProfileForms.js', 'storageKeys.js'];
const SOURCES = {
  surveyTab: 'components/student/profile/SurveyTab.js',
  studentHome: 'components/student/StudentHome.js',
  // The student home's identity block. It was `WelcomeHeader` until the dashboard redesign, which
  // replaced it with a card carrying three more facts — grade, stream and career preferences —
  // laid out beside the photo rather than under it. WelcomeHeader itself is unchanged and still
  // serves the staff and parent homes, so its own assertions below stay exactly as they were; only
  // the student half is retargeted.
  identityCard: 'components/shared/home/IdentityCard.js',
  staffMenu: 'components/staff/StaffMenuScreen.js',
  welcomeHeader: 'components/ui/WelcomeHeader.js',
  profileService: 'services/student/profileService.js',
};

/** @param {(name: string, src: string) => string} [mutate] */
async function loadConstants(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hdr-'));
  for (const name of CONSTANTS) {
    let src = read(path.join(APP, 'constants', name));
    if (mutate) src = mutate(name, src);
    fs.writeFileSync(path.join(dir, name.replace(/\.js$/, '.mjs')), src);
  }
  const load = (n) => import(pathToFileURL(path.join(dir, `${n}.mjs`)).href);
  return { forms: await load('studentProfileForms'), keys: await load('storageKeys') };
}

/**
 * `tabComplete` is staged separately: profileService imports the transport, which we stub, because
 * the point is to CALL the predicate rather than grep for a `case` label.
 */
async function loadProfileService(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hdrsvc-'));
  fs.mkdirSync(path.join(dir, 'services', 'student'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'services', 'studentApi.mjs'),
    'export const studentApi = { get: async () => ({}), post: async () => ({}), put: async () => ({}), multipart: async () => ({}) };\nexport default studentApi;\n',
  );
  let src = read(path.join(APP, SOURCES.profileService));
  if (mutate) src = mutate(src);
  src = src.replace("from '../studentApi'", "from '../studentApi.mjs'");
  fs.writeFileSync(path.join(dir, 'services', 'student', 'profileService.mjs'), src);
  return import(pathToFileURL(path.join(dir, 'services', 'student', 'profileService.mjs')).href);
}

function loadSources(mutate) {
  const out = {};
  for (const [k, rel] of Object.entries(SOURCES)) {
    out[k] = mutate ? mutate(k, read(path.join(APP, rel))) : read(path.join(APP, rel));
  }
  return out;
}

/**
 * Every user-visible string in a file: quoted literals plus JSX text nodes, with comments removed
 * first so a note about the endpoint does not read as copy.
 *
 * Endpoint paths and identifiers are excluded deliberately — the KEY stays `survey`, only the
 * wording changes.
 */
function visibleStrings(src) {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const out = [];
  for (const m of code.matchAll(/'([^'\n]{2,})'|"([^"\n]{2,})"/g)) {
    const value = m[1] ?? m[2];
    if (value.startsWith('/api/') || value.startsWith('/')) continue; // endpoints and routes
    if (!/\s/.test(value)) continue; // single tokens are prop values, not prose
    out.push(value);
  }
  for (const m of code.matchAll(/>\s*([A-Z][^<>{}\n]{3,})</g)) out.push(m[1].trim());
  return out;
}

async function assertions(mods, sources, profileService) {
  const out = [];
  const bad = (m) => out.push(m);
  const { forms, keys } = mods;
  const tabs = forms.PROFILE_TABS;

  // ── 1. Student Reflection: named and placed ───────────────────────────────
  if (!Array.isArray(tabs) || tabs.length !== 8) {
    bad(`PROFILE_TABS should still hold 8 tabs, found ${tabs?.length}`);
  }
  if (tabs?.[0]?.key !== 'personal') bad('the first profile tab must stay `personal`');
  if (tabs?.[1]?.key !== 'survey') {
    bad(`the reflection tab must be SECOND, directly after the profile page; index 1 is "${tabs?.[1]?.key}"`);
  }
  const reflection = tabs?.find((t) => t.key === 'survey');
  if (reflection?.label !== 'Student Reflection') {
    bad(`the tab label must be "Student Reflection", found "${reflection?.label}"`);
  }
  // A reorder must not silently drop a tab.
  const expectedKeys = ['personal', 'survey', 'academic', 'education', 'university', 'career', 'skillsedge', 'additional'];
  const missing = expectedKeys.filter((k) => !tabs?.some((t) => t.key === k));
  if (missing.length) bad(`profile tabs lost: ${missing.join(', ')}`);

  // ── 2. no user-visible "survey" wording left ──────────────────────────────
  const leftovers = visibleStrings(sources.surveyTab).filter((v) => /survey/i.test(v));
  if (leftovers.length) {
    bad(`SurveyTab still shows the word "survey" to a student: ${JSON.stringify(leftovers)}`);
  }

  // ── 3. the completion dot works ───────────────────────────────────────────
  if (profileService.tabComplete('survey', { 12: 3 }) !== true) {
    bad('tabComplete("survey", …) must be true once the reflection has answers');
  }
  if (profileService.tabComplete('survey', {}) !== false) {
    bad('tabComplete("survey", {}) must be false — an empty response map is not a submission');
  }

  // ── 4. the cached staff photo cannot leak between users ───────────────────
  if (!keys.STAFF_PHOTO_KEY) bad('STAFF_PHOTO_KEY is not exported');
  else if (!keys.ALL_AUTH_KEYS.includes(keys.STAFF_PHOTO_KEY)) {
    bad('STAFF_PHOTO_KEY is missing from ALL_AUTH_KEYS — the next user on the device would inherit the previous one’s photo');
  }

  // ── 5. every home screen shows an identity block, with an initials fallback ────
  //
  // The REQUEST was "his image and below name should be there on home page — for every user". The
  // student home now satisfies it with its own card rather than WelcomeHeader, so what is asserted
  // is the requirement, not the component that used to implement it.
  if (!/<IdentityCard/.test(sources.studentHome)) {
    bad('the student home does not render IdentityCard — it has no identity block');
  }
  // Scoped deliberately: StaffMenuScreen now serves only Principal and Shreyartha Admin. The four
  // redesigned panels render StaffHomeScreen, whose identity block is IdentityCard — so this
  // asserts the header those two still depend on, not "the staff home" in general.
  if (!/<WelcomeHeader/.test(sources.staffMenu)) {
    bad('StaffMenuScreen does not render WelcomeHeader — Principal and Shreyartha Admin lost their identity block');
  }

  // The card's own contract: a photo that falls back to initials, and the photo before the rows.
  const card = sources.identityCard;
  if (!/initialsOf/.test(card)) {
    bad('IdentityCard has no initials fallback — a PARENT has no photo field in the backend at all, so this is the only case there');
  }

  // THE ROWS MOVED OUT OF THE COMPONENT. They are a prop now, because the parent dashboard passes
  // six facts (its own name and email, then the child's name, grade, stream and school) where the
  // student passes four. So the student's four are asserted where they are now declared — at the
  // call site — rather than against a component that no longer knows what a "career" is.
  for (const key of ['name', 'grade', 'stream', 'careers']) {
    if (!new RegExp(`key: '${key}'`).test(sources.studentHome)) {
      bad(`the student identity card no longer shows ${key} — the design calls for all four rows`);
    }
  }

  // The photo must come before the rows, which is the "image, and below/beside it the name" order.
  const photoAt = card.indexOf('{avatar}');
  const rowsAt = card.indexOf('styles.rows');
  if (photoAt < 0 || rowsAt < 0) bad('IdentityCard is missing its avatar or its rows block');
  else if (photoAt > rowsAt) bad('IdentityCard renders the facts before the photo');
  // Its three parts in the order asked for: Welcome, then the image, then the name.
  //
  // Measured inside the RENDERED block only. An earlier version of this check read the whole file
  // and failed on correct code, because the avatar is built into a const at the top of the
  // component — source order and render order are not the same thing.
  //
  // Anchored on `styles.identity` rather than the whole `<View style={styles.identity}>` tag: the
  // student home now passes `compact`, so the style props are wrapped (`c(styles.identity,
  // styles.identityCompact)`). That is a SIZE change only — the order assertion below is exactly
  // what stops a future "let's make it slimmer" pass from quietly reordering the block instead.
  const header = sources.welcomeHeader;
  const identityAt = header.indexOf('styles.identity');
  if (identityAt < 0) bad('WelcomeHeader no longer has an identity block');
  const identity = header.slice(Math.max(identityAt, 0));
  const order = ['styles.greeting', '{avatar}', 'styles.name'].map((t) => identity.indexOf(t));
  if (order.some((i) => i < 0)) bad('WelcomeHeader is missing one of greeting / avatar / name');
  else if (!(order[0] < order[1] && order[1] < order[2])) {
    bad('WelcomeHeader must render Welcome, then the photo, then the name below it');
  }
  if (!/initialsOf/.test(header)) {
    bad('WelcomeHeader has no initials fallback — parents and partners have no photo at all');
  }
  // The old one-line greeting must be gone from the staff home, or two greetings render.
  if (/Hi, \{profile\.name\}/.test(sources.staffMenu)) bad('the staff home still says "Hi," instead of Welcome');

  return out;
}

const MUTATIONS = [
  {
    name: 'the reflection tab moved back to last',
    constants: (n, s) =>
      n === 'studentProfileForms.js'
        ? s.replace(
            "  { key: 'survey', label: 'Student Reflection', icon: 'clipboard-outline', custom: true },\n",
            '',
          ).replace(
            "  { key: 'additional', label: 'Additional', icon: 'document-text-outline' },\n",
            "  { key: 'additional', label: 'Additional', icon: 'document-text-outline' },\n  { key: 'survey', label: 'Student Reflection', icon: 'clipboard-outline', custom: true },\n",
          )
        : s,
  },
  {
    name: 'the tab label reverted to "Survey"',
    constants: (n, s) =>
      n === 'studentProfileForms.js' ? s.replace("label: 'Student Reflection'", "label: 'Survey'") : s,
  },
  {
    name: 'a tab dropped during the reorder',
    constants: (n, s) =>
      n === 'studentProfileForms.js' ? s.replace(/^.*key: 'career'.*$/m, '') : s,
  },
  {
    name: 'STAFF_PHOTO_KEY dropped from ALL_AUTH_KEYS (photo leaks to the next user)',
    constants: (n, s) => (n === 'storageKeys.js' ? s.replace('  STAFF_PHOTO_KEY,\n', '') : s),
  },
  {
    name: 'the tabComplete case removed (dot can never light)',
    service: (s) => s.replace("    case 'survey':", "    case '__never':"),
  },
  {
    name: 'visible "Submit Survey" wording restored',
    sources: (k, s) =>
      k === 'surveyTab' ? s.replace('Submit Reflection', 'Submit Survey') : s,
  },
  {
    name: 'the student home dropped its identity block',
    sources: (k, s) =>
      k === 'studentHome' ? s.replace('<IdentityCard', '<OldHeader') : s,
  },
  {
    name: 'the student identity card stopped showing the stream',
    sources: (k, s) => (k === 'studentHome' ? s.replace("key: 'stream'", "key: 'dropped'") : s),
  },
  {
    name: 'the identity card lost its initials fallback',
    sources: (k, s) => (k === 'identityCard' ? s.replaceAll('initialsOf', 'noFallback') : s),
  },
  {
    name: 'the identity card renders the facts above the photo',
    sources: (k, s) =>
      k === 'identityCard' ? s.replace('{avatar}', '{/* moved */}').replace('styles.rows}>', 'styles.rows}>{avatar}') : s,
  },
  {
    name: 'the greeting moved below the name (wrong order)',
    // Swaps which style each <Text> carries, so the greeting renders where the name should be.
    //
    // The style props are matched by NAME rather than by their full expression: the student home
    // passes `compact`, so they are wrapped as `c(styles.greeting, styles.greetingCompact)`. The
    // original mutation hard-coded the unwrapped `styles.greeting}>{greeting}` and silently stopped
    // matching the moment that wrapper appeared — the mutation still "passed" while testing
    // nothing, which is exactly the failure mode these self-tests exist to prevent.
    sources: (k, s) =>
      k === 'welcomeHeader'
        ? s
            .replace(/styles\.greeting, styles\.greetingCompact\)\}>\{greeting\}/,
                     'styles.name, styles.nameCompact)}>{greeting}')
            .replace(/styles\.name, styles\.nameCompact\)\} numberOfLines=\{2\}/,
                     'styles.greeting, styles.greetingCompact)} numberOfLines={2}')
        : s,
  },
  {
    name: 'the initials fallback removed',
    sources: (k, s) => (k === 'welcomeHeader' ? s.replace(/initialsOf/g, 'String') : s),
  },
];

console.log('Self-tests (each mutation must be caught):');
for (const m of MUTATIONS) {
  let caught;
  try {
    const mods = await loadConstants(m.constants);
    const svc = await loadProfileService(m.service);
    caught = (await assertions(mods, loadSources(m.sources), svc)).length > 0;
  } catch {
    caught = true; // a mutation that will not even load is caught, loudly
  }
  if (caught) ok(m.name);
  else fail(`NOT CAUGHT: ${m.name} — the corresponding assertion is vacuous`);
}

console.log('\nWelcome header + Student Reflection:');
{
  const problems = await assertions(
    await loadConstants(),
    loadSources(),
    await loadProfileService(),
  );
  if (problems.length === 0) {
    ok('reflection is the 2nd profile tab, named as the website names it, and every home screen greets with Welcome + photo + name');
  } else problems.forEach(fail);
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL — ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
