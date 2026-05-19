import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { API_BASE_URL } from '../../services/apiService';
import { studentService } from '../../services/studentService';
import { STUDENT } from '../../constants/theme';

const GREEN_ACCENT = '#16a34a';
const arr = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const unwrap = (value) => (value?.data && typeof value.data === 'object' ? value.data : value || {});
const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};
const toPercent = (value) => {
  const numeric = toNumber(value);
  if (numeric == null) return null;
  if (numeric <= 1 && numeric >= 0) return Math.round(numeric * 100);
  return Math.max(0, Math.min(100, Math.round(numeric)));
};
const toTitle = (value, fallback) => String(value || '').trim() || fallback;
const compactText = (value, fallback = '—') => {
  const text = String(value || '').trim();
  return text || fallback;
};
const resolveMediaUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (raw.startsWith('/')) return `${API_BASE_URL}${raw}`;
  return `${API_BASE_URL}/${raw.replace(/^\/+/, '')}`;
};

function ProgressBar({ value, color = GREEN_ACCENT, height = 8, trackStyle }) {
  const pct = toPercent(value) ?? 0;
  return (
    <View style={[styles.progressTrack, { height, borderRadius: height / 2 }, trackStyle]}>
      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: color, borderRadius: height / 2 }]} />
    </View>
  );
}

function SectionCard({ title, children, right, accent = GREEN_ACCENT }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderTitleWrap}>
          <View style={[styles.cardAccent, { backgroundColor: accent }]} />
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

function CollapsibleCard({ title, open, onToggle, children, summary, accent }) {
  return (
    <SectionCard
      title={title}
      accent={accent}
      right={
        <TouchableOpacity style={styles.collapseBtn} onPress={onToggle}>
          <Text style={styles.collapseBtnText}>{open ? 'Hide' : 'Show'}</Text>
        </TouchableOpacity>
      }
    >
      {summary ? <Text style={styles.sectionSummary}>{summary}</Text> : null}
      {open ? children : null}
    </SectionCard>
  );
}

function MetricChip({ label, value }) {
  return (
    <View style={styles.metricChip}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function EmptyState({ text = 'No data available yet' }) {
  return <Text style={styles.emptyText}>{text}</Text>;
}

function normalizeStudentProfile(profile, analytics) {
  const source = { ...unwrap(profile), ...unwrap(analytics) };
  return {
    name: source.fullName || source.name || source.studentName,
    currentClass: source.currentClass || source.className || source.class,
    schoolName: source.schoolName || source.school?.name || source.school,
    stream: source.stream,
    avatar: resolveMediaUrl(source.profilePictureUrl || source.pictureUrl || source.avatar),
  };
}

function normalizeSyllabus(data) {
  const source = unwrap(data);
  const rawSubjects = arr(
    source.subjects
    || source.subjectWiseCompletion
    || source.subjectWise
    || source.subjectCompletion
    || source.breakdown
  );
  const subjects = rawSubjects.map((subject, index) => {
    const item = unwrap(subject);
    const percent = toPercent(
      item.percentage
      ?? item.completionPercentage
      ?? item.completedPercentage
      ?? item.progress
      ?? item.completion
    );
    const totalTopics = toNumber(item.totalTopics ?? item.total ?? item.topicCount ?? item.totalCount);
    const completedTopics = toNumber(item.completedTopics ?? item.completed ?? item.completedCount);
    const pendingTopics = toNumber(
      item.pendingTopics
      ?? item.notCompletedTopics
      ?? item.remainingTopics
      ?? (totalTopics != null && completedTopics != null ? totalTopics - completedTopics : null)
    );
    return {
      id: String(item.id ?? item.subjectId ?? index),
      name: toTitle(item.subjectName || item.name || item.subject || item.title, `Subject ${index + 1}`),
      percent: percent ?? 0,
      totalTopics,
      completedTopics,
      pendingTopics,
    };
  });

  const overall = toPercent(
    source.overallCompletion
    ?? source.overallCompletionPercentage
    ?? source.overallPercentage
    ?? source.completionPercentage
    ?? source.percentage
    ?? source.progress
  ) ?? (subjects.length ? Math.round(subjects.reduce((sum, subject) => sum + subject.percent, 0) / subjects.length) : 0);

  const totalTopics = toNumber(source.totalTopics ?? source.totalTopicCount) ?? subjects.reduce((sum, subject) => sum + (subject.totalTopics || 0), 0);
  const completedTopics = toNumber(source.completedTopics ?? source.completedTopicCount) ?? subjects.reduce((sum, subject) => sum + (subject.completedTopics || 0), 0);
  const pendingTopics = toNumber(source.notCompletedTopics ?? source.pendingTopics ?? source.remainingTopics)
    ?? (totalTopics != null && completedTopics != null ? Math.max(totalTopics - completedTopics, 0) : null);

  return { overall, totalTopics, completedTopics, pendingTopics, subjects };
}

function normalizeProgress(data) {
  const source = unwrap(data);
  const items = arr(source.modules || source.progress || source.items || source.sections || source.subjects || source.data || source)
    .map((entry, index) => {
      const item = unwrap(entry);
      return {
        id: String(item.id ?? item.moduleId ?? item.subjectId ?? index),
        title: toTitle(item.moduleName || item.title || item.name || item.subjectName, `Module ${index + 1}`),
        subtitle: compactText(item.description || item.status || item.stage || item.level, ''),
        percent: toPercent(item.percentage ?? item.progress ?? item.completedPercentage ?? item.completion) ?? 0,
        completed: toNumber(item.completed ?? item.completedCount ?? item.completedTopics),
        total: toNumber(item.total ?? item.totalCount ?? item.totalTopics),
      };
    })
    .filter((item) => item.title);
  return items;
}

function normalizeCompetitiveAnalytics(data) {
  const source = unwrap(data);
  const exams = arr(source.exams || source.examAnalytics || source.analytics || source.data || source.results)
    .map((entry, index) => {
      const item = unwrap(entry);
      return {
        id: String(item.id ?? item.examId ?? index),
        name: toTitle(item.examName || item.name || item.title, `Exam ${index + 1}`),
        score: item.score ?? item.marks ?? item.correctAnswers ?? item.rank ?? '—',
        accuracy: toPercent(item.accuracy ?? item.percentage ?? item.progress),
        attempts: toNumber(item.attempts ?? item.testsAttempted ?? item.mockTestsAttempted),
      };
    })
    .filter((exam) => exam.name);
  const hasExam = source.hasExam ?? source.isExamStudent ?? (exams.length > 0);
  return { hasExam, exams };
}

function normalizeAreaAnalytics(title, payload, fallback = {}) {
  const source = unwrap(payload);
  const titleValue = title;
  const percent = toPercent(
    source.percentage
    ?? source.progress
    ?? source.completionPercentage
    ?? source.completedPercentage
    ?? source.average
    ?? fallback.percentage
  );
  const primaryValue = percent != null
    ? `${percent}%`
    : compactText(source.score ?? source.completed ?? source.count ?? source.totalCompleted ?? fallback.primaryValue, '—');
  const secondary = compactText(
    source.description
    || source.summary
    || source.status
    || source.message
    || fallback.secondary,
    'No data available yet'
  );
  return {
    title: titleValue,
    primaryValue,
    secondary,
    percent,
  };
}

async function fetchPsychometricFallback() {
  const categoriesResponse = await studentService.getPsychometricCategories();
  const categories = arr(unwrap(categoriesResponse).categories || unwrap(categoriesResponse));
  if (!categories.length) return {};

  const results = await Promise.allSettled(
    categories.map((category) => studentService.getPsychometricResult(category.id || category.categoryId || category.key))
  );
  const resolved = results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => unwrap(result.value));
  const percentages = resolved
    .map((item) => toPercent(item.percentage ?? item.score ?? item.progress))
    .filter((value) => value != null);
  return {
    totalCompleted: resolved.length,
    count: categories.length,
    percentage: percentages.length ? Math.round(percentages.reduce((sum, value) => sum + value, 0) / percentages.length) : null,
    summary: resolved.length ? `${resolved.length} assessments completed` : 'No completed assessments yet',
  };
}

async function fetchSkillsEdgeFallback() {
  const [profileResponse, treeResponse] = await Promise.all([
    studentService.getSkillsProfile().catch(() => ({})),
    studentService.getSkillsEdgeTree().catch(() => ([])),
  ]);
  const profile = unwrap(profileResponse);
  const tree = arr(unwrap(treeResponse).skills || unwrap(treeResponse).categories || unwrap(treeResponse).nodes || unwrap(treeResponse));
  const selected = arr(profile.selectedSkillIds || profile.skillIds || profile.selectedSkills);
  return {
    completed: selected.length,
    count: tree.length || selected.length,
    summary: selected.length ? `${selected.length} skill areas selected` : 'No skill selections saved yet',
    percentage: tree.length ? Math.round((selected.length / tree.length) * 100) : null,
  };
}

async function fetchCodingProFallback(profile) {
  const classValue = profile?.currentClass ? String(profile.currentClass) : undefined;
  const [treeResponse, projectsResponse] = await Promise.all([
    studentService.getCodingProTree().catch(() => ([])),
    studentService.getCodingProProjects({ classValue }).catch(() => ([])),
  ]);
  const tracks = arr(unwrap(treeResponse).streams || unwrap(treeResponse).topics || unwrap(treeResponse));
  const projects = arr(unwrap(projectsResponse).projects || unwrap(projectsResponse));
  return {
    count: tracks.length || null,
    completed: projects.length || null,
    summary: projects.length ? `${projects.length} project resources available` : 'No coding projects available yet',
    percentage: tracks.length && projects.length ? Math.round((projects.length / tracks.length) * 100) : null,
  };
}

export default function MyAnalyticsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState({ subjects: false, progress: true, exams: true });
  const [analytics, setAnalytics] = useState({
    profile: {},
    syllabus: { overall: 0, subjects: [] },
    myProgress: [],
    competitive: { hasExam: false, exams: [] },
    areas: [],
  });

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [
        profileResult,
        studentAnalyticsResult,
        syllabusResult,
        myProgressResult,
        competitiveResult,
        psychometricResult,
        learningGapsResult,
        codingResult,
        skillsResult,
      ] = await Promise.allSettled([
        studentService.getProfile(),
        studentService.getStudentAnalytics(),
        studentService.getSyllabusCompletion(),
        studentService.getMyProgressAnalytics(),
        studentService.getCompetitiveExamAnalytics(),
        studentService.getPsychometricAnalytics(),
        studentService.getLearningGapsAnalytics(),
        studentService.getCodingProAnalytics(),
        studentService.getSkillsEdgeAnalytics(),
      ]);

      const profile = normalizeStudentProfile(
        profileResult.status === 'fulfilled' ? profileResult.value : {},
        studentAnalyticsResult.status === 'fulfilled' ? studentAnalyticsResult.value : {},
      );

      const psychometricPayload = psychometricResult.status === 'fulfilled'
        ? psychometricResult.value
        : await fetchPsychometricFallback().catch(() => ({}));
      const skillsPayload = skillsResult.status === 'fulfilled'
        ? skillsResult.value
        : await fetchSkillsEdgeFallback().catch(() => ({}));
      const codingPayload = codingResult.status === 'fulfilled'
        ? codingResult.value
        : await fetchCodingProFallback(profile).catch(() => ({}));

      const nextState = {
        profile,
        syllabus: normalizeSyllabus(syllabusResult.status === 'fulfilled' ? syllabusResult.value : {}),
        myProgress: normalizeProgress(myProgressResult.status === 'fulfilled' ? myProgressResult.value : {}),
        competitive: normalizeCompetitiveAnalytics(competitiveResult.status === 'fulfilled' ? competitiveResult.value : {}),
        areas: [
          normalizeAreaAnalytics('Psychometric', psychometricPayload),
          normalizeAreaAnalytics('Learning Gaps', learningGapsResult.status === 'fulfilled' ? learningGapsResult.value : {}),
          normalizeAreaAnalytics('Coding Pro', codingPayload),
          normalizeAreaAnalytics('Skills Edge', skillsPayload),
        ],
      };

      setAnalytics(nextState);
    } catch (err) {
      setError(err?.message || 'Unable to load analytics right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const syllabusSummary = analytics.syllabus;
  const studentProfile = analytics.profile;
  const examAnalytics = analytics.competitive;

  const initials = useMemo(() => {
    const pieces = compactText(studentProfile.name, '').split(/\s+/).filter(Boolean);
    return pieces.slice(0, 2).map((item) => item.charAt(0).toUpperCase()).join('') || 'ST';
  }, [studentProfile.name]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/student')}>
          <Text style={styles.headerButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Analytics</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={GREEN_ACCENT} />
          <Text style={styles.loaderText}>Loading analytics…</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <SectionCard title="Student Profile">
            <View style={styles.profileCardBody}>
              <View style={styles.profileAvatarWrap}>
                {studentProfile.avatar ? (
                  <Image source={{ uri: studentProfile.avatar }} style={styles.profileAvatar} />
                ) : (
                  <View style={styles.profileAvatarFallback}><Text style={styles.profileAvatarFallbackText}>{initials}</Text></View>
                )}
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{compactText(studentProfile.name, 'Student')}</Text>
                <Text style={styles.profileMeta}>{`Class: ${compactText(studentProfile.currentClass)}`}</Text>
                <Text style={styles.profileMeta}>{`School: ${compactText(studentProfile.schoolName)}`}</Text>
                <Text style={styles.profileMeta}>{`Stream: ${compactText(studentProfile.stream)}`}</Text>
              </View>
            </View>
          </SectionCard>

          <SectionCard title="Overall Syllabus Completion" right={<Text style={styles.highlightValue}>{`${syllabusSummary.overall || 0}%`}</Text>}>
            <ProgressBar value={syllabusSummary.overall} height={12} />
            <View style={styles.metricRow}>
              <MetricChip label="Total Topics" value={compactText(syllabusSummary.totalTopics, '0')} />
              <MetricChip label="Completed" value={compactText(syllabusSummary.completedTopics, '0')} />
              <MetricChip label="Not Completed" value={compactText(syllabusSummary.pendingTopics, '0')} />
            </View>
          </SectionCard>

          <CollapsibleCard
            title="Subject-wise Breakdown"
            accent={GREEN_ACCENT}
            open={expanded.subjects}
            onToggle={() => setExpanded((prev) => ({ ...prev, subjects: !prev.subjects }))}
            summary={`${analytics.syllabus.subjects.length} subjects`}
          >
            {analytics.syllabus.subjects.length ? analytics.syllabus.subjects.map((subject) => (
              <View key={subject.id} style={styles.listItem}>
                <View style={styles.listItemHeader}>
                  <Text style={styles.listItemTitle}>{subject.name}</Text>
                  <Text style={styles.listItemValue}>{`${subject.percent}%`}</Text>
                </View>
                <ProgressBar value={subject.percent} />
                <Text style={styles.listItemMeta}>
                  {`${compactText(subject.completedTopics, '0')} completed • ${compactText(subject.pendingTopics, '0')} pending`}
                </Text>
              </View>
            )) : <EmptyState />}
          </CollapsibleCard>

          <CollapsibleCard
            title="My Progress"
            accent={GREEN_ACCENT}
            open={expanded.progress}
            onToggle={() => setExpanded((prev) => ({ ...prev, progress: !prev.progress }))}
            summary={analytics.myProgress.length ? `${analytics.myProgress.length} modules tracked` : undefined}
          >
            {analytics.myProgress.length ? analytics.myProgress.map((item) => (
              <View key={item.id} style={styles.listItem}>
                <View style={styles.listItemHeader}>
                  <Text style={styles.listItemTitle}>{item.title}</Text>
                  <Text style={styles.listItemValue}>{`${item.percent}%`}</Text>
                </View>
                <Text style={styles.listItemMeta}>{item.subtitle || 'Progress updated from your learning activity'}</Text>
                <ProgressBar value={item.percent} />
                {(item.completed != null || item.total != null) ? (
                  <Text style={styles.listItemMeta}>{`${compactText(item.completed, '0')} / ${compactText(item.total, '0')} completed`}</Text>
                ) : null}
              </View>
            )) : <EmptyState />}
          </CollapsibleCard>

          {examAnalytics.hasExam !== false ? (
            <CollapsibleCard
              title="Competitive Exam Analytics"
              accent={GREEN_ACCENT}
              open={expanded.exams}
              onToggle={() => setExpanded((prev) => ({ ...prev, exams: !prev.exams }))}
              summary={examAnalytics.exams.length ? `${examAnalytics.exams.length} exam insights` : undefined}
            >
              {examAnalytics.exams.length ? examAnalytics.exams.map((exam) => (
                <View key={exam.id} style={styles.examCard}>
                  <Text style={styles.examName}>{exam.name}</Text>
                  <View style={styles.examStatsRow}>
                    <MetricChip label="Score / Rank" value={compactText(exam.score)} />
                    <MetricChip label="Accuracy" value={exam.accuracy != null ? `${exam.accuracy}%` : '—'} />
                    <MetricChip label="Attempts" value={compactText(exam.attempts, '0')} />
                  </View>
                </View>
              )) : <EmptyState />}
            </CollapsibleCard>
          ) : null}

          <SectionCard title="More Analytics">
            <View style={styles.areaGrid}>
              {analytics.areas.map((area) => (
                <View key={area.title} style={styles.areaCard}>
                  <Text style={styles.areaTitle}>{area.title}</Text>
                  <Text style={styles.areaPrimary}>{area.primaryValue}</Text>
                  <Text style={styles.areaSecondary}>{area.secondary}</Text>
                  {area.percent != null ? <ProgressBar value={area.percent} trackStyle={styles.areaProgressTrack} /> : null}
                </View>
              ))}
            </View>
          </SectionCard>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17,24,39,0.95)',
    borderWidth: 1,
    borderColor: STUDENT.border,
  },
  headerButtonText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSpacer: { width: 40 },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loaderText: { color: STUDENT.textSecondary, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 96, gap: 14 },
  errorText: {
    color: '#fecaca',
    backgroundColor: 'rgba(127, 29, 29, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.35)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  card: {
    backgroundColor: 'rgba(17,24,39,0.98)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: STUDENT.border,
    padding: 16,
    gap: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardHeaderTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  cardAccent: { width: 4, height: 20, borderRadius: 999 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '800', flexShrink: 1 },
  collapseBtn: {
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.35)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(22,163,74,0.12)',
  },
  collapseBtnText: { color: '#dcfce7', fontSize: 12, fontWeight: '700' },
  sectionSummary: { color: STUDENT.textMuted, fontSize: 12 },
  highlightValue: { color: '#dcfce7', fontSize: 20, fontWeight: '900' },
  profileCardBody: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  profileAvatarWrap: {
    width: 86,
    height: 86,
    borderRadius: 43,
    padding: 3,
    backgroundColor: 'rgba(22,163,74,0.25)',
  },
  profileAvatar: { width: '100%', height: '100%', borderRadius: 40 },
  profileAvatarFallback: {
    flex: 1,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(21,128,61,0.7)',
  },
  profileAvatarFallbackText: { color: '#fff', fontSize: 28, fontWeight: '900' },
  profileInfo: { flex: 1, gap: 4 },
  profileName: { color: '#fff', fontSize: 18, fontWeight: '800' },
  profileMeta: { color: STUDENT.textSecondary, fontSize: 13, lineHeight: 18 },
  metricRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  metricChip: {
    flexGrow: 1,
    minWidth: '30%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(22,163,74,0.22)',
    backgroundColor: 'rgba(5, 46, 22, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metricValue: { color: '#fff', fontSize: 18, fontWeight: '900' },
  metricLabel: { color: STUDENT.textSecondary, fontSize: 12, marginTop: 4 },
  progressTrack: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%' },
  listItem: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(10,15,30,0.72)',
    padding: 12,
    gap: 8,
  },
  listItemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  listItemTitle: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
  listItemValue: { color: '#dcfce7', fontSize: 13, fontWeight: '800' },
  listItemMeta: { color: STUDENT.textSecondary, fontSize: 12, lineHeight: 17 },
  examCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(22,163,74,0.22)',
    backgroundColor: 'rgba(10,15,30,0.72)',
    padding: 12,
    gap: 10,
  },
  examName: { color: '#fff', fontSize: 15, fontWeight: '800' },
  examStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  areaGrid: { gap: 10 },
  areaCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(22,163,74,0.2)',
    backgroundColor: 'rgba(10,15,30,0.72)',
    padding: 12,
    gap: 8,
  },
  areaTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  areaPrimary: { color: '#dcfce7', fontSize: 22, fontWeight: '900' },
  areaSecondary: { color: STUDENT.textSecondary, fontSize: 12, lineHeight: 18 },
  areaProgressTrack: { marginTop: 2 },
  emptyText: { color: STUDENT.textMuted, fontSize: 13, lineHeight: 18 },
});
