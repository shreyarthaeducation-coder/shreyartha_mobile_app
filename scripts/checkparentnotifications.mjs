// scripts/checkparentnotifications.mjs
//
// Parents are told about school events aimed at their child's class — in the app, and by push.
// Push is the part a build cannot see break: a token that is never registered, a logout that wipes
// the session before unregistering, a channel created after the token is asked for (no Android 13
// prompt, no token), a hardcoded project id, or a top-level native import that crashes boot on a
// build without the module. Each looks fine and simply delivers nothing.
//
// Asserts on constructs, not on names that appear elsewhere. Every mutation must plant and then
// turn at least one assertion red.
//
// Usage: node scripts/checkparentnotifications.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FILES = {
  push: 'services/parent/pushService.js',
  api: 'services/parent/notificationService.js',
  layout: 'app/parent/_layout.js',
  route: 'app/parent/notifications.js',
  menu: 'components/parent/ParentMenuScreen.js',
  appJson: 'app.json',
  appConfig: 'app.config.js',
};

const load = () =>
  Object.fromEntries(
    Object.entries(FILES).map(([key, rel]) => [
      key,
      fs.readFileSync(path.join(APP, rel), 'utf8').split('\r\n').join('\n'),
    ]),
  );

/** The `{ ... }` body after a marker, by brace depth. */
function body(src, marker) {
  const at = src.indexOf(marker);
  if (at < 0) return '';
  const open = src.indexOf('{', at + marker.length);
  let depth = 0;
  for (let i = open; i >= 0 && i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return '';
}

const ASSERTIONS = [
  {
    name: 'expo-notifications is never imported at the top level (a missing module must not crash boot)',
    test: (s) => !/^import[^\n]*from 'expo-notifications'/m.test(s.push) && /require\('expo-notifications'\)/.test(s.push),
  },
  {
    name: 'push is skipped in Expo Go',
    test: (s) => body(s.push, 'function loadNative()').includes("Constants.appOwnership === 'expo'"),
  },
  {
    name: 'the Android channel is created BEFORE the token is asked for',
    test: (s) => {
      const fn = body(s.push, 'export async function registerParentPush()');
      const channel = fn.indexOf('setNotificationChannelAsync(PARENT_PUSH_CHANNEL');
      const token = fn.indexOf('getExpoPushTokenAsync(');
      return channel > 0 && token > channel;
    },
  },
  {
    name: "the channel is the one the backend's pushes name",
    test: (s) => s.push.includes("export const PARENT_PUSH_CHANNEL = 'school-events';"),
  },
  {
    name: 'the project id comes from config, never a hardcoded id',
    test: (s) =>
      s.push.includes('Constants.expoConfig?.extra?.eas?.projectId') && !/[0-9a-f]{8}-[0-9a-f]{4}-/.test(s.push),
  },
  {
    name: 'unregistering is a POST to the unregister endpoint',
    test: (s) => s.api.includes("parentApi.post(`${BASE}/push-token/unregister`, { token })"),
  },
  {
    name: 'the shell registers push only for a verified session',
    test: (s) => /if \(!state\.token \|\| !state\.verified\) return;\s*registerParentPush\(\);/.test(s.layout),
  },
  {
    name: 'a tapped push opens the Notifications list',
    test: (s) => s.layout.includes("onParentPushOpened(() => router.push('/parent/notifications'))"),
  },
  {
    name: 'the route is registered in the parent stack',
    test: (s) => s.layout.includes('<Stack.Screen name="notifications" />') && s.route.includes('<ParentNotificationsScreen />'),
  },
  {
    name: 'logout unregisters the phone before the keys are wiped',
    test: (s) => /usePortalLogout\(\{\s*loginRoute: '\/auth\/parent-login',\s*beforeLogout: unregisterParentPush,\s*\}\)/.test(s.menu),
  },
  {
    name: 'the app config carries the notifications plugin and a shippable versionCode',
    test: (s) => {
      const cfg = JSON.parse(s.appJson).expo;
      // `>= 15`, not `=== 15`. Push needs a NEW store build — versionCode 14 and earlier carry no
      // push code and there is no OTA channel — so the rule is that the build is at or after the
      // one that introduced it. Freezing the exact number made this assertion fail on the next
      // release bump, which teaches whoever hits it to edit the checker to match the code: the
      // habit that turns a suite into decoration.
      return cfg.plugins.includes('expo-notifications') && cfg.android.versionCode >= 15;
    },
  },
  {
    name: 'google-services.json is wired in only when it exists (a missing file must not break every build)',
    test: (s) => /if \(fs\.existsSync\(googleServices\)\) \{\s*config\.android = \{ \.\.\.config\.android, googleServicesFile/.test(s.appConfig),
  },
];

const MUTATIONS = [
  ['a top-level native import', 'push', "import Constants from 'expo-constants';", "import Constants from 'expo-constants';\nimport * as N from 'expo-notifications';"],
  ['Expo Go no longer skipped', 'push', "Constants.appOwnership === 'expo' ||", 'false &&'],
  [
    'the token asked for before the channel exists',
    'push',
    "    if (Platform.OS === 'android') {\n      await Notifications.setNotificationChannelAsync(",
    "    await Notifications.getExpoPushTokenAsync({});\n    if (Platform.OS === 'android') {\n      await Notifications.setNotificationChannelAsync(",
  ],
  ['the channel renamed', 'push', "PARENT_PUSH_CHANNEL = 'school-events'", "PARENT_PUSH_CHANNEL = 'default'"],
  ['a hardcoded project id', 'push', 'Constants.expoConfig?.extra?.eas?.projectId ||', "'3895f096-be3e-4a55-b755-ebc8c28181a2' ||"],
  ['unregister made a DELETE', 'api', "parentApi.post(`${BASE}/push-token/unregister`, { token })", 'parentApi.del(`${BASE}/push-token`)'],
  ['an unverified session registers', 'layout', 'if (!state.token || !state.verified) return;', 'if (!state.token) return;'],
  ['a tapped push goes nowhere', 'layout', "router.push('/parent/notifications'))", "router.push('/parent'))"],
  ['the route dropped from the stack', 'layout', '<Stack.Screen name="notifications" />', ''],
  ['logout forgets to unregister', 'menu', '    beforeLogout: unregisterParentPush,\n', ''],
  // Anchored on the KEY, not on a number: pinning "versionCode": 15 made this mutation inert the
  // moment the release was bumped, and an inert mutation reports green while proving nothing.
  ['the release not bumped past the push build', 'appJson', /"versionCode":\s*\d+/, '"versionCode": 14'],
  ['google-services.json made unconditional', 'appConfig', 'if (fs.existsSync(googleServices)) {', 'if (true) {'],
];

const run = (sources) => ASSERTIONS.filter((a) => {
  try {
    return !a.test(sources);
  } catch {
    return true;
  }
}).map((a) => a.name);

const sources = load();
const failing = run(sources);
if (failing.length) {
  console.error('checkparentnotifications FAILED:');
  failing.forEach((name) => console.error(`  ✗ ${name}`));
  process.exit(1);
}

let problems = 0;
for (const [name, key, from, to] of MUTATIONS) {
  // `from` may be a string or a RegExp. A regex anchor is what lets a mutation survive a value that
  // legitimately changes — the versionCode moves every release, and a string anchor holding last
  // release's number goes inert the moment it is bumped.
  const present = from instanceof RegExp ? from.test(sources[key]) : sources[key].includes(from);
  if (!present) {
    console.error(`  ✗ could not plant "${name}" — that mutation is inert and proves nothing`);
    problems += 1;
    continue;
  }
  const mutated = { ...sources, [key]: sources[key].replace(from, to) };
  if (mutated[key] === sources[key]) {
    console.error(`  ✗ "${name}" changed nothing — inert`);
    problems += 1;
    continue;
  }
  if (!run(mutated).length) {
    console.error(`  ✗ NOT CAUGHT: ${name}`);
    problems += 1;
  }
}

if (problems) {
  console.error(`checkparentnotifications: ${problems} mutation problem(s).`);
  process.exit(1);
}
console.log(`checkparentnotifications PASSED: ${ASSERTIONS.length} assertions, ${MUTATIONS.length} mutations all caught.`);
