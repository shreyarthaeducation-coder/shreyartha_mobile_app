import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DONE, FEEDBACK, QUIZ, SLATE, SPACING, TYPE, leading } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { EmptyState, GroupedBars, useToast } from '../../ui';
import RichText from '../../RichText';
import StudentScaffold from '../StudentScaffold';
import { StudentCard, StudentCardTitle, StudentNote } from '../StudentCard';
import LimitedAccessNote from '../LimitedAccessNote';
import AdaptiveRunner from './AdaptiveRunner';
import ShreyaSpeakButton from '../ai/ShreyaSpeakButton';
import MoreLikeThisButton from '../ai/MoreLikeThisButton';
import useStudentAccess from '../../../hooks/useStudentAccess';
import useAdaptiveSession from '../../../hooks/useAdaptiveSession';
import { ACCESS } from '../../../services/student/accessService';
import { shuffleArray } from '../../../utils/shuffle';
import { buildQuestionReadAloudText } from '../../../utils/readAloudText';
import { questionContextFromIndexed } from '../../../services/student/jyoraService';
import {
  normalizeBloomsLevel,
  masteryStatus,
  BLOOMS_LEVELS,
} from '../../../services/student/understandingScoring';
import {
  LEVEL_BLOOMS,
  LEVEL_LOCK_HINTS,
  PASS_MARK,
  PRACTICE_LEVELS,
  isLevelLocked,
  performanceRemark,
  practiceBloomsRemark,
  questionLevel,
} from '../../../constants/practiceZone';
import {
  fetchAcademicProfile,
  fetchPracticeProgress,
  fetchPracticeQuestions,
  fetchTree,
  fetchUniversalAvailability,
  resolveClassSubjects,
  savePracticeProgress,
  stopUniversalAttempt,
  universalAdaptiveEngine,
} from '../../../services/student/academicIqService';

/**
 * Practice Zone — practise a topic at three levels, then take the adaptive assessment.
 *
 * SCORING IS NOT THE UNDERSTANDING TEST'S. Answers are matched on `correctOptionIndex` (an INDEX),
 * there is no negative marking, and Bloom's counts only correct/total. Practice Zone also has its
 * own Bloom's remark table — 18 of its 24 strings match Skills Edge's and 6 do not, so the two are
 * kept apart deliberately (see constants/practiceZone.js).
 *
 * The Universal Adaptive assessment runs through `useAdaptiveSession` on its **'server' protocol**,
 * which means it gains the three guards the web version lacks — and, critically, that it does NOT
 * impose a client-side question cap. The server's attempt row owns the ladder and decides when the
 * pool is exhausted; the previous 15-question cap ended the test early and reported 0 correct,
 * because this engine returns flat counters rather than the `sessionState` the summary was being
 * built from.
 */

export default function PracticeZoneScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const { toast, showToast } = useToast();
  const gate = useStudentAccess('ACADEMIC_IQ');

  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [openSubject, setOpenSubject] = useState(null);
  const [openChapter, setOpenChapter] = useState(null);
  const [topic, setTopic] = useState(null);

  const [questions, setQuestions] = useState([]);
  const [progress, setProgress] = useState({});
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [level, setLevel] = useState('basic');
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(null);

  const [adaptiveOpen, setAdaptiveOpen] = useState(false);
  const [availability, setAvailability] = useState(null);
  const attemptIdRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [profileRes, treeRes] = await Promise.allSettled([fetchAcademicProfile(), fetchTree()]);
    const resolved = resolveClassSubjects(
      treeRes.status === 'fulfilled' ? treeRes.value : [],
      profileRes.status === 'fulfilled' ? profileRes.value : null,
    );
    if (resolved.error) {
      setError(resolved.error);
      setLoading(false);
      return;
    }
    setSubjects(resolved.subjects);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const adaptive = useAdaptiveSession({
    ...universalAdaptiveEngine(topic?.id, attemptIdRef),
    protocol: 'server', // no `total` — the server ends the run, not a client cap
  });

  const openTopic = async (t, subjectName, chapterName) => {
    if (gate.level('TOPIC', t.id) === ACCESS.LOCKED) {
      showToast('Upgrade your plan to practise this topic.', 'error');
      return;
    }
    setTopic({ ...t, subjectName, chapterName });
    setLevel('basic');
    setAnswers({});
    setScore(null);
    setAdaptiveOpen(false);
    setQuestionsLoading(true);

    // Questions are the point of the screen; progress and availability only decorate it.
    try {
      setQuestions(shuffleArray(await fetchPracticeQuestions(t.id)));
    } catch {
      setQuestions([]);
    } finally {
      setQuestionsLoading(false);
    }
    fetchPracticeProgress(t.id)
      .then((p) => setProgress(p || {}))
      .catch(() => setProgress({}));
    fetchUniversalAvailability(t.id)
      .then(setAvailability)
      .catch(() => setAvailability(null));
  };

  // The field is `difficulty` — see `questionLevel`. Reading `q.level`/`q.difficultyLevel` here is
  // what put the entire question bank in the Basic tab and left the other two permanently empty.
  const levelQuestions = questions.filter((q) => questionLevel(q) === level);

  const submit = async () => {
    let correct = 0;
    const blooms = {};
    BLOOMS_LEVELS.forEach((l) => {
      blooms[l] = { correct: 0, total: 0 };
    });

    levelQuestions.forEach((q) => {
      const bl = normalizeBloomsLevel(q.bloomsLevel);
      blooms[bl].total += 1;
      // INDEX comparison, not letter — Practice Zone's questions carry `correctOptionIndex`.
      if (answers[q.id] === q.correctOptionIndex) {
        correct += 1;
        blooms[bl].correct += 1;
      }
    });

    const percentage =
      levelQuestions.length > 0 ? Math.round((correct / levelQuestions.length) * 100) : 0;
    const percentages = {};
    BLOOMS_LEVELS.forEach((l) => {
      percentages[l] = blooms[l].total > 0 ? Math.round((blooms[l].correct / blooms[l].total) * 100) : 0;
    });

    setScore({ correct, total: levelQuestions.length, percentage, blooms, percentages });

    // Progress is a record, not a gate — a failed save must not cost the student their result.
    try {
      await savePracticeProgress(topic.id, {
        level,
        score: percentage,
        timestamp: new Date().toISOString(),
      });
      setProgress((prev) => ({ ...prev, [level]: { score: percentage, passed: percentage >= PASS_MARK } }));
    } catch {
      showToast('Your score is shown below, but we could not save it.', 'error');
    }
  };

  const leaveAdaptive = () => {
    // Tell the server the attempt is over; the local guards do not depend on it succeeding.
    if (attemptIdRef.current) stopUniversalAttempt(attemptIdRef.current).catch(() => {});
    adaptive.leave();
    setAdaptiveOpen(false);
  };

  /**
   * Stop the run but STAY and show the analysis — the web's `finishEarly`.
   *
   * `/stop` answers with the same `UniversalAdaptiveAnalysisResponse` the final `/answer` carries,
   * so a student who has had enough still gets their report. Leaving via the back arrow discards
   * it, which is the right behaviour for "I'm done with this" but the wrong one for "score me now".
   * `stoppedEarly` is set on the report, and the body says so, so partial coverage is never
   * presented as a complete picture.
   */
  const finishAdaptiveEarly = async () => {
    if (!attemptIdRef.current) return leaveAdaptive();
    try {
      const analysis = await stopUniversalAttempt(attemptIdRef.current);
      adaptive.finishWith(analysis);
    } catch (e) {
      showToast(e?.message || 'Could not finish the assessment.', 'error');
    }
    return undefined;
  };

  /* ── Bodies ──────────────────────────────────────────────────────────── */

  const renderQuestions = () => {
    if (questionsLoading) {
      return <ActivityIndicator size="large" color={palette.primary} style={styles.loader} />;
    }
    if (levelQuestions.length === 0) {
      return (
        <StudentCard>
          <StudentNote>No {level} questions for this topic yet.</StudentNote>
        </StudentCard>
      );
    }

    const remark = score ? performanceRemark(level, score.percentage) : null;
    // The two levels this DIFFICULTY reports on — not the levels the questions happened to carry.
    // See LEVEL_BLOOMS: deriving them from the data is a different chart from the website's.
    const used = score ? LEVEL_BLOOMS[level] || [] : [];

    return (
      <>
        {score ? (
          <StudentCard>
            <StudentCardTitle>Your score</StudentCardTitle>
            <Text style={styles.scoreValue}>
              {score.correct}
              <Text style={styles.scoreMax}>/{score.total}</Text>
            </Text>
            <Text style={[styles.scorePct, score.percentage >= PASS_MARK && styles.scorePass]}>
              {score.percentage}% {score.percentage >= PASS_MARK ? '· passed' : ''}
            </Text>
            {remark ? (
              <>
                <Text style={styles.remarkTitle}>{remark.title}</Text>
                <Text style={styles.remarkText}>{remark.message}</Text>
              </>
            ) : null}
            {/* My Learning Analysis — the web's Bloom's bar chart for this difficulty's two
                levels, then a mastery badge and remark per level beneath it. */}
            <Text style={styles.chartTitle}>My Learning Analysis</Text>
            <GroupedBars
              rows={used.map((l) => ({
                tag: l,
                percentage: score.percentages[l],
                correct: score.blooms[l].correct,
                total: score.blooms[l].total,
              }))}
              emptyMessage="No questions at this level yet."
            />

            {used.map((l) => (
              <View key={l} style={styles.bloom}>
                <View style={styles.rowHead}>
                  <Text style={styles.bloomName}>{l}</Text>
                  {/* Mastery 100 / Proficient ≥80 / Partial Readiness ≥50 / Critical Gap <50 —
                      the shared scorer's bands, identical to the web's. */}
                  <Text style={styles.mastery}>{masteryStatus(score.percentages[l])}</Text>
                </View>
                {/* Practice Zone's OWN remark table: 18 of its 24 strings match Skills Edge's and
                    6 do not. Never merge it with the other two Bloom's sets. */}
                <Text style={styles.bloomRemark}>{practiceBloomsRemark(l, score.percentages[l])}</Text>
              </View>
            ))}
            <Pressable
              onPress={() => {
                setAnswers({});
                setScore(null);
              }}
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryText}>Try again</Text>
            </Pressable>
          </StudentCard>
        ) : null}

        {levelQuestions.map((q, index) => (
          <StudentCard key={q.id}>
            <View style={styles.qHead}>
              <Text style={styles.qNum}>Question {index + 1}</Text>
              <ShreyaSpeakButton
                compact
                // Stem plus every option, so a student hears the whole question.
                text={buildQuestionReadAloudText(q.questionText, q.options)}
              />
            </View>

            {/* Practice Zone's questions are INDEXED (`options[]` + `correctOptionIndex`); the
                generator wants letters. `questionContextFromIndexed` is the same conversion the web
                does inline at three call sites. */}
            <MoreLikeThisButton
              questionContext={questionContextFromIndexed(q)}
              topicName={topic.name}
              subjectName={topic.subjectName}
              chapterName={topic.chapterName}
            />

            <RichText html={q.questionText} />
            {(q.options || []).map((text, i) => {
              const picked = answers[q.id] === i;
              const isCorrect = score && q.correctOptionIndex === i;
              const isWrong = score && picked && q.correctOptionIndex !== i;
              return (
                <Pressable
                  key={i}
                  onPress={() => !score && setAnswers((prev) => ({ ...prev, [q.id]: i }))}
                  disabled={!!score}
                  style={({ pressed }) => [
                    styles.option,
                    picked && styles.optionPicked,
                    isCorrect && styles.optionCorrect,
                    isWrong && styles.optionWrong,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: picked, disabled: !!score }}
                >
                  <Text style={styles.optionKey}>{String.fromCharCode(65 + i)}</Text>
                  <View style={styles.optionBody}>
                    <RichText html={String(text)} textStyle={styles.optionText} />
                  </View>
                </Pressable>
              );
            })}
          </StudentCard>
        ))}

        {!score ? (
          <Pressable
            onPress={submit}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>Check my answers</Text>
          </Pressable>
        ) : null}
      </>
    );
  };

  const renderTopic = () => {
    if (adaptiveOpen) {
      return (
        <AdaptiveRunner
          session={adaptive}
          title="Adaptive Assessment"
          subtitle={topic.name}
          onExit={leaveAdaptive}
          onFinishEarly={finishAdaptiveEarly}
        />
      );
    }

    return (
      <>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.levelRow}
        >
          {PRACTICE_LEVELS.map((l) => {
            const on = level === l.key;
            const done = progress[l.key];
            // Progressive unlock, as the web has it: Intermediate needs Basic ≥ 80, Advanced needs
            // Intermediate ≥ 80. A locked level stays visible so the student can see what is ahead.
            const locked = isLevelLocked(l.key, progress);
            return (
              <Pressable
                key={l.key}
                onPress={() => {
                  if (locked) {
                    showToast(LEVEL_LOCK_HINTS[l.key], 'error');
                    return;
                  }
                  setLevel(l.key);
                  setAnswers({});
                  setScore(null);
                }}
                style={({ pressed }) => [
                  styles.level,
                  on && styles.levelOn,
                  locked && styles.levelLocked,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: on, disabled: locked }}
                accessibilityHint={locked ? LEVEL_LOCK_HINTS[l.key] : undefined}
              >
                {locked ? (
                  <Ionicons name="lock-closed" size={12} color={SLATE[600]} />
                ) : null}
                <Text style={[styles.levelText, on && styles.levelTextOn]}>{l.label}</Text>
                {done?.passed ? (
                  <Ionicons name="checkmark-circle" size={15} color={on ? palette.onPrimary : DONE} />
                ) : null}
                {done ? (
                  <Text style={[styles.levelScore, on && styles.levelTextOn]}>{done.score}%</Text>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>

        {availability?.available !== false ? (
          <Pressable
            onPress={() => {
              setAdaptiveOpen(true);
              adaptive.begin();
            }}
            style={({ pressed }) => [styles.adaptiveBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Ionicons name="flash-outline" size={18} color={palette.onPrimary} />
            <Text style={styles.adaptiveText}>Take the adaptive assessment</Text>
          </Pressable>
        ) : null}

        {renderQuestions()}
      </>
    );
  };

  const visibleSubjects = gate.visible('SUBJECT', subjects);

  const renderTree = () =>
    visibleSubjects.length === 0 ? (
      <EmptyState
        icon="barbell-outline"
        title="Nothing to practise yet"
        message="No subjects have been published for your class yet."
      />
    ) : (
      visibleSubjects.map((subject) => {
        const subjectOpen = openSubject === subject.id;
        const chapters = gate.visible('CHAPTER', subject.chapters || []);
        return (
          <StudentCard key={subject.id}>
            <Pressable
              onPress={() => {
                setOpenSubject(subjectOpen ? null : subject.id);
                setOpenChapter(null);
              }}
              style={({ pressed }) => [styles.rowHead, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityState={{ expanded: subjectOpen }}
            >
              <Text style={styles.subjectName}>{subject.name}</Text>
              <Ionicons
                name={subjectOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={palette.deep}
              />
            </Pressable>

            {subjectOpen
              ? chapters.map((chapter) => {
                  const chapterOpen = openChapter === chapter.id;
                  const topics = gate.visible('TOPIC', chapter.topics || []);
                  return (
                    <View key={chapter.id} style={styles.chapter}>
                      <Pressable
                        onPress={() => setOpenChapter(chapterOpen ? null : chapter.id)}
                        style={({ pressed }) => [styles.rowHead, pressed && styles.pressed]}
                        accessibilityRole="button"
                      >
                        <Text style={styles.chapterName}>{chapter.name}</Text>
                        <Ionicons name={chapterOpen ? 'remove' : 'add'} size={17} color={SLATE[500]} />
                      </Pressable>
                      {chapterOpen
                        ? topics.map((t) => {
                            const locked = gate.level('TOPIC', t.id) === ACCESS.LOCKED;
                            return (
                              <Pressable
                                key={t.id}
                                onPress={() => openTopic(t, subject.name, chapter.name)}
                                style={({ pressed }) => [
                                  styles.topic,
                                  locked && styles.topicLocked,
                                  pressed && styles.pressed,
                                ]}
                                accessibilityRole="button"
                              >
                                <Ionicons
                                  name={locked ? 'lock-closed' : 'barbell-outline'}
                                  size={15}
                                  color={locked ? SLATE[400] : palette.deep}
                                />
                                <Text style={styles.topicName}>{t.name}</Text>
                              </Pressable>
                            );
                          })
                        : null}
                    </View>
                  );
                })
              : null}
          </StudentCard>
        );
      })
    );

  return (
    <StudentScaffold
      title="Practice Zone"
      loading={loading || gate.loading}
      error={error}
      onRetry={load}
      toast={toast}
    >
      {gate.limited && !gate.loading ? <LimitedAccessNote /> : null}

      {topic ? (
        <Pressable
          onPress={() => {
            if (adaptiveOpen) return leaveAdaptive();
            setTopic(null);
            setQuestions([]);
            setScore(null);
            return undefined;
          }}
          style={({ pressed }) => [styles.crumb, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={16} color={SLATE[600]} />
          <Text style={styles.crumbText} numberOfLines={1}>
            {[topic.subjectName, topic.chapterName, topic.name].filter(Boolean).join(' › ')}
          </Text>
        </Pressable>
      ) : null}

      {topic ? renderTopic() : renderTree()}
    </StudentScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  loader: { marginVertical: SPACING.xl },


  crumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: SLATE[200],
    marginBottom: SPACING.md,
  },
  crumbText: { flex: 1, fontSize: TYPE.label, fontWeight: '600', color: SLATE[600] },

  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  subjectName: { flex: 1, fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  chapter: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: SLATE[200],
  },
  chapterName: { flex: 1, fontSize: TYPE.body, fontWeight: '600', color: SLATE[700] },
  topic: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingLeft: 4 },
  topicLocked: { opacity: 0.55 },
  topicName: { flex: 1, fontSize: TYPE.label, color: SLATE[600] },

  levelRow: { gap: 7, paddingBottom: SPACING.md, paddingRight: SPACING.md },
  level: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 999,
    backgroundColor: SLATE[100],
    borderWidth: 1,
    borderColor: p.headerBorder,
  },
  levelOn: { backgroundColor: p.primary, borderColor: p.primary },
  levelLocked: { opacity: 0.5 },
  levelText: { fontSize: TYPE.label, fontWeight: '600', color: SLATE[600] },
  levelTextOn: { color: p.onPrimary },
  levelScore: { fontSize: TYPE.caption, fontWeight: '800', color: SLATE[600] },

  adaptiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: p.primaryDark,
    marginBottom: SPACING.md,
  },
  adaptiveText: { fontSize: TYPE.body, fontWeight: '700', color: '#ffffff' },

  qHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  qNum: { fontSize: TYPE.caption, fontWeight: '800', color: p.deep },
  option: {
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
  optionPicked: { backgroundColor: p.tint, borderColor: p.primary },
  optionCorrect: { backgroundColor: QUIZ.correctBg, borderColor: QUIZ.correctBorder },
  optionWrong: { backgroundColor: QUIZ.wrongBg, borderColor: QUIZ.wrongBorder },
  optionKey: { fontSize: TYPE.label, fontWeight: '800', color: SLATE[500], minWidth: 15 },
  optionBody: { flex: 1 },
  optionText: { fontSize: TYPE.body, color: SLATE[700], lineHeight: leading(TYPE.body) },

  scoreValue: { fontSize: TYPE.figure, fontWeight: '800', color: p.primaryDark, textAlign: 'center' },
  scoreMax: { fontSize: TYPE.title, fontWeight: '600', color: SLATE[500] },
  scorePct: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[500], textAlign: 'center' },
  scorePass: { color: FEEDBACK.successText },
  remarkTitle: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[800], marginTop: SPACING.sm },
  remarkText: { fontSize: TYPE.label, color: SLATE[600], lineHeight: leading(TYPE.label), marginTop: 3 },

  bloom: { marginTop: SPACING.md },
  bloomName: { flex: 1, fontSize: TYPE.label, fontWeight: '700', color: SLATE[800] },
  mastery: { fontSize: TYPE.caption, fontWeight: '800', color: p.deep },
  chartTitle: {
    fontSize: TYPE.caption,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: SLATE[500],
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  bloomPct: { fontSize: TYPE.caption, fontWeight: '600', color: SLATE[500] },
  track: {
    height: 7,
    borderRadius: 4,
    backgroundColor: SLATE[200],
    overflow: 'hidden',
    marginTop: 4,
  },
  fill: { height: '100%', borderRadius: 4, backgroundColor: p.primaryDark },
  bloomRemark: { fontSize: TYPE.caption, color: SLATE[500], lineHeight: leading(TYPE.caption), marginTop: 4 },

  primary: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: p.primary,
    marginBottom: SPACING.lg,
  },
  primaryText: { fontSize: TYPE.heading, fontWeight: '700', color: p.onPrimary },
  secondary: {
    alignSelf: 'center',
    marginTop: SPACING.md,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: p.tint,
  },
  secondaryText: { fontSize: TYPE.label, fontWeight: '700', color: p.deep },

  pressed: { opacity: 0.78 },
}));
