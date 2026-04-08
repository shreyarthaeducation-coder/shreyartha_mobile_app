import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, SHADOWS, FONTS } from '../../constants/theme';
import { dashboardService } from '../../services/dashboardService';
import { useAuth } from '../../context/AuthContext';
import LoadingScreen from '../components/LoadingScreen';
import EmptyState from '../components/EmptyState';

const PLACEHOLDER = {
  stats: [
    { label: 'Children', value: '—', icon: '👶' },
    { label: 'Avg. Score', value: '—', icon: '📊' },
    { label: 'Sessions', value: '—', icon: '🗓️' },
    { label: 'Alerts', value: '—', icon: '🔔' },
  ],
};

export default function ParentDashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);
      const result = await dashboardService.getParentDashboard();
      setData(result);
    } catch (e) {
      if (!isRefresh) setError(e?.message || 'Could not load dashboard data');
      setData(PLACEHOLDER);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(true); }, [load]);

  const handleLogout = async () => {
    await logout();
    router.replace('/(tabs)');
  };

  const displayName = user?.name || user?.email || 'Parent';
  const stats = data?.stats || PLACEHOLDER.stats;
  const children = data?.children || [];
  const alerts = data?.alerts || [];

  if (loading) return <LoadingScreen message="Loading parent dashboard…" />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={[styles.header, { backgroundColor: '#0d7377' }]}>
        <View>
          <Text style={styles.greeting}>Parent Dashboard</Text>
          <Text style={styles.userName}>{displayName}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />
        }
      >
        {error ? (
          <View style={styles.inlineError}>
            <Text style={styles.inlineErrorText}>⚠️ {error}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>Family Overview</Text>
        <View style={styles.statsGrid}>
          {stats.map((stat, i) => (
            <View key={i} style={[styles.statCard, SHADOWS.sm]}>
              <Text style={styles.statIcon}>{stat.icon}</Text>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>My Children</Text>
        {children.length === 0 ? (
          <EmptyState icon="👶" title="No children linked" message="Contact the school to link your child's profile." />
        ) : (
          children.map((child, i) => (
            <View key={i} style={[styles.listCard, SHADOWS.sm]}>
              <Text style={styles.listIcon}>🎒</Text>
              <View style={styles.listInfo}>
                <Text style={styles.listTitle}>{child.name}</Text>
                {child.class ? <Text style={styles.listSub}>Class {child.class} • {child.school || ''}</Text> : null}
              </View>
              {child.score !== undefined ? (
                <Text style={[styles.listBadge, { color: child.score >= 75 ? COLORS.success : COLORS.primary }]}>
                  {child.score}%
                </Text>
              ) : null}
            </View>
          ))
        )}

        {alerts.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Alerts & Notifications</Text>
            {alerts.map((alert, i) => (
              <View key={i} style={[styles.alertCard, SHADOWS.sm]}>
                <Text style={styles.alertIcon}>{alert.icon || '🔔'}</Text>
                <View style={styles.listInfo}>
                  <Text style={styles.listTitle}>{alert.title || alert.message}</Text>
                  {alert.date ? <Text style={styles.listSub}>{alert.date}</Text> : null}
                </View>
              </View>
            ))}
          </>
        ) : null}

        <Text style={styles.sectionLabel}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          {[
            { label: 'Progress Tracking', icon: '📈', route: '/pages/progress-tracking' },
            { label: 'Counselling', icon: '🧭', route: '/pages/counselling' },
            { label: 'Global Opportunities', icon: '✈️', route: '/pages/global-opportunities' },
            { label: 'Shreyartha Store', icon: '🛒', route: '/pages/store' },
          ].map((item, i) => (
            <TouchableOpacity key={i} style={[styles.quickCard, SHADOWS.sm]} onPress={() => router.push(item.route)}>
              <Text style={styles.quickIcon}>{item.icon}</Text>
              <Text style={styles.quickLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
  },
  greeting: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  userName: { color: COLORS.white, fontWeight: '700', fontSize: 18 },
  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16 },
  logoutText: { color: COLORS.white, fontWeight: '600', fontSize: 13 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: SPACING.xxl },
  inlineError: { backgroundColor: '#fff3f5', marginHorizontal: SPACING.md, marginTop: SPACING.md, padding: SPACING.sm, borderRadius: 8 },
  inlineErrorText: { color: COLORS.error, fontSize: 13 },
  sectionLabel: { ...FONTS.bold, fontSize: 16, color: COLORS.secondary, marginHorizontal: SPACING.md, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SPACING.sm },
  statCard: { width: '47%', margin: '1.5%', backgroundColor: COLORS.white, borderRadius: 16, padding: SPACING.md, alignItems: 'center' },
  statIcon: { fontSize: 28, marginBottom: SPACING.xs },
  statValue: { ...FONTS.bold, fontSize: 24, color: '#0d7377', marginBottom: 2 },
  statLabel: { ...FONTS.small, textAlign: 'center', color: COLORS.textSecondary },
  listCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, marginHorizontal: SPACING.md, marginBottom: SPACING.sm, borderRadius: 14, padding: SPACING.md },
  alertCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff8e1', marginHorizontal: SPACING.md, marginBottom: SPACING.sm, borderRadius: 14, padding: SPACING.md },
  listIcon: { fontSize: 28, marginRight: SPACING.md },
  alertIcon: { fontSize: 28, marginRight: SPACING.md },
  listInfo: { flex: 1 },
  listTitle: { ...FONTS.bold, fontSize: 14, color: COLORS.secondary },
  listSub: { ...FONTS.small, color: COLORS.textLight, marginTop: 2 },
  listBadge: { fontWeight: '700', fontSize: 15 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SPACING.sm },
  quickCard: { width: '47%', margin: '1.5%', backgroundColor: COLORS.white, borderRadius: 14, padding: SPACING.md, alignItems: 'center' },
  quickIcon: { fontSize: 28, marginBottom: SPACING.xs },
  quickLabel: { ...FONTS.small, color: COLORS.textSecondary, textAlign: 'center' },
});
