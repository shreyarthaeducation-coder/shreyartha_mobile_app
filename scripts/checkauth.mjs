// Every login clears the previous session before writing its own.
//
//   node scripts/checkauth.mjs
//
// WHY. `AuthContext.logout()` and `apiService.clearAuthAndRedirect()` are the ONLY two things that
// clear auth storage, and they fire on an explicit log out or a 401. A session ended any other way —
// force-closing the app, swapping users from the landing screen — was never cleared, and every login
// wrote its keys straight on top of it.
//
// That is not merely untidy. Each panel's route guard admits on the PRESENCE of its own token:
//
//     app/student/_layout.js   → studentToken | userToken | accessToken | token
//     app/teacher/_layout.js   → schoolUserToken
//
// so a leftover `schoolUserToken` opens the previous teacher's panel with no password, and their
// name, email, school code and cached photo URL stay readable in storage under the new user's
// session. On a staffroom tablet or a family phone that is the whole leak. It is the same shape as
// the `STAFF_PHOTO_KEY` and `partnerUserType` leaks, both already fixed in constants/storageKeys.js.
//
// ── THE ORDERING IS PART OF THE ASSERTION ───────────────────────────────────
// The clear must come AFTER the token is in hand and BEFORE the write. Clearing on submit would log
// a user out of a working session because they mistyped a password; clearing after the write would
// erase the session that was just created.
//
// Exit code 0 = pass.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');

/**
 * Where each role's session is written.
 *
 * School is the odd one out: its login delegates to `storeSchoolSession()`, so that service is the
 * seam, not the screen. Checking the screen instead would report a false failure forever.
 */
const SEAMS = [
  { role: 'student', file: 'app/auth/student-login.js', writes: "'studentToken'" },
  { role: 'parent', file: 'app/auth/parent-login.js', writes: "'parentUserToken'" },
  { role: 'partner', file: 'app/auth/partner-login.js', writes: "'partnerUserToken'" },
  { role: 'school', file: 'services/schoolSession.js', writes: "'schoolUserToken'" },
];

const read = (p) => fs.readFileSync(path.join(APP, p), 'utf8').replace(/\r\n/g, '\n');

/**
 * Source with comments removed, for assertions that must not be satisfied — or tripped — by prose.
 *
 * Block comments are stripped BEFORE line comments, deliberately. Doing it the other way lets a
 * `//` line that happens to contain a slash-star open a block comment that swallows everything after
 * it; that has eaten a whole JSX tree in this repo twice and silently blanked two checkers.
 */
const codeOnly = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

let failures = 0;
const fail = (m) => {
  failures += 1;
  console.error(`  ✗ ${m}`);
};

/**
 * Assert one seam. Returns a list of human-readable problems so the same function can be run
 * against a deliberately broken copy in the self-test.
 */
function audit(src, seam) {
  const problems = [];

  const clear = src.indexOf('multiRemove(ALL_AUTH_KEYS)');
  const write = src.indexOf(seam.writes);

  if (!/import\s*\{[^}]*\bALL_AUTH_KEYS\b[^}]*\}\s*from/.test(src)) {
    problems.push('ALL_AUTH_KEYS is not imported');
  }
  if (clear < 0) {
    problems.push('never calls multiRemove(ALL_AUTH_KEYS) — the previous session survives this login');
  }
  if (write < 0) {
    problems.push(`does not write ${seam.writes} — this seam has moved, retarget the checker`);
  }
  if (clear >= 0 && write >= 0 && clear > write) {
    problems.push('clears AFTER writing the session — that erases the login it just performed');
  }

  // The clear must sit downstream of the token check, not at the top of the handler. Every seam
  // guards on a falsy token first; the clear belongs below that guard.
  const guard = Math.max(src.indexOf('if (!token)'), src.indexOf('!res.data?.token'));
  if (clear >= 0 && guard >= 0 && clear < guard) {
    problems.push('clears BEFORE the credentials are known good — a typo would end a working session');
  }

  return problems;
}

/* ── Self-test: three planted breaks, each must be caught ────────────────── */
console.log('Self-test (each planted break must be caught):');
{
  const src = read('app/auth/student-login.js');
  const seam = SEAMS[0];

  if (audit(src, seam).length) {
    fail('the pristine student login does not pass — fix the code or the checker before trusting it');
  }

  const mutations = [
    {
      name: 'the clear is deleted',
      apply: (s) => s.replace('await AsyncStorage.multiRemove(ALL_AUTH_KEYS);\n', ''),
    },
    {
      name: 'the clear is moved after the write',
      apply: (s) =>
        s
          .replace('await AsyncStorage.multiRemove(ALL_AUTH_KEYS);\n', '')
          .replace("router.replace('/student/');", "await AsyncStorage.multiRemove(ALL_AUTH_KEYS);\n      router.replace('/student/');"),
    },
    {
      name: 'the import is dropped',
      apply: (s) => s.replace("import { ALL_AUTH_KEYS } from '../../constants/storageKeys';\n", ''),
    },
  ];

  for (const m of mutations) {
    const broken = m.apply(src);
    if (broken === src) {
      fail(`could not plant "${m.name}" — that mutation is inert and proves nothing`);
    } else if (!audit(broken, seam).length) {
      fail(`"${m.name}" slipped past — the assertion is vacuous`);
    } else {
      console.log(`  ✓ caught: ${m.name}`);
    }
  }
}

/* ── The teacher verification gate ───────────────────────────────────────── */
//
// `app/teacher/_layout.js` read `verified` into state and never redirected on it, so the only gate
// was inside TeacherHomeScreen — covering `/teacher` and none of the other twenty-four routes in the
// group. `/api/teacher/profile` is the ONLY endpoint on the teacher surface that admits
// UNVERIFIED_TEACHER, so a pending teacher who reached any other route got a full screen whose every
// call 403s. Both gates are asserted: the layout's covers the group, the screen's covers the live
// flag (the stored one is only written at login).
function auditGate(layout, home) {
  const problems = [];
  const redirect = layout.indexOf('href="/teacher/pending-verification"');
  if (redirect < 0) {
    problems.push('layout: no redirect to /teacher/pending-verification — 24 routes are ungated');
  } else if (!/!state\.verified/.test(layout)) {
    problems.push('layout: the redirect does not test state.verified');
  } else if (!/pathname !== '\/teacher\/pending-verification'/.test(layout)) {
    // The pending screen lives inside this group; without the exemption it redirects to itself.
    problems.push('layout: the pending screen is not exempted — the redirect loops on itself');
  }

  if (!/<Redirect href="\/teacher\/pending-verification"/.test(home)) {
    problems.push('home: the live-flag gate is gone');
  }
  if (!/setItem\('schoolUserVerified'/.test(home)) {
    problems.push(
      'home: the live verified flag is no longer written back, so a revoked teacher keeps a stale true',
    );
  }
  return problems;
}

console.log('\nTeacher verification gate — self-test:');
{
  const layout = read('app/teacher/_layout.js');
  const home = read('components/teacher/TeacherHomeScreen.js');

  const gateMutations = [
    {
      name: 'the layout redirect is deleted (back to 24 ungated routes)',
      apply: () => [layout.replace(/if \(!state\.verified[\s\S]*?\n  \}\n/, ''), home],
    },
    {
      name: 'the layout gate stops testing state.verified',
      apply: () => [layout.replace('!state.verified &&', 'false &&'), home],
    },
    {
      name: 'the pending screen loses its exemption (redirect loops)',
      apply: () => [
        layout.replace(" && pathname !== '/teacher/pending-verification'", ''),
        home,
      ],
    },
    {
      name: 'the home screen stops persisting the live flag',
      apply: () => [layout, home.replace("setItem('schoolUserVerified'", "setItem('somethingElse'")],
    },
  ];

  for (const m of gateMutations) {
    const [l, h] = m.apply();
    if (l === layout && h === home) {
      fail(`could not plant "${m.name}" — that mutation is inert and proves nothing`);
    } else if (!auditGate(l, h).length) {
      fail(`"${m.name}" slipped past — the assertion is vacuous`);
    } else {
      console.log(`  ✓ caught: ${m.name}`);
    }
  }

  const problems = auditGate(layout, home);
  if (problems.length) problems.forEach((p) => fail(p));
  else console.log('  ✓ layout gates the whole group; home gates on the live flag and persists it');
}

/* ── The parent verification gate ────────────────────────────────────────── */
//
// Two things go wrong here and neither is visible at a glance.
//
// 1. `LinkedStudentResponse.parentVerified` is NOT a live flag. `ParentDashboardService` hardcodes
//    `setParentVerified(true)` — the only occurrence in the backend — and throws SecurityException →
//    403 before reaching it when the account is unverified. So the field can only ever say `true`,
//    and the real signal is the STATUS CODE. Anything that reads the field to decide verification is
//    deciding nothing.
// 2. Persisting must distinguish a 403 from a network failure. Writing 'false' on any thrown error
//    would lock a verified parent out over a dropped connection.
function auditParentGate(layout, menu, login) {
  const problems = [];

  // Asserted on the GATE itself. The bare `state.verified` this used to look for now also appears in
  // the push-registration effect (which only registers a verified session), so deleting the real
  // gate slipped past — the "layout gate is deleted" mutation went vacuous.
  if (!/if \(!state\.verified && !UNVERIFIED_OK\.has\(pathname\)\)/.test(layout)) {
    problems.push('layout: no verification gate — twelve routes are ungated');
  } else {
    // The dashboard is what refreshes the flag; gating it strands a mid-session verification.
    for (const route of ['/parent', '/parent/pending-verification', '/parent/change-password']) {
      if (!layout.includes(`'${route}'`)) {
        problems.push(`layout: ${route} is not exempt — ${
          route === '/parent/pending-verification'
            ? 'the redirect loops on itself'
            : route === '/parent'
              ? 'the only screen that can refresh the flag is unreachable'
              : 'the pending screen\'s own button dead-ends'
        }`);
      }
    }
  }

  if (/parentVerified != null/.test(menu)) {
    problems.push('menu: still branches on child.parentVerified, which the backend hardcodes to true');
  }
  if (!/isForbidden/.test(menu)) {
    problems.push('menu: does not distinguish a 403 from a network failure before persisting');
  }
  if (!/setItem\('parentUserVerified'/.test(menu)) {
    problems.push('menu: never writes the flag back, so the layout gate reads a login-time value');
  }
  // Comments are stripped first. The fix for this very line carries a comment QUOTING the old
  // expression so the next reader knows what was wrong, and a raw grep matched that and reported the
  // fixed file as broken. An assertion that a comment can trip is an assertion about prose.
  if (/verified === false \? 'false' : 'true'/.test(codeOnly(login))) {
    problems.push('login: fail-OPEN default — anything not literally false is stored as verified');
  }
  return problems;
}

console.log('\nParent verification gate — self-test:');
{
  const layout = read('app/parent/_layout.js');
  const menu = read('components/parent/ParentMenuScreen.js');
  const login = read('app/auth/parent-login.js');

  const muts = [
    {
      name: 'the layout gate is deleted',
      apply: () => [layout.replace(/if \(!state\.verified[\s\S]*?\n  \}\n/, ''), menu, login],
    },
    {
      name: '/parent loses its exemption (mid-session verification strands)',
      apply: () => [layout.replace("  '/parent',\n", ''), menu, login],
    },
    {
      name: 'change-password loses its exemption',
      apply: () => [layout.replace("  '/parent/change-password',\n", ''), menu, login],
    },
    {
      name: 'the menu goes back to reading the hardcoded parentVerified field',
      apply: () => [layout, menu.replace('if (e?.isForbidden) {', 'if (child?.parentVerified != null) {'), login],
    },
    {
      name: 'the menu stops persisting the flag',
      apply: () => [layout, menu.replace(/setItem\('parentUserVerified'/g, "setItem('other'"), login],
    },
    {
      name: 'the login default goes back to fail-open',
      apply: () => [layout, menu, login.replace("data.verified === true ? 'true' : 'false'", "data.verified === false ? 'false' : 'true'")],
    },
  ];

  for (const m of muts) {
    const [l, mn, lg] = m.apply();
    if (l === layout && mn === menu && lg === login) {
      fail(`could not plant "${m.name}" — that mutation is inert and proves nothing`);
    } else if (!auditParentGate(l, mn, lg).length) {
      fail(`"${m.name}" slipped past — the assertion is vacuous`);
    } else {
      console.log(`  ✓ caught: ${m.name}`);
    }
  }

  const problems = auditParentGate(layout, menu, login);
  if (problems.length) problems.forEach((p) => fail(p));
  else console.log('  ✓ layout gates 10 of 13 routes; the 403 decides; the flag is written back');
}

/* ── The run ─────────────────────────────────────────────────────────────── */
console.log('\nEvery login clears the prior session:');
for (const seam of SEAMS) {
  const problems = audit(read(seam.file), seam);
  if (problems.length) {
    problems.forEach((p) => fail(`${seam.role} (${seam.file}) — ${p}`));
  } else {
    console.log(`  ✓ ${seam.role.padEnd(8)} ${seam.file}`);
  }
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL — ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
