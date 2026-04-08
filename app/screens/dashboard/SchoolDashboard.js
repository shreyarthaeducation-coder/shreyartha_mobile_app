import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, SHADOWS, FONTS } from '../../../constants/theme';
import { dashboardService } from '../../../services/dashboardService';
import { useAuth } from '../../../context/AuthContext';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';

const PLACEHOLDER = {
  stats: [
    { label: 'Total Students', value: '—', icon: '🎓' },
    { label: 'Teachers', value: '—', icon: '👨‍🏫' },
    { label: 'Active Classes', value: '—', icon: '🏫' },
    { label: 'Avg. Score', value: '—', icon: '📊' },
  ],
};

export default function SchoolDashboard() {
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
      const result = await dashboardService.getSchoolDashboard();
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
    router.replace('/');
  };

  const displayName = user?.school_name || user?.name || user?.email || 'School';
  const stats = data?.stats || PLACEHOLDER.stats;
  const recentStudents = data?.recent_students || data?.recentStudents || [];
  const announcements = data?.announcements || [];

  if (loading) return <LoadingScreen message="Loading school dashboard…" />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLORS.secondary }]}>
        <View>
          <Text style={styles.greeting}>School Dashboard</Text>
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

        <Text style={styles.sectionLabel}>School Overview</Text>
        <View style={styles.statsGrid}>
          {stats.map((stat, i) => (
            <View key={i} style={[styles.statCard, SHADOWS.sm]}>
              <Text style={styles.statIcon}>{stat.icon}</Text>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {announcements.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Announcements</Text>
            {announcements.map((item, i) => (
              <View key={i} style={[styles.listCard, SHADOWS.sm]}>
                <Text style={styles.listIcon}>📢</Text>
                <View style={styles.listInfo}>
                  <Text style={styles.listTitle}>{item.title}</Text>
                  {item.date ? <Text style={styles.listSub}>{item.date}</Text> : null}
                </View>
              </View>
            ))}
          </>
        ) : null}

        <Text style={styles.sectionLabel}>Recent Students</Text>
        {recentStudents.length === 0 ? (
          <EmptyState icon="🎓" title="No student data" message="Student activity will appear here once available." />
        ) : (
          recentStudents.map((s, i) => (
            <View key={i} style={[styles.listCard, SHADOWS.sm]}>
              <Text style={styles.listIcon}>👤</Text>
              <View style={styles.listInfo}>
                <Text style={styles.listTitle}>{s.name}</Text>
                {s.class ? <Text style={styles.listSub}>Class {s.class}</Text> : null}
              </View>
              {s.score !== undefined ? (
                <Text style={styles.listBadge}>{s.score}%</Text>
              ) : null}
            </View>
          ))
        )}

        <Text style={styles.sectionLabel}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          {[
            { label: 'Progress Reports', icon: '📈', route: '/webpages/progress-tracking' },
            { label: 'Counselling', icon: '🧭', route: '/webpages/counselling' },
            { label: 'Competitive Exams', icon: '🏆', route: '/webpages/competitive-examination' },
            { label: 'AI & Coding', icon: '🤖', route: '/webpages/coding-ai-robotics' },
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
  statValue: { ...FONTS.bold, fontSize: 24, color: COLORS.secondary, marginBottom: 2 },
  statLabel: { ...FONTS.small, textAlign: 'center', color: COLORS.textSecondary },
  listCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, marginHorizontal: SPACING.md, marginBottom: SPACING.sm, borderRadius: 14, padding: SPACING.md },
  listIcon: { fontSize: 28, marginRight: SPACING.md },
  listInfo: { flex: 1 },
  listTitle: { ...FONTS.bold, fontSize: 14, color: COLORS.secondary },
  listSub: { ...FONTS.small, color: COLORS.textLight, marginTop: 2 },
  listBadge: { backgroundColor: COLORS.surface, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, fontWeight: '700', color: COLORS.primary, fontSize: 13 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SPACING.sm },
  quickCard: { width: '47%', margin: '1.5%', backgroundColor: COLORS.white, borderRadius: 14, padding: SPACING.md, alignItems: 'center' },
  quickIcon: { fontSize: 28, marginBottom: SPACING.xs },
  quickLabel: { ...FONTS.small, color: COLORS.textSecondary, textAlign: 'center' },
});
