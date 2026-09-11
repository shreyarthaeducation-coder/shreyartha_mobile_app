import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { FEEDBACK, SLATE, SPACING, TYPE, leading } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import {
  Card,
  EmptyState,
  ScreenScaffold,
  SegmentedTabs,
  StatusChip,
  TextField,
} from '../../ui';
import useStaffResource from '../../../hooks/useStaffResource';
import {
  ACADEMIC_IQ_EDIT_CAP,
  STUDENT_FILTERS,
  fetchAcademicIqHistory,
  fetchStudents,
  matchesFilter,
  matchesStudent,
} from '../../../services/admin/studentService';
import { formatLongDateTime } from '../../../utils/dates';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * Student Management — the school's roster, and every Academic IQ profile change its students
 * have made.
 *
 * READ-ONLY BY DESIGN. Students belong to the school by school code and the platform admin owns
 * their records; the web has no create, edit or delete here either.
 *
 * Two independent fetches that fail independently, as the web does — a broken history call must
 * not blank the roster. The web stacks both tables on one page; here they are two tabs, because
 * the history table alone is nine columns wide.
 */

const TABS = [
  { value: 'roster', label: 'Students', icon: 'people-outline' },
  { value: 'history', label: 'Academic IQ', icon: 'time-outline' },
];

function StudentCard({ student }) {
  const styles = useStyles();
  return (
    <Card style={styles.item}>
      <View style={styles.head}>
        <Text style={styles.name} numberOfLines={1}>
          {student.fullName || '—'}
        </Text>
        <StatusChip
          label={student.paid ? student.planName || student.planTier || 'Paid' : 'Free'}
          tone={student.paid ? 'success' : 'neutral'}
        />
      </View>
      <Text style={styles.meta} numberOfLines={1}>
        {[student.currentClass, student.section].filter(Boolean).join(' · ') || 'No class set'}
      </Text>
      {student.email ? (
        <Text style={styles.contact} numberOfLines={1}>
          {student.email}
        </Text>
      ) : null}
      {student.mobile ? (
        <Text style={styles.contact} numberOfLines={1}>
          {student.mobile}
        </Text>
      ) : null}
      <View style={styles.chipRow}>
        <StatusChip
          label={student.schoolStudent ? 'School student' : 'Individual'}
          tone={student.schoolStudent ? 'info' : 'neutral'}
        />
        {student.paid && student.subscriptionStatus ? (
          <StatusChip label={student.subscriptionStatus} tone="neutral" />
        ) : null}
      </View>
    </Card>
  );
}

function HistoryCard({ entry }) {
  const styles = useStyles();
  const prep =
    entry.preparingCompetitiveExam === 'YES'
      ? 'Preparing for a competitive exam'
      : entry.preparingCompetitiveExam === 'NO'
        ? 'Not preparing for a competitive exam'
        : null;
  return (
    <Card style={styles.item}>
      <View style={styles.head}>
        <Text style={styles.name} numberOfLines={1}>
          {entry.studentName || '—'}
        </Text>
        {/* The 12 is the web's own hardcoded cap; no field carries it. */}
        <StatusChip label={`Edit ${entry.editNumber}/${ACADEMIC_IQ_EDIT_CAP}`} tone="info" />
      </View>
      <Text style={styles.meta}>
        {entry.changedAt ? formatLongDateTime(entry.changedAt) : '—'}
      </Text>
      <View style={styles.historyRows}>
        <Text style={styles.historyRow}>
          <Text style={styles.historyLabel}>Curriculum: </Text>
          {entry.curriculumName || '—'}
        </Text>
        <Text style={styles.historyRow}>
          <Text style={styles.historyLabel}>Class: </Text>
          {entry.className || '—'}
        </Text>
        <Text style={styles.historyRow}>
          <Text style={styles.historyLabel}>Challenging subjects: </Text>
          {entry.subjectNames || '—'}
        </Text>
        {prep ? <Text style={styles.historyRow}>{prep}</Text> : null}
        {entry.competitiveExamName ? (
          <Text style={styles.historyRow}>
            <Text style={styles.historyLabel}>Competitive exam: </Text>
            {entry.competitiveExamName}
          </Text>
        ) : null}
        {entry.entranceExamNames ? (
          <Text style={styles.historyRow}>
            <Text style={styles.historyLabel}>Entrance exams: </Text>
            {entry.entranceExamNames}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

export default function StudentManagementScreen({ homeRoute, apiBase }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const [tab, setTab] = useState('roster');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const studentsFetcher = useCallback((signal) => fetchStudents(apiBase, signal), [apiBase]);
  const {
    data: roster,
    loading,
    error,
    refreshing,
    reload,
    refresh,
  } = useStaffResource(studentsFetcher, { initialData: { stats: {}, students: [] } });

  const historyFetcher = useCallback(
    (signal) => fetchAcademicIqHistory(apiBase, signal),
    [apiBase],
  );
  // Best-effort, exactly as on the web: its failure must not take the roster down with it, so the
  // error is deliberately not raised to the scaffold.
  const { data: history, error: historyError } = useStaffResource(historyFetcher, {
    initialData: [],
  });

  const stats = roster?.stats || {};
  const students = roster?.students || [];
  const historyRows = history || [];

  const visibleStudents = useMemo(
    () => students.filter((s) => matchesFilter(s, filter) && matchesStudent(s, search)),
    [students, filter, search],
  );

  const visibleHistory = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return historyRows;
    return historyRows.filter((h) => String(h.studentName || '').toLowerCase().includes(q));
  }, [historyRows, search]);

  return (
    <ScreenScaffold
      title="Student Management"
      fallbackRoute={homeRoute}
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {stats.schoolCode ? (
        <Text style={styles.school}>
          {stats.schoolName ? `${stats.schoolName} · ` : ''}Code {stats.schoolCode}
        </Text>
      ) : null}

      <View style={styles.statRow}>
        {STUDENT_FILTERS.map((option) => {
          const active = filter === option.value;
          return (
            <Pressable
              key={option.value}
              // Tapping a stat card filters the roster, exactly as the web's do.
              onPress={() => {
                setFilter(active ? 'all' : option.value);
                setTab('roster');
              }}
              style={({ pressed }) => [
                styles.statCard,
                active && { borderColor: PALETTE.primary, backgroundColor: PALETTE.tint },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.statValue, active && { color: PALETTE.primaryDark }]}>
                {stats[option.field] || 0}
              </Text>
              <Text style={styles.statLabel}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <SegmentedTabs options={TABS} value={tab} onChange={setTab} style={styles.tabs} />

      <TextField
        label="Search"
        value={search}
        onChangeText={setSearch}
        placeholder={
          tab === 'roster' ? 'Name, email, mobile or class' : 'Student name'
        }
      />

      {tab === 'roster' ? (
        visibleStudents.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No students"
            message="Nobody matches this filter."
          />
        ) : (
          visibleStudents.map((student) => (
            <StudentCard key={student.userId} student={student} />
          ))
        )
      ) : historyError ? (
        <Text style={styles.historyError}>Could not load Academic IQ history.</Text>
      ) : visibleHistory.length === 0 ? (
        <EmptyState
          icon="time-outline"
          title="No changes yet"
          message="No student has edited their Academic IQ profile."
        />
      ) : (
        visibleHistory.map((entry, index) => (
          <HistoryCard key={`${entry.studentName}-${entry.changedAt}-${index}`} entry={entry} />
        ))
      )}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  school: { fontSize: TYPE.label, color: SLATE[500], fontWeight: '600', marginBottom: SPACING.sm },
  statRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    alignItems: 'center',
  },
  statValue: { fontSize: TYPE.headline, fontWeight: '800', color: SLATE[800] },
  statLabel: { fontSize: TYPE.caption, color: SLATE[500], fontWeight: '600', marginTop: 2 },
  pressed: { opacity: 0.7 },
  tabs: { marginTop: SPACING.sm, marginBottom: SPACING.sm },
  item: { marginBottom: SPACING.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  meta: { fontSize: TYPE.label, color: SLATE[600], marginTop: 3, fontWeight: '600' },
  contact: { fontSize: TYPE.label, color: SLATE[500], marginTop: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACING.sm },
  historyRows: { marginTop: 6, gap: 3 },
  historyRow: { fontSize: TYPE.label, color: SLATE[600], lineHeight: leading(TYPE.label) },
  historyLabel: { color: SLATE[500], fontWeight: '700' },
  historyError: { fontSize: TYPE.body, color: FEEDBACK.errorText, marginTop: SPACING.sm },
}));
