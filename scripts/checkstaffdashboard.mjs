// The redesigned staff shells, checked as ONE panel with a role parameter.
//
//   node scripts/checkstaffdashboard.mjs
//
// ══ WHY THIS IS PARAMETERISED AND NOT FOUR CLONES ══════════════════════════
// Four roles now render `components/staff/home/StaffHomeScreen.js` from a descriptor in
// `constants/staffHome.js`. There is one screen, so there should be one checker: a per-role clone of
// checkteacherdashboard.mjs would be four files free to drift, and the fifth role added later would
// be covered by whichever of them somebody remembered to copy.
//
// So every assertion below loops over `STAFF_HOME` itself. A role added to that map is checked the
// moment it lands, which is the property that matters — the panel is DATA now, and a checker that
// names roles is a checker that silently stops covering the newest one.
//
// ══ WHAT THIS COVERS THAT THE OTHERS DO NOT ════════════════════════════════
// checkviceprincipal.mjs already walks STAFF_HOME for tile CONSERVATION (every menu key in exactly
// one destination) and owns the VP's own menu, the approver/self-service label split and the layout
// verification gate. None of that is repeated here. What was uncovered until now:
//
//   · every hero, tab and workspace tile route resolving to a real wrapper FILE
//   · the footer being the same array the layout tests with `isTabRoot`
//   · the three behaviours rescued from StaffMenuScreen still being present on the new screen
//   · `identityRow3.source` naming something the screen actually implements
//
// That last one is the quietest failure in the set. The screen falls back to Designation for any
// source it does not recognise, so a typo — 'schols' — renders a perfectly plausible card with the
// wrong row, forever, and nothing anywhere errors.
//
// Exit code 0 = pass. Anything else = read the output.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');

let failures = 0;
const fail = (m) => { failures += 1; console.error(`  ✗ ${m}`); };
const ok = (m) => console.log(`  ✓ ${m}`);

// Normalised: this repo has mixed line endings, and an assertion that turns on which one a file
// happens to carry is a false failure waiting to happen.
const read = (p) => fs.readFileSync(path.join(APP, p), 'utf8').replace(/\r\n/g, '\n');

/** Comment-stripped, so a rule can never be satisfied by prose describing it. */
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const SRC = {
  home: 'components/staff/home/StaffHomeScreen.js',
  layout: 'app/staff/[role]/_layout.js',
  tabBar: 'components/shared/home/PortalTabBar.js',
};

const CONSTANTS = ['staffHome', 'staffRoles', 'theme'];

/**
 * The real constants, evaluated rather than grepped.
 *
 * ══ THE LOADER HAZARD, AND IT FAILS AT LOAD NOT AT AN ASSERTION ════════════
 * These modules import each other by sibling path, so each is copied to a temp dir with
 * `from './X'` rewritten to `from './X.mjs'`. If a staged file gains an import of a file NOT in
 * `CONSTANTS`, the rewrite produces a path that does not exist and this module throws — and because
 * the mutation harness counts a throw as "caught", every mutation would tick while testing nothing.
 * That has happened twice in this repo. Any new sibling import must be added to that list.
 */
async function loadConstants(mutate) {
  const dir = fs.mkdtempSync(path.join(APP, '.staffdash-'));
  try {
    for (const name of CONSTANTS) {
      const rel = `constants/${name}.js`;
      let s = read(rel);
      if (mutate) s = mutate(rel, s);
      s = s.replace(/from '\.\/([A-Za-z0-9_]+)'/g, "from './$1.mjs'");
      fs.writeFileSync(path.join(dir, `${name}.mjs`), s);
    }

    // PortalTabBar imports react-native, which will not evaluate here. Only its data is wanted, so
    // the tab arrays are lifted out VERBATIM — a hand-written fixture would turn every footer
    // assertion below into a test of the fixture rather than of the bar.
    const bar = mutate ? mutate(SRC.tabBar, read(SRC.tabBar)) : read(SRC.tabBar);
    const lifted = [
      ...[...bar.matchAll(/export const [A-Z_]+_TABS = \[[\s\S]*?\n\];/g)].map((m) => m[0]),
      ...[...bar.matchAll(/export const STAFF_TABS = \{[\s\S]*?\n\};/g)].map((m) => m[0]),
      'export function staffTabsFor(r){return STAFF_TABS[String(r||"").toLowerCase()]||[];}',
    ].join('\n');
    fs.writeFileSync(path.join(dir, 'tabs.mjs'), lifted);

    const imp = (n) => import(`${pathToFileURL(path.join(dir, `${n}.mjs`)).href}?t=${Math.random()}`);
    return {
      home: await imp('staffHome'),
      roles: await imp('staffRoles'),
      theme: await imp('theme'),
      tabs: await imp('tabs'),
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Does `/staff/<role>/<seg>` have a wrapper file? The dynamic segment is always `[role]`. */
const routeExists = (route) => {
  const seg = String(route).replace(/^\/staff\/[a-z_]+/, '').replace(/^\//, '');
  return fs.existsSync(path.join(APP, 'app/staff/[role]', `${seg || 'index'}.js`));
};

/** The `identityRow3.source` values StaffHomeScreen actually branches on. */
const ROW3_SOURCES = ['assignedClasses', 'schools', 'designation'];

async function assertions(mods, src) {
  const out = [];
  const bad = (m) => out.push(m);

  const { STAFF_HOME, assertArrangementCovers, heroRoute } = mods.home;
  const { resolveStaffMenus } = mods.roles;
  const { staffTabsFor } = mods.tabs;
  const { STAFF_ROLE_PALETTES } = mods.theme;

  const roles = Object.keys(STAFF_HOME);
  if (roles.length < 4) bad(`only ${roles.length} roles have descriptors — expected at least 4`);

  for (const role of roles) {
    const home = STAFF_HOME[role];
    const config = resolveStaffMenus(role);
    if (!config) { bad(`${role}: has a home descriptor but no role config`); continue; }

    // ── Every destination resolves to a real wrapper FILE ────────────────────
    //
    // A descriptor route is a string. Nothing type-checks it, `expo export` never visits it, and a
    // route with no wrapper renders expo-router's "Unmatched" page — which reads as a bug in the
    // tile rather than in a constant.
    // Resolved through the SAME `heroRoute` the screen calls. Re-deriving destinations here
    // would let the checker verify a route the panel does not actually open — the failure mode
    // that makes a green checker worse than none.
    const heroes = home.heroes || [];
    if (!heroes.length) bad(`${role}: no heroes`);
    const seenHeroKeys = new Set();
    const routesSeen = new Map();
    for (const hero of heroes) {
      if (!hero.key) { bad(`${role}: a hero has no key`); continue; }
      if (seenHeroKeys.has(hero.key)) bad(`${role}: two heroes share the key "${hero.key}"`);
      seenHeroKeys.add(hero.key);

      // Exactly one destination form. Two would make which one wins depend on the resolver's
      // internal order, which is not something a descriptor should have to know.
      const forms = ['shell', 'itemKey', 'itemKeys', 'route'].filter((f) => hero[f]);
      if (forms.length === 0) bad(`${role}: hero "${hero.key}" names no destination`);
      if (forms.length > 1) bad(`${role}: hero "${hero.key}" names ${forms.length} destinations (${forms.join(', ')})`);

      // A hero naming a tile the menu does not carry resolves to null and renders nothing — a card
      // silently missing from the panel, with no error anywhere.
      for (const key of hero.itemKeys || (hero.itemKey ? [hero.itemKey] : [])) {
        if (!config.menu.some((m) => m.key === key)) {
          bad(`${role}: hero "${hero.key}" names tile "${key}", which is not in the menu`);
        }
      }

      const route = heroRoute(hero, role, config.menu);
      if (!route) { bad(`${role}: hero "${hero.key}" resolves to no route`); continue; }
      // The query string is the hero's `view`; the wrapper file is found from the path alone.
      if (!routeExists(route.split('?')[0])) {
        bad(`${role}: hero "${hero.key}" -> ${route} has no wrapper file`);
      }

      // TWO CARDS, TWO DESTINATIONS. Distinct routes is the real invariant here, and the coverage
      // check cannot supply it: the Principal's two fee cards deliberately share the tile `fees`
      // and are separated only by `view`, so dropping ONE view leaves the placements `fees|payments`
      // and `fees` — different strings, no duplicate, nothing reported. Both cards would then open
      // the same tab, the panel would look complete, and one of its six cards would be a lie.
      if (routesSeen.has(route)) {
        bad(`${role}: heroes "${routesSeen.get(route)}" and "${hero.key}" both open ${route}`);
      }
      routesSeen.set(route, hero.key);
    }

    // Workspace and attendance tiles are the same hazard one level down.
    const tiles = [
      ...(home.workspaceGroups || []).flatMap((g) => g.itemKeys || []),
      ...(home.attendanceItemKeys || []),
    ];
    for (const key of tiles) {
      const item = config.menu.find((m) => m.key === key);
      if (!item) { bad(`${role}: arrangement names "${key}", which is not in the menu`); continue; }
      if (!item.native) bad(`${role}: tile "${item.label}" is not native — it would open a WebView`);
      else if (!routeExists(item.native)) bad(`${role}: tile "${item.label}" -> ${item.native} has no wrapper file`);
    }

    // ── HEROES SHARING A TILE MUST EACH CARRY A DISTINCT VIEW ────────────────
    //
    // Two cards may legitimately open one screen — the Principal's Total Fees Collected and Fees
    // Pending are both `fees`, separated only by which tab they open. What must never happen is one
    // of them losing its `view`: that card then opens the screen's DEFAULT tab, which is neither
    // "collected" nor "pending", so the card still renders, still taps, and shows the wrong thing.
    //
    // Neither of the two obvious checks catches that. Route uniqueness does not, because
    // `/fees?view=payments` and `/fees` are different strings. Arrangement coverage does not,
    // because `fees|payments` and `fees` are different placements. Only this does.
    const byTile = new Map();
    for (const hero of heroes) {
      const key = hero.itemKey;
      if (!key) continue;
      if (!byTile.has(key)) byTile.set(key, []);
      byTile.get(key).push(hero);
    }
    for (const [key, sharers] of byTile) {
      if (sharers.length < 2) continue;
      const views = sharers.map((h) => h.view || '');
      const missing = sharers.filter((h) => !h.view).map((h) => h.key);
      if (missing.length) {
        bad(`${role}: heroes ${missing.join(', ')} share tile "${key}" with no view — they open its default tab, not their own`);
      }
      if (new Set(views).size !== views.length) {
        bad(`${role}: heroes sharing tile "${key}" do not all have distinct views (${views.join(', ')})`);
      }
    }

    // ── The footer ───────────────────────────────────────────────────────────
    //
    // A descriptor role with no tabs is a silent half-redesign: the screen pads for a bar that never
    // renders, leaving a strip of dead space at the bottom of every root.
    const tabs = staffTabsFor(role);
    if (!tabs.length) bad(`${role}: renders StaffHomeScreen but has no footer tabs`);
    for (const tab of tabs) {
      // THE CROSS-ROLE ROUTE. `isTabRoot` compares by equality against `pathname`, so a tab carrying
      // another role's literal route never matches — the bar renders with nothing active and the tap
      // leaves the panel entirely. Copy-paste between four near-identical arrays is exactly how.
      if (!String(tab.route).startsWith(`/staff/${role}`)) {
        bad(`${role}: tab "${tab.label}" routes to ${tab.route} — another role's panel`);
      }
      if (!routeExists(tab.route)) bad(`${role}: tab "${tab.label}" -> ${tab.route} has no wrapper file`);
    }
    const homeTab = tabs.find((t) => t.key === 'home');
    if (homeTab && homeTab.route !== `/staff/${role}`) {
      bad(`${role}: the Home tab does not point at the panel root`);
    }

    // ── The identity row the screen must actually implement ──────────────────
    const source = home.identityRow3?.source;
    if (source && !ROW3_SOURCES.includes(source)) {
      bad(`${role}: identityRow3.source "${source}" is not one the screen branches on — it would silently show Designation`);
    }
    // A row that needs a fetch is useless without somewhere to fetch from, and its failure mode is a
    // blank row rather than an error.
    if (source === 'schools' && !home.identityRow3?.endpoint) {
      bad(`${role}: identityRow3 source "schools" has no endpoint`);
    }

    // ── Support ──────────────────────────────────────────────────────────────
    if (!['shreya', 'help'].includes(home.support)) {
      bad(`${role}: support is "${home.support}" — must be shreya or help`);
    }

    // ── A palette, and its own ───────────────────────────────────────────────
    //
    // A role with no entry falls through to PORTALS.school, the teacher's blue. It renders
    // perfectly; it is simply the wrong panel's colour, and nothing says so.
    if (!STAFF_ROLE_PALETTES[role]) {
      bad(`${role}: no palette — it would render in the teacher's colours`);
    }

    // Conservation is checkviceprincipal's, re-asserted per role here because everything above is
    // meaningless if a tile is missing from the arrangement entirely.
    const cov = assertArrangementCovers(config.menu, home);
    if (cov.missing.length) bad(`${role}: tiles in no destination: ${cov.missing.join(', ')}`);
    if (cov.duplicated.length) bad(`${role}: tiles in two destinations: ${cov.duplicated.join(', ')}`);
    if (cov.unknown.length) bad(`${role}: arrangement names unknown tiles: ${cov.unknown.join(', ')}`);
  }

  // ── The three behaviours rescued from StaffMenuScreen ──────────────────────
  //
  // These existed ONLY on StaffMenuScreen. Four panels stopped rendering it, so each had to be
  // re-implemented here, and each fails silently if it was not: the photo cache write is what
  // StaffProfileScreen reads (without it a staff member sees their face on the home screen and
  // initials on their own profile), and the back override is the difference between leaving the
  // panel and unwinding a stack the user never built.
  const homeCode = codeOnly(src.home);
  if (!/setItem\(\s*STAFF_PHOTO_KEY/.test(homeCode)) {
    bad('StaffHomeScreen does not write STAFF_PHOTO_KEY — every staff profile screen drops to initials');
  }
  if (!/hardwareBackPress/.test(homeCode)) {
    bad('StaffHomeScreen has no Android back override — Back unwinds into the panel instead of leaving it');
  }
  if (!/confirmLogout/.test(homeCode)) {
    bad('StaffHomeScreen has no confirmLogout — it ends the attendance session before clearing keys');
  }
  // Change Password reaches these roles ONLY through BrandBar now; StaffMenuScreen's header-action
  // chip row went with it.
  if (!/changePasswordRoute/.test(homeCode)) {
    bad('StaffHomeScreen does not pass changePasswordRoute — the roles lose their only way to change it');
  }
  // The gate is the layout's, but the screen re-implements it, and "not yet known" must render a
  // blank frame rather than resolve to "unverified" — otherwise any role whose profile call fails is
  // locked out of its own panel.
  if (!/verified === null/.test(homeCode)) {
    bad('StaffHomeScreen does not distinguish "not yet known" from "unverified" — a failed profile read would lock the role out');
  }

  // ── The footer is mounted with the SAME array it is tested with ────────────
  //
  // `isTabRoot(pathname, tabs)` and `<PortalTabBar tabs={…}>` taking different lists is how a bar
  // renders on a screen that never padded for it, putting that screen's last control underneath it.
  const layoutCode = codeOnly(src.layout);
  if (!/isTabRoot\(/.test(layoutCode) || !/<PortalTabBar/.test(layoutCode)) {
    bad('the staff layout no longer gates PortalTabBar on isTabRoot');
  } else {
    const tested = layoutCode.match(/isTabRoot\(\s*pathname\s*,\s*([A-Za-z0-9_]+)\s*\)/)?.[1];
    const rendered = layoutCode.match(/<PortalTabBar[^>]*tabs=\{([A-Za-z0-9_]+)\}/)?.[1];
    if (!tested || !rendered || tested !== rendered) {
      bad(`the footer is tested with "${tested}" but rendered with "${rendered}" — they must be one array`);
    }
  }
  // No staff palette defines glassDark / glassDarkBorder / onDark. At the dark tone the bar renders
  // backgroundColor: undefined (transparent, over scrolling content) with React Native's default
  // BLACK labels — because a missing palette key is `undefined`, and `undefined` is a legal style
  // value meaning "unset". Nothing warns.
  if (!/tone="light"/.test(layoutCode)) {
    bad('the staff footer is not tone="light" — it would render transparent with black labels');
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
    // DEFERRED FROM THE HERO-LIST PHASE, and now real. This mutation was written when the shape
    // changed, ticked green, and was testing nothing — no descriptor used `view` yet, so its regex
    // matched no text. It was removed rather than left as a passing no-op, and comes back here with
    // the Principal's two fee cards, which are its first and only user.
    //
    // Dropping the view collapses Total Fees Collected and Fees Pending onto the SAME route. Both
    // cards still render, still tap, and both open the fee screen on its default tab — the panel
    // looks complete and one of its six cards is a lie.
    name: 'a hero losing the view that tells it from its twin',
    mutate: (f, s) => (f === 'constants/staffHome.js'
      ? s.replace("      view: 'due',\n", '')
      : s),
  },
  {
    // Two destination forms on one hero. Which wins depends on the resolver's internal test order,
    // so the card silently opens whichever `heroRoute` happens to check first — and a descriptor
    // should never have to know that order.
    name: 'a hero naming two destinations at once',
    mutate: (f, s) => (f === 'constants/staffHome.js'
      ? s.replace("      shell: 'my-attendance',", "      shell: 'my-attendance',\n      route: '/staff/counselor/groups',")
      : s),
  },
  {
    // A hero pointing at a tile the menu does not carry. `heroRoute` returns null, the screen skips
    // it, and the panel is simply missing a card — no error, no clue.
    name: 'a hero naming a tile that is not in the menu',
    mutate: (f, s) => (f === 'constants/staffHome.js'
      ? s.replace("      itemKey: 'groups',", "      itemKey: 'wellnessGroups',")
      : s),
  },
  {
    // Two heroes sharing a key. React renders both with the same `key`, which is a reconciliation
    // bug rather than a visible one — it surfaces as a card that will not update.
    name: 'two heroes sharing a key',
    mutate: (f, s) => (f === 'constants/staffHome.js'
      ? s.replace("      key: 'attendance',", "      key: 'workspace',")
      : s),
  },
  {
    // A hero promoting a tile that is ALSO in the workspace grid — the same destination reachable
    // from two cards, which reads as a richer panel and is really one tile rendered twice.
    //
    // This is the half of the key|view rule that can be exercised today. The other half — two cards
    // legitimately sharing a key because they open different VIEWS of one screen — has no user
    // until the Principal's two fee cards land, and a mutation against an unused field would tick
    // while testing nothing. Add it with that descriptor, not before.
    name: 'a hero duplicating a tile the workspace grid already holds',
    mutate: (f, s) => (f === 'constants/staffHome.js'
      ? s.replace("      itemKey: 'groups',", "      itemKey: 'counselling',")
      : s),
  },
  {
    name: 'a hero pointed at a route with no wrapper file',
    mutate: (f, s) => (f === 'constants/staffHome.js'
      ? s.replace("itemKey: 'groups',", "route: '/staff/counselor/wellness',")
      : s),
  },
  {
    name: 'a tab carrying another role’s route',
    mutate: (f, s) => (f === 'components/shared/home/PortalTabBar.js'
      ? s.replace("route: '/staff/shreyartha_councellor/support' }", "route: '/staff/counselor/support' }")
      : s),
  },
  {
    name: 'a tile route left without a wrapper file',
    mutate: (f, s) => (f === 'constants/staffRoles.js'
      ? s.replace("native: '/staff/shreyartha_councellor/queries'", "native: '/staff/shreyartha_councellor/query-inbox'")
      : s),
  },
  {
    name: 'identityRow3 given a source the screen does not branch on',
    mutate: (f, s) => (f === 'constants/staffHome.js'
      ? s.replace("source: 'schools',", "source: 'schols',")
      : s),
  },
  {
    name: 'the schools row left with no endpoint',
    mutate: (f, s) => (f === 'constants/staffHome.js'
      ? s.replace("    endpoint: '/api/shreya01/counsellor/schools-classes',\n", '')
      : s),
  },
  {
    name: 'a redesigned role losing its palette',
    mutate: (f, s) => (f === 'constants/theme.js'
      ? s.replace(/\n\s*shreyartha_councellor: PORTALS\.shreyarthaCounsellor,/, '')
      : s),
  },
  {
    name: 'the HR photo cache write dropped (profiles silently lose the face)',
    mutate: (f, s) => (f === 'components/staff/home/StaffHomeScreen.js'
      ? s.replace(/AsyncStorage\.setItem\(STAFF_PHOTO_KEY[\s\S]*?;/, '')
      : s),
  },
  {
    name: 'the Android back override dropped',
    mutate: (f, s) => (f === 'components/staff/home/StaffHomeScreen.js'
      ? s.replace(/hardwareBackPress/g, 'someOtherEvent')
      : s),
  },
  {
    // GLOBAL, and that is not a style choice. Both of these strings appear in a COMMENT before they
    // appear in code, and a plain string `.replace` hits only the first — so the prose was mutated,
    // the code line survived, and the assertion (which reads comment-stripped source, correctly)
    // passed. Two of this file's twelve mutations were vacuous for exactly that reason on the first
    // run. A mutation must target code the assertion can actually see.
    name: 'the unknown-verification state collapsed into "unverified"',
    mutate: (f, s) => (f === 'components/staff/home/StaffHomeScreen.js'
      ? s.replace(/verified === null/g, 'verified === undefined')
      : s),
  },
  {
    name: 'the footer tested with one array and rendered with another',
    mutate: (f, s) => (f === 'app/staff/[role]/_layout.js'
      ? s.replace(/<PortalTabBar tabs=\{[A-Za-z0-9_]+\}/, '<PortalTabBar tabs={STUDENT_TABS}')
      : s),
  },
  {
    name: 'the footer reverted to the dark tone no staff palette supports',
    mutate: (f, s) => (f === 'app/staff/[role]/_layout.js' ? s.replace(/tone="light"/g, '') : s),
  },
  {
    name: 'a workspace tile flipped back to a WebView',
    mutate: (f, s) => (f === 'constants/staffRoles.js'
      ? s.replace("{ key: 'queries', label: 'Queries', icon: 'help-circle-outline', native:",
        "{ key: 'queries', label: 'Queries', icon: 'help-circle-outline', path:")
      : s),
  },
];

console.log('Self-tests (each mutation must be caught):');
for (const m of MUTATIONS) {
  let caught;
  try {
    const staged = await loadConstants(m.mutate);
    caught = (await assertions(staged, sourcesOf(m.mutate))).length > 0;
  } catch {
    caught = true; // a mutation that will not even load is caught, loudly
  }
  if (caught) ok(m.name);
  else fail(`NOT CAUGHT: ${m.name} — the corresponding assertion is vacuous`);
}

console.log('\nStaff dashboards:');
const mods = await loadConstants();
const problems = await assertions(mods, sourcesOf());
if (problems.length === 0) {
  const roles = Object.keys(mods.home.STAFF_HOME);
  ok(`${roles.length} panels: every hero, tab and tile route resolves to a real wrapper file`);
  ok('each footer is its own role’s, mounted light, with one array for isTabRoot and PortalTabBar');
  ok('every identity row names a source the screen implements');
  ok('the three behaviours rescued from StaffMenuScreen are all present');
} else {
  for (const p of problems) fail(p);
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
