// Sender attribution on staff-triggered email.
//
//   node scripts/checksenderemail.mjs
//
// ══ WHY THIS EXISTS ════════════════════════════════════════════════════════
// The rule the whole feature rests on is a negative one: the recipient must never see anything
// personal about the member of staff who sent the mail, while the admin panel must always see the
// mail id they typed. Nothing about that is visible to a build — every way of breaking it produces
// a screen that renders and a request that succeeds:
//
//   · a service that drops `senderEmail` from its payload. The send still works; the admin panel
//     just quietly records nothing, which is the one thing this feature exists to do.
//   · a prompt that prefills the address from the session. The field looks right, the send is
//     recorded — but the typing was the point, so the attribution is no longer an act by a person.
//   · a field left uncleared between sends, so one colleague's address rides along into the next
//     send and is recorded against it.
//   · a prop the component does not take (`hint=` where it wants `helper=`). React silently drops
//     unknown props, so the note explaining what the field is for simply never appears. This repo
//     has shipped exactly that bug before, six times in one screen.
//   · a `doNotify` that reads a state variable with a slightly different name. That is a runtime
//     ReferenceError on a code path no bundler and no existing checker here reaches — so this
//     script parses the touched screens and resolves their identifiers itself.
//
// Exit code 0 = pass.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// @babel/parser, not acorn: acorn cannot parse JSX, and stripping the JSX first loses the
// very expressions ({onSubmit={doNotify}} and friends) this check exists to resolve.
const parse = createRequire(import.meta.url)('@babel/parser').parse;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const ROOT = path.resolve(APP, '..');

const failures = [];
const fail = (msg) => failures.push(msg);

const read = (rel, base = APP) => {
  const p = path.resolve(base, rel);
  if (!fs.existsSync(p)) {
    fail(`${rel}: file is missing`);
    return '';
  }
  return fs.readFileSync(p, 'utf8');
};

/** Asserts `needle` (string or RegExp) appears in `src`. */
const must = (rel, src, needle, why) => {
  const hit = needle instanceof RegExp ? needle.test(src) : src.includes(needle);
  if (!hit) fail(`${rel}: ${why}`);
};

/** Asserts `needle` does NOT appear — the negative half of the rule. */
const mustNot = (rel, src, needle, why) => {
  const hit = needle instanceof RegExp ? needle.test(src) : src.includes(needle);
  if (hit) fail(`${rel}: ${why}`);
};

// ── 1. The services all send the field ──────────────────────────────────────
// A service that quietly drops it leaves a working send with no attribution.

const services = [
  ['services/teacher/liveSessionService.js', 'notifyStudents', '/notify-students'],
  ['services/admin/meetingService.js', 'notifyAttendees', '/notify'],
];
for (const [rel, fn, route] of services) {
  const src = read(rel);
  must(rel, src, new RegExp(`export function ${fn}\\([^)]*senderEmail`),
    `${fn} must take senderEmail — without it the admin panel records nothing for ${route}`);
  must(rel, src, /\{ senderEmail \}/,
    `${fn} must put senderEmail in the request body, not just accept it as an argument`);
}

const queries = read('services/counsellor/queriesService.js');
must('services/counsellor/queriesService.js', queries, /senderEmail/,
  'sendMeetLink must document senderEmail — it rides in ...payload, so the doc is the only signal');

// ── 2. The sheet asks, validates, and forgets ───────────────────────────────

const sheet = read('components/ui/SenderEmailSheet.js');
must('components/ui/SenderEmailSheet.js', sheet, /export const isSenderEmail/,
  'the shared validator must be exported so every caller gates on the same rule');
must('components/ui/SenderEmailSheet.js', sheet, /submitDisabled=\{!isSenderEmail/,
  'Send must be disabled until the address is valid, not merely rejected by the server');
must('components/ui/SenderEmailSheet.js', sheet, /if \(visible\) setSenderEmail\(''\)/,
  "the field must clear when the sheet OPENS — FormSheet stays mounted, so one send's address "
  + 'would otherwise be recorded against the next');
mustNot('components/ui/SenderEmailSheet.js', sheet, /useState\((?!''\))[^)]+\)/,
  'the field must start empty: prefilling it from anywhere defeats the point of typing it');

const barrel = read('components/ui/index.js');
must('components/ui/index.js', barrel, /SenderEmailSheet, isSenderEmail/,
  'both the sheet and the validator must come out of the ui barrel');

// ── 3. The screens prompt before they send ──────────────────────────────────

const screens = [
  ['components/staff/LiveClassesScreen.js', 'notifySession', 'doNotify', 'notifyStudents'],
  ['components/staff/admin/StaffMeetingScreen.js', 'notifyMeeting', 'doNotify', 'notifyAttendees'],
];
for (const [rel, stateName, sender, call] of screens) {
  const src = read(rel);
  must(rel, src, '<SenderEmailSheet', 'the screen must mount the prompt');
  must(rel, src, new RegExp(`const \\[${stateName}, set`), `${stateName} state must exist`);
  must(rel, src, new RegExp(`const notify = \\(\\w+\\) => set`),
    'notify must only OPEN the prompt — if it still sends directly the prompt is decoration');
  must(rel, src, new RegExp(`const ${sender} = async \\(senderEmail\\)`),
    `${sender} must take the typed address`);
  must(rel, src, new RegExp(`${call}\\([^)]*senderEmail`),
    `${call} must be called WITH the typed address`);
}

const queriesScreen = read('components/staff/QueriesScreen.js');
must('components/staff/QueriesScreen.js', queriesScreen, /submitDisabled=\{!isSenderEmail\(meetForm\?\.senderEmail\)\}/,
  'the meet sheet must refuse to send without a valid address');
must('components/staff/QueriesScreen.js', queriesScreen, /senderEmail: meetForm\.senderEmail\.trim\(\)/,
  'the meet payload must carry the typed address');
must('components/staff/QueriesScreen.js', queriesScreen, /senderEmail: ''/,
  'openMeet must reset senderEmail to empty, so it is typed for every query');
// FormField takes `helper` (a node) and `required`; an unknown `hint=` renders nothing at all.
mustNot('components/staff/QueriesScreen.js', queriesScreen, /hint="Recorded against/,
  'FormField has no `hint` prop — React drops it silently and the explanation never renders. '
  + 'Use `helper={<Text>…</Text>}`');
must('components/staff/QueriesScreen.js', queriesScreen, /helper=\{/,
  'the explanation under the field must go through the `helper` slot FormField actually reads');

// Whatever props the sheet and the screens pass, FormField/FormSheet must accept.
const formField = read('components/auth/FormField.js');
for (const prop of ['helper', 'required']) {
  must('components/auth/FormField.js', formField, new RegExp(`\\b${prop},`),
    `FormField must still accept \`${prop}\` — QueriesScreen passes it`);
}
const formSheet = read('components/ui/FormSheet.js');
must('components/ui/FormSheet.js', formSheet, /submitDisabled/,
  'FormSheet must still accept `submitDisabled` — the sender sheet gates Send with it');

// ── 4. The backend rule: company address only, on the wire ──────────────────

const BE = 'backendmain/src/main/java/com/shreyartha/backend';
const staffMail = read(`${BE}/infrastructure/email/StaffMailService.java`, ROOT);
must('StaffMailService.java', staffMail, /return SenderIdentity\.isEmail\(mailbox\) \? List\.of\(mailbox\) : List\.of\(\);/,
  'Reply-To must be the company mailbox ALONE — adding the sender puts a person in front of the client');
must('StaffMailService.java', staffMail, /out\.add\(sender\.declaredEmail\(\)\.toLowerCase/,
  'the typed address must be BCC\'d, so the sender keeps a copy the recipient cannot see');

const invoiceMail = read(`${BE}/sales/invoice/service/InvoiceMailService.java`, ROOT);
must('InvoiceMailService.java', invoiceMail, /SenderIdentity\.require\(body,/,
  'the invoice send must REQUIRE the typed address — this is the billing-tracking path');
must('InvoiceMailService.java', invoiceMail, /row\.setSenderEmail\(sender\.declaredEmail\(\)\)/,
  'the typed address must be stored on the invoice email row the admin panel reads');
mustNot('InvoiceMailService.java', invoiceMail, /t\.put\("senderEmail", nz\(actor\.email\(\)\)\)/,
  'the {{senderEmail}} token must NOT resolve to the sender — the client reads the body');

const migration = read('backendmain/src/main/resources/db/migration/V100__staff_outbound_email.sql', ROOT);
must('V99', migration, /ADD COLUMN sender_email VARCHAR\(180\)/,
  'sales_invoice_emails.sender_email must be added, or every row records a blank');
must('V99', migration, /CREATE TABLE IF NOT EXISTS staff_outbound_emails/,
  'the org-wide outbound log must be created');

// ── 5. Identifiers in the touched screens actually resolve ──────────────────
// A mis-typed state name is a runtime ReferenceError on a path no bundler reaches. Collect every
// declared binding in the file (any scope — deliberately generous, so this reports only names that
// exist nowhere) and check each plain identifier reference against it.

const GLOBALS = new Set([
  'globalThis', 'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Promise',
  'Object', 'Array', 'String', 'Number', 'Boolean', 'Math', 'JSON', 'Date', 'Map', 'Set', 'Error',
  'RegExp', 'undefined', 'NaN', 'Infinity', 'require', 'module', 'process', 'fetch', 'URL',
  'encodeURIComponent', 'decodeURIComponent', 'isNaN', 'parseInt', 'parseFloat', 'AbortController',
  'FormData', 'Intl', 'TextEncoder', 'TextDecoder', 'Blob', 'arguments',
]);

const declared = (ast) => {
  const names = new Set();
  const addPattern = (node) => {
    if (!node) return;
    switch (node.type) {
      case 'Identifier': names.add(node.name); break;
      case 'ObjectPattern': node.properties.forEach((p) =>
        addPattern(p.type === 'RestElement' || p.type === 'RestProperty' ? p.argument : p.value)); break;
      case 'ArrayPattern': node.elements.forEach(addPattern); break;
      case 'AssignmentPattern': addPattern(node.left); break;
      case 'RestElement': addPattern(node.argument); break;
      default: break;
    }
  };
  const walk = (node) => {
    if (!node || typeof node.type !== 'string') return;
    switch (node.type) {
      case 'VariableDeclarator': addPattern(node.id); break;
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        if (node.id) names.add(node.id.name);
        node.params.forEach(addPattern);
        break;
      case 'ClassDeclaration': if (node.id) names.add(node.id.name); break;
      case 'ImportDefaultSpecifier':
      case 'ImportNamespaceSpecifier':
      case 'ImportSpecifier': names.add(node.local.name); break;
      case 'CatchClause': addPattern(node.param); break;
      case 'LabeledStatement': names.add(node.label.name); break;
      default: break;
    }
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (Array.isArray(child)) child.forEach((c) => c && typeof c.type === 'string' && walk(c));
      else if (child && typeof child.type === 'string') walk(child);
    }
  };
  walk(ast);
  return names;
};

const referenced = (ast) => {
  const names = new Set();
  const walk = (node, parent, key) => {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'Identifier') {
      // Babel calls these ObjectProperty / ObjectMethod, not ESTree's Property — reading the wrong
      // name here turns every style key in the file into a phantom "undeclared identifier".
      const isMemberProperty = (parent?.type === 'MemberExpression'
        || parent?.type === 'OptionalMemberExpression') && key === 'property' && !parent.computed;
      const isPropertyKey = (parent?.type === 'ObjectProperty' || parent?.type === 'ObjectMethod'
        || parent?.type === 'ClassProperty' || parent?.type === 'ClassMethod')
        && key === 'key' && !parent.computed;
      const isJsxName = parent?.type === 'JSXAttribute' && key === 'name';
      if (!isMemberProperty && !isPropertyKey && !isJsxName) names.add(node.name);
    }
    for (const k of Object.keys(node)) {
      const child = node[k];
      if (Array.isArray(child)) child.forEach((c) => c && typeof c.type === 'string' && walk(c, node, k));
      else if (child && typeof child.type === 'string') walk(child, node, k);
    }
  };
  walk(ast, null, null);
  return names;
};

for (const [rel] of screens) {
  const src = read(rel);
  let ast;
  try {
    ast = parse(src, { sourceType: 'module', plugins: ['jsx'], errorRecovery: false });
  } catch (e) {
    fail(`${rel}: could not be parsed for the scope check (${e.message})`);
    continue;
  }
  const have = declared(ast);
  for (const name of referenced(ast)) {
    if (!have.has(name) && !GLOBALS.has(name) && !/^[A-Z][A-Z0-9_]*$/.test(name)) {
      fail(`${rel}: \`${name}\` is referenced but declared nowhere in the file — a ReferenceError at runtime`);
    }
  }
}

// ── Report ──────────────────────────────────────────────────────────────────

if (failures.length) {
  console.error(`\n${failures.length} problem(s):\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error('');
  process.exit(1);
}
console.log('--- clean ---');
