import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { QUIZ, SLATE, SPACING, TYPE, leading } from '../../../constants/theme';
import { makeStyles } from '../../../utils/makeStyles';
import { isAnswered } from '../../../utils/questionModel';
import RichText from '../../RichText';
import { StudentCard } from '../StudentCard';

/**
 * The exam-hall runner every test screen uses — the app half of
 * `frontendmain/src/student/components/ExamRunner/ExamRunner.js`.
 *
 * ── WHAT CHANGED ────────────────────────────────────────────────────────────
 * Tests used to be one long scroll with a Submit at the bottom. On a phone that is worse than on a
 * desktop: a 30-question paper is a very long thumb journey, with no way to see what you skipped or
 * to flag something to come back to. This shows one question at a time under a palette where every
 * question is one tap away and colour-and-shape coded: answered, not answered, flagged to retry.
 *
 * ── IT NEVER SEES A RAW QUESTION ────────────────────────────────────────────
 * Questions are normalized by `utils/questionModel.js`. Four lettered columns graded by letter, and
 * an options array graded by index, are both in use in this app, and reading one as the other
 * renders a question with no answers — see `academiciq/AdaptiveRunner.js`.
 *
 * ── THE ADAPTIVE ENGINES DO NOT USE THIS ────────────────────────────────────
 * Their next question depends on the last answer, so a palette that jumps around would contradict
 * the ladder. They keep their own runner.
 */
export default function ExamRunner({
  questions = [],
  answers = {},
  onAnswer,
  marked,
  onToggleMark,
  submitted = false,
  graded = true,
  requireAll = false,
  onSubmit,
  submitLabel = 'Submit Test',
  renderQuestionSlot,
  footer = null,
}) {
  const styles = useStyles();
  const [current, setCurrent] = useState(0);
  const markedSet = marked instanceof Set ? marked : new Set();

  const total = questions.length;
  if (!total) return null;

  // Clamped rather than trusted: a reset or a topic change can shorten the list under us.
  const index = Math.min(current, total - 1);
  const question = questions[index];
  const chosen = answers[question.id];
  const answeredCount = questions.filter((q) => isAnswered(answers, q)).length;
  const canSubmit = requireAll ? answeredCount === total : answeredCount > 0;
  const flagged = markedSet.has(question.id);

  const stateOf = (q, i) => {
    if (i === index) return 'current';
    if (markedSet.has(q.id)) return 'marked';
    return isAnswered(answers, q) ? 'answered' : 'unanswered';
  };

  return (
    <>
      <StudentCard>
        <Text style={styles.progress}>
          <Text style={styles.progressStrong}>
            {answeredCount} of {total}
          </Text>
          {' answered'}
          {markedSet.size > 0 ? ` · ${markedSet.size} to retry` : ''}
        </Text>

        {/* Horizontal so a 40-question paper does not push the question off the screen. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.palette}
        >
          {questions.map((q, i) => {
            const state = stateOf(q, i);
            return (
              <Pressable
                key={q.id}
                onPress={() => setCurrent(i)}
                style={({ pressed }) => [
                  styles.dot,
                  styles[`dot_${state}`],
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Question ${i + 1}, ${state}`}
              >
                <Text style={[styles.dotText, styles[`dotText_${state}`]]}>{i + 1}</Text>
                {/* A SHAPE as well as a colour — the palette has to read without colour vision. */}
                {markedSet.has(q.id) ? <Text style={styles.dotFlag}>⚑</Text> : null}
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.swatch, styles.dot_answered]} />
            <Text style={styles.legendText}>Answered</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.swatch, styles.dot_unanswered]} />
            <Text style={styles.legendText}>Not answered</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.swatch, styles.dot_marked]} />
            <Text style={styles.legendText}>⚑ To retry</Text>
          </View>
        </View>
      </StudentCard>

      <StudentCard>
        <View style={styles.qHead}>
          <Text style={styles.qNum}>
            Question {index + 1}
            <Text style={styles.qOf}> / {total}</Text>
          </Text>
          {question.bloomsLevel ? <Text style={styles.qLevel}>{question.bloomsLevel}</Text> : null}
          {renderQuestionSlot ? renderQuestionSlot(question, index) : null}
        </View>

        {submitted && graded && chosen ? (
          <Text style={chosen === question.correctKey ? styles.verdictRight : styles.verdictWrong}>
            {chosen === question.correctKey ? '✓ Correct' : '✗ Incorrect'}
          </Text>
        ) : null}

        <RichText html={question.html} />

        {question.options.map((option) => {
          const picked = chosen === option.key;
          const correct = submitted && graded && option.key === question.correctKey;
          const wrong = submitted && graded && picked && option.key !== question.correctKey;
          return (
            <Pressable
              key={option.key}
              onPress={() => !submitted && onAnswer?.(question.id, option.key)}
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
                {option.label}
              </Text>
              <View style={styles.optionBody}>
                <RichText html={String(option.html)} textStyle={styles.optionText} />
              </View>
              {correct ? <Text style={styles.mark}>✓</Text> : null}
              {wrong ? <Text style={styles.mark}>✗</Text> : null}
            </Pressable>
          );
        })}

        {/* The hint is NOT gated on submission — the web shows it while answering. */}
        {question.hint ? (
          <View style={styles.explain}>
            <Text style={styles.explainLabel}>Hint</Text>
            <RichText html={question.hint} />
          </View>
        ) : null}

        {submitted && question.solution ? (
          <View style={styles.explain}>
            <Text style={styles.explainLabel}>Solution</Text>
            <RichText html={question.solution} />
          </View>
        ) : null}
      </StudentCard>

      <View style={styles.nav}>
        <Pressable
          onPress={() => setCurrent(Math.max(0, index - 1))}
          disabled={index === 0}
          style={({ pressed }) => [
            styles.navBtn,
            index === 0 && styles.navBtnDisabled,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
        >
          <Text style={styles.navText}>← Prev</Text>
        </Pressable>

        {!submitted && onToggleMark ? (
          <Pressable
            onPress={() => onToggleMark(question.id)}
            style={({ pressed }) => [
              styles.markBtn,
              flagged && styles.markBtnOn,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: flagged }}
          >
            <Text style={[styles.markText, flagged && styles.markTextOn]}>
              ⚑ {flagged ? 'Marked' : 'Mark to retry'}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => setCurrent(Math.min(total - 1, index + 1))}
          disabled={index === total - 1}
          style={({ pressed }) => [
            styles.navBtn,
            index === total - 1 && styles.navBtnDisabled,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
        >
          <Text style={styles.navText}>Next →</Text>
        </Pressable>
      </View>

      {!submitted ? (
        <>
          <Pressable
            onPress={canSubmit ? onSubmit : undefined}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.primary,
              !canSubmit && styles.primaryDisabled,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit }}
          >
            <Text style={styles.primaryText}>{submitLabel}</Text>
          </Pressable>
          {requireAll && answeredCount < total ? (
            <Text style={styles.submitNote}>Answer all {total} questions to submit.</Text>
          ) : null}
        </>
      ) : null}

      {footer}
    </>
  );
}

const useStyles = makeStyles((p) => ({
  progress: { fontSize: TYPE.label, color: SLATE[600], marginBottom: SPACING.sm },
  progressStrong: { fontWeight: '800', color: SLATE[800] },

  palette: { gap: SPACING.xs, paddingVertical: 2 },
  dot: {
    minWidth: 38,
    height: 38,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Four states, each differing in fill, border and — when flagged — a glyph.
  dot_unanswered: { backgroundColor: '#ffffff', borderColor: SLATE[300] },
  dot_answered: { backgroundColor: p.primary, borderColor: p.primary },
  dot_marked: { backgroundColor: p.deep, borderColor: p.deep },
  dot_current: { backgroundColor: SLATE[200], borderColor: SLATE[800], borderWidth: 3 },
  dotText: { fontSize: TYPE.label, fontWeight: '800', color: SLATE[700] },
  dotText_answered: { color: p.onPrimary },
  dotText_marked: { color: '#ffffff' },
  dotText_current: { color: SLATE[900] },
  dotText_unanswered: { color: SLATE[700] },
  dotFlag: { position: 'absolute', top: -2, right: 2, fontSize: TYPE.micro, color: '#ffffff' },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 14, height: 14, borderRadius: 4, borderWidth: 2 },
  legendText: { fontSize: TYPE.micro, color: SLATE[500] },

  qHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.xs },
  qNum: { fontSize: TYPE.caption, fontWeight: '800', color: p.deep },
  qOf: { fontWeight: '600', color: SLATE[400] },
  qLevel: {
    fontSize: TYPE.micro,
    fontWeight: '700',
    color: SLATE[500],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  verdictRight: { fontSize: TYPE.label, fontWeight: '800', color: QUIZ.correctBorder, marginTop: 4 },
  verdictWrong: { fontSize: TYPE.label, fontWeight: '800', color: QUIZ.wrongBorder, marginTop: 4 },

  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    borderWidth: 1.5,
    borderColor: SLATE[200],
    borderRadius: 12,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
    backgroundColor: '#ffffff',
  },
  optionPicked: { backgroundColor: p.tint, borderColor: p.primary },
  optionCorrect: { backgroundColor: QUIZ.correctBg, borderColor: QUIZ.correctBorder },
  optionWrong: { backgroundColor: QUIZ.wrongBg, borderColor: QUIZ.wrongBorder },
  optionKey: { fontSize: TYPE.label, fontWeight: '800', color: SLATE[500], minWidth: 15 },
  optionKeyOn: { color: SLATE[800] },
  optionBody: { flex: 1 },
  optionText: { fontSize: TYPE.body, color: SLATE[700], lineHeight: leading(TYPE.body) },
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
    letterSpacing: 0.4,
    marginBottom: 2,
  },

  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.xs },
  navBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: SLATE[200],
  },
  navBtnDisabled: { opacity: 0.45 },
  navText: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[800] },
  markBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: p.deep,
  },
  markBtnOn: { backgroundColor: p.deep },
  markText: { fontSize: TYPE.label, fontWeight: '700', color: p.deep },
  markTextOn: { color: '#ffffff' },

  primary: {
    marginTop: SPACING.md,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: p.primary,
  },
  primaryDisabled: { opacity: 0.5 },
  primaryText: { fontSize: TYPE.heading, fontWeight: '700', color: p.onPrimary },
  submitNote: { fontSize: TYPE.caption, color: SLATE[500], textAlign: 'center', marginTop: 6 },
  pressed: { opacity: 0.78 },
}));
