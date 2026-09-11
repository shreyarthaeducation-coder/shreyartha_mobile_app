// The staff notification feed — backend, mobile service, bell and inbox screen.
//
//   node scripts/checknotifications.mjs
//
// ══ WHY THIS CHECKER EXISTS ════════════════════════════════════════════════
// The feed spans four things that can drift apart independently and all fail quietly:
//
//   1. THE ROLE GUARD. `StaffNotificationController`'s @PreAuthorize is copied verbatim from
//      `StaffHrController`, which is the canonical "every staff member" list. Re-deriving it by
//      hand is how a role gets left out of a surface it should reach — and `SHREYARTHA_SALES` is
//      the one that would go first, because its role has no `.implies()` at all and inherits
//      nothing. A missing role is a 403 on a bell, which reads as "no notifications".
//
//   2. THE PATH PREFIX. `/api/staff/` is what makes the WEBSITE's apiService attach a staff token.
//      Moving these URLs breaks one client and not the other, silently.
//
//   3. `link` IS A MENU KEY, NOT A PATH. The panel segment differs per recipient, so one stored
//      string cannot serve everyone a notification is sent to. A producer that starts storing
//      "/staff/sales/deals" would resolve to null on every panel and every row would go dead.
//
//   4. THE PRODUCERS. A feed with no writers is an empty screen that looks like it works. Each
//      producer is one line in somebody else's service and deleting it breaks nothing that
//      compiles or renders.
//
// Exit code 0 = pass.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const BACKEND = path.resolve(APP, '../backendmain/src/main/java/com/shreyartha/backend');
const MIGRATIONS = path.resolve(APP, '../backendmain/src/main/resources/db/migration');

let failures = 0;
const fail = (m) => { failures += 1; console.error(`  ✗ ${m}`); };

const readAbs = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const read = (p) => readAbs(path.join(APP, p));

/**
 * Comment-stripped, so a rule can never be satisfied by the prose that explains it.
 *
 * Four assertions in this repo have previously passed by matching a docblock rather than code —
 * every file here documents its own rules at length, so this is not optional.
 */
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const SRC = {
  service: 'services/staff/notificationService.js',
  screen: 'components/staff/StaffNotificationsScreen.js',
  route: 'app/staff/[role]/notifications.js',
  brandBar: 'components/shared/home/BrandBar.js',
  home: 'components/staff/home/StaffHomeScreen.js',
  layout: 'app/staff/[role]/_layout.js',
};

const JAVA = {
  controller: 'staffnotification/controller/StaffNotificationController.java',
  service: 'staffnotification/service/StaffNotificationService.java',
  model: 'staffnotification/model/StaffNotification.java',
  repo: 'staffnotification/repository/StaffNotificationRepository.java',
  hrController: 'hr/controller/StaffHrController.java',
  leaveNotifier: 'hr/service/HrLeaveNotifier.java',
  adminSales: 'sales/service/AdminSalesService.java',
  meetings: 'school/meeting/StaffMeetingService.java',
};

/** The nine roles the platform treats as "every staff member". */
const STAFF_ROLES = [
  'TEACHER', 'COUNSELOR', 'PRINCIPAL', 'VICE_PRINCIPAL', 'SCHOOL_ADMIN',
  'SHREYARTHA_TEACHER', 'SHREYARTHA_COUNCELLOR', 'SHREYARTHA_ADMIN', 'SHREYARTHA_SALES',
];

function assertions(src, java) {
  const out = [];
  const bad = (m) => out.push(m);

  // ── 1. The guard, compared to StaffHrController's rather than to a literal ──
  //
  // Compared to the OTHER FILE, not to a list written here: a hardcoded list in a checker is just
  // a second copy free to drift from both. Extracting the role names from each @PreAuthorize and
  // comparing the SETS is what makes this assertion track the canonical one.
  const roleSet = (text) => {
    const at = text.indexOf('@PreAuthorize');
    if (at < 0) return null;
    // Bounded window: a class-level annotation is followed by the class declaration, and a lazy
    // match would run on into the first method's own guard.
    const window = text.slice(at, at + 400);
    return new Set([...window.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]));
  };

  const hrRoles = roleSet(java.hrController);
  const notifRoles = roleSet(java.controller);
  if (!hrRoles) bad('StaffHrController has no @PreAuthorize — the reference guard is gone');
  if (!notifRoles) bad('StaffNotificationController has no @PreAuthorize — the inbox is open to any authenticated user');
  if (hrRoles && notifRoles) {
    for (const role of STAFF_ROLES) {
      if (!hrRoles.has(role)) bad(`StaffHrController's guard no longer names ${role} — this checker's reference list is stale`);
      if (!notifRoles.has(role)) bad(`StaffNotificationController does not admit ${role} — that role's bell would 403 and read as "no notifications"`);
    }
    for (const role of notifRoles) {
      if (!hrRoles.has(role)) bad(`StaffNotificationController admits ${role}, which StaffHrController does not — the guard was re-derived rather than copied`);
    }
  }

  // ── 2. The path prefix, on both sides ──────────────────────────────────────
  if (!/@RequestMapping\("\/api\/staff\/notifications"\)/.test(java.controller)) {
    bad('StaffNotificationController is not mapped under /api/staff/ — the website would attach the wrong token');
  }
  const serviceCode = codeOnly(src.service);
  const base = /const BASE = '([^']+)'/.exec(serviceCode)?.[1];
  if (base !== '/api/staff/notifications') {
    bad(`the mobile service's BASE is "${base}", not /api/staff/notifications`);
  }
  for (const suffix of ['/unread-count', '/read-all']) {
    if (!serviceCode.includes(suffix)) bad(`the mobile service never calls ${suffix}`);
    if (!java.controller.includes(suffix)) bad(`the controller has no ${suffix} mapping`);
  }

  // ── 3. Reads and writes are scoped to the caller ───────────────────────────
  //
  // There must be no way to name a recipient. `findByIdAndSchoolUserId` is the shape that makes
  // "mark someone else's notification read" impossible — a findById followed by an ownership check
  // is the same thing written so that forgetting the check compiles.
  if (!/findByIdAndSchoolUserId/.test(java.repo)) {
    bad('the repository has no findByIdAndSchoolUserId — one notification would be fetched by id alone');
  }
  if (!/findByIdAndSchoolUserId/.test(java.service)) {
    bad('StaffNotificationService.markRead does not fetch by id AND owner');
  }
  if (/@RequestParam[^)]*(schoolUserId|userId|recipient)/.test(java.controller)) {
    bad('the controller takes a recipient parameter — one staff member could read another\'s inbox');
  }
  if (!/n\.schoolUserId = :userId/.test(java.repo)) {
    bad('markAllRead does not scope by owner — it would clear every staff member\'s inbox');
  }

  // ── 4. `link` is a menu key, resolved per role ─────────────────────────────
  //
  // The producers must never store a path. A stored "/staff/sales/deals" resolves to null on every
  // panel, because resolveNotificationRoute looks the string up as a MENU KEY.
  if (!/resolveNotificationRoute/.test(codeOnly(src.screen))) {
    bad('the inbox screen does not resolve links through resolveNotificationRoute');
  }
  if (!/\.find\(\(entry\) => entry\.key === link\)/.test(serviceCode)) {
    bad('resolveNotificationRoute no longer looks the link up as a menu key');
  }
  for (const [name, text] of [['HrLeaveNotifier', java.leaveNotifier], ['AdminSalesService', java.adminSales], ['StaffMeetingService', java.meetings]]) {
    // Every `push`/`pushToId` call's last argument, when it is a string literal, must not look
    // like a path.
    for (const m of text.matchAll(/staffNotificationService\.push(?:ToId)?\(([\s\S]{0,600}?)\);/g)) {
      if (/"\/[a-z]/.test(m[1])) {
        bad(`${name} passes a PATH as a notification link — it must be a menu key, resolved per role`);
      }
    }
  }

  // ── 5. The producers ───────────────────────────────────────────────────────
  //
  // A feed with no writers is an empty screen that looks like it works.
  const producers = [
    ['HrLeaveNotifier', java.leaveNotifier, 2],   // approvers on a new request, applicant on a decision
    ['AdminSalesService', java.adminSales, 5],    // approve, reject, collect, incentive, verify
    ['StaffMeetingService', java.meetings, 1],
  ];
  for (const [name, text, min] of producers) {
    const calls = (codeOnly(text).match(/staffNotificationService\.push(?:ToId)?\(/g) || []).length;
    if (calls < min) bad(`${name} writes ${calls} notification(s), expected at least ${min}`);
  }

  // A push must never be able to fail the transaction it rides on.
  if (!/catch \(Exception e\)/.test(java.service)) {
    bad('StaffNotificationService.push does not swallow its own failure — a notification could roll back a leave decision');
  }

  // ── 6. The bell ────────────────────────────────────────────────────────────
  const brandBar = codeOnly(src.brandBar);
  if (!/bell = null/.test(brandBar)) {
    bad('BrandBar\'s bell is not opt-in — all six staff dashboards would gain one at once');
  }
  // ANCHORED ON THE BADGE, not on the bare comparison. `bell.count > 0` appears TWICE — once in
  // the accessibility label and once here — so a plain presence test passed with the badge made
  // unconditional, which is the whole thing this assertion is for.
  if (!/bell\.count > 0 \? \([\s\S]{0,120}?styles\.badge/.test(brandBar)) {
    bad('BrandBar renders the badge unconditionally — a count of 0 would show a "0" badge');
  }
  const home = codeOnly(src.home);
  if (!/bell=\{wantsBell \?/.test(home)) {
    bad('StaffHomeScreen passes a bell to every panel rather than only the redesigned two');
  }
  if (!/notifications`/.test(home)) bad('the bell does not open the notifications route');
  if (!fs.existsSync(path.join(APP, SRC.route))) bad('app/staff/[role]/notifications.js does not exist');
  if (!/Stack\.Screen name="notifications"/.test(read(SRC.layout))) {
    bad('the notifications route is not registered in the staff layout — it would render Unmatched');
  }
  // The route file must not import through the components barrel: expo-router scans every route
  // file, so a barrel import there is an app-wide import. That trap once boot-crashed the app.
  if (/from '\.\.\/\.\.\/\.\.\/components\/staff'/.test(read(SRC.route))) {
    bad('the notifications route imports through the components/staff barrel');
  }

  // ── 7. The unread count never throws ───────────────────────────────────────
  //
  // A bell is decoration on a dashboard the user opened to do something else. A role the guard
  // does not admit, or a server that is down, must not surface an error there.
  const unreadFn = /export async function fetchUnreadCount\(\)[\s\S]*?\n\}/.exec(serviceCode)?.[0] || '';
  if (!unreadFn) bad('fetchUnreadCount is missing');
  else if (!/catch\s*\{[\s\S]*?return 0;/.test(unreadFn)) {
    bad('fetchUnreadCount can throw — a 403 would surface as an error on the dashboard');
  }

  // ── 8. The migration ───────────────────────────────────────────────────────
  const migration = src.migration;
  if (!migration) bad('no staff_notifications migration');
  else {
    // `--` COMMENTS STRIPPED FIRST, and this is not belt-and-braces: the migration's own header
    // explains why it declares its indexes inside the CREATE TABLE "rather than as separate
    // CREATE INDEX statements", so the bare-CREATE-INDEX assertion below matched the prose
    // describing the rule and reported correct SQL as broken. Same class of failure as the four
    // JS assertions in this repo that passed by matching a docblock.
    const sql = migration.replace(/^\s*--.*$/gm, '');
    if (!/CREATE TABLE IF NOT EXISTS staff_notifications/i.test(sql)) {
      bad('the migration is not idempotent — re-running it would abort startup on any DB that already has the table');
    }
    // Both indexes must be inside the CREATE TABLE, or IF NOT EXISTS does not cover them.
    if (/CREATE INDEX/i.test(sql)) {
      bad('the migration uses a bare CREATE INDEX — that is the exact non-idempotent statement V64 and V65 had to be retrofitted for');
    }
    if (!/school_user_id, read_at/.test(sql)) {
      bad('the unread-count index is missing — that query runs on every staff dashboard load');
    }
  }

  return out;
}

/** The migration filename, resolved once — its version number is free to change. */
const MIGRATION_FILE = fs.readdirSync(MIGRATIONS).find((f) => /staff_notifications/.test(f)) || '';

function load(mutate) {
  const src = {};
  for (const [k, rel] of Object.entries(SRC)) {
    let s;
    try { s = read(rel); } catch { s = ''; }
    src[k] = mutate ? mutate(rel, s) : s;
  }
  // Loaded through the same path so the migration's assertions are mutatable too — without this
  // they would be the only ones in the file that no self-test proves.
  let sql = '';
  try { sql = readAbs(path.join(MIGRATIONS, MIGRATION_FILE)); } catch { sql = ''; }
  src.migration = mutate ? mutate(MIGRATION_FILE, sql) : sql;
  const java = {};
  for (const [k, rel] of Object.entries(JAVA)) {
    let s;
    try { s = readAbs(path.join(BACKEND, rel)); } catch { s = ''; }
    java[k] = mutate ? mutate(rel, s) : s;
  }
  return { src, java };
}

/**
 * Each must be CAUGHT. A mutation that applies cleanly and is not caught means the assertion it
 * targets is vacuous — which is how four assertions in this repo shipped testing nothing.
 *
 * Every mutation asserts it actually changed the file, because a `.replace` whose anchor has since
 * been reworded is a silent no-op that then "passes".
 */
const MUTATIONS = [
  {
    name: 'the inbox drops SHREYARTHA_SALES from its guard',
    mutate: (f, s) => (f === JAVA.controller ? s.replace(",'SHREYARTHA_SALES'", '') : s),
  },
  {
    name: 'the inbox moves off /api/staff/',
    mutate: (f, s) => (f === JAVA.controller
      ? s.replace('"/api/staff/notifications"', '"/api/notifications"') : s),
  },
  {
    name: 'the mobile service moves off /api/staff/',
    mutate: (f, s) => (f === SRC.service
      ? s.replace("const BASE = '/api/staff/notifications'", "const BASE = '/api/notifications'") : s),
  },
  {
    name: 'markAllRead stops scoping by owner',
    mutate: (f, s) => (f === JAVA.repo
      ? s.replace('WHERE n.schoolUserId = :userId AND n.readAt IS NULL', 'WHERE n.readAt IS NULL') : s),
  },
  {
    name: 'one notification is fetched by id alone',
    mutate: (f, s) => (f === JAVA.service
      ? s.replace('findByIdAndSchoolUserId(id, user.getId())', 'findById(id)') : s),
  },
  {
    name: 'a producer stores a path instead of a menu key',
    mutate: (f, s) => (f === JAVA.adminSales ? s.replace('"deals");', '"/staff/sales/deals");') : s),
  },
  {
    name: 'the leave producer is removed',
    mutate: (f, s) => (f === JAVA.leaveNotifier
      ? s.replace(/staffNotificationService\.push\([\s\S]*?"leave"\);/, '') : s),
  },
  {
    name: 'the meeting producer is removed',
    mutate: (f, s) => (f === JAVA.meetings
      ? s.replace(/staffNotificationService\.push\([^;]*;/, '') : s),
  },
  {
    name: 'a push is allowed to fail its transaction',
    mutate: (f, s) => (f === JAVA.service ? s.replace(/catch \(Exception e\)/g, 'catch (RuntimeException_UNUSED e)') : s),
  },
  {
    name: 'the bell becomes mandatory for every staff panel',
    mutate: (f, s) => (f === SRC.brandBar ? s.replace('bell = null', 'bell = { count: 0 }') : s),
  },
  {
    name: 'the badge renders on a count of zero',
    // Anchored past the accessibility label's own `bell.count > 0 ?`, which a non-global
    // `.replace` would otherwise take instead — leaving the badge conditional intact.
    mutate: (f, s) => (f === SRC.brandBar
      ? s.replace('{bell.count > 0 ? (\n                <View style={styles.badge}>', '{true ? (\n                <View style={styles.badge}>')
      : s),
  },
  {
    name: 'the unread count is allowed to throw',
    mutate: (f, s) => (f === SRC.service
      ? s.replace(/  } catch \{\n    return 0;\n  \}/, '  } finally {\n    void 0;\n  }') : s),
  },
  {
    name: 'the inbox stops resolving links against the role menu',
    mutate: (f, s) => (f === SRC.service
      ? s.replace('.find((entry) => entry.key === link)', '.find(() => false)') : s),
  },
  {
    // The migration loses IF NOT EXISTS: it then aborts startup on any database that already has
    // the table, leaving a success=0 row that blocks EVERY subsequent boot until it is deleted by
    // hand. That has happened twice in this repo after a renumber.
    name: 'the migration stops being idempotent',
    mutate: (f, s) => (f === MIGRATION_FILE
      ? s.replace('CREATE TABLE IF NOT EXISTS staff_notifications', 'CREATE TABLE staff_notifications') : s),
  },
  {
    // The indexes moved out of the CREATE TABLE into bare statements, which IF NOT EXISTS does not
    // cover — the exact shape V64 and V65 had to be retrofitted with information_schema guards.
    name: 'the migration grows a bare CREATE INDEX',
    mutate: (f, s) => (f === MIGRATION_FILE
      ? s.replace(
          '    KEY idx_staff_notif_user_read    (school_user_id, read_at),\n',
          '',
        ) + '\nCREATE INDEX idx_staff_notif_user_read ON staff_notifications (school_user_id, read_at);\n'
      : s),
  },
];

async function main() {
  const { src, java } = load(null);

  console.log('Self-tests (each mutation must be caught):');
  let vacuous = 0;
  for (const m of MUTATIONS) {
    const staged = load(m.mutate);
    // A mutation that changed nothing is a silent no-op that would then "pass".
    const changed = Object.entries(staged.src).some(([k, v]) => v !== src[k])
      || Object.entries(staged.java).some(([k, v]) => v !== java[k]);
    if (!changed) {
      console.error(`  ✗ INERT: ${m.name} — its anchor no longer matches the source`);
      vacuous += 1;
      continue;
    }
    const found = assertions(staged.src, staged.java);
    if (found.length === 0) {
      console.error(`  ✗ NOT CAUGHT: ${m.name} — the corresponding assertion is vacuous`);
      vacuous += 1;
    } else {
      console.log(`  ✓ ${m.name}`);
    }
  }

  console.log('\nStaff notification feed:');
  const found = assertions(src, java);
  found.forEach(fail);
  if (!found.length) {
    console.log('  ✓ the guard matches StaffHrController role for role');
    console.log('  ✓ both clients stay under /api/staff/, and every read scopes to the caller');
    console.log('  ✓ links are menu keys, resolved per role; every producer is in place');
    console.log('  ✓ the bell is opt-in, badge-free at zero, and can never throw');
  }

  const total = failures + vacuous;
  console.log(total === 0
    ? `\nPASS — ${MUTATIONS.length} assertions, each proven to fail on a broken input.`
    : `\nFAILED: ${failures} baseline, ${vacuous} vacuous mutation(s).`);
  process.exit(total === 0 ? 0 : 1);
}

main();
