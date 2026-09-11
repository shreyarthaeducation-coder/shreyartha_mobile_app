import { useCallback, useEffect, useState } from 'react';
import {
  BackHandler,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  Text,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { SHADOWS, SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../../components/ui/PaletteContext';
import WelcomeHeader from '../ui/WelcomeHeader';
import useStaffLogout from '../../hooks/useStaffLogout';
import { STAFF_PHOTO_KEY } from '../../constants/storageKeys';
import { fetchHrProfile } from '../../services/teacher/hrService';
import ShreyaLauncher from './ShreyaLauncher';
import { makeStyles } from '../../utils/makeStyles';

/**
 * Native staff home — the menu-grid shell shared by the teacher panel and every
 * app/staff/[role] shell.
 *
 * Presents the same menu as the role's web sidebar. Items marked `native` push an in-app
 * screen; the rest open through the role's feature route, which renders the web page inside a
 * WebView with the session injected. As pages get ported, individual items flip to native in
 * the role's menu config without any change here.
 *
 * Props: `config` — { label, menu, headerActions, routes: { feature, pending }, groups?, chatbot? }
 * from constants/staffRoles.js resolveStaffMenus() (or the teacher equivalent). `chatbot` is
 * optional and, when present, mounts the floating Shreya launcher.
 *
 * ── GROUPING IS OPT-IN, AND THAT IS DELIBERATE ───────────────────────────────
 * SEVEN configs render through this one component: the teacher panel plus all six app/staff/[role]
 * shells (counselor, principal, vice_principal, shreyartha_admin, shreyartha_councellor,
 * shreyartha_teacher). Only a config that declares `groups` gets collapsible sections; a config
 * with just `menu` takes the flat-grid branch exactly as before. So grouping the teacher menu
 * cannot silently restructure the other six panels — they keep their flat grids until someone
 * gives them groups of their own.
 *
 * `groups` is [{ key, label, icon, items: [...] }]; `menu` must still be supplied and hold the
 * same items flattened (the teacher constant derives it, so the two cannot drift).
 */

// LayoutAnimation is opt-in on old-architecture Android and a no-op elsewhere.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function StaffMenuScreen({ config }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const router = useRouter();
  const { confirmLogout } = useStaffLogout();
  const [profile, setProfile] = useState({
    name: '',
    schoolCode: '',
    verified: null,
    photoUrl: '',
  });

  const groups = config.groups || null;
  // First section open, the rest collapsed — the admin sidebar opens the same way. Keyed by group
  // key rather than index so reordering the groups cannot reopen a different one.
  const [expanded, setExpanded] = useState(() =>
    groups && groups.length ? [groups[0].key] : [],
  );

  const toggleGroup = (key) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((open) =>
      open.includes(key) ? open.filter((k) => k !== key) : [...open, key],
    );
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const entries = await AsyncStorage.multiGet([
          'schoolUserName',
          'schoolCode',
          'schoolUserVerified',
          // Last known photo, so a cold start paints one immediately instead of showing initials
          // for as long as the HR call takes.
          STAFF_PHOTO_KEY,
        ]);
        if (!alive) return;
        const values = Object.fromEntries(entries);
        setProfile({
          name: values.schoolUserName || config.label,
          schoolCode: values.schoolCode || '',
          verified: values.schoolUserVerified === 'true',
          photoUrl: values[STAFF_PHOTO_KEY] || '',
        });
      } catch {
        if (alive) setProfile({ name: config.label, schoolCode: '', verified: true, photoUrl: '' });
      }
    })();
    return () => {
      alive = false;
    };
  }, [config.label]);

  // The staff photo lives on the HR profile, NOT on /api/teacher/profile — TeacherProfileResponse
  // has no photo field at all (its `schoolLogo` is the school's crest, not the person). This is the
  // only network call this screen makes, and it is deliberately fire-and-forget: it goes through
  // `staffApi`, so a 403 for a role the HR controller does not name stays a renderable error rather
  // than ending the session, and a slow or failed call simply leaves the initials in place.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const hr = await fetchHrProfile();
        const url = hr?.profilePictureUrl || '';
        if (!alive || !url) return;
        setProfile((prev) => (prev.photoUrl === url ? prev : { ...prev, photoUrl: url }));
        AsyncStorage.setItem(STAFF_PHOTO_KEY, url).catch(() => {});
      } catch {
        // No HR record, or a role this controller does not admit. Initials are the fallback.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Back from the home screen exits to the landing tabs rather than the login screen — the
  // session stays alive.
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
      pathname: config.routes.feature,
      params: { label: item.label, path: item.path },
    });
  };

  // One tile, used by BOTH branches — the flat grid and the grouped sections render identical
  // cards, so the styling stays single-sourced.
  const renderTile = (item) => (
    <Pressable
      key={item.key}
      onPress={() => openItem(item)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={item.label}
    >
      <View style={styles.cardIcon}>
        <Ionicons name={item.icon} size={22} color={PALETTE.primaryDark} />
      </View>
      <Text style={styles.cardLabel} numberOfLines={2}>
        {item.label}
      </Text>
    </Pressable>
  );

  // Verified flag is read asynchronously; hold the render until it's known so an unverified
  // user never sees the menu flash before the redirect.
  if (profile.verified === null) return <View style={styles.blank} />;
  if (profile.verified === false) return <Redirect href={config.routes.pending} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
      >
        <View style={styles.header}>
          {/* Welcome → photo → name, shared with the student panel. This one component is the home
              screen for the teacher panel and all six app/staff/[role] shells, so this is one edit
              for seven portals. */}
          <WelcomeHeader
            name={profile.name}
            photoUrl={profile.photoUrl}
            subtitle={`${config.label}${profile.schoolCode ? ` · ${profile.schoolCode}` : ''}`}
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

          {config.headerActions.length > 0 ? (
            <View style={styles.actionRow}>
              {config.headerActions.map((action) => (
                <Pressable
                  key={action.key}
                  onPress={() => openItem(action)}
                  style={({ pressed }) => [styles.actionChip, pressed && styles.actionChipPressed]}
                  accessibilityRole="button"
                >
                  <Ionicons name={action.icon} size={17} color="#ffffff" />
                  <Text style={styles.actionText} numberOfLines={1}>
                    {action.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>My Dashboard</Text>

        {groups ? (
          groups.map((group) => {
            const open = expanded.includes(group.key);
            return (
              <View key={group.key} style={styles.group}>
                <Pressable
                  onPress={() => toggleGroup(group.key)}
                  style={({ pressed }) => [styles.groupHead, pressed && styles.groupHeadPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={group.label}
                  accessibilityState={{ expanded: open }}
                >
                  <View style={styles.groupIcon}>
                    <Ionicons name={group.icon} size={19} color={PALETTE.primaryDark} />
                  </View>
                  <Text style={styles.groupLabel} numberOfLines={1}>
                    {group.label}
                  </Text>
                  <Text style={styles.groupCount}>{group.items.length}</Text>
                  <Ionicons
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={19}
                    color={SLATE[500]}
                  />
                </Pressable>

                {open ? <View style={styles.groupGrid}>{group.items.map(renderTile)}</View> : null}
              </View>
            );
          })
        ) : (
          <View style={styles.grid}>{config.menu.map(renderTile)}</View>
        )}
      </ScrollView>

      {/* Only shells that declare a chatbot get the launcher — the web mounts Shreya on the two
          teacher dashboards and deliberately not on counsellor / principal / VP. Reaching here at
          all means `verified === true`, which is the web's isVerified gate. */}
      {config.chatbot ? (
        <ShreyaLauncher
          basePath={config.chatbot.basePath}
          isShreya01={!!config.chatbot.isShreya01}
        />
      ) : null}
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
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  actionChipPressed: { backgroundColor: 'rgba(255,255,255,0.26)' },
  actionText: { flex: 1, color: '#ffffff', fontSize: TYPE.label, fontWeight: '600' },
  sectionTitle: {
    fontSize: TYPE.body,
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
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },

  /* Collapsible sections — only rendered when the config declares `groups`. */
  group: { marginHorizontal: SPACING.md, marginBottom: SPACING.sm },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SLATE[200],
    paddingVertical: 11,
    paddingHorizontal: SPACING.md,
    ...SHADOWS.sm,
  },
  groupHeadPressed: { backgroundColor: SLATE[50] },
  groupIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: p.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupLabel: { flex: 1, fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  groupCount: {
    fontSize: TYPE.caption,
    fontWeight: '700',
    color: SLATE[600],
    backgroundColor: SLATE[100],
    borderRadius: 999,
    minWidth: 22,
    textAlign: 'center',
    paddingVertical: 2,
    paddingHorizontal: 7,
    overflow: 'hidden',
  },
  groupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  card: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: SLATE[200],
    ...SHADOWS.sm,
  },
  cardPressed: { backgroundColor: SLATE[50], transform: [{ scale: 0.99 }] },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: p.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  cardLabel: { fontSize: TYPE.heading, fontWeight: '600', color: SLATE[800], lineHeight: leading(TYPE.heading) },
}));
