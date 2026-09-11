import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FEEDBACK, PORTALS, SLATE, SPACING, TYPE, leading } from '../../../constants/theme';

/**
 * Live in-class quiz — logic ported verbatim from TeachAiPanel's ClassQuiz.
 *
 * The teacher reads a question aloud, a student answers, and the teacher taps the option the
 * student chose:
 *   • correct → the option turns green and "Next Question" appears
 *   • wrong   → that option is marked and disabled, the hint appears, and the class tries the
 *               SAME question again — it only advances on a correct answer
 *
 * Correct answers are never shown up front; the students do the answering. Do not "helpfully"
 * reveal the answer on a wrong pick — that removes the point of the exercise.
 */

const PALETTE = PORTALS.school;
const QUIZ_LETTERS = ['A', 'B', 'C', 'D'];

export default function ClassQuiz({ questions = [] }) {
  const [index, setIndex] = useState(0);
  const [wrong, setWrong] = useState({}); // { [qIndex]: ['C', …] }
  const [solved, setSolved] = useState({}); // { [qIndex]: true }

  const total = questions.length;
  if (total === 0) return null;

  const q = questions[index];
  const correct = String(q?.correctAnswer || '').toUpperCase();
  const wrongPicks = wrong[index] || [];
  const isSolved = !!solved[index];
  const solvedCount = Object.keys(solved).length;
  const isLast = index === total - 1;

  const pick = (letter) => {
    if (isSolved || wrongPicks.includes(letter)) return;
    if (letter === correct) setSolved((s) => ({ ...s, [index]: true }));
    else setWrong((w) => ({ ...w, [index]: [...(w[index] || []), letter] }));
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>📝 Class Understanding Quiz</Text>

      <View style={styles.progress}>
        <Text style={styles.progressText}>
          Question {index + 1} of {total}
        </Text>
        <Text style={styles.progressSolved}>
          {solvedCount}/{total} answered
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.question}>
          {index + 1}. {q.questionText}
        </Text>

        {QUIZ_LETTERS.map((letter) => {
          const isWrong = wrongPicks.includes(letter);
          const isRight = isSolved && letter === correct;
          const text = q[`option${letter}`];
          if (text == null || text === '') return null;
          return (
            <Pressable
              key={letter}
              onPress={() => pick(letter)}
              disabled={isSolved || isWrong}
              style={({ pressed }) => [
                styles.option,
                isRight && styles.optionCorrect,
                isWrong && styles.optionWrong,
                pressed && !isSolved && !isWrong && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.optionText,
                  isRight && styles.optionTextCorrect,
                  isWrong && styles.optionTextWrong,
                ]}
              >
                {letter}. {text}
              </Text>
              {isRight ? <Text style={styles.mark}>✓</Text> : null}
              {isWrong ? <Text style={styles.markWrong}>✗</Text> : null}
            </Pressable>
          );
        })}

        {/* The hint only appears once the class has missed it — it exists to help the retry. */}
        {wrongPicks.length > 0 && !isSolved && q.hint ? (
          <Text style={styles.hint}>💡 {q.hint}</Text>
        ) : null}
        {isSolved ? <Text style={styles.correctNote}>✓ Correct!</Text> : null}
      </View>

      {isSolved && !isLast ? (
        <Pressable
          onPress={() => setIndex(index + 1)}
          style={({ pressed }) => [styles.nextBtn, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.nextText}>Next Question →</Text>
        </Pressable>
      ) : null}
      {isSolved && isLast ? (
        <Text style={styles.done}>🎉 All questions answered — great work, class!</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: SPACING.md },
  sectionTitle: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800], marginBottom: SPACING.sm },
  progress: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressText: { fontSize: TYPE.label, fontWeight: '600', color: SLATE[500] },
  progressSolved: { fontSize: TYPE.label, fontWeight: '700', color: PALETTE.primaryDark },

  card: {
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 12,
    padding: SPACING.sm,
    backgroundColor: '#ffffff',
  },
  question: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800], marginBottom: SPACING.sm },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginBottom: 7,
    backgroundColor: '#ffffff',
  },
  optionCorrect: { borderColor: FEEDBACK.successOnBg, backgroundColor: FEEDBACK.successBg },
  optionWrong: { borderColor: FEEDBACK.errorBorder, backgroundColor: FEEDBACK.errorBg },
  optionText: { flex: 1, fontSize: TYPE.body, color: SLATE[700] },
  optionTextCorrect: { color: FEEDBACK.successText, fontWeight: '700' },
  optionTextWrong: { color: FEEDBACK.errorText },
  mark: { fontSize: TYPE.heading, fontWeight: '700', color: FEEDBACK.successText },
  markWrong: { fontSize: TYPE.heading, fontWeight: '700', color: FEEDBACK.errorText },

  hint: {
    fontSize: TYPE.label,
    lineHeight: leading(TYPE.label),
    color: '#b45309',
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    padding: SPACING.sm,
    marginTop: 4,
  },
  correctNote: { fontSize: TYPE.body, fontWeight: '700', color: FEEDBACK.successText, marginTop: 4 },

  nextBtn: {
    alignSelf: 'flex-start',
    marginTop: SPACING.sm,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: PALETTE.primaryDark,
  },
  nextText: { fontSize: TYPE.body, fontWeight: '700', color: '#ffffff' },
  done: { fontSize: TYPE.heading, fontWeight: '700', color: FEEDBACK.successText, marginTop: SPACING.sm },
  pressed: { opacity: 0.75 },
});
