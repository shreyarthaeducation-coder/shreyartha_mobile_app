// The redesigned partner dashboard.
//
//   node scripts/checkpartnerdashboard.mjs
//
// WHY THIS EXISTS. The partner design asks for several things the backend cannot provide, and each
// one is tempting to render as a plausible zero. None of it is visible to `expo export`:
//
//   * **Active Schools / Pending Schools.** There is NO status of any kind on the partner↔school
//     link — `linkedSchoolCodes` is a bare `List<String>` — and the `School` entity has no status
//     column either. There is nothing to derive them from. Drawing "0 active" would be a claim the
//     database cannot make.
//   * **Total Students.** No aggregate endpoint. The literal figure means one roster call per linked
//     school; the dashboard instead counts DISTINCT students out of the single monetization call it
//     already makes, and labels that honestly as "Your Students".
//   * **Pending Payout.** No server field. `PENDING` is captured-but-unsettled and `APPROVED` is
//     settled-and-payable; money owed is both, so it is composed — and getting that wrong
//     under-reports what a partner is owed.
//   * **This Month.** The twelve buckets are an Indian FINANCIAL year, Apr→Mar, so `monthIndex` is
//     not the calendar month. Indexing by `getMonth()` reads August as November.
//   * **Date of Joining.** No `createdAt` on `PartnerUser` OR on `User`. `termsAcceptedAt` is
//     stamped at signup and is the honest proxy; null must stay null.
//   * **Partner ID.** `partnerCode` is nullable admin-typed free text with no `PRT#####` format.
//     Unassigned is a real, common state.
//   * **Revenue must come from `/earnings/summary`.** `/analytics/monetization` drops any earning
//     whose subscription row is missing, so summing it client-side reads LOWER.
//
// Exit code 0 = pass.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');

const SRC = {
  home: 'components/partner/PartnerMenuScreen.js',
  service: 'services/partner/dashboardService.js',
  strip: 'components/shared/home/StatStrip.js',
  identity: 'components/shared/home/IdentityCard.js',
  searchService: 'services/partner/searchService.js',
  changePassword: 'components/partner/PartnerChangePasswordScreen.js',
  layout: 'app/partner/_layout.js',
  keys: 'constants/storageKeys.js',
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
 * Leading-boundary form, and it matters twice here: the naive regex eats `'image/*'`, and a
 * slash-star sequence inside a LINE comment opens a block comment as far as this function is
 * concerned. The parent redesign lost every line of JSX below such a comment and the checker
 * reported a component that was plainly on screen as missing. Keep path wildcards out of line
 * comments in the files listed above.
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

/** Stage the dashboard service with its transport stubbed, so the figures can be RUN. */
async function loadService(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdash-'));
  fs.writeFileSync(
    path.join(dir, 'stub.mjs'),
    'export const partnerApi = { get: async () => ({}), settleAll: async () => ({}) };\nexport default partnerApi;\n',
  );
  // The REAL formatRupees is staged — the rupee grouping is part of what these tiles promise, and
  // a stub would make the currency assertions a test of the stub.
  fs.writeFileSync(path.join(dir, 'currency.mjs'), read(path.join(APP, 'utils', 'currency.js')));

  let src = read(path.join(APP, SRC.service));
  if (mutate) src = mutate(src);
  src = src
    .replace("from '../partnerApi'", "from './stub.mjs'")
    .replace("from '../../utils/currency'", "from './currency.mjs'");

  const file = path.join(dir, 'dashboardService.mjs');
  fs.writeFileSync(file, src);
  return import(`${pathToFileURL(file).href}?t=${Math.random()}`);
}

const okPart = (data) => ({ data, error: null, forbidden: false });
const failedPart = () => ({ data: null, error: 'Could not load.', forbidden: false });

function assertions(svc, src) {
  const out = [];
  const bad = (m) => out.push(m);
  const service = codeOnly(src.service);

  /* ── 1. REVENUE COMES FROM /earnings/summary ─────────────────────────────── */

  if (!/earnings\/summary/.test(service)) {
    bad('the revenue figures do not read /api/partner/earnings/summary');
  }
  if (/reduce\([\s\S]{0,120}revenue/.test(service)) {
    bad('revenue is being summed from the monetization rows — that drops earnings whose subscription row is missing, so it reads LOWER than the summary');
  }

  const parts = {
    summary: okPart({
      lifetimeNetAmount: 2475000,
      paidAmount: 1860000,
      pendingAmount: 290000,
      approvedAmount: 325000,
    }),
    monetization: okPart([
      { studentId: 1, studentName: 'A' },
      { studentId: 1, studentName: 'A' }, // a renewal — must not double-count
      { studentId: 2, studentName: 'B' },
    ]),
    // August is index 4 of an Apr→Mar year. The deliberately WRONG value sits at index 7, which is
    // what a naive `getMonth()` lookup would read.
    monthly: [
      { monthIndex: 4, label: 'Aug', total: 325000 },
      { monthIndex: 7, label: 'Nov', total: 999999 },
    ].map((r) => r),
  };
  parts.monthly = okPart(parts.monthly);

  const august = new Date(2026, 7, 15); // 15 Aug 2026
  const revenue = svc.revenueStats(parts, august, {});
  const byKey = Object.fromEntries(revenue.map((s) => [s.key, s]));

  if (!/24,75,000/.test(byKey.total?.value || '')) {
    bad(`total revenue = ${byKey.total?.value}, expected the lakh-grouped lifetimeNetAmount`);
  }
  if (/\./.test(byKey.total?.value || '')) {
    bad('the rupee tiles carry paise — two decimals overflow a quarter-width tile and mean nothing at this altitude');
  }
  if (!/18,60,000/.test(byKey.paid?.value || '')) bad(`paid = ${byKey.paid?.value}, expected paidAmount`);
  // COMPOSED: pending + approved = 6,15,000. Either alone under-reports what is owed.
  if (!/6,15,000/.test(byKey.pending?.value || '')) {
    bad(`pending payout = ${byKey.pending?.value}, expected pendingAmount + approvedAmount (6,15,000)`);
  }
  if (!/3,25,000/.test(byKey.month?.value || '')) {
    bad(`this month = ${byKey.month?.value}, expected the August bucket — the buckets are an Apr→Mar financial year, so monthIndex is not getMonth()`);
  }

  // A failed call is omitted, never zeroed.
  const failed = svc.revenueStats(
    { summary: failedPart(), monetization: failedPart(), monthly: failedPart() },
    august,
    {},
  );
  if (!failed.every((s) => s.soon === true)) {
    bad('a revenue figure whose call FAILED renders as a number — "we could not read this" is not "you earned nothing"');
  }

  /* ── 2. SCHOOL STATS: TWO REAL, TWO THAT CANNOT EXIST ────────────────────── */

  const schools = svc.schoolStats({ linkedSchoolCodes: ['A', 'B', 'C'] }, parts, {});
  const sKey = Object.fromEntries(schools.map((s) => [s.key, s]));

  if (sKey.schools?.value !== '3') bad(`school count = ${sKey.schools?.value}, expected 3`);
  // DISTINCT students — a renewal is one person, not two.
  if (sKey.students?.value !== '2') {
    bad(`student count = ${sKey.students?.value}, expected 2 DISTINCT students from 3 subscription rows`);
  }
  if (sKey.active?.soon !== true || sKey.pending?.soon !== true) {
    bad('Active/Pending Schools carry a value — no status exists on the link or on the School entity');
  }
  // The count must not come from per-school roster calls.
  if (/schools\/\$\{|analytics\/schools\//.test(service)) {
    bad('the dashboard calls the per-school roster endpoint — that is one request per school and megabytes of JSON for one number');
  }

  const noStudents = svc.schoolStats({ linkedSchoolCodes: [] }, { monetization: failedPart() }, {});
  if (noStudents.find((s) => s.key === 'students')?.soon !== true) {
    bad('a failed monetization call reports 0 students rather than being omitted');
  }

  /* ── 3. JOIN DATE AND PARTNER CODE ARE NEVER GUESSED ─────────────────────── */

  if (svc.joinedOn({}) !== null) bad('joinedOn invents a date for a partner with no termsAcceptedAt');
  if (svc.joinedOn({ termsAcceptedAt: 'not-a-date' }) !== null) {
    bad('joinedOn returns something for an unparseable timestamp');
  }
  if (!svc.joinedOn({ termsAcceptedAt: '2025-01-15T09:00:00Z' })) {
    bad('joinedOn cannot read a real termsAcceptedAt');
  }
  if (/createdAt/.test(service)) {
    bad('the service reads createdAt — PartnerUser and User both have no such column');
  }

  if (svc.partnerCodeOf({}) !== null) bad('partnerCodeOf invents a code');
  if (svc.partnerCodeOf({ partnerCode: '  ' }) !== null) bad('a whitespace code is treated as assigned');
  if (svc.partnerCodeOf({ partnerCode: ' abc ' }) !== 'abc') bad('partnerCodeOf does not trim');

  const home = codeOnly(src.home);
  if (!/noCode/.test(home)) {
    bad('the identity card has no "not yet assigned" state for an unassigned partner code');
  }

  /* ── 4. NO PARTNER PHOTO, AND NO SHREYA ──────────────────────────────────── */

  const cardUse = home.match(/<IdentityCard[\s\S]*?\/>/);
  if (cardUse && /photoUrl=/.test(cardUse[0])) {
    bad('the identity card is passed a photoUrl — PartnerUser has thirteen fields and none is an image');
  }
  // The decision was to leave Shreya out entirely rather than ship an inert card.
  if (/AssistantCard|ShreyaChatSheet|ShreyaLauncher|partnerChatbot/.test(home)) {
    bad('a Shreya surface appeared on the partner dashboard — /api/partner/shreya does not exist');
  }

  /* ── 5. THE GATE STILL PRECEDES EVERY FETCH ──────────────────────────────── */

  const gate = home.search(/<Redirect\b[^>]*pending-verification/);
  if (gate < 0) bad('the unverified-partner redirect is gone');
  // UNVERIFIED_PARTNER is granted nothing, so the figures must be behind the gate's own flag.
  if (!/if \(ok\)/.test(home)) {
    bad('the dashboard figures are not gated on verification — three guaranteed 403s for an unverified partner');
  }
  if (/Promise\.all\(/.test(home) || /Promise\.all\(/.test(service)) {
    bad('the fan-out is all-or-nothing — one refusal would cost every figure');
  }
  if (!/settleAll/.test(service)) bad('the figures are not fanned out through settleAll');

  /* ── 6. NOTHING LOST, AND THE NEW ROUTES RESOLVE ─────────────────────────── */

  if (!/menu\.map/.test(home)) bad('the tile grid is gone — every partner section would lose its entry point');
  if (!/partnerMenuFor\(/.test(home)) bad('the grid no longer varies by tier — a Master would lose Linked Partners');
  if (!/confirmLogout/.test(home)) bad('Log Out is gone from the partner dashboard');

  for (const name of ['change-password', 'search']) {
    if (!new RegExp(`name="${name}"`).test(src.layout)) {
      bad(`/partner/${name} is not registered as a Stack.Screen`);
    }
    if (!fs.existsSync(path.join(APP, 'app', 'partner', `${name}.js`))) {
      bad(`app/partner/${name}.js does not exist, but the layout registers it`);
    }
  }

  // Change Password posts to the endpoint that EXISTS, not the one that does not.
  const cp = codeOnly(src.changePassword);
  if (!/forgotPassword\('partner'/.test(cp)) {
    bad('the change-password screen does not use the forgot-password endpoint');
  }
  if (/partner\/change-password'|changePassword\(/.test(cp)) {
    bad('the screen posts to a partner change-password endpoint — no controller exposes one');
  }

  /* ── 7. SEARCH IS PER PARTNER ────────────────────────────────────────────── */

  const search = codeOnly(src.searchService);
  if (!/fingerprint/.test(search)) {
    bad("the partner search cache is not keyed to the session — it carries student names and revenue");
  }
  if (!/PARTNER_SEARCH_INDEX_KEY/.test(codeOnly(src.keys))) {
    bad('the partner search cache key is not in storageKeys — it would survive a logout');
  }
  if (!/partnerMenuFor/.test(search)) {
    bad('the search destinations are retyped rather than built from the menu — they would drift from the web labels');
  }
  if (/Promise\.all\(/.test(search)) bad('the partner search index uses Promise.all');

  /* ── 8. THE STRIP RENDERS ONLY WHAT IT IS GIVEN ──────────────────────────── */

  const strip = codeOnly(src.strip);
  if (/summary|monetization|lifetimeNet/.test(strip)) {
    bad('StatStrip reaches into the payload — it must render only the stats it is handed');
  }
  if (!/stat\.soon/.test(strip)) bad('StatStrip has no coming-soon branch');

  return out;
}

const MUTATIONS = [
  {
    name: 'THE UNDER-REPORT: pending payout counting only one of the two owed statuses',
    svc: (s) =>
      s.replace(
        'const owed = (Number(summary.pendingAmount) || 0) + (Number(summary.approvedAmount) || 0);',
        'const owed = Number(summary.pendingAmount) || 0;',
      ),
  },
  {
    name: 'THE OFF-BY-THREE: this month indexed by calendar month, not financial',
    svc: (s) => s.replace('const wanted = (now.getMonth() - 3 + 12) % 12;', 'const wanted = now.getMonth();'),
  },
  {
    name: 'a failed earnings call rendered as ₹0',
    svc: (s) => s.replace('  if (summary) {', '  if (true) { const summary = summaryOrZero(part(parts, "summary").data);'),
  },
  {
    name: 'rupees rendered with paise (overflows the tile)',
    svc: (s) => s.replace('formatRupees(v, { decimals: 0 })', 'formatRupees(v)'),
  },
  {
    name: 'subscription ROWS counted instead of distinct students (a renewal counts twice)',
    svc: (s) => s.replace('return ids.size;', 'return rows.length;'),
  },
  {
    name: 'Active/Pending Schools given an invented zero',
    svc: (s) =>
      s.replace(
        "{ key: 'active', label: strings.statActive || 'Active', soon: true },",
        "{ key: 'active', label: 'Active', value: '0' },",
      ),
  },
  {
    name: 'a failed monetization call reported as zero students',
    svc: (s) => s.replace('if (!Array.isArray(rows)) return null;', 'if (!Array.isArray(rows)) return 0;'),
  },
  {
    name: 'joinedOn guessing a date when termsAcceptedAt is absent',
    svc: (s) => s.replace('  if (!raw) return null;', '  if (!raw) return new Date(0).toLocaleDateString();'),
  },
  {
    name: 'the service reaching for a createdAt that does not exist',
    svc: (s) => s.replace('  const raw = profile?.termsAcceptedAt;', '  const raw = profile?.createdAt || profile?.termsAcceptedAt;'),
  },
  {
    name: 'partnerCodeOf inventing a code for an unassigned partner',
    svc: (s) => s.replace('  return typeof code === \'string\' && code.trim() ? code.trim() : null;', '  return code || "PRT00000";'),
  },
  {
    name: 'the dashboard calling the per-school roster endpoint for a count',
    svc: (s) =>
      s.replace(
        "    monetization: partnerApi.get('/api/partner/analytics/monetization'),",
        "    monetization: partnerApi.get('/api/partner/analytics/schools/${code}/students'),",
      ),
  },
  {
    name: 'a partner photo invented on the identity card',
    src: (k, s) => (k === 'home' ? s.replace('          name={profile?.fullName || partnerName}', '          name={profile?.fullName}\n          photoUrl={profile?.photo}') : s),
  },
  {
    name: 'a Shreya card added despite there being no partner backend',
    src: (k, s) => (k === 'home' ? s.replace('<SearchEntry', '<AssistantCard />\n        <SearchEntry') : s),
  },
  {
    name: 'THE 403 STORM: the figures fetched before the verification gate',
    src: (k, s) => (k === 'home' ? s.replace('if (ok) {', 'if (true) {') : s),
  },
  {
    name: 'the fan-out made all-or-nothing',
    svc: (s) => s.replace('partnerApi.settleAll({', 'Promise.all({'),
  },
  {
    name: 'the tile grid deleted with the redesign',
    src: (k, s) => (k === 'home' ? s.replace('menu.map', 'nothing.map') : s),
  },
  {
    name: 'the grid no longer varying by tier (a Master loses Linked Partners)',
    src: (k, s) => (k === 'home' ? s.replaceAll('partnerMenuFor(', 'fixedMenu(') : s),
  },
  {
    name: 'Log Out dropped from the dashboard',
    src: (k, s) => (k === 'home' ? s.replaceAll('confirmLogout', 'noLogout') : s),
  },
  {
    name: 'change password pointed at an endpoint no controller exposes',
    src: (k, s) =>
      k === 'changePassword' ? s.replace("forgotPassword('partner', email)", "changePassword({ email })") : s,
  },
  {
    name: 'the partner search cache shared between accounts',
    src: (k, s) => (k === 'searchService' ? s.replaceAll('fingerprint', 'constantKey') : s),
  },
  {
    name: 'the search destinations retyped instead of read from the menu',
    src: (k, s) => (k === 'searchService' ? s.replaceAll('partnerMenuFor', 'HARDCODED') : s),
  },
  {
    name: 'StatStrip reaching into the payload itself',
    src: (k, s) => (k === 'strip' ? s.replace('export default function StatStrip', 'const lifetimeNet = 1;\nexport default function StatStrip') : s),
  },
];

console.log('Self-tests (each mutation must be caught):');
for (const m of MUTATIONS) {
  let caught;
  try {
    const svc = await loadService(m.svc);
    // A `svc:` mutation is applied to the SERVICE SOURCE as well as to the module that gets
    // evaluated. Several assertions here are greps over that same file — "does it mention
    // createdAt", "does it call the roster endpoint", "does it use Promise.all" — and mutating only
    // the staged copy left three of them reading the pristine file and passing while testing
    // nothing. A replace that matches neither is a harmless no-op.
    const mutateSources = (k, s) => {
      let text = m.src ? m.src(k, s) : s;
      if (k === 'service' && m.svc) text = m.svc(text);
      return text;
    };
    caught = assertions(svc, loadSources(mutateSources)).length > 0;
  } catch {
    caught = true; // a mutation that will not even load is caught, loudly
  }
  if (caught) ok(m.name);
  else fail(`NOT CAUGHT: ${m.name} — the corresponding assertion is vacuous`);
}

console.log('\nPartner dashboard:');
{
  const svc = await loadService();
  const problems = assertions(svc, loadSources());
  if (problems.length === 0) {
    ok('revenue reads /earnings/summary, in whole rupees, with pending = pending + approved');
    ok('this month is picked out of the Apr→Mar financial-year buckets, not by calendar index');
    ok('students are counted DISTINCT from one call, not by downloading every roster');
    ok('Active/Pending Schools are coming soon — no status column exists to read');
    ok('a failed call is omitted, never drawn as zero');
    ok('no invented join date, no invented partner code, no partner photo, no Shreya');
    ok('the gate precedes every fetch, and the tier still varies the grid');
    ok('search is fingerprinted per partner and built from the menu the website pins');
  } else problems.forEach(fail);
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL — ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
