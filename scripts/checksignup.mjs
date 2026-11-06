/**
 * Every kind of account the website has can register and sign in on the app (6 Nov 2026).
 *
 *   1. Every portal the sign-in gate can answer has a "Register as" card, and the card's route has a
 *      screen file registered in the root stack.
 *   2. Every portal has a session writer in services/portalSession.js (sign-in lands somewhere).
 *   3. The two staff doors offer exactly the website's roles (School/SchoolAuth.js), and every one
 *      of them has a native shell — so no staff role is refused at sign-in ("not available on the
 *      mobile app"), School Admin included.
 *   4. Every University Staff role the website signs up has a landing page.
 *
 * Self-tested: each mutation below must be caught. usage: node scripts/checksignup.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.resolve(APP, '..', 'frontendmain', 'src');
const read = (p) => fs.readFileSync(p, 'utf8');

/** The constants as modules, from (possibly mutated) source text, with their relative imports. */
async function loadConstants(mut = (n, s) => s) {
  const dir = fs.mkdtempSync(path.join(APP, '.signupchk-'));
  try {
    for (const n of ['authPortals', 'staffRoles', 'staffHome']) {
      const s = mut(`${n}.js`, read(path.join(APP, 'constants', `${n}.js`))).replace(/from '\.\/([A-Za-z0-9_]+)'/g, "from './$1.mjs'");
      fs.writeFileSync(path.join(dir, `${n}.mjs`), s);
    }
    const clients = mut('portalClients.js', read(path.join(APP, 'services', 'portalClients.js')));
    // Only the two maps are needed; the rest imports React Native.
    const maps = [...clients.matchAll(/export const UNIVERSITY_STAFF_(HOME|LABEL) = \{[\s\S]*?\n\};/g)].map((m) => m[0]).join('\n');
    fs.writeFileSync(path.join(dir, 'clients.mjs'), maps);
    const imp = (n) => import(`${pathToFileURL(path.join(dir, `${n}.mjs`)).href}?t=${Math.random()}`);
    return { auth: await imp('authPortals'), roles: await imp('staffRoles'), clients: await imp('clients') };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const GATE_PORTALS = {
  STUDENT: 'student',
  SCHOOL: 'school',
  PARENT: 'parent',
  PARTNER: 'partner',
  ALUMNI: 'alumni',
  UNIVERSITY: 'university',
  UNIVERSITY_STAFF: 'universityStaff',
  INDUSTRY: 'industry',
  INVESTOR: 'investor',
};

async function audit(mut) {
  const problems = [];
  const bad = (m) => problems.push(m);
  const { auth, roles, clients } = await loadConstants(mut?.constants);
  const layout = mut?.layout ? mut.layout(read(path.join(APP, 'app', '_layout.js'))) : read(path.join(APP, 'app', '_layout.js'));
  const session = read(path.join(APP, 'services', 'portalSession.js'));
  const staffAuth = mut?.staffAuth ? mut.staffAuth(read(path.join(APP, 'components', 'auth', 'StaffAuthScreen.js'))) : read(path.join(APP, 'components', 'auth', 'StaffAuthScreen.js'));

  // 1 + 2
  const general = auth.LOGIN_GROUPS.find((g) => g.key === 'general')?.options || [];
  for (const [portal, key] of Object.entries(GATE_PORTALS)) {
    const card = general.find((o) => o.key === key);
    if (!card) {
      bad(`${portal}: no "Register as" card in LOGIN_GROUPS.general`);
      continue;
    }
    const file = path.join(APP, 'app', `${card.route.replace(/^\//, '')}.js`);
    if (!fs.existsSync(file)) bad(`${portal}: ${card.route} has no screen file`);
    if (!layout.includes(`name="${card.route.replace(/^\//, '')}"`)) bad(`${portal}: ${card.route} is not registered in app/_layout.js`);
    if (!session.includes(`case '${portal}'`)) bad(`${portal}: no session writer in portalSession.js — sign-in would land nowhere`);
  }

  // 3
  const webAuth = read(path.join(WEB, 'School', 'SchoolAuth.js'));
  const list = (name) => [...(webAuth.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`))?.[1] || '').matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]);
  for (const [web, app] of [['SCHOOL_ROLES', auth.SCHOOL_ROLES], ['EMPLOYEE_ROLES', auth.EMPLOYEE_ROLES]]) {
    const want = list(web);
    const have = app.map((r) => r.value);
    if (want.join() !== have.join()) bad(`${web}: app offers [${have}] but the website offers [${want}]`);
    for (const r of have) {
      if (!roles.STAFF_ROLE_CONFIG[r.toLowerCase()] && r !== 'TEACHER') bad(`${r} has no native shell — it would be refused at sign-in`);
    }
  }
  if (/not available on the mobile app/i.test(staffAuth) && /=== 'admin'/.test(staffAuth)) bad('StaffAuthScreen still refuses School Admin at login');

  // 4
  const unistaff = read(path.join(APP, 'app', 'auth', 'university-staff-login.js'));
  for (const m of unistaff.matchAll(/value: '([A-Z_]+)'/g)) {
    if (!clients.UNIVERSITY_STAFF_HOME[m[1]]) bad(`University Staff ${m[1]} signs up but has no landing page`);
  }
  return problems;
}

const MUTATIONS = [
  { name: 'the Alumni card dropped', constants: (n, s) => (n === 'authPortals.js' ? s.replace("key: 'alumni',", "key: 'alumniX',") : s) },
  { name: 'Investor card pointing at a missing screen', constants: (n, s) => (n === 'authPortals.js' ? s.replace("route: '/auth/investor-login'", "route: '/auth/investor-signup'") : s) },
  { name: 'a sign-up screen unregistered', layout: (s) => s.replace('<Stack.Screen name="auth/industry-login"', '<Stack.Screen name="auth/industry-loginX"') },
  { name: 'HR removed from the employee door', constants: (n, s) => (n === 'authPortals.js' ? s.replace("  { value: 'HR', label: 'HR Executive' },\n", '') : s) },
  { name: 'School Admin shell removed', constants: (n, s) => (n === 'staffRoles.js' ? s.replace('STAFF_ROLE_CONFIG.admin = {', 'const _gone = {') : s) },
  { name: 'School Admin refused again', staffAuth: (s) => s.replace('// THE WRONG-DOOR GUARD.', "if (String(data.userType || '').toLowerCase() === 'admin') { setError('Admin access is not available on the mobile app.'); return; }\n      // THE WRONG-DOOR GUARD.") },
  { name: 'Admission Officer left without a landing page', constants: (n, s) => (n === 'portalClients.js' ? s.replace("  ADMISSION_OFFICER: '/unistaff/welcome',\n", '') : s) },
];

const base = await audit();
for (const p of base) console.log(`  ✗ ${p}`);
let vacuous = 0;
for (const m of MUTATIONS) {
  const found = await audit(m);
  if (found.length > base.length) console.log(`  ✓ caught: ${m.name}`);
  else {
    vacuous += 1;
    console.log(`  ✗ NOT CAUGHT: ${m.name}`);
  }
}
if (base.length || vacuous) {
  console.log(`\ncheck-signup FAILED (${base.length} problem(s), ${vacuous} vacuous)`);
  process.exit(1);
}
console.log(`\ncheck-signup PASSED: ${Object.keys(GATE_PORTALS).length} portals, ${MUTATIONS.length} mutations all caught.`);
