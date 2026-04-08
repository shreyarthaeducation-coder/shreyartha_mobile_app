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
import ErrorScreen from '../../components/ErrorScreen';
import EmptyState from '../../components/EmptyState';

const PLACEHOLDER = {
  stats: [
    { label: 'Courses Enrolled', value: '—', icon: '📚' },
    { label: 'Avg. Score', value: '—', icon: '📊' },
    { label: 'Badges Earned', value: '—', icon: '🏅' },
    { label: 'Sessions Done', value: '—', icon: '✅' },
  ],
  recentActivity: [],
};

export default function StudentDashboard() {
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
      const result = await dashboardService.getStudentDashboard();
      setData(result);
    } catch (e) {
      // Show placeholder UI even on API error; surface message for non-refresh loads
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

  const displayName = user?.name || user?.email || 'Student';
  const stats = data?.stats || PLACEHOLDER.stats;
  const recentActivity = data?.recentActivity || data?.recent_activity || [];
  const courses = data?.courses || data?.enrolled_courses || [];

  if (loading) return <LoadingScreen message="Loading your dashboard…" />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back 👋</Text>
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {error ? (
          <View style={styles.inlineError}>
            <Text style={styles.inlineErrorText}>⚠️ {error}</Text>
          </View>
        ) : null}

        {/* Stats row */}
        <Text style={styles.sectionLabel}>Your Progress</Text>
        <View style={styles.statsGrid}>
          {stats.map((stat, i) => (
            <View key={i} style={[styles.statCard, SHADOWS.sm]}>
              <Text style={styles.statIcon}>{stat.icon}</Text>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Courses */}
        <Text style={styles.sectionLabel}>My Courses</Text>
        {courses.length === 0 ? (
          <EmptyState icon="📚" title="No courses yet" message="Explore services and enrol in a course to get started." />
        ) : (
          courses.map((course, i) => (
            <View key={i} style={[styles.activityCard, SHADOWS.sm]}>
              <Text style={styles.activityIcon}>{course.icon || '📖'}</Text>
              <View style={styles.activityInfo}>
                <Text style={styles.activityTitle}>{course.title || course.name}</Text>
                {course.progress !== undefined ? (
                  <>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${course.progress}%` }]} />
                    </View>
                    <Text style={styles.progressText}>{course.progress}% complete</Text>
                  </>
                ) : null}
              </View>
            </View>
          ))
        )}

        {/* Recent activity */}
        {recentActivity.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Recent Activity</Text>
            {recentActivity.map((item, i) => (
              <View key={i} style={[styles.activityCard, SHADOWS.sm]}>
                <Text style={styles.activityIcon}>{item.icon || '🕒'}</Text>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityTitle}>{item.title || item.name}</Text>
                  {item.date ? <Text style={styles.activityDate}>{item.date}</Text> : null}
                </View>
              </View>
            ))}
          </>
        ) : null}

        {/* Quick actions */}
        <Text style={styles.sectionLabel}>Quick Access</Text>
        <View style={styles.quickGrid}>
          {[
            { label: 'Explore Services', icon: '🔍', route: '/' },
            { label: 'My Profile', icon: '👤', route: '/auth/student-login' },
            { label: 'Assessments', icon: '📝', route: '/webpages/learning-assessment' },
            { label: 'Counselling', icon: '🧭', route: '/webpages/counselling' },
          ].map((item, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.quickCard, SHADOWS.sm]}
              onPress={() => router.push(item.route)}
            >
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  greeting: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  userName: { color: COLORS.white, fontWeight: '700', fontSize: 18 },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  logoutText: { color: COLORS.white, fontWeight: '600', fontSize: 13 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: SPACING.xxl },
  inlineError: {
    backgroundColor: '#fff3f5',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    padding: SPACING.sm,
    borderRadius: 8,
  },
  inlineErrorText: { color: COLORS.error, fontSize: 13 },
  sectionLabel: {
    ...FONTS.bold,
    fontSize: 16,
    color: COLORS.secondary,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.sm,
  },
  statCard: {
    width: '47%',
    margin: '1.5%',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.md,
    alignItems: 'center',
  },
  statIcon: { fontSize: 28, marginBottom: SPACING.xs },
  statValue: { ...FONTS.bold, fontSize: 24, color: COLORS.primary, marginBottom: 2 },
  statLabel: { ...FONTS.small, textAlign: 'center', color: COLORS.textSecondary },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: 14,
    padding: SPACING.md,
  },
  activityIcon: { fontSize: 28, marginRight: SPACING.md },
  activityInfo: { flex: 1 },
  activityTitle: { ...FONTS.bold, fontSize: 14, color: COLORS.secondary, marginBottom: 4 },
  activityDate: { ...FONTS.small, color: COLORS.textLight },
  progressBar: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  progressText: { ...FONTS.small, color: COLORS.textSecondary },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.sm,
  },
  quickCard: {
    width: '47%',
    margin: '1.5%',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: SPACING.md,
    alignItems: 'center',
  },
  quickIcon: { fontSize: 28, marginBottom: SPACING.xs },
  quickLabel: { ...FONTS.small, color: COLORS.textSecondary, textAlign: 'center' },
});
