import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SLATE, SPACING, TYPE } from '../../constants/theme';
import { EmptyState, ScreenScaffold, useToast } from '../ui';
import { usePalette } from '../ui/PaletteContext';
import { defaultAcademicYear, fetchAcademicYears } from '../../services/teacher/scopeService';
import { fetchMyClassTeacherSections } from '../../services/teacher/classReportCardService';
import ClassAnalysisPanel from './ClassAnalysisPanel';

/**
 * Class Analysis, its own entry next to Student Management (29 Oct 2026) — the website's
 * TeacherClassAnalysis. It used to sit inside Student Management and load whenever that opened; now
 * the class teacher comes here, ticks exams and subjects, and generates the sheet.
 *
 * The school's current year; the teacher's class-teacher section(s) in it, with a choice only when
 * there is more than one.
 */
export default function TeacherClassAnalysisScreen({ homeRoute = '/teacher' }) {
  const PALETTE = usePalette();
  const { toast, showToast } = useToast();
  const [sections, setSections] = useState(null);
  const [sectionId, setSectionId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const year = defaultAcademicYear(await fetchAcademicYears(controller.signal));
        if (!year) {
          setSections([]);
          return;
        }
        const mine = await fetchMyClassTeacherSections(year.id, controller.signal);
        setSections(mine);
        if (mine.length) setSectionId(mine[0].sectionId);
      } catch (e) {
        if (e?.name === 'AbortError') return;
        setSections([]);
        setError(e?.message || 'Could not find your class.');
      }
    })();
    return () => controller.abort();
  }, []);

  return (
    <ScreenScaffold title="Class Analysis" fallbackRoute={homeRoute} scroll={false} toast={toast}>
      <ScrollView contentContainerStyle={styles.body}>
        {sections === null ? (
          <ActivityIndicator color={PALETTE.primary} style={styles.loader} />
        ) : error ? (
          <EmptyState icon="alert-circle-outline" title="Could not load" message={error} />
        ) : sections.length === 0 ? (
          <EmptyState
            icon="school-outline"
            title="No class of your own"
            message="The class analysis is for a section's class teacher. You are not class teacher of any section this year."
          />
        ) : (
          <>
            {sections.length > 1 ? (
              <View style={styles.sectionRow}>
                {sections.map((s) => {
                  const on = s.sectionId === sectionId;
                  return (
                    <Pressable
                      key={s.sectionId}
                      onPress={() => setSectionId(s.sectionId)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      style={[styles.sectionChip, on && { backgroundColor: PALETTE.primary, borderColor: PALETTE.primary }]}
                    >
                      <Text style={[styles.sectionText, on && styles.sectionTextOn]}>
                        Class {s.className} - {s.sectionName}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            <ClassAnalysisPanel key={sectionId} sectionId={sectionId} showToast={showToast} />
          </>
        )}
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  body: { padding: SPACING.md, paddingBottom: SPACING.xxl, gap: SPACING.md },
  loader: { marginTop: SPACING.xl },
  sectionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  sectionChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SLATE[300],
    backgroundColor: '#ffffff',
  },
  sectionText: { fontSize: TYPE.label, color: SLATE[700], fontWeight: '600' },
  sectionTextOn: { color: '#ffffff' },
});
