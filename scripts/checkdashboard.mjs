// The redesigned student dashboard, its shell, and the language switcher.
//
//   node scripts/checkdashboard.mjs
//
// WHY THIS EXISTS. This redesign moved four things that other checkers used to pin, and added two
// that nothing pinned at all. Every failure below builds clean and renders something:
//
//   * A career preferences line sorted by insertion order instead of `priority` shows a student
//     their third choice first. `priority` carries a unique constraint per student, so the data is
//     always sortable and always wrong-looking if you don't.
//   * `currentClass` is free text and holds BOTH "10" and "Class VIII". Prefixing unconditionally
//     produces "Grade Class VIII" — a label nobody looked at on real rows.
//   * The three teacher links must reach the student endpoints. The teacher's own endpoints return
//     the SAME DTO classes, so a wrong path fails on authorization, never on shape.
//   * The language picker's OWN words must never be translated, or a student who lands in Kannada
//     by accident cannot find the control that gets them back. The web marks it `data-no-translate`
//     for exactly this reason.
//   * Every `useTranslations` map must be module scope. The hook keeps the first object it sees as
//     the English baseline; a map rebuilt per render re-translates forever, on a rate-limited API.
//   * The footer is drawn OVER the Stack, so each of the three tab roots has to pad for it or its
//     last control sits under the bar.
//
// Exit code 0 = pass.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');

const SRC = {
  home: 'components/student/StudentHome.js',
  identity: 'components/shared/home/IdentityCard.js',
  hero: 'components/shared/home/HeroCard.js',
  assistant: 'components/shared/home/AssistantCard.js',
  tabBar: 'components/shared/home/PortalTabBar.js',
  brandBar: 'components/shared/home/BrandBar.js',
  picker: 'components/shared/LanguagePicker.js',
  workspace: 'components/student/WorkspaceScreen.js',
  layout: 'app/student/_layout.js',
  profile: 'components/student/ProfileScreen.js',
  counselor: 'components/student/CounselorScreen.js',
  jyoraHub: 'components/student/JyoraHubScreen.js',
};

let failures = 0;
const fail = (m) => {
  failures += 1;
  console.error(`  ✗ ${m}`);
};
const ok = (m) => console.log(`  ✓ ${m}`);

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

/**
 * Comments stripped before every source assertion.
 *
 * LOAD-BEARING. StudentHome's header explains the two-wave fan-out and names `Promise.all` while
 * saying never to use it; the picker's header names `data-no-translate`; the Jyora hub's header
 * quotes `staticContent` while explaining that the right field is `contentHtml`. A bare grep finds
 * each warning and reports the bug as present.
 */
const codeOnly = (t) => t.replace(/(^|\s)\/\*[\s\S]*?\*\//g, '$1').replace(/^\s*\/\/.*$/gm, '');

function loadSources(mutate) {
  const out = {};
  for (const [k, rel] of Object.entries(SRC)) {
    out[k] = mutate ? mutate(k, read(path.join(APP, rel))) : read(path.join(APP, rel));
  }
  return out;
}

/**
 * StudentHome's two pure helpers, lifted out and evaluated.
 *
 * Reading them as text proves the shape; the traps are BEHAVIOUR — a roman-numeral class and an
 * out-of-order priority list — and only running them proves those.
 */
async function loadHelpers(mutate) {
  let src = read(path.join(APP, SRC.home));
  if (mutate) src = mutate(src);

  const grade = src.match(/function gradeLabel\(currentClass\) \{[\s\S]*?\n\}/);
  const careers = src.match(/function careersLabel\(preferences, profile\) \{[\s\S]*?\n\}/);
  if (!grade || !careers) return null;

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-'));
  const file = path.join(dir, 'helpers.mjs');
  fs.writeFileSync(file, `export ${grade[0]}\nexport ${careers[0]}\n`);
  return import(`${pathToFileURL(file).href}?t=${Math.random()}`);
}

function assertions(helpers, src) {
  const out = [];
  const bad = (m) => out.push(m);

  /* ── 1. THE IDENTITY CARD'S FOUR FACTS ARE REAL ──────────────────────────── */

  if (!helpers) {
    bad('could not extract gradeLabel/careersLabel for evaluation — check this assertion');
  } else {
    // A bare number gets the prefix; anything already worded keeps its own wording.
    if (helpers.gradeLabel('10') !== 'Grade 10') {
      bad(`gradeLabel("10") = ${helpers.gradeLabel('10')}, expected "Grade 10"`);
    }
    if (helpers.gradeLabel('Class VIII') !== 'Class VIII') {
      bad(`gradeLabel("Class VIII") = ${helpers.gradeLabel('Class VIII')} — the prefix was applied to an already-worded class`);
    }
    if (helpers.gradeLabel(null) !== '') bad('gradeLabel invents a grade for a student who has none');

    // Careers are ordered by `priority`, NOT by the order the server happened to return them.
    const prefs = [
      { priority: 3, topicName: 'Doctor' },
      { priority: 1, topicName: 'Data Scientist' },
      { priority: 2, topicName: 'AI Engineer' },
    ];
    const line = helpers.careersLabel(prefs, null);
    if (line !== 'Data Scientist, AI Engineer, Doctor') {
      bad(`careersLabel ignored priority: "${line}"`);
    }
    // The free-text field is the fallback, and only the fallback.
    if (helpers.careersLabel([], { careerExplore: 'Astronaut' }) !== 'Astronaut') {
      bad('careersLabel does not fall back to careerExplore when there are no structured preferences');
    }
    if (helpers.careersLabel(prefs, { careerExplore: 'Astronaut' }) === 'Astronaut') {
      bad('careersLabel preferred the free-text field over the structured preferences');
    }
    if (helpers.careersLabel(null, null) !== '') bad('careersLabel invents a career from nothing');
  }

  const identity = codeOnly(src.identity);
  if (!/Not set/.test(identity)) {
    bad('a missing fact has no "Not set" state — an empty row reads as a rendering bug');
  }

  /* ── 2. THE FAN-OUT IS SETTLED, AND THE BARS ARE A SECOND WAVE ───────────── */

  const home = codeOnly(src.home);
  if (/Promise\.all\(/.test(home)) {
    bad('StudentHome uses Promise.all — a free student\'s expected 403 on entitlements would blank the dashboard');
  }
  if (!/Promise\.allSettled\(/.test(home)) bad('the identity fan-out is not settled');
  if (!/fetchCareerPreferences\(\)/.test(home)) {
    bad('career preferences are not fetched — the design\'s fourth row would always be empty');
  }

  /* ── 3. THE FOOTER, AND THE THREE ROOTS THAT PAD FOR IT ──────────────────── */

  const tabBar = codeOnly(src.tabBar);
  for (const route of ['/student', '/student/counselor', '/student/profile']) {
    if (!new RegExp(`route: '${route}'`).test(tabBar)) bad(`the footer has no tab for ${route}`);
  }
  if (!/export function isTabRoot/.test(tabBar)) {
    bad('isTabRoot is gone — the layout cannot tell which screens should show the bar');
  }
  // `replace`, not `push`: three tabs must not build a stack.
  if (/router\.push\(tab\.route\)/.test(tabBar)) {
    bad('the footer pushes instead of replacing — tapping between tabs would build a deep stack');
  }
  // The bar is drawn over the Stack, so every root has to clear it.
  for (const key of ['home', 'profile', 'counselor']) {
    if (!/TAB_BAR_HEIGHT/.test(codeOnly(src[key]))) {
      bad(`${SRC[key]} does not pad for the footer — its last control sits under the bar`);
    }
  }
  // `isTabRoot` takes the tab list now that the bar is shared with the teacher panel — and it MUST
  // be the same list the bar is rendered with, or the footer appears on a screen that never padded
  // for it and swallows that screen's last control.
  if (!/isTabRoot\(pathname, STUDENT_TABS\)/.test(codeOnly(src.layout))) {
    bad('the layout renders the footer unconditionally — it would cover the sixteen inner screens');
  }
  // Every new route needs a Stack.Screen or it is unmatched.
  for (const name of ['workspace', 'search', 'jyora', 'teacher-resources', 'personalised-resources']) {
    if (!new RegExp(`name="${name}"`).test(src.layout)) {
      bad(`/student/${name} is not registered as a Stack.Screen`);
    }
    if (!fs.existsSync(path.join(APP, 'app', 'student', `${name}.js`))) {
      bad(`app/student/${name}.js does not exist, but the layout registers it`);
    }
  }

  /* ── 4. THE LANGUAGE PICKER ──────────────────────────────────────────────── */

  const picker = codeOnly(src.picker);
  if (!/useLanguage\(\)/.test(picker)) bad('the picker is not wired to LanguageContext');
  if (!/setLanguage\(/.test(picker)) bad('the picker never sets the language');
  // ITS OWN WORDS MUST NOT TRANSLATE.
  if (/useTranslations/.test(picker)) {
    bad('the language picker runs its own labels through useTranslations — a student who lands in a language they cannot read could never find it again');
  }
  // Options are shown in their own script, not the current one.
  if (!/nativeName/.test(picker)) bad('the picker does not show each language in its own script');
  if (!/englishName/.test(picker)) bad('the picker does not show the English name alongside');
  if (!/<LanguagePicker/.test(codeOnly(src.brandBar))) {
    bad('the brand bar does not mount the language picker — requirement 2 is unmet');
  }
  // THE ROUTE BECAME A PROP when the brand bar was promoted to `components/shared/` for the parent
  // dashboard, so the literal now lives at the call site. Both halves are asserted: the bar has a
  // control wired to whatever it is given, and the student home gives it the student's route.
  if (!/router\.push\(changePasswordRoute\)/.test(codeOnly(src.brandBar))) {
    bad('the brand bar has no Change Password control');
  }
  if (!/changePasswordRoute="\/student\/change-password"/.test(codeOnly(src.home))) {
    bad('the student home does not point the brand bar at its own change-password route');
  }

  /* ── 5. EVERY STRINGS MAP IS MODULE SCOPE ────────────────────────────────── */

  for (const key of ['home', 'workspace', 'jyoraHub']) {
    const text = codeOnly(src[key]);
    if (!/useTranslations/.test(text)) {
      bad(`${SRC[key]} does not translate its labels — the language button would do nothing there`);
      continue;
    }
    // Module scope: declared at column zero, not inside the component.
    if (!/^const STRINGS = \{/m.test(text)) {
      bad(`${SRC[key]}'s STRINGS map is not module scope — the hook would re-translate on every render`);
    }
  }
  // Proper nouns must not be translated: an engine will transliterate them into something the
  // student has never seen anywhere else in the app.
  if (/jyoraName|shreyaName/.test(codeOnly(src.home))) {
    bad('an assistant NAME was put into the STRINGS map — names must not be translated');
  }

  /* ── 6. THE ASSISTANTS KEEP THEIR OWN COLOURS AND REACH REAL SCREENS ─────── */

  const assistant = codeOnly(src.assistant);
  if (/usePalette/.test(assistant)) {
    bad('AssistantCard takes the panel palette — Jyora is purple and Shreya is blue on every other surface');
  }
  if (!/\/student\/jyora/.test(home)) bad('the Jyora card has no destination');
  if (!/chat: '1'/.test(home)) {
    bad('the Shreya card does not open the chat — it would land on a menu after promising a conversation');
  }
  if (!/chatParam === '1'/.test(codeOnly(src.counselor))) {
    bad('the counselor screen ignores ?chat=1');
  }

  /* ── 7. JYORA HAS NO FREE-TEXT BOX, AND SENDS THE RIGHT FIELD ────────────── */

  const jyora = codeOnly(src.jyoraHub);
  if (/staticContent/.test(jyora)) {
    bad('the Jyora hub sends `staticContent` — the server reads `contentHtml`, and a wrong key is silently empty');
  }
  if (!/contentHtml:/.test(jyora)) bad('the Jyora hub sends no content at all');
  // The website has no Jyora input by design; adding one on mobile would undo that decision.
  if (/<TextInput/.test(jyora)) {
    bad('the Jyora hub has a free-text input — the website deliberately has none (unsafe queries)');
  }

  return out;
}

const MUTATIONS = [
  {
    name: 'THE BUG: careers listed in server order instead of by priority',
    helpers: (s) => s.replace('.sort((a, b) => (a?.priority || 0) - (b?.priority || 0))', ''),
  },
  {
    name: 'the free-text career preferred over the structured preferences',
    helpers: (s) =>
      s.replace(
        "  if (names.length) return names.join(', ');",
        "  if (String(profile?.careerExplore || '').trim()) return String(profile.careerExplore).trim();\n  if (names.length) return names.join(', ');",
      ),
  },
  {
    name: 'THE BUG: "Grade" prefixed onto an already-worded class',
    helpers: (s) => s.replace("return /^\\d+$/.test(raw) ? `Grade ${raw}` : raw;", 'return `Grade ${raw}`;'),
  },
  {
    name: 'a grade invented for a student who has none',
    helpers: (s) => s.replace("if (!raw) return '';", "if (!raw) return 'Grade 1';"),
  },
  {
    name: 'the identity fan-out made all-or-nothing',
    src: (k, s) => (k === 'home' ? s.replace('Promise.allSettled(', 'Promise.all(') : s),
  },
  {
    name: 'career preferences no longer fetched',
    src: (k, s) => (k === 'home' ? s.replace('fetchCareerPreferences(),', 'Promise.resolve([]),') : s),
  },
  {
    name: 'the footer pushing instead of replacing (a stack three deep)',
    src: (k, s) => (k === 'tabBar' ? s.replace('router.replace(tab.route)', 'router.push(tab.route)') : s),
  },
  {
    name: 'the Profile tab dropped from the footer',
    src: (k, s) => (k === 'tabBar' ? s.replace("route: '/student/profile'", "route: '/student/nowhere'") : s),
  },
  {
    name: 'a tab root no longer clearing the footer',
    src: (k, s) => (k === 'profile' ? s.replaceAll('TAB_BAR_HEIGHT', 'ZERO_HEIGHT') : s),
  },
  {
    name: 'the footer rendered on every screen, not just the roots',
    src: (k, s) => (k === 'layout' ? s.replace('isTabRoot(pathname, STUDENT_TABS)', 'true') : s),
  },
  {
    name: 'THE TRAP: the language picker translating its own labels',
    src: (k, s) =>
      k === 'picker'
        ? s.replace("import { useLanguage }", "import { useTranslations } from '../../hooks/useTranslations';\nimport { useLanguage }")
        : s,
  },
  {
    name: 'the picker dropped from the brand bar',
    // Matched on the tag name alone. The previous version pinned the whole literal
    // `<LanguagePicker compact />`, and adding one `tone` prop stopped it matching — the mutation
    // then "passed" while testing nothing, which is the exact failure these self-tests exist for.
    src: (k, s) => (k === 'brandBar' ? s.replace('<LanguagePicker', '<NoPicker') : s),
  },
  {
    name: 'a STRINGS map moved inside the component (re-translates every render)',
    src: (k, s) => (k === 'workspace' ? s.replace('const STRINGS = {', '  const STRINGS = {') : s),
  },
  {
    name: 'a redesigned screen no longer translating its labels',
    src: (k, s) => (k === 'jyoraHub' ? s.replaceAll('useTranslations', 'noTranslate') : s),
  },
  {
    name: 'the assistants repainted in the panel palette',
    src: (k, s) =>
      k === 'assistant'
        ? s.replace("import { makeStyles }", "import { usePalette } from '../../ui/PaletteContext';\nimport { makeStyles }")
        : s,
  },
  {
    name: 'the Shreya card landing on a menu instead of the chat',
    src: (k, s) => (k === 'home' ? s.replace("params: { chat: '1' }", 'params: {}') : s),
  },
  {
    name: "THE SILENT EMPTY: Jyora sent the web component's prop name",
    src: (k, s) => (k === 'jyoraHub' ? s.replace('contentHtml:', 'staticContent:') : s),
  },
  {
    name: 'a free-text Jyora box added (undoing the web\'s safety decision)',
    src: (k, s) =>
      k === 'jyoraHub' ? s.replace('<SegmentedTabs', '<TextInput value="" />\n      <SegmentedTabs') : s,
  },
];

console.log('Self-tests (each mutation must be caught):');
for (const m of MUTATIONS) {
  let caught;
  try {
    const helpers = await loadHelpers(m.helpers);
    caught = assertions(helpers, loadSources(m.src)).length > 0;
  } catch {
    caught = true; // a mutation that will not even load is caught, loudly
  }
  if (caught) ok(m.name);
  else fail(`NOT CAUGHT: ${m.name} — the corresponding assertion is vacuous`);
}

console.log('\nStudent dashboard, shell and language:');
{
  const helpers = await loadHelpers();
  const problems = assertions(helpers, loadSources());
  if (problems.length === 0) {
    ok('the four identity facts are real: careers by priority, and a class label that reads right');
    ok('the identity fan-out is settled — one expected 403 costs a badge, not the dashboard');
    ok('three tab roots, each padding for a footer that only renders on them');
    ok('every new route is registered and has a file');
    ok("the language picker is mounted, and its OWN words are never translated");
    ok('every redesigned screen translates through a module-scope STRINGS map');
    ok('the assistants keep their own colours and reach real destinations');
    ok('Jyora sends contentHtml and has no free-text box');
  } else problems.forEach(fail);
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL — ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
