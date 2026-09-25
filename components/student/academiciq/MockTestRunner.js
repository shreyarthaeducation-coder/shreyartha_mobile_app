import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { SLATE, SPACING, TYPE } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { fromLettered } from '../../../utils/questionModel';
import { buildTagBreakdown } from '../../../utils/tagBreakdown';
import {
  fetchMockTestAnalysis,
  fetchMockTestQuestions,
  submitMockTest,
} from '../../../services/student/competitiveExamService';
import ExamRunner from '../testrunner/ExamRunner';
import MockTestResult from './MockTestResult';
import { StudentCard, StudentCardTitle, StudentNote } from '../StudentCard';

/**
 * Taking a mock test on the phone.
 *
 * ── THIS IS NEW, NOT A PORT OF SOMETHING BROKEN ─────────────────────────────
 * The app has listed mock papers for a long time, with a chevron on each card and **no `onPress`**:
 * tapping a paper did nothing. `fetchMockTestQuestions` and `submitMockTest` were both written and
 * had zero callers. This is the screen that was missing.
 *
 * Scoring is the SERVER's: `POST /mocktest/{paperId}/submit` grades the letters and returns the
 * marks, the percentage and the predicted rank. The client never recomputes a total — it would be a
 * second opinion on a number students compare with their friends.
 *
 * The Bloom's and skill breakdown IS computed here, from the questions in hand plus the answers
 * just sent. The attempt row stores no per-question answers, so there is nothing to ask the server
 * for; see `utils/tagBreakdown.js`.
 */
export default function MockTestRunner({ paper, onBack, showToast }) {
  const styles = useStyles();
  const palette = usePalette();

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState({});
  const [markedForRetry, setMarkedForRetry] = useState(new Set());
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setAnswers({});
    setMarkedForRetry(new Set());
    setResult(null);
    try {
      // NOT shuffled, matching the web: a mock paper keeps the order it was authored in, because
      // its sections and difficulty ramp live in that order and the report is built from it.
      setQuestions(await fetchMockTestQuestions(paper.id));
    } catch {
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [paper.id]);

  useEffect(() => {
    load();
  }, [load]);

  const runnerQuestions = useMemo(() => questions.map(fromLettered), [questions]);

  const send = useCallback(async () => {
    setSubmitting(true);
    try {
      const response = await submitMockTest(paper.id, { answers, timeTakenSeconds: null });
      // Locally computed first, so the report appears the moment the marks do.
      let breakdown = buildTagBreakdown(runnerQuestions, answers);
      try {
        // The server's version also carries a class average, which no client can work out. An
        // attempt from before the answer trail existed comes back empty — hence the fallback.
        const analysis = await fetchMockTestAnalysis(response?.attemptId);
        if (analysis?.bloomsBreakdown?.some((row) => row.total > 0)) {
          breakdown = {
            bloomsBreakdown: analysis.bloomsBreakdown,
            skillBreakdown: analysis.skillBreakdown || [],
          };
        }
      } catch {
        // Keep the local breakdown; it is the same arithmetic minus the class average.
      }
      setResult({ ...response, breakdown });
    } catch (e) {
      // The attempt is lost if this fails, so it is said plainly rather than left looking submitted.
      showToast?.(e?.message || 'Could not submit this attempt. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [paper.id, answers, runnerQuestions, showToast]);

  const confirmSubmit = () => {
    const answered = Object.keys(answers).length;
    Alert.alert(
      'Submit mock test?',
      `You have answered ${answered} of ${questions.length} questions.`,
      [
        { text: 'Keep answering', style: 'cancel' },
        { text: 'Submit', onPress: send },
      ],
    );
  };

  if (loading) {
    return <ActivityIndicator size="large" color={palette.primary} style={styles.loader} />;
  }

  return (
    <>
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Text style={styles.backText}>← Back to papers</Text>
      </Pressable>

      <StudentCard>
        <StudentCardTitle>{paper.name || paper.title}</StudentCardTitle>
        <Text style={styles.meta}>
          {questions.length} questions
          {paper.durationMinutes ? ` · ${paper.durationMinutes} minutes` : ''}
        </Text>
      </StudentCard>

      {questions.length === 0 ? (
        <StudentCard>
          <StudentNote>No questions have been added to this paper yet.</StudentNote>
        </StudentCard>
      ) : (
        <ExamRunner
          questions={runnerQuestions}
          answers={answers}
          onAnswer={(questionId, key) => setAnswers((prev) => ({ ...prev, [questionId]: key }))}
          marked={markedForRetry}
          onToggleMark={(questionId) =>
            setMarkedForRetry((previous) => {
              const next = new Set(previous);
              if (next.has(questionId)) next.delete(questionId);
              else next.add(questionId);
              return next;
            })
          }
          submitted={!!result}
          onSubmit={submitting ? undefined : confirmSubmit}
          submitLabel={submitting ? 'Submitting…' : 'Submit Mock Test'}
          footer={
            result ? (
              <>
                <MockTestResult result={result} paperName={paper.name || paper.title} />
                <Pressable
                  onPress={load}
                  style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryText}>Try Again</Text>
                </Pressable>
              </>
            ) : null
          }
        />
      )}
    </>
  );
}

const useStyles = makeStyles((p) => ({
  loader: { marginVertical: SPACING.xl },
  back: { paddingVertical: SPACING.xs },
  backText: { fontSize: TYPE.label, fontWeight: '700', color: p.deep },
  meta: { fontSize: TYPE.caption, color: SLATE[500] },
  primary: {
    marginTop: SPACING.md,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: p.primary,
  },
  primaryText: { fontSize: TYPE.heading, fontWeight: '700', color: p.onPrimary },
  pressed: { opacity: 0.78 },
}));
