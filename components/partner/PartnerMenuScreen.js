import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { SHADOWS, SLATE, SPACING } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { WelcomeHeader } from '../ui';
import { PARTNER_HEADER_ACTIONS, partnerMenuFor } from '../../constants/partnerMenu';
import {
  fetchProfile,
  partnerSubtitle,
  partnerTypeOf,
  verifiedOf,
} from '../../services/partner/profileService';
import usePortalLogout from '../../hooks/usePortalLogout';
import { makeStyles } from '../../utils/makeStyles';
import PartnerTermsSheet from './PartnerTermsSheet';

/**
 * Native partner home — the tile grid that replaces the full-page WebView at /dashboard/partner.
 *
 * ── THE VERIFICATION GATE IS THE SHARPEST ONE IN THE APP ─────────────────────
 * `UNVERIFIED_PARTNER` is granted NOTHING. Unlike the parent role, which at least reaches
 * change-password, no `@PreAuthorize` anywhere names it and all five partner controllers require
 * `hasRole('PARTNER')`. So every call in this panel fails until an admin verifies the account, and
 * an unverified partner must be sent to the pending screen before any tile can be opened.
 *
 * The live `PartnerProfileResponse.verified` is authoritative; the stored `partnerUserVerified` is
 * only the fallback for when that call fails. On the web the stale value is all there is, so a
 * partner verified mid-session stays locked out until they log in again.
 *
 * ── partnerType MAY BE UNKNOWN, AND UNKNOWN IS NOT "NORMAL" ──────────────────
 * `PartnerLayout.js` does `profile?.partnerType || "NORMAL"`, so a dropped connection silently
 * demotes a Master and removes their Linked Partners tile. Here a failed fetch keeps the last known
 * tier (seeded from storage) instead of overwriting it — see services/partner/profileService.js.
 */

export default function PartnerMenuScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  // Bare `logout` only clears storage — it does not navigate, so the user stayed put on a
  // signed-out screen. See hooks/usePortalLogout.js.
  const { confirmLogout } = usePortalLogout({ loginRoute: '/auth/partner-login' });

  const [profile, setProfile] = useState(null);
  const [partnerName, setPartnerName] = useState('Partner');
  const [partnerType, setPartnerType] = useState(null);
  // null = unknown, so the grid never flashes before the gate resolves.
  const [verified, setVerified] = useState(null);
  const [termsOpen, setTermsOpen] = useState(false);

  const load = useCallback(async () => {
    let stored = {};
    try {
      const entries = await AsyncStorage.multiGet([
        'partnerUserName',
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
    // profile confirm or correct it.
    const storedType = stored.partnerUserType?.trim()?.toUpperCase();
    if (storedType) setPartnerType(storedType);

    const storedVerified = stored.partnerUserVerified === 'true' || stored.partnerUserVerified === '1';

    try {
      const data = await fetchProfile();
      setProfile(data);
      const liveType = partnerTypeOf(data);
      // Only overwrite when the server actually said something.
      if (liveType) setPartnerType(liveType);
      const liveVerified = verifiedOf(data);
      setVerified(liveVerified == null ? storedVerified : liveVerified);
    } catch {
      // An unverified partner legitimately fails here — every endpoint refuses them. Fall back to
      // what login stored rather than locking someone out over a flaky network.
      setVerified(storedVerified);
      if (stored.partnerCode) setProfile({ partnerCode: stored.partnerCode });
    }
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

  const openItem = (item) => {
    if (item.sheet === 'terms') {
      setTermsOpen(true);
      return;
    }
    if (item.native) {
      router.push(item.native);
      return;
    }
    router.push({
      pathname: '/partner/feature',
      params: { label: item.label, path: item.path },
    });
  };

  if (verified === null) return <View style={styles.blank} />;
  if (verified === false) return <Redirect href="/partner/pending-verification" />;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
      >
        <View style={styles.header}>
          <WelcomeHeader
            greeting="Welcome"
            name={profile?.fullName || partnerName}
            subtitle={partnerSubtitle(profile)}
            actions={
              <Pressable
                onPress={confirmLogout}
                hitSlop={8}
                style={styles.logoutBtn}
                accessibilityRole="button"
                accessibilityLabel="Log out"
              >
                <Ionicons name="log-out-outline" size={22} color="#ffffff" />
              </Pressable>
            }
          />

          <View style={styles.actionRow}>
            {partnerType === 'MASTER' ? (
              <View style={styles.tierChip}>
                <Ionicons name="star" size={13} color="#ffffff" />
                <Text style={styles.tierText}>Master Partner</Text>
              </View>
            ) : null}

            {PARTNER_HEADER_ACTIONS.map((action) => (
              <Pressable
                key={action.key}
                onPress={() => openItem(action)}
                style={({ pressed }) => [styles.actionChip, pressed && styles.actionChipPressed]}
                accessibilityRole="button"
              >
                <Ionicons name={action.icon} size={15} color="#ffffff" />
                <Text style={styles.actionText} numberOfLines={1}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>My Partnership</Text>

        <View style={styles.grid}>
          {menu.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => openItem(item)}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <View style={styles.cardIcon}>
                <Ionicons name={item.icon} size={22} color={palette.primaryDark} />
              </View>
              <Text style={styles.cardLabel} numberOfLines={2}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <PartnerTermsSheet visible={termsOpen} onClose={() => setTermsOpen(false)} />
    </SafeAreaView>
  );
}

const useStyles = makeStyles((p) => ({
  blank: { flex: 1, backgroundColor: '#ffffff' },
  safe: { flex: 1, backgroundColor: p.headerBg },
  scroll: { paddingBottom: SPACING.xl, backgroundColor: SLATE[50] },
  header: {
    backgroundColor: p.headerBg,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  logoutBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  actionRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  tierChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  tierText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  actionChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  actionChipPressed: { backgroundColor: 'rgba(255,255,255,0.26)' },
  actionText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: SLATE[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  card: {
    width: '47.8%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  cardPressed: { opacity: 0.75 },
  cardIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: p.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: SLATE[700],
    textAlign: 'center',
  },
}));
