import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, QUIZ, SLATE, SPACING, TOUCH, TYPE } from '../../../constants/theme';
import { makeStyles } from '../../../utils/makeStyles';
import RichText from '../../RichText';
import ShreyaSpeakButton from './ShreyaSpeakButton';
import { generateQuestions } from '../../../services/student/jyoraService';
import { buildQuestionReadAloudText } from '../../../utils/readAloudText';

/**
 * "✨ More like this" — ten AI-generated practice questions built from the one on screen.
 *
 * Port of `frontendmain/src/student/components/QuestionGenModal/` (button + modal + list).
 *
 * ── ONE SHOT PER QUESTION ────────────────────────────────────────────────────
 * The web locks an answer once given: every option becomes disabled and the card colours itself
 * correct/wrong. That is deliberate practice behaviour, not a limitation, so it is kept.
 *
 * `correctAnswer` is a **letter** here, in and out — unlike Practice Zone's own questions, which are
 * indexed. `services/student/jyoraService.js` carries the two converters so no screen has to know.
 */

const LETTERS = ['A', 'B', 'C', 'D'];
const PURPLE = { primary: '#7C3AED', deep: '#5B21B6', tint: '#faf5ff', border: '#ede9fe' };

function GeneratedQuestion({ q, index, answer, onAnswer }) {
  const styles = useStyles();
  const [showHint, setShowHint] = useState(false);

  const answered = !!answer;
  const correct = answered && answer === q.correctAnswer;

  const options = LETTERS.map((L) => [L, q[`option${L}`]]).filter(([, text]) => text);

  return (
    <View style={[styles.card, answered && (correct ? styles.cardRight : styles.cardWrong)]}>
      <View style={styles.cardHead}>
        <Text style={styles.qNum}>Q{index + 1}</Text>
        <ShreyaSpeakButton
          compact
          text={buildQuestionReadAloudText(q.questionText, [q.optionA, q.optionB, q.optionC, q.optionD])}
        />
      </View>

      <RichText html={q.questionText} />

      {options.map(([letter, text]) => {
        const picked = answer === letter;
        const isRight = answered && letter === q.correctAnswer;
        const isWrong = answered && picked && !correct;
        return (
          <Pressable
            key={letter}
            onPress={() => !answered && onAnswer(letter)}
            disabled={answered}
            style={({ pressed }) => [
              styles.opt,
              picked && styles.optPicked,
              isRight && styles.optRight,
              isWrong && styles.optWrong,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: picked, disabled: answered }}
          >
            <Text style={styles.optKey}>{letter}</Text>
            <View style={styles.optBody}>
              <RichText html={String(text)} textStyle={styles.optText} />
            </View>
            {isRight ? <Text style={styles.mark}>✓</Text> : null}
            {isWrong ? <Text style={styles.mark}>✗</Text> : null}
          </Pressable>
        );
      })}

      {q.hint ? (
        <Pressable
          onPress={() => setShowHint((v) => !v)}
          style={({ pressed }) => [styles.hintBtn, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.hintBtnText}>{showHint ? '💡 Hide hint' : '💡 Show hint'}</Text>
        </Pressable>
      ) : null}
      {showHint && q.hint ? <Text style={styles.hint}>{q.hint}</Text> : null}
    </View>
  );
}

export default function MoreLikeThisButton({ questionContext, topicName, subjectName, chapterName }) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const aliveRef = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await generateQuestions({
        ...questionContext,
        topicName: topicName || '',
        subjectName: subjectName || '',
        chapterName: chapterName || '',
      });
      if (!aliveRef.current) return;
      setQuestions(Array.isArray(res?.questions) ? res.questions : []);
    } catch (e) {
      if (aliveRef.current) setError(e?.message || 'Failed to generate questions. Please try again.');
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [questionContext, topicName, subjectName, chapterName]);

  useEffect(() => {
    aliveRef.current = true;
    if (open) {
      setQuestions([]);
      setAnswers({});
      load();
    }
    return () => {
      aliveRef.current = false;
    };
  }, [open, load]);

  // The web returns null when there is no question to build from.
  if (!questionContext?.questionText) return null;

  const answeredCount = Object.keys(answers).length;
  const correctCount = questions.filter((q, i) => answers[i] && answers[i] === q.correctAnswer).length;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Generate similar practice questions"
      >
        <Text style={styles.triggerText}>✨ More like this</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>✨ Practice Questions</Text>
              {topicName ? (
                <Text style={styles.headerTopic} numberOfLines={1}>
                  {topicName}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={() => setOpen(false)}
              hitSlop={10}
              style={({ pressed }) => [pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color="#ffffff" />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.centre}>
              <ActivityIndicator size="large" color={PURPLE.primary} />
              <Text style={styles.loadingText}>Generating 10 practice questions…</Text>
              <Text style={styles.loadingHint}>This can take up to a minute.</Text>
            </View>
          ) : error ? (
            <View style={styles.centre}>
              <Text style={styles.error}>{error}</Text>
              <Pressable
                onPress={load}
                style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : questions.length === 0 ? (
            <View style={styles.centre}>
              <Text style={styles.error}>Jyora did not return any questions this time.</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.body}>
              <Text style={styles.scoreBar}>
                {answeredCount} / {questions.length} answered · {correctCount} correct
              </Text>
              {questions.map((q, i) => (
                <GeneratedQuestion
                  // Generated questions have no ids; the index is their only stable identity.
                  key={i}
                  q={q}
                  index={i}
                  answer={answers[i]}
                  onAnswer={(letter) => setAnswers((prev) => ({ ...prev, [i]: letter }))}
                />
              ))}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}

const useStyles = makeStyles(() => ({
  trigger: {
    alignSelf: 'flex-start',
    paddingVertical: 7,
    minHeight: TOUCH.min,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: PURPLE.tint,
    borderWidth: 1,
    borderColor: PURPLE.primary,
  },
  triggerText: { fontSize: TYPE.label, fontWeight: '700', color: PURPLE.deep },

  safe: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    backgroundColor: PURPLE.primary,
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: TYPE.heading, fontWeight: '800', color: '#ffffff' },
  headerTopic: { fontSize: TYPE.caption, color: 'rgba(255,255,255,0.85)', marginTop: 1 },

  body: { padding: SPACING.md, paddingBottom: SPACING.xl },
  scoreBar: {
    fontSize: TYPE.label,
    fontWeight: '700',
    color: PURPLE.deep,
    backgroundColor: PURPLE.tint,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },

  card: {
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  cardRight: { borderColor: QUIZ.correctBorder, backgroundColor: FEEDBACK.successBg },
  cardWrong: { borderColor: QUIZ.wrongBorder, backgroundColor: FEEDBACK.errorBg },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  qNum: { fontSize: TYPE.caption, fontWeight: '800', color: PURPLE.deep },

  opt: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    marginTop: 8,
    padding: 11,
    borderRadius: 11,
    backgroundColor: SLATE[100],
    borderWidth: 1,
    borderColor: SLATE[200],
  },
  optPicked: { borderColor: PURPLE.primary },
  optRight: { backgroundColor: QUIZ.correctBg, borderColor: QUIZ.correctBorder },
  optWrong: { backgroundColor: QUIZ.wrongBg, borderColor: QUIZ.wrongBorder },
  optKey: { fontSize: TYPE.label, fontWeight: '800', color: SLATE[500], width: 15 },
  optBody: { flex: 1 },
  optText: { fontSize: TYPE.body, color: SLATE[700], lineHeight: 19 },
  mark: { fontSize: TYPE.heading, fontWeight: '800' },

  hintBtn: { alignSelf: 'flex-start', marginTop: SPACING.sm },
  hintBtnText: { fontSize: TYPE.label, fontWeight: '700', color: PURPLE.deep },
  hint: { fontSize: TYPE.label, color: SLATE[600], lineHeight: 19, marginTop: 5 },

  centre: { alignItems: 'center', paddingVertical: SPACING.xl, gap: 6, paddingHorizontal: SPACING.lg },
  loadingText: { fontSize: TYPE.body, fontWeight: '700', color: PURPLE.deep, marginTop: SPACING.sm },
  loadingHint: { fontSize: TYPE.caption, color: SLATE[500] },
  error: { fontSize: TYPE.body, color: FEEDBACK.errorText, textAlign: 'center', lineHeight: 19 },
  retry: {
    marginTop: SPACING.md,
    paddingVertical: 10,
    minHeight: TOUCH.min,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: PURPLE.tint,
    borderWidth: 1,
    borderColor: PURPLE.primary,
  },
  retryText: { fontSize: TYPE.label, fontWeight: '700', color: PURPLE.deep },

  pressed: { opacity: 0.8 },
}));
