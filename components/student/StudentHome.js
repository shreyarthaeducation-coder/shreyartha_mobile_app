import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SPACING, TYPE } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import WelcomeHeader from '../ui/WelcomeHeader';
import AnalyticsSummaryCard from '../ui/AnalyticsSummaryCard';
import WelcomeScreen from './WelcomeScreen';
import { hasShownWelcome, markWelcomeShown } from './welcome/sessionFlag';
import { makeStyles } from '../../utils/makeStyles';
import usePortalLogout from '../../hooks/usePortalLogout';
import { STUDENT_HEADER_ACTIONS, STUDENT_MENU } from '../../constants/studentMenu';
import {
  fetchEntitlements,
  fetchSchoolInfo,
  fetchStudentProfile,
  planBadge,
} from '../../services/student/dashboardService';
import { fetchAnalyticsSummary } from '../../services/student/analyticsService';

/**
 * The student dashboard — the tile grid that replaces the desktop-forced WebView.
 *
 * Mirrors `frontendmain/src/student/platform/dashboard.js`: the same eight tiles in the same
 * order, the same images, the welcome line, the plan badge and the school badge.
 *
 * THE WELCOME INTERSTITIAL. Earlier passes skipped the web's "Welcome / Get Started" overlay
 * because a pure `sessionStorage` gate is worse on a phone than on a desktop. It is back, and the
 * reason it now earns its place is that it carries the student's photo, class, stream and a graph
 * of their real progress — see `WelcomeScreen`. Two rules keep it from becoming the tap it used to
 * be: it renders from the profile THIS screen already fetched (so it never waits on a request of
 * its own), and it is skipped entirely when that profile is missing, because a welcome screen with
 * no name, no class and no graph is strictly worse than the tile grid.
 *
 * The three reads are independently guarded. A free student has no school and may 403 on
 * entitlements, and neither should cost them the tile grid — the grid is the point of the screen.
 */

export default function StudentHome() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  // Bare `logout` only clears storage — it does not navigate, so the user stayed put on a
  // signed-out screen. See hooks/usePortalLogout.js.
  const { confirmLogout } = usePortalLogout({ loginRoute: '/auth/student-login' });

  const [profile, setProfile] = useState(null);
  const [school, setSchool] = useState(null);
  const [entitlements, setEntitlements] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [summary, setSummary] = useState(null);

  const load = useCallback(async () => {
    // Never `Promise.all` here: one expected 403 would blank the whole dashboard.
    const [profileRes, entRes, summaryRes] = await Promise.allSettled([
      fetchStudentProfile(),
      fetchEntitlements(),
      // Joins the existing fan-out rather than getting its own await: the summary card is an
      // addition to this screen, and must never be able to delay or blank the tile grid.
      fetchAnalyticsSummary(),
    ]);

    const me = profileRes.status === 'fulfilled' ? profileRes.value : null;
    setProfile(me);
    setEntitlements(entRes.status === 'fulfilled' ? entRes.value : null);
    setSummary(summaryRes.status === 'fulfilled' ? summaryRes.value : null);

    // Once per session, and only with a profile to show. Decided here rather than inside
    // WelcomeScreen so a pull-to-refresh can never re-trigger it: `markWelcomeShown` fires the
    // moment we commit to showing it, not when it is dismissed.
    if (me && !hasShownWelcome()) {
      markWelcomeShown();
      setShowWelcome(true);
    }

    // Only a school student has a school; for everyone else this call is skipped, not failed.
    if (me?.schoolId) {
      try {
        setSchool(await fetchSchoolInfo(me.schoolId));
      } catch {
        setSchool(null);
      }
    } else {
      setSchool(null);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openItem = (item) => {
    if (item.native) router.push(item.native);
    else router.push({ pathname: '/student/feature', params: { path: item.path, title: item.label } });
  };

  const badge = planBadge(entitlements);
  const name = profile?.fullName || profile?.name || profile?.email || 'Student';

  const dismissWelcome = (route) => {
    setShowWelcome(false);
    // A tapped progress bar dismisses AND navigates, so the dashboard is what the student comes
    // back to. `Get Started` passes null and just closes.
    if (route) router.push(route);
  };

  if (showWelcome) {
    return <WelcomeScreen profile={profile} onDismiss={dismissWelcome} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        {/* Welcome → photo → name, the identity block every portal now shares. `profilePicture`
            was already being fetched here and simply never rendered; ProfileScreen has shown the
            same image all along. The plan badge and logout keep their row, now above the block
            and right-aligned, so a long name can use the full width.

            The subtitle carries the class, not the school — the school name and crest already have
            their own block further down this screen. */}
        <WelcomeHeader
          compact
          name={name}
          photoUrl={profile?.profilePicture}
          subtitle={profile?.currentClass ? `Class ${profile.currentClass}` : undefined}
          onPressPhoto={() => router.push('/student/profile')}
          actions={
            <>
          {badge.label ? (
            <View style={[styles.badge, badge.premium && styles.badgePremium]}>
              <Text
                style={[styles.badgeText, badge.premium && styles.badgeTextPremium]}
                numberOfLines={1}
              >
                {badge.label}
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/student/feature',
                  params: { path: '/student/platform/plans', title: 'My Plan' },
                })
              }
              style={({ pressed }) => [styles.upgrade, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.upgradeText}>Upgrade</Text>
            </Pressable>
          )}

          <Pressable
            onPress={confirmLogout}
            hitSlop={8}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            <Ionicons name="log-out-outline" size={20} color="#ffffff" />
          </Pressable>
            </>
          }
        />

        {/* Scrolls rather than wraps: three chips with these labels wrap onto two rows on a
            narrow phone, and any future fourth action would make it three. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.actionsScroll}
          contentContainerStyle={styles.actions}
        >
          {STUDENT_HEADER_ACTIONS.map((action) => (
            <Pressable
              key={action.key}
              onPress={() => openItem(action)}
              style={({ pressed }) => [styles.actionChip, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Ionicons name={action.icon} size={14} color={palette.primary} />
              <Text style={styles.actionText} numberOfLines={1}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centre}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={palette.primary}
              colors={[palette.primary]}
            />
          }
        >
          {/* First thing on the screen, above the school badge and the tile grid — the product
              ask was that every user meets an analytics summary before anything else. Tapping it
              opens the full My Analytics screen it summarises. */}
          <AnalyticsSummaryCard
            summary={summary}
            subject="you"
            onPress={() => router.push('/student/analytics')}
          />

          {school?.schoolLogo || school?.name ? (
            <View style={styles.school}>
              {school.schoolLogo ? (
                <Image
                  source={{ uri: school.schoolLogo }}
                  style={styles.schoolLogo}
                  // `.dashboard-school-logo` is object-fit:contain — the default 'cover' crops
                  // wide school crests to a square.
                  resizeMode="contain"
                />
              ) : null}
              {school.name ? (
                <Text style={styles.schoolName} numberOfLines={2}>
                  {school.name}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.grid}>
            {STUDENT_MENU.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => openItem(item)}
                style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <Image source={item.image} style={styles.tileImg} resizeMode="contain" />
                <Text style={styles.tileLabel} numberOfLines={2}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const useStyles = makeStyles((p) => ({
  // Transparent: app/student/_layout.js paints the fixed background behind the whole navigator.
  safe: { flex: 1, backgroundColor: 'transparent' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // A floating frosted panel rather than a full-bleed slab.
  //
  // It used to be `p.headerBg` (95% opaque), square-cornered and edge-to-edge, which read as a
  // heavy dark block bolted to the top of the screen and hid the background photo completely.
  // `headerGlass` is the same hue at 65%, and the side margins plus rounded lower corners let
  // assets/images/Background.png show through and around it — the layout paints that image behind
  // the whole navigator with a transparent content style, so this genuinely shows through rather
  // than sitting on flat colour.
  //
  // 65% is deliberate: the header carries white text and light-blue chips, and the background
  // photo is busy. Lower opacity looks better on a screenshot and fails to stay readable on a
  // phone in daylight.
  header: {
    marginHorizontal: SPACING.sm,
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.sm,
    backgroundColor: p.headerGlass,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: p.headerBorder,
    overflow: 'hidden',
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },

  // The web's badge colours: a translucent chip for a custom plan, mint for Premium, amber for
  // the Upgrade call to action.
  // Inline with the name now, so no alignSelf/marginTop. `flexShrink: 0` keeps the badge at its
  // natural width — the name is what gives way when both cannot fit.
  badge: {
    flexShrink: 0,
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  badgePremium: { backgroundColor: '#d1fae5', borderColor: '#34d399' },
  badgeText: { fontSize: TYPE.caption, fontWeight: '700', color: '#ffffff' },
  badgeTextPremium: { color: FEEDBACK.successOnBg },
  upgrade: {
    flexShrink: 0,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#facc15',
  },
  upgradeText: { fontSize: TYPE.caption, fontWeight: '700', color: '#1f2937' },

  // `flexGrow: 0` — a ScrollView inside a column would otherwise try to take the leftover height.
  // xs, not sm: the compact identity block above already sits tighter, and matching gaps would
  // give back the height the compact variant just saved.
  actionsScroll: { flexGrow: 0, marginTop: SPACING.xs },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: SPACING.md },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(79,195,247,0.16)',
    borderWidth: 1,
    borderColor: p.headerBorder,
  },
  actionText: { fontSize: TYPE.caption, fontWeight: '600', color: p.onDark },

  scroll: { padding: SPACING.md, paddingBottom: SPACING.xl },

  // `.dashboard-user-info` — the frosted panel, not bare text on the photograph. Light text only:
  // at 10% white this reads as part of the background, so dark text would vanish into it.
  school: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: p.glass,
    borderWidth: 1,
    borderColor: p.glassBorder,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  schoolLogo: { width: 46, height: 46, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.9)' },
  schoolName: { flex: 1, fontSize: TYPE.heading, fontWeight: '600', color: p.primary },

  // `rowGap` for the vertical gutter, `space-between` for the horizontal one. Deliberately NOT a
  // `gap` + `width: 48%` combination: 48+48 plus the gap exceeds 100% and drops the grid to one
  // tile per row.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: SPACING.md,
  },
  tile: {
    width: '48%',
    alignItems: 'center',
    // OPAQUE. `.dashboard-section-card` is `background: #fff`, and the tile images are
    // white-boxed PNGs that show their own edges against anything translucent.
    backgroundColor: p.tile,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: p.cardBorder,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.sm,
    // Tiles in a row stretch to the tallest by default, so a two-line label sets the row height;
    // this only floors the rows where every label is one line.
    minHeight: 150,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 12,
    elevation: 3,
  },
  tilePressed: { opacity: 0.85, borderColor: p.accent },
  tileImg: { width: 70, height: 70, marginBottom: 14 },
  tileLabel: { fontSize: TYPE.body, fontWeight: '600', color: '#333333', textAlign: 'center' },

  pressed: { opacity: 0.72 },
}));
