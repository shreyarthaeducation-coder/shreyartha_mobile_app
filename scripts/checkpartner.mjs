// Partner panel port checker.
//
//   node scripts/checkpartner.mjs
//
// WHY THIS EXISTS. Q0 is a shell: a menu, a gate and a signup, all of which fail SILENTLY when they
// are wrong. A tile pointing at a route with no file is an expo-router unmatched route, not a
// crash. A menu that has drifted from the web sidebar still renders. A verification gate that
// defaults the wrong way still shows a screen — just the wrong one. `expo export` and
// `checkscope.js` see an unbound NAME, never a missing FILE, a wrong ORDER or a bad DEFAULT.
//
// Everything that can be CALLED is called rather than grepped, because the bugs this port is most
// likely to reintroduce are value bugs: `partnerType || "NORMAL"` demoting a Master on a network
// blip, and a logout list whose key spelling does not match what login writes.
//
// Exit code 0 = pass.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const WEB = path.resolve(APP, '..', 'frontendmain');
const ROUTES = path.join(APP, 'app', 'partner');

/** Files this checker reads as text (not evaluated). */
const SRC = {
  authService: 'services/authService.js',
  partnerLogin: 'app/auth/partner-login.js',
  menuScreen: 'components/partner/PartnerMenuScreen.js',
  pendingScreen: 'components/partner/PartnerPendingScreen.js',
  termsSheet: 'components/partner/PartnerTermsSheet.js',
  featureScreen: 'components/partner/PartnerFeatureScreen.js',
  layout: 'app/partner/_layout.js',
  dashboardShim: 'app/dashboard/partner.js',
  profileService: 'services/partner/profileService.js',
};

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`  ✗ ${msg}`);
};
const ok = (msg) => console.log(`  ✓ ${msg}`);

// Mixed line endings live in this repo; normalise so source assertions cannot fail on that alone.
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

/**
 * Code with comments removed.
 *
 * Every source assertion must run through this. Four assertions in the parent port fired on
 * CORRECT code because a file's own docblock named the thing it was explaining it does not use.
 * This checker has the same exposure twice over: constants/partnerTerms.js documents the paused
 * "Master Partner" clause it deliberately omits, and constants/partnerMenu.js documents the
 * "User Access" tile it deliberately omits.
 */
const codeOnly = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Stage an import-free constants module as .mjs so it can be evaluated, not grepped. */
async function loadModule(rel, mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'partner-'));
  let src = read(path.join(APP, rel));
  if (mutate) src = mutate(src);
  const file = path.join(dir, `${path.basename(rel, '.js')}.mjs`);
  fs.writeFileSync(file, src);
  return import(`${pathToFileURL(file).href}?t=${Math.random()}`);
}

const loadMenu = (mutate) => loadModule('constants/partnerMenu.js', mutate);
const loadTerms = (mutate) => loadModule('constants/partnerTerms.js', mutate);
const loadKeys = (mutate) => loadModule('constants/storageKeys.js', mutate);

/** The profile service is pure but sits beside `partnerApi` calls, so the transport is stubbed. */
async function loadProfileService(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'partnerprof-'));
  fs.writeFileSync(
    path.join(dir, 'stub.mjs'),
    'export const partnerApi = { get: async () => ({}) };\nexport default partnerApi;\n',
  );
  let src = read(path.join(APP, 'services', 'partner', 'profileService.js'));
  if (mutate) src = mutate(src);
  src = src.replace("from '../partnerApi'", "from './stub.mjs'");
  fs.writeFileSync(path.join(dir, 'profileService.mjs'), src);
  return import(`${pathToFileURL(path.join(dir, 'profileService.mjs')).href}?t=${Math.random()}`);
}

/** The web sidebar is the source of truth for the item set — extracted, never retyped. */
function webSidebarItems() {
  const src = read(path.join(WEB, 'src', 'Partner', 'platform', 'PartnerLayout.js'));
  // The UPGRADE_ITEM block is commented out on the web; codeOnly drops it, which is correct —
  // reviving it here means reviving it on the website first.
  const code = codeOnly(src);
  // Stop at the array's own closing bracket. MASTER_ITEM is declared right after it, so slicing to
  // `export default` swallows it and the base list silently gains a tile.
  const from = code.indexOf('const BASE_SIDEBAR_ITEMS');
  const base = code.slice(from, code.indexOf('];', from));
  const items = [];
  for (const m of base.matchAll(/key:\s*"([^"]+)",\s*label:\s*"([^"]+)"/g)) {
    items.push({ key: m[1], label: m[2] });
  }

  const masterFrom = code.indexOf('const MASTER_ITEM');
  const masterBlock = code.slice(masterFrom, code.indexOf('};', masterFrom));
  const master = {
    key: masterBlock.match(/key:\s*"([^"]+)"/)?.[1],
    label: masterBlock.match(/label:\s*"([^"]+)"/)?.[1],
  };

  return { items, master };
}

/** Every partner page the website's own router serves, as a full path. */
function webRoutePaths() {
  const src = read(path.join(WEB, 'src', 'App.js'));
  const block = src.slice(src.indexOf('<RequirePartnerAuth>'), src.indexOf('</RequirePartnerAuth>'));
  const paths = new Set(['/partner/platform/dashboard']);
  for (const m of block.matchAll(/<Route path="([^"]+)" element=\{<Partner/g)) {
    paths.add(`/partner/platform/dashboard/${m[1]}`);
  }
  return paths;
}

/** Every screen that actually exists under app/partner/, by route name. */
function routeNames() {
  return new Set(
    fs
      .readdirSync(ROUTES)
      .filter((f) => f.endsWith('.js') && f !== '_layout.js')
      .map((f) => f.replace(/\.js$/, '')),
  );
}

/**
 * The T&C as one normalised string, straight from the web JSX.
 *
 * Deliberately a DIFFERENT code path from the structured extractor that produced
 * constants/partnerTerms.js: this one strips every tag and collapses whitespace in one pass, so a
 * structural mistake in the extractor cannot hide behind its own logic.
 */
function webTermsText() {
  const raw = read(path.join(WEB, 'src', 'Partner', 'PartnerTermsContent.js'));
  const version = raw.match(/TERMS_VERSION = "([^"]+)"/)[1];
  const body = raw
    .slice(raw.indexOf('<div className="partner-terms-content">'), raw.lastIndexOf('</div>'))
    // JSX comments carry the PAUSED Master Partner clause. It must stay out of both sides.
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/Version \{TERMS_VERSION\}/, `Version ${version}`)
    .replace(/<[^>]+>/g, ' ');
  return {
    version,
    text: body
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ')
      .replace(/&mdash;/g, '—')
      .replace(/\s+/g, ' ')
      .trim(),
  };
}

/** The same string rebuilt from the shipped data module. */
function shippedTermsText(terms) {
  return [
    terms.TERMS_TITLE,
    `Version ${terms.TERMS_VERSION}`,
    ...terms.PARTNER_TERMS.flatMap((s) => [
      s.heading,
      ...s.blocks.flatMap((b) =>
        b.type === 'p' ? [b.text] : b.items.map((i) => (i.lead ? `${i.lead} ${i.text}` : i.text)),
      ),
    ]),
  ]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadSources(mutate) {
  const out = {};
  for (const [key, rel] of Object.entries(SRC)) {
    out[key] = mutate ? mutate(key, read(path.join(APP, rel))) : read(path.join(APP, rel));
  }
  return out;
}

function assertions(menu, terms, keys, profileSvc, src) {
  const out = [];
  const bad = (m) => out.push(m);
  const { PARTNER_MENU, PARTNER_MASTER_MENU, ALL_PARTNER_TILES, partnerMenuFor, partnerWebPath } =
    menu;

  // ── 1. the menu still mirrors the web sidebar, minus the one omitted tile ──
  const { items: web, master: webMaster } = webSidebarItems();
  if (web.length !== 7) bad(`web sidebar extractor found ${web.length} base items, expected 7`);

  // "user-access" is deliberately absent: it is 215 lines of hardcoded demo logins with plaintext
  // passwords, and an app bundle ships those to every device rather than serving them on request.
  const expected = web.filter((i) => i.key !== 'user-access');
  const gotKeys = PARTNER_MENU.map((i) => i.key).join(',');
  const wantKeys = expected.map((i) => i.key).join(',');
  if (gotKeys !== wantKeys) {
    bad(`menu keys drifted from the web sidebar\n      got:  ${gotKeys}\n      want: ${wantKeys}`);
  }
  for (const item of PARTNER_MENU) {
    const match = expected.find((i) => i.key === item.key);
    if (match && match.label !== item.label) {
      bad(`tile "${item.key}" is labelled "${item.label}", the web says "${match.label}"`);
    }
  }
  if (PARTNER_MENU.some((i) => i.key === 'user-access')) {
    bad('the User Access tile is back — it embeds plaintext demo credentials in the app bundle');
  }

  // ── 2. the master tile ────────────────────────────────────────────────────
  if (PARTNER_MASTER_MENU.length !== 1 || PARTNER_MASTER_MENU[0].key !== 'linked-partners') {
    bad('PARTNER_MASTER_MENU is no longer exactly the linked-partners tile');
  }
  if (webMaster.key !== PARTNER_MASTER_MENU[0]?.key || webMaster.label !== PARTNER_MASTER_MENU[0]?.label) {
    bad(
      `the master tile drifted from the web's MASTER_ITEM\n` +
        `      got:  ${PARTNER_MASTER_MENU[0]?.key} / ${PARTNER_MASTER_MENU[0]?.label}\n` +
        `      want: ${webMaster.key} / ${webMaster.label}`,
    );
  }
  // CALLED, not read: `partnerType || "NORMAL"` is the web's bug and it is invisible in a grep.
  const asMaster = partnerMenuFor('MASTER').map((i) => i.key);
  const asNormal = partnerMenuFor('NORMAL').map((i) => i.key);
  const asUnknown = partnerMenuFor(null).map((i) => i.key);
  if (!asMaster.includes('linked-partners')) bad('a MASTER partner does not get the Linked Partners tile');
  if (asNormal.includes('linked-partners')) bad('a NORMAL partner gets the Linked Partners tile');
  if (asUnknown.join(',') !== asNormal.join(',')) {
    bad('an unknown partnerType does not fall back to the NORMAL tile set');
  }
  if (asMaster.length !== asNormal.length + 1) {
    bad(`MASTER sees ${asMaster.length} tiles and NORMAL ${asNormal.length} — expected exactly one more`);
  }

  // ── 3. every tile route exists, both ways ─────────────────────────────────
  const files = routeNames();
  const layout = src.layout;
  for (const item of ALL_PARTNER_TILES) {
    const name = item.native.replace('/partner/', '');
    if (!files.has(name)) bad(`tile "${item.key}" points at ${item.native} — no route file`);
    else if (!new RegExp(`name="${name}"`).test(layout)) {
      bad(`${item.native} is not registered as a Stack.Screen — an unmatched route`);
    }
  }
  for (const m of layout.matchAll(/<Stack\.Screen name="([^"]+)"/g)) {
    if (!files.has(m[1])) bad(`_layout registers "${m[1]}" but app/partner/${m[1]}.js does not exist`);
  }
  for (const required of ['index', 'pending-verification', 'feature']) {
    if (!files.has(required)) bad(`app/partner/${required}.js is missing`);
  }

  // ── 4. every web path behind a not-yet-native tile is a real website route ─
  const webPaths = webRoutePaths();
  for (const item of ALL_PARTNER_TILES) {
    if (!webPaths.has(item.web)) {
      bad(`tile "${item.key}" falls back to ${item.web}, which the website's router does not serve`);
    }
    if (partnerWebPath(item.key) !== item.web) {
      bad(`partnerWebPath("${item.key}") disagrees with the menu entry`);
    }
  }

  // ── 5. THE LOGOUT LEAK ────────────────────────────────────────────────────
  // Login writes `partnerUserType`; this list only ever cleared `partnerType`, so one partner's
  // MASTER/NORMAL tier survived logout into the next partner's session.
  const login = codeOnly(src.partnerLogin);
  const written = [...login.matchAll(/\['(partner[A-Za-z]+)',/g)].map((m) => m[1]);
  if (!written.includes('partnerUserType')) {
    bad('the partner login no longer writes partnerUserType — the web reads that spelling');
  }
  for (const key of written) {
    if (!keys.ALL_AUTH_KEYS.includes(key)) {
      bad(`login writes "${key}" but ALL_AUTH_KEYS never clears it — it leaks into the next session`);
    }
  }

  // ── 6. the signup sends the terms flag ────────────────────────────────────
  const auth = codeOnly(src.authService);
  const signupBlock = auth.slice(auth.indexOf('export const signupPartner'), auth.length);
  if (!signupBlock.includes('/api/partner/auth/signup')) {
    bad('signupPartner does not target /api/partner/auth/signup');
  }
  if (!/termsAccepted:/.test(signupBlock.slice(0, signupBlock.indexOf('});')))) {
    bad('signupPartner omits termsAccepted — PartnerAuthService throws without it, unlike the parent');
  }
  if (!login.includes('termsAccepted: true')) {
    bad('the partner signup form does not send termsAccepted');
  }
  if (!login.includes('signup.terms')) bad('the signup form has no terms gate');

  // ── 7. the T&C is verbatim ────────────────────────────────────────────────
  const fromWeb = webTermsText();
  if (terms.TERMS_VERSION !== fromWeb.version) {
    bad(`TERMS_VERSION is ${terms.TERMS_VERSION}, the web says ${fromWeb.version}`);
  }
  const shipped = shippedTermsText(terms);
  if (shipped !== fromWeb.text) {
    const n = Math.min(shipped.length, fromWeb.text.length);
    let i = 0;
    while (i < n && shipped[i] === fromWeb.text[i]) i += 1;
    bad(
      `the shipped T&C is not verbatim — first difference at char ${i}\n` +
        `      web:     ${JSON.stringify(fromWeb.text.slice(Math.max(0, i - 40), i + 60))}\n` +
        `      shipped: ${JSON.stringify(shipped.slice(Math.max(0, i - 40), i + 60))}`,
    );
  }
  // The Master Partner commission clause is PAUSED on the web. Checked against the DATA, which has
  // no comments — the module's own docblock names the clause while explaining its absence.
  if (/Master Partner/.test(shipped)) {
    bad('the paused Master Partner commission clause is in the shipped T&C — the web hides it');
  }
  if (terms.PARTNER_TERMS.length !== 10) {
    bad(`the T&C has ${terms.PARTNER_TERMS.length} sections, expected 10`);
  }

  // ── 8. the profile guards, CALLED ─────────────────────────────────────────
  // The web does `profile?.partnerType || "NORMAL"`, so any fetch failure silently demotes a Master.
  if (profileSvc.partnerTypeOf(null) !== null) bad('partnerTypeOf guesses a tier when none is known');
  if (profileSvc.partnerTypeOf({}) !== null) bad('partnerTypeOf guesses a tier from an empty profile');
  if (profileSvc.partnerTypeOf({ partnerType: 'MASTER' }) !== 'MASTER') {
    bad('partnerTypeOf does not read a real tier');
  }
  if (profileSvc.verifiedOf(null) !== null) bad('verifiedOf guesses when verification is unknown');
  if (profileSvc.verifiedOf({ verified: false }) !== false) bad('verifiedOf does not report an unverified account');
  if (profileSvc.verifiedOf({ verified: true }) !== true) bad('verifiedOf does not report a verified account');

  // ── 9. the gate is structural, and nothing precedes it ────────────────────
  const home = codeOnly(src.menuScreen);
  const gate = home.indexOf('pending-verification');
  if (gate < 0) bad('the partner home never redirects to pending-verification');
  else if (home.indexOf('<ScrollView') > 0 && home.indexOf('<ScrollView') < gate) {
    bad('the tile grid renders before the verification gate resolves');
  }
  if (!/verified === null/.test(home)) {
    bad('the home screen has no "unknown" verification state — the grid will flash before the gate');
  }
  // The tier must only be overwritten when the SERVER actually named one. `PartnerLayout.js` does
  // `profile?.partnerType || "NORMAL"`, so on the website a dropped connection demotes a Master and
  // removes their Linked Partners tile until the next reload.
  if (!/if \(liveType\) setPartnerType\(liveType\);/.test(home)) {
    bad('the home screen overwrites partnerType unconditionally — a failed fetch demotes a Master');
  }
  // UNVERIFIED_PARTNER is granted NO endpoint, so the pending screen must offer no panel route.
  const pending = codeOnly(src.pendingScreen);
  if (/router\.(push|replace)\(['"`]\/partner\//.test(pending)) {
    bad('the pending screen links into the panel — every partner endpoint refuses an unverified user');
  }

  // ── 10. palette ───────────────────────────────────────────────────────────
  // The partner brand is #6b21a8/#9333ea, which is PORTALS.parent. School teal anywhere in this
  // tree means a screen that renders correctly and looks like a different product.
  for (const key of ['layout', 'menuScreen', 'pendingScreen', 'termsSheet', 'featureScreen']) {
    if (codeOnly(src[key]).includes('PORTALS.school')) {
      bad(`${SRC[key]} uses the school palette — the partner portal is purple`);
    }
  }
  if (!codeOnly(src.layout).includes('PORTALS.parent')) {
    bad('app/partner/_layout.js does not host the parent/partner purple palette');
  }

  // ── 11. the legacy WebView is gone ────────────────────────────────────────
  const shim = codeOnly(src.dashboardShim);
  if (shim.includes('AppWebView')) bad('app/dashboard/partner.js still renders the full-page WebView');
  if (!shim.includes('href="/partner"')) bad('app/dashboard/partner.js does not forward to the native panel');

  // ── 12. every style key the login references exists ───────────────────────
  // A missing style key is `undefined`, which RN silently accepts — the parent sign-up shipped 13
  // of them behind a green build and rendered completely unstyled.
  // Every partner surface, not just the login: `makeStyles` has the same hole as StyleSheet.create.
  for (const key of ['partnerLogin', 'menuScreen', 'pendingScreen', 'termsSheet', 'featureScreen']) {
    const whole = src[key];
    const at = Math.max(
      whole.indexOf('const styles = StyleSheet.create({'),
      whole.indexOf('const useStyles = makeStyles('),
    );
    if (at < 0) {
      bad(`${SRC[key]} defines no stylesheet`);
      continue;
    }
    const defined = new Set(
      [...whole.slice(at).matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9]*):/gm)].map((m) => m[1]),
    );
    for (const m of codeOnly(whole).matchAll(/styles\.([a-zA-Z][a-zA-Z0-9]*)/g)) {
      if (!defined.has(m[1])) bad(`${SRC[key]} references styles.${m[1]}, which is not defined`);
    }
  }

  // ── 13. no autoFocus in the terms modal ───────────────────────────────────
  if (/autoFocus/.test(codeOnly(src.termsSheet))) {
    bad('the terms sheet has autoFocus — an Android Modal with a focused input dismisses the keyboard');
  }

  return out;
}

const MUTATIONS = [
  {
    name: 'a menu tile reordered against the web sidebar',
    menu: (s) =>
      s
        .replace("{ key: 'monetization'", "{ key: 'TMP_monetization'")
        .replace("{ key: 'plans'", "{ key: 'monetization'")
        .replace("{ key: 'TMP_monetization'", "{ key: 'plans'"),
  },
  {
    name: 'a tile relabelled away from the web wording',
    menu: (s) => s.replace("label: 'School Analytics'", "label: 'Schools'"),
  },
  {
    name: 'the User Access tile restored (plaintext credentials in the bundle)',
    menu: (s) =>
      s.replace(
        "  { key: 'bank-info'",
        "  { key: 'user-access', label: 'User Access', icon: 'key-outline', native: '/partner/user-access', web: `${PARTNER_BASE}/user-access` },\n  { key: 'bank-info'",
      ),
  },
  {
    // THE WEB BUG, and it does not live in partnerMenuFor — `partnerMenuFor(null)` returning the
    // NORMAL list is intended. The demotion happens in the SCREEN, when a failed or partial fetch
    // is allowed to overwrite a tier that was already known.
    name: 'a failed profile fetch overwriting a known MASTER tier (the web bug that demotes a Master)',
    src: (k, s) =>
      k === 'menuScreen' ? s.replace('if (liveType) setPartnerType(liveType);', 'setPartnerType(liveType);') : s,
  },
  {
    name: 'a NORMAL partner shown the master-only tile',
    menu: (s) => s.replace("partnerType === 'MASTER' ?", 'true ?'),
  },
  {
    name: 'a tile pointed at a route with no file',
    menu: (s) => s.replace("native: '/partner/bank-info'", "native: '/partner/bank-details'"),
  },
  {
    name: 'a tile falling back to a web path the website does not serve',
    menu: (s) => s.replace('`${PARTNER_BASE}/monetization`', '`${PARTNER_BASE}/earnings`'),
  },
  {
    name: 'partnerWebPath disagreeing with the menu entry',
    menu: (s) => s.replace('?.web || PARTNER_BASE', '?.native || PARTNER_BASE'),
  },
  {
    name: 'a Stack.Screen registered with no file behind it',
    src: (k, s) =>
      k === 'layout' ? s.replace('<Stack.Screen name="feature" />', '<Stack.Screen name="user-access" />') : s,
  },
  {
    name: 'THE LOGOUT LEAK: partnerUserType dropped from ALL_AUTH_KEYS',
    keys: (s) => s.replace("  'partnerUserType',\n", ''),
  },
  {
    name: 'the login writing a session key nothing clears',
    src: (k, s) =>
      k === 'partnerLogin' ? s.replace("['partnerCode',", "['partnerTier', data.partnerType || ''],\n        ['partnerCode',") : s,
  },
  {
    name: 'signupPartner omitting termsAccepted (copying the parent shortcut)',
    src: (k, s) => (k === 'authService' ? s.replace('    termsAccepted: !!termsAccepted,\n', '') : s),
  },
  {
    name: 'the signup form no longer gating on the terms box',
    src: (k, s) => (k === 'partnerLogin' ? s.replaceAll('signup.terms', 'true') : s),
  },
  {
    name: 'a word changed in the legal text',
    terms: (s) => s.replace('independent contractor', 'independent consultant'),
  },
  {
    name: 'a T&C clause dropped',
    terms: (s) => s.replace(/\{ type: 'p', text: "This agreement is governed[^"]*" \},/, ''),
  },
  {
    name: 'the paused Master Partner commission clause revived',
    terms: (s) =>
      s.replace(
        '      { lead: "School (B2B) payouts:"',
        '      { lead: "Master Partner:", text: "40% commission on direct referrals." },\n      { lead: "School (B2B) payouts:"',
      ),
  },
  {
    name: 'the terms version drifting from the backend constant',
    terms: (s) => s.replace('TERMS_VERSION = "2026-05-v1"', 'TERMS_VERSION = "2026-06-v2"'),
  },
  {
    name: 'partnerTypeOf guessing NORMAL when the profile call failed',
    profile: (s) => s.replace("return typeof type === 'string'", "if (!type) return 'NORMAL';\n  return typeof type === 'string'"),
  },
  {
    name: 'verifiedOf treating unknown as verified',
    profile: (s) => s.replace('if (profile?.verified == null) return null;', 'if (profile?.verified == null) return true;'),
  },
  {
    name: 'the home screen losing its unknown-verification state (the grid flashes)',
    src: (k, s) => (k === 'menuScreen' ? s.replace('verified === null', 'verified === undefined') : s),
  },
  {
    name: 'the pending screen linking into a panel no unverified partner can reach',
    // Targets `confirmLogout`, not the bare `logout` it used to. That rename was the fix for
    // "logout does nothing": AuthContext.logout only clears storage, so all five bare call sites
    // now go through hooks/usePortalLogout. This mutation kept matching the old string, found
    // nothing, and passed while testing nothing — see scripts/checklogout.mjs for the rule itself.
    src: (k, s) =>
      k === 'pendingScreen'
        ? s.replace('onPress={confirmLogout}', "onPress={() => router.push('/partner/bank-info')}")
        : s,
  },
  {
    name: 'a partner screen repainted in the school teal',
    src: (k, s) => (k === 'menuScreen' ? s.replace('const palette = usePalette();', 'const palette = PORTALS.school;') : s),
  },
  {
    name: 'the layout hosting some other portal palette',
    src: (k, s) => (k === 'layout' ? s.replaceAll('PORTALS.parent', 'PORTALS.counsellor') : s),
  },
  {
    name: 'the legacy full-page WebView restored at /dashboard/partner',
    src: (k, s) =>
      k === 'dashboardShim' ? s.replace('href="/partner"', 'href="/x"').replace('Redirect', 'AppWebView') : s,
  },
  {
    name: 'a login style key deleted (renders unstyled, build stays green)',
    src: (k, s) => (k === 'partnerLogin' ? s.replace('  termsLink: {', '  termsLinkGone: {') : s),
  },
  {
    name: 'a menu-screen style key deleted',
    src: (k, s) => (k === 'menuScreen' ? s.replace('  tierChip: {', '  tierChipGone: {') : s),
  },
  {
    name: 'a terms-sheet style key deleted',
    src: (k, s) => (k === 'termsSheet' ? s.replace('  listRow: {', '  listRowGone: {') : s),
  },
  {
    name: 'autoFocus added inside the terms modal',
    src: (k, s) => (k === 'termsSheet' ? s.replace('<ScrollView', '<ScrollView autoFocus') : s),
  },
];

console.log('Self-tests (each mutation must be caught):');
for (const m of MUTATIONS) {
  let caught;
  try {
    const [menu, terms, keys, profileSvc] = await Promise.all([
      loadMenu(m.menu),
      loadTerms(m.terms),
      loadKeys(m.keys),
      loadProfileService(m.profile),
    ]);
    caught = assertions(menu, terms, keys, profileSvc, loadSources(m.src)).length > 0;
  } catch {
    caught = true; // a mutation that will not even load is caught, loudly
  }
  if (caught) ok(m.name);
  else fail(`NOT CAUGHT: ${m.name} — the corresponding assertion is vacuous`);
}

console.log('\nPartner panel:');
{
  const [menu, terms, keys, profileSvc] = await Promise.all([
    loadMenu(),
    loadTerms(),
    loadKeys(),
    loadProfileService(),
  ]);
  const problems = assertions(menu, terms, keys, profileSvc, loadSources());
  if (problems.length === 0) {
    const native = menu.ALL_PARTNER_TILES.filter((i) =>
      read(path.join(ROUTES, `${i.native.replace('/partner/', '')}.js`)).includes('PartnerFeatureScreen')
        ? false
        : true,
    ).length;
    ok(
      `${menu.PARTNER_MENU.length} tiles + 1 master-only; ${native} of ${menu.ALL_PARTNER_TILES.length} native so far; ` +
        `menu, routes, terms and session keys all consistent`,
    );
  } else problems.forEach(fail);
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL — ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
