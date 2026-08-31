import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, GRADIENT, SLATE, SPACING, TOUCH, TYPE } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import { useTranslations } from '../../hooks/useTranslations';
import BrandBar from '../shared/home/BrandBar';
import IdentityCard from '../shared/home/IdentityCard';
import HeroCard from '../shared/home/HeroCard';
import StatStrip from '../shared/home/StatStrip';
import SearchEntry from '../shared/home/SearchEntry';
import PartnerTermsSheet from './PartnerTermsSheet';
import { PARTNER_HEADER_ACTIONS, partnerMenuFor } from '../../constants/partnerMenu';
import { fetchProfile, partnerTypeOf, verifiedOf } from '../../services/partner/profileService';
import {
  joinedOn,
  loadDashboardFigures,
  partnerCodeOf,
  resolveTier,
  revenueStats,
  schoolStats,
} from '../../services/partner/dashboardService';
import usePortalLogout from '../../hooks/usePortalLogout';

/**
 * The partner dashboard.
 *
 * ── WHAT CHANGED ────────────────────────────────────────────────────────────
 * This was a sticky purple band over a flat 2×4 tile grid. The redesign puts the partnership at the
 * centre: who they are, their schools, their revenue, and a way to search. The tile grid survives
 * lower down — see below.
 *
 * Light-themed, like the parent panel it shares a palette with. `app/partner/_layout.js` supplies
 * `PORTALS.parent` deliberately (the two auth stylesheets are byte-identical), and the parent
 * redesign already gave that palette the tokens the shared kit reads.
 *
 * ── NO SHREYA BLOCK ─────────────────────────────────────────────────────────
 * The design draws a "For Support / Chat with Shreya" card. **`/api/partner/shreya/**` does not
 * exist** — only the student, parent and teacher controllers do — and the decision was to leave it
 * out rather than ship an inert card. There is no `partnerChatbotConfig`, and nothing here imports
 * `AssistantCard`. Adding it later is a config file and a mount, once a backend exists.
 *
 * ── NO FOOTER ───────────────────────────────────────────────────────────────
 * Same call as the parent: the design's Home / Support / Profile tabs would show the identity card
 * already at the top of this screen and a support surface that does not exist. Log Out therefore
 * sits at the foot of the page.
 *
 * ── THE VERIFICATION GATE RUNS BEFORE ANY FETCH, AND THAT IS LOAD-BEARING ───
 * `UNVERIFIED_PARTNER` is granted NOTHING — no `@PreAuthorize` anywhere names it, and all five
 * partner controllers require `hasRole('PARTNER')`. An unverified partner 403s on every endpoint,
 * so resolving `verified` first is the difference between the pending screen and a dashboard full
 * of error states. The figures load only after the gate has passed.
 *
 * ── THE TIER MUST NEVER SILENTLY DEMOTE ─────────────────────────────────────
 * The website does `profile?.partnerType || "NORMAL"`, so one dropped connection takes a Master's
 * Linked Partners tile away until they reload. The rule now lives in
 * `services/partner/dashboardService.resolveTier` so it can be tested by calling it rather than by
 * matching a line of source.
 */

const STRINGS = {
  changePassword: 'Change Password',
  rowPartnerId: 'Partner ID',
  rowPartnerName: 'Partner Name',
  rowEmail: 'Email ID',
  rowJoined: 'Date of Joining',
  notSet: 'Not set',
  noCode: 'Not yet assigned',

  schoolsTitle: 'My Schools',
  schoolsBody: 'View and manage the schools you are associated with.',
  statSchools: 'Schools',
  statStudents: 'Your Students',
  statActive: 'Active',
  statPendingSchools: 'Pending',
  linkedToYou: 'Linked to you',
  onYourCode: 'On your code',

  revenueTitle: 'My Revenue',
  revenueBody: 'Track your earnings, payments and performance.',
  statTotal: 'Total',
  statPaid: 'Paid',
  statPending: 'Pending',
  statMonth: 'This month',
  sinceJoining: 'Since joining',
  paidToDate: 'Paid to date',
  awaitingPayout: 'Pending + approved',
  thisMonth: 'Earned this month',

  myPartnership: 'My Partnership',
  masterPartner: 'Master Partner',
  searchPlaceholder: 'Search schools, students, earnings and more…',
  searchButton: 'Search',
  logOut: 'Log Out',
};

export default function PartnerMenuScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const t = useTranslations(STRINGS);
  // Bare `logout` only clears storage — it does not navigate, so the user stayed put on a
  // signed-out screen. See hooks/usePortalLogout.js.
  const { confirmLogout } = usePortalLogout({ loginRoute: '/auth/partner-login' });

  const [profile, setProfile] = useState(null);
  const [partnerName, setPartnerName] = useState('Partner');
  const [partnerType, setPartnerType] = useState(null);
  // null = unknown, so the grid never flashes before the gate resolves.
  const [verified, setVerified] = useState(null);
  const [termsOpen, setTermsOpen] = useState(false);
  const [figures, setFigures] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    let stored = {};
    try {
      const entries = await AsyncStorage.multiGet([
        'partnerUserName',
        'partnerUserEmail',
        'partnerUserVerified',
        'partnerUserType',
        'partnerCode',
      ]);
      stored = Object.fromEntries(entries);
    } catch {
      // Storage failure only costs the fallbacks below.
    }
    setPartnerName(stored.partnerUserName || 'Partner');
    // Seed the tier from login so the master tile is right on the first frame, then let the live
    // profile confirm or correct it. `resolveTier` never demotes on a failed read.
    setPartnerType((prev) => resolveTier(null, stored.partnerUserType) || prev);

    const storedVerified = stored.partnerUserVerified === 'true' || stored.partnerUserVerified === '1';

    let ok = storedVerified;
    try {
      const data = await fetchProfile();
      setProfile({ ...data, email: data?.email || stored.partnerUserEmail || '' });
      setPartnerType((prev) => resolveTier(partnerTypeOf(data), prev));
      const liveVerified = verifiedOf(data);
      ok = liveVerified == null ? storedVerified : liveVerified;
      setVerified(ok);
    } catch {
      // An unverified partner legitimately fails here — every endpoint refuses them. Fall back to
      // what login stored rather than locking someone out over a flaky network.
      setVerified(storedVerified);
      setProfile({ partnerCode: stored.partnerCode || null, email: stored.partnerUserEmail || '' });
    }

    // ONLY AFTER THE GATE. Every one of these is hasRole('PARTNER'); firing them for an unverified
    // partner is three guaranteed 403s behind a screen they are about to be redirected away from.
    if (ok) {
      try {
        setFigures(await loadDashboardFigures());
      } catch {
        setFigures(null);
      }
    }

    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Back from the home screen exits to the landing tabs rather than the login screen — the session
  // stays alive. Same contract as the parent, staff and student shells.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        router.replace('/(tabs)');
        return true;
      });
      return () => sub.remove();
    }, [router]),
  );

  const menu = useMemo(() => partnerMenuFor(partnerType), [partnerType]);

  if (verified === null) return <View style={styles.blank} />;
  if (verified === false) return <Redirect href="/partner/pending-verification" />;

  const openItem = (item) => {
    if (item.sheet === 'terms') {
      setTermsOpen(true);
      return;
    }
    if (item.native) {
      router.push(item.native);
      return;
    }
    router.push({ pathname: '/partner/feature', params: { label: item.label, path: item.path } });
  };

  const code = partnerCodeOf(profile);
  const joined = joinedOn(profile);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <BrandBar strings={t} changePasswordRoute="/partner/change-password" tone="light" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
        <IdentityCard
          tone="light"
          strings={t}
          name={profile?.fullName || partnerName}
          // A partner has NO photo field in the backend — `PartnerUser` has thirteen columns and
          // none is an image. Initials are the only case here, not a fallback.
          rows={[
            {
              key: 'partnerId',
              icon: 'card-outline',
              label: t.rowPartnerId,
              // `partnerCode` is nullable admin-typed free text with no enforced format — there is
              // no PRT##### generator. An unassigned code is a real state and says so.
              value: code || t.noCode,
              tint: 'violet',
            },
            {
              key: 'partnerName',
              icon: 'person-outline',
              label: t.rowPartnerName,
              value: profile?.fullName || partnerName,
              tint: 'blue',
            },
            { key: 'email', icon: 'mail-outline', label: t.rowEmail, value: profile?.email, tint: 'green' },
            { key: 'joined', icon: 'calendar-outline', label: t.rowJoined, value: joined, tint: 'amber' },
          ]}
        />

        {partnerType === 'MASTER' ? (
          <View style={styles.tierChip}>
            <Ionicons name="star" size={13} color={palette.primaryDark} />
            <Text style={styles.tierChipText}>{t.masterPartner}</Text>
          </View>
        ) : null}

        <HeroCard
          title={t.schoolsTitle}
          subtitle={t.schoolsBody}
          icon="business"
          colors={GRADIENT.violet}
          onPress={() => router.push('/partner/school-analytics')}
        >
          <StatStrip stats={schoolStats(profile, figures, t)} />
        </HeroCard>

        <HeroCard
          title={t.revenueTitle}
          subtitle={t.revenueBody}
          icon="trending-up"
          colors={GRADIENT.blue}
          onPress={() => router.push('/partner/monetization')}
        >
          <StatStrip stats={revenueStats(figures, new Date(), t)} />
        </HeroCard>

        <Text style={styles.sectionTitle}>{t.myPartnership}</Text>
        <View style={styles.grid}>
          {menu.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => openItem(item)}
              style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <View style={styles.tileIcon}>
                <Ionicons name={item.icon} size={19} color={palette.primaryDark} />
              </View>
              <Text style={styles.tileLabel} numberOfLines={2}>
                {item.label}
              </Text>
            </Pressable>
          ))}

          {PARTNER_HEADER_ACTIONS.map((action) => (
            <Pressable
              key={action.key}
              onPress={() => openItem(action)}
              style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              <View style={styles.tileIcon}>
                <Ionicons name={action.icon} size={19} color={palette.primaryDark} />
              </View>
              <Text style={styles.tileLabel} numberOfLines={2}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <SearchEntry
          tone="light"
          placeholder={t.searchPlaceholder}
          buttonLabel={t.searchButton}
          onSearch={(q) => router.push({ pathname: '/partner/search', params: { q } })}
        />

        <Pressable
          onPress={confirmLogout}
          style={({ pressed }) => [styles.logout, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Log out"
        >
          <Ionicons name="log-out-outline" size={18} color={FEEDBACK.errorText} />
          <Text style={styles.logoutText}>{t.logOut}</Text>
        </Pressable>
      </ScrollView>

      <PartnerTermsSheet visible={termsOpen} onClose={() => setTermsOpen(false)} />
    </SafeAreaView>
  );
}

const useStyles = makeStyles((p) => ({
  safe: { flex: 1, backgroundColor: p.pageBg },
  blank: { flex: 1, backgroundColor: '#ffffff' },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xl },

  tierChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: p.tint,
    borderWidth: 1,
    borderColor: p.glassBorder,
    marginBottom: SPACING.md,
  },
  tierChipText: { fontSize: TYPE.caption, fontWeight: '800', color: p.primaryDark },

  sectionTitle: {
    fontSize: TYPE.caption,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: SLATE[500],
    marginBottom: SPACING.sm,
  },

  // `space-between` for the horizontal gutter, `rowGap` for the vertical one — never `gap` with a
  // 48% width, which overflows and drops the grid to one tile per row.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  tile: {
    width: '48.5%',
    minHeight: TOUCH.min,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SLATE[200],
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 5,
    elevation: 1,
  },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: p.tint,
  },
  tileLabel: { flex: 1, fontSize: TYPE.label, fontWeight: '600', color: SLATE[700] },

  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    minHeight: TOUCH.min,
    borderRadius: 14,
    backgroundColor: FEEDBACK.errorBg,
    borderWidth: 1,
    borderColor: FEEDBACK.errorBorder,
    marginTop: SPACING.md,
  },
  logoutText: { fontSize: TYPE.heading, fontWeight: '700', color: FEEDBACK.errorText },

  pressed: { opacity: 0.8 },
}));
