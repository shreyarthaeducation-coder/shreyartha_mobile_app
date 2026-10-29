import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TYPE } from '../../constants/theme';
import { SegmentedTabs } from '../ui';
import { usePalette } from '../ui/PaletteContext';
import PsychometricReport from '../student/psychometric/PsychometricReport';
import { fetchStudentReports } from '../../services/shared/psychometricReportService';

/** The teacher's psychometric endpoint family (own school only): the batch print endpoint. */
const REPORTS_API = '/api/teacher/psychometric-reports';

/**
 * "View graphs" under a student's psychometric result (29 Oct 2026) — the website's
 * PsychometricGraphs: the student's own report for each assessment answered, scored by the app's
 * own engine and drawn by the same component the student sees, one tab per assessment. View only:
 * no download here (bulk print is the separate Print link).
 *
 * Shown once the student has answered anything — a student two topics in has two reports.
 */
export default function StudentPsychometricGraphs({ studentId }) {
  const palette = usePalette();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('0');

  useEffect(() => {
    setItems(null);
    setError('');
    setTab('0');
    if (!open || !studentId) return undefined;
    const controller = new AbortController();
    fetchStudentReports(REPORTS_API, studentId, controller.signal)
      .then((list) => setItems(list))
      .catch((e) => {
        if (e?.name !== 'AbortError') setError(e?.message || 'Could not load the graphs.');
      });
    return () => controller.abort();
  }, [open, studentId]);

  const current = items?.[Number(tab)] || null;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [styles.button, { borderColor: palette.primary }, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Ionicons name={open ? 'chevron-up' : 'stats-chart-outline'} size={16} color={palette.primary} />
        <Text style={[styles.buttonText, { color: palette.primary }]}>{open ? 'Hide graphs' : 'View graphs'}</Text>
      </Pressable>

      {open ? (
        error ? (
          <Text style={styles.error}>{error}</Text>
        ) : items === null ? (
          <ActivityIndicator color={palette.primary} style={styles.loader} />
        ) : items.length === 0 ? (
          <Text style={styles.empty}>No answered assessment to show yet.</Text>
        ) : (
          <>
            {items.length > 1 ? (
              <SegmentedTabs
                scrollable
                options={items.map((it, i) => ({ value: String(i), label: it.topicName || `Report ${i + 1}` }))}
                value={tab}
                onChange={setTab}
                style={styles.tabs}
              />
            ) : null}
            {current ? (
              <PsychometricReport
                key={`${current.topicName}-${tab}`}
                results={current.results}
                topicType={current.topicType}
                topicName={current.topicName}
                studentInfo={current.studentInfo}
              />
            ) : null}
          </>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: SPACING.md, gap: SPACING.sm },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 10,
  },
  buttonText: { fontSize: TYPE.label, fontWeight: '700' },
  tabs: { marginBottom: SPACING.xs },
  loader: { marginVertical: SPACING.md },
  error: { fontSize: TYPE.label, color: FEEDBACK.errorText },
  empty: { fontSize: TYPE.label, color: SLATE[600] },
  pressed: { opacity: 0.72 },
});
