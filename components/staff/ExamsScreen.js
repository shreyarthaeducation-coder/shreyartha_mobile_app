import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, PORTALS, SLATE, SPACING, TYPE } from '../../constants/theme';
import {
  Card,
  EMPTY_SCOPE,
  EmptyState,
  ScopePicker,
  ScreenScaffold,
  SegmentedTabs,
  useToast,
} from '../ui';
import useStaffResource from '../../hooks/useStaffResource';
import {
  examClassesLoader,
  fetchSectionStudents,
  fetchStudentTestSummary,
  fetchSubjectOverview,
} from '../../services/teacher/examService';
import MarksSheet from './exams/MarksSheet';
import QuestionsSheet from './exams/QuestionsSheet';
import ExamAnalysisSheet from './exams/ExamAnalysisSheet';

/**
 * Native Test and Examination.
 *
 * TEACHERS DO NOT OWN EXAMS. There is no create, edit or delete anywhere here, and
 * `visibleToParents` is read-only — exam definitions belong to the School Admin / Principal, and
 * the backend has no teacher endpoint for them. The empty state says so, as the web's does.
 *
 * Two tabs with **independent scope state**. The web keeps a parallel `vr*` picker chain for the
 * same reason: both tabs stay mounted, and sharing one scope would make each tab's fetch effect
 * fire on the other's selection.
 */

const PALETTE = PORTALS.school;

const TABS = [
  { value: 'exams', label: 'Exams', icon: 'clipboard-outline' },
  { value: 'report', label: 'View Report', icon: 'bar-chart-outline' },
];

export default function ExamsScreen({ homeRoute = '/teacher' }) {
  const [tab, setTab] = useState('exams');
  const [examScope, setExamScope] = useState(EMPTY_SCOPE);
  const [reportScope, setReportScope] = useState(EMPTY_SCOPE);

  const [marksExam, setMarksExam] = useState(null);
  const [questionsExam, setQuestionsExam] = useState(null);
  const [student, setStudent] = useState(null);
  const [analysis, setAnalysis] = useState(null);

  const { toast, showToast } = useToast();

  const examReady = !!(examScope.sectionId && examScope.subjectId);
  const reportReady = !!(reportScope.sectionId && reportScope.subjectId);

  // ── exams tab ─────────────────────────────────────────────────────────────
  const overviewFetcher = useCallback(
    (signal) =>
      fetchSubjectOverview(
        { sectionId: examScope.sectionId, subjectId: examScope.subjectId },
        signal,
      ),
    [examScope.sectionId, examScope.subjectId],
  );
  const {
    data: overview,
    loading: overviewLoading,
    error: overviewError,
    refreshing,
    reload: reloadOverview,
    refresh: refreshOverview,
    revalidate: revalidateOverview,
  } = useStaffResource(overviewFetcher, { enabled: examReady });

  const exams = useMemo(() => (examReady ? overview?.exams || [] : []), [overview, examReady]);

  // ── report tab ────────────────────────────────────────────────────────────
  const studentsFetcher = useCallback(
    (signal) =>
      fetchSectionStudents(
        { sectionId: reportScope.sectionId, subjectId: reportScope.subjectId },
        signal,
      ),
    [reportScope.sectionId, reportScope.subjectId],
  );
  const { data: students, loading: studentsLoading, error: studentsError } = useStaffResource(
    studentsFetcher,
    { enabled: reportReady && tab === 'report', initialData: [] },
  );

  const summariesFetcher = useCallback(
    (signal) =>
      fetchStudentTestSummary(
        {
          sectionId: reportScope.sectionId,
          subjectId: reportScope.subjectId,
          studentId: student.studentId,
        },
        signal,
      ),
    [reportScope.sectionId, reportScope.subjectId, student?.studentId],
  );
  const { data: summaries, loading: summariesLoading } = useStaffResource(summariesFetcher, {
    enabled: !!(reportReady && student?.studentId),
    initialData: [],
  });

  // ── exams tab body ────────────────────────────────────────────────────────
  const renderExams = () => {
    if (!examReady) {
      return (
        <View style={styles.fill}>
          <EmptyState
            icon="school-outline"
            title="Choose a class and subject"
            message="Pick an academic year, class, section and subject to see its exams."
          />
        </View>
      );
    }
    if (overviewLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PALETTE.primary} />
        </View>
      );
    }
    if (overviewError && !overview) {
      return (
        <View style={styles.fill}>
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load exams"
            message={overviewError}
            actionLabel="Try again"
            onAction={reloadOverview}
          />
        </View>
      );
    }
    if (exams.length === 0) {
      return (
        <View style={styles.fill}>
          <EmptyState
            icon="clipboard-outline"
            title="No exams for this subject yet"
            message="Ask your School Admin or Principal to add one from their Test and Examination page."
          />
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshOverview}
            tintColor={PALETTE.primary}
            colors={[PALETTE.primary]}
          />
        }
      >
        {overview?.subjectName ? (
          <Text style={styles.subjectHeader}>
            {overview.className}-{overview.sectionName} · {overview.subjectName}
            {overview.subjectCode ? ` (${overview.subjectCode})` : ''}
          </Text>
        ) : null}

        {exams.map((exam) => (
          <Card key={exam.id}>
            <View style={styles.examHead}>
              <View style={styles.examText}>
                <Text style={styles.examName}>{exam.examName}</Text>
                <Text style={styles.examMeta}>
                  {exam.examCode} · max {exam.maxMarks}
                </Text>
              </View>
              <View
                style={[
                  styles.visibleChip,
                  exam.visibleToParents ? styles.visibleOn : styles.visibleOff,
                ]}
              >
                <Text
                  style={[
                    styles.visibleText,
                    { color: exam.visibleToParents ? FEEDBACK.successText : SLATE[500] },
                  ]}
                >
                  {exam.visibleToParents ? 'Parents can see' : 'Hidden from parents'}
                </Text>
              </View>
            </View>

            <View style={styles.examStats}>
              <Text style={styles.examStat}>
                {exam.questionCount > 0
                  ? `${exam.questionCount} question${exam.questionCount === 1 ? '' : 's'} · ${exam.totalQuestionMarks ?? 0} marks`
                  : 'No questions yet'}
              </Text>
              <Text style={styles.examStat}>{exam.resultsEnteredCount ?? 0} results entered</Text>
            </View>

            <View style={styles.examActions}>
              <Pressable
                onPress={() => setQuestionsExam(exam)}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Ionicons name="list-outline" size={17} color={PALETTE.primaryDark} />
                <Text style={styles.actionText}>Questions</Text>
              </Pressable>
              <Pressable
                onPress={() => setMarksExam(exam)}
                style={({ pressed }) => [styles.actionBtnPrimary, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Ionicons name="create-outline" size={17} color="#ffffff" />
                <Text style={styles.actionTextPrimary}>
                  {/* The exam's question count decides which marks screen opens — say which. */}
                  {exam.questionCount > 0 ? 'Per-question marks' : 'Enter marks'}
                </Text>
              </Pressable>
            </View>
          </Card>
        ))}
      </ScrollView>
    );
  };

  // ── report tab body ───────────────────────────────────────────────────────
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
            title={studentsError ? "Couldn't load students" : 'No students in this section'}
            message={studentsError || 'Students need to be assigned to this class and section.'}
          />
        </View>
      );
    }

    return (
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.studentStrip}
        >
          {roster.map((s) => {
            const active = student?.studentId === s.studentId;
            return (
              <Pressable
                key={s.studentId}
                onPress={() => setStudent(s)}
                style={({ pressed }) => [
                  styles.studentChip,
                  active && { backgroundColor: PALETTE.tint, borderColor: PALETTE.primary },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[styles.studentChipText, active && { color: PALETTE.primaryDark }]}
                  numberOfLines={1}
                >
                  {s.studentName}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {!student ? (
          <Text style={styles.hint}>Choose a student to see their exam results.</Text>
        ) : summariesLoading ? (
          <ActivityIndicator size="small" color={PALETTE.primary} style={styles.inlineLoader} />
        ) : (summaries || []).length === 0 ? (
          <Text style={styles.hint}>
            {student.studentName} has no exam results for this subject yet.
          </Text>
        ) : (
          summaries.map((t) => (
            <Card key={t.examId}>
              <View style={styles.summaryHead}>
                <View style={styles.examText}>
                  <Text style={styles.examName}>{t.examName}</Text>
                  <Text style={styles.examMeta}>{t.examCode}</Text>
                </View>
                <Text style={styles.summaryScore}>
                  {/* A falsy status is the "no result row" signal, not an absence. */}
                  {t.status ? `${t.marksObtained ?? '—'} / ${t.totalMarks}` : 'Not entered'}
                </Text>
              </View>
              {t.remarks ? <Text style={styles.summaryRemarks}>{t.remarks}</Text> : null}
              <Pressable
                onPress={() =>
                  setAnalysis({
                    examId: t.examId,
                    examName: t.examName,
                    studentId: student.studentId,
                  })
                }
                style={({ pressed }) => [styles.analysisBtn, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Ionicons name="stats-chart-outline" size={17} color={PALETTE.primaryDark} />
                <Text style={styles.actionText}>Detailed analysis</Text>
              </Pressable>
            </Card>
          ))
        )}
      </ScrollView>
    );
  };

  const scope = tab === 'exams' ? examScope : reportScope;

  return (
    <ScreenScaffold
      title="Test and Examination"
      fallbackRoute={homeRoute}
      scroll={false}
      toast={toast}
    >
      <View style={styles.header}>
        <ScopePicker
          loadClasses={examClassesLoader}
          value={scope}
          onChange={tab === 'exams' ? setExamScope : setReportScope}
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

      {tab === 'exams' ? renderExams() : renderReport()}

      <MarksSheet
        visible={!!marksExam}
        exam={marksExam}
        onClose={() => setMarksExam(null)}
        onSaved={() => {
          setMarksExam(null);
          revalidateOverview();
        }}
        showToast={showToast}
      />

      <QuestionsSheet
        visible={!!questionsExam}
        exam={questionsExam}
        academicIqSubjectId={examScope.academicIqSubjectId}
        onClose={() => setQuestionsExam(null)}
        onChanged={revalidateOverview}
        showToast={showToast}
      />

      <ExamAnalysisSheet
        visible={!!analysis}
        target={analysis}
        onClose={() => setAnalysis(null)}
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

  subjectHeader: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[600], marginBottom: 2 },

  examHead: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  examText: { flex: 1 },
  examName: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  examMeta: { fontSize: TYPE.label, color: SLATE[500], marginTop: 1 },
  visibleChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  visibleOn: { backgroundColor: FEEDBACK.successBg },
  visibleOff: { backgroundColor: SLATE[100] },
  visibleText: { fontSize: TYPE.micro, fontWeight: '700' },

  examStats: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginTop: SPACING.sm },
  examStat: { fontSize: TYPE.label, color: SLATE[500], fontWeight: '600' },

  examActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SLATE[200],
  },
  actionBtnPrimary: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: PALETTE.primaryDark,
  },
  actionText: { fontSize: TYPE.body, fontWeight: '700', color: PALETTE.primaryDark },
  actionTextPrimary: { fontSize: TYPE.body, fontWeight: '700', color: '#ffffff' },

  studentStrip: { gap: SPACING.sm, paddingBottom: SPACING.sm },
  studentChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
    maxWidth: 200,
  },
  studentChipText: { fontSize: TYPE.body, fontWeight: '600', color: SLATE[600] },

  hint: {
    fontSize: TYPE.body,
    color: SLATE[500],
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
  inlineLoader: { marginVertical: SPACING.lg },

  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  summaryScore: { fontSize: TYPE.heading, fontWeight: '800', color: SLATE[800] },
  summaryRemarks: { fontSize: TYPE.label, color: SLATE[600], marginTop: 5, fontStyle: 'italic' },
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

  pressed: { opacity: 0.72 },
});
