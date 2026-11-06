import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE } from '../../../constants/theme';
import { EmptyState, FormSheet, ScreenScaffold, Select, StatusChip } from '../../ui';
import { usePalette } from '../../ui/PaletteContext';
import useStaffResource from '../../../hooks/useStaffResource';
import { staffApi } from '../../../services/staffApi';
import { defaultAcademicYear, fetchAcademicYears } from '../../../services/teacher/scopeService';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * Student Performance & Report (5 Nov 2026) — the website's StudentPerformanceReport for the
 * Principal and the School Admin: one section, one term, every subject's marks (theory and
 * practical) beside the three graded areas, for every student at once. Read-only — marks belong to
 * the teacher who marked the paper, grades to the teacher's judgement.
 *
 * The website's wide table becomes one card per student here; a card opens that student's whole
 * report, as the website's report view does.
 *
 * `/api/school-admin/performance-report` and `/api/school-admin/grade-fields`, both on SCHOOL_ADMIN.
 */

const BASE = '/api/school-admin';

const CATEGORY_LABELS = { SCHOLASTIC: 'Scholastic', CO_SCHOLASTIC: 'Co-scholastic', ADDITIONAL_SKILL: 'Additional Skills' };
const GRADE_SCALE = 'A+ (90-100), A (80-89), B+ (70-79), B (60-69), C+ (50-59), C (40-49), D (Below 40)';

const toMark = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const show = (v) => (v == null || v === '' ? '—' : String(v));

/** The website's combineMarks: the total so far, and which half is still unmarked. */
export function combineMarks(theory, practical, { absent = false, practicalExpected = true } = {}) {
  const written = absent ? null : toMark(theory);
  const lab = toMark(practical);
  if (written == null && lab == null) return null;
  let missing = null;
  if (!absent && written == null) missing = 'theory';
  else if (practicalExpected && lab == null) missing = 'practical';
  return { value: written == null ? lab : lab == null ? written : written + lab, missing };
}

export function totalOutOf(theoryMax, practicalMax) {
  const written = toMark(theoryMax);
  const lab = toMark(practicalMax);
  if (written == null && lab == null) return null;
  return (written ?? 0) + (lab ?? 0);
}

function SubjectLine({ subject, scored, styles }) {
  const absent = scored?.status === 'ABSENT';
  const combined = combineMarks(scored?.theory, scored?.practical, { absent, practicalExpected: subject.practicalMax != null });
  const outOf = totalOutOf(subject.theoryMax, subject.practicalMax);
  return (
    <View style={styles.subject}>
      <Text style={styles.subjectName}>{subject.subjectName}</Text>
      <Text style={styles.subjectMarks}>
        {absent ? 'Absent' : `Theory ${show(scored?.theory)}${subject.theoryMax != null ? `/${subject.theoryMax}` : ''}`}
        {subject.practicalMax != null ? ` · Practical ${show(scored?.practical)}/${subject.practicalMax}` : ''}
      </Text>
      <Text style={styles.subjectTotal}>
        {combined ? `${combined.value}${outOf != null ? `/${outOf}` : ''}` : '—'}
        {combined?.missing ? ' *' : ''}
      </Text>
    </View>
  );
}

/** "Class 7 A" — the server's class name may already read "Class 7" or just "7". */
const sectionName = (className, section) => `${/^class\s/i.test(String(className || '')) ? className : `Class ${className}`} ${section || ''}`.trim();

export default function PerformanceReportScreen({ homeRoute }) {
  const styles = useStyles();
  const palette = usePalette();
  const [years, setYears] = useState([]);
  const [yearId, setYearId] = useState(null);
  const [sectionId, setSectionId] = useState(null);
  const [examName, setExamName] = useState('');
  const [exams, setExams] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    fetchAcademicYears()
      .then((rows) => {
        setYears(rows);
        setYearId(defaultAcademicYear(rows)?.id ?? null);
      })
      .catch(() => setYears([]));
  }, []);

  const sectionsFetcher = useCallback(
    (signal) => staffApi.get(`${BASE}/grade-fields/SCHOLASTIC/sections`, { params: { academicYearId: yearId }, signal }),
    [yearId],
  );
  const { data: sectionRows } = useStaffResource(sectionsFetcher, { enabled: !!yearId, initialData: [] });
  const sections = Array.isArray(sectionRows) ? sectionRows : [];

  // A subject has as many papers as the year has terms; picking the section asks which terms it has
  // sat and opens the most recent, as the website does.
  useEffect(() => {
    setExams([]);
    setExamName('');
    if (!sectionId) return undefined;
    let live = true;
    staffApi
      .get(`${BASE}/performance-report/exams`, { params: { sectionId } })
      .then((res) => {
        if (!live) return;
        const names = Array.isArray(res) ? res : [];
        setExams(names);
        setExamName(names.length ? names[names.length - 1] : '');
      })
      .catch(() => live && setExams([]));
    return () => {
      live = false;
    };
  }, [sectionId]);

  const sheetFetcher = useCallback(
    (signal) => staffApi.get(`${BASE}/performance-report/sheet`, { params: { sectionId, examName: examName || undefined }, signal }),
    [sectionId, examName],
  );
  const { data: sheet, loading, error, reload, refreshing, refresh } = useStaffResource(sheetFetcher, { enabled: !!sectionId, initialData: null });

  const categories = (sheet?.categories || []).filter((c) => (c.fields || []).length > 0);
  const subjects = sheet?.subjects || [];
  const students = useMemo(() => {
    const all = sheet?.students || [];
    const q = search.trim().toLowerCase();
    return q ? all.filter((s) => String(s.studentName || '').toLowerCase().includes(q)) : all;
  }, [sheet, search]);

  return (
    <ScreenScaffold
      title="Student Performance & Report"
      fallbackRoute={homeRoute}
      loading={!!sectionId && loading}
      error={sectionId ? error : ''}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={sectionId ? refresh : undefined}
    >
      <Text style={styles.lead}>
        Subject marks and every graded area for one section, side by side. Marks are entered by the teacher in Test & Examination, and grades in the three areas are set up under Report Card Areas.
      </Text>
      <View style={styles.scope}>
        <Select
          variant="chip"
          label="Year"
          value={yearId}
          onChange={(v) => {
            setYearId(v);
            setSectionId(null);
          }}
          options={years.map((y) => ({ value: y.id, label: y.current ? `${y.yearLabel} (Current)` : y.yearLabel }))}
          placeholder="Year"
        />
        <Select
          variant="chip"
          label="Section"
          value={sectionId}
          onChange={setSectionId}
          options={sections.map((s) => ({ value: s.sectionId, label: `${sectionName(s.className, s.sectionName)}${s.studentCount != null ? ` (${s.studentCount})` : ''}` }))}
          placeholder="Section"
          searchable={sections.length > 10}
        />
        {exams.length ? (
          <Select variant="chip" label="Term" value={examName} onChange={setExamName} options={exams.map((n) => ({ value: n, label: n }))} placeholder="Term" />
        ) : null}
      </View>

      {!sectionId ? (
        <EmptyState title="Pick a section" message={sections.length || !yearId ? 'Choose a class and section to see its sheet.' : 'No sections in this academic year yet.'} />
      ) : sheet ? (
        <>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search a student…"
            placeholderTextColor={SLATE[400]}
            style={styles.search}
            accessibilityLabel="Search a student"
          />
          {!exams.length ? <Text style={styles.note}>No term has been examined in this section yet; only the graded areas are shown.</Text> : null}
          {students.length === 0 ? <EmptyState title="No students" message="Nobody in this section matches." /> : null}
          {students.map((st, i) => {
            const marked = subjects.filter((s) => st.marks?.[s.subjectId] && (st.marks[s.subjectId].theory != null || st.marks[s.subjectId].practical != null || st.marks[s.subjectId].status === 'ABSENT')).length;
            const fields = categories.flatMap((c) => c.fields);
            const graded = fields.filter((f) => st.grades?.[f.id]).length;
            return (
              <Pressable key={st.studentId} onPress={() => setOpen(st)} style={({ pressed }) => [styles.card, pressed && styles.pressed]} accessibilityRole="button">
                <View style={styles.cardText}>
                  <Text style={styles.name}>
                    {i + 1}. {st.studentName}
                  </Text>
                  <View style={styles.chips}>
                    {subjects.length ? (
                      <StatusChip label={`Marks ${marked}/${subjects.length}`} tone={marked === subjects.length ? 'success' : marked ? 'warning' : 'neutral'} />
                    ) : null}
                    {fields.length ? (
                      <StatusChip label={`Grades ${graded}/${fields.length}`} tone={graded === fields.length ? 'success' : graded ? 'warning' : 'neutral'} />
                    ) : null}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={palette.primaryDark} />
              </Pressable>
            );
          })}
          <Text style={styles.note}>Grade scale: {GRADE_SCALE}</Text>
        </>
      ) : null}

      <FormSheet visible={!!open} title={open?.studentName || ''} subtitle={[open?.className, examName].filter(Boolean).join(' · ')} onClose={() => setOpen(null)} fullHeight>
        {open ? (
          <View>
            {subjects.length ? <Text style={styles.section}>Subjects{examName ? ` — ${examName}` : ''}</Text> : null}
            {subjects.map((s) => (
              <SubjectLine key={s.subjectId} subject={s} scored={open.marks?.[s.subjectId]} styles={styles} />
            ))}
            {subjects.length ? <Text style={styles.note}>* The other half of this subject has not been marked yet.</Text> : null}
            {categories.map((c) => (
              <View key={c.category}>
                <Text style={styles.section}>{CATEGORY_LABELS[c.category] || c.category}</Text>
                {c.fields.map((f) => (
                  <View key={f.id} style={styles.grade}>
                    <Text style={styles.gradeName}>{f.fieldName}</Text>
                    <Text style={styles.gradeValue}>{show(open.grades?.[f.id])}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : null}
      </FormSheet>
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  lead: { fontSize: TYPE.body, color: SLATE[600], marginBottom: SPACING.md },
  scope: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.md },
  search: {
    borderWidth: 1,
    borderColor: SLATE[300],
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontSize: TYPE.body,
    color: SLATE[900],
    backgroundColor: '#ffffff',
    marginBottom: SPACING.md,
  },
  note: { fontSize: TYPE.caption, color: SLATE[500], marginVertical: SPACING.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SLATE[200],
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardText: { flex: 1 },
  pressed: { opacity: 0.85 },
  name: { fontSize: TYPE.body, fontWeight: '800', color: SLATE[900] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  section: { fontSize: TYPE.label, fontWeight: '800', color: SLATE[500], textTransform: 'uppercase', letterSpacing: 0.5, marginTop: SPACING.md, marginBottom: SPACING.xs },
  subject: { paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: SLATE[100] },
  subjectName: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[900] },
  subjectMarks: { fontSize: TYPE.caption, color: SLATE[600], marginTop: 2 },
  subjectTotal: { fontSize: TYPE.body, fontWeight: '800', color: SLATE[800], marginTop: 2 },
  grade: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.md, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: SLATE[100] },
  gradeName: { flex: 1, fontSize: TYPE.body, color: SLATE[700] },
  gradeValue: { fontSize: TYPE.body, fontWeight: '800', color: SLATE[900] },
}));
