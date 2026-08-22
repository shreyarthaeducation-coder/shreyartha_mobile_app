import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { Card, CardTitle, ScreenScaffold, useToast } from '../../ui';
import useStaffResource from '../../../hooks/useStaffResource';
import {
  MAX_LOGO_BYTES,
  STAT_SECTIONS,
  fetchDashboardStats,
  removeSchoolLogo,
  uploadSchoolLogo,
} from '../../../services/admin/overviewService';
import { pickPhoto } from '../../../utils/filePicker';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * Dashboard Overview — the admin-flavoured panels' landing page.
 *
 * The web splits this in two: PrincipalDashboard fetches `/classes/dashboard-stats` and passes
 * `stats` down, and the page renders it. There is no equivalent shell here — the native menu grid
 * must not block on a stats call — so this screen owns the fetch and its own refresh.
 *
 * Five stat groups, each three cards, then the school logo control. `STAT_SECTIONS` holds the
 * layout as data; see overviewService for why the "View All" targets differ from the web's.
 */

const TONE = {
  total: { bg: SLATE[100], text: SLATE[800], border: SLATE[200] },
  success: { bg: FEEDBACK.successBg, text: FEEDBACK.successText, border: FEEDBACK.successBorder },
  warning: { bg: FEEDBACK.warningBg, text: FEEDBACK.warningText, border: FEEDBACK.warningBorder },
};

function StatCard({ label, value, tone }) {
  const styles = useStyles();
  const palette = TONE[tone] || TONE.total;
  return (
    <View style={[styles.statCard, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={[styles.statValue, { color: palette.text }]}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

export default function AdminOverviewScreen({ homeRoute, apiBase, staffRoute, studentsRoute }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [busy, setBusy] = useState(false);

  const fetcher = useCallback((signal) => fetchDashboardStats(apiBase, signal), [apiBase]);
  const { data, loading, error, refreshing, reload, refresh, revalidate } = useStaffResource(
    fetcher,
    { initialData: null },
  );

  const stats = data || {};

  const openSection = (section) => {
    if (!section.staffType) {
      if (studentsRoute) router.push(studentsRoute);
      return;
    }
    if (staffRoute) router.push({ pathname: staffRoute, params: { type: section.staffType } });
  };

  const changeLogo = async () => {
    const file = await pickPhoto();
    if (!file) return;
    if (file.denied) {
      showToast('Photo permission is needed to change the logo.', 'error');
      return;
    }
    // The web checks the size before uploading and so do we — S3StorageService rejects it anyway,
    // but a 5 MB round trip on mobile data before the error is a poor trade.
    if (file.size != null && file.size > MAX_LOGO_BYTES) {
      showToast('Image is too large (max 5 MB).', 'error');
      return;
    }
    setBusy(true);
    try {
      await uploadSchoolLogo(apiBase, file);
      showToast('Logo updated.', 'success');
      await revalidate();
    } catch (e) {
      showToast(e?.message || 'Failed to upload logo.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const clearLogo = async () => {
    setBusy(true);
    try {
      await removeSchoolLogo(apiBase);
      showToast('Logo removed.', 'success');
      await revalidate();
    } catch (e) {
      showToast(e?.message || 'Failed to remove logo.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenScaffold
      title="Dashboard Overview"
      fallbackRoute={homeRoute}
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
      toast={toast}
    >
      <Card>
        <View style={styles.identity}>
          <View style={styles.logoBox}>
            {stats.schoolLogo ? (
              <Image source={{ uri: stats.schoolLogo }} style={styles.logo} resizeMode="contain" />
            ) : (
              <Ionicons name="business-outline" size={30} color={SLATE[400]} />
            )}
          </View>
          <View style={styles.identityText}>
            <Text style={styles.schoolName} numberOfLines={2}>
              {stats.schoolName || 'Your school'}
            </Text>
            <View style={styles.badgeRow}>
              {stats.schoolCode ? (
                <Text style={styles.badge}>Code: {stats.schoolCode}</Text>
              ) : null}
              {stats.schoolBoard ? <Text style={styles.badge}>{stats.schoolBoard}</Text> : null}
            </View>
          </View>
        </View>

        <View style={styles.logoActions}>
          <Pressable
            onPress={changeLogo}
            disabled={busy}
            style={({ pressed }) => [
              styles.logoBtn,
              { backgroundColor: PALETTE.primary },
              (pressed || busy) && styles.pressed,
            ]}
            accessibilityRole="button"
          >
            {busy ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.logoBtnText}>
                {stats.schoolLogo ? 'Change logo' : 'Upload school logo'}
              </Text>
            )}
          </Pressable>
          {stats.schoolLogo ? (
            <Pressable
              onPress={clearLogo}
              disabled={busy}
              style={({ pressed }) => [styles.logoGhost, (pressed || busy) && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.logoGhostText}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      </Card>

      {STAT_SECTIONS.map((section) => (
        <Card key={section.key} style={styles.section}>
          <Pressable
            onPress={() => openSection(section)}
            style={({ pressed }) => [styles.sectionHead, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Ionicons name={section.icon} size={17} color={PALETTE.primaryDark} />
            <CardTitle style={styles.sectionTitle}>{section.title}</CardTitle>
            <Ionicons name="chevron-forward" size={17} color={SLATE[400]} />
          </Pressable>
          <View style={styles.statRow}>
            {section.cards.map((card) => (
              <StatCard
                key={card.field}
                label={card.label}
                value={stats[card.field] || 0}
                tone={card.tone}
              />
            ))}
          </View>
        </Card>
      ))}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  identity: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  logoBox: {
    width: 62,
    height: 62,
    borderRadius: 12,
    backgroundColor: SLATE[50],
    borderWidth: 1,
    borderColor: SLATE[200],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: { width: '100%', height: '100%' },
  identityText: { flex: 1 },
  schoolName: { fontSize: 16, fontWeight: '800', color: SLATE[800] },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 },
  badge: {
    fontSize: 11.5,
    fontWeight: '700',
    color: p.primaryDark,
    backgroundColor: p.tint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  logoActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: SPACING.sm },
  logoBtn: {
    flex: 1,
    borderRadius: 9,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  logoBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13.5 },
  logoGhost: {
    borderRadius: 9,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: SLATE[200],
  },
  logoGhostText: { color: SLATE[600], fontWeight: '700', fontSize: 13.5 },
  pressed: { opacity: 0.7 },
  section: { marginTop: SPACING.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { flex: 1, marginBottom: 0 },
  statRow: { flexDirection: 'row', gap: 8, marginTop: SPACING.sm },
  statCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, color: SLATE[500], textAlign: 'center', marginTop: 3, fontWeight: '600' },
}));
