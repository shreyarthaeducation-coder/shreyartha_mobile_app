import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BAND, DONE, FEEDBACK, SLATE, SPACING, TYPE, leading } from '../../../constants/theme';
import { makeStyles } from '../../../utils/makeStyles';
import { StudentCard, StudentCardTitle } from '../StudentCard';
import { parseWordScores, scoreColor } from '../phonetics/wordScores';
import { shreyaEnglish } from '../../../services/student/languageProService';

/**
 * Chapter results: performance against the 80% target, per-question feedback, and the weakest
 * sounds to work on.
 *
 * The web draws the five metrics as a Chart.js bar chart with a dashed target line. Five labelled
 * bars with a target marker say the same thing on a phone without a chart library — and the marker
 * is the part that matters, since 80% in **every** metric is what unlocks the next level.
 */

const TARGET = 80;

/**
 * The five metrics the server's level-up gate actually checks.
 * The phoneme-level "Phonetics" score is shown separately below — it is NOT part of the gate.
 */
const METRICS = [
  ['accuracy', 'Accuracy'],
  ['fluency', 'Fluency'],
  ['completeness', 'Completeness'],
  ['prosody', 'Prosody'],
  ['grammar', 'Grammar'],
];

export default function ChapterSummary({ chapterId, result, onRetry, onExit, onResultUpdate }) {
  const styles = useStyles();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState('');

  const metrics = result?.metrics || {};
  const values = METRICS.map(([key]) =>
    typeof metrics[key] === 'number' ? Math.round(metrics[key]) : null,
  );
  const allPass = values.every((v) => typeof v === 'number' && v >= TARGET);

  /** Grammar comes from an async answer check that can lag behind the attempt. */
  const retryEvaluation = useCallback(async () => {
    setRetrying(true);
    setRetryError('');
    try {
      const updated = await shreyaEnglish.retryEvaluation(chapterId);
      onResultUpdate?.(updated);
    } catch (e) {
      setRetryError(e?.message || 'Could not check your answers. Please try again.');
    } finally {
      setRetrying(false);
    }
  }, [chapterId, onResultUpdate]);

  const words = parseWordScores(result?.words);
  // The sounds worth practising: lowest-scoring words first, worst few only.
  const weakest = [...words]
    .filter((w) => typeof w.score === 'number' && w.score < TARGET)
    .sort((a, b) => a.score - b.score)
    .slice(0, 6);

  return (
    <>
      <StudentCard>
        <StudentCardTitle>How you did</StudentCardTitle>
        {METRICS.map(([key, label], i) => {
          const v = values[i];
          const pass = typeof v === 'number' && v >= TARGET;
          return (
            <View key={key} style={styles.metric}>
              <View style={styles.metricHead}>
                <Text style={styles.metricLabel}>{label}</Text>
                <Text style={[styles.metricValue, pass && styles.metricPass]}>
                  {v == null ? '—' : `${v}%`}
                </Text>
              </View>
              <View style={styles.track}>
                <View
                  style={[styles.fill, pass && styles.fillPass, { width: `${v ?? 0}%` }]}
                />
                {/* The 80% gate, drawn where the web's dashed target line goes. */}
                <View style={[styles.target, { left: `${TARGET}%` }]} />
              </View>
            </View>
          );
        })}
        <Text style={styles.targetNote}>
          The dashed mark is {TARGET}% — you need it in every metric to level up.
        </Text>
        {typeof metrics.phonetics === 'number' ? (
          <Text style={styles.phonetics}>
            Phonetics: {Math.round(metrics.phonetics)}% (not part of the level-up gate)
          </Text>
        ) : null}
      </StudentCard>

      {weakest.length > 0 ? (
        <StudentCard>
          <StudentCardTitle>Sounds to work on</StudentCardTitle>
          <View style={styles.wordWrap}>
            {weakest.map((w, i) => (
              <View key={`${w.word}-${i}`} style={styles.wordChip}>
                <Text style={[styles.word, { color: scoreColor(w.score) }]}>{w.word}</Text>
                <Text style={styles.wordScore}>{Math.round(w.score)}</Text>
              </View>
            ))}
          </View>
        </StudentCard>
      ) : null}

      {!result?.evaluated ? (
        <StudentCard>
          <Text style={styles.warn}>
            Your grammar score is still pending — the answer check didn&apos;t finish.
          </Text>
          <Pressable
            onPress={retryEvaluation}
            disabled={retrying}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryText}>{retrying ? 'Checking…' : '🔁 Retry evaluation'}</Text>
          </Pressable>
          {retryError ? <Text style={styles.error}>{retryError}</Text> : null}
        </StudentCard>
      ) : null}

      {(result?.answers || []).length > 0 ? (
        <StudentCard>
          <StudentCardTitle>Your answers</StudentCardTitle>
          {result.answers.map((a, i) => (
            <View key={i} style={styles.answer}>
              <Text style={styles.answerQ}>
                {typeof a.correct === 'boolean' ? (a.correct ? '✅' : '❌') : '⏳'} {a.questionText}
              </Text>
              <Text style={styles.answerSaid}>You said: “{a.transcript || '—'}”</Text>
              {a.feedback ? <Text style={styles.answerNote}>💡 {a.feedback}</Text> : null}
            </View>
          ))}
        </StudentCard>
      ) : null}

      {result?.levelUpEligible ? (
        <StudentCard>
          <Text style={styles.nudge}>
            🚀 You&apos;ve hit 80%+ across your whole level — go to the level map to Level Up!
          </Text>
        </StudentCard>
      ) : null}

      <View style={styles.footRow}>
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>🔁 Try again</Text>
        </Pressable>
        <Pressable
          onPress={onExit}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>← Back to chapters</Text>
        </Pressable>
      </View>
      {allPass ? <Text style={styles.allPass}>Every metric is at or above {TARGET}%.</Text> : null}
    </>
  );
}

const useStyles = makeStyles((p) => ({
  metric: { marginBottom: 10 },
  metricHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metricLabel: { fontSize: TYPE.label, fontWeight: '600', color: SLATE[600] },
  metricValue: { fontSize: TYPE.body, fontWeight: '800', color: SLATE[500] },
  metricPass: { color: FEEDBACK.successText },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: SLATE[200],
    overflow: 'hidden',
    marginTop: 4,
    position: 'relative',
  },
  fill: { height: '100%', borderRadius: 4, backgroundColor: p.primaryDark },
  fillPass: { backgroundColor: DONE },
  target: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: BAND.fair },
  targetNote: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 4 },
  phonetics: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 6 },

  wordWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  wordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: SLATE[100],
  },
  word: { fontSize: TYPE.body, fontWeight: '700' },
  wordScore: { fontSize: TYPE.caption, color: SLATE[500] },

  warn: { fontSize: TYPE.label, color: FEEDBACK.warningOnBg, lineHeight: leading(TYPE.label) },
  error: { fontSize: TYPE.label, color: FEEDBACK.errorText, marginTop: SPACING.sm },

  answer: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: SLATE[200] },
  answerQ: { fontSize: TYPE.body, fontWeight: '600', color: SLATE[800], lineHeight: leading(TYPE.body) },
  answerSaid: { fontSize: TYPE.label, color: SLATE[600], marginTop: 3 },
  answerNote: { fontSize: TYPE.label, color: p.deep, marginTop: 3, lineHeight: leading(TYPE.label) },

  nudge: { fontSize: TYPE.body, fontWeight: '700', color: FEEDBACK.successOnBg, lineHeight: leading(TYPE.body) },
  allPass: {
    fontSize: TYPE.caption,
    color: FEEDBACK.successText,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },

  footRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  primary: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: p.primary,
  },
  primaryText: { fontSize: TYPE.body, fontWeight: '700', color: p.onPrimary },
  secondary: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: p.tint,
  },
  secondaryText: { fontSize: TYPE.body, fontWeight: '700', color: p.deep },

  pressed: { opacity: 0.78 },
}));
