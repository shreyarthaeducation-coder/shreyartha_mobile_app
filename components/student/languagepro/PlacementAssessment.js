import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, RECORDING, SLATE, SPACING, TYPE } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { StudentCard, StudentCardTitle } from '../StudentCard';
import useFreeSpeech from '../../../hooks/useFreeSpeech';
import useShreyaVoice from '../../../hooks/useShreyaVoice';
import { shreyaEnglish } from '../../../services/student/languageProService';

/**
 * The spoken placement assessment — Shreya reads each question aloud, the student answers by voice,
 * and the transcripts decide which level they start at.
 *
 * **It runs once.** The shell only shows it when `profile.placementDone` is false, and submitting
 * sets that. Re-running it would move a student who has already made progress.
 *
 * Each transcript is confirmed before moving on. That is in the web too, but it matters more here:
 * mobile has no live transcript, so this is the student's first sight of what was heard.
 */

export default function PlacementAssessment({ onPlaced }) {
  const styles = useStyles();
  const palette = usePalette();

  const [questions, setQuestions] = useState(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [phase, setPhase] = useState('intro'); // intro | asking | submitting | result | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const speech = useFreeSpeech();
  const voice = useShreyaVoice();

  useEffect(() => {
    let alive = true;
    shreyaEnglish
      .placementQuestions()
      .then((qs) => {
        if (!alive) return;
        setQuestions(Array.isArray(qs) ? qs : []);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e?.message || 'Could not load the placement questions.');
        setPhase('error');
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => () => voice.stop(), [voice]);

  const q = questions ? questions[index] : null;
  const total = questions ? questions.length : 0;

  const ask = useCallback(
    async (i) => {
      const question = questions?.[i];
      if (!question) return;
      // Warm the next question while this one plays.
      if (questions[i + 1]) voice.prefetch(questions[i + 1].questionText);
      await voice.speak(question.questionText);
    },
    [questions, voice],
  );

  const begin = useCallback(async () => {
    setPhase('asking');
    setIndex(0);
    speech.reset();
    await ask(0);
  }, [ask, speech]);

  const toggle = async () => {
    if (speech.recording) {
      await speech.stop();
      return;
    }
    // Shreya has to stop before the mic opens — the recorder takes over the audio session.
    voice.stop();
    await speech.start();
  };

  const submitAll = useCallback(
    async (finalAnswers) => {
      setPhase('submitting');
      try {
        const res = await shreyaEnglish.submitPlacement({ responses: finalAnswers });
        setResult(res);
        setPhase('result');
      } catch (e) {
        setError(e?.message || 'Could not submit your placement. Please try again.');
        setPhase('asking');
      }
    },
    [],
  );

  const accept = useCallback(async () => {
    const entry = { questionId: q.id, transcript: speech.transcript || '' };
    const next = [...answers.filter((a) => a.questionId !== q.id), entry];
    setAnswers(next);
    speech.reset();

    if (index + 1 < total) {
      const nextIdx = index + 1;
      setIndex(nextIdx);
      await ask(nextIdx);
    } else {
      submitAll(next);
    }
  }, [q, speech, answers, index, total, ask, submitAll]);

  if (phase === 'error') {
    return (
      <StudentCard>
        <Text style={styles.error}>{error}</Text>
      </StudentCard>
    );
  }

  if (phase === 'intro') {
    return (
      <StudentCard>
        <StudentCardTitle>Let&apos;s find your level</StudentCardTitle>
        <Text style={styles.body}>
          Shreya will ask you a few questions out loud. Answer in your own words — there are no
          wrong answers. This happens once, and it decides where you start.
        </Text>
        <Pressable
          onPress={begin}
          disabled={!questions}
          style={({ pressed }) => [
            styles.primary,
            !questions && styles.primaryOff,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
        >
          {!questions ? (
            <ActivityIndicator size="small" color={palette.onPrimary} />
          ) : (
            <Text style={styles.primaryText}>Start</Text>
          )}
        </Pressable>
      </StudentCard>
    );
  }

  if (phase === 'submitting') {
    return (
      <StudentCard>
        <ActivityIndicator size="large" color={palette.primary} style={styles.loader} />
        <Text style={styles.body}>Working out your level…</Text>
      </StudentCard>
    );
  }

  if (phase === 'result') {
    return (
      <StudentCard>
        <StudentCardTitle>You&apos;re starting at</StudentCardTitle>
        <Text style={styles.level}>{result?.level || result?.currentLevel || 'A1'}</Text>
        <Text style={styles.body}>
          You can always practise any sound in Sound Studio, whatever level you are on.
        </Text>
        <Pressable
          onPress={() => onPlaced?.(result?.level || result?.currentLevel)}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>See my levels →</Text>
        </Pressable>
      </StudentCard>
    );
  }

  // asking
  const heard = speech.transcript;
  return (
    <>
      <StudentCard>
        <Text style={styles.count}>
          Question {index + 1} of {total}
        </Text>
        {voice.speaking ? <Text style={styles.speaking}>🔊 Shreya is speaking…</Text> : null}
        <Text style={styles.question}>{q?.questionText}</Text>
      </StudentCard>

      <StudentCard>
        <View style={styles.micRow}>
          <Pressable
            onPress={toggle}
            disabled={speech.transcribing}
            style={({ pressed }) => [
              styles.mic,
              speech.recording && styles.micOn,
              speech.transcribing && styles.micOff,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={speech.recording ? 'Stop answering' : 'Answer'}
          >
            {speech.transcribing ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Ionicons name={speech.recording ? 'stop' : 'mic'} size={24} color="#ffffff" />
            )}
          </Pressable>
          <Text style={styles.micHint}>
            {speech.transcribing
              ? 'Working out what you said…'
              : speech.recording
                ? `Listening — ${speech.seconds}s`
                : 'Tap and answer out loud'}
          </Text>
        </View>
        {speech.error ? <Text style={styles.error}>{speech.error}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {heard ? (
          <>
            <Text style={styles.heardLabel}>You said</Text>
            <Text style={styles.heard}>{heard}</Text>
            <View style={styles.confirmRow}>
              <Pressable
                onPress={() => speech.reset()}
                style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryText}>Try again</Text>
              </Pressable>
              <Pressable
                onPress={accept}
                style={({ pressed }) => [styles.confirm, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Text style={styles.confirmText}>
                  {index + 1 < total ? 'Next question' : 'Finish'}
                </Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </StudentCard>
    </>
  );
}

const useStyles = makeStyles((p) => ({
  loader: { marginVertical: SPACING.md },
  body: { fontSize: TYPE.body, color: SLATE[600], lineHeight: 20 },
  error: { fontSize: TYPE.label, color: FEEDBACK.errorText, lineHeight: 18, marginTop: SPACING.sm },

  level: { fontSize: TYPE.figure, fontWeight: '800', color: p.primaryDark, textAlign: 'center' },

  count: {
    fontSize: TYPE.caption,
    fontWeight: '800',
    color: p.deep,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  speaking: { fontSize: TYPE.label, fontWeight: '700', color: p.deep, marginTop: 4 },
  question: { fontSize: TYPE.title, color: SLATE[800], lineHeight: 26, marginTop: 4 },

  micRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  mic: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: p.primaryDark,
  },
  micOn: { backgroundColor: RECORDING },
  micOff: { backgroundColor: SLATE[400] },
  micHint: { flex: 1, fontSize: TYPE.body, color: SLATE[600], lineHeight: 19 },

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
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: p.primary,
    marginTop: SPACING.md,
  },
  primaryOff: { backgroundColor: SLATE[400] },
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
