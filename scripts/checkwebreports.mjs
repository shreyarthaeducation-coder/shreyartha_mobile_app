/**
 * The app's reports are the website's (6 Nov 2026) — and the 6 Nov parent and Learn with Shreya asks.
 *
 *   1. Every <WebReport kind="…"> the app uses is a kind the website's /app-report page draws
 *      (frontendmain/src/appReports/AppReportHost.js KINDS), and every WebReport has a fallback.
 *   2. The website routes /app-report/:kind, installs the file bridge at start-up, and the backend
 *      lets /app-report/** load on a hard refresh (SecurityConfig).
 *   3. The parent home: My Children in Payment History's place; the route exists and opens before
 *      verification; All sections lists every feature.
 *   4. Learn with Shreya's third tab is "Learn with your mother tongue" with a speaker, on both.
 *   5. No login screen repeats "Shreyartha" under the logo.
 *
 * Self-tested: each mutation below must be caught. usage: node scripts/checkwebreports.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(APP, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.expo', 'dist', '_student_native'].includes(f.name)) continue;
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out);
    else if (f.name.endsWith('.js')) out.push(p);
  }
  return out;
}

function sources() {
  const app = {};
  for (const p of [...walk(path.join(APP, 'components')), ...walk(path.join(APP, 'app'))]) {
    app[path.relative(ROOT, p).replace(/\\/g, '/')] = fs.readFileSync(p, 'utf8');
  }
  return {
    app,
    host: read('frontendmain/src/appReports/AppReportHost.js'),
    appJs: read('frontendmain/src/App.js'),
    index: read('frontendmain/src/index.js'),
    security: read('backendmain/src/main/java/com/shreyartha/backend/common/config/SecurityConfig.java'),
    webTabs: read('frontendmain/src/student/platform/LanguagePro/LearnWithShreya/speaking/SpeakingChallenge.js'),
    webTranslation: read('frontendmain/src/student/platform/LanguagePro/LearnWithShreya/speaking/TranslationTab.js'),
    menu: read('shreyartha_mobile_app/constants/parentMenu.js'),
    webSegments: read('frontendmain/src/components/SignupPicker/signupSegments.js'),
    webDropdown: read('frontendmain/src/components/LoginDropdown/LoginDropdown.js'),
    speaking: read('backendmain/src/main/java/com/shreyartha/backend/shreyaenglish/service/ShreyaSpeakingService.java'),
  };
}

const APP_FILE = (s, name) => s.app[`shreyartha_mobile_app/${name}`] || '';

function audit(s) {
  const problems = [];
  const bad = (m) => problems.push(m);

  // 1
  const kinds = new Set([...s.host.matchAll(/^\s+"?([a-z-]+)"?: lazy\(/gm)].map((m) => m[1]));
  let uses = 0;
  for (const [file, src] of Object.entries(s.app)) {
    // The parent's website pages (6 Nov 2026): ParentWebPage passes its caller's kind through, so
    // each ParentWebPage use is held to the same rules instead.
    for (const m of src.matchAll(/<ParentWebPage\b([\s\S]*?)\/>\s*\n/g)) {
      uses += 1;
      const kind = /kind="([a-z-]+)"/.exec(m[1])?.[1];
      if (!kind) bad(`${file}: a ParentWebPage without a literal kind`);
      else if (!kinds.has(kind)) bad(`${file}: ParentWebPage kind "${kind}" — the website page has no such report`);
      if (!/native=\{/.test(m[1])) bad(`${file}: ParentWebPage kind "${kind}" has no native fallback`);
    }
    if (file.endsWith('components/parent/ParentWebPage.js')) continue;
    for (const m of src.matchAll(/<WebReport\b([\s\S]*?)\/>/g)) {
      uses += 1;
      const kind = /kind="([a-z-]+)"/.exec(m[1])?.[1];
      if (!kind) bad(`${file}: a WebReport without a literal kind`);
      else if (!kinds.has(kind)) bad(`${file}: WebReport kind "${kind}" — the website page has no such report`);
      if (!/fallback=/.test(m[1])) bad(`${file}: WebReport kind "${kind}" has no fallback — a lost connection is a blank box`);
      if (!/portal=/.test(m[1])) bad(`${file}: WebReport kind "${kind}" names no portal`);
    }
  }
  if (uses < 12) bad(`only ${uses} WebReport uses — a report screen went back to native-only`);

  // 2
  if (!/path="\/app-report\/:kind"/.test(s.appJs)) bad('the website has no /app-report/:kind route');
  if (!/installAppBridge\(\)/.test(s.index)) bad('the website no longer installs the app file bridge at start-up');
  if (!/"\/app-report\/\*\*"/.test(s.security)) bad('SecurityConfig does not let /app-report/** load');

  // 3
  const home = APP_FILE(s, 'components/parent/ParentMenuScreen.js');
  if (!/key: 'children',[\s\S]*?route: '\/parent\/children'/.test(home)) bad('My Children is not a quick action on the parent home');
  if (/key: 'history',/.test(home)) bad('Payment History is a quick action again (My Children took its place)');
  if (!APP_FILE(s, 'app/parent/children.js')) bad('app/parent/children.js is missing');
  if (!/'\/parent\/children'/.test(APP_FILE(s, 'app/parent/_layout.js'))) bad('/parent/children does not open before verification');
  for (const key of ['children', 'view-report', 'test-analysis', 'counselling-report', 'academic-progress', 'learning-activities',
    'attendance-schedule', 'notifications', 'fees', 'payment-history']) {
    if (!new RegExp(`key: '${key}'`).test(s.menu)) bad(`All sections is missing "${key}"`);
  }
  if (!/ParentLinkBox/.test(APP_FILE(s, 'components/parent/ParentPendingScreen.js'))) bad('the pending screen lost the school-code box');
  // Parent sign-up as the website's (6 Nov 2026): email optional, no child field at sign-up.
  const parentSignup = APP_FILE(s, 'app/auth/parent-login.js');
  if (!/>Email \(optional\)</.test(parentSignup)) bad('the app parent sign-up does not say the email is optional');
  if (/!fullName \|\| !email/.test(parentSignup)) bad('the app parent sign-up requires an email again');
  if (/studentMobileOrEmail/.test(parentSignup)) bad("the app parent sign-up asks for the child's contact again (the child is linked after signing in)");

  // 4
  if (!/"🌐 Learn with your mother tongue"/.test(s.webTabs)) bad('website tab is not "Learn with your mother tongue"');
  if (!/label: 'Learn with your mother tongue'/.test(APP_FILE(s, 'components/student/languagepro/speaking/SpeakingChallengeScreen.js'))) {
    bad('app tab is not "Learn with your mother tongue"');
  }
  if (!/readAloud\(/.test(s.webTranslation)) bad('the website translation has no speaker');
  if (!/readAloud\(/.test(APP_FILE(s, 'components/student/languagepro/speaking/TranslationPanel.js'))) bad('the app translation has no speaker');

  // 5
  for (const f of ['app/auth/student-login.js', 'app/auth/parent-login.js', 'app/auth/partner-login.js', 'app/auth/forgot-password.js']) {
    if (/>Shreyartha<\/Text>/.test(APP_FILE(s, f))) bad(`${f} repeats "Shreyartha" under the logo`);
  }
  // 6. Sign-up in two layers of tiles, on the website and in the app (6 Nov 2026).
  const webSegmentLabels = [...s.webSegments.matchAll(/key: "[a-zA-Z]+",\s*label: "([^"]+)",\s*blurb: "[^"]*",\s*icon: "[a-zA-Z]+",\s*accent:/g)].map((m) => m[1]);
  if (webSegmentLabels.join('|') !== 'School|University|Industry|Partner & Investor') {
    bad(`website sign-up segments are [${webSegmentLabels.join(', ')}]`);
  }
  for (const label of ['School', 'University', 'Industry', 'Partner & Investor']) {
    if (!APP_FILE(s, 'components/auth/SignupTiles.js').includes(`label: '${label}'`)) bad(`app sign-up has no "${label}" segment`);
  }
  if (!/<SignupPicker/.test(s.webDropdown)) bad('Get Started no longer opens the two-layer picker');
  if (!/<SignupTiles/.test(APP_FILE(s, 'app/auth/sign-in.js'))) bad('the app sign-in no longer shows the two-layer tiles');
  if (!/<SignupTiles/.test(APP_FILE(s, 'app/auth/login-select.js'))) bad('the app Register page is a flat list again (not the two-layer tiles)');

  // 7. Learn with Shreya, 6 Nov 2026 (second list).
  if (!/<RichText html=\{chapter\?\.readingContent\}/.test(APP_FILE(s, 'components/student/languagepro/ShreyaChapterScreen.js'))) {
    bad('the reading passage is flattened to one paragraph again');
  }
  if (!/if \(script == null\) script = passageScript\(ch\);/.test(s.speaking)) bad('a dialogue chapter waits for the admin again ("is not ready yet")');
  if (!/if \(script == null\) script = scriptOnFirstOpen\(ch\);/.test(s.speaking)) bad('a prose chapter waits for the admin again ("is not ready yet")');
  if (!/large=\{activeKeys\.length === 1\}/.test(APP_FILE(s, 'components/student/languagepro/speaking/SpeakingPanel.js'))) {
    bad("the line's own character is no longer above the line");
  }
  const tabBar = APP_FILE(s, 'components/shared/home/PortalTabBar.js');
  if (!/key: 'languagePro', label: 'Language Pro'.*route: '\/student\/language-pro'/.test(tabBar)) {
    bad('the student footer has no Language Pro tab');
  }
  // Duplicate keys (6 Nov 2026): a list of optional labels — `[a, b].filter(Boolean)` — keyed by the
  // label itself repeats whenever two labels match (a chapter and its topic of the same name), and
  // React floods the log. Such lists must drop repeats first.
  for (const [file, src] of Object.entries(s.app)) {
    const text = src.replace(/\r\n/g, '\n');
    const re = /\.filter\(Boolean\)\s*\.map\(\(?(\w+)(?:,\s*\w+)?\)?\s*=>\s*\(?\s*<\w+[^>]*?key=\{\1\}/g;
    for (const m of text.matchAll(re)) {
      bad(`${file}:${text.slice(0, m.index).split('\n').length}: a list keyed by its own labels without dropping repeats (key={${m[1]}})`);
    }
  }
  if (/key=\{meta\}/.test(APP_FILE(s, 'components/staff/exams/ExamAnalysisSheet.js'))) bad('Test & Analysis chips are keyed by their text again');
  // My Analytics: no adaptive assessment; Academic IQ keeps it (6 Nov 2026).
  if (/adaptive-performance/.test(APP_FILE(s, 'components/student/AnalyticsScreen.js'))) bad("the student's My Analytics links to the adaptive assessment again");
  if (!/adaptive-performance/.test(APP_FILE(s, 'app/student/_layout.js'))) bad('the adaptive performance screen is gone altogether (Academic IQ still opens it)');
  // Skills Edge: only the chosen skills, and in each only the picked topics (6 Nov 2026).
  if (!/pickedTopicsOnly\(name,/.test(APP_FILE(s, 'components/student/analytics/AnalyticsBody.js'))) bad('My Analytics shows every topic of a chosen skill again');
  if (!/skillsTree: parentApi\.get\('\/api\/skillsedge\/tree'\)/.test(read('shreyartha_mobile_app/services/parent/analyticsService.js'))) {
    bad("the parent's analytics cannot narrow a skill to the picked topics (no Skills Edge tree)");
  }
  // Between Support and Profile (6 Nov 2026).
  const studentTabs = (/export const STUDENT_TABS = \[([\s\S]*?)\];/.exec(tabBar)?.[1] || '');
  const order = [...studentTabs.matchAll(/key: '(\w+)'/g)].map((m) => m[1]).join(',');
  if (order !== 'home,support,languagePro,profile') bad(`the student footer reads ${order}, not Home, Support, Language Pro, Profile`);
  return problems;
}

const MUTATIONS = [
  ['a report kind the website does not draw', (s) => { s.host = s.host.replace('  wellness: lazy(', '  wellnessX: lazy('); }],
  ['a WebReport without a fallback', (s) => {
    const f = 'shreyartha_mobile_app/components/staff/WellnessGroupsScreen.js';
    s.app[f] = s.app[f].replace('fallback={', 'other={');
  }],
  ['the bridge not installed', (s) => { s.index = s.index.replace('installAppBridge();', ''); }],
  ['the route removed', (s) => { s.appJs = s.appJs.replace('path="/app-report/:kind"', 'path="/app-reportX/:kind"'); }],
  ['SecurityConfig permit dropped', (s) => { s.security = s.security.replace('"/app-report/**"', '"/app-reportX/**"'); }],
  ['Payment History back as a quick action', (s) => {
    const f = 'shreyartha_mobile_app/components/parent/ParentMenuScreen.js';
    s.app[f] = s.app[f].replace("key: 'children',", "key: 'history',");
  }],
  ['the parent sign-up requires an email again', (s) => {
    const f = 'shreyartha_mobile_app/app/auth/parent-login.js';
    s.app[f] = s.app[f].replace('if (!fullName || !mobile)', 'if (!fullName || !email || !mobile)');
  }],
  ['the parent sign-up asks for the child again', (s) => {
    const f = 'shreyartha_mobile_app/app/auth/parent-login.js';
    s.app[f] = `${s.app[f]}\nconst x = { studentMobileOrEmail: '' };`;
  }],
  ['Counselling Report dropped from All sections', (s) => { s.menu = s.menu.replace("key: 'counselling-report'", "key: 'gone'"); }],
  ['the website tab renamed back', (s) => { s.webTabs = s.webTabs.replace('Learn with your mother tongue', 'Understand it'); }],
  ['the app speaker removed', (s) => {
    const f = 'shreyartha_mobile_app/components/student/languagepro/speaking/TranslationPanel.js';
    s.app[f] = s.app[f].replace(/readAloud\(/g, 'readAloudX(');
  }],
  ['the hero title back on the parent login', (s) => {
    const f = 'shreyartha_mobile_app/app/auth/parent-login.js';
    s.app[f] = `${s.app[f]}\n<Text style={styles.appName}>Shreyartha</Text>`;
  }],
  ['a website segment dropped', (s) => { s.webSegments = s.webSegments.replace('label: "Industry"', 'label: "Industries"'); }],
  ['the app sign-in back to a flat list', (s) => {
    const f = 'shreyartha_mobile_app/app/auth/sign-in.js';
    s.app[f] = s.app[f].replace('<SignupTiles', '<View');
  }],
  ['the app Register page back to a flat list', (s) => {
    const f = 'shreyartha_mobile_app/app/auth/login-select.js';
    s.app[f] = s.app[f].replace('<SignupTiles', '<View');
  }],
  ['the passage flattened again', (s) => {
    const f = 'shreyartha_mobile_app/components/student/languagepro/ShreyaChapterScreen.js';
    s.app[f] = s.app[f].replace(/<RichText html=\{chapter\?\.readingContent\}/g, '<Text x={chapter?.readingContent}');
  }],
  ['the passage fallback removed', (s) => { s.speaking = s.speaking.replace('if (script == null) script = passageScript(ch);', ''); }],
  ['the prose first-open script removed', (s) => { s.speaking = s.speaking.replace('if (script == null) script = scriptOnFirstOpen(ch);', ''); }],
  ['the parent counselling page dropped from the website', (s) => { s.host = s.host.replace('"parent-counselling": lazy(', '"parent-counsellingX": lazy('); }],
  ['the report card back to native only', (s) => {
    const f = 'shreyartha_mobile_app/app/parent/report-card.js';
    s.app[f] = s.app[f].replace('kind="parent-report-card"', 'kind="nope"');
  }],
  ['a counselling tab without its native fallback', (s) => {
    const f = 'shreyartha_mobile_app/components/parent/CounsellingReportScreen.js';
    s.app[f] = s.app[f].replace('native={<CounselorNotesScreen embedded />}', '');
  }],
  ['a chip list keyed by its labels again', (s) => {
    const f = 'shreyartha_mobile_app/components/staff/exams/QuestionsSheet.js';
    s.app[f] = s.app[f].replace('.filter((v, i, all) => v && all.indexOf(v) === i)', '.filter(Boolean)');
  }],
  ['Test & Analysis chips keyed by text again', (s) => {
    const f = 'shreyartha_mobile_app/components/staff/exams/ExamAnalysisSheet.js';
    s.app[f] = s.app[f].replace('key={`m${j}`}', 'key={meta}');
  }],
  ['My Analytics links to adaptive again', (s) => {
    const f = 'shreyartha_mobile_app/components/student/AnalyticsScreen.js';
    s.app[f] = `${s.app[f]}\nrouter.push('/student/adaptive-performance');`;
  }],
  ['every topic of a chosen skill shown again', (s) => {
    const f = 'shreyartha_mobile_app/components/student/analytics/AnalyticsBody.js';
    s.app[f] = s.app[f].replace('pickedTopicsOnly(name,', 'identity(name,');
  }],
  ['Language Pro moved after Profile', (s) => {
    const f = 'shreyartha_mobile_app/components/shared/home/PortalTabBar.js';
    const lp = /\n  \/\/ Between Support and Profile[^\n]*\n  \{ key: 'languagePro'[^\n]*\n/.exec(s.app[f])[0];
    s.app[f] = s.app[f].replace(lp, '\n').replace(/(\{ key: 'profile'[^\n]*\n)/, `$1${lp.slice(1)}`);
  }],
  ['the Language Pro tab removed', (s) => {
    const f = 'shreyartha_mobile_app/components/shared/home/PortalTabBar.js';
    s.app[f] = s.app[f].replace("key: 'languagePro'", "key: 'lp'");
  }],
];

const base = audit(sources());
for (const p of base) console.log(`  ✗ ${p}`);
let vacuous = 0;
for (const [name, mutate] of MUTATIONS) {
  const s = sources();
  mutate(s);
  if (audit(s).length > base.length) console.log(`  ✓ caught: ${name}`);
  else {
    vacuous += 1;
    console.log(`  ✗ NOT CAUGHT: ${name}`);
  }
}
if (base.length || vacuous) {
  console.log(`\ncheck-webreports FAILED (${base.length} problem(s), ${vacuous} vacuous)`);
  process.exit(1);
}
console.log(`\ncheck-webreports PASSED: ${MUTATIONS.length} mutations all caught.`);
