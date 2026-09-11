import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { QUIZ, SLATE, SPACING, TYPE, leading } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import RichText from '../../RichText';
import { StudentCard, StudentCardTitle, StudentNote } from '../StudentCard';
import { codingBloomsRemark } from '../../../constants/codingProBlooms';
import {
  BLOOMS_LEVELS,
  masteryStatus,
  scoreUnderstanding,
} from '../../../services/student/understandingScoring';
import { fetchUnderstandingQuestions } from '../../../services/student/codingProService';

/**
 * Coding Pro → My Assessment, for one topic.
 *
 * SHARES THE SCORER, NOT THE PROSE. `scoreUnderstanding` is the same algorithm the Skills Edge and
 * Academic IQ tests use — verified identical against all four web copies. But Coding Pro's Bloom's
 * remark table is its **own**: 21 of its 24 strings match Skills Edge's and 3 do not, so it reads
 * from `constants/codingProBlooms.js` rather than the shared `bloomsRemark`.
 *
 * That is the difference between this component and `skillsedge/UnderstandingTest.js`, which is why
 * it is a separate component rather than another prop on that one — a "remarks" prop would make it
 * far too easy for a future caller to pass the wrong table and never notice.
 */

/** Options are four discrete HTML fields; `correctAnswer` is the LETTER. */
function optionsOf(q) {
  return [
    ['A', q.optionA],
    ['B', q.optionB],
    ['C', q.optionC],
    ['D', q.optionD],
  ].filter(([, text]) => text != null && String(text).trim() !== '');
}

export default function CodingAssessment({ topicId, topicName, showToast }) {
  const styles = useStyles();
  const palette = usePalette();

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setAnswers({});
    setResult(null);
    try {
      setQuestions(await fetchUnderstandingQuestions(topicId));
    } catch {
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [topicId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = () => {
    if (Object.keys(answers).length === 0) {
      showToast?.('Answer at least one question first.', 'error');
      return;
    }
    Alert.alert('Submit assessment?', 'You will see the answers and your Bloom’s breakdown.', [
      { text: 'Keep answering', style: 'cancel' },
      { text: 'Submit', onPress: () => setResult(scoreUnderstanding(questions, answers)) },
    ]);
  };

  if (loading) {
    return <ActivityIndicator size="large" color={palette.primary} style={styles.loader} />;
  }

  if (questions.length === 0) {
    return (
      <StudentCard>
        <StudentCardTitle>My Assessment</StudentCardTitle>
        <StudentNote>No questions have been added for this topic yet.</StudentNote>
      </StudentCard>
    );
  }

  const submitted = !!result;
  const usedLevels = submitted
    ? BLOOMS_LEVELS.filter((l) => result.blooms.levels[l].total > 0)
    : [];

  return (
    <>
      {submitted ? (
        <>
          <StudentCard>
            <StudentCardTitle>{topicName || 'Assessment'} — result</StudentCardTitle>
            <View style={styles.summary}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>
                  {result.score.correct}/{result.score.total}
                </Text>
                <Text style={styles.statLabel}>Correct</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>
                  {result.score.marks}/{result.score.maxMarks}
                </Text>
                <Text style={styles.statLabel}>Marks</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{result.score.percentage}%</Text>
                <Text style={styles.statLabel}>Score</Text>
              </View>
            </View>
          </StudentCard>

          <StudentCard>
            <StudentCardTitle>Bloom’s Breakdown</StudentCardTitle>
            {usedLevels.map((level) => {
              const pct = result.blooms.percentages[level];
              const cell = result.blooms.levels[level];
              return (
                <View key={level} style={styles.bloom}>
                  <View style={styles.bloomHead}>
                    <Text style={styles.bloomName}>{level}</Text>
                    <Text style={styles.bloomPct}>
                      {cell.correct}/{cell.total} · {pct}%
                    </Text>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={styles.bloomStatus}>{masteryStatus(pct)}</Text>
                  {/* Coding Pro's own remarks — not the shared `bloomsRemark`. */}
                  <Text style={styles.bloomRemark}>{codingBloomsRemark(level, pct)}</Text>
                </View>
              );
            })}
          </StudentCard>
        </>
      ) : null}

      {questions.map((q, index) => {
        const chosen = answers[q.id];
        return (
          <StudentCard key={q.id}>
            <View style={styles.qHead}>
              <Text style={styles.qNum}>Question {index + 1}</Text>
              {q.bloomsLevel ? <Text style={styles.qLevel}>{q.bloomsLevel}</Text> : null}
            </View>
            <RichText html={q.questionText} />

            {optionsOf(q).map(([key, text]) => {
              const picked = chosen === key;
              const correct = submitted && key === q.correctAnswer;
              const wrong = submitted && picked && key !== q.correctAnswer;
              return (
                <Pressable
                  key={key}
                  onPress={() => !submitted && setAnswers((prev) => ({ ...prev, [q.id]: key }))}
                  disabled={submitted}
                  style={({ pressed }) => [
                    styles.option,
                    picked && styles.optionPicked,
                    correct && styles.optionCorrect,
                    wrong && styles.optionWrong,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: picked, disabled: submitted }}
                >
                  <Text style={styles.optionKey}>{key}</Text>
                  <View style={styles.optionBody}>
                    <RichText html={String(text)} textStyle={styles.optionText} />
                  </View>
                  {correct ? <Text style={styles.mark}>✓</Text> : null}
                  {wrong ? <Text style={styles.mark}>✗</Text> : null}
                </Pressable>
              );
            })}

            {q.hint ? (
              <View style={styles.hint}>
                <Text style={styles.hintLabel}>Hint</Text>
                <RichText html={q.hint} />
              </View>
            ) : null}
          </StudentCard>
        );
      })}

      <Pressable
        onPress={submitted ? load : submit}
        style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Text style={styles.primaryText}>{submitted ? 'Try Again' : 'Submit'}</Text>
      </Pressable>
    </>
  );
}

const useStyles = makeStyles((p) => ({
  loader: { marginVertical: SPACING.xl },

  summary: { flexDirection: 'row', gap: SPACING.sm },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    backgroundColor: p.tint,
  },
  statValue: { fontSize: TYPE.title, fontWeight: '800', color: p.primaryDark },
  statLabel: { fontSize: TYPE.micro, fontWeight: '600', color: SLATE[500], marginTop: 2 },

  bloom: { marginBottom: SPACING.md },
  bloomHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bloomName: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },
  bloomPct: { fontSize: TYPE.caption, fontWeight: '600', color: SLATE[500] },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: SLATE[200],
    overflow: 'hidden',
    marginTop: 5,
  },
  fill: { height: '100%', borderRadius: 4, backgroundColor: p.primaryDark },
  bloomStatus: { fontSize: TYPE.caption, fontWeight: '700', color: p.deep, marginTop: 5 },
  bloomRemark: { fontSize: TYPE.label, color: SLATE[600], lineHeight: leading(TYPE.label), marginTop: 2 },

  qHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qNum: { fontSize: TYPE.caption, fontWeight: '800', color: p.deep },
  qLevel: {
    fontSize: TYPE.micro,
    fontWeight: '700',
    color: SLATE[500],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    marginTop: 7,
    padding: 11,
    borderRadius: 11,
    backgroundColor: SLATE[100],
    borderWidth: 1,
    borderColor: SLATE[200],
  },
  optionPicked: { backgroundColor: p.tint, borderColor: p.primary },
  optionCorrect: { backgroundColor: QUIZ.correctBg, borderColor: QUIZ.correctBorder },
  optionWrong: { backgroundColor: QUIZ.wrongBg, borderColor: QUIZ.wrongBorder },
  optionKey: { fontSize: TYPE.label, fontWeight: '800', color: SLATE[500], minWidth: 15 },
  optionBody: { flex: 1 },
  optionText: { fontSize: TYPE.body, color: SLATE[700], lineHeight: leading(TYPE.body) },
  mark: { fontSize: TYPE.heading, fontWeight: '800', color: SLATE[700] },

  hint: { marginTop: SPACING.sm, padding: SPACING.sm, borderRadius: 10, backgroundColor: SLATE[100] },
  hintLabel: {
    fontSize: TYPE.micro,
    fontWeight: '800',
    color: SLATE[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },

  primary: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: p.primary,
    marginBottom: SPACING.lg,
  },
  primaryText: { fontSize: TYPE.heading, fontWeight: '700', color: p.onPrimary },
  pressed: { opacity: 0.78 },
}));
