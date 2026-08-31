// Matches the Shreyartha website brand colors
export const COLORS = {
  primary: '#b0003a',        // Brand red/maroon (from LoginDropdown gradient)
  primaryDark: '#8a002e',
  primaryLight: '#d4004a',
  secondary: '#1a1a2e',      // Dark navy (from LandingPage.css)
  accent: '#4F46E5',         // Indigo accent
  background: '#ffffff',
  surface: '#f8f9fa',
  surfaceAlt: '#f0f2f5',
  text: '#1a1a2e',
  textSecondary: '#666666',
  textLight: '#999999',
  border: '#eeeeee',
  borderDark: '#d0d0d0',
  error: '#dc3545',
  success: '#28a745',
  white: '#ffffff',
  overlay: 'rgba(26,26,46,0.6)',
};

export const FONTS = {
  regular: { fontSize: 16, color: COLORS.text },
  bold: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.secondary },
  subtitle: { fontSize: 18, color: COLORS.textSecondary },
  small: { fontSize: 13, color: COLORS.textLight },
};

export const SPACING = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
};

/**
 * The type scale — seven roles, closed.
 *
 * The student panel had accumulated **25 distinct font sizes** across six porting phases, including
 * the runs 10/10.5/11/11.5, 12/12.5/13/13.5 and 14/14.5/15/15.5. Half-point differences nobody can
 * see, but each one a decision re-made from scratch, and collectively the reason the panel read as
 * six screens by six hands.
 *
 * THE SIZES ARE TAKEN FROM WHAT WAS ALREADY THERE, not imposed. 12.5 (105 uses), 13 (69), 12 (63)
 * and 11.5 (56) were the real working sizes, so the scale keeps them and drops their one-off
 * neighbours — this re-typesets nothing, it just stops the drift.
 *
 * Sizes only. Weight and colour stay at the call site: a `body` line is SLATE[600] in a card and
 * white on the dark background, and folding that in would need two scales.
 *
 * `FONTS` above is the older, unrelated set used by the pre-port auth screens. Do not merge them.
 */
export const TYPE = {
  figure: 34,    // the one big score or percentage a screen exists to show
  display: 30,   // welcome and section headings
  headline: 20,  // level names, stream names, IPA symbols — big, but still inline
  title: 17,     // screen and card titles
  heading: 15,   // section headings, primary button labels
  body: 13,      // paragraphs, list rows, form values
  label: 12,     // field labels, secondary rows
  caption: 11,   // hints, metadata, helper text
  micro: 10.5,   // uppercase eyebrow labels and badges
};

/** Every value TYPE permits — for the design checker, and for a quick `includes` at a call site. */
export const TYPE_SCALE = Object.values(TYPE);

/**
 * Minimum tap target.
 *
 * 44pt is the figure both platforms publish (Apple HIG, and Material's 48dp rounds down to about
 * the same thing once padding is counted). The panel had 196 Pressables and 12 measured heights;
 * the rest were whatever their padding happened to produce, which on a dense row is around 28.
 *
 * A control that is deliberately inline — an icon button inside a card header, a chip in a wrapped
 * row — takes `hitSlop` instead, because giving it 44pt of height would break the row it sits in.
 */
export const TOUCH = { min: 44 };

export const SHADOWS = {
  sm: {
    shadowColor: '#000', shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 1,
  },
  md: {
    shadowColor: '#000', shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 3,
  },
  lg: {
    shadowColor: '#000', shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 6 }, shadowRadius: 16, elevation: 6,
  },
};

// Neutral ramp used by the auth kit and the native staff screens. The web panels lean on these
// Tailwind-slate values heavily; COLORS above only carries the marketing greys.
export const SLATE = {
  50: '#f8fafc',
  100: '#f1f5f9',
  200: '#e2e8f0',
  300: '#cbd5e1',
  400: '#94a3b8',
  500: '#64748b',
  600: '#475569',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
};

/**
 * Per-portal palettes, mirroring the web login pages so each portal stays recognisable
 * across web and app (school = teal, parent = purple, student = dark).
 *
 * Every component in components/auth/ takes one of these as a `palette` prop — no portal
 * colour is ever hardcoded in a component, so porting the parent/student logins is a
 * config change rather than a rewrite.
 *
 * Source of truth: frontendmain/src/School/SchoolAuth.css, Parent/ParentAuth.css,
 * student/StudentAuth.css.
 */
export const PORTALS = {
  // frontendmain/src/School/SchoolAuth.css — #1a5276 → #2e86ab → #48c9b0
  school: {
    key: 'school',
    gradient: ['#1a5276', '#2e86ab', '#48c9b0'],
    primary: '#2e86ab',
    primaryDark: '#1a5276',
    accent: '#48c9b0',
    onPrimary: '#ffffff',
    link: '#1a5276',
    headerBg: '#1a5276',
    tint: 'rgba(46, 134, 171, 0.12)',
    inputBg: '#ffffff',
    inputBorder: SLATE[200],
    inputFocus: '#2e86ab',
  },
  /**
   * The student PLATFORM (post-login), from frontendmain/src/styles/student-platform.css and
   * student/platform/dashboard.css.
   *
   * STRUCTURALLY UNLIKE THE STAFF PALETTES. Staff screens are opaque white cards on a SLATE[50]
   * page; the student panel is translucent white cards floating on a fixed photographic
   * background (assets/images/Background.png) over #0a1628. `pageBg` is therefore a fallback
   * behind the image, not the page colour, and `card` is deliberately not opaque.
   *
   * NOT the student LOGIN, which is crimson (#a80036, student/StudentAuth.css) and already lives
   * in the marketing COLORS. The dark theme begins after login, at the dashboard.
   */
  student: {
    key: 'student',
    gradient: ['#0a1628', '#0288d1', '#4fc3f7'],
    primary: '#4fc3f7',
    primaryDark: '#0288d1',
    accent: '#29b6f6',
    deep: '#0277bd',
    onPrimary: '#0a1628', // dark text ON the light-blue buttons, as the web does
    link: '#4fc3f7',
    headerBg: 'rgba(10, 22, 40, 0.95)',
    // The student home header only. `headerBg` at 95% reads as a solid slab and hides the
    // background photo entirely; this is the same hue at 65%, so the header floats over
    // assets/images/Background.png as a frosted panel instead. Kept as its own token rather than
    // lowering headerBg, which the staff and parent headers also use — those sit on a gradient,
    // not a photo, and go muddy when made translucent.
    //
    // NOT the same thing as `glass` below (10%): that one is a barely-there inner panel. At 10% a
    // header carrying white text over a photo fails contrast outright.
    headerGlass: 'rgba(10, 22, 40, 0.65)',
    headerBorder: 'rgba(79, 195, 247, 0.2)',
    pageBg: '#0a1628',
    onDark: '#b3e5fc',
    // THREE panel treatments, because the web has three and they are not interchangeable:
    //   card  — profile.css's main panel, near-opaque, DARK text inside
    //   tile  — .dashboard-section-card is `background:#fff`, fully OPAQUE. The dashboard images
    //           are white-boxed PNGs, so anything translucent leaves them looking pasted on.
    //   glass — .dashboard-user-info, barely-there frosted panel sitting straight on the
    //           background photo, with LIGHT text on it (onDark / primary), never dark text.
    card: 'rgba(255, 255, 255, 0.93)',
    cardBorder: 'rgba(79, 195, 247, 0.3)',
    tile: '#ffffff',
    glass: 'rgba(255, 255, 255, 0.10)',
    glassBorder: 'rgba(79, 195, 247, 0.25)',
    // A FOURTH treatment, added by the dashboard redesign: dark glass that can carry BODY COPY.
    //
    // The three above cannot. `card` and `tile` are light surfaces that need dark text, so on a
    // photograph they read as opaque sheets of paper pasted over it — which is precisely the "white
    // background" the redesign was asked to remove. `glass` is 10% WHITE: it lightens the photo
    // underneath instead of darkening it, so a bright region of Background.png stays bright and the
    // white text on it disappears. That is the readability complaint, exactly.
    //
    // `glassDark` darkens instead. 72% of #0a1628 over the busiest part of the image still measures
    // better than 7:1 against white text, and the photo remains legible through it — which is the
    // whole point of keeping a photographic background at all.
    //
    // `glassDarkRaised` is for a panel INSIDE a glassDark panel (a row, an inset). Stacking two
    // 72% layers would compound to 92% and go flat black, so nested surfaces take this instead of
    // a second copy of the same token.
    glassDark: 'rgba(10, 22, 40, 0.72)',
    glassDarkBorder: 'rgba(79, 195, 247, 0.28)',
    glassDarkRaised: 'rgba(10, 22, 40, 0.84)',
    tint: 'rgba(79, 195, 247, 0.14)',
    inputBg: '#ffffff',
    inputBorder: SLATE[200],
    inputFocus: '#4fc3f7',
  },
  // frontendmain/src/School/Counselor/CounselorDashboard.css — #6d28d9 → #7c3aed → #a78bfa.
  //
  // Both counsellor portals only. The school LOGIN stays teal and that is not an oversight:
  // SchoolAuth.js is one shared form with a role dropdown, so nothing knows the user is a
  // counsellor until the response comes back. The purple starts at the menu grid.
  counsellor: {
    key: 'counsellor',
    gradient: ['#6d28d9', '#7c3aed', '#a78bfa'],
    primary: '#7c3aed',
    primaryDark: '#6d28d9',
    accent: '#a78bfa',
    onPrimary: '#ffffff',
    link: '#6d28d9',
    headerBg: '#6d28d9',
    tint: 'rgba(124, 58, 237, 0.12)',
    inputBg: '#ffffff',
    inputBorder: SLATE[200],
    inputFocus: '#7c3aed',
  },
  // frontendmain/src/School/Principal/PrincipalDashboard.css — .principal-header is
  // `linear-gradient(135deg, #dc2626 0%, #f87171 100%)`; #b91c1c completes the ramp downwards, the
  // same way the counsellor entry above takes #6d28d9 from its own CSS.
  //
  // The Principal panel only. Same reasoning as the counsellor note: the school LOGIN stays teal
  // because SchoolAuth.js is one shared form and nothing knows the role until the response lands.
  principal: {
    key: 'principal',
    gradient: ['#b91c1c', '#dc2626', '#f87171'],
    primary: '#dc2626',
    primaryDark: '#b91c1c',
    accent: '#f87171',
    onPrimary: '#ffffff',
    link: '#b91c1c',
    headerBg: '#b91c1c',
    // #fee2e2 is the panel's own soft tint, expressed as the alpha wash the kit expects.
    tint: 'rgba(220, 38, 38, 0.12)',
    inputBg: '#ffffff',
    inputBorder: SLATE[200],
    inputFocus: '#dc2626',
  },
  // frontendmain/src/School/Vice_Principal/VicePrincipalDashboard.css — the header is
  // `linear-gradient(135deg, #ea580c 0%, #fb923c 100%)` and the file already uses #c2410c for its
  // darker pairing, so all three values are the panel's own.
  //
  // ADDED AFTER THE FACT: the VP port shipped on PORTALS.school (teal), because every non-counsellor
  // staff shell defaulted to it. That made VP the one panel whose app colour contradicted its
  // website. Fixed here alongside the Principal, since both go through the same lookup.
  vicePrincipal: {
    key: 'vicePrincipal',
    gradient: ['#c2410c', '#ea580c', '#fb923c'],
    primary: '#ea580c',
    primaryDark: '#c2410c',
    accent: '#fb923c',
    onPrimary: '#ffffff',
    link: '#c2410c',
    headerBg: '#c2410c',
    tint: 'rgba(234, 88, 12, 0.12)',
    inputBg: '#ffffff',
    inputBorder: SLATE[200],
    inputFocus: '#ea580c',
  },
  // frontendmain/src/School/ShreyarthaTeacher/ShreyarthaTeacherDashboard.css — this panel's header
  // is a NEUTRAL slate (#1e293b), so the accent rather than the header carries its identity: #6366f1
  // on every active nav item, with #a5b4fc as its light pairing. #4338ca completes the ramp
  // downwards, the same way the counsellor and principal entries take their dark end from their own
  // CSS.
  //
  // ADDED AFTER THE FACT, for the same reason the vicePrincipal entry above was: shreyartha_teacher
  // had no STAFF_ROLE_PALETTES row at all, so `staffPalette` fell through to PORTALS.school and the
  // panel rendered in exactly the teal of app/teacher. Two different logins, one colour.
  shreyarthaTeacher: {
    key: 'shreyarthaTeacher',
    gradient: ['#4338ca', '#6366f1', '#a5b4fc'],
    primary: '#6366f1',
    primaryDark: '#4338ca',
    accent: '#a5b4fc',
    onPrimary: '#ffffff',
    link: '#4338ca',
    headerBg: '#4338ca',
    tint: 'rgba(99, 102, 241, 0.12)',
    inputBg: '#ffffff',
    inputBorder: SLATE[200],
    inputFocus: '#6366f1',
  },
  // frontendmain/src/School/ShreyarthaCounsellor/ShreyarthaCouncellorDashboard.css — the header is
  // `linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)`. #5eead4 completes the ramp upwards.
  //
  // ADDED AFTER THE FACT: this portal shipped on PORTALS.counsellor (purple), inherited from the
  // SCHOOL counsellor's CounselorDashboard.css during the counsellor port. But this panel has its
  // own dashboard CSS and it is teal — so the two counsellor portals were being shown as one panel
  // when the website presents them as two. Separate `key` from `counsellor` on purpose:
  // `makeStyles` caches per key, and checkprincipal asserts every PORTALS value has a unique one.
  shreyarthaCounsellor: {
    key: 'shreyarthaCounsellor',
    gradient: ['#0f766e', '#14b8a6', '#5eead4'],
    primary: '#14b8a6',
    primaryDark: '#0f766e',
    accent: '#5eead4',
    onPrimary: '#ffffff',
    link: '#0f766e',
    headerBg: '#0f766e',
    tint: 'rgba(20, 184, 166, 0.12)',
    inputBg: '#ffffff',
    inputBorder: SLATE[200],
    inputFocus: '#14b8a6',
  },
  // frontendmain/src/Parent/ParentAuth.css — #6b21a8 → #9333ea → #c084fc
  parent: {
    key: 'parent',
    gradient: ['#6b21a8', '#9333ea', '#c084fc'],
    primary: '#9333ea',
    primaryDark: '#6b21a8',
    accent: '#c084fc',
    onPrimary: '#ffffff',
    link: '#6b21a8',
    headerBg: '#6b21a8',
    tint: 'rgba(147, 51, 234, 0.12)',
    inputBg: '#ffffff',
    inputBorder: SLATE[200],
    inputFocus: '#9333ea',

    // ── ADDED BY THE PARENT DASHBOARD REDESIGN ────────────────────────────────
    //
    // THIS FIXES A LIVE BUG, not just a future one. `components/ui/AnalyticsSummaryCard` reads
    // `p.glass || p.tint`, `p.glassBorder || p.cardBorder` and — with no fallback at all —
    // `color: p.onDark`. Under this palette `onDark` was `undefined`, so React Native fell back to
    // its default BLACK and that card has been rendering black text on a purple wash on the parent
    // home. Nothing crashed and no build complained, which is exactly how it survived.
    //
    // These are LIGHT-THEME values, unlike the student's. The parent panel has no photographic
    // background and its cards are opaque white on a slate page, so `deep` is a readable purple on
    // white and `onDark` is the muted ink used on the coloured header band — not a pale blue.
    deep: '#6b21a8',
    onDark: '#e9d5ff', // on the purple header band only
    pageBg: SLATE[50],
    card: '#ffffff',
    cardBorder: SLATE[200],
    tile: '#ffffff',
    glass: 'rgba(147, 51, 234, 0.10)',
    glassBorder: 'rgba(147, 51, 234, 0.22)',
  },
  // frontendmain/src/student/StudentAuth.css — dark gradient with the brand rose accent.
  //
  // THE STUDENT *LOGIN*, and nothing else. Staged for a future native student-login port; no
  // screen consumes it yet. It was originally keyed `student`, which made it a second `student:`
  // in this same object literal — a later duplicate key wins, so it silently shadowed the platform
  // palette above and every student screen rendered with `card`/`cardBorder`/`deep`/`onDark`/
  // `pageBg` undefined (transparent cards, RN's default BLACK borders) and a crimson `primary`.
  // A duplicate literal key is not a syntax error and nothing in this project would flag it.
  // Keep these two names distinct — `key` included, since makeStyles caches per `palette.key`.
  studentAuth: {
    key: 'studentAuth',
    gradient: ['#1a1a2e', '#16213e', '#0f3460'],
    primary: '#a80036',
    primaryDark: '#87002a',
    accent: '#ff4081',
    onPrimary: '#ffffff',
    link: '#a80036',
    headerBg: '#1a1a2e',
    tint: 'rgba(168, 0, 54, 0.12)',
    inputBg: '#ffffff',
    inputBorder: SLATE[200],
    inputFocus: '#a80036',
  },
};

/**
 * Which palette each school-staff shell wears, keyed by the lowercased `[role]` route segment.
 *
 * Mirrors the web, where every staff panel owns an accent in its own dashboard CSS. Roles absent
 * from this map fall back to the teal `PORTALS.school`, which is what `PaletteContext` defaults to
 * anyway — so an unlisted role behaves exactly as it did before this map existed, and
 * `app/teacher/` (which has no provider at all) cannot be recoloured by accident.
 *
 * Kept here rather than in staffRoles.js so it can be evaluated without pulling in the menus.
 *
 * ── THE TWO COUNSELLOR PORTALS NO LONGER SHARE A COLOUR ─────────────────────
 * They used to, because the counsellor port read `CounselorDashboard.css` and applied its purple to
 * both. But `ShreyarthaCouncellorDashboard.css` is its own file and it is TEAL — the website
 * presents these as two panels and the app was presenting them as one. Same correction, and same
 * reason, as the vice_principal row: mirror the panel's own CSS, not a sibling's.
 */
export const STAFF_ROLE_PALETTES = {
  counselor: PORTALS.counsellor,
  shreyartha_councellor: PORTALS.shreyarthaCounsellor,
  principal: PORTALS.principal,
  vice_principal: PORTALS.vicePrincipal,
  shreyartha_teacher: PORTALS.shreyarthaTeacher,
};

/** Palette for a staff shell, defaulting to the school teal. */
export function staffPalette(roleKey) {
  return STAFF_ROLE_PALETTES[String(roleKey || '').toLowerCase()] || PORTALS.school;
}

// Shared semantic colours for the auth banners, validation states and status chips.
// The warning trio was previously inlined as raw hex in StaffProfileScreen's "Pending" chip.
export const FEEDBACK = {
  errorBg: '#fef2f2',
  errorBorder: '#fecaca',
  errorText: '#dc2626',
  successBg: '#f0fdf4',
  successBorder: '#bbf7d0',
  successText: '#16a34a',
  warningBg: '#fffbeb',
  warningBorder: '#fde68a',
  warningText: '#b45309',
  neutralBg: SLATE[100],
  neutralBorder: SLATE[200],
  neutralText: SLATE[600],

  // ── Text sitting ON the tinted backgrounds above ──────────────────────────
  //
  // NOT redundant with `errorText`/`successText`/`warningText`. Those are tuned for white; on their
  // own tint they drop to roughly 3:1, which fails for body copy. The student panel had already
  // worked this out by hand — #991b1b on #fee2e2, #166534 on #dcfce7, #92400e on #fef3c7 — in six
  // places that each re-derived it. Naming the role is what stops the seventh from guessing.
  //
  // Use the plain variant on a white or slate card; use these inside a chip, badge or callout.
  errorOnBg: '#991b1b',
  successOnBg: '#166534',
  warningOnBg: '#92400e',
};

/**
 * Answer states for every quiz surface in the student panel.
 *
 * FOUR FILES CARRIED THE IDENTICAL PAIR — `AdaptiveRunner`, `CompetitiveExamScreen`,
 * `PracticeZoneScreen` and `MoreLikeThisButton` each declared
 * `{ backgroundColor: '#dcfce7', borderColor: '#22c55e' }` and its red twin. Four copies of one
 * decision means a fifth quiz surface guesses, and it means changing the correct-answer green is a
 * four-file edit that will miss one.
 *
 * Deliberately separate from `FEEDBACK`: "your answer was wrong" is not an error state. It is a
 * normal, expected outcome of a working assessment, and if the two ever need to diverge visually —
 * a wrong answer shown gently, a failed upload shown sharply — this is the seam that allows it.
 */
export const QUIZ = {
  correctBg: '#dcfce7',
  correctBorder: '#22c55e',
  correctText: '#166534',
  wrongBg: '#fee2e2',
  wrongBorder: '#ef4444',
  wrongText: '#991b1b',
};

/**
 * Score bands — good / fair / poor.
 *
 * THREE FEATURES EACH DEFINED THEIR OWN and disagreed on the amber: `phonetics/wordScores.js`,
 * `PhonemeDetailPanel`'s inline `band`, and `PsychometricReport`'s `bandColor` used #f59e0b and
 * #d97706 for the same idea. A student moving between Sound Studio and their psychometric report
 * saw two different "nearly there" colours.
 *
 * THE THRESHOLDS STAY WITH THE FEATURE and are deliberately not tokenised here. Pronunciation is
 * good at 80; a psychometric category is a strength at 50. Those are different judgements about
 * different things, and folding them into one constant would be a real behaviour change dressed up
 * as tidying. Only the colours are shared.
 */
export const BAND = {
  good: '#16a34a',
  // #f59e0b, NOT #d97706. Both were in use; this is the one the website ships
  // (`frontendmain` `phonetics/scoreColor.js`), so it is the one that survives — the point of the
  // consolidation is to move toward the web, not to average the two mobile guesses.
  fair: '#f59e0b',
  poor: '#dc2626',
  /** No score yet — a word Azure returned nothing for. Distinct from `poor`, which is a real 0. */
  none: '#9aa0a6',
};

/**
 * "Done" — a ticked module, a passed level, a completed topic.
 *
 * ONE GREEN, replacing two. #16a34a and #22c55e were both in use for a completion tick across eight
 * sites — Coding Pro and Skills Edge used one, Practice Zone and Psychometric the other, and a
 * student drilling from one to the other saw the shade change for no reason. Aliased to `BAND.good`
 * rather than given its own value so "passed" and "complete" cannot drift apart later.
 */
export const DONE = BAND.good;

/**
 * A live microphone.
 *
 * Red because that is the universal recording convention, NOT because anything is wrong — which is
 * why this is not `FEEDBACK.errorText`. Four screens (`PlacementAssessment`, `RecordYourVoice`,
 * `ShreyaChapterScreen`, `PhonemeDetailPanel`) each hardcoded the same hex for their mic-on state.
 */
export const RECORDING = '#dc2626';

/**
 * Text colour by SURFACE, not by role.
 *
 * The student panel has two kinds of surface and they need opposite ink. Until now only one of them
 * existed in practice, so every screen wrote `SLATE[800]` for a title and `SLATE[500]` for a hint
 * directly into its style block — about 200 literals across ~25 files. That was fine while every
 * card was light. The redesign adds `glassDark`, and on it those same values are unreadable.
 *
 * Rather than fork every screen, `StudentCard` now publishes its tone through `CardToneContext` and
 * the text primitives read the matching column here. Converting a screen becomes `tone="dark"` plus
 * deleting its colour literals — mechanical, one file at a time, and reversible.
 *
 * `dark.body` is #e2eefc rather than plain white on purpose: a full-white paragraph on a 72% navy
 * panel over a photograph vibrates. The title stays white so the hierarchy survives.
 *
 * NOT a replacement for `onDark` in the palette. That one is for text sitting DIRECTLY on the
 * background photograph with no panel under it at all, where the requirement is different again.
 */
export const INK = {
  light: { title: SLATE[800], body: SLATE[700], muted: SLATE[500] },
  dark: { title: '#ffffff', body: '#e2eefc', muted: '#9fc4e4' },
};

/**
 * The two hero-card gradients.
 *
 * These are IDENTITY, taken from the approved designs: the first card on a dashboard is the violet
 * one and the second is blue, so a user learns to aim for one by its colour before they read its
 * label. Both redesigned dashboards use the same pair — student (My Workspace / My Analytics) and
 * partner (My Schools / My Revenue) — which is the whole reason they live here rather than in a
 * component: the failure mode is a third hero card inventing a third gradient that clashes.
 *
 * NAMED FOR THE COLOUR, NOT THE CARD. They were `workspace` and `analytics` while only the student
 * dashboard had them; the partner's cards are neither of those things, and a partner reading
 * `colors={GRADIENT.workspace}` on their revenue card would reasonably assume it was a mistake.
 *
 * Ordered light-to-dark is wrong for these: `expo-linear-gradient` paints `colors[0]` at the start
 * point, and the design has the saturated end at the top-left.
 */
export const GRADIENT = {
  violet: ['#7c5cff', '#a78bfa'],
  blue: ['#38bdf8', '#60a5fa'],
  // The teacher dashboard's third card. Added when a design first called for three heroes rather
  // than two; the pair above is untouched, so the student and partner dashboards are unaffected.
  teal: ['#2dd4bf', '#5eead4'],
  // Added for the Principal panel, whose design leads with six differently-coloured cards rather
  // than three. Same two-stop shape as the others.
  green: ['#10b981', '#6ee7b7'],
  amber: ['#f59e0b', '#fcd34d'],
  indigo: ['#6366f1', '#a5b4fc'],
};

/**
 * Student ability bands, shared across the platform: Create Group assigns them, and homework and
 * resources target them through `targetGroupLevel`. `key` is the exact string the backend
 * validates against (case-sensitive) — see StudentGroupService.VALID_GROUP_LEVELS.
 *
 * Colours mirror the web's GROUP_LEVELS in School/Teacher/pages/TeacherGroups.js so a group reads
 * the same on both platforms. `short` is the one-letter form used where a row can't fit the label.
 */
export const GROUP_LEVELS = [
  { key: 'PROFICIENT', label: 'Proficient', short: 'P', color: '#059669', bg: '#d1fae5' },
  { key: 'GOOD', label: 'Good', short: 'G', color: '#2563eb', bg: '#dbeafe' },
  { key: 'AVERAGE', label: 'Average', short: 'A', color: '#d97706', bg: '#fef3c7' },
  { key: 'NEEDS_IMPROVEMENT', label: 'Needs Improvement', short: 'N', color: '#dc2626', bg: '#fee2e2' },
];

export const groupLevelMeta = (key) => GROUP_LEVELS.find((level) => level.key === key) || null;

// Dark futuristic student panel theme
export const STUDENT = {
  bg: '#0a0f1e',
  bgCard: '#111827',
  bgCardAlt: '#1a2236',
  bgCardGlow: '#1e2d4a',
  accent: '#4F46E5',
  accentBlue: '#3B82F6',
  accentBlueStrong: '#1D4ED8',
  accentBlueTint: 'rgba(59, 130, 246, 0.18)',
  accentCyan: '#06b6d4',
  accentGold: '#f59e0b',
  accentGreen: '#10b981',
  accentRose: '#f43f5e',
  border: 'rgba(79, 70, 229, 0.25)',
  borderBlue: 'rgba(59, 130, 246, 0.45)',
  borderCyan: 'rgba(6, 182, 212, 0.25)',
  glow: 'rgba(79, 70, 229, 0.15)',
  glowCyan: 'rgba(6, 182, 212, 0.12)',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255, 255, 255, 0.7)',
  textMuted: 'rgba(255, 255, 255, 0.4)',
  tabBar: '#0f1729',
  tabBarBorder: 'rgba(79, 70, 229, 0.3)',
  shadow: {
    shadowColor: '#4F46E5',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
};
