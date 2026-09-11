import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, PORTALS, SLATE, SPACING, TYPE } from '../../constants/theme';
import {
  Card,
  EMPTY_SCOPE,
  EmptyState,
  ScopePicker,
  ScreenScaffold,
  SegmentedTabs,
  Select,
  useToast,
} from '../ui';
import useStaffResource from '../../hooks/useStaffResource';
import { fetchChapters } from '../../services/teacher/resourceService';
import {
  REMARK_TIER,
  adaptiveClassesLoader,
  fetchAdaptiveStudents,
  fetchAttempts,
  fetchEnabledTopics,
  fetchStandingTopics,
  fetchStandings,
  formatDuration,
  levelLabel,
} from '../../services/teacher/adaptiveService';
import TopicBankSheet from './adaptive/TopicBankSheet';
import AdaptiveReport from './adaptive/AdaptiveReport';

/**
 * Native My Adaptive Assessment.
 *
 * Question Bank: pick a topic, decide whether students get the company question set or yours.
 * View Report: leaderboards and per-attempt analysis.
 *
 * The chapter → topic accordion and `fetchChapters` are both reused from the Homework tab — same
 * curriculum endpoint, same alias handling (render `displayName`).
 */

const PALETTE = PORTALS.school;

const TABS = [
  { value: 'bank', label: 'Question Bank', icon: 'library-outline' },
  { value: 'report', label: 'View Report', icon: 'bar-chart-outline' },
];

export default function AdaptiveAssessmentScreen({ homeRoute = '/teacher' }) {
  const [tab, setTab] = useState('bank');
  const [bankScope, setBankScope] = useState(EMPTY_SCOPE);
  const [reportScope, setReportScope] = useState(EMPTY_SCOPE);

  const [openChapters, setOpenChapters] = useState({});
  const [topicTarget, setTopicTarget] = useState(null);

  const [standingTopicId, setStandingTopicId] = useState(null);
  const [student, setStudent] = useState(null);
  const [attempt, setAttempt] = useState(null);

  const { toast, showToast } = useToast();

  const bankReady = !!(bankScope.sectionId && bankScope.subjectId);
  const hasCurriculum = bankReady && !!bankScope.academicIqSubjectId;
  const reportReady = !!(reportScope.sectionId && reportScope.subjectId);

  // ── question bank ─────────────────────────────────────────────────────────
  const chaptersFetcher = useCallback(
    (signal) => fetchChapters(bankScope.academicIqSubjectId, signal),
    [bankScope.academicIqSubjectId],
  );
  const { data: chapters, loading: chaptersLoading, error: chaptersError, reload: reloadChapters } =
    useStaffResource(chaptersFetcher, { enabled: hasCurriculum, initialData: [] });

  const enabledFetcher = useCallback(
    (signal) =>
      fetchEnabledTopics({ sectionId: bankScope.sectionId, subjectId: bankScope.subjectId }, signal),
    [bankScope.sectionId, bankScope.subjectId],
  );
  const { data: enabledTopics, revalidate: revalidateEnabled } = useStaffResource(enabledFetcher, {
    enabled: bankReady,
    initialData: [],
  });

  // The endpoint returns ids the web compares as strings; keep that — a numeric compare silently
  // makes every ON badge disappear.
  const enabledSet = useMemo(() => new Set(enabledTopics || []), [enabledTopics]);

  // ── view report ───────────────────────────────────────────────────────────
  const studentsFetcher = useCallback(
    (signal) =>
      fetchAdaptiveStudents(
        { sectionId: reportScope.sectionId, subjectId: reportScope.subjectId },
        signal,
      ),
    [reportScope.sectionId, reportScope.subjectId],
  );
  const { data: students, loading: studentsLoading } = useStaffResource(studentsFetcher, {
    enabled: reportReady && tab === 'report',
    initialData: [],
  });

  const topicsFetcher = useCallback(
    (signal) =>
      fetchStandingTopics(
        { sectionId: reportScope.sectionId, subjectId: reportScope.subjectId },
        signal,
      ),
    [reportScope.sectionId, reportScope.subjectId],
  );
  const { data: standingTopics } = useStaffResource(topicsFetcher, {
    enabled: reportReady && tab === 'report',
    initialData: [],
  });

  const effectiveTopicId = standingTopicId ?? standingTopics?.[0]?.topicId ?? null;

  const standingsFetcher = useCallback(
    (signal) =>
      fetchStandings(
        {
          sectionId: reportScope.sectionId,
          subjectId: reportScope.subjectId,
          topicId: effectiveTopicId,
        },
        signal,
      ),
    [reportScope.sectionId, reportScope.subjectId, effectiveTopicId],
  );
  const { data: standings } = useStaffResource(standingsFetcher, {
    enabled: !!(reportReady && effectiveTopicId),
    initialData: [],
  });

  const attemptsFetcher = useCallback(
    (signal) =>
      fetchAttempts(
        {
          sectionId: reportScope.sectionId,
          subjectId: reportScope.subjectId,
          studentId: student.studentId,
        },
        signal,
      ),
    [reportScope.sectionId, reportScope.subjectId, student?.studentId],
  );
  const { data: attempts, loading: attemptsLoading } = useStaffResource(attemptsFetcher, {
    enabled: !!(reportReady && student?.studentId),
    initialData: [],
  });

  const standingFor = useCallback(
    (studentId) => (standings || []).find((s) => s.studentId === studentId) || null,
    [standings],
  );

  // ── renderers ─────────────────────────────────────────────────────────────
  const renderBank = () => {
    if (!bankReady) {
      return (
        <View style={styles.fill}>
          <EmptyState
            icon="school-outline"
            title="Choose a class and subject"
            message="Pick an academic year, class, section and subject to manage its question bank."
          />
        </View>
      );
    }
    if (!hasCurriculum) {
      return (
        <View style={styles.fill}>
          <EmptyState
            icon="unlink-outline"
            title="Not linked to curriculum content"
            message="This subject has no Academic IQ link, so its chapters and topics can't be loaded. Ask your school admin to link it."
          />
        </View>
      );
    }
    if (chaptersLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PALETTE.primary} />
        </View>
      );
    }
    const list = chapters || [];
    if (list.length === 0) {
      return (
        <View style={styles.fill}>
          <EmptyState
            icon="library-outline"
            title={chaptersError ? "Couldn't load chapters" : 'No chapters for this subject'}
            message={chaptersError || 'The curriculum for this subject has no chapters yet.'}
            actionLabel={chaptersError ? 'Try again' : undefined}
            onAction={chaptersError ? reloadChapters : undefined}
          />
        </View>
      );
    }

    return (
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {list.map((chapter) => {
          const open = !!openChapters[chapter.id];
          return (
            <View key={chapter.id} style={styles.chapterBlock}>
              <Pressable
                onPress={() => setOpenChapters((prev) => ({ ...prev, [chapter.id]: !open }))}
                style={({ pressed }) => [styles.chapterHead, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
              >
                <Ionicons
                  name={open ? 'chevron-down' : 'chevron-forward'}
                  size={18}
                  color={PALETTE.primaryDark}
                />
                <Text style={styles.chapterName} numberOfLines={2}>
                  {chapter.name}
                </Text>
                <Text style={styles.chapterMeta}>
                  {chapter.topics?.length ?? chapter.topicCount ?? 0}
                </Text>
              </Pressable>

              {open
                ? (chapter.topics || []).map((topic) => {
                    const on = enabledSet.has(String(topic.id));
                    return (
                      <Pressable
                        key={topic.id}
                        onPress={() =>
                          setTopicTarget({
                            chapter,
                            topic: { id: topic.id, label: topic.displayName || topic.name },
                          })
                        }
                        style={({ pressed }) => [styles.topicRow, pressed && styles.pressed]}
                        accessibilityRole="button"
                      >
                        <Text style={styles.topicName} numberOfLines={2}>
                          {topic.displayName || topic.name}
                        </Text>
                        {on ? (
                          <View style={styles.onBadge}>
                            <Text style={styles.onBadgeText}>ON</Text>
                          </View>
                        ) : null}
                        <Ionicons name="chevron-forward" size={17} color={SLATE[400]} />
                      </Pressable>
                    );
                  })
                : null}
            </View>
          );
        })}
      </ScrollView>
    );
  };

  const renderReport = () => {
    if (!reportReady) {
      return (
        <View style={styles.fill}>
          <EmptyState
            icon="school-outline"
            title="Choose a class and subject"
            message="Pick an academic year, class, section and subject to see student reports."
          />
        </View>
      );
    }
    if (studentsLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PALETTE.primary} />
        </View>
      );
    }
    const roster = students || [];
    if (roster.length === 0) {
      return (
        <View style={styles.fill}>
          <EmptyState
            icon="people-outline"
            title="No students in this section"
            message="Students need to be assigned to this class and section."
          />
        </View>
      );
    }

    return (
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {(standingTopics || []).length > 0 ? (
          <Select
            label="Leaderboard topic"
            value={effectiveTopicId}
            options={(standingTopics || []).map((t) => ({
              value: t.topicId,
              label: t.topicName || `Topic ${t.topicId}`,
            }))}
            onChange={setStandingTopicId}
          />
        ) : null}

        {roster.map((s) => {
          const standing = standingFor(s.studentId);
          const active = student?.studentId === s.studentId;
          return (
            <Pressable
              key={s.studentId}
              onPress={() => setStudent(active ? null : s)}
              style={({ pressed }) => [
                styles.studentRow,
                active && styles.studentRowActive,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <View style={styles.studentText}>
                <Text style={styles.studentName} numberOfLines={1}>
                  {s.studentName}
                </Text>
                {effectiveTopicId ? (
                  <Text
                    style={[
                      styles.studentStanding,
                      { color: standing ? REMARK_TIER[standing.remark] || SLATE[500] : SLATE[400] },
                    ]}
                  >
                    {standing
                      ? `Rank ${standing.rank}/${standing.totalParticipants} · ${standing.remark}`
                      : 'Not attempted'}
                  </Text>
                ) : null}
              </View>
              <Ionicons
                name={active ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={SLATE[400]}
              />
            </Pressable>
          );
        })}

        {student ? (
          attemptsLoading ? (
            <ActivityIndicator size="small" color={PALETTE.primary} style={styles.inlineLoader} />
          ) : (attempts || []).length === 0 ? (
            <Text style={styles.hint}>
              {student.studentName} hasn&apos;t taken an adaptive assessment for this subject yet.
            </Text>
          ) : (
            attempts.map((a) => (
              <Card key={a.attemptId}>
                <View style={styles.attemptHead}>
                  <View style={styles.studentText}>
                    <Text style={styles.attemptTopic}>{a.topicName || 'Topic'}</Text>
                    <Text style={styles.attemptMeta}>
                      {a.totalAnswered}/{a.poolSize} answered · {Math.round(a.accuracy || 0)}%
                      accuracy
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.attemptChip,
                      a.stoppedEarly ? styles.attemptPartial : styles.attemptDone,
                    ]}
                  >
                    <Text
                      style={[
                        styles.attemptChipText,
                        { color: a.stoppedEarly ? '#b45309' : FEEDBACK.successText },
                      ]}
                    >
                      {a.stoppedEarly ? 'Stopped early' : 'Completed'}
                    </Text>
                  </View>
                </View>

                <View style={styles.attemptStats}>
                  <Text style={styles.attemptStat}>
                    {/* activeSeconds is time actually spent answering; durationSeconds is wall clock. */}
                    Time {formatDuration(a.activeSeconds ?? a.durationSeconds)}
                  </Text>
                  {a.averageSecondsPerQuestion != null ? (
                    <Text style={styles.attemptStat}>Avg {a.averageSecondsPerQuestion}s/q</Text>
                  ) : null}
                  {a.rank != null ? (
                    <Text style={styles.attemptStat}>
                      Rank {a.rank}/{a.totalParticipants}
                    </Text>
                  ) : null}
                  <Text style={styles.attemptStat}>Level {levelLabel(a.finalLevel)}</Text>
                </View>

                <Pressable
                  onPress={() => setAttempt(a)}
                  disabled={!a.totalAnswered}
                  style={({ pressed }) => [
                    styles.analysisBtn,
                    !a.totalAnswered && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                >
                  <Ionicons name="stats-chart-outline" size={17} color={PALETTE.primaryDark} />
                  <Text style={styles.analysisText}>Detailed analysis</Text>
                </Pressable>
              </Card>
            ))
          )
        ) : null}
      </ScrollView>
    );
  };

  return (
    <ScreenScaffold
      title="My Adaptive Assessment"
      fallbackRoute={homeRoute}
      scroll={false}
      toast={toast}
    >
      <View style={styles.header}>
        <ScopePicker
          loadClasses={adaptiveClassesLoader}
          value={tab === 'bank' ? bankScope : reportScope}
          onChange={tab === 'bank' ? setBankScope : setReportScope}
          includeSubject
        />
        <SegmentedTabs
          options={TABS}
          value={tab}
          onChange={(next) => {
            setTab(next);
            setStudent(null);
          }}
        />
      </View>

      {tab === 'bank' ? renderBank() : renderReport()}

      <TopicBankSheet
        visible={!!topicTarget}
        scope={bankScope}
        chapter={topicTarget?.chapter}
        topic={topicTarget?.topic}
        onClose={() => {
          setTopicTarget(null);
          revalidateEnabled();
        }}
        showToast={showToast}
      />

      <AdaptiveReport
        visible={!!attempt}
        attempt={attempt}
        onClose={() => setAttempt(null)}
        showToast={showToast}
      />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: SLATE[200],
    gap: SPACING.sm,
  },
  list: { flex: 1 },
  fill: { flex: 1, justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: SPACING.md, paddingBottom: SPACING.xxl },

  chapterBlock: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SLATE[200],
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  chapterHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: SPACING.md,
  },
  chapterName: { flex: 1, fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  chapterMeta: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[500] },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingLeft: SPACING.lg,
    paddingRight: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
    backgroundColor: SLATE[50],
  },
  topicName: { flex: 1, fontSize: TYPE.heading, fontWeight: '600', color: SLATE[700] },
  onBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: FEEDBACK.successBg,
  },
  onBadgeText: { fontSize: TYPE.micro, fontWeight: '800', color: FEEDBACK.successText },

  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: SPACING.md,
    marginBottom: 6,
  },
  studentRowActive: { borderColor: PALETTE.primary, backgroundColor: PALETTE.tint },
  studentText: { flex: 1 },
  studentName: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  studentStanding: { fontSize: TYPE.caption, fontWeight: '600', marginTop: 2 },

  hint: { fontSize: TYPE.body, color: SLATE[500], textAlign: 'center', paddingVertical: SPACING.lg },
  inlineLoader: { marginVertical: SPACING.lg },

  attemptHead: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  attemptTopic: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  attemptMeta: { fontSize: TYPE.label, color: SLATE[500], marginTop: 2 },
  attemptChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  attemptDone: { backgroundColor: FEEDBACK.successBg },
  attemptPartial: { backgroundColor: '#fffbeb' },
  attemptChipText: { fontSize: TYPE.micro, fontWeight: '700' },
  attemptStats: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginTop: SPACING.sm },
  attemptStat: { fontSize: TYPE.label, color: SLATE[500], fontWeight: '600' },

  analysisBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: SPACING.sm,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SLATE[200],
  },
  analysisText: { fontSize: TYPE.body, fontWeight: '700', color: PALETTE.primaryDark },
  disabled: { opacity: 0.45 },

  pressed: { opacity: 0.72 },
});
