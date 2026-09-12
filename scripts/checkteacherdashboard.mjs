// The redesigned teacher dashboard, and the reallocation of its sixteen tabs.
//
//   node scripts/checkteacherdashboard.mjs
//
// WHY THIS EXISTS. **Nothing pinned `TEACHER_GROUPS` before this file.** `checkviceprincipal.mjs`'s
// header still references `checkteachergroups.mjs` and `checkshreya01teacher.mjs`; neither exists.
// So the riskiest part of this redesign — splitting sixteen tabs across two destinations and a tab —
// was entirely unguarded, and the failure mode is a tile that quietly loses its only entry point.
// Nothing crashes. `expo export` is green. A teacher just cannot find Payroll any more.
//
// The other half is what the old shared shell did that the new screen must keep doing. THREE
// behaviours lived only in `components/staff/StaffMenuScreen.js` and are absent from
// `app/teacher/_layout.js`:
//
//   1. THE VERIFICATION GATE. `/api/teacher/profile` is the ONLY endpoint on the whole teacher
//      surface admitting `UNVERIFIED_TEACHER`, so a pending teacher loads the identity card fine and
//      then 403s on every destination. Without the redirect they get a working-looking dashboard
//      where nothing opens.
//   2. THE HR PHOTO CACHE. `STAFF_PHOTO_KEY` is what stops one staff member's face appearing under
//      the next one's name on a shared device.
//   3. THE ANDROID BACK OVERRIDE, which exits to the landing tabs with the session alive.
//
// And the data traps the design walks into: an invented `TCH#####` id format, a "single subject"
// that is really a many-row unfiltered list, and a school name off a nullable join.
//
// Exit code 0 = pass.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const ROUTES = path.join(APP, 'app', 'teacher');

const SRC = {
  home: 'components/teacher/TeacherHomeScreen.js',
  workspace: 'components/teacher/TeacherWorkspaceScreen.js',
  attendanceHub: 'components/teacher/TeacherAttendanceHubScreen.js',
  support: 'components/teacher/TeacherSupportScreen.js',
  service: 'services/teacher/dashboardService.js',
  searchService: 'services/teacher/searchService.js',
  layout: 'app/teacher/_layout.js',
  index: 'app/teacher/index.js',
  profileRoute: 'app/teacher/profile.js',
  selfAttendanceRoute: 'app/teacher/self-attendance.js',
  selfAttendance: 'components/staff/SelfAttendanceScreen.js',
  staffMenu: 'components/staff/StaffMenuScreen.js',
  tabBar: 'components/shared/home/PortalTabBar.js',
  keys: 'constants/storageKeys.js',
};

/** The sixteen keys the menu had before the redesign split them. The set is what must not drift. */
const ORIGINAL_KEYS = [
  'attendance', 'resources', 'homework', 'liveClasses', 'syllabus',
  'reports', 'adaptiveAssessment',
  'groups', 'counselling', 'counsellorReport',
  'profile', 'myCalendar', 'upskill',
  'selfAttendance', 'leave', 'payroll',
].sort();

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
 * Leading-boundary form. Load-bearing twice: the naive regex eats `'image/*'`, and a slash-star
 * sequence inside a LINE comment opens a block comment as far as this function is concerned — which
 * on the parent redesign silently ate every line of JSX below such a comment and made the checker
 * report an on-screen component as missing.
 */
const codeOnly = (t) =>
  t.replace(/(^|\s)\/\*[\s\S]*?\*\//g, '$1').replace(/^\s*\/\/.*$/gm, '');

function loadSources(mutate) {
  const out = {};
  for (const [k, rel] of Object.entries(SRC)) {
    out[k] = mutate ? mutate(k, read(path.join(APP, rel))) : read(path.join(APP, rel));
  }
  return out;
}

/** `constants/teacherMenu.js` is import-free, so it evaluates directly. */
async function loadMenu(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmenu-'));
  let src = read(path.join(APP, 'constants', 'teacherMenu.js'));
  if (mutate) src = mutate(src);
  const file = path.join(dir, 'teacherMenu.mjs');
  fs.writeFileSync(file, src);
  return import(`${pathToFileURL(file).href}?t=${Math.random()}`);
}

/** Stage the dashboard service with its transport stubbed, so the derivations can be RUN. */
async function loadService(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tdash-'));
  fs.writeFileSync(
    path.join(dir, 'stub.mjs'),
    'export const staffApi = { get: async () => ({}) };\nexport default staffApi;\n',
  );
  let src = read(path.join(APP, SRC.service));
  if (mutate) src = mutate(src);
  src = src.replace("from '../staffApi'", "from './stub.mjs'");
  const file = path.join(dir, 'dashboardService.mjs');
  fs.writeFileSync(file, src);
  return import(`${pathToFileURL(file).href}?t=${Math.random()}`);
}

/** Every route file that actually exists under app/teacher/. */
function routeNames() {
  return new Set(
    fs
      .readdirSync(ROUTES)
      .filter((f) => f.endsWith('.js') && f !== '_layout.js')
      .map((f) => f.replace(/\.js$/, '')),
  );
}

/** The ten Shreya section routeSuffix values, read rather than retyped. */
async function loadChatData() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tchat-'));
  const file = path.join(dir, 'teacherChatbotData.mjs');
  fs.writeFileSync(file, read(path.join(APP, 'constants', 'teacherChatbotData.js')));
  return import(`${pathToFileURL(file).href}?t=${Math.random()}`);
}

function assertions(menu, svc, chat, src) {
  const out = [];
  const bad = (m) => out.push(m);
  const files = routeNames();

  /* ── 1. THE ITEM SET SURVIVED THE REALLOCATION ───────────────────────────── */

  const keys = menu.TEACHER_MENU.map((i) => i.key).sort();
  if (JSON.stringify(keys) !== JSON.stringify(ORIGINAL_KEYS)) {
    const lost = ORIGINAL_KEYS.filter((k) => !keys.includes(k));
    const gained = keys.filter((k) => !ORIGINAL_KEYS.includes(k));
    bad(
      `the tab set drifted — lost: [${lost.join(', ')}], gained: [${gained.join(', ')}]. ` +
        'Regrouping is a presentation change; losing a tile is a lost feature.',
    );
  }
  // Every item in exactly one place. A tile in two groups is two entry points to one screen and a
  // sign the derivation has been hand-edited.
  const dupes = keys.filter((k, i) => keys[i - 1] === k);
  if (dupes.length) bad(`tabs appear more than once: ${[...new Set(dupes)].join(', ')}`);

  // TEACHER_MENU must stay DERIVED. Hand-maintaining it is how the flat and grouped views drift.
  const menuSrc = codeOnly(read(path.join(APP, 'constants', 'teacherMenu.js')));
  if (!/TEACHER_MENU = \[\s*\.\.\./.test(menuSrc)) {
    bad('TEACHER_MENU is no longer derived by spreading the groups — the flat and grouped views can now drift');
  }

  // Every native route resolves to a real file.
  [...menu.TEACHER_MENU, ...menu.TEACHER_HEADER_ACTIONS].forEach((item) => {
    if (!item.native) return;
    const name = item.native.replace('/teacher/', '').split('?')[0];
    if (!files.has(name)) bad(`${item.key} points at /teacher/${name}, which has no route file`);
  });

  /* ── 2. EVERY DESTINATION IS STILL REACHABLE ─────────────────────────────── */

  const home = codeOnly(src.home);
  const workspace = codeOnly(src.workspace);
  const hub = codeOnly(src.attendanceHub);
  const tabBar = codeOnly(src.tabBar);

  if (!/TEACHER_WORKSPACE_GROUPS/.test(workspace)) {
    bad('My Workspace does not read TEACHER_WORKSPACE_GROUPS — its twelve tiles are hardcoded or gone');
  }
  if (!/TEACHER_ATTENDANCE_ITEMS/.test(hub)) {
    bad('My Attendance does not read TEACHER_ATTENDANCE_ITEMS — its three rows are hardcoded or gone');
  }
  // The three heroes and the profile tab are the only ways in. Each must be wired.
  for (const [route, what] of [
    ['/teacher/workspace', 'My Workspace'],
    ['/teacher/my-attendance', 'My Attendance'],
    ['/teacher/student-analytics', 'My Students Analytics'],
  ]) {
    if (!home.includes(route)) bad(`the dashboard has no card opening ${what} (${route})`);
  }
  if (!/route: '\/teacher\/profile'/.test(tabBar)) {
    bad('the footer has no Profile tab — My Profile left the grid and would have no entry point at all');
  }
  if (!/route: '\/teacher\/support'/.test(tabBar)) bad('the footer has no Support tab');

  // ── ATTENDANCE REPLACED THE CENTRE (+) BUTTON ─────────────────────────────
  //
  // Self-attendance used to hang off a floating (+). It is the second of four tabs now, so the FAB
  // is gone: two controls to one screen is worse than either alone.
  //
  // THE RULE THE OLD FAB ASSERTIONS WERE REALLY PROTECTING, restated where it now lives rather than
  // deleted with them. The old one read "a FAB route must NOT also be a tab", and it existed because
  // `isTabRoot` decides whether the bar renders and EVERY screen it says yes to must pad by
  // TAB_BAR_HEIGHT or its last control sits underneath. Self-attendance is exactly such a screen
  // now, so the padding itself is what gets asserted.
  const layoutSrc = codeOnly(src.layout);
  if (/TEACHER_FAB/.test(tabBar) || /fab=\{/.test(layoutSrc)) {
    bad('the teacher footer has a centre button again — Attendance is a tab now, not a FAB');
  }
  const teacherTabsBlock = (/TEACHER_TABS = \[([\s\S]*?)\];/.exec(tabBar) || [])[1] || '';
  const tabRoutes = [...teacherTabsBlock.matchAll(/route: '([^']+)'/g)].map((m) => m[1]);
  if (tabRoutes.length !== 4) {
    bad(`TEACHER_TABS has ${tabRoutes.length} tabs, expected 4 (home, attendance, profile, support)`);
  }
  if (!/route: '\/teacher\/self-attendance'/.test(teacherTabsBlock)) {
    bad('the footer has no Attendance tab — self-attendance lost its one-tap entry');
  }
  for (const r of tabRoutes) {
    // '/teacher' is index.js; every other tab is its own leaf file.
    const leaf = r === '/teacher' ? 'index' : r.split('/').pop();
    if (!routeNames().has(leaf)) {
      bad(`the teacher tab ${r} has no route file — it would render an Unmatched page`);
    }
  }
  // THE PADDING, which is the whole reason self-attendance was kept off the tab list before.
  // `SelfAttendanceScreen` is shared with the five app/staff/[role] shells, which reach it from a
  // menu with no bar over it — so the inset is passed by the TEACHER ROUTE and defaults to 0
  // everywhere else. Hardcoding it inside the shared screen would pad five panels that have nothing
  // to clear.
  const selfAttRoute = codeOnly(src.selfAttendanceRoute);
  if (!/bottomInset=\{TAB_BAR_HEIGHT/.test(selfAttRoute)) {
    bad('app/teacher/self-attendance.js passes no bottomInset — the footer would cover its last control');
  }
  if (!/bottomInset = 0/.test(codeOnly(src.selfAttendance))) {
    bad('SelfAttendanceScreen has no bottomInset default of 0 — the five menu-reached shells would pad for a bar they do not show');
  }
  // THE CENTRING. Kept here even though the teacher no longer has a FAB: sales, counselor and
  // shreyartha_councellor still do, and these are the ONLY assertions anywhere that guard the shared
  // bar's geometry. A spliced equal-flex slot only lands at 50% when the tab count is EVEN, so two
  // flexed halves either side of a FIXED-width centre slot is what centres it for any count.
  // They belong in checkstaffdashboard; they are here because that is where they were written.
  if (/const half = fab \? Math\.ceil/.test(tabBar)) {
    bad('the FAB is spliced into the row again — it lands off centre for an odd tab count');
  }
  if (!/fabSlot: \{ width: \d+/.test(tabBar)) {
    bad('the FAB slot flexes — whichever half holds more tabs would pull it off centre');
  }
  if (!/half: \{ flex: 1/.test(tabBar)) {
    bad('the tab halves do not flex equally — the centre button would not be centred');
  }

  // Mark Attendance is a STUDENT task and stays in Workspace; the hub is the teacher's own record.
  const workspaceKeys = menu.TEACHER_WORKSPACE_GROUPS.flatMap((g) => g.items).map((i) => i.key);
  if (!workspaceKeys.includes('attendance')) {
    bad('Mark Attendance left My Workspace — it is a daily classroom task about STUDENTS, not the teacher\'s own record');
  }
  const hubKeys = menu.TEACHER_ATTENDANCE_ITEMS.map((i) => i.key);
  for (const key of ['selfAttendance', 'leave', 'payroll']) {
    if (!hubKeys.includes(key)) bad(`${key} is not under My Attendance`);
  }
  if (hubKeys.includes('attendance')) {
    bad('Mark Attendance was put in My Attendance — that screen marks STUDENTS, one path segment from the teacher\'s own');
  }

  /* ── 3. THE THREE RESCUED BEHAVIOURS ─────────────────────────────────────── */

  if (!/<Redirect\b[^>]*pending-verification/.test(home)) {
    bad('THE GATE IS GONE — /api/teacher/profile admits UNVERIFIED_TEACHER, so a pending teacher would get a dashboard where every destination 403s');
  }
  if (!/verified === null/.test(home)) {
    bad('the home has no "unknown" verification state — the dashboard flashes before the gate resolves');
  }
  if (!/STAFF_PHOTO_KEY/.test(home)) {
    bad('the HR photo is no longer cached — and STAFF_PHOTO_KEY is what stops one staff face appearing under the next name');
  }
  if (!/hardwareBackPress/.test(home)) {
    bad('the Android back override is gone — back from the home screen would leave the panel instead of the app');
  }
  // And the key must still be cleared on logout, or caching it is the leak rather than the fix.
  if (!/STAFF_PHOTO_KEY,/.test(codeOnly(src.keys))) {
    bad('STAFF_PHOTO_KEY is missing from ALL_AUTH_KEYS');
  }
  if (!/TEACHER_SEARCH_INDEX_KEY/.test(codeOnly(src.keys))) {
    bad('the teacher search cache key is not in storageKeys — it would survive a logout');
  }

  /* ── 4. THE IDENTITY ROWS, EVALUATED ─────────────────────────────────────── */

  // DISTINCT: one subject across four sections is four rows in assignedClasses.
  const many = {
    assignedClasses: [
      { subjectName: 'Mathematics', academicYearId: 2 },
      { subjectName: 'Mathematics', academicYearId: 2 },
      { subjectName: 'Physics', academicYearId: 2 },
      { subjectName: 'Chemistry', academicYearId: 1 }, // LAST year
    ],
  };
  if (svc.subjectsTaught(many, 2) !== 'Mathematics, Physics') {
    bad(`subjectsTaught = "${svc.subjectsTaught(many, 2)}" — expected distinct, current-year subjects only`);
  }
  // The year filter matters: TeacherService applies NO academic-year predicate server-side.
  if (svc.subjectsTaught(many, 2).includes('Chemistry')) {
    bad('last year\'s subject leaked in — assignedClasses is not year-filtered by the server');
  }
  // Unknown year: show them all rather than none.
  if (!svc.subjectsTaught(many, null).includes('Chemistry')) {
    bad('with no known year the subjects are dropped — showing last year\'s beats showing none');
  }
  if (svc.subjectsTaught(null, 2) !== '') bad('subjectsTaught invents a subject from nothing');

  // Teacher ID: real values are SHREYA01-EMP-0007, and null is a real state.
  if (svc.teacherIdOf({}) !== null) bad('teacherIdOf invents an employee code');
  if (svc.teacherIdOf({ employeeCode: '  ' }) !== null) bad('a whitespace code counts as assigned');
  if (svc.teacherIdOf({ employeeCode: ' SHREYA01-EMP-0007 ' }) !== 'SHREYA01-EMP-0007') {
    bad('teacherIdOf does not trim');
  }
  const service = codeOnly(src.service);
  if (/TCH\d/.test(service) || /TCH\d/.test(home)) {
    bad('a TCH##### id format appeared — nothing in the backend generates one; codes read SHREYA01-EMP-0007');
  }

  // School: schoolName comes off a NULLABLE join; schoolCode is nullable=false.
  if (svc.schoolLabel({ schoolName: 'ABC Public School' }) !== 'ABC Public School') {
    bad('schoolLabel does not prefer the school name');
  }
  if (svc.schoolLabel({ schoolCode: 'SHREYA01' }) !== 'SHREYA01') {
    bad('schoolLabel does not fall back to the code — schoolName is null for an unlinked user');
  }
  if (svc.schoolLabel(null, 'STORED01') !== 'STORED01') {
    bad('schoolLabel ignores the code cached at login');
  }

  // Photo: HR only. TeacherProfileResponse's schoolLogo is the SCHOOL's crest, not the person.
  if (svc.photoOf({ profilePictureUrl: 'https://x/y.png' }) !== 'https://x/y.png') {
    bad('photoOf does not read the HR profile picture');
  }
  if (svc.photoOf({}) !== null) bad('photoOf invents a photo');

  // RETARGETED. This used to ban the STRING `schoolLogo` from the service and the home screen
  // outright, as a proxy for "nobody is using the crest as a face". That proxy stopped being
  // correct when the crest became the left-hand mark in the header — the field is now read on
  // purpose, by `schoolLogoOf`, on every school-bound panel.
  //
  // So assert the property itself, by CALLING photoOf rather than grepping around it. The mutation
  // this guards against — `hr?.profilePictureUrl || hr?.schoolLogo` — is still caught, and now the
  // assertion says what it means.
  if (svc.photoOf({ schoolLogo: 'https://x/crest.png' }) !== null) {
    bad("photoOf reads schoolLogo — that is the SCHOOL's crest, not the person");
  }
  if (svc.photoOf({ profilePictureUrl: 'https://x/y.png', schoolLogo: 'https://x/crest.png' })
      !== 'https://x/y.png') {
    bad("photoOf prefers the school crest over the person's own photo");
  }
  // And the accessor that legitimately reads it stays honest in both directions.
  if (svc.schoolLogoOf({ schoolLogo: 'https://x/crest.png' }) !== 'https://x/crest.png') {
    bad('schoolLogoOf does not read schoolLogo — the header would show no school crest');
  }
  if (svc.schoolLogoOf({}) !== null || svc.schoolLogoOf({ schoolLogo: '   ' }) !== null) {
    bad('schoolLogoOf invents a crest — a school with no logo must fall back to the 3C Edge mark');
  }

  // Both profile reads must be settled: they have different role sets.
  if (/Promise\.all\(/.test(service)) {
    bad('the two profile reads use Promise.all — they have different role sets, so a pending teacher loses both');
  }
  if (!/Promise\.allSettled\(/.test(service)) bad('the identity fan-out is not settled');

  /* ── 5. NOTHING FABRICATED ON THE CARDS ──────────────────────────────────── */

  // Two unreconciled attendance systems; upskill progress is explicitly not tracked per teacher.
  if (/attendancePercent|attendanceRate|%.*[Aa]ttendance/.test(home)) {
    bad('an attendance percentage is rendered — there are TWO unreconciled attendance systems and it would be wrong against one');
  }
  if (/lesson ?plan/i.test(home)) {
    bad('the card promises lesson plans — TeacherResource.resourceType is exactly HOMEWORK | RESOURCE');
  }

  /* ── 6. THE SHARED SHELL IS UNTOUCHED ────────────────────────────────────── */

  // Five other roles still render through it. These are the things they depend on.
  const staffMenu = codeOnly(src.staffMenu);
  if (!/<WelcomeHeader/.test(staffMenu)) {
    bad('StaffMenuScreen no longer renders WelcomeHeader — Principal and Shreyartha Admin lost their identity block');
  }
  if (!/verified === false/.test(staffMenu)) {
    bad('StaffMenuScreen lost its verification gate — Principal and Shreyartha Admin rely on it');
  }
  if (!/fetchHrProfile/.test(staffMenu)) {
    bad('StaffMenuScreen no longer fetches the HR photo — Principal and Shreyartha Admin lost their avatar');
  }
  // And the teacher must no longer be one of its callers.
  if (/StaffMenuScreen/.test(codeOnly(src.index))) {
    bad('app/teacher/index.js still renders StaffMenuScreen — the redesign did not take effect');
  }

  /* ── 7. THE CHATBOT'S ROUTES STILL RESOLVE ───────────────────────────────── */

  // Ten routeSuffix values, prefixed with basePath, with no mapping table. Renaming any existing
  // app/teacher/* route silently breaks a chatbot tile.
  (chat.TEACHER_SECTIONS || []).forEach((section) => {
    const suffix = section.routeSuffix;
    if (suffix === '' || suffix == null) return; // portal-guide lands on the home screen
    const name = String(suffix).replace('/', '');
    if (!files.has(name)) {
      bad(`the Shreya section "${section.sectionKey}" points at /teacher/${name}, which has no route file`);
    }
  });

  /* ── 8. THE FOOTER'S THREE ROOTS PAD FOR IT ──────────────────────────────── */

  if (!/isTabRoot\(pathname, TEACHER_TABS\)/.test(codeOnly(src.layout))) {
    bad('the layout renders the footer unconditionally, or with the wrong tab list');
  }
  for (const [key, label] of [
    ['home', 'the dashboard'],
    ['support', 'the support screen'],
    ['profileRoute', 'the profile route'],
  ]) {
    if (!/TAB_BAR_HEIGHT/.test(codeOnly(src[key]))) {
      bad(`${label} does not pad for the footer — its last control sits under the bar`);
    }
  }
  // The shared profile screen must take the padding as a PROP; five footerless shells use it too.
  if (!/bottomInset/.test(codeOnly(src.profileRoute))) {
    bad('the teacher profile route does not pass bottomInset — either it has no padding or StaffProfileScreen hardcoded it for everyone');
  }

  /* ── 9. SEARCH IS PER TEACHER AND READS THE MENU ─────────────────────────── */

  const search = codeOnly(src.searchService);
  if (!/fingerprint/.test(search)) bad('the teacher search cache is not keyed to the session');
  if (!/TEACHER_MENU/.test(search)) {
    bad('the search destinations are retyped rather than read from TEACHER_MENU — they would drift from the menu');
  }


  // ── THE SCHOOL CREST, AND THE PASSWORD ROW THAT REPLACED THE HEADER CHIP ──
  // The teacher is school-bound, so its header leads with the school. And its support screen had
  // NO password row at all before the header chip was removed, which would have left the whole
  // teacher panel with no way to change a password.
  const homeSrc = codeOnly(src.home);
  const supportSrc = codeOnly(src.support);
  if (!/schoolLogoUrl=\{schoolLogo\}/.test(homeSrc)) {
    bad('TeacherHomeScreen does not pass its school crest to the brand bar');
  }
  if (/changePasswordRoute/.test(homeSrc)) {
    bad('TeacherHomeScreen still passes changePasswordRoute — BrandBar no longer accepts it');
  }
  if (!/<ChangePasswordRow route="\/teacher\/change-password" \/>/.test(supportSrc)) {
    bad('TeacherSupportScreen has no Change Password row — the teacher panel is stranded');
  }
  return out;
}

const MUTATIONS = [
  {
    name: 'THE LOSS: a tab dropped during the reallocation',
    menu: (s) => s.replace(/\{ key: 'payroll',[\s\S]*?\},\n/, ''),
  },
  {
    name: 'a tab landing in both destinations',
    menu: (s) =>
      s.replace(
        "export const TEACHER_ATTENDANCE_ITEMS = [",
        "export const TEACHER_ATTENDANCE_ITEMS = [\n  { key: 'upskill', label: 'Upskill Your Self', icon: 'school-outline', native: '/teacher/upskill' },",
      ),
  },
  {
    name: 'TEACHER_MENU hand-maintained instead of derived',
    menu: (s) =>
      s.replace(
        /export const TEACHER_MENU = \[[\s\S]*?\];/,
        "export const TEACHER_MENU = TEACHER_WORKSPACE_GROUPS.flatMap((g) => g.items);",
      ),
  },
  {
    name: 'Mark Attendance moved into My Attendance (it marks STUDENTS)',
    menu: (s) =>
      s.replace(
        "export const TEACHER_ATTENDANCE_ITEMS = [",
        "export const TEACHER_ATTENDANCE_ITEMS = [\n  { key: 'attendance', label: 'Mark Attendance', icon: 'checkbox-outline', native: '/teacher/attendance' },",
      ),
  },
  {
    name: 'THE GATE: the pending-verification redirect deleted',
    src: (k, s) =>
      k === 'home'
        ? s.replace('if (verified === false) return <Redirect href="/teacher/pending-verification" />;', '')
        : s,
  },
  {
    name: 'the HR photo cache dropped (one staff face under the next name)',
    src: (k, s) => (k === 'home' ? s.replaceAll('STAFF_PHOTO_KEY', 'UNUSED_KEY') : s),
  },
  {
    name: 'the Android back override dropped',
    src: (k, s) => (k === 'home' ? s.replace('hardwareBackPress', 'somethingElse') : s),
  },
  {
    name: 'THE REPEAT: subjects rendered without deduping',
    svc: (s) => s.replace('if (!name || seen.has(name)) return;', 'if (!name) return;'),
  },
  {
    name: "THE STALE SUBJECT: last year's assignments no longer filtered out",
    svc: (s) => s.replace('? rows.filter((row) => row?.academicYearId === academicYearId)', '? rows'),
  },
  {
    name: 'an employee code invented for a teacher who has none',
    svc: (s) =>
      s.replace(
        "  return typeof code === 'string' && code.trim() ? code.trim() : null;",
        '  return code || "TCH10245";',
      ),
  },
  {
    name: 'the school code fallback dropped (an unlinked user shows nothing)',
    svc: (s) => s.replace("  return String(profile?.schoolCode || storedCode || '').trim();", "  return '';"),
  },
  {
    name: "the school's crest used as the teacher's photo",
    svc: (s) => s.replace('  const url = hr?.profilePictureUrl;', '  const url = hr?.profilePictureUrl || hr?.schoolLogo;'),
  },
  {
    name: 'the two profile reads made all-or-nothing',
    svc: (s) => s.replace('Promise.allSettled([', 'Promise.all(['),
  },
  {
    name: 'an attendance percentage invented on the card',
    src: (k, s) => (k === 'home' ? s.replace('attendanceBody:', 'attendancePercent: 92,\n  attendanceBody:') : s),
  },
  {
    name: 'the card promising lesson plans again',
    src: (k, s) =>
      k === 'home' ? s.replace('workspaceBody: \'Teaching resources, homework, assessments and more.\'', "workspaceBody: 'Teaching resources, lesson plans, assessments and more.'") : s,
  },
  {
    name: 'THE BLAST RADIUS: StaffMenuScreen loses its verification gate',
    src: (k, s) => (k === 'staffMenu' ? s.replace('verified === false', 'verified === undefined') : s),
  },
  {
    name: 'StaffMenuScreen loses the HR photo Principal and Shreyartha Admin show',
    src: (k, s) => (k === 'staffMenu' ? s.replaceAll('fetchHrProfile', 'noPhoto') : s),
  },
  {
    name: 'the teacher home reverted to the shared shell',
    src: (k, s) => (k === 'index' ? s.replace('TeacherHomeScreen', 'StaffMenuScreen') : s),
  },
  {
    name: 'a hero card losing its destination',
    src: (k, s) => (k === 'home' ? s.replace("'/teacher/my-attendance'", "'/teacher/nowhere'") : s),
  },
  {
    name: 'the Profile tab dropped (My Profile loses its only entry point)',
    src: (k, s) => (k === 'tabBar' ? s.replace("route: '/teacher/profile'", "route: '/teacher/gone'") : s),
  },
  {
    name: 'a tab root no longer clearing the footer',
    src: (k, s) => (k === 'support' ? s.replaceAll('TAB_BAR_HEIGHT', 'ZERO') : s),
  },
  {
    name: 'StaffProfileScreen made to hardcode the teacher padding for all six shells',
    src: (k, s) => (k === 'profileRoute' ? s.replace('bottomInset={', 'unusedProp={') : s),
  },
  {
    name: 'the search destinations retyped instead of read from the menu',
    src: (k, s) => (k === 'searchService' ? s.replaceAll('TEACHER_MENU', 'HARDCODED') : s),
  },
  {
    name: 'the teacher home stops passing its school crest',
    src: (k, s) => (k === 'home'
      ? s.replace('schoolLogoUrl={schoolLogo}', 'schoolLogoUrl={null}') : s),
  },
  {
    name: 'the teacher loses its only Change Password row',
    src: (k, s) => (k === 'support'
      ? s.replace('<ChangePasswordRow route="/teacher/change-password" />', '') : s),
  },
  {
    // The centre button returns alongside the Attendance tab — two controls to one screen.
    name: 'the centre (+) button comes back',
    src: (k, s) => (k === 'layout'
      ? s.replace('tabs={TEACHER_TABS} tone="light"', 'tabs={TEACHER_TABS} tone="light" fab={SOMETHING}')
      : s),
  },
  {
    // A tab pointing at a route with no wrapper file — an expo-router Unmatched page.
    name: 'a teacher tab opens a route with no file',
    src: (k, s) => (k === 'tabBar'
      ? s.replace("route: '/teacher/self-attendance' }", "route: '/teacher/mark-attendance' }")
      : s),
  },
  {
    // THE REGRESSION THE OLD FAB RULES EXISTED TO PREVENT, now reachable directly: self-attendance
    // is a tab root, so the bar renders over it. Drop its inset and the last control is underneath.
    name: 'the self-attendance tab stops padding for the footer',
    src: (k, s) => (k === 'selfAttendanceRoute'
      ? s.replace('bottomInset={TAB_BAR_HEIGHT + (insets.bottom || 8)}', '')
      : s),
  },
  {
    // Hardcoding the teacher's inset inside the SHARED screen pads five panels that show no bar.
    name: 'the shared screen loses its bottomInset default',
    src: (k, s) => (k === 'selfAttendance'
      ? s.replace("bottomInset = 0", "bottomInset = 120")
      : s),
  },
  {
    // Back to the spliced slot: with three teacher tabs the button lands at 62.5%, not centre.
    name: 'the FAB is spliced into the row again',
    src: (k, s) => (k === 'tabBar'
      ? s.replace('const splitAt = Math.ceil(tabs.length / 2);',
                  'const half = fab ? Math.ceil(tabs.length / 2) : tabs.length;')
      : s),
  },
  {
    // A flexing centre slot is pulled off 50% by whichever half holds more tabs.
    name: 'the FAB slot flexes instead of holding a fixed width',
    src: (k, s) => (k === 'tabBar'
      ? s.replace('fabSlot: { width: 72,', 'fabSlot: { flex: 1,')
      : s),
  },
];

console.log('Self-tests (each mutation must be caught):');
for (const m of MUTATIONS) {
  let caught;
  try {
    const [menu, svc, chat] = await Promise.all([loadMenu(m.menu), loadService(m.svc), loadChatData()]);
    // A `svc:` mutation is applied to the SERVICE SOURCE too — several assertions here are greps
    // over that same file, and mutating only the staged module leaves them reading the pristine one
    // and passing while testing nothing. This has gone wrong three times across these checkers.
    const mutateSources = (k, s) => {
      let text = m.src ? m.src(k, s) : s;
      if (k === 'service' && m.svc) text = m.svc(text);
      return text;
    };
    caught = assertions(menu, svc, chat, loadSources(mutateSources)).length > 0;
  } catch {
    caught = true; // a mutation that will not even load is caught, loudly
  }
  if (caught) ok(m.name);
  else fail(`NOT CAUGHT: ${m.name} — the corresponding assertion is vacuous`);
}

console.log('\nTeacher dashboard:');
{
  const [menu, svc, chat] = await Promise.all([loadMenu(), loadService(), loadChatData()]);
  const problems = assertions(menu, svc, chat, loadSources());
  if (problems.length === 0) {
    ok(`all ${ORIGINAL_KEYS.length} tabs survived the reallocation, each in exactly one place`);
    ok('every destination is reachable, and Mark Attendance stayed with the students');
    ok('the gate, the HR photo cache and the Android back override all came across');
    ok('subjects are distinct and year-filtered; no invented id, no crest-as-photo');
    ok('no attendance percentage and no lesson plans — neither has backing data');
    ok('StaffMenuScreen is untouched for the other five roles');
    ok("the Shreya sections' ten routes still resolve");
    ok('the footer gates on its own tab list and all three roots pad for it');
  } else problems.forEach(fail);
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL — ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
