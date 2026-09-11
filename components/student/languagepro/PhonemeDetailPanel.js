import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BAND, FEEDBACK, RECORDING, SLATE, SPACING, TYPE, leading } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { StudentCard, StudentCardTitle } from '../StudentCard';
import MouthDiagram from '../phonetics/MouthDiagram';
import useVoiceRecorder from '../../../hooks/useVoiceRecorder';
import { assessPronunciation, synthesizeToFile } from '../../../services/student/speechService';
import { findById } from '../../../constants/phonemeCatalog';
import { Audio } from 'expo-av';

/**
 * One sound, opened from the Sound Studio chart: the mouth, how to make it, example words to hear,
 * its minimal pair, and a recorder that scores just this sound.
 *
 * **The mouth animation lives here and nowhere else.** A reading lip-sync over the passage was
 * built once and removed at the user's request; do not reintroduce it. The results card shown in
 * the assessment modules (`PhonemeDetail`) deliberately has no mouth — it links here instead.
 *
 * The practice recorder passes the example WORD as the reference text rather than the bare
 * phoneme: Azure scores against real speech, and a lone consonant is not a word it can align.
 */

export default function PhonemeDetailPanel({ phoneme, onClose, showToast }) {
  const styles = useStyles();
  const palette = usePalette();
  const recorder = useVoiceRecorder();

  const [speaking, setSpeaking] = useState('');
  const [scoring, setScoring] = useState(false);
  const [score, setScore] = useState(null);

  const pair = phoneme.minimalPair?.otherId ? findById(phoneme.minimalPair.otherId) : null;
  const practiceWord = phoneme.examples[0]?.word || '';

  /**
   * Speak a word through our own TTS, played from a cache file.
   *
   * **The failure is reported, not swallowed.** This used to be a bare `catch {}` justified as
   * "best-effort" — and it hid a wrong language code that made every word on this screen silent
   * with nothing on screen to explain it. Best-effort means it does not BLOCK the panel; it does
   * not mean the student is left tapping a button that does nothing.
   */
  const say = useCallback(
    async (text) => {
      if (!text) return;
      setSpeaking(text);
      try {
        const uri = await synthesizeToFile(text);
        if (!uri) throw new Error('No audio came back for that word.');
        const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) sound.unloadAsync().catch(() => {});
        });
      } catch (e) {
        showToast?.(e?.message || 'That word could not be played.', 'error');
      } finally {
        setSpeaking('');
      }
    },
    [showToast],
  );

  const toggleRecord = async () => {
    if (recorder.recording) {
      const take = await recorder.stop();
      if (!take) return;
      setScoring(true);
      try {
        setScore(await assessPronunciation(take, practiceWord));
      } catch (e) {
        // Name the CAUSE, not just the failure. Android records AMR-WB, which has never been
        // verified against Azure's REST endpoint on a device, so the three plausible causes look
        // identical from the outside — a 403 (role guard), a 415 (multipart shape), or Azure
        // refusing the codec. `StudentApiError` already carries the server's own message; showing
        // it, with the format we sent, is what makes one tap on a device settle which.
        const detail = e?.status ? ` (HTTP ${e.status}, sent ${take.type})` : ` (sent ${take.type})`;
        showToast?.(`${e?.message || 'That recording could not be scored.'}${detail}`, 'error');
      } finally {
        setScoring(false);
      }
      return;
    }
    setScore(null);
    await recorder.start();
  };

  const overall = score?.overallScore;
  const band = overall == null ? null : overall >= 80 ? BAND.good : overall >= 60 ? BAND.fair : BAND.poor;

  return (
    <StudentCard>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.symbol}>{phoneme.ipa}</Text>
          <Text style={styles.label}>{phoneme.label}</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={20} color={SLATE[400]} />
        </Pressable>
      </View>

      <MouthDiagram
        shape={phoneme.shape}
        closure={phoneme.closure}
        release={phoneme.release}
        voiced={phoneme.voiced}
      />

      <StudentCardTitle>How to make it</StudentCardTitle>
      <Text style={styles.howTo}>{phoneme.howTo}</Text>

      <StudentCardTitle>Hear it in words</StudentCardTitle>
      <View style={styles.wordRow}>
        {phoneme.examples.map((ex) => (
          <Pressable
            key={ex.word}
            onPress={() => say(ex.word)}
            style={({ pressed }) => [styles.wordChip, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Play ${ex.word}`}
          >
            {speaking === ex.word ? (
              <ActivityIndicator size="small" color={palette.deep} />
            ) : (
              <Ionicons name="volume-medium-outline" size={16} color={palette.deep} />
            )}
            <Text style={styles.wordText}>{ex.word}</Text>
            <Text style={styles.wordIpa}>/{ex.ipa}/</Text>
          </Pressable>
        ))}
      </View>

      {pair ? (
        <>
          <StudentCardTitle>Don&apos;t confuse it with</StudentCardTitle>
          <View style={styles.pairRow}>
            <Text style={styles.pairSymbol}>{pair.ipa}</Text>
            <Text style={styles.pairNote}>{phoneme.minimalPair.note}</Text>
          </View>
        </>
      ) : null}

      <StudentCardTitle>Try it yourself</StudentCardTitle>
      <View style={styles.recordRow}>
        <Pressable
          onPress={toggleRecord}
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
            <Ionicons name={recorder.recording ? 'stop' : 'mic'} size={20} color="#ffffff" />
          )}
        </Pressable>
        <Text style={styles.recordHint}>
          {scoring
            ? 'Scoring…'
            : recorder.recording
              ? `Recording — say "${practiceWord}"`
              : `Tap, then say "${practiceWord}"`}
        </Text>
      </View>
      {recorder.error ? <Text style={styles.error}>{recorder.error}</Text> : null}

      {score ? (
        <View style={styles.scoreRow}>
          <Text style={[styles.scoreValue, { color: band }]}>{Math.round(overall ?? 0)}</Text>
          <View style={styles.scoreText}>
            <Text style={styles.scoreLabel}>out of 100</Text>
            {score.recognizedText ? (
              <Text style={styles.heard}>Heard: {score.recognizedText}</Text>
            ) : null}
          </View>
        </View>
      ) : null}
    </StudentCard>
  );
}

const useStyles = makeStyles((p) => ({
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headText: { flex: 1 },
  symbol: { fontSize: TYPE.display, fontWeight: '800', color: p.primaryDark },
  label: { fontSize: TYPE.body, color: SLATE[600], marginTop: -2 },

  howTo: { fontSize: TYPE.body, color: SLATE[700], lineHeight: leading(TYPE.body), marginBottom: SPACING.sm },

  wordRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: SPACING.sm },
  wordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: p.tint,
  },
  wordText: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },
  wordIpa: { fontSize: TYPE.caption, color: SLATE[500] },

  pairRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: SPACING.sm },
  pairSymbol: { fontSize: TYPE.headline, fontWeight: '800', color: SLATE[500] },
  pairNote: { flex: 1, fontSize: TYPE.label, color: SLATE[600] },

  recordRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  recordBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: p.primaryDark,
  },
  recordBtnOn: { backgroundColor: RECORDING },
  recordBtnOff: { backgroundColor: SLATE[400] },
  recordHint: { flex: 1, fontSize: TYPE.label, color: SLATE[600] },
  error: { fontSize: TYPE.label, color: FEEDBACK.errorText, lineHeight: leading(TYPE.label), marginTop: SPACING.sm },

  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginTop: SPACING.md },
  scoreValue: { fontSize: TYPE.figure, fontWeight: '800' },
  scoreText: { flex: 1 },
  scoreLabel: { fontSize: TYPE.caption, color: SLATE[500] },
  heard: { fontSize: TYPE.label, color: SLATE[700], marginTop: 2 },

  pressed: { opacity: 0.78 },
}));
