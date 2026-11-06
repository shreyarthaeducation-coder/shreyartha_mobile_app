import { useCallback, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SLATE, SPACING, TOUCH, TYPE, leading } from '../../constants/theme';
import { hueOf } from '../../constants/parentColours';
import { usePalette } from '../ui/PaletteContext';
import { EmptyState, ScreenScaffold, useToast } from '../ui';
import useStaffResource from '../../hooks/useStaffResource';
import ExamAnalysisSheet from '../staff/exams/ExamAnalysisSheet';
import { fetchSharedTests, fetchTestAnalysis, testScore } from '../../services/parent/testAnalysisService';
import { formatLongDate } from '../../utils/dates';
import { makeStyles } from '../../utils/makeStyles';

/**
 * View Report → Test & Analysis (4 Nov 2026): the website's parent Test & Exam Analysis, on the
 * phone.
 *
 * The child's tests that their subject teachers shared with parents, newest first, each with the
 * child's marks. "View analysis" opens the Detailed Analysis — the same sheet the teacher opens
 * (ExamAnalysisSheet), drawing only the parts that teacher shared. "View Report Card" at the top
 * opens the child's report card, as the button top right of the website's page does.
 *
 * Which tests appear, and what each analysis shows, is the server's decision on every request; this
 * screen only draws what it is sent.
 */
export default function TestAnalysisPanel() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const hue = hueOf('tests');
  const [target, setTarget] = useState(null);
  const { toast, showToast } = useToast();

  // The server answers 400 with its own words for ordinary states — "No child is linked to this
  // account yet", "Your child is not enrolled in a class for this year yet" — which are not failures
  // to retry: they are shown as the empty state, in those words.
  const fetcher = useCallback(async (signal) => {
    try {
      return await fetchSharedTests(signal);
    } catch (e) {
      if (e?.status === 400) return { tests: [], notice: e.message };
      throw e;
    }
  }, []);
  const { data, loading, error, refreshing, reload, refresh } = useStaffResource(fetcher, { initialData: null });
  const tests = [...(data?.tests || [])].sort((a, b) => String(b.examDate || '').localeCompare(String(a.examDate || '')));

  return (
    <ScreenScaffold
      embedded
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
      toast={toast}
    >
      {data?.schoolName ? (
        <View style={styles.letterhead}>
          {data.schoolLogo ? <Image source={{ uri: data.schoolLogo }} style={styles.logo} resizeMode="contain" /> : null}
          <Text style={styles.school} numberOfLines={2}>
            {data.schoolName}
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={() => router.push('/parent/report-card')}
        style={({ pressed }) => [styles.cardButton, { backgroundColor: palette.primary }, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Ionicons name="ribbon-outline" size={19} color="#ffffff" />
        <Text style={styles.cardButtonText}>{'View Report Card'}</Text>
        <Ionicons name="chevron-forward" size={17} color="#ffffff" />
      </Pressable>

      {tests.length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title="No tests shared yet"
          message={data?.notice || "When your child's teachers share a test's marks with parents, it appears here."}
        />
      ) : (
        tests.map((test) => {
          const score = testScore(test);
          return (
            <View key={test.examId} style={[styles.test, { borderColor: hue.border }]}>
              <View style={styles.testHead}>
                <View style={[styles.subject, { backgroundColor: hue.bg }]}>
                  <Text style={[styles.subjectText, { color: hue.fg }]} numberOfLines={1}>
                    {test.subjectName || 'Subject'}
                  </Text>
                </View>
                {test.examDate ? <Text style={styles.date}>{formatLongDate(test.examDate)}</Text> : null}
              </View>
              <Text style={styles.name}>{test.examName || test.examCode || 'Test'}</Text>
              <View style={styles.scoreRow}>
                <Text style={[styles.score, score.percent == null && styles.scoreMuted]}>{score.text}</Text>
                {test.analysisAvailable ? (
                  <Pressable
                    onPress={() => setTarget(test)}
                    style={({ pressed }) => [styles.analysis, { borderColor: hue.fg }, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`View the analysis of ${test.examName || 'this test'}`}
                  >
                    <Ionicons name="bar-chart-outline" size={16} color={hue.fg} />
                    <Text style={[styles.analysisText, { color: hue.fg }]}>View analysis</Text>
                  </Pressable>
                ) : null}
              </View>
              {score.percent != null ? (
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${score.percent}%`, backgroundColor: hue.fg }]} />
                </View>
              ) : null}
              {test.remarks ? <Text style={styles.remarks}>“{test.remarks}”</Text> : null}
            </View>
          );
        })
      )}

      <ExamAnalysisSheet
        visible={!!target}
        target={target}
        onClose={() => setTarget(null)}
        load={(t) => fetchTestAnalysis(t.examId)}
        palette={palette}
        showToast={showToast}
      />
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  letterhead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  logo: { width: 40, height: 40 },
  school: { flex: 1, fontSize: TYPE.heading, fontWeight: '800', color: SLATE[800] },

  cardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    minHeight: TOUCH.min,
    borderRadius: 14,
    marginBottom: SPACING.md,
  },
  cardButtonText: { fontSize: TYPE.heading, fontWeight: '800', color: '#ffffff' },

  test: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  testHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  subject: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, flexShrink: 1 },
  subjectText: { fontSize: TYPE.caption, fontWeight: '800' },
  date: { fontSize: TYPE.caption, color: SLATE[500] },
  name: { fontSize: TYPE.heading, fontWeight: '800', color: SLATE[800], marginTop: 6, lineHeight: leading(TYPE.heading) },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm, marginTop: 4 },
  score: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[700] },
  scoreMuted: { color: SLATE[500], fontWeight: '600' },
  analysis: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: TOUCH.min,
    paddingHorizontal: SPACING.sm,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  analysisText: { fontSize: TYPE.label, fontWeight: '800' },
  track: { height: 6, borderRadius: 3, backgroundColor: SLATE[100], marginTop: SPACING.sm, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  remarks: { fontSize: TYPE.caption, color: SLATE[600], fontStyle: 'italic', marginTop: SPACING.sm },

  pressed: { opacity: 0.8 },
}));
