import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../../components/ui/PaletteContext';
import {
  EMPTY_SCHOOL_SCOPE,
  EMPTY_SCOPE,
  EmptyState,
  FormSheet,
  LineChart,
  SchoolClassPicker,
  ScopePicker,
  ScreenScaffold,
  Select,
  useToast,
} from '../ui';
import useStaffResource from '../../hooks/useStaffResource';
import PsychometricSheet from './counsellor/PsychometricSheet';
import { attendanceClassesLoaderFor } from '../../services/teacher/attendanceService';
import {
  RISK_ORDER,
  fetchStudentIndices,
  fetchSurveyCategories,
  indexChartData,
  removeIndexOverride,
  riskMeta,
  updateStudentIndex,
  worstLevel,
} from '../../services/counsellor/surveyService';
import { makeStyles } from '../../utils/makeStyles';

/**
 * Wellness Groups — the counsellor's wellbeing-survey screen, both portals.
 *
 * NOT the teacher's "Create Group". They occupy the same slot in their respective sidebars and
 * share nothing: that one sorts students into ability bands over /api/teacher/groups, this one
 * shows survey-derived wellbeing indices, lets the counsellor override a band, and gates
 * psychometric topics per student.
 *
 * The web is a wide student × index table. Portrait gets a student list summarised by the worst
 * band across their indices, opening into a per-student sheet — the same information, reachable.
 */


export default function WellnessGroupsScreen({
  homeRoute = '/teacher',
  indicesEndpoint,
  scopeKind = 'classSection',
  schoolsEndpoint,
  classesBase,
}) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const schoolScoped = scopeKind === 'schoolClass';
  const [scope, setScope] = useState(schoolScoped ? EMPTY_SCHOOL_SCOPE : EMPTY_SCOPE);
  const [student, setStudent] = useState(null);
  const [psychometricFor, setPsychometricFor] = useState(null);
  const [busyIndex, setBusyIndex] = useState(null);

  const { toast, showToast } = useToast();

  const classesLoader = classesBase ? attendanceClassesLoaderFor(classesBase) : undefined;

  const categoriesFetcher = useCallback((signal) => fetchSurveyCategories(signal), []);
  const { data: categories } = useStaffResource(categoriesFetcher, { initialData: [] });
  const categoryList = categories || [];

  const ready = schoolScoped ? !!scope.classId : !!(scope.className && scope.sectionName);
  const scopeKey = `${scope.className}|${scope.sectionName}|${scope.classId}`;

  const indicesFetcher = useCallback(
    (signal) => fetchStudentIndices({ endpoint: indicesEndpoint, scope, scopeKind }, signal),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [indicesEndpoint, scopeKey, scopeKind],
  );
  const {
    data: rows,
    loading,
    refreshing,
    refresh,
    revalidate,
  } = useStaffResource(indicesFetcher, { enabled: ready, initialData: [] });
  const students = rows || [];

  // The open sheet must reflect edits, so read it back out of the freshest list rather than
  // holding a stale copy in state.
  const openStudent = student ? students.find((s) => s.studentId === student.studentId) || student : null;

  const setLevel = async (categoryId, level) => {
    setBusyIndex(categoryId);
    try {
      await updateStudentIndex({ studentId: openStudent.studentId, categoryId, level });
      showToast('Index updated.', 'success');
      await revalidate();
    } catch (e) {
      showToast(e?.message || 'Could not update that index.', 'error');
    } finally {
      setBusyIndex(null);
    }
  };

  const revert = async (categoryId) => {
    setBusyIndex(categoryId);
    try {
      await removeIndexOverride({ studentId: openStudent.studentId, categoryId });
      showToast('Reverted to the computed value.', 'success');
      await revalidate();
    } catch (e) {
      showToast(e?.message || 'Could not revert that index.', 'error');
    } finally {
      setBusyIndex(null);
    }
  };

  const chart = openStudent ? indexChartData(openStudent, categoryList) : [];

  return (
    <ScreenScaffold
      title="Wellness Groups"
      fallbackRoute={homeRoute}
      refreshing={refreshing}
      onRefresh={ready ? refresh : undefined}
      toast={toast}
      scroll
    >
      {schoolScoped ? (
        <SchoolClassPicker
          endpoint={schoolsEndpoint}
          value={scope}
          onChange={(next) => {
            setScope(next);
            setStudent(null);
          }}
          style={styles.picker}
        />
      ) : (
        <ScopePicker
          loadClasses={classesLoader}
          value={scope}
          onChange={(next) => {
            setScope(next);
            setStudent(null);
          }}
        />
      )}

      {!ready ? (
        <EmptyState
          icon="people-outline"
          title={schoolScoped ? 'Choose a class' : 'Choose a section'}
          message="Pick a scope to see its wellbeing indices."
        />
      ) : loading ? (
        <ActivityIndicator size="large" color={PALETTE.primary} style={styles.loader} />
      ) : students.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No students"
          message="No survey results have been recorded for this scope yet."
        />
      ) : (
        <>
          <View style={styles.legend}>
            {RISK_ORDER.map((level) => {
              const meta = riskMeta(level);
              return (
                <View key={level} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: meta.color }]} />
                  <Text style={styles.legendText}>{meta.label}</Text>
                </View>
              );
            })}
          </View>

          {students.map((s) => {
            const level = worstLevel(s);
            const meta = riskMeta(level);
            const count = Object.keys(s.indices || {}).length;
            return (
              <Pressable
                key={s.studentId}
                onPress={() => setStudent(s)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <View style={styles.rowText}>
                  <Text style={styles.name}>{s.studentName}</Text>
                  <Text style={styles.meta}>
                    {count} index{count === 1 ? '' : 'es'} recorded
                  </Text>
                </View>
                {level ? (
                  <View style={[styles.riskChip, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.riskText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                ) : null}
                <Ionicons name="chevron-forward" size={18} color={SLATE[400]} />
              </Pressable>
            );
          })}
        </>
      )}

      <FormSheet
        visible={!!openStudent}
        title={openStudent?.studentName || 'Wellness'}
        subtitle="Wellness Index"
        onClose={() => setStudent(null)}
        fullHeight
        headerAction={
          openStudent
            ? {
                label: '🧠 Psychometric',
                onPress: () => setPsychometricFor(openStudent),
              }
            : undefined
        }
      >
        {chart.length > 0 ? (
          <LineChart
            data={chart}
            style={styles.chart}
            // Each point keeps its own risk colour, which the web's single-colour line loses.
            pointColor={(point) => riskMeta(point.level).color}
          />
        ) : null}

        {categoryList.map((category) => {
          const detail = openStudent?.indices?.[category.shortCode];
          const meta = riskMeta(detail?.level);
          return (
            <View key={category.id} style={styles.indexBlock}>
              <View style={styles.indexHeader}>
                <Text style={styles.indexName}>{category.indexName || category.name}</Text>
                <Text style={styles.indexCode}>{category.shortCode}</Text>
              </View>

              {detail ? (
                <>
                  <Text style={[styles.indexMessage, { color: meta.color }]}>
                    {detail.message || meta.label}
                  </Text>
                  <Text style={styles.indexMarks}>
                    {detail.totalMarks ?? 0}
                    {detail.maxMarks ? ` / ${detail.maxMarks}` : ''} marks
                    {detail.overridden ? ' · overridden by you' : ''}
                  </Text>
                </>
              ) : (
                <Text style={styles.indexEmpty}>Not recorded — the student has not taken this survey.</Text>
              )}

              <View style={styles.indexActions}>
                <Select
                  variant="chip"
                  label="Band"
                  value={detail?.level || ''}
                  options={RISK_ORDER.map((level) => ({ value: level, label: riskMeta(level).label }))}
                  onChange={(level) => setLevel(category.id, level)}
                  disabled={busyIndex === category.id}
                />
                {detail?.overridden ? (
                  <Pressable
                    onPress={() => revert(category.id)}
                    disabled={busyIndex === category.id}
                    style={({ pressed }) => [styles.revert, pressed && styles.pressed]}
                    accessibilityRole="button"
                  >
                    <Ionicons name="refresh-outline" size={16} color={SLATE[600]} />
                    <Text style={styles.revertText}>Revert</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}
      </FormSheet>

      <PsychometricSheet
        visible={!!psychometricFor}
        student={psychometricFor}
        onClose={() => setPsychometricFor(null)}
        showToast={showToast}
      />
    </ScreenScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  picker: { paddingHorizontal: 0, paddingVertical: 0 },
  loader: { marginVertical: SPACING.xl },

  legend: { flexDirection: 'row', gap: SPACING.md, paddingVertical: SPACING.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: TYPE.caption, color: SLATE[500], fontWeight: '600' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  rowText: { flex: 1 },
  name: { fontSize: TYPE.heading, fontWeight: '600', color: SLATE[800] },
  meta: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 1 },
  riskChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  riskText: { fontSize: TYPE.caption, fontWeight: '700' },

  chart: { marginBottom: SPACING.md },

  indexBlock: {
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  indexHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  indexName: { flex: 1, fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  indexCode: { fontSize: TYPE.caption, fontWeight: '700', color: SLATE[500] },
  indexMessage: { fontSize: TYPE.label, marginTop: 3, lineHeight: leading(TYPE.label) },
  indexMarks: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 2 },
  indexEmpty: { fontSize: TYPE.label, color: SLATE[500], fontStyle: 'italic', marginTop: 3 },
  indexActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: 8 },
  revert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: SLATE[100],
  },
  revertText: { fontSize: TYPE.label, fontWeight: '600', color: SLATE[600] },
  pressed: { opacity: 0.72 },
}));
