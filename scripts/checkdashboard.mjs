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
  // CHANGE PASSWORD LEFT THE HEADER when the school crest took the lead position. It is now a row
  // on each portal's own account screen. Asserting its ABSENCE here is the point: BrandBar is a
  // shared header, and putting an account action back into it would re-add it to ten surfaces at
  // once — which is exactly how it came to be the app's only route to change-password.
  if (/changePasswordRoute/.test(codeOnly(src.brandBar))) {
    bad('BrandBar has a Change Password control again — it belongs on each portal account screen');
  }
  // ── THE SCHOOL CREST IS OPT-IN, AND MUST STAY THAT WAY ────────────────────
  //
  // BrandBar is the header of NINE screens — student, teacher, parent and partner homes plus all
  // six app/staff/[role] shells. A partner is not school-bound, and the pre-auth screens have no
  // school at all, so a crest that rendered by default would reach surfaces where it means nothing.
  // `= null` in the signature is what makes "pass nothing, get the old header" true by
  // construction rather than by everyone remembering.
  const brand = codeOnly(src.brandBar);
  if (!/schoolLogoUrl = null/.test(brand)) {
    bad('BrandBar\'s schoolLogoUrl is not opt-in — the partner and pre-auth headers would change too');
  }
  // A broken image URL must fall back, not leave an empty chip. The stored value is a raw unsigned
  // S3 URL, so a 403 is a live possibility rather than a defensive flourish.
  if (!/onError=\{\(\) => setSchoolLogoFailed\(true\)\}/.test(brand)) {
    bad('BrandBar does not fall back when the school logo fails to load');
  }
  // ...and ours must move rather than disappear: exactly one 3C mark, at the end of the row.
  // Keyed off `schoolLeads`, NOT `showSchoolLogo` — a school that has uploaded no logo still leads
  // with its NAME, and keying the trailing mark off the logo alone would drop the 3C brand out of
  // the header entirely for every such school, which today is most of them.
  if (!/schoolLeads \? \(/.test(brand) || !/logoChipTrailing/.test(brand)) {
    bad('BrandBar does not move the 3C Edge logo to the right when the school leads');
  }
  if (!/const schoolLeads = showSchoolLogo \|\| showSchoolName/.test(brand)) {
    bad('BrandBar ties the trailing 3C mark to the logo alone — a name-only school would lose it');
  }
  // THE NAME FALLBACK. Without it a school with no logo renders byte-identically to the old header,
  // so a missing upload is indistinguishable from the feature not working — which is exactly what
  // happened: every school row shipped with school_logo NULL and the change looked like a no-op.
  if (!/const showSchoolName = !showSchoolLogo && !!trimmedName/.test(brand)) {
    bad('BrandBar has no school-name fallback — a school with no logo looks like a broken feature');
  }
  // One bad URL must not disable the crest for the life of the mount: a counsellor covering two
  // schools would then have the second school's good logo suppressed by the first school's bad one.
  if (!/setSchoolLogoFailed\(false\); \}, \[schoolLogoUrl\]\)/.test(brand)) {
    bad('BrandBar never resets its logo-failed flag — a single 403 disables the crest permanently');
  }
  if (!/schoolLogoUrl=\{schoolLogo\}/.test(codeOnly(src.home))) {
    bad('the student home does not pass its school crest to the brand bar');
  }

  // ── THE PANEL IS A LIGHT PAGE NOW ─────────────────────────────────────────
  //
  // It used to be white copy over a fixed photograph (`assets/images/Background.png`) with four
  // different translucent "glass" treatments trying to buy contrast back. Two rules keep it light,
  // and BOTH fail silently: a returned ImageBackground just looks like a design change, and a
  // missed `tone` renders one block dark-on-light while everything around it stays correct.
  const layoutCode = codeOnly(src.layout);
  if (/ImageBackground/.test(layoutCode)) {
    bad('the student layout paints an ImageBackground again — the panel is a light page');
  }
  if (/backgroundColor: 'transparent' \}/.test(layoutCode) && !/contentStyle: \{ backgroundColor: PALETTE\.pageBg \}/.test(layoutCode)) {
    bad('the student Stack is transparent with no image behind it — it flashes the window on push');
  }
  // Every shared-kit mount on the student home defaults to tone="dark"; the student is the only
  // caller that ever took that default, so each one has to say light explicitly.
  const SHARED_MOUNTS = ['<BrandBar', '<IdentityCard', '<HeroCard', '<AssistantCard',
                         '<SearchEntry', '<SectionDivider'];
  for (const tag of SHARED_MOUNTS) {
    // `(?![A-Za-z])` rather than a whitespace class: this is a TEMPLATE LITERAL, so a `\s` written
    // here is resolved by JS to a bare "s" before RegExp ever sees it, and the class silently
    // becomes [s/>] — which matches nothing and reports every mount as missing.
    const opens = (home.match(new RegExp(`${tag}(?![A-Za-z])`, 'g')) || []).length;
    if (!opens) { bad(`the student home no longer mounts ${tag.slice(1)}`); continue; }
    // Count the mounts that carry tone="light" within their opening tag.
    const lit = (home.match(new RegExp(`${tag}[^>]*tone="light"`, 'g')) || []).length;
    if (lit !== opens) {
      bad(`${lit} of ${opens} ${tag.slice(1)} mounts pass tone="light" — the rest render dark on a light page`);
    }
  }
  if (!/<PortalTabBar tabs=\{STUDENT_TABS\} tone="light" \/>/.test(layoutCode)) {
    bad('the student footer does not pass tone="light" — dark bar under a light page');
  }
  // No student screen may read the dark-surface tokens any more. They stay DEFINED in the palette
  // for the shared kit's dark branch, which is exactly why grepping the palette proves nothing.
  for (const key of ['home', 'workspace', 'jyoraHub', 'profile', 'counselor']) {
    const text = codeOnly(src[key] || '');
    const dark = text.match(/\b(?:p|palette)\.(?:onDark|glass|glassBorder|glassDark|glassDarkBorder|glassDarkRaised)\b/g);
    if (dark) bad(`${SRC[key]} still reads dark-surface tokens: ${[...new Set(dark)].join(', ')}`);
  }

  // Change password moved off the student header onto the profile screen, which is where that
  // panel already keeps Log Out. The student's Support tab is a chatbot, so if this row goes the
  // student has no way to change their password at all.
  if (!/<ChangePasswordRow route="\/student\/change-password" \/>/.test(codeOnly(src.profile))) {
    bad('the student profile screen has no Change Password row — the student is stranded');
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
  {
    // The crest made mandatory: the partner header and every pre-auth screen would gain one.
    name: 'the school crest stops being opt-in',
    src: (k, s) => (k === 'brandBar' ? s.replace('schoolLogoUrl = null,', 'schoolLogoUrl,') : s),
  },
  {
    // A 403 on the raw S3 URL would leave an empty chip where the school's mark should be.
    name: 'a broken school logo no longer falls back',
    src: (k, s) => (k === 'brandBar'
      ? s.replace('onError={() => setSchoolLogoFailed(true)}', '')
      : s),
  },
  {
    // Our mark deleted rather than moved — the header would carry no 3C Edge logo at all.
    name: 'the 3C Edge logo is dropped instead of moved right',
    src: (k, s) => (k === 'brandBar' ? s.replace(/logoChipTrailing/g, 'unusedStyle') : s),
  },
  {
    name: 'the student home stops passing its school crest',
    src: (k, s) => (k === 'home'
      ? s.replace('schoolLogoUrl={schoolLogo}', 'schoolLogoUrl={null}')
      : s),
  },
  {
    // The trailing mark tied to the logo again, so a school with a name but no crest loses the
    // 3C Edge mark from its header entirely.
    name: 'the trailing 3C mark is tied to the logo instead of the school leading',
    src: (k, s) => (k === 'brandBar'
      ? s.replace('const schoolLeads = showSchoolLogo || showSchoolName;',
                  'const schoolLeads = showSchoolLogo;')
      : s),
  },
  {
    name: 'the school-name fallback is removed (a missing logo looks like a broken feature)',
    src: (k, s) => (k === 'brandBar'
      ? s.replace('const showSchoolName = !showSchoolLogo && !!trimmedName;',
                  'const showSchoolName = false;')
      : s),
  },
  {
    name: 'the logo-failed flag stops resetting on a new URL',
    src: (k, s) => (k === 'brandBar'
      ? s.replace('useEffect(() => { setSchoolLogoFailed(false); }, [schoolLogoUrl]);', '')
      : s),
  },
  {
    name: 'Change Password is put back into the shared header',
    src: (k, s) => (k === 'brandBar'
      ? s.replace('  tone = \'dark\',', '  changePasswordRoute,\n  tone = \'dark\',')
      : s),
  },
  {
    name: 'the student loses its only Change Password row',
    src: (k, s) => (k === 'profile'
      ? s.replace('<ChangePasswordRow route="/student/change-password" />', '')
      : s),
  },
  {
    name: 'the photographic background returns to the student layout',
    src: (k, s) => (k === 'layout'
      ? s.replace('<View style={styles.bg}>', '<ImageBackground style={styles.bg}>')
      : s),
  },
  {
    name: 'a shared block on the student home loses tone="light"',
    src: (k, s) => (k === 'home'
      ? s.replace(/(<IdentityCard[^>]*?)\s*tone="light"/, '$1')
      : s),
  },
  {
    name: 'the student footer reverts to the dark tab bar',
    src: (k, s) => (k === 'layout'
      ? s.replace('<PortalTabBar tabs={STUDENT_TABS} tone="light" />', '<PortalTabBar tabs={STUDENT_TABS} />')
      : s),
  },
  {
    name: 'a student screen reads a dark-surface token again',
    src: (k, s) => (k === 'workspace' ? s.replace('SLATE[600]', 'p.onDark') : s),
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
