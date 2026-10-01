// scripts/checkfetch.mjs
//
// Every upload in this app sends its file as React Native's `{ uri, name, type }` FormData part
// (staffApi, studentApi, portalApi, apiService, ttsClient). Expo SDK 57 replaces the global fetch
// with expo/fetch, which cannot send such a part — it throws "Unsupported FormDataPart
// implementation" before the request leaves the phone, so every photo, PDF and recording upload
// failed, and the marks-sheet scan read as "Could not reach the server".
//
// Expo's own switch, EXPO_PUBLIC_USE_RN_FETCH=1, keeps React Native's fetch. It is inlined at bundle
// time, so it must be in .env (Metro, Expo Go) AND in every eas.json build profile (store builds).
// This asserts both, and that the runtime still reads that exact variable. Each assertion is proved
// by a planted break.
//
// Usage: node scripts/checkfetch.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(APP, p), 'utf8');

const sources = {
  env: read('.env'),
  eas: read('eas.json'),
  runtime: read('node_modules/expo/src/winter/runtime.native.ts'),
};

const FLAG = /^EXPO_PUBLIC_USE_RN_FETCH=(1|true)\s*$/m;

const ASSERTIONS = [
  ['.env keeps React Native fetch (EXPO_PUBLIC_USE_RN_FETCH=1)', (s) => FLAG.test(s.env)],
  [
    'every eas.json build profile keeps React Native fetch',
    (s) => {
      let eas;
      try {
        eas = JSON.parse(s.eas);
      } catch {
        return false;
      }
      const profiles = Object.values(eas.build || {});
      return profiles.length > 0 && profiles.every((p) => ['1', 'true'].includes(p?.env?.EXPO_PUBLIC_USE_RN_FETCH));
    },
  ],
  [
    "Expo's runtime still reads EXPO_PUBLIC_USE_RN_FETCH before replacing fetch",
    (s) => s.runtime.includes("process.env.EXPO_PUBLIC_USE_RN_FETCH === '1'")
      && s.runtime.includes("install('fetch', () => require('./fetch').fetch);"),
  ],
];

const run = (s) => ASSERTIONS.filter(([, test]) => !test(s)).map(([name]) => name);

const failing = run(sources);
if (failing.length) {
  console.error('checkfetch FAILED:');
  failing.forEach((name) => console.error(`  ✗ ${name}`));
  process.exit(1);
}

const MUTATIONS = [
  ['the flag removed from .env', 'env', /^EXPO_PUBLIC_USE_RN_FETCH=1\s*$/m, '# EXPO_PUBLIC_USE_RN_FETCH=1'],
  ['the flag dropped from one build profile', 'eas', /"EXPO_PUBLIC_USE_RN_FETCH": "1"/, '"EXPO_PUBLIC_USE_RN_FETCH": "0"'],
  ['Expo renames the switch', 'runtime', "process.env.EXPO_PUBLIC_USE_RN_FETCH === '1'", "process.env.EXPO_USE_RN_FETCH === '1'"],
];

let problems = 0;
for (const [name, key, from, to] of MUTATIONS) {
  const mutated = { ...sources, [key]: sources[key].replace(from, to) };
  if (mutated[key] === sources[key]) {
    console.error(`  ✗ could not plant "${name}" — inert`);
    problems += 1;
  } else if (run(mutated).length === 0) {
    console.error(`  ✗ NOT CAUGHT: ${name}`);
    problems += 1;
  }
}
if (problems) process.exit(1);
console.log(`checkfetch PASSED: ${ASSERTIONS.length} assertions, ${MUTATIONS.length} mutations all caught.`);
