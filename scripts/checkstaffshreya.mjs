// Which Shreya each staff panel talks to.
//
//   node scripts/checkstaffshreya.mjs
//
// ══ THE FAILURE THIS EXISTS FOR ════════════════════════════════════════════
// There are now TWO staff chatbots on different backends, and the wrong one renders perfectly.
// `ShreyaChatSheet` falls back to the TEACHER service when given no `config` — correct for
// Shreyartha Teacher, and for any other role a fully working chat pointed at `/api/teacher/shreya`,
// which refuses them. The user sees a chat that opens, accepts a question, and errors; it reads as
// a backend outage rather than a missing descriptor key.
//
// Nothing else can see that. `expo export` compiles either way, `checkscope` sees unbound NAMES
// rather than wrong VALUES, and `checkstaffdashboard` checks that `support` is one of two strings
// without asking whether the backend behind it admits the role.
//
// ══ WHAT IT ASSERTS ════════════════════════════════════════════════════════
//   · every role with `support: 'shreya'` resolves to a service the backend admits it to
//   · both mount sites pass the SAME resolved config
//   · every section key matches a case in the backend's context switch
//   · every routeSuffix resolves to a real wrapper file
//
// The section-key check is the quiet one: `buildPrincipalContext` falls through to the portal guide
// on an unknown key, so a typo produces a tile that opens, answers plausibly, and describes the
// wrong section entirely.
//
// Exit code 0 = pass. Anything else = read the output.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const BACKEND = path.resolve(APP, '../backendmain/src/main/java/com/shreyartha/backend');

let failures = 0;
const fail = (m) => { failures += 1; console.error(`  ✗ ${m}`); };
const ok = (m) => console.log(`  ✓ ${m}`);

const read = (p) => fs.readFileSync(path.join(APP, p), 'utf8').replace(/\r\n/g, '\n');
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const SRC = {
  home: 'components/staff/home/StaffHomeScreen.js',
  support: 'components/staff/home/StaffSupportScreen.js',
  configs: 'components/staff/home/shreyaConfigs.js',
  principalService: 'services/staff/principalShreyaService.js',
  teacherService: 'services/teacher/shreyaService.js',
};

/**
 * Which backend namespace each role's chatbot must use, and the Java guard that proves it.
 *
 * Written as a table rather than derived, because the whole point is to pin the CLIENT against the
 * SERVER: deriving both sides from the same file would assert only that the file agrees with itself.
 */
const EXPECTED = {
  shreyartha_teacher: {
    base: '/api/teacher/shreya',
    controller: 'infrastructure/shreya/TeacherShreyaController.java',
    // The descriptor names no config: undefined is the teacher default, which is right for this one.
    config: null,
  },
  principal: {
    base: '/api/principal/shreya',
    controller: 'infrastructure/shreya/PrincipalShreyaController.java',
    config: 'principal',
  },
};

async function loadConstants() {
  const dir = fs.mkdtempSync(path.join(APP, '.shreyachk-'));
  try {
    for (const n of ['staffHome', 'staffRoles', 'theme', 'principalChatbotData']) {
      const s = read(`constants/${n}.js`).replace(/from '\.\/([A-Za-z0-9_]+)'/g, "from './$1.mjs'");
      fs.writeFileSync(path.join(dir, `${n}.mjs`), s);
    }
    const imp = (n) => import(`${pathToFileURL(path.join(dir, `${n}.mjs`)).href}?t=${Math.random()}`);
    return { home: await imp('staffHome'), chat: await imp('principalChatbotData') };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const routeExists = (suffix) => {
  const seg = String(suffix).replace(/^\//, '');
  return fs.existsSync(path.join(APP, 'app/staff/[role]', `${seg || 'index'}.js`));
};

function assertions(mods, src) {
  const out = [];
  const bad = (m) => out.push(m);

  const { STAFF_HOME } = mods.home;

  // ── 1. Every shreya role is accounted for, in both directions ──────────────
  const shreyaRoles = Object.keys(STAFF_HOME).filter((r) => STAFF_HOME[r].support === 'shreya');
  for (const role of shreyaRoles) {
    if (!EXPECTED[role]) {
      bad(`${role} has support:'shreya' but no expected backend — it would fall back to the teacher's, which refuses it`);
    }
  }
  for (const role of Object.keys(EXPECTED)) {
    if (!shreyaRoles.includes(role)) bad(`${role} is expected to have Shreya but its descriptor does not`);
  }

  // ── 2. Each role's config names the right service, and that service the right base ──
  const configsCode = codeOnly(src.configs);
  for (const [role, want] of Object.entries(EXPECTED)) {
    const home = STAFF_HOME[role];
    if (!home) continue;
    const named = home.shreyaConfig || null;
    if (named !== want.config) {
      bad(`${role}: shreyaConfig is ${JSON.stringify(named)}, expected ${JSON.stringify(want.config)}`);
      continue;
    }
    if (named && !new RegExp(`\\b${named}\\s*:`).test(configsCode)) {
      bad(`${role}: shreyaConfig "${named}" is not a key in shreyaConfigs.js — the sheet would use the teacher's`);
    }
  }

  // The Principal's service must point at the Principal namespace. This is the single line that,
  // if wrong, produces a chat that looks entirely healthy and is refused on every message.
  if (!new RegExp(`base:\\s*'${EXPECTED.principal.base}'`).test(codeOnly(src.principalService))) {
    bad(`the principal Shreya service does not use ${EXPECTED.principal.base}`);
  }
  if (!new RegExp(`base:\\s*'${EXPECTED.shreyartha_teacher.base}'`).test(codeOnly(src.teacherService))) {
    bad(`the teacher Shreya service does not use ${EXPECTED.shreyartha_teacher.base}`);
  }

  // ── 3. Both mount sites pass the SAME resolved config ──────────────────────
  //
  // The home's For Support card and the Support tab both open the sheet. If only one passes a
  // config, a Principal gets their own Shreya from one door and the teacher's from the other.
  for (const key of ['home', 'support']) {
    const code = codeOnly(src[key]);
    if (!/<ShreyaChatSheet/.test(code)) continue;
    if (!/config=\{shreyaConfigFor\(home\)\}/.test(code)) {
      bad(`${SRC[key]} mounts ShreyaChatSheet without config={shreyaConfigFor(home)} — it would use the teacher's backend`);
    }
  }

  // ── 4. Section keys match the backend's switch ─────────────────────────────
  //
  // buildPrincipalContext falls through to the portal guide on an unknown key, so a typo does not
  // throw — it answers about the wrong section, convincingly.
  const ctxPath = path.join(BACKEND, 'infrastructure/shreya/PrincipalShreyaContextService.java');
  if (!fs.existsSync(ctxPath)) {
    bad('PrincipalShreyaContextService.java not found — the backend half of this feature is missing');
  } else {
    const java = fs.readFileSync(ctxPath, 'utf8');
    const cases = new Set([...java.matchAll(/case\s+"([a-z-]+)"/g)].map((m) => m[1]));
    for (const section of mods.chat.PRINCIPAL_SECTIONS) {
      // portal-guide is the documented fall-through and has no case of its own.
      if (section.sectionKey === 'portal-guide') continue;
      if (!cases.has(section.sectionKey)) {
        bad(`section "${section.sectionKey}" has no case in PrincipalShreyaContextService — it would silently answer as the portal guide`);
      }
    }
    if (!cases.size) bad('no section cases found in PrincipalShreyaContextService');
  }

  // ── 5. Every routeSuffix resolves to a real wrapper ────────────────────────
  for (const section of mods.chat.PRINCIPAL_SECTIONS) {
    if (!routeExists(section.routeSuffix)) {
      bad(`section "${section.label}" routeSuffix "${section.routeSuffix}" has no wrapper file`);
    }
  }

  // ── 6. The controllers exist and guard as documented ───────────────────────
  const ctrlPath = path.join(BACKEND, EXPECTED.principal.controller);
  if (!fs.existsSync(ctrlPath)) {
    bad('PrincipalShreyaController.java not found');
  } else {
    const java = fs.readFileSync(ctrlPath, 'utf8');
    if (!java.includes(`@RequestMapping("${EXPECTED.principal.base}")`)) {
      bad(`PrincipalShreyaController is not mapped to ${EXPECTED.principal.base}`);
    }
    if (!/hasRole\('SCHOOL_ADMIN'\)/.test(java)) {
      bad('PrincipalShreyaController does not guard on SCHOOL_ADMIN — a Principal reaches it through that role');
    }
  }

  // The service-level userType gate. The controller's role check is granted transitively by the
  // hierarchy; this one is not, and it is what keeps SHREYARTHA_ADMIN — which has no single school —
  // out of a chatbot that would answer confidently about nothing.
  const svcPath = path.join(BACKEND, 'infrastructure/shreya/PrincipalShreyaChatbotService.java');
  if (!fs.existsSync(svcPath)) {
    bad('PrincipalShreyaChatbotService.java not found');
  } else {
    const java = fs.readFileSync(svcPath, 'utf8');
    if (/ALLOWED_USER_TYPES[^;]*SHREYARTHA_ADMIN/.test(java)) {
      bad('SHREYARTHA_ADMIN is in ALLOWED_USER_TYPES — it has no single school, so every context section would resolve against nothing');
    }
    if (!/ALLOWED_USER_TYPES[^;]*"PRINCIPAL"/.test(java)) {
      bad('PRINCIPAL is not in ALLOWED_USER_TYPES — the panel this was built for would be refused');
    }
  }

  return out;
}

const sourcesOf = (mutate) => {
  const out = {};
  for (const [k, rel] of Object.entries(SRC)) {
    const raw = read(rel);
    out[k] = mutate ? mutate(rel, raw) : raw;
  }
  return out;
};

const MUTATIONS = [
  {
    name: 'the principal service pointed at the teacher namespace',
    mutate: (f, s) => (f === 'services/staff/principalShreyaService.js'
      ? s.replace("'/api/principal/shreya'", "'/api/teacher/shreya'") : s),
  },
  {
    name: 'the home card mounting Shreya without a config (silently the teacher’s)',
    mutate: (f, s) => (f === 'components/staff/home/StaffHomeScreen.js'
      ? s.replace(/\n\s*config=\{shreyaConfigFor\(home\)\}/, '') : s),
  },
  {
    name: 'the Support tab mounting Shreya without a config',
    mutate: (f, s) => (f === 'components/staff/home/StaffSupportScreen.js'
      ? s.replace(/\n\s*config=\{shreyaConfigFor\(home\)\}/, '') : s),
  },
  {
    name: 'the principal config key removed from the resolver',
    mutate: (f, s) => (f === 'components/staff/home/shreyaConfigs.js'
      ? s.replace(/\n  principal: \{[\s\S]*?\n  \},/, '') : s),
  },
];

/** Constants are mutated separately — they are evaluated, not read as text. */
const CONSTANT_MUTATIONS = [
  {
    name: 'a section key typo (answers as the portal guide, convincingly)',
    file: 'principalChatbotData.js',
    mutate: (s) => s.replace("sectionKey: 'fees'", "sectionKey: 'fee'"),
  },
  {
    name: 'a section routeSuffix with no wrapper file',
    file: 'principalChatbotData.js',
    mutate: (s) => s.replace("routeSuffix: '/overview'", "routeSuffix: '/dashboard-overview'"),
  },
  {
    name: 'the principal descriptor losing its shreyaConfig',
    file: 'staffHome.js',
    mutate: (s) => s.replace("  shreyaConfig: 'principal',\n", ''),
  },
];

async function loadWithConstantMutation(m) {
  const dir = fs.mkdtempSync(path.join(APP, '.shreyachk-'));
  try {
    for (const n of ['staffHome', 'staffRoles', 'theme', 'principalChatbotData']) {
      let s = read(`constants/${n}.js`);
      if (m && `${n}.js` === m.file) s = m.mutate(s);
      s = s.replace(/from '\.\/([A-Za-z0-9_]+)'/g, "from './$1.mjs'");
      fs.writeFileSync(path.join(dir, `${n}.mjs`), s);
    }
    const imp = (n) => import(`${pathToFileURL(path.join(dir, `${n}.mjs`)).href}?t=${Math.random()}`);
    return { home: await imp('staffHome'), chat: await imp('principalChatbotData') };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log('Self-tests (each mutation must be caught):');
for (const m of MUTATIONS) {
  let caught;
  try {
    caught = assertions(await loadConstants(), sourcesOf(m.mutate)).length > 0;
  } catch { caught = true; }
  if (caught) ok(m.name); else fail(`NOT CAUGHT: ${m.name} — the corresponding assertion is vacuous`);
}
for (const m of CONSTANT_MUTATIONS) {
  let caught;
  try {
    caught = assertions(await loadWithConstantMutation(m), sourcesOf()).length > 0;
  } catch { caught = true; }
  if (caught) ok(m.name); else fail(`NOT CAUGHT: ${m.name} — the corresponding assertion is vacuous`);
}

console.log('\nStaff Shreya wiring:');
const problems = assertions(await loadConstants(), sourcesOf());
if (problems.length === 0) {
  ok('each Shreya panel points at a backend that admits its role');
  ok('the home card and the Support tab resolve the same config');
  ok('every section key has a case in the backend, and every routeSuffix a wrapper file');
  ok('SHREYARTHA_ADMIN stays out of the school-scoped chatbot');
} else {
  for (const p of problems) fail(p);
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
