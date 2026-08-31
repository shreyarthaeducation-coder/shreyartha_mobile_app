import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TOUCH, TYPE } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * A portal's footer: Home · Support · Profile.
 *
 * ── WHY THIS IS A COMPONENT AND NOT AN EXPO-ROUTER `<Tabs>` ──────────────────
 * A panel is a Stack of ~20 routes and only three of them are tab roots. Converting the group to
 * `<Tabs>` would make every other route a tab screen too, changing how each is pushed, popped and
 * animated — a rewrite of the panel's whole navigation for a bar visible on three screens. So the
 * layout keeps its Stack and renders this over it.
 *
 * ── THE TABS ARE A PROP ─────────────────────────────────────────────────────
 * The student panel had this hardcoded to its own three routes. The teacher needs the same bar with
 * its own, so the routes are data: `[{ key, label, icon, iconOff, route }]`. `isTabRoot` takes the
 * same list, because the layout and the bar must agree on what counts as a root or the bar appears
 * on a screen that has not padded for it.
 *
 * Consequences, both deliberate:
 *   · There is no per-tab history. Support and Profile are `replace`d onto the root, so Back from
 *     any of the three leaves the panel rather than cycling between them — which is what a
 *     three-tab shell should do and what a Stack gives for free.
 *   · The bar renders nothing at all off-root, so every inner screen is untouched and keeps its full
 *     height. `TAB_BAR_HEIGHT` is exported for the three roots that must pad for it.
 *
 * ── THE SAFE AREA IS PART OF THE BAR, NOT AROUND IT ──────────────────────────
 * On a gesture-navigation phone the home indicator sits inside the bar's footprint. `insets.bottom`
 * is added to the bar's own padding rather than wrapping it in a SafeAreaView, so the glass extends
 * to the physical edge and the labels sit above the indicator instead of the bar floating over it.
 *
 * ── `tone` IS NOT OPTIONAL POLISH ───────────────────────────────────────────
 * The dark styles below read `glassDark`, `glassDarkBorder` and `onDark`, which ONLY the student
 * palette defines. The teacher panel resolves to `PORTALS.school` (its layout mounts no
 * PaletteProvider), which has none of them — so before this prop existed the bar rendered
 * `backgroundColor: undefined` (a transparent strip over the scrolling content beneath it),
 * `borderTopColor: undefined` (no separator at all) and labels in React Native's default BLACK.
 * Nothing warns about that: a missing palette key is `undefined`, and `undefined` is a legal style
 * value meaning "unset". `scripts/checkpalette.mjs` is what actually catches it.
 */

/** The student panel's three roots. Support is Speak to Counselor, which is a real screen. */
export const STUDENT_TABS = [
  { key: 'home', label: 'Home', icon: 'home', iconOff: 'home-outline', route: '/student' },
  { key: 'support', label: 'Support', icon: 'headset', iconOff: 'headset-outline', route: '/student/counselor' },
  { key: 'profile', label: 'Profile', icon: 'person', iconOff: 'person-outline', route: '/student/profile' },
];

/** The teacher panel's three roots. */
export const TEACHER_TABS = [
  { key: 'home', label: 'Home', icon: 'home', iconOff: 'home-outline', route: '/teacher' },
  { key: 'support', label: 'Support', icon: 'headset', iconOff: 'headset-outline', route: '/teacher/support' },
  { key: 'profile', label: 'Profile', icon: 'person', iconOff: 'person-outline', route: '/teacher/profile' },
];

/**
 * The Vice Principal panel's three roots — the first of the redesigned staff shells.
 *
 * ── WHY THREE AND NOT THE PLANNED FOUR ──────────────────────────────────────
 * The design calls for a fourth Live Classes tab. It is deliberately deferred, because every tab
 * root must pad by `TAB_BAR_HEIGHT + insets.bottom` or its last control sits under the bar — and
 * `LiveClassesScreen` renders with `scroll={false}`, owning its own FlatList. Padding it means
 * threading an inset through a large shipped screen that five other roles also render.
 *
 * That work would be thrown away: the live-session phase replaces what this tab shows with a
 * past/scheduled/request view, and a new screen can pad for a footer from its first line. Adding
 * the tab is one entry here plus one `contentStyle` on that screen, once it exists.
 *
 * The routes are literal rather than built from the `[role]` segment because `isTabRoot` compares
 * them against `pathname` by equality — a template here and a resolved path there is how a bar ends
 * up rendering on a screen that never padded for it.
 */
export const VICE_PRINCIPAL_TABS = [
  { key: 'home', label: 'Home', icon: 'home', iconOff: 'home-outline', route: '/staff/vice_principal' },
  { key: 'support', label: 'Support', icon: 'headset', iconOff: 'headset-outline', route: '/staff/vice_principal/support' },
  { key: 'profile', label: 'Profile', icon: 'person', iconOff: 'person-outline', route: '/staff/vice_principal/profile' },
];

/**
 * The Shreyartha Teacher panel's three roots.
 *
 * Same three as the Vice Principal's, and the Support tab differs only in what it carries: this is
 * the one staff role whose Shreya actually answers, so its Support tab is the chat rather than a
 * help page. Live Classes is deferred here for the same reason it is on the VP — see above.
 */
export const SHREYARTHA_TEACHER_TABS = [
  { key: 'home', label: 'Home', icon: 'home', iconOff: 'home-outline', route: '/staff/shreyartha_teacher' },
  { key: 'support', label: 'Support', icon: 'headset', iconOff: 'headset-outline', route: '/staff/shreyartha_teacher/support' },
  { key: 'profile', label: 'Profile', icon: 'person', iconOff: 'person-outline', route: '/staff/shreyartha_teacher/profile' },
];

/**
 * The Counselor panel's three roots — the first purple footer.
 *
 * Support is a help page here, not Shreya: COUNSELOR implies neither TEACHER nor SHREYARTHA_TEACHER,
 * the two userTypes the chat service admits, and no counsellor Shreya controller exists to widen to.
 */
export const COUNSELOR_TABS = [
  { key: 'home', label: 'Home', icon: 'home', iconOff: 'home-outline', route: '/staff/counselor' },
  { key: 'support', label: 'Support', icon: 'headset', iconOff: 'headset-outline', route: '/staff/counselor/support' },
  { key: 'profile', label: 'Profile', icon: 'person', iconOff: 'person-outline', route: '/staff/counselor/profile' },
];

/**
 * The Shreyartha Counsellor panel's three roots — Portal B, and the last of the four.
 *
 * Same three as Portal A's. The design calls for a fourth **Live Counselling** tab and it is
 * deferred for exactly the reason Live Classes is on the other three: that route renders
 * `LiveClassesScreen` (Live Counselling IS that screen with a different scope source), which uses
 * `scroll={false}` and owns its own FlatList — so padding it for the bar means threading an inset
 * through a screen five roles share, for a tab the live-session phase replaces anyway.
 *
 * Note the spelling: `shreyartha_councellor`, COUNCELLOR with a c, because that is the exact
 * lowercased `schoolUserType` the login response carries. Never "corrected".
 */
export const SHREYARTHA_COUNCELLOR_TABS = [
  { key: 'home', label: 'Home', icon: 'home', iconOff: 'home-outline', route: '/staff/shreyartha_councellor' },
  { key: 'support', label: 'Support', icon: 'headset', iconOff: 'headset-outline', route: '/staff/shreyartha_councellor/support' },
  { key: 'profile', label: 'Profile', icon: 'person', iconOff: 'person-outline', route: '/staff/shreyartha_councellor/profile' },
];

/**
 * The Principal panel's FOUR roots — the first staff footer with a fourth tab.
 *
 * ── WHY THIS ONE GETS THE FOURTH AND THE OTHER FOUR DO NOT ──────────────────
 * The others' fourth tab would be Live Classes, whose screen renders `scroll={false}` and owns its
 * own FlatList — padding it for the bar means threading an inset through a screen five roles share.
 * Live Meeting is a different screen (`StaffMeetingScreen`) with a single consumer, so it can pad
 * for the bar without touching anybody else's panel.
 *
 * Labels stay short deliberately: at four tabs each is 25% of the width with `numberOfLines={1}`,
 * so "Live Meeting" is the longest this can safely carry.
 */
export const PRINCIPAL_TABS = [
  { key: 'home', label: 'Home', icon: 'home', iconOff: 'home-outline', route: '/staff/principal' },
  { key: 'support', label: 'Support', icon: 'headset', iconOff: 'headset-outline', route: '/staff/principal/support' },
  { key: 'meeting', label: 'Live Meeting', icon: 'videocam', iconOff: 'videocam-outline', route: '/staff/principal/live-meeting' },
  { key: 'profile', label: 'Profile', icon: 'person', iconOff: 'person-outline', route: '/staff/principal/profile' },
];

/** Every redesigned staff shell's tab list, by role. Absent = no footer, which is the default. */
export const STAFF_TABS = {
  principal: PRINCIPAL_TABS,
  vice_principal: VICE_PRINCIPAL_TABS,
  shreyartha_teacher: SHREYARTHA_TEACHER_TABS,
  counselor: COUNSELOR_TABS,
  shreyartha_councellor: SHREYARTHA_COUNCELLOR_TABS,
};

/** The tab list for a staff role, or an empty array — `isTabRoot([])` is false, so no bar renders. */
export function staffTabsFor(roleKey) {
  return STAFF_TABS[String(roleKey || '').toLowerCase()] || [];
}

/** Bar height excluding the safe-area inset. The three root screens pad by this plus the inset. */
export const TAB_BAR_HEIGHT = 62;

/**
 * Is `pathname` one of this portal's tab roots? The layout asks before rendering the bar.
 *
 * Takes the SAME list the bar is given. Passing a different one is how a bar ends up on a screen
 * that never padded for it, and the last control on that screen sits under it.
 */
export function isTabRoot(pathname, tabs = []) {
  return tabs.some((t) => t.route === pathname);
}

export default function PortalTabBar({ tabs = [], tone = 'dark' }) {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const light = tone === 'light';
  // The inactive icon colour, like the labels, has no dark token to fall back on outside the
  // student palette — `palette.onDark` is undefined there and the icon would paint black.
  const idleTint = light ? SLATE[400] : palette.onDark;

  return (
    <View style={[styles.bar, light && styles.barLight, { paddingBottom: insets.bottom || SPACING.sm }]}>
      {tabs.map((tab) => {
        const active = pathname === tab.route;
        return (
          <Pressable
            key={tab.key}
            // `replace`, not `push`: tapping Profile then Home then Profile must not build a stack
            // three deep. Already-active taps are a no-op rather than a self-replace, which would
            // remount the screen and drop its scroll position.
            onPress={() => {
              if (!active) router.replace(tab.route);
            }}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
          >
            <Ionicons
              name={active ? tab.icon : tab.iconOff}
              size={21}
              color={active ? palette.primary : idleTint}
            />
            <Text
              style={[styles.label, light && styles.labelLight, active && styles.labelActive]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
            {/* The active marker from the design — a short rounded bar under the label. Rendered
                as a fixed-height placeholder either way so the label never shifts by 3px on tap. */}
            <View style={[styles.marker, active && styles.markerActive]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((p) => ({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: SPACING.sm,
    backgroundColor: p.glassDark,
    borderTopWidth: 1,
    borderTopColor: p.glassDarkBorder,
  },
  // tone="light" — the teacher panel, whose palette (PORTALS.school) carries no dark tokens. An
  // opaque white surface, because the bar is `position: absolute` and content scrolls under it.
  barLight: {
    backgroundColor: '#ffffff',
    borderTopColor: SLATE[200],
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: TOUCH.min,
  },
  label: { fontSize: TYPE.caption, fontWeight: '600', color: p.onDark },
  labelLight: { color: SLATE[500] },
  // Last in the cascade at both tones, so the active tab always wins over the light override.
  labelActive: { color: p.primary, fontWeight: '800' },
  marker: { height: 3, width: 26, borderRadius: 999, backgroundColor: 'transparent', marginTop: 2 },
  markerActive: { backgroundColor: p.primary },
  pressed: { opacity: 0.7 },
}));
