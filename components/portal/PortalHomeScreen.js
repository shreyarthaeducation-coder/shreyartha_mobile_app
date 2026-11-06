import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FEEDBACK, SLATE, SPACING, TOUCH, TYPE, leading } from '../../constants/theme';
import { PARENT_HUES } from '../../constants/parentColours';
import { usePalette } from '../ui/PaletteContext';
import BrandBar from '../shared/home/BrandBar';
import ChangePasswordRow from '../shared/home/ChangePasswordRow';
import usePortalLogout from '../../hooks/usePortalLogout';
import { makeStyles } from '../../utils/makeStyles';

const HUE_ORDER = ['violet', 'blue', 'teal', 'amber', 'rose', 'green'];

/**
 * The home of a portal carried over from the website (5 Nov 2026) — Alumni, University, University
 * Staff, Industry, Investor. A welcome card in the portal's own colours, then every section of the
 * website's sidebar as a tile (in the website's order and words), Change Password where the portal
 * has one, and Log Out.
 *
 * Props:
 *   portalLabel           "Alumni", "Industry"… under the name
 *   nameKey               the storage key holding the signed-in name
 *   tiles                 `[{ key, label, icon, route, blurb }]`
 *   stats                 optional `[{ label, value }]` (already loaded by the caller)
 *   onRefresh             optional, for pull-to-refresh of `stats`
 *   changePasswordRoute   optional
 *   intro                 optional line under the welcome
 */
export default function PortalHomeScreen({
  portalLabel,
  nameKey,
  tiles = [],
  stats,
  onRefresh,
  changePasswordRoute,
  intro,
  children,
}) {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const [name, setName] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const { confirmLogout } = usePortalLogout({ loginRoute: '/auth/sign-in' });

  useEffect(() => {
    AsyncStorage.getItem(nameKey).then((v) => setName(v || '')).catch(() => {});
  }, [nameKey]);

  const refresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <BrandBar tone="light" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.primary} /> : undefined}
      >
        <LinearGradient colors={palette.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.hello}>Welcome</Text>
          <Text style={styles.name} numberOfLines={2}>
            {name || portalLabel}
          </Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{portalLabel}</Text>
          </View>
          {intro ? <Text style={styles.intro}>{intro}</Text> : null}
        </LinearGradient>

        {stats?.length ? (
          <View style={styles.stats}>
            {stats.map((s, i) => {
              const hue = PARENT_HUES[HUE_ORDER[i % HUE_ORDER.length]];
              return (
                <View key={s.label} style={[styles.stat, { backgroundColor: hue.bg, borderColor: hue.border }]}>
                  <Text style={[styles.statValue, { color: hue.fg }]}>{s.value ?? '—'}</Text>
                  <Text style={styles.statLabel} numberOfLines={2}>
                    {s.label}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {children}

        {tiles.length ? <Text style={styles.sectionTitle}>Sections</Text> : null}
        <View style={styles.grid}>
          {tiles.map((tile, i) => {
            const hue = PARENT_HUES[HUE_ORDER[i % HUE_ORDER.length]];
            return (
              <Pressable
                key={tile.key}
                onPress={() => router.push(tile.route)}
                style={({ pressed }) => [styles.tile, { borderColor: hue.border }, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={tile.label}
              >
                <View style={[styles.tileIcon, { backgroundColor: hue.bg }]}>
                  <Ionicons name={tile.icon} size={20} color={hue.fg} />
                </View>
                <Text style={styles.tileLabel} numberOfLines={2}>
                  {tile.label}
                </Text>
                {tile.blurb ? (
                  <Text style={styles.tileBlurb} numberOfLines={2}>
                    {tile.blurb}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {changePasswordRoute ? <ChangePasswordRow route={changePasswordRoute} /> : null}

        <Pressable
          onPress={confirmLogout}
          style={({ pressed }) => [styles.logout, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Log out"
        >
          <Ionicons name="log-out-outline" size={20} color={FEEDBACK.errorText} />
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((p) => ({
  safe: { flex: 1, backgroundColor: SLATE[50] },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xl * 2 },
  hero: { borderRadius: 20, padding: SPACING.lg, marginBottom: SPACING.md },
  hello: { fontSize: TYPE.label, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  name: { fontSize: TYPE.title, fontWeight: '800', color: '#ffffff', marginTop: 2 },
  badge: { alignSelf: 'flex-start', marginTop: SPACING.sm, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.2)' },
  badgeText: { fontSize: TYPE.caption, fontWeight: '800', color: '#ffffff' },
  intro: { fontSize: TYPE.body, color: 'rgba(255,255,255,0.92)', marginTop: SPACING.sm, lineHeight: leading(TYPE.body) },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  stat: { flexGrow: 1, flexBasis: '46%', borderRadius: 14, borderWidth: 1, padding: SPACING.md },
  statValue: { fontSize: TYPE.headline, fontWeight: '800' },
  statLabel: { fontSize: TYPE.caption, color: SLATE[600], marginTop: 2 },
  sectionTitle: { fontSize: TYPE.label, fontWeight: '800', color: SLATE[500], textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: SPACING.sm, marginBottom: SPACING.md },
  tile: {
    width: '48.5%',
    minHeight: TOUCH.min * 2,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    padding: SPACING.md,
  },
  tileIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm },
  tileLabel: { fontSize: TYPE.heading, fontWeight: '800', color: SLATE[800], lineHeight: leading(TYPE.heading) },
  tileBlurb: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 2 },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    minHeight: TOUCH.min,
    borderRadius: 14,
    backgroundColor: FEEDBACK.errorBg,
    marginTop: SPACING.md,
  },
  logoutText: { fontSize: TYPE.heading, fontWeight: '800', color: FEEDBACK.errorText },
  pressed: { opacity: 0.8 },
}));
