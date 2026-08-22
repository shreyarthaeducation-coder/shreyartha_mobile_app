import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, QUIZ, SLATE, SPACING, TYPE } from '../../../constants/theme';
import { makeStyles } from '../../../utils/makeStyles';
import DoubtText from './DoubtText';
import { pickImage, takePhoto } from '../../../utils/filePicker';
import {
  SOURCES,
  createSession,
  fetchHistory,
  fetchSession,
  getExplore,
  getQuestions,
  getResolution,
  getSolution,
  mergeSession,
  stageLabel,
  submitAttempt,
  submitVerification,
} from '../../../services/student/doubtService';

/**
 * Doubt Resolution — photograph a question and work through it stage by stage.
 *
 * Port of `frontendmain/src/student/components/DoubtResolution/DoubtResolutionModal.js` (655 lines).
 *
 * ── THE STAGES ARE THE SERVER'S ──────────────────────────────────────────────
 * `stage` is an int 1-5 enforced in `DoubtResolutionService.requireStage` and only ever moves
 * forward. This screen mirrors it to decide what to render and never to decide what is allowed — a
 * locked card shows its head and a 🔒 note, exactly as the web does, and the button that would
 * unlock it is simply not rendered.
 *
 * ── NAVY, NOT THE PANEL PALETTE ──────────────────────────────────────────────
 * Doubt Resolution has its own identity on the web (`#162a6a → #3b82f6`), the same way Jyora has
 * its purple. Both are guests on whichever screen opened them, so both keep their own colours.
 *
 * ── SCREEN CAPTURE HAPPENS BEFORE THIS OPENS ─────────────────────────────────
 * The web's third capture route is `html2canvas` on a DOM node while the modal is open. The RN
 * equivalent would be `captureRef` on a view sitting **behind a Modal**, which is the same setup
 * that has produced a blank bitmap before. So the caller captures first and passes the result in as
 * `prefilledCapture`; this sheet just offers it as a ready-made option.
 */

const NAVY = {
  primary: '#162a6a',
  accent: '#3b82f6',
  tint: '#eff6ff',
  warnBg: FEEDBACK.warningBg,
  warnFg: FEEDBACK.warningOnBg,
};

export default function DoubtSheet({
  visible,
  onClose,
  source = SOURCES.CHATBOT,
  subjectName = '',
  chapterName = '',
  topicName = '',
  prefilledCapture = null,
}) {
  const styles = useStyles();

  const [view, setView] = useState('home'); // home | preview | session
  const [pending, setPending] = useState(null); // { uri } awaiting upload
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [mismatch, setMismatch] = useState(null); // { subjectGuess }

  const [session, setSession] = useState(null);
  const [history, setHistory] = useState([]);

  const [attemptText, setAttemptText] = useState('');
  const [mcqAnswers, setMcqAnswers] = useState({});
  const [ftAnswers, setFtAnswers] = useState({});
  // ONE global in-flight lock, as the web has: every stage call is expensive and none should race.
  const [busy, setBusy] = useState('');

  const aliveRef = useRef(true);

  const loadHistory = useCallback(async () => {
    try {
      const list = await fetchHistory();
      if (aliveRef.current) setHistory(list);
    } catch {
      if (aliveRef.current) setHistory([]);
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    if (visible) {
      setView('home');
      setPending(prefilledCapture ? { uri: prefilledCapture } : null);
      if (prefilledCapture) setView('preview');
      setSession(null);
      setError('');
      setMismatch(null);
      loadHistory();
    }
    return () => {
      aliveRef.current = false;
    };
  }, [visible, prefilledCapture, loadHistory]);

  const backHome = () => {
    setView('home');
    setPending(null);
    setSession(null);
    setMismatch(null);
    setError('');
    setAttemptText('');
    setMcqAnswers({});
    setFtAnswers({});
    loadHistory();
  };

  /* ── Capture ─────────────────────────────────────────────────────────── */

  const choose = async (fn, deniedMessage) => {
    setError('');
    try {
      const picked = await fn();
      if (!picked) return;
      if (picked.denied) {
        setError(deniedMessage);
        return;
      }
      setPending({ uri: picked.uri });
      setMismatch(null);
      setView('preview');
    } catch (e) {
      setError(e?.message || 'Could not open that. Please try again.');
    }
  };

  /* ── Create ──────────────────────────────────────────────────────────── */

  const submitDoubt = async () => {
    if (!pending?.uri || submitting) return;
    setSubmitting(true);
    setError('');
    setMismatch(null);
    try {
      const res = await createSession({
        uri: pending.uri,
        source,
        subjectName,
        chapterName,
        topicName,
      });

      if (!aliveRef.current) return;

      // A MISMATCH IS A 200 WITH `session: null` — not an error. Reading `res.session.id` here is
      // how a naive port crashes on a perfectly ordinary answer.
      if (res?.belongsToSubject === false) {
        setMismatch({ subjectGuess: res.subjectGuess || 'different subject' });
        return;
      }
      if (!res?.session) {
        setError("We couldn't read a question in that image. Please try a clearer photo.");
        return;
      }

      setSession(res.session);
      setAttemptText('');
      setView('session');
    } catch (e) {
      if (aliveRef.current) setError(e?.message || 'That didn’t work — please try again.');
    } finally {
      if (aliveRef.current) setSubmitting(false);
    }
  };

  /* ── Stages ──────────────────────────────────────────────────────────── */

  const runStage = async (key, fn) => {
    if (busy) return;
    setBusy(key);
    setError('');
    try {
      const patch = await fn();
      if (aliveRef.current) setSession((prev) => mergeSession(prev, patch));
    } catch (e) {
      if (aliveRef.current) setError(e?.message || 'That didn’t work — please try again.');
    } finally {
      if (aliveRef.current) setBusy('');
    }
  };

  const openHistory = async (id) => {
    setError('');
    try {
      const s = await fetchSession(id);
      if (!aliveRef.current) return;
      setSession(s);
      setAttemptText('');
      setMcqAnswers({});
      setFtAnswers({});
      setView('session');
    } catch (e) {
      setError(e?.message || 'Could not open that doubt.');
    }
  };

  const submitAnswers = () => {
    const mcqs = session?.questions?.mcqs || [];
    const fts = session?.questions?.freeText || [];
    // POSITIONAL arrays — the server requires exactly 2 and 3 and matches by position, not by index
    // field. A missing answer is '' rather than a gap.
    const mcq = mcqs.map((q) => mcqAnswers[q.index] || '');
    const ft = fts.map((q) => ftAnswers[q.index] || '');
    return runStage('verify', () => submitVerification(session.id, mcq, ft));
  };

  /* ── Rendering ───────────────────────────────────────────────────────── */

  const stageCard = (num, title, unlocked, children) => (
    <View style={[styles.stageCard, !unlocked && styles.stageLocked]}>
      <View style={styles.stageHead}>
        <View style={[styles.stageNum, !unlocked && styles.stageNumOff]}>
          <Text style={styles.stageNumText}>{num}</Text>
        </View>
        <Text style={styles.stageTitle}>{title}</Text>
        {!unlocked ? <Text style={styles.lockNote}>🔒 Complete the previous step</Text> : null}
      </View>
      {unlocked ? <View style={styles.stageBody}>{children}</View> : null}
    </View>
  );

  const primary = (label, busyLabel, onPress, key, disabled) => (
    <Pressable
      onPress={onPress}
      disabled={!!busy || disabled}
      style={({ pressed }) => [
        styles.primary,
        (!!busy || disabled) && styles.primaryOff,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
    >
      <Text style={styles.primaryText}>{busy === key ? busyLabel : label}</Text>
    </Pressable>
  );

  const renderHome = () => (
    <>
      <Text style={styles.intro}>
        Stuck on a question? Show it to me and we’ll work through it together — step by step.
      </Text>

      <View style={styles.cards}>
        <Pressable
          onPress={() =>
            choose(takePhoto, 'Camera permission was denied — you can upload a photo instead.')
          }
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Ionicons name="camera-outline" size={26} color={NAVY.primary} />
          <Text style={styles.cardTitle}>Take a Picture</Text>
          <Text style={styles.cardDesc}>Use your camera</Text>
        </Pressable>

        <Pressable
          onPress={() =>
            choose(pickImage, 'Photo access was denied — you can take a picture instead.')
          }
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Ionicons name="image-outline" size={26} color={NAVY.primary} />
          <Text style={styles.cardTitle}>Upload Image</Text>
          <Text style={styles.cardDesc}>Choose a photo from your device</Text>
        </Pressable>
      </View>

      {history.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Your past doubts</Text>
          {history.map((h) => (
            <Pressable
              key={h.id}
              onPress={() => openHistory(h.id)}
              style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              {h.imageUrl ? (
                <Image source={{ uri: h.imageUrl }} style={styles.thumb} resizeMode="cover" />
              ) : (
                <View style={styles.thumb} />
              )}
              <View style={styles.historyBody}>
                <Text style={styles.historyText} numberOfLines={2}>
                  {h.questionPreview || '(image doubt)'}
                </Text>
                <Text style={styles.historyMeta}>
                  {[h.subjectName, h.createdAt ? new Date(h.createdAt).toLocaleDateString() : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <Text style={styles.chip}>{stageLabel(h.stage)}</Text>
            </Pressable>
          ))}
        </>
      ) : null}
    </>
  );

  const renderPreview = () => (
    <>
      {pending?.uri ? (
        <Image source={{ uri: pending.uri }} style={styles.preview} resizeMode="contain" />
      ) : null}

      {mismatch ? (
        <View style={styles.warn}>
          <Text style={styles.warnText}>
            Hmm — this looks like a {mismatch.subjectGuess} question, but you’re in {subjectName}.
            Please upload a question from {subjectName}.
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={submitDoubt}
        disabled={submitting}
        style={({ pressed }) => [styles.primary, submitting && styles.primaryOff, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Text style={styles.primaryText}>
          {submitting ? 'Reading your question…' : 'Ask my doubt →'}
        </Text>
      </Pressable>
      {submitting ? (
        <Text style={styles.note}>This can take up to half a minute — hang tight!</Text>
      ) : null}

      <Pressable
        onPress={backHome}
        style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Text style={styles.secondaryText}>↩ Retake / choose another</Text>
      </Pressable>
    </>
  );

  const renderSession = () => {
    const s = session || {};
    const stage = s.stage || 1;
    const q = s.questions;
    const v = s.verification;

    return (
      <>
        <View style={styles.questionBox}>
          {s.imageUrl ? (
            <Image source={{ uri: s.imageUrl }} style={styles.thumbLarge} resizeMode="cover" />
          ) : null}
          <Text style={styles.questionLabel}>Here’s the question I read:</Text>
          <Text style={styles.questionText}>{s.extractedQuestion}</Text>
        </View>

        {stageCard(
          1,
          'Try It First',
          true,
          s.attemptFeedback ? (
            <>
              <Text style={styles.subLabel}>Your attempt:</Text>
              <Text style={styles.attempt}>{s.studentAttempt}</Text>
              <DoubtText value={s.attemptFeedback} style={styles.feedback} />
            </>
          ) : (
            <>
              <Text style={styles.hint}>
                Give it a go before seeing any help — even a rough idea counts!
              </Text>
              <TextInput
                value={attemptText}
                onChangeText={setAttemptText}
                placeholder="Write what you think, or how far you got…"
                placeholderTextColor={SLATE[400]}
                multiline
                style={styles.input}
              />
              {primary('Submit my attempt', 'Checking your attempt…', () => {
                if (!attemptText.trim()) {
                  setError('Please write your attempt first.');
                  return undefined;
                }
                return runStage('attempt', () => submitAttempt(s.id, attemptText.trim()));
              }, 'attempt')}
            </>
          ),
        )}

        {stageCard(
          2,
          'Solution in Steps',
          stage >= 2,
          <>
            {!s.resolutionText
              ? primary('See the approach, step by step', 'Preparing the approach…', () => runStage('resolution', () => getResolution(s.id)), 'resolution')
              : (
                <>
                  <DoubtText value={s.resolutionText} />
                  {s.resolutionImageUrl ? (
                    <Image
                      source={{ uri: s.resolutionImageUrl }}
                      style={styles.illustration}
                      resizeMode="contain"
                    />
                  ) : null}
                </>
              )}

            {s.resolutionText && !q
              ? primary('Practice questions', 'Writing your questions…', () => runStage('questions', () => getQuestions(s.id)), 'questions')
              : null}

            {q && !v ? (
              <>
                {(q.mcqs || []).map((m) => (
                  <View key={`m-${m.index}`} style={styles.qBlock}>
                    <Text style={styles.qText}>
                      {m.index + 1}. {m.questionText}
                    </Text>
                    {['A', 'B', 'C', 'D'].map((L) => {
                      const text = m[`option${L}`];
                      if (!text) return null;
                      const picked = mcqAnswers[m.index] === L;
                      return (
                        <Pressable
                          key={L}
                          onPress={() => setMcqAnswers((p) => ({ ...p, [m.index]: L }))}
                          style={({ pressed }) => [
                            styles.opt,
                            picked && styles.optPicked,
                            pressed && styles.pressed,
                          ]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: picked }}
                        >
                          <Text style={styles.optText}>
                            {L}. {text}
                          </Text>
                        </Pressable>
                      );
                    })}
                    {m.hint ? <Text style={styles.hint}>💡 {m.hint}</Text> : null}
                  </View>
                ))}

                {(q.freeText || []).map((f, i) => (
                  <View key={`f-${f.index}`} style={styles.qBlock}>
                    <Text style={styles.qText}>
                      {(q.mcqs || []).length + i + 1}. {f.questionText}
                    </Text>
                    <TextInput
                      value={ftAnswers[f.index] || ''}
                      onChangeText={(t) => setFtAnswers((p) => ({ ...p, [f.index]: t }))}
                      placeholder="Answer in 1-3 sentences…"
                      placeholderTextColor={SLATE[400]}
                      multiline
                      style={styles.input}
                    />
                  </View>
                ))}

                {primary('Submit answers', 'Grading your answers…', submitAnswers, 'verify')}
              </>
            ) : null}

            {v ? (
              <View style={styles.scoreBox}>
                <Text style={styles.score}>
                  Your score: {v.mcqScore}/2 MCQs · {v.freeTextScore}/30 written answers
                </Text>
                {(v.mcqResults || []).map((r) => (
                  <Text key={`mr-${r.index}`} style={styles.resultRow}>
                    {r.correct ? '✓' : '✗'} MCQ {r.index + 1}: you answered {r.yourAnswer || '—'}
                    {!r.correct ? ` — correct answer: ${r.correctAnswer}` : ''}
                  </Text>
                ))}
                {(v.freeTextResults || []).map((r) => (
                  <Text key={`fr-${r.index}`} style={styles.resultRow}>
                    ✍️ Q{r.index + 1}: {r.score}/10 — {r.feedback}
                  </Text>
                ))}
              </View>
            ) : null}
          </>,
        )}

        {stageCard(
          3,
          'Explore for Clarity',
          stage >= 3,
          s.exploreText ? (
            <DoubtText value={s.exploreText} />
          ) : (
            primary('I want to understand this better', 'Thinking it through…', () => runStage('explore', () => getExplore(s.id)), 'explore')
          ),
        )}

        {stageCard(
          4,
          'Detailed Solution',
          stage >= 4,
          s.solutionText ? (
            <DoubtText value={s.solutionText} />
          ) : (
            primary('Show the detailed solution', 'Writing the full solution…', () => runStage('solution', () => getSolution(s.id)), 'solution')
          ),
        )}

        <Pressable
          onPress={backHome}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>↩ Ask another doubt</Text>
        </Pressable>
      </>
    );
  };

  return (
    <Modal visible={!!visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.header}>
          <Ionicons name="camera" size={20} color="#ffffff" />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Doubt Resolution</Text>
            {topicName ? (
              <Text style={styles.headerTopic} numberOfLines={1}>
                {topicName}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={({ pressed }) => [pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={20} color="#ffffff" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {view === 'preview' ? renderPreview() : view === 'session' ? renderSession() : renderHome()}
        </ScrollView>

        {busy ? (
          <View style={styles.busyBar}>
            <ActivityIndicator size="small" color={NAVY.primary} />
            <Text style={styles.busyText}>This can take a minute — it’s worth the wait.</Text>
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const useStyles = makeStyles(() => ({
  safe: { flex: 1, backgroundColor: '#ffffff' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    backgroundColor: NAVY.primary,
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: TYPE.heading, fontWeight: '800', color: '#ffffff' },
  headerTopic: { fontSize: TYPE.caption, color: 'rgba(255,255,255,0.85)', marginTop: 1 },

  body: { padding: SPACING.md, paddingBottom: SPACING.xl },

  errorBanner: {
    backgroundColor: QUIZ.wrongBg,
    borderRadius: 10,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  errorText: { fontSize: TYPE.label, color: FEEDBACK.errorOnBg, lineHeight: 18 },

  intro: { fontSize: TYPE.body, color: SLATE[600], lineHeight: 20, marginBottom: SPACING.md },

  cards: { flexDirection: 'row', gap: 10, marginBottom: SPACING.lg },
  card: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: SLATE[400],
    backgroundColor: '#f8fafc',
  },
  cardTitle: { fontSize: TYPE.body, fontWeight: '700', color: NAVY.primary, textAlign: 'center' },
  cardDesc: { fontSize: TYPE.caption, color: SLATE[500], textAlign: 'center' },

  sectionTitle: {
    fontSize: TYPE.caption,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: SLATE[500],
    marginBottom: SPACING.sm,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: SLATE[200],
  },
  thumb: { width: 42, height: 42, borderRadius: 8, backgroundColor: SLATE[200] },
  thumbLarge: { width: '100%', height: 150, borderRadius: 10, marginBottom: SPACING.sm },
  historyBody: { flex: 1 },
  historyText: { fontSize: TYPE.label, color: SLATE[700], lineHeight: 18 },
  historyMeta: { fontSize: TYPE.caption, color: SLATE[400], marginTop: 2 },
  chip: {
    fontSize: TYPE.micro,
    fontWeight: '700',
    color: NAVY.primary,
    backgroundColor: NAVY.tint,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },

  preview: {
    width: '100%',
    height: 260,
    borderRadius: 12,
    backgroundColor: SLATE[100],
    marginBottom: SPACING.md,
  },
  warn: {
    backgroundColor: NAVY.warnBg,
    borderRadius: 10,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  warnText: { fontSize: TYPE.label, color: NAVY.warnFg, lineHeight: 19 },
  note: { fontSize: TYPE.caption, fontStyle: 'italic', color: SLATE[500], textAlign: 'center', marginTop: 6 },

  questionBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  questionLabel: { fontSize: TYPE.caption, fontWeight: '700', color: SLATE[500], marginBottom: 4 },
  questionText: { fontSize: TYPE.body, color: SLATE[800], lineHeight: 20 },

  stageCard: {
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 12,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  stageLocked: { opacity: 0.6 },
  stageHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: NAVY.tint,
  },
  stageNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NAVY.primary,
  },
  stageNumOff: { backgroundColor: SLATE[400] },
  stageNumText: { fontSize: TYPE.label, fontWeight: '700', color: '#ffffff' },
  stageTitle: { flex: 1, fontSize: TYPE.body, fontWeight: '700', color: NAVY.primary },
  lockNote: { fontSize: TYPE.micro, color: SLATE[500] },
  stageBody: { padding: SPACING.md },

  hint: { fontSize: TYPE.label, color: SLATE[500], lineHeight: 18, marginBottom: SPACING.sm },
  subLabel: { fontSize: TYPE.caption, fontWeight: '800', color: SLATE[500] },
  attempt: { fontSize: TYPE.body, color: SLATE[700], lineHeight: 19, marginBottom: SPACING.sm },
  feedback: { marginTop: 4 },

  input: {
    borderWidth: 1,
    borderColor: SLATE[300],
    borderRadius: 10,
    padding: 11,
    fontSize: TYPE.body,
    color: SLATE[800],
    minHeight: 84,
    textAlignVertical: 'top',
    marginBottom: SPACING.sm,
  },

  illustration: {
    width: '100%',
    height: 190,
    borderRadius: 10,
    marginTop: SPACING.sm,
    backgroundColor: SLATE[100],
  },

  qBlock: { marginTop: SPACING.md },
  qText: { fontSize: TYPE.body, fontWeight: '600', color: SLATE[800], lineHeight: 19, marginBottom: 6 },
  opt: {
    paddingVertical: 10,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: SLATE[100],
    marginBottom: 6,
  },
  optPicked: { borderColor: NAVY.accent, backgroundColor: NAVY.tint },
  optText: { fontSize: TYPE.body, color: SLATE[700], lineHeight: 19 },

  scoreBox: { marginTop: SPACING.md, backgroundColor: '#f8fafc', borderRadius: 10, padding: SPACING.sm },
  score: { fontSize: TYPE.body, fontWeight: '800', color: NAVY.primary, marginBottom: 6 },
  resultRow: { fontSize: TYPE.label, color: SLATE[600], lineHeight: 19, marginTop: 3 },

  primary: {
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: NAVY.primary,
    marginTop: SPACING.sm,
  },
  primaryOff: { backgroundColor: SLATE[300] },
  primaryText: { fontSize: TYPE.body, fontWeight: '700', color: '#ffffff' },
  secondary: {
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: SLATE[400],
    marginTop: SPACING.sm,
  },
  secondaryText: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[600] },

  busyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingVertical: 10,
    backgroundColor: NAVY.tint,
  },
  busyText: { fontSize: TYPE.label, fontWeight: '600', color: NAVY.primary },

  pressed: { opacity: 0.8 },
}));
