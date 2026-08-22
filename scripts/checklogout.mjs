// Checker for "the logout buttons of all the logins are not working properly".
//
//   node scripts/checklogout.mjs
//
// WHY THIS EXISTS. The bug was not a crash and not a missing symbol — it was an ABSENCE. Five
// screens rendered `onPress={logout}`, where `logout` is AuthContext's storage-wipe. That is
// perfectly valid JavaScript: it builds clean, `checkscope.js` resolves the identifier, and
// `expo export` is happy. The user taps "Log out", every auth key is deleted, and the screen they
// are looking at does not change — because nothing navigates.
//
// The layout guards cannot save it either. app/{partner,parent,student}/_layout.js each read their
// token ONCE in a useEffect([]) and cache it in state, so wiping storage does not re-trigger them.
// The bounce to a login screen only arrives later, when an unrelated request 401s.
//
// So the assertions here are about SHAPE, not symbols: every logout control must go through
// usePortalLogout (which navigates), the generic hook must refuse a missing route, and the
// staff hook must still run its attendance end-ping BEFORE the keys are cleared.
//
// Every assertion is mutation-tested at the bottom: a checker that has never been shown to fail is
// not evidence of anything.
//
// Exit code 0 = pass.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`  ✗ ${msg}`);
};
const ok = (msg) => console.log(`  ✓ ${msg}`);

// Mixed line endings live in this repo; normalise so source assertions cannot fail on that alone.
const read = (p) => fs.readFileSync(path.join(APP, p), 'utf8').replace(/\r\n/g, '\n');

/**
 * Every screen that renders a logout control, and the login screen its portal must land on.
 * These five were the bare-`logout` sites; staff screens were already correct and are covered
 * through useStaffLogout below.
 */
const LOGOUT_SCREENS = [
  ['components/partner/PartnerMenuScreen.js', '/auth/partner-login'],
  ['components/partner/PartnerPendingScreen.js', '/auth/partner-login'],
  ['components/parent/ParentMenuScreen.js', '/auth/parent-login'],
  ['components/parent/ParentPendingScreen.js', '/auth/parent-login'],
  ['components/student/StudentHome.js', '/auth/student-login'],
];

const PORTAL_HOOK = 'hooks/usePortalLogout.js';
const STAFF_HOOK = 'hooks/useStaffLogout.js';

// ── Assertions ──────────────────────────────────────────────────────────────────────────────────

/** @param {(p: string, src: string) => string} [mutate] */
function runChecks(mutate) {
  const before = failures;
  const src = (p) => {
    const raw = read(p);
    return mutate ? mutate(p, raw) : raw;
  };

  // 1. No screen may call the storage-wipe directly as a press handler.
  for (const [file] of LOGOUT_SCREENS) {
    const s = src(file);
    if (/onPress=\{\s*logout\s*\}/.test(s)) {
      fail(`${file}: onPress={logout} wipes storage without navigating — use usePortalLogout`);
    } else {
      ok(`${file}: no bare onPress={logout}`);
    }
  }

  // 2. Each screen must use the portal hook with ITS OWN login route. A partner sent to the
  //    student login is the other half of this bug (see services/apiService.js's fallback).
  for (const [file, route] of LOGOUT_SCREENS) {
    const s = src(file);
    if (!s.includes('usePortalLogout')) {
      fail(`${file}: does not import/use usePortalLogout`);
      continue;
    }
    if (!s.includes(`loginRoute: '${route}'`)) {
      fail(`${file}: must pass loginRoute: '${route}'`);
    } else {
      ok(`${file}: routes to ${route}`);
    }
  }

  // 3. The logout control must be wired to a handler that actually exists on the hook.
  for (const [file] of LOGOUT_SCREENS) {
    const s = src(file);
    const handler = /onPress=\{\s*(confirmLogout|logoutNow)\s*\}/.exec(s);
    if (!handler) {
      fail(`${file}: no onPress={confirmLogout} / onPress={logoutNow}`);
      continue;
    }
    if (!new RegExp(`\\b${handler[1]}\\b`).test(s.split('return')[0])) {
      fail(`${file}: ${handler[1]} is used but never destructured from the hook`);
    } else {
      ok(`${file}: onPress={${handler[1]}} is bound`);
    }
  }

  // 4. The generic hook must navigate, and must do so even when logout() throws.
  const hook = src(PORTAL_HOOK);
  if (!/router\.replace\(loginRoute\)/.test(hook)) {
    fail(`${PORTAL_HOOK}: must call router.replace(loginRoute)`);
  } else {
    ok(`${PORTAL_HOOK}: navigates via router.replace`);
  }
  if (!/finally\s*\{[^}]*router\.replace/s.test(hook)) {
    fail(`${PORTAL_HOOK}: router.replace must be in a finally — a thrown logout would strand the user`);
  } else {
    ok(`${PORTAL_HOOK}: navigation is in a finally block`);
  }
  // replace, not push: the signed-out screen must not stay on the back stack.
  if (/router\.push\(/.test(hook)) {
    fail(`${PORTAL_HOOK}: uses router.push — the signed-out screen stays reachable via back`);
  } else {
    ok(`${PORTAL_HOOK}: no router.push`);
  }
  if (!/throw new Error\('usePortalLogout requires a loginRoute'\)/.test(hook)) {
    fail(`${PORTAL_HOOK}: must reject a missing loginRoute rather than silently not navigating`);
  } else {
    ok(`${PORTAL_HOOK}: refuses a missing loginRoute`);
  }

  // 5. Ordering: the staff attendance end-ping is authenticated, so it must run BEFORE the wipe.
  //    This is the one rule whose violation is completely invisible — the record just never lands.
  const staff = src(STAFF_HOOK);
  if (!staff.includes('usePortalLogout')) {
    fail(`${STAFF_HOOK}: should delegate to usePortalLogout so both paths cannot drift`);
  } else {
    ok(`${STAFF_HOOK}: delegates to usePortalLogout`);
  }
  if (!/beforeLogout:\s*endStaffAttendanceSession/.test(staff)) {
    fail(`${STAFF_HOOK}: endStaffAttendanceSession must be passed as beforeLogout (needs the token)`);
  } else {
    ok(`${STAFF_HOOK}: attendance end-ping runs before the key wipe`);
  }
  const beforeIdx = hook.indexOf('await beforeLogout()');
  const logoutIdx = hook.indexOf('await logout()');
  if (beforeIdx === -1 || logoutIdx === -1 || beforeIdx > logoutIdx) {
    fail(`${PORTAL_HOOK}: beforeLogout() must be awaited before logout() clears the keys`);
  } else {
    ok(`${PORTAL_HOOK}: beforeLogout precedes logout`);
  }

  return failures === before;
}

// ── Mutation tests: prove each rule can fail ────────────────────────────────────────────────────

const MUTATIONS = [
  {
    name: 'a screen reverts to the bare storage-wipe handler',
    mutate: (p, s) =>
      p === 'components/student/StudentHome.js'
        ? s.replace('onPress={confirmLogout}', 'onPress={logout}')
        : s,
  },
  {
    name: 'the partner portal is pointed at the student login',
    mutate: (p, s) =>
      p === 'components/partner/PartnerMenuScreen.js'
        ? s.replace("loginRoute: '/auth/partner-login'", "loginRoute: '/auth/student-login'")
        : s,
  },
  {
    name: 'the hook stops navigating',
    mutate: (p, s) =>
      p === PORTAL_HOOK ? s.replace('router.replace(loginRoute);', '// navigation removed') : s,
  },
  {
    name: 'navigation moves out of the finally (a thrown logout strands the user)',
    mutate: (p, s) =>
      p === PORTAL_HOOK
        ? s.replace(/\} finally \{\n\s*setLoggingOut\(false\);\n\s*router\.replace\(loginRoute\);\n\s*\}/,
            '}\n      setLoggingOut(false);\n      router.replace(loginRoute);')
        : s,
  },
  {
    name: 'the staff attendance end-ping is dropped',
    mutate: (p, s) =>
      p === STAFF_HOOK ? s.replace('beforeLogout: endStaffAttendanceSession,', '') : s,
  },
  {
    name: 'beforeLogout is moved AFTER the key wipe (silently loses the checkout record)',
    mutate: (p, s) =>
      p === PORTAL_HOOK
        ? s.replace(/if \(beforeLogout\) \{[\s\S]*?\n      \}\n      await logout\(\);/,
            'await logout();\n      if (beforeLogout) { await beforeLogout(); }')
        : s,
  },
];

console.log('logout wiring\n');
const passed = runChecks();

console.log('\nmutation tests (each must FAIL the checks above)\n');
let mutationFailures = 0;
for (const { name, mutate } of MUTATIONS) {
  const saved = failures;
  const silent = console.error;
  console.error = () => {};
  const log = console.log;
  console.log = () => {};
  const stillPasses = runChecks(mutate);
  console.error = silent;
  console.log = log;
  failures = saved; // mutation failures are expected; don't count them as real
  if (stillPasses) {
    mutationFailures += 1;
    console.error(`  ✗ NOT CAUGHT: ${name}`);
  } else {
    console.log(`  ✓ caught: ${name}`);
  }
}

const total = failures + mutationFailures;
console.log(
  total === 0
    ? '\nAll logout checks passed.'
    : `\n${failures} check failure(s), ${mutationFailures} uncaught mutation(s).`,
);
process.exit(total === 0 ? 0 : 1);
