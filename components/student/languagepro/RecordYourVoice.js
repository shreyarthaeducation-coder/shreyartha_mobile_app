import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, RECORDING, SLATE, SPACING, TYPE } from '../../../constants/theme';
import { makeStyles } from '../../../utils/makeStyles';
import { StudentCard, StudentCardTitle } from '../StudentCard';
import useVoiceRecorder from '../../../hooks/useVoiceRecorder';
import { assessPronunciation, saveVoiceAttempt } from '../../../services/student/speechService';
import { parseWordScores, scoreColor } from '../phonetics/wordScores';

/**
 * Record Your Voice — read a line aloud, get it scored.
 *
 * **The one behavioural difference from the website.** There, the browser Speech SDK streams
 * partial results and words colour in *as the student speaks*. Here the recording is scored in one
 * go when they stop, because React Native has no build of that SDK (see
 * services/student/speechService.js). Everything else — the five metrics, the colour bands, the
 * saved attempt — is identical.
 */

/**
 * The metrics, in the web's order.
 *
 * The web shows FIVE and this shows four: its "Phonetics" row is derived from the browser SDK's
 * phoneme-level stream, which the REST response does not break out separately — phoneme accuracy is
 * already folded into Accuracy. Showing an always-empty row would read as a broken metric.
 */
const METRICS = [
  { key: 'accuracyScore', label: 'Accuracy' },
  { key: 'fluencyScore', label: 'Fluency' },
  { key: 'completenessScore', label: 'Completeness' },
  { key: 'prosodyScore', label: 'Prosody' },
];

export default function RecordYourVoice({ topicId, referenceText, onSaved, showToast }) {
  const styles = useStyles();
  const recorder = useVoiceRecorder();

  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState(null);

  const finish = useCallback(
    async (take) => {
      if (!take) return;
      setScoring(true);
      try {
        const scores = await assessPronunciation(take, referenceText);
        setResult(scores);

        // Saving is secondary — the student sees their score whether or not it persists.
        try {
          await saveVoiceAttempt({
            topicId,
            referenceText,
            recognizedText: scores.recognizedText,
            overallScore: scores.overallScore,
            accuracyScore: scores.accuracyScore,
            fluencyScore: scores.fluencyScore,
            completenessScore: scores.completenessScore,
            prosodyScore: scores.prosodyScore,
            wordsJson: scores.wordsJson,
          });
          onSaved?.(scores);
        } catch {
          showToast?.('Scored, but we could not save this attempt.', 'error');
        }
      } catch (e) {
        showToast?.(e?.message || 'That recording could not be scored.', 'error');
      } finally {
        setScoring(false);
      }
    },
    [referenceText, topicId, onSaved, showToast],
  );

  const toggle = async () => {
    if (recorder.recording) {
      const take = await recorder.stop();
      await finish(take);
      return;
    }
    setResult(null);
    await recorder.start();
  };

  const words = parseWordScores(result?.wordsJson);

  return (
    <>
      <StudentCard>
        <StudentCardTitle>Read this aloud</StudentCardTitle>
        <Text style={styles.reference}>{referenceText}</Text>
      </StudentCard>

      <StudentCard>
        <View style={styles.recordRow}>
          <Pressable
            onPress={toggle}
            disabled={scoring}
            style={({ pressed }) => [
              styles.recordBtn,
              recorder.recording && styles.recordBtnOn,
              scoring && styles.recordBtnOff,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={recorder.recording ? 'Stop recording' : 'Start recording'}
          >
            {scoring ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Ionicons name={recorder.recording ? 'stop' : 'mic'} size={26} color="#ffffff" />
            )}
          </Pressable>

          <View style={styles.recordText}>
            <Text style={styles.recordLabel}>
              {scoring
                ? 'Scoring your recording…'
                : recorder.recording
                  ? `Recording — ${recorder.seconds}s`
                  : 'Tap to record'}
            </Text>
            <Text style={styles.recordHint}>
              {recorder.recording
                ? `Stops automatically at ${recorder.maxSeconds}s.`
                : 'Read the line above at a natural pace.'}
            </Text>
          </View>
        </View>

        {recorder.error ? <Text style={styles.error}>{recorder.error}</Text> : null}
      </StudentCard>

      {result ? (
        <>
          <StudentCard>
            <StudentCardTitle>Your score</StudentCardTitle>
            <Text style={[styles.overall, { color: scoreColor(result.overallScore) }]}>
              {Math.round(result.overallScore ?? 0)}
              <Text style={styles.overallMax}>/100</Text>
            </Text>
            <Text style={styles.overallLabel}>Overall</Text>

            {METRICS.map((m) => {
              const value = result[m.key];
              return (
                <View key={m.key} style={styles.metric}>
                  <View style={styles.metricHead}>
                    <Text style={styles.metricLabel}>{m.label}</Text>
                    <Text style={[styles.metricValue, { color: scoreColor(value) }]}>
                      {value == null ? '—' : Math.round(value)}
                    </Text>
                  </View>
                  <View style={styles.track}>
                    <View
                      style={[
                        styles.fill,
                        { width: `${value == null ? 0 : Math.max(0, Math.min(100, value))}%`,
                          backgroundColor: scoreColor(value) },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </StudentCard>

          <StudentCard>
            <StudentCardTitle>What we heard</StudentCardTitle>
            {words.length > 0 ? (
              <View style={styles.wordWrap}>
                {words.map((w, i) => (
                  <Text
                    key={`${w.word}-${i}`}
                    style={[styles.word, { color: scoreColor(w.score) }]}
                  >
                    {w.word}
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={styles.recognized}>{result.recognizedText || '—'}</Text>
            )}
            <Text style={styles.legend}>
              Green 80+ · amber 60–79 · red below 60
            </Text>
          </StudentCard>
        </>
      ) : null}
    </>
  );
}

const useStyles = makeStyles((p) => ({
  reference: { fontSize: TYPE.title, color: SLATE[800], lineHeight: 25 },

  recordRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  recordBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: p.primaryDark,
  },
  recordBtnOn: { backgroundColor: RECORDING },
  recordBtnOff: { backgroundColor: SLATE[400] },
  recordText: { flex: 1 },
  recordLabel: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  recordHint: { fontSize: TYPE.caption, color: SLATE[500], lineHeight: 17, marginTop: 2 },
  error: { fontSize: TYPE.label, color: FEEDBACK.errorText, lineHeight: 18, marginTop: SPACING.sm },

  overall: { fontSize: TYPE.figure, fontWeight: '800', textAlign: 'center' },
  overallMax: { fontSize: TYPE.title, fontWeight: '600', color: SLATE[400] },
  overallLabel: {
    fontSize: TYPE.caption,
    fontWeight: '700',
    color: SLATE[500],
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
  },

  metric: { marginBottom: SPACING.sm },
  metricHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metricLabel: { fontSize: TYPE.label, fontWeight: '600', color: SLATE[700] },
  metricValue: { fontSize: TYPE.body, fontWeight: '800' },
  track: {
    height: 7,
    borderRadius: 4,
    backgroundColor: SLATE[200],
    overflow: 'hidden',
    marginTop: 4,
  },
  fill: { height: '100%', borderRadius: 4 },

  wordWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  word: { fontSize: TYPE.heading, fontWeight: '600' },
  recognized: { fontSize: TYPE.heading, color: SLATE[700], lineHeight: 21 },
  legend: { fontSize: TYPE.caption, color: SLATE[400], marginTop: SPACING.sm },

  pressed: { opacity: 0.78 },
}));
