import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { QUIZ, SLATE, SPACING, TYPE } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import ShreyaSpeakButton from '../ai/ShreyaSpeakButton';
import MoreLikeThisButton from '../ai/MoreLikeThisButton';
import { buildQuestionReadAloudText } from '../../../utils/readAloudText';
import { questionContextFromLettered } from '../../../services/student/jyoraService';
import RichText from '../../RichText';
import { StudentCard, StudentCardTitle, StudentNote } from '../StudentCard';
import {
  BLOOMS_LEVELS,
  bloomsRemark,
  masteryStatus,
  scoreUnderstanding,
} from '../../../services/student/understandingScoring';
import { fetchUnderstandingQuestions } from '../../../services/student/skillsEdgeService';

/**
 * Test Your Understanding, for one Skills Edge module.
 *
 * Ported from the **inline** `activeContentTab === "understanding"` branch of the web's
 * SkillsEdge.js — not from `SkillsEdgeTestYourUnderstanding.js`, which sits in the same folder,
 * has no importers, and scores differently.
 *
 * ENTIRELY CLIENT-SCORED. There is no submit endpoint: the questions come down with their
 * `correctAnswer`, and nothing is persisted. Leaving the module loses the attempt, exactly as on
 * the web — do not add storage that the website would not show.
 *
 * SHARED BY FOUR SURFACES. Skills Edge and Academic IQ's School Resources, Personalized Resources
 * and Competitive Exam all run the identical scorer (verified against the web source), so the only
 * thing that varies is where the questions come from — hence `loadQuestions`, which defaults to
 * Skills Edge's endpoint so its existing caller is unchanged.
 */

/**
 * Options arrive as four discrete fields (`optionA`…`optionD`), not an array, and each is **HTML**
 * — the web renders them through RichTextViewer, so a question with a formula or a list would come
 * out as raw tags in a plain <Text>. Empty ones are omitted, so a two-option question shows two.
 *
 * `correctAnswer` is the LETTER ("A"), not the option text.
 */
function optionsOf(q) {
  return [
    ['A', q.optionA],
    ['B', q.optionB],
    ['C', q.optionC],
    ['D', q.optionD],
  ].filter(([, text]) => text != null && String(text).trim() !== '');
}

/**
 * `topicName` / `subjectName` / `chapterName` are for "✨ More like this" only — the generator sends
 * them to Jyora as context. They are optional and default to empty because all four call sites use
 * a different vocabulary for the same levels (a Skills Edge "skill" is Academic IQ's "subject"), and
 * an absent name is a weaker prompt, not a broken one. Shreya Speak needs none of them.
 */
export default function UnderstandingTest({
  moduleId,
  loadQuestions,
  showToast,
  topicName = '',
  subjectName = '',
  chapterName = '',
}) {
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
      const loader = loadQuestions || fetchUnderstandingQuestions;
      setQuestions(await loader(moduleId));
    } catch {
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [moduleId, loadQuestions]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = () => {
    if (Object.keys(answers).length === 0) {
      showToast?.('Answer at least one question first.', 'error');
      return;
    }
    // The web gates this behind window.confirm — the same pause, natively.
    Alert.alert('Submit test?', 'You will see the answers and your Bloom’s breakdown.', [
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
        <StudentCardTitle>Test Your Understanding</StudentCardTitle>
        <StudentNote>No questions have been added for this module yet.</StudentNote>
      </StudentCard>
    );
  }

  const submitted = !!result;
  // Only levels that actually carry questions — showing six bars when the module tests two would
  // read as four zero scores rather than four absences.
  const usedLevels = submitted
    ? BLOOMS_LEVELS.filter((l) => result.blooms.levels[l].total > 0)
    : [];

  return (
    <>
      {submitted ? (
        <>
          <StudentCard>
            <StudentCardTitle>Performance Summary</StudentCardTitle>
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
                  <Text style={styles.bloomRemark}>{bloomsRemark(level, pct)}</Text>
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
              <ShreyaSpeakButton
                compact
                // The RAW four-element array, NOT optionsOf(q). The web passes
                // [optionA, optionB, optionC, optionD] so a blank option still consumes its letter
                // — matching the on-screen lettering. optionsOf pre-filters and would re-letter.
                text={buildQuestionReadAloudText(q.questionText, [
                  q.optionA,
                  q.optionB,
                  q.optionC,
                  q.optionD,
                ])}
              />
            </View>

            <MoreLikeThisButton
              questionContext={questionContextFromLettered(q)}
              topicName={topicName}
              subjectName={subjectName}
              chapterName={chapterName}
            />

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
                  <Text style={[styles.optionKey, (correct || wrong) && styles.optionKeyOn]}>
                    {key}
                  </Text>
                  <View style={styles.optionBody}>
                    <RichText html={String(text)} textStyle={styles.optionText} />
                  </View>
                  {correct ? <Text style={styles.mark}>✓</Text> : null}
                  {wrong ? <Text style={styles.mark}>✗</Text> : null}
                </Pressable>
              );
            })}

            {/* The hint is NOT gated on submission — the web shows it while answering. */}
            {q.hint ? (
              <View style={styles.explain}>
                <Text style={styles.explainLabel}>Hint</Text>
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
        <Text style={styles.primaryText}>{submitted ? 'Try Again' : 'Submit Test'}</Text>
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
  bloomRemark: { fontSize: TYPE.label, color: SLATE[600], lineHeight: 18, marginTop: 2 },

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
  optionKey: { fontSize: TYPE.label, fontWeight: '800', color: SLATE[500], width: 15 },
  optionKeyOn: { color: SLATE[800] },
  optionBody: { flex: 1 },
  optionText: { fontSize: TYPE.body, color: SLATE[700], lineHeight: 19 },
  mark: { fontSize: TYPE.heading, fontWeight: '800', color: SLATE[700] },

  explain: {
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: 10,
    backgroundColor: SLATE[100],
  },
  explainLabel: {
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
