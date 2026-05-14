// app/student/index.js
// Native student dashboard — dark/futuristic design.
// Fetches live data from /api/students/dashboard; falls back to safe defaults
// while loading or when the API returns an unexpected shape.

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { studentService } from '../../services/studentService';
import { STUDENT } from '../../constants/theme';

const { width } = Dimensions.get('window');

// ─── Quick-action tiles shown on the dashboard ────────────────────────────────
const QUICK_ACTIONS = [
  { icon: '🧠', label: 'Academic IQ', route: '/student/academic', color: '#4F46E5' },
  { icon: '👤', label: 'My Profile', route: '/student/profile', color: '#06b6d4' },
  { icon: '📚', label: 'Resources', route: '/student/resources', color: '#10b981' },
  { icon: '🎯', label: 'Assessments', route: '/student/academic', color: '#f59e0b' },
  { icon: '🏆', label: 'Achievements', route: '/student/profile', color: '#f43f5e' },
  { icon: '🤗', label: 'Counselling', route: '/student/resources', color: '#8b5cf6' },
];

// ─── Fallback stat cards ──────────────────────────────────────────────────────
const DEFAULT_STATS = [
  { icon: '⭐', label: 'Points', value: '—', color: STUDENT.accentGold },
  { icon: '🏅', label: 'Rank', value: '—', color: STUDENT.accentCyan },
  { icon: '🔥', label: 'Streak', value: '—', color: '#f43f5e' },
  { icon: '📝', label: 'Tasks', value: '—', color: STUDENT.accentGreen },
];

function buildStats(data) {
  return [
    {
      icon: '⭐',
      label: 'Points',
      value: data?.points != null ? String(data.points) : '—',
      color: STUDENT.accentGold,
    },
    {
      icon: '🏅',
      label: 'Rank',
      value: data?.rank != null ? `#${data.rank}` : '—',
      color: STUDENT.accentCyan,
    },
    {
      icon: '🔥',
      label: 'Streak',
      value: data?.streak != null ? `${data.streak}d` : '—',
      color: '#f43f5e',
    },
    {
      icon: '📝',
      label: 'Tasks',
      value: data?.pendingTasks != null ? String(data.pendingTasks) : '—',
      color: STUDENT.accentGreen,
    },
  ];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color }) {
  return (
    <View style={[styles.statCard, { borderColor: color + '44' }]}>
      <View style={[styles.statIconBg, { backgroundColor: color + '22' }]}>
        <Text style={styles.statIcon}>{icon}</Text>
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({ icon, label, color, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.quickAction, { borderColor: color + '44' }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.qaIconBg, { backgroundColor: color + '22' }]}>
        <Text style={styles.qaIcon}>{icon}</Text>
      </View>
      <Text style={styles.qaLabel} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}

function AnnouncementCard({ item }) {
  return (
    <View style={styles.announcementCard}>
      <View style={styles.announcementDot} />
      <View style={styles.announcementContent}>
        <Text style={styles.announcementTitle} numberOfLines={2}>{item.title || 'Announcement'}</Text>
        <Text style={styles.announcementBody} numberOfLines={3}>{item.message || item.body || ''}</Text>
        {item.date ? (
          <Text style={styles.announcementDate}>{item.date}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function StudentDashboardScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [dashData, setDashData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await studentService.getDashboard();
      setDashData(data);
    } catch (err) {
      // If it's an auth error, surface it; otherwise show a soft error.
      if (err?.status === 401 || err?.status === 403) {
        setError('Session expired. Please log in again.');
      } else {
        setError(err?.message || 'Could not load dashboard. Pull down to retry.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboard(true);
  }, [fetchDashboard]);

  const studentName =
    dashData?.student?.name ||
    dashData?.name ||
    user?.name ||
    'Student';

  const gradeClass =
    dashData?.student?.class ||
    dashData?.class ||
    dashData?.grade ||
    '';

  const stats = dashData ? buildStats(dashData) : DEFAULT_STATS;
  const announcements = dashData?.announcements || dashData?.notifications || [];

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good day,</Text>
          <Text style={styles.studentName} numberOfLines={1}>{studentName}</Text>
          {gradeClass ? <Text style={styles.gradeTag}>{gradeClass}</Text> : null}
        </View>
        <TouchableOpacity
          style={styles.avatarBtn}
          onPress={() => router.push('/student/profile')}
        >
          <Text style={styles.avatarEmoji}>👤</Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={STUDENT.accent} />
          <Text style={styles.loaderText}>Loading dashboard…</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={STUDENT.accent}
              colors={[STUDENT.accent]}
            />
          }
        >
          {/* ── Error banner ── */}
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>⚠️  {error}</Text>
            </View>
          ) : null}

          {/* ── Welcome card ── */}
          <View style={styles.welcomeCard}>
            <View style={styles.welcomeGlowCircle} />
            <Text style={styles.welcomeTitle}>Welcome back! 🎉</Text>
            <Text style={styles.welcomeSub}>
              Keep pushing your limits. Your future self will thank you.
            </Text>
          </View>

          {/* ── Stat row ── */}
          <Text style={styles.sectionLabel}>Your Progress</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statsRow}
          >
            {stats.map((s, i) => (
              <StatCard key={i} {...s} />
            ))}
          </ScrollView>

          {/* ── Quick actions ── */}
          <Text style={styles.sectionLabel}>Quick Actions</Text>
          <View style={styles.qaGrid}>
            {QUICK_ACTIONS.map((qa, i) => (
              <QuickAction
                key={i}
                icon={qa.icon}
                label={qa.label}
                color={qa.color}
                onPress={() => router.push(qa.route)}
              />
            ))}
          </View>

          {/* ── Announcements ── */}
          <Text style={styles.sectionLabel}>
            Announcements {announcements.length > 0 ? `(${announcements.length})` : ''}
          </Text>
          {announcements.length > 0 ? (
            announcements.slice(0, 5).map((item, i) => (
              <AnnouncementCard key={item.id || item.notificationId || i} item={item} />
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>No announcements right now.</Text>
            </View>
          )}

          {/* ── Bottom padding ── */}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: STUDENT.bg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: STUDENT.border,
  },
  greeting: { fontSize: 13, color: STUDENT.textMuted, fontWeight: '500' },
  studentName: { fontSize: 20, fontWeight: '800', color: STUDENT.textPrimary, maxWidth: width * 0.6 },
  gradeTag: {
    marginTop: 3,
    alignSelf: 'flex-start',
    backgroundColor: STUDENT.accent + '33',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 11,
    color: STUDENT.accent,
    fontWeight: '600',
    overflow: 'hidden',
  },
  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: STUDENT.bgCardAlt,
    borderWidth: 1,
    borderColor: STUDENT.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 22 },

  // Loader
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loaderText: { color: STUDENT.textMuted, fontSize: 14 },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  // Error
  errorBanner: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.4)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: '#f43f5e', fontSize: 13, lineHeight: 18 },

  // Welcome card
  welcomeCard: {
    backgroundColor: STUDENT.bgCardGlow,
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: STUDENT.border,
    overflow: 'hidden',
    position: 'relative',
    ...STUDENT.shadow,
  },
  welcomeGlowCircle: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(79, 70, 229, 0.12)',
    top: -60,
    right: -40,
  },
  welcomeTitle: { fontSize: 18, fontWeight: '800', color: STUDENT.textPrimary, marginBottom: 6 },
  welcomeSub: { fontSize: 13, color: STUDENT.textSecondary, lineHeight: 20 },

  // Section label
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: STUDENT.textPrimary,
    marginBottom: 12,
    marginTop: 4,
  },

  // Stats
  statsRow: { paddingBottom: 16, gap: 12 },
  statCard: {
    width: 88,
    backgroundColor: STUDENT.bgCard,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    ...STUDENT.shadow,
  },
  statIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statIcon: { fontSize: 20 },
  statValue: { fontSize: 17, fontWeight: '800', marginBottom: 2 },
  statLabel: { fontSize: 10, color: STUDENT.textMuted, textAlign: 'center' },

  // Quick actions grid
  qaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  quickAction: {
    width: (width - 52) / 3,
    backgroundColor: STUDENT.bgCard,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  qaIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  qaIcon: { fontSize: 22 },
  qaLabel: { fontSize: 11, color: STUDENT.textSecondary, textAlign: 'center', fontWeight: '600' },

  // Announcements
  announcementCard: {
    backgroundColor: STUDENT.bgCard,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: STUDENT.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  announcementDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: STUDENT.accent,
    marginTop: 5,
    flexShrink: 0,
  },
  announcementContent: { flex: 1 },
  announcementTitle: { fontSize: 14, fontWeight: '700', color: STUDENT.textPrimary, marginBottom: 4 },
  announcementBody: { fontSize: 13, color: STUDENT.textSecondary, lineHeight: 19 },
  announcementDate: { fontSize: 11, color: STUDENT.textMuted, marginTop: 6 },

  // Empty state
  emptyCard: {
    backgroundColor: STUDENT.bgCard,
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: STUDENT.border,
    marginBottom: 16,
  },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyText: { fontSize: 14, color: STUDENT.textMuted },
});
