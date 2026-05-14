// app/student/academic.js
// Native Academic IQ screen — shows subject grades, performance charts,
// and assessment scores pulled from the backend.

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
import { studentService } from '../../services/studentService';
import { STUDENT } from '../../constants/theme';

const { width } = Dimensions.get('window');

// ─── Fallback data (shown when API returns no grades) ─────────────────────────
const SUBJECT_ICONS = {
  Mathematics: '📐',
  Science: '🔬',
  English: '📖',
  History: '🏛️',
  Geography: '🌍',
  Physics: '⚡',
  Chemistry: '🧪',
  Biology: '🌿',
  Computer: '💻',
  'Social Studies': '🌏',
};

function gradeColor(pct) {
  if (pct >= 90) return STUDENT.accentGreen;
  if (pct >= 75) return STUDENT.accent;
  if (pct >= 60) return STUDENT.accentGold;
  return STUDENT.accentRose;
}

function gradeLetter(pct) {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  return 'D';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SubjectGradeCard({ subject, score, maxScore, percentage }) {
  const pct = percentage ?? (maxScore ? Math.round((score / maxScore) * 100) : 0);
  const color = gradeColor(pct);
  const barWidth = `${Math.min(pct, 100)}%`;
  const icon = SUBJECT_ICONS[subject] || '📚';

  return (
    <View style={styles.gradeCard}>
      <View style={styles.gradeCardTop}>
        <View style={styles.gradeSubjectRow}>
          <Text style={styles.subjectIcon}>{icon}</Text>
          <Text style={styles.subjectName} numberOfLines={1}>{subject}</Text>
        </View>
        <View style={[styles.gradeBadge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
          <Text style={[styles.gradeBadgeText, { color }]}>{gradeLetter(pct)}</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: barWidth, backgroundColor: color }]} />
      </View>

      <View style={styles.gradeCardBottom}>
        <Text style={styles.gradeScore}>
          {score != null ? `${score}${maxScore ? `/${maxScore}` : ''}` : '—'}
        </Text>
        <Text style={[styles.gradePct, { color }]}>{pct}%</Text>
      </View>
    </View>
  );
}

function AssessmentCard({ item }) {
  const pct = item.percentage ?? item.score ?? 0;
  const color = gradeColor(pct);
  return (
    <View style={styles.assessCard}>
      <View style={styles.assessLeft}>
        <Text style={styles.assessIcon}>📋</Text>
        <View>
          <Text style={styles.assessTitle} numberOfLines={2}>{item.title || item.name || 'Assessment'}</Text>
          {item.date ? <Text style={styles.assessDate}>{item.date}</Text> : null}
        </View>
      </View>
      <View style={[styles.assessBadge, { backgroundColor: color + '22' }]}>
        <Text style={[styles.assessScore, { color }]}>{pct}%</Text>
      </View>
    </View>
  );
}

function SummaryTile({ icon, label, value, color }) {
  return (
    <View style={[styles.summaryTile, { borderColor: color + '44' }]}>
      <Text style={styles.summaryIcon}>{icon}</Text>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AcademicScreen() {
  const [acadData, setAcadData] = useState(null);
  const [assessData, setAssessData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('grades');

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [acad, assess] = await Promise.allSettled([
        studentService.getAcademicData(),
        studentService.getAssessments(),
      ]);
      if (acad.status === 'fulfilled') setAcadData(acad.value);
      if (assess.status === 'fulfilled') setAssessData(assess.value);
    } catch (err) {
      setError(err?.message || 'Could not load academic data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(true);
  }, [fetchData]);

  const subjects = acadData?.subjects || acadData?.grades || [];
  const assessments = assessData?.assessments || assessData || [];
  const overallPct = acadData?.overallPercentage ?? acadData?.average ?? null;
  const iqScore = acadData?.iqScore ?? acadData?.academicIQ ?? null;
  const rank = acadData?.rank ?? null;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      {/* ── Screen header ── */}
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Academic IQ</Text>
        <Text style={styles.screenSub}>Performance & Assessments</Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={STUDENT.accent} />
          <Text style={styles.loaderText}>Loading academic data…</Text>
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
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>⚠️  {error}</Text>
            </View>
          ) : null}

          {/* ── Summary tiles ── */}
          <View style={styles.summaryRow}>
            <SummaryTile
              icon="📊"
              label="Overall"
              value={overallPct != null ? `${overallPct}%` : '—'}
              color={overallPct != null ? gradeColor(overallPct) : STUDENT.textMuted}
            />
            <SummaryTile
              icon="🧠"
              label="Academic IQ"
              value={iqScore != null ? String(iqScore) : '—'}
              color={STUDENT.accentCyan}
            />
            <SummaryTile
              icon="🏅"
              label="Class Rank"
              value={rank != null ? `#${rank}` : '—'}
              color={STUDENT.accentGold}
            />
          </View>

          {/* ── Tab switcher ── */}
          <View style={styles.tabRow}>
            {['grades', 'assessments'].map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.tabBtn, activeTab === t && styles.tabBtnActive]}
                onPress={() => setActiveTab(t)}
              >
                <Text style={[styles.tabBtnText, activeTab === t && styles.tabBtnTextActive]}>
                  {t === 'grades' ? '📚 Grades' : '📋 Assessments'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Content ── */}
          {activeTab === 'grades' ? (
            subjects.length > 0 ? (
              subjects.map((s, i) => (
                <SubjectGradeCard
                  key={s.id || s.subject || s.name || i}
                  subject={s.subject || s.name || `Subject ${i + 1}`}
                  score={s.score ?? s.marks}
                  maxScore={s.maxScore ?? s.total ?? s.maxMarks}
                  percentage={s.percentage}
                />
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>📚</Text>
                <Text style={styles.emptyTitle}>No grade data yet</Text>
                <Text style={styles.emptyText}>Your subject grades will appear here once available.</Text>
              </View>
            )
          ) : (
            Array.isArray(assessments) && assessments.length > 0 ? (
              assessments.map((a, i) => <AssessmentCard key={a.id || a.assessmentId || i} item={a} />)
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyTitle}>No assessments yet</Text>
                <Text style={styles.emptyText}>Completed assessments and tests will appear here.</Text>
              </View>
            )
          )}

          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: STUDENT.bg },

  screenHeader: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: STUDENT.border,
  },
  screenTitle: { fontSize: 22, fontWeight: '800', color: STUDENT.textPrimary },
  screenSub: { fontSize: 13, color: STUDENT.textMuted, marginTop: 2 },

  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loaderText: { color: STUDENT.textMuted, fontSize: 14 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  errorBanner: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.4)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: '#f43f5e', fontSize: 13 },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  summaryTile: {
    flex: 1,
    backgroundColor: STUDENT.bgCard,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    ...STUDENT.shadow,
  },
  summaryIcon: { fontSize: 22, marginBottom: 6 },
  summaryValue: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
  summaryLabel: { fontSize: 10, color: STUDENT.textMuted, textAlign: 'center' },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    backgroundColor: STUDENT.bgCard,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: STUDENT.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: STUDENT.accent },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: STUDENT.textMuted },
  tabBtnTextActive: { color: '#fff' },

  // Grade cards
  gradeCard: {
    backgroundColor: STUDENT.bgCard,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: STUDENT.border,
  },
  gradeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  gradeSubjectRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  subjectIcon: { fontSize: 20, marginRight: 10 },
  subjectName: { fontSize: 15, fontWeight: '700', color: STUDENT.textPrimary, flex: 1 },
  gradeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: 8,
  },
  gradeBadgeText: { fontSize: 13, fontWeight: '700' },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  gradeCardBottom: { flexDirection: 'row', justifyContent: 'space-between' },
  gradeScore: { fontSize: 13, color: STUDENT.textMuted },
  gradePct: { fontSize: 13, fontWeight: '700' },

  // Assessment cards
  assessCard: {
    backgroundColor: STUDENT.bgCard,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: STUDENT.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  assessLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  assessIcon: { fontSize: 22 },
  assessTitle: { fontSize: 14, fontWeight: '600', color: STUDENT.textPrimary, flex: 1 },
  assessDate: { fontSize: 11, color: STUDENT.textMuted, marginTop: 2 },
  assessBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  assessScore: { fontSize: 14, fontWeight: '700' },

  // Empty state
  emptyCard: {
    backgroundColor: STUDENT.bgCard,
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: STUDENT.border,
    marginBottom: 16,
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: STUDENT.textPrimary, marginBottom: 6 },
  emptyText: { fontSize: 13, color: STUDENT.textMuted, textAlign: 'center', lineHeight: 19 },
});
