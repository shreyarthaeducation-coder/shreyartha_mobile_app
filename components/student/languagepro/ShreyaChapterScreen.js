import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, RECORDING, SLATE, SPACING, TYPE } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { StudentCard, StudentCardTitle } from '../StudentCard';
import ChapterSummary from './ChapterSummary';
import { parseWordScores, scoreColor } from '../phonetics/wordScores';
import useVoiceRecorder from '../../../hooks/useVoiceRecorder';
import useFreeSpeech from '../../../hooks/useFreeSpeech';
import useShreyaVoice from '../../../hooks/useShreyaVoice';
import { htmlToText } from '../../../utils/htmlToText';
import { assessPronunciation } from '../../../services/student/speechService';
import { shreyaEnglish } from '../../../services/student/languageProService';

/**
 * One chapter of Communicative English: intro → read aloud (scored) → reading results → spoken
 * questions → evaluating → summary.
 *
 * TWO DIFFERENCES FROM THE WEB, both consequences of having no browser Speech SDK:
 *   • the reading passage cannot highlight live as the student speaks, so it colours **per word
 *     after scoring** instead (`wordsJson`);
 *   • answers show their transcript only once the student stops, which is why each one is
 *     confirmed before moving on.
 *
 * The submitted payload is unchanged from the web — only where the numbers come from differs.
 */

// Authored copy — verbatim from the web.
const DEFAULT_INTRO =
  "Hi! I'm Shreya. In this chapter, first read the passage aloud to me — take your time. " +
  "After that, I'll ask you a few questions about it. Ready? Let's go!";
const READING_LEAD_IN =
  "Here is your passage. When you're ready, tap the microphone and read it aloud to me.";
const QUESTIONS_LEAD_IN = 'Great reading! Now, let me ask you a few questions.';

export default function ShreyaChapterScreen({ chapterId, onExit, showToast }) {
  const styles = useStyles();
  const palette = usePalette();

  const [chapter, setChapter] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading|intro|reading|readingResults|questions|evaluating|summary|error
  const [error, setError] = useState('');
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [attemptResult, setAttemptResult] = useState(null);
  const [scoring, setScoring] = useState(false);

  const voice = useShreyaVoice();
  const answerSpeech = useFreeSpeech();
  const reading = useVoiceRecorder();
  const readingResultRef = useRef(null);
  const introSpokenRef = useRef(false);

  // The plain text of the passage IS the Azure reference text. No DOM here, so `htmlToText` does
  // what the web's DOMPurify + textContent does.
  const referenceText = useMemo(() => htmlToText(chapter?.readingContent), [chapter]);
  const questions = chapter?.questions || [];

  useEffect(() => {
    let alive = true;
    shreyaEnglish
      .chapter(chapterId)
      .then((ch) => {
        if (!alive) return;
        setChapter(ch);
        setPhase('intro');
      })
      .catch((e) => {
        if (!alive) return;
        setError(e?.message || 'Could not open this chapter.');
        setPhase('error');
      });
    return () => {
      alive = false;
    };
  }, [chapterId]);

  // Leaving mid-session must silence Shreya, or she keeps talking over the next screen.
  useEffect(() => () => voice.stop(), [voice]);

  const say = useCallback(async (text) => voice.speak(text), [voice]);

  /* ── Intro → reading ─────────────────────────────────────────────────── */

  const startIntro = useCallback(async () => {
    if (introSpokenRef.current) return;
    introSpokenRef.current = true;
    setPhase('reading');
    await say(chapter?.introText || DEFAULT_INTRO);
    if (referenceText) await say(READING_LEAD_IN);
  }, [say, chapter, referenceText]);

  /* ── Reading ─────────────────────────────────────────────────────────── */

  const toggleReading = async () => {
    if (reading.recording) {
      const take = await reading.stop();
      if (!take) return;
      setScoring(true);
      try {
        const scores = await assessPronunciation(take, referenceText);
        readingResultRef.current = scores;
        setPhase('readingResults');
      } catch (e) {
        showToast?.(e?.message || 'That reading could not be scored.', 'error');
      } finally {
        setScoring(false);
      }
      return;
    }
    // Shreya must stop before the mic opens — the recorder takes over the audio session and
    // would otherwise record her voice alongside the student's.
    voice.stop();
    await reading.start();
  };

  /* ── Questions ───────────────────────────────────────────────────────── */

  const finishChapter = useCallback(
    async (finalAnswers) => {
      setPhase('evaluating');
      const r = readingResultRef.current || {};
      try {
        const res = await shreyaEnglish.submitAttempt(chapterId, {
          accuracy: r.accuracyScore,
          fluency: r.fluencyScore,
          completeness: r.completenessScore,
          prosody: r.prosodyScore,
          overall: r.overallScore,
          recognizedText: r.recognizedText || '',
          wordsJson: r.wordsJson || '[]',
          answers: finalAnswers,
        });
        setAttemptResult(res);
        setPhase('summary');
      } catch (e) {
        setError(e?.message || 'Could not save your attempt. Please try again.');
        setPhase('readingResults');
      }
    },
    [chapterId],
  );

  const startQuestions = useCallback(async () => {
    if (questions.length === 0) {
      finishChapter([]);
      return;
    }
    setPhase('questions');
    setQIndex(0);
    answerSpeech.reset();
    // Warm the next question's audio while this one plays.
    if (questions[1]) voice.prefetch(questions[1].questionText);
    await say(QUESTIONS_LEAD_IN);
    await say(questions[0].questionText);
  }, [questions, voice, answerSpeech, say, finishChapter]);

  const acceptAnswer = useCallback(async () => {
    const q = questions[qIndex];
    const entry = { questionId: q.id, transcript: answerSpeech.transcript || '' };
    const next = [...answers.filter((a) => a.questionId !== q.id), entry];
    setAnswers(next);
    answerSpeech.reset();

    if (qIndex + 1 < questions.length) {
      const nextIdx = qIndex + 1;
      setQIndex(nextIdx);
      if (questions[nextIdx + 1]) voice.prefetch(questions[nextIdx + 1].questionText);
      await say(questions[nextIdx].questionText);
    } else {
      finishChapter(next);
    }
  }, [questions, qIndex, answers, answerSpeech, voice, say, finishChapter]);

  const toggleAnswer = async () => {
    if (answerSpeech.recording) {
      await answerSpeech.stop();
      return;
    }
    voice.stop(); // same hazard as the reading phase
    await answerSpeech.start();
  };

  /* ── Bodies ──────────────────────────────────────────────────────────── */

  const renderPassage = () => {
    const scores = readingResultRef.current;
    const words = parseWordScores(scores?.wordsJson);
    // Before scoring there is nothing to colour — the web colours live, we cannot.
    if (words.length === 0) {
      return <Text style={styles.passage}>{referenceText}</Text>;
    }
    return (
      <View style={styles.passageWrap}>
        {words.map((w, i) => (
          <Text key={`${w.word}-${i}`} style={[styles.passageWord, { color: scoreColor(w.score) }]}>
            {w.word}
          </Text>
        ))}
      </View>
    );
  };

  const renderReading = () => (
    <>
      <StudentCard>
        <StudentCardTitle>Read this aloud</StudentCardTitle>
        {voice.speaking ? <Text style={styles.speaking}>🔊 Shreya is speaking…</Text> : null}
        <Text style={styles.passage}>{referenceText}</Text>
      </StudentCard>

      <StudentCard>
        <View style={styles.micRow}>
          <Pressable
            onPress={toggleReading}
            disabled={scoring}
            style={({ pressed }) => [
              styles.mic,
              reading.recording && styles.micOn,
              scoring && styles.micOff,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={reading.recording ? 'Stop reading' : 'Start reading'}
          >
            {scoring ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Ionicons name={reading.recording ? 'stop' : 'mic'} size={26} color="#ffffff" />
            )}
          </Pressable>
          <Text style={styles.micHint}>
            {scoring
              ? 'Scoring your reading…'
              : reading.recording
                ? `Reading — ${reading.seconds}s (stops at ${reading.maxSeconds}s)`
                : 'Tap when you are ready to read'}
          </Text>
        </View>
        {reading.error ? <Text style={styles.error}>{reading.error}</Text> : null}
      </StudentCard>
    </>
  );

  const renderReadingResults = () => {
    const r = readingResultRef.current || {};
    const METRICS = [
      ['accuracyScore', 'Accuracy'],
      ['fluencyScore', 'Fluency'],
      ['completenessScore', 'Completeness'],
      ['prosodyScore', 'Prosody'],
    ];
    return (
      <>
        <StudentCard>
          <StudentCardTitle>How your reading went</StudentCardTitle>
          <Text style={[styles.overall, { color: scoreColor(r.overallScore) }]}>
            {Math.round(r.overallScore ?? 0)}
            <Text style={styles.overallMax}>/100</Text>
          </Text>
          {METRICS.map(([key, label]) => (
            <View key={key} style={styles.metricRow}>
              <Text style={styles.metricLabel}>{label}</Text>
              <Text style={[styles.metricValue, { color: scoreColor(r[key]) }]}>
                {r[key] == null ? '—' : Math.round(r[key])}
              </Text>
            </View>
          ))}
        </StudentCard>

        <StudentCard>
          <StudentCardTitle>Your reading, word by word</StudentCardTitle>
          {renderPassage()}
          <Text style={styles.legend}>Green 80+ · amber 60–79 · red below 60</Text>
        </StudentCard>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={startQuestions}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>
            {questions.length > 0 ? 'Next — Shreya asks you questions' : 'Finish chapter'}
          </Text>
        </Pressable>
      </>
    );
  };

  const renderQuestions = () => {
    const q = questions[qIndex];
    if (!q) return null;
    const heard = answerSpeech.transcript;
    return (
      <>
        <StudentCard>
          <Text style={styles.qCount}>
            Question {qIndex + 1} of {questions.length}
          </Text>
          {voice.speaking ? <Text style={styles.speaking}>🔊 Shreya is speaking…</Text> : null}
          <Text style={styles.question}>{q.questionText}</Text>
        </StudentCard>

        <StudentCard>
          <View style={styles.micRow}>
            <Pressable
              onPress={toggleAnswer}
              disabled={answerSpeech.transcribing}
              style={({ pressed }) => [
                styles.mic,
                answerSpeech.recording && styles.micOn,
                answerSpeech.transcribing && styles.micOff,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={answerSpeech.recording ? 'Stop answering' : 'Answer'}
            >
              {answerSpeech.transcribing ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Ionicons
                  name={answerSpeech.recording ? 'stop' : 'mic'}
                  size={24}
                  color="#ffffff"
                />
              )}
            </Pressable>
            <Text style={styles.micHint}>
              {answerSpeech.transcribing
                ? 'Working out what you said…'
                : answerSpeech.recording
                  ? `Listening — ${answerSpeech.seconds}s`
                  : 'Tap and answer in your own words'}
            </Text>
          </View>
          {answerSpeech.error ? <Text style={styles.error}>{answerSpeech.error}</Text> : null}

          {/* Confirmation matters more here than on the web: the student only sees the transcript
              once they stop, so this is their first chance to notice it is wrong. */}
          {heard ? (
            <>
              <Text style={styles.heardLabel}>You said</Text>
              <Text style={styles.heard}>{heard}</Text>
              <View style={styles.confirmRow}>
                <Pressable
                  onPress={() => answerSpeech.reset()}
                  style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <Text style={styles.secondaryText}>Try again</Text>
                </Pressable>
                <Pressable
                  onPress={acceptAnswer}
                  style={({ pressed }) => [styles.confirm, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <Text style={styles.confirmText}>
                    {qIndex + 1 < questions.length ? 'Next question' : 'Finish'}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </StudentCard>
      </>
    );
  };

  /* ── Screen ──────────────────────────────────────────────────────────── */

  if (phase === 'loading') {
    return <ActivityIndicator size="large" color={palette.primary} style={styles.loader} />;
  }

  if (phase === 'error') {
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
          <Text style={styles.secondaryText}>← Back</Text>
        </Pressable>
      </>
    );
  }

  if (phase === 'intro') {
    return (
      <StudentCard>
        <StudentCardTitle>{chapter?.name}</StudentCardTitle>
        <Text style={styles.passage}>{chapter?.introText || DEFAULT_INTRO}</Text>
        <Pressable
          onPress={startIntro}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>Start</Text>
        </Pressable>
      </StudentCard>
    );
  }

  if (phase === 'evaluating') {
    return (
      <StudentCard>
        <ActivityIndicator size="large" color={palette.primary} style={styles.loader} />
        <Text style={styles.evaluating}>Shreya is looking at your answers…</Text>
      </StudentCard>
    );
  }

  if (phase === 'summary') {
    return <ChapterSummary result={attemptResult} onExit={onExit} />;
  }

  if (phase === 'readingResults') return renderReadingResults();
  if (phase === 'questions') return renderQuestions();
  return renderReading();
}

const useStyles = makeStyles((p) => ({
  loader: { marginVertical: SPACING.lg },
  evaluating: { fontSize: TYPE.body, color: SLATE[600], textAlign: 'center' },

  speaking: { fontSize: TYPE.label, fontWeight: '700', color: p.deep, marginBottom: 6 },
  passage: { fontSize: TYPE.title, color: SLATE[800], lineHeight: 26 },
  passageWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  passageWord: { fontSize: TYPE.title, fontWeight: '600', lineHeight: 26 },
  legend: { fontSize: TYPE.caption, color: SLATE[400], marginTop: SPACING.sm },

  micRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  mic: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: p.primaryDark,
  },
  micOn: { backgroundColor: RECORDING },
  micOff: { backgroundColor: SLATE[400] },
  micHint: { flex: 1, fontSize: TYPE.body, color: SLATE[600], lineHeight: 19 },
  error: { fontSize: TYPE.label, color: FEEDBACK.errorText, lineHeight: 18, marginTop: SPACING.sm },

  overall: { fontSize: TYPE.figure, fontWeight: '800', textAlign: 'center' },
  overallMax: { fontSize: TYPE.title, fontWeight: '600', color: SLATE[400] },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: SLATE[200],
  },
  metricLabel: { fontSize: TYPE.label, color: SLATE[600] },
  metricValue: { fontSize: TYPE.body, fontWeight: '800' },

  qCount: {
    fontSize: TYPE.caption,
    fontWeight: '800',
    color: p.deep,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  question: { fontSize: TYPE.title, color: SLATE[800], lineHeight: 26, marginTop: 4 },
  heardLabel: {
    fontSize: TYPE.micro,
    fontWeight: '800',
    color: SLATE[500],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: SPACING.md,
  },
  heard: { fontSize: TYPE.heading, color: SLATE[800], lineHeight: 21, marginTop: 3 },
  confirmRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },

  primary: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: p.primary,
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  primaryText: { fontSize: TYPE.heading, fontWeight: '700', color: p.onPrimary },
  confirm: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: p.primary,
  },
  confirmText: { fontSize: TYPE.heading, fontWeight: '700', color: p.onPrimary },
  secondary: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: p.tint,
  },
  secondaryText: { fontSize: TYPE.heading, fontWeight: '700', color: p.deep },

  pressed: { opacity: 0.78 },
}));
