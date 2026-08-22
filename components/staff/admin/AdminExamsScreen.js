import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import {
  Card,
  EmptyState,
  FormSheet,
  ScreenScaffold,
  Select,
  StatusChip,
  TextField,
  useToast,
} from '../../ui';
import useStaffResource from '../../../hooks/useStaffResource';
import {
  EXAM_TYPES,
  EXAM_TYPE_DEFAULT_CODE,
  MARK_STATUSES,
  clampMark,
  createExam,
  fetchExams,
  fetchMarksSheet,
  saveMarks,
  setExamVisibility,
  updateExam,
} from '../../../services/admin/examService';
import { fetchSchoolClasses } from '../../../services/admin/classService';
import { defaultAcademicYear, fetchAcademicYears } from '../../../services/teacher/scopeService';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * Test and Examination — the ADMIN side: create and edit exams, publish results to parents, and
 * enter marks.
 *
 * NOT the teacher's ExamsScreen. A teacher can only enter marks against exams created here, and
 * the marks write is a PUT per student rather than one POST for the sheet. See examService.
 *
 * Scope is year → class → section → subject. It cannot reuse `ScopePicker`, which fetches a
 * teacher's own assignments; this one walks the school's whole tree from
 * `/api/school-admin/classes`.
 */

const EMPTY_EXAM = { examType: 'MONTHLY', examCode: 'MT1', examName: '', maxMarks: '100' };

export default function AdminExamsScreen({ homeRoute, apiBase, classesBase }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const { toast, showToast } = useToast();

  const [years, setYears] = useState([]);
  const [yearId, setYearId] = useState(null);
  const [classId, setClassId] = useState(null);
  const [sectionId, setSectionId] = useState(null);
  const [subjectId, setSubjectId] = useState(null);

  const [examSheet, setExamSheet] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_EXAM);
  const [saving, setSaving] = useState(false);

  const [marksExam, setMarksExam] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [edits, setEdits] = useState({});
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [savingMarks, setSavingMarks] = useState(false);

  useEffect(() => {
    fetchAcademicYears()
      .then((rows) => {
        setYears(rows);
        setYearId(defaultAcademicYear(rows)?.id ?? null);
      })
      .catch(() => setYears([]));
  }, []);

  const classesFetcher = useCallback(
    (signal) => fetchSchoolClasses(classesBase, yearId, signal),
    [classesBase, yearId],
  );
  const { data: classes } = useStaffResource(classesFetcher, {
    enabled: !!yearId,
    initialData: [],
  });

  const classList = classes || [];
  const currentClass = classList.find((c) => c.id === classId) || null;
  const sections = currentClass?.sections || [];
  const currentSection = sections.find((s) => s.id === sectionId) || null;
  const subjects = currentSection?.subjects || [];

  // Clear the levels below whenever one above changes — a stale sectionId from another class
  // would query a section this subject does not belong to and return an empty list.
  useEffect(() => {
    setSectionId(null);
    setSubjectId(null);
  }, [classId, yearId]);
  useEffect(() => {
    setSubjectId(null);
  }, [sectionId]);

  const scope = useMemo(
    () => ({ academicYearId: yearId, sectionId, subjectId }),
    [yearId, sectionId, subjectId],
  );
  const ready = !!(yearId && sectionId && subjectId);

  const examsFetcher = useCallback((signal) => fetchExams(apiBase, scope, signal), [apiBase, scope]);
  const { data, loading, error, refreshing, reload, refresh, revalidate } = useStaffResource(
    examsFetcher,
    { enabled: ready, initialData: [] },
  );

  const exams = data || [];

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_EXAM);
    setExamSheet(true);
  };

  const openEdit = (exam) => {
    setEditingId(exam.id);
    setForm({
      examType: exam.examType,
      examCode: exam.examCode || '',
      examName: exam.examName || '',
      maxMarks: String(exam.maxMarks ?? 100),
    });
    setExamSheet(true);
  };

  // Picking a type pre-fills its code, but only when creating — the web refuses to overwrite the
  // code of an exam that already exists.
  const pickType = (examType) =>
    setForm((prev) => ({
      ...prev,
      examType,
      examCode: editingId ? prev.examCode : (EXAM_TYPE_DEFAULT_CODE[examType] ?? ''),
    }));

  const submitExam = async () => {
    if (!form.examCode.trim()) {
      showToast('Exam code is required.', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingId) await updateExam(apiBase, editingId, form);
      else await createExam(apiBase, { sectionId, subjectId, ...form });
      showToast(editingId ? 'Exam updated.' : 'Exam created.', 'success');
      setExamSheet(false);
      await revalidate();
    } catch (e) {
      showToast(e?.message || 'Failed to save the exam.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleVisibility = async (exam) => {
    try {
      await setExamVisibility(apiBase, exam.id, !exam.visibleToParents);
      showToast(
        `Results for ${exam.examCode} are now ${!exam.visibleToParents ? 'visible' : 'hidden'} to parents.`,
        'success',
      );
      await revalidate();
    } catch (e) {
      showToast(e?.message || 'Failed to update visibility.', 'error');
    }
  };

  // Keyed on the id alone — `marksExam` is rebuilt on every render by the row that opened it, and
  // depending on the object would refetch forever.
  const marksExamId = marksExam?.id ?? null;
  useEffect(() => {
    if (!marksExamId) return undefined;
    let alive = true;
    setLoadingSheet(true);
    (async () => {
      try {
        const data2 = await fetchMarksSheet(apiBase, marksExamId);
        if (!alive) return;
        setSheet(data2);
        const seed = {};
        (data2?.students || []).forEach((s) => {
          seed[s.studentId] = {
            status: s.status || 'PRESENT',
            marksObtained: s.marksObtained != null ? String(s.marksObtained) : '',
            remarks: s.remarks || '',
          };
        });
        setEdits(seed);
      } catch (e) {
        if (alive) showToast(e?.message || 'Could not load the marks sheet.', 'error');
      } finally {
        if (alive) setLoadingSheet(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [apiBase, marksExamId, showToast]);

  const submitMarks = async () => {
    setSavingMarks(true);
    try {
      await saveMarks(
        apiBase,
        marksExamId,
        (sheet?.students || []).map((s) => ({ studentId: s.studentId, ...edits[s.studentId] })),
      );
      showToast('Marks saved.', 'success');
      setMarksExam(null);
      setSheet(null);
    } catch (e) {
      showToast(e?.message || 'Failed to save marks.', 'error');
    } finally {
      setSavingMarks(false);
    }
  };

  const maxMarks = sheet?.maxMarks ?? marksExam?.maxMarks ?? null;

  return (
    <ScreenScaffold
      title="Test and Examination"
      fallbackRoute={homeRoute}
      loading={ready && loading}
      error={ready ? error : ''}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
      toast={toast}
    >
      <View style={styles.scopeBar}>
        <Select
          variant="chip"
          label="Year"
          value={yearId}
          onChange={setYearId}
          options={years.map((year) => ({
            value: year.id,
            label: year.current ? `${year.yearLabel} (Current)` : year.yearLabel,
          }))}
          placeholder="Year"
        />
        <Select
          variant="chip"
          label="Class"
          value={classId}
          onChange={setClassId}
          options={classList.map((cls) => ({ value: cls.id, label: `Class ${cls.className}` }))}
          placeholder="Class"
        />
        <Select
          variant="chip"
          label="Section"
          value={sectionId}
          onChange={setSectionId}
          options={sections.map((s) => ({ value: s.id, label: `Section ${s.sectionName}` }))}
          placeholder="Section"
          disabled={!classId}
        />
        <Select
          variant="chip"
          label="Subject"
          value={subjectId}
          onChange={setSubjectId}
          options={subjects.map((s) => ({ value: s.id, label: s.subjectName }))}
          placeholder="Subject"
          disabled={!sectionId}
        />
      </View>

      {!ready ? (
        <EmptyState
          icon="clipboard-outline"
          title="Choose a subject"
          message="Pick a year, class, section and subject to see its exams."
        />
      ) : exams.length === 0 ? (
        <EmptyState
          icon="clipboard-outline"
          title="No exams yet"
          message="Create an exam for this subject; teachers can then enter marks against it."
          actionLabel="Create exam"
          onAction={openCreate}
        />
      ) : (
        exams.map((exam) => (
          <Card key={exam.id} style={styles.item}>
            <View style={styles.head}>
              <View style={styles.headText}>
                <Text style={styles.examName} numberOfLines={1}>
                  {exam.examName || exam.examCode}
                </Text>
                <Text style={styles.examMeta}>
                  {exam.examCode} · {exam.examType} · max {exam.maxMarks}
                </Text>
              </View>
              <Pressable
                onPress={() => openEdit(exam)}
                style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${exam.examCode}`}
              >
                <Ionicons name="pencil-outline" size={17} color={SLATE[400]} />
              </Pressable>
            </View>

            <View style={styles.visibilityRow}>
              <StatusChip
                label={exam.visibleToParents ? 'Visible to parents' : 'Hidden from parents'}
                tone={exam.visibleToParents ? 'success' : 'neutral'}
              />
              <View style={styles.spacer} />
              <Switch
                value={!!exam.visibleToParents}
                onValueChange={() => toggleVisibility(exam)}
                trackColor={{ true: PALETTE.accent, false: SLATE[200] }}
                thumbColor={exam.visibleToParents ? PALETTE.primary : '#ffffff'}
              />
            </View>

            <Pressable
              onPress={() => setMarksExam(exam)}
              style={({ pressed }) => [
                styles.marksBtn,
                { backgroundColor: PALETTE.primary },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.marksBtnText}>Enter marks</Text>
            </Pressable>
          </Card>
        ))
      )}

      {ready && exams.length > 0 ? (
        <Pressable
          onPress={openCreate}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: PALETTE.primary },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Create exam"
        >
          <Ionicons name="add" size={26} color="#ffffff" />
        </Pressable>
      ) : null}

      <FormSheet
        visible={examSheet}
        title={editingId ? 'Edit exam' : 'New exam'}
        onClose={() => setExamSheet(false)}
        onSubmit={submitExam}
        submitLabel={editingId ? 'Save' : 'Create'}
        submitting={saving}
      >
        <Select label="Type" value={form.examType} onChange={pickType} options={EXAM_TYPES} />
        <TextField
          label="Code"
          required
          value={form.examCode}
          onChangeText={(examCode) => setForm((prev) => ({ ...prev, examCode }))}
          placeholder="e.g. MT1"
        />
        <TextField
          label="Name"
          value={form.examName}
          onChangeText={(examName) => setForm((prev) => ({ ...prev, examName }))}
          placeholder="Defaults to the code"
        />
        <TextField
          label="Maximum marks"
          value={form.maxMarks}
          onChangeText={(maxMarksValue) =>
            setForm((prev) => ({ ...prev, maxMarks: maxMarksValue.replace(/[^0-9]/g, '') }))
          }
          keyboardType="number-pad"
        />
      </FormSheet>

      <FormSheet
        visible={!!marksExam}
        title={marksExam ? `Marks · ${marksExam.examCode}` : 'Marks'}
        subtitle={maxMarks != null ? `Out of ${maxMarks}` : undefined}
        onClose={() => {
          setMarksExam(null);
          setSheet(null);
        }}
        onSubmit={submitMarks}
        submitLabel="Save"
        submitting={savingMarks}
        submitDisabled={loadingSheet}
        fullHeight
      >
        {loadingSheet ? (
          <ActivityIndicator style={styles.spinner} color={PALETTE.primary} />
        ) : (sheet?.students || []).length === 0 ? (
          <Text style={styles.hint}>This section has no students.</Text>
        ) : (
          (sheet?.students || []).map((student) => {
            const entry = edits[student.studentId] || {};
            const absent = entry.status === 'ABSENT';
            return (
              <View key={student.studentId} style={styles.student}>
                <Text style={styles.studentName} numberOfLines={1}>
                  {student.studentName}
                  {student.rollNumber ? ` · ${student.rollNumber}` : ''}
                </Text>
                <View style={styles.studentRow}>
                  <Select
                    variant="chip"
                    label="Status"
                    value={entry.status}
                    onChange={(status) =>
                      setEdits((prev) => ({
                        ...prev,
                        [student.studentId]: { ...prev[student.studentId], status },
                      }))
                    }
                    options={MARK_STATUSES}
                  />
                  {!absent ? (
                    <View style={styles.markField}>
                      <TextField
                        label="Marks"
                        value={entry.marksObtained}
                        onChangeText={(text) =>
                          setEdits((prev) => ({
                            ...prev,
                            [student.studentId]: {
                              ...prev[student.studentId],
                              // The only max-marks guard that exists on mobile — see clampMark.
                              marksObtained: clampMark(text, maxMarks),
                            },
                          }))
                        }
                        keyboardType="decimal-pad"
                        placeholder="—"
                      />
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </FormSheet>
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  scopeBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.sm },
  item: { marginBottom: SPACING.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headText: { flex: 1 },
  examName: { fontSize: 15, fontWeight: '700', color: SLATE[800] },
  examMeta: { fontSize: 12, color: SLATE[500], marginTop: 2 },
  iconBtn: { padding: 5 },
  visibilityRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.sm },
  spacer: { flex: 1 },
  marksBtn: { marginTop: SPACING.sm, borderRadius: 9, paddingVertical: 9, alignItems: 'center' },
  marksBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13.5 },
  pressed: { opacity: 0.7 },
  fab: {
    position: 'absolute',
    right: SPACING.md,
    bottom: SPACING.md,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  student: { borderTopWidth: 1, borderTopColor: SLATE[100], paddingTop: SPACING.sm, marginTop: 6 },
  studentName: { fontSize: 13.5, fontWeight: '700', color: SLATE[700] },
  studentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 4 },
  markField: { flex: 1 },
  spinner: { marginTop: SPACING.lg },
  hint: { fontSize: 12.5, color: SLATE[500], marginTop: SPACING.sm },
}));
