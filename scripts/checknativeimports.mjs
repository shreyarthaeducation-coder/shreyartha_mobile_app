// Native modules that an installed app may not have yet must never be imported at the top of a file.
//
//   node scripts/checknativeimports.mjs
//
// WHY. A package with native code calls `requireNativeModule` the moment it is imported, which THROWS
// in any build without its native half — Expo Go, or an app installed before the module was added.
// On 2 Nov 2026 `expo-speech-recognition` (the Speaking Challenge) was imported at the top of
// hooks/useLiveReading.js, and Learn with Shreya died with "Cannot find native module
// 'ExpoSpeechRecognition'" before a single screen drew — the same shape as the react-native-pdf
// import that once boot-crashed every route. A green `expo export` cannot see this: bundling never
// runs a module's body.
//
// The rule, per package below: only the one file named may load it, and only through
// `requireOptionalNativeModule('<native name>')` (null, not a throw) followed by a `require(...)` of
// the package — never `import … from` it. Self-tests first: each planted mistake must be caught.
// Exit code 0 = pass.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');

const GUARDED = [
  { pkg: 'expo-speech-recognition', native: 'ExpoSpeechRecognition', loader: 'hooks/useLiveReading.js' },
  // Parent push (6 Nov 2026): Expo Go SDK 58 showed "Cannot find native module
  // 'ExpoTopicSubscriptionModule'" when expo-notifications was required behind a stale Expo Go test.
  { pkg: 'expo-notifications', native: 'ExpoPushTokenManager', loader: 'services/parent/pushService.js' },
  { pkg: 'expo-notifications', native: 'ExpoTopicSubscriptionModule', loader: 'services/parent/pushService.js' },
  { pkg: 'expo-device', native: 'ExpoDevice', loader: 'services/parent/pushService.js' },
];

const codeOnly = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.') || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const rel = (file) => path.relative(APP, file).split(path.sep).join('/');

/** Problems in `files` ({ rel: source }) for every guarded package. */
function check(files) {
  const problems = [];
  for (const { pkg, native, loader } of GUARDED) {
    const imported = new RegExp(`from\\s+['"]${escape(pkg)}['"]|import\\s+['"]${escape(pkg)}['"]`);
    const required = new RegExp(`require\\(\\s*['"]${escape(pkg)}['"]\\s*\\)`);
    for (const [name, src] of Object.entries(files)) {
      const code = codeOnly(src);
      if (imported.test(code)) problems.push(`${name}: imports ${pkg} at the top — it throws in a build without it`);
      if (name !== loader && required.test(code)) problems.push(`${name}: requires ${pkg}; only ${loader} may load it`);
    }
    const code = codeOnly(files[loader] || '');
    // A literal lookup, or the name in a list every entry of which is looked up before the load.
    let lookup = code.indexOf(`requireOptionalNativeModule('${native}')`);
    if (lookup < 0 && /requireOptionalNativeModule\(name\)/.test(code)) {
      const listed = code.indexOf(`'${native}'`);
      if (listed >= 0) lookup = code.indexOf('requireOptionalNativeModule(name)');
    }
    const load = code.search(required);
    if (lookup < 0) problems.push(`${loader}: no requireOptionalNativeModule('${native}') before loading ${pkg}`);
    else if (load >= 0 && load < lookup) problems.push(`${loader}: requires ${pkg} before checking the native module is there`);
  }
  return problems;
}

const files = {};
for (const dir of ['app', 'components', 'hooks', 'services', 'utils', 'constants']) {
  const full = path.join(APP, dir);
  if (fs.existsSync(full)) for (const f of walk(full)) files[rel(f)] = fs.readFileSync(f, 'utf8');
}

// ── self-tests: each mistake must be caught ─────────────────────────────────
const MUTANTS = [
  ['the hook imports the package at the top', (f) => ({
    ...f, 'hooks/useLiveReading.js': `import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';\n${f['hooks/useLiveReading.js']}`,
  })],
  ['a screen imports the package', (f) => ({
    ...f, 'components/x/Screen.js': "import { useSpeechRecognitionEvent } from 'expo-speech-recognition';\n",
  })],
  ['another file requires the package', (f) => ({
    ...f, 'components/x/Other.js': "const s = require('expo-speech-recognition');\n",
  })],
  ['the optional lookup is removed', (f) => ({
    ...f, 'hooks/useLiveReading.js': f['hooks/useLiveReading.js'].replace(/requireOptionalNativeModule\('ExpoSpeechRecognition'\)/g, 'true'),
  })],
  ['the push service requires expo-notifications without probing it', (f) => ({
    ...f, 'services/parent/pushService.js': f['services/parent/pushService.js'].replace(/requireOptionalNativeModule\(name\)/g, 'true'),
  })],
  ['the push service forgets the Android-only module', (f) => ({
    ...f, 'services/parent/pushService.js': f['services/parent/pushService.js'].replace(/'ExpoTopicSubscriptionModule'/g, "'X'"),
  })],
  ['a screen imports expo-notifications', (f) => ({
    ...f, 'app/parent/x.js': "import * as Notifications from 'expo-notifications';\n",
  })],
];
let selfFail = 0;
for (const [what, mutate] of MUTANTS) {
  const caught = check(mutate(files)).length > 0;
  console.log(`  ${caught ? '✓' : '✗'} ${what} — ${caught ? 'caught' : 'NOT caught'}`);
  if (!caught) selfFail += 1;
}

const problems = check(files);
problems.forEach((p) => console.log(`  ✗ ${p}`));
if (selfFail || problems.length) {
  console.log(`FAIL — ${problems.length} problem(s), ${selfFail} self-test(s) not caught`);
  process.exit(1);
}
console.log('PASS — guarded native modules load only through their optional lookup');
