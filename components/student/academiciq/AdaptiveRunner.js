import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, QUIZ, SLATE, SPACING, TYPE } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import RichText from '../../RichText';
import { StudentCard, StudentCardTitle } from '../StudentCard';
import AdaptiveReportBody from '../../shared/AdaptiveReportBody';

/**
 * The UI for an adaptive attempt, driven entirely by a `useAdaptiveSession` instance.
 *
 * Deliberately dumb: it renders whatever the hook exposes and calls `choose` / `leave`. All three
 * adaptive engines share it, so none of them can quietly acquire different behaviour — the guards
 * live in the hook and the presentation lives here.
 *
 * ── OPTIONS ARRIVE AS AN ARRAY, NOT AS optionA…optionD ───────────────────────
 * Every adaptive engine serialises `PracticeQuestionResponse` — the legacy `/api/adaptive/` one and
 * the Competitive Exam one directly (`AdaptiveStartResponse.question`), and Universal Adaptive via
 * `UniversalAdaptiveQuestionResponse`, whose javadoc says outright that it mirrors it. All three
 * therefore send **`options: List<String>`** and grade by **index**, returning an Integer
 * `correctAnswer`.
 *
 * `optionA`…`optionD` is the UNDERSTANDING TEST's shape (which posts a LETTER) and never occurs
 * here. Reading it returned an empty array, so the question rendered with **no answers at all** and
 * the assessment could not be taken — on all three engines, not just Practice Zone.
 *
 * The optionA…D branch is kept only as a defensive fallback for a bank that has not been migrated;
 * it must never be the primary path.
 */

const nonEmpty = (list) => list.filter((t) => t != null && String(t).trim() !== '');

function optionsOf(q) {
  if (Array.isArray(q?.options)) return nonEmpty(q.options);
  return nonEmpty([q?.optionA, q?.optionB, q?.optionC, q?.optionD]);
}

export default function AdaptiveRunner({ session, title, subtitle, onExit, onFinishEarly, footer }) {
  const styles = useStyles();
  const palette = usePalette();

  const {
    phase,
    question,
    questionNumber,
    effectiveTotal,
    uncapped,
    level,
    selected,
    showFeedback,
    wasCorrect,
    correctAnswer,
    summary,
    report,
    loading,
    error,
    choose,
  } = session;

  if (loading) {
    return <ActivityIndicator size="large" color={palette.primary} style={styles.loader} />;
  }

  if (phase === 'summary' && summary) {
    return (
      <>
        <StudentCard>
          <StudentCardTitle>{title} — result</StudentCardTitle>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{summary.correctCount ?? 0}</Text>
              <Text style={styles.statLabel}>Correct</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{summary.wrongCount ?? 0}</Text>
              <Text style={styles.statLabel}>Wrong</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{summary.accuracyPercentage ?? 0}%</Text>
              <Text style={styles.statLabel}>Accuracy</Text>
            </View>
          </View>
          {summary.finalLevel ? (
            <Text style={styles.level}>Final level: {summary.finalLevel}</Text>
          ) : null}
        </StudentCard>

        {/* The full analysis — rank, the six-metric performance profile, timing and the Bloom's /
            skills breakdown. Only a 'server'-protocol engine produces one; the other two return
            counters and nothing else, so this is absent for them by design, not by omission.
            Same renderer the teacher sees, over the same DTO. */}
        {report ? (
          <StudentCard>
            <StudentCardTitle>Your analysis</StudentCardTitle>
            <AdaptiveReportBody report={report} />
          </StudentCard>
        ) : null}

        {footer}

        <Pressable
          onPress={onExit}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>Done</Text>
        </Pressable>
      </>
    );
  }

  if (error) {
    return (
      <>
        <StudentCard>
          <Text style={styles.error}>{error}</Text>
        </StudentCard>
        <Pressable
          onPress={onExit}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>Back</Text>
        </Pressable>
      </>
    );
  }

  if (!question) return null;

  const options = optionsOf(question);

  return (
    <>
      <Pressable
        onPress={onExit}
        style={({ pressed }) => [styles.crumb, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Leave the test"
      >
        <Ionicons name="arrow-back" size={14} color={palette.onDark} />
        <Text style={styles.crumbText} numberOfLines={1}>
          {subtitle ? `${title} · ${subtitle}` : title}
        </Text>
      </Pressable>

      <StudentCard>
        <View style={styles.progressHead}>
          {/* A 'server' engine has no fixed denominator — the run ends when the pool is exhausted,
              so there is no honest total to show. "Question 7" beats "Question 7 of Infinity". */}
          <Text style={styles.progressText}>
            Question {questionNumber}
            {uncapped ? '' : ` of ${effectiveTotal}`}
          </Text>
          {level ? <Text style={styles.levelChip}>{level}</Text> : null}
        </View>
        {uncapped ? null : (
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${effectiveTotal ? (questionNumber / effectiveTotal) * 100 : 0}%` },
              ]}
            />
          </View>
        )}
      </StudentCard>

      <StudentCard>
        <RichText html={question.questionText} />

        {options.map((text, index) => {
          const picked = selected === index;
          const isCorrect = showFeedback && correctAnswer === index;
          const isWrong = showFeedback && picked && correctAnswer !== index;
          return (
            <Pressable
              key={index}
              onPress={() => choose(index)}
              disabled={showFeedback}
              style={({ pressed }) => [
                styles.option,
                picked && styles.optionPicked,
                isCorrect && styles.optionCorrect,
                isWrong && styles.optionWrong,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: picked, disabled: showFeedback }}
            >
              <Text style={styles.optionKey}>{String.fromCharCode(65 + index)}</Text>
              <View style={styles.optionBody}>
                <RichText html={String(text)} textStyle={styles.optionText} />
              </View>
              {isCorrect ? <Text style={styles.mark}>✓</Text> : null}
              {isWrong ? <Text style={styles.mark}>✗</Text> : null}
            </Pressable>
          );
        })}

        {/* "Finish now" only exists for an UNCAPPED run. A capped one has a known end the student
            is counting down to; an uncapped one runs until the pool is exhausted, so without this
            the only way out is the back arrow, which discards the analysis. */}
        {onFinishEarly && uncapped && !showFeedback ? (
          <Pressable
            onPress={onFinishEarly}
            style={({ pressed }) => [styles.finishEarly, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.finishEarlyText}>Finish now and see my report</Text>
          </Pressable>
        ) : null}

        {showFeedback ? (
          <Text style={[styles.feedback, wasCorrect ? styles.feedbackOk : styles.feedbackNo]}>
            {wasCorrect ? 'Correct' : 'Not quite'}
          </Text>
        ) : null}
      </StudentCard>
    </>
  );
}

const useStyles = makeStyles((p) => ({
  loader: { marginVertical: SPACING.xl },
  error: { fontSize: TYPE.body, color: FEEDBACK.errorText, lineHeight: 19 },

  crumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: p.glass,
    borderWidth: 1,
    borderColor: p.glassBorder,
    marginBottom: SPACING.md,
  },
  crumbText: { flex: 1, fontSize: TYPE.label, fontWeight: '600', color: p.onDark },

  progressHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  progressText: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[600] },
  levelChip: {
    fontSize: TYPE.micro,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: p.deep,
    backgroundColor: p.tint,
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 999,
    overflow: 'hidden',
  },
  track: { height: 8, borderRadius: 4, backgroundColor: SLATE[200], overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: p.primaryDark },

  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    marginTop: 8,
    padding: 12,
    borderRadius: 11,
    backgroundColor: SLATE[100],
    borderWidth: 1,
    borderColor: SLATE[200],
  },
  optionPicked: { backgroundColor: p.tint, borderColor: p.primary },
  optionCorrect: { backgroundColor: QUIZ.correctBg, borderColor: QUIZ.correctBorder },
  optionWrong: { backgroundColor: QUIZ.wrongBg, borderColor: QUIZ.wrongBorder },
  optionKey: { fontSize: TYPE.label, fontWeight: '800', color: SLATE[500], width: 15 },
  optionBody: { flex: 1 },
  optionText: { fontSize: TYPE.body, color: SLATE[700], lineHeight: 19 },
  mark: { fontSize: TYPE.heading, fontWeight: '800', color: SLATE[700] },

  feedback: { fontSize: TYPE.body, fontWeight: '800', textAlign: 'center', marginTop: SPACING.sm },
  feedbackOk: { color: FEEDBACK.successText },
  feedbackNo: { color: FEEDBACK.errorText },

  statRow: { flexDirection: 'row', gap: SPACING.sm },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    backgroundColor: p.tint,
  },
  statValue: { fontSize: TYPE.headline, fontWeight: '800', color: p.primaryDark },
  statLabel: { fontSize: TYPE.micro, fontWeight: '600', color: SLATE[500], marginTop: 2 },
  level: { fontSize: TYPE.label, fontWeight: '700', color: p.deep, textAlign: 'center', marginTop: 10 },

  primary: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: p.primary,
    marginBottom: SPACING.lg,
  },
  primaryText: { fontSize: TYPE.heading, fontWeight: '700', color: p.onPrimary },
  secondary: {
    alignSelf: 'center',
    marginBottom: SPACING.lg,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: p.tint,
  },
  finishEarly: {
    alignSelf: 'center',
    marginTop: SPACING.md,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: p.tint,
  },
  finishEarlyText: { fontSize: TYPE.label, fontWeight: '700', color: p.deep },
  secondaryText: { fontSize: TYPE.label, fontWeight: '700', color: p.deep },

  pressed: { opacity: 0.78 },
}));
