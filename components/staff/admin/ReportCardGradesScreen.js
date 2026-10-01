import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SLATE, SPACING, TYPE } from '../../../constants/theme';
import { Card, EmptyState, ScreenScaffold, SegmentedTabs, useToast } from '../../ui';
import { usePalette } from '../../ui/PaletteContext';
import { defaultAcademicYear, fetchAcademicYears } from '../../../services/teacher/scopeService';
import {
  REPORT_CARD_TABS,
  fetchCategorySections,
  fetchCategorySheet,
  filledIn,
} from '../../../services/admin/gradeAreaAdminService';

/**
 * Report Card Grades — the website's GradeAreaGrades: what the teachers have graded, section by
 * section, and how much of each section's grid is filled in — the question worth asking a week
 * before report cards.
 *
 * READ-ONLY, deliberately, as on the website: a grade is the teacher's judgement of a child they
 * teach, and an admin overwriting one from another screen would be a disagreement recorded as if it
 * were the teacher's own. The server would allow it; this screen does not offer it.
 */
export default function ReportCardGradesScreen({ homeRoute }) {
  const PALETTE = usePalette();
  const { toast, showToast } = useToast();
  const [years, setYears] = useState([]);
  const [yearId, setYearId] = useState(null);
  const [tab, setTab] = useState(REPORT_CARD_TABS[0].key);
  const [sections, setSections] = useState([]);
  const [selected, setSelected] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingSheet, setLoadingSheet] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchAcademicYears()
      .then((list) => {
        if (!alive) return;
        setYears(list);
        setYearId(defaultAcademicYear(list)?.id ?? null);
      })
      .catch(() => alive && setYears([]));
    return () => {
      alive = false;
    };
  }, []);

  const loadSections = useCallback(async () => {
    if (!yearId) return;
    setLoading(true);
    try {
      setSections(await fetchCategorySections(tab, yearId));
    } catch (e) {
      setSections([]);
      showToast(e?.message || 'Could not load sections.', 'error');
    } finally {
      setLoading(false);
    }
  }, [tab, yearId, showToast]);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  // Three tabs are three sets of areas over the same students: a tab change keeps the section.
  useEffect(() => {
    if (!selected) {
      setSheet(null);
      return undefined;
    }
    let alive = true;
    setLoadingSheet(true);
    fetchCategorySheet(tab, selected.sectionId)
      .then((res) => alive && setSheet(res))
      .catch((e) => {
        if (!alive) return;
        setSheet(null);
        showToast(e?.message || 'Could not load that section.', 'error');
      })
      .finally(() => alive && setLoadingSheet(false));
    return () => {
      alive = false;
    };
  }, [selected, tab, showToast]);

  const byClass = useMemo(() => {
    const groups = [];
    const index = new Map();
    sections.forEach((row) => {
      if (!index.has(row.classId)) {
        index.set(row.classId, groups.length);
        groups.push({ classId: row.classId, className: row.className, sections: [] });
      }
      groups[index.get(row.classId)].sections.push(row);
    });
    return groups;
  }, [sections]);

  const progress = filledIn(sheet);

  return (
    <ScreenScaffold title="Report Card Grades" fallbackRoute={homeRoute} scroll={false} toast={toast}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <Text style={styles.blurb}>
          What teachers have entered for each graded area. Areas are set up in Report Card Areas, and grades are entered
          by the teacher who takes the section.
        </Text>

        {years.length > 1 ? (
          <View style={styles.chips}>
            {years.map((y) => {
              const on = y.id === yearId;
              return (
                <Pressable
                  key={y.id}
                  onPress={() => {
                    setYearId(y.id);
                    setSelected(null);
                  }}
                  style={[styles.chip, on && { backgroundColor: PALETTE.tint, borderColor: PALETTE.primary }]}
                >
                  <Text style={[styles.chipText, on && { color: PALETTE.primaryDark }]}>{y.yearLabel}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <SegmentedTabs options={REPORT_CARD_TABS.map((t) => ({ value: t.key, label: t.label }))} value={tab} onChange={setTab} />

        {loading ? (
          <ActivityIndicator size="large" color={PALETTE.primary} style={styles.loader} />
        ) : sections.length === 0 ? (
          <EmptyState icon="school-outline" title="No sections" message="This year has no classes and sections yet." />
        ) : (
          <>
            {byClass.map((group) => (
              <View key={group.classId} style={styles.group}>
                <Text style={styles.className}>Class {group.className}</Text>
                <View style={styles.chips}>
                  {group.sections.map((s) => {
                    const on = selected?.sectionId === s.sectionId;
                    return (
                      <Pressable
                        key={s.sectionId}
                        onPress={() => setSelected(s)}
                        style={[styles.chip, on && { backgroundColor: PALETTE.tint, borderColor: PALETTE.primary }]}
                      >
                        <Text style={[styles.chipText, on && { color: PALETTE.primaryDark }]}>
                          {s.sectionName} · {s.fieldCount} area{s.fieldCount === 1 ? '' : 's'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

            {!selected ? (
              <Text style={styles.hint}>Choose a section to see its grades.</Text>
            ) : loadingSheet ? (
              <ActivityIndicator size="small" color={PALETTE.primary} style={styles.loader} />
            ) : !sheet ? null : !sheet.fields?.length ? (
              <Text style={styles.hint}>No areas set up for Class {sheet.className} – {sheet.sectionName} yet.</Text>
            ) : !sheet.students?.length ? (
              <Text style={styles.hint}>No students in this section yet.</Text>
            ) : (
              <>
                {progress ? (
                  <Text style={styles.progress}>
                    {progress.done} of {progress.cells} grades entered
                    {progress.done < progress.cells ? ` — ${progress.cells - progress.done} still empty` : ' — complete'}
                  </Text>
                ) : null}
                {sheet.students.map((st) => (
                  <Card key={st.studentId}>
                    <Text style={styles.studentName}>
                      {st.studentName}
                      {st.rollNumber ? <Text style={styles.meta}> · Roll {st.rollNumber}</Text> : null}
                    </Text>
                    {sheet.fields.map((f) => {
                      const grade = st.grades?.[f.id];
                      const empty = grade == null || String(grade).trim() === '';
                      return (
                        <View key={f.id} style={styles.gradeRow}>
                          <Text style={styles.fieldName}>{f.fieldName}</Text>
                          <Text style={[styles.grade, empty && styles.gradeEmpty]}>{empty ? '—' : grade}</Text>
                        </View>
                      );
                    })}
                  </Card>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: SPACING.md, paddingBottom: SPACING.xl, gap: SPACING.sm },
  loader: { marginVertical: SPACING.lg },
  blurb: { fontSize: TYPE.body, color: SLATE[600] },
  hint: { fontSize: TYPE.label, color: SLATE[500], marginVertical: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: SLATE[200], backgroundColor: '#ffffff' },
  chipText: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[600] },
  group: { gap: 4 },
  className: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[700] },
  progress: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[700] },
  studentName: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800], marginBottom: 4 },
  meta: { fontSize: TYPE.label, color: SLATE[500], fontWeight: '400' },
  gradeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderTopWidth: 1, borderTopColor: SLATE[100] },
  fieldName: { flex: 1, fontSize: TYPE.body, color: SLATE[700] },
  grade: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[900] },
  gradeEmpty: { color: SLATE[400] },
});
