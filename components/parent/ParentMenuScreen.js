import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { SHADOWS, SLATE, SPACING } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { AnalyticsSummaryCard, WelcomeHeader } from '../ui';
import { PARENT_HEADER_ACTIONS, PARENT_MENU } from '../../constants/parentMenu';
import { fetchLinkedStudent, studentSubtitle } from '../../services/parent/dashboardService';
import { fetchAnalyticsSummary } from '../../services/parent/analyticsService';
import usePortalLogout from '../../hooks/usePortalLogout';
import { makeStyles } from '../../utils/makeStyles';
import ShreyaLauncher from '../staff/ShreyaLauncher';
import { PARENT_CHATBOT_CONFIG } from '../../constants/parentChatbotConfig';

/**
 * Native parent home — the tile grid that replaces the full-page WebView.
 *
 * Mirrors the web sidebar's nine items in order. Tiles marked `native` push an in-app screen; the
 * rest open through app/parent/feature.js (native header + WebView) until their phase lands.
 *
 * ── THE HEADER SHOWS THE CHILD, NOT THE PARENT ───────────────────────────────
 * This is a deliberate divergence, and the one place it makes sense. The product owner asked every
 * home screen for "Welcome, then his image, below name". A parent has no photo anywhere in the
 * backend — `ParentUserResponse` has no such field and there is no upload endpoint — but the
 * linked student does, and it is the child this entire portal is about. So the avatar is the
 * child's, and the parent's own name is the greeting line above it.
 *
 * ── VERIFICATION IS RE-DERIVED, NOT TRUSTED FROM STORAGE ─────────────────────
 * `LinkedStudentResponse.parentVerified` is authoritative and current. The stored
 * `parentUserVerified` is only a fallback for when the call fails, because on the web that stale
 * value keeps a just-verified parent locked out until they log in again.
 */

export default function ParentMenuScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  // Bare `logout` only clears storage — it does not navigate, so the user stayed put on a
  // signed-out screen. See hooks/usePortalLogout.js.
  const { confirmLogout } = usePortalLogout({ loginRoute: '/auth/parent-login' });

  const [student, setStudent] = useState(null);
  const [parentName, setParentName] = useState('Parent');
  // null = unknown, so the grid never flashes before the gate resolves.
  const [verified, setVerified] = useState(null);
  const [summary, setSummary] = useState(null);

  const load = useCallback(async () => {
    let stored = {};
    try {
      const entries = await AsyncStorage.multiGet([
        'parentUserName',
        'parentUserVerified',
        'linkedStudentName',
      ]);
      stored = Object.fromEntries(entries);
    } catch {
      // Storage failure only costs the fallbacks below.
    }
    setParentName(stored.parentUserName || 'Parent');

    try {
      const child = await fetchLinkedStudent();
      setStudent(child);
      // Live flag wins. `parentVerified` is only absent on older responses.
      setVerified(
        child?.parentVerified != null
          ? !!child.parentVerified
          : stored.parentUserVerified === 'true' || stored.parentUserVerified === '1',
      );
    } catch {
      // An unverified or unlinked parent legitimately fails here — fall back to what login stored
      // rather than locking someone out over a flaky network.
      setStudent(stored.linkedStudentName ? { fullName: stored.linkedStudentName } : null);
      setVerified(stored.parentUserVerified === 'true' || stored.parentUserVerified === '1');
    }

    // Independently guarded, and deliberately not inside the try above: an unlinked parent gets a
    // 404 from this endpoint, which is a normal state — it must not be able to take the tile grid
    // (or the verification gate) down with it.
    try {
      setSummary(await fetchAnalyticsSummary());
    } catch {
      setSummary(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Back from the home screen exits to the landing tabs rather than the login screen — the session
  // stays alive. Same contract as the staff and student shells.
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

  const openItem = (item) => {
    if (item.native) {
      router.push(item.native);
      return;
    }
    router.push({
      pathname: '/parent/feature',
      params: { label: item.label, path: item.path },
    });
  };

  if (verified === null) return <View style={styles.blank} />;
  if (verified === false) return <Redirect href="/parent/pending-verification" />;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
      >
        <View style={styles.header}>
          <WelcomeHeader
            greeting={`Welcome, ${parentName}`}
            name={student?.fullName || 'Your child'}
            photoUrl={student?.profilePicture}
            subtitle={studentSubtitle(student)}
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
            {PARENT_HEADER_ACTIONS.map((action) => (
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

        {/* Directly under the header, which already shows the child's photo and name — so "Your
            candidate is in Class 8…" reads as a continuation of it rather than as a stray card.
            Same component and same payload as the student's own home; only the subject differs. */}
        <AnalyticsSummaryCard
          summary={summary}
          subject="candidate"
          onPress={() => router.push('/parent/academic-progress')}
        />

        <Text style={styles.sectionTitle}>My Child</Text>

        <View style={styles.grid}>
          {PARENT_MENU.map((item) => (
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

      {/* The web mounts Shreya on `isVerified &&`; here that gate is structural — the redirect
          above returns before this line for anyone unverified. Sibling of the ScrollView, not
          inside it, because the launcher absolutely fills its parent. */}
      <ShreyaLauncher basePath="/parent" config={PARENT_CHATBOT_CONFIG} />
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
