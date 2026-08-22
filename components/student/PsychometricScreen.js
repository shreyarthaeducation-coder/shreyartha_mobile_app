import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DONE, SLATE, SPACING, TYPE } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import { EmptyState, useToast } from '../ui';
import ShreyaSpeakButton from './ai/ShreyaSpeakButton';
import { buildQuestionReadAloudText } from '../../utils/readAloudText';
import RichText from '../RichText';
import StudentScaffold from './StudentScaffold';
import { StudentCard, StudentCardTitle, StudentNote } from './StudentCard';
import LimitedAccessNote from './LimitedAccessNote';
import PsychometricReport from './psychometric/PsychometricReport';
import useStudentAccess from '../../hooks/useStudentAccess';
import { ACCESS } from '../../services/student/accessService';
import {
  PSYCHOMETRIC_OPTIONS,
  getTopicType,
  processAssessmentResults,
} from '../../constants/psychometricScoring';
import {
  CLASS_ERRORS,
  fetchCompletedTopicIds,
  fetchEnabledTopicIds,
  fetchQuestions,
  fetchSavedAnswers,
  fetchTree,
  isCollegeStudent,
  resolveClassNode,
  submitAssessment,
} from '../../services/student/psychometricService';
import { fetchProfileSection } from '../../services/student/profileService';
import { downloadPsychometricPdf } from '../../utils/psychometricPdf';

/**
 * Psychometric Assessment.
 *
 * The student never picks a class — theirs is resolved against the tree by
 * `resolveClassNode` (see the service; the matching is by label and genuinely fiddly). From there:
 * chapter chips → topic list → questions → report.
 *
 * THREE GATES, and they are not interchangeable:
 *   1. hidden nodes        — removed from the tree entirely
 *   2. role access LOCKED  — chapters only, rendered with a lock (the upsell)
 *   3. counsellor enabled  — TOPICS only, and the only gate on topic content
 *
 * Gate 3 fails OPEN: `fetchEnabledTopicIds` resolves null when the endpoint is unavailable, which
 * means "show everything". A school that has never used the feature has no records, and treating
 * that as "nothing enabled" would lock every student out of every assessment.
 *
 * Shreya Speak wraps each question, as on the web. No Jyora and no question generator here — a
 * psychometric item has no right answer to explain or vary.
 */

export default function PsychometricScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const { toast, showToast } = useToast();
  const gate = useStudentAccess('PSYCHOMETRIC');

  const [classNode, setClassNode] = useState(null);
  const [studentInfo, setStudentInfo] = useState(null);
  const [enabledTopicIds, setEnabledTopicIds] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [chapter, setChapter] = useState(null);
  const [topic, setTopic] = useState(null);
  const [locked, setLocked] = useState(false);

  const [questions, setQuestions] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState(null);
  /** Topics with saved answers — drives the ticks in the list and the reopen path. */
  const [completedTopicIds, setCompletedTopicIds] = useState(new Set());
  /** True while showing a report rebuilt from saved answers rather than one just submitted. */
  const [reopened, setReopened] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    // Both profiles are optional individually — between them they must yield a class.
    const [studentRes, academicRes] = await Promise.allSettled([
      fetchProfileSection('personal'),
      fetchProfileSection('academic'),
    ]);
    const student = studentRes.status === 'fulfilled' ? studentRes.value : null;
    const academic = academicRes.status === 'fulfilled' ? academicRes.value : null;

    if (student) {
      setStudentInfo({
        name: student.fullName || student.name || 'Student',
        class: student.currentClass || student.class || 'N/A',
        school: student.schoolName || 'N/A',
        rollNo: student.rollNo || 'N/A',
      });
    }

    let tree = [];
    try {
      tree = await fetchTree();
    } catch (e) {
      setError(e?.message || 'Failed to load psychometric data.');
      setLoading(false);
      return;
    }

    const { node, reason } = resolveClassNode(tree, student, academic, isCollegeStudent(student));
    if (!node) {
      setError(CLASS_ERRORS[reason] || CLASS_ERRORS.NO_CONTENT);
      setLoading(false);
      return;
    }

    setClassNode(node);
    setChapter((node.chapters || [])[0] || null);
    // Both gates and the completion ticks resolve together; each fails soft on its own terms.
    const [enabled, completed] = await Promise.all([
      fetchEnabledTopicIds(),
      fetchCompletedTopicIds(),
    ]);
    setEnabledTopicIds(enabled);
    setCompletedTopicIds(completed);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** null means the counsellor gate is unavailable — treat every topic as open. */
  const isTopicEnabled = (topicId) =>
    enabledTopicIds === null ? true : enabledTopicIds.has(String(topicId));

  const pickChapter = (c) => {
    if (gate.level('CHAPTER', c.id) === ACCESS.LOCKED) {
      showToast('Upgrade your plan to open this section.', 'error');
      return;
    }
    setChapter(c);
    setTopic(null);
    setQuestions([]);
    setAnswers({});
    setResults(null);
    setLocked(false);
  };

  /**
   * Open a topic — as a fresh attempt, or as the student's saved one.
   *
   * REOPENING RESCORES, it does not read a stored report: the server keeps answers only, so the
   * report is rebuilt here through the same `processAssessmentResults` a live submit uses. That is
   * deliberate — a second, server-side scoring implementation would drift from this one.
   *
   * The saved answers are fetched only for a topic already known to be complete, and a topic with
   * saved answers but no questions left (an admin deleted them) falls back to a fresh attempt
   * rather than an empty report.
   */
  const pickTopic = async (t, { reopen = false } = {}) => {
    setTopic(t);
    setAnswers({});
    setResults(null);
    setQuestions([]);
    setReopened(false);

    if (!isTopicEnabled(t.id)) {
      setLocked(true);
      return;
    }
    setLocked(false);

    setQuestionsLoading(true);
    try {
      const fetched = await fetchQuestions(t.id);
      setQuestions(fetched);

      if (reopen && fetched.length) {
        const saved = await fetchSavedAnswers(t.id);
        if (Object.keys(saved).length) {
          setAnswers(saved);
          setResults(processAssessmentResults(fetched, saved, t.name));
          setReopened(true);
        }
      }
    } catch {
      setQuestions([]);
    } finally {
      setQuestionsLoading(false);
    }
  };

  const submit = () => {
    const unanswered = questions.length - Object.keys(answers).length;
    const go = () => {
      // Scored from the questions IN DISPLAY ORDER — the fallback category assignment depends on
      // it (see constants/psychometricScoring.js).
      const computed = processAssessmentResults(questions, answers, topic?.name);
      setResults(computed);
      setReopened(false);
      // FIRE AND FORGET, as the web does. The student has just answered every question; they see
      // their report whether or not this reaches the server.
      submitAssessment(topic?.id, answers, computed)
        .then(() => {
          // Only now is the topic genuinely reopenable — the tick means "there are saved answers",
          // so setting it optimistically would promise a reopen that returns nothing.
          setCompletedTopicIds((prev) => new Set(prev).add(String(topic?.id)));
        })
        .catch(() => {
          showToast('Your report is ready, but we could not save it. It may not appear in Analytics.', 'error');
        });
    };

    if (unanswered > 0) {
      Alert.alert(
        'Submit anyway?',
        `${unanswered} question${unanswered === 1 ? '' : 's'} still unanswered. Unanswered questions score zero.`,
        [
          { text: 'Keep answering', style: 'cancel' },
          { text: 'Submit', onPress: go },
        ],
      );
      return;
    }
    Alert.alert('Submit assessment?', 'You will see your report next.', [
      { text: 'Not yet', style: 'cancel' },
      { text: 'Submit', onPress: go },
    ]);
  };

  const retake = () => {
    setAnswers({});
    setResults(null);
    setReopened(false);
  };

  /**
   * The printable report — framework cover, then the student's results.
   *
   * `withCover: false` is NOT an error: the merge degrades to the report alone if the bundled
   * framework PDF cannot be read or merged, exactly as the website's does. Telling the student their
   * download failed when they have a perfectly good report would be the worse outcome, so the
   * cover's absence is mentioned and nothing more.
   */
  const downloadPdf = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const { shared, withCover } = await downloadPsychometricPdf({
        results,
        topicType: getTopicType(topic?.name),
        topicName: topic?.name,
        studentInfo,
      });
      if (!shared) {
        showToast('Your report was saved, but this device cannot open the share sheet.', 'error');
      } else if (!withCover) {
        showToast('Report ready. The framework cover could not be added.', 'info');
      }
    } catch (e) {
      showToast(e?.message || 'Could not create the report PDF.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const chapters = gate.visible('CHAPTER', classNode?.chapters || []);
  const topics = gate.visible('TOPIC', chapter?.topics || []);
  const answeredCount = Object.keys(answers).length;

  /* ── Body ────────────────────────────────────────────────────────────── */

  const body = () => {
    if (results) {
      return (
        <>
          {reopened ? (
            <StudentCard>
              <Text style={styles.rowSub}>
                Your saved report, rebuilt from the answers you gave last time. Retaking replaces
                them.
              </Text>
            </StudentCard>
          ) : null}
          <PsychometricReport
            results={results}
            topicType={getTopicType(topic?.name)}
            topicName={topic?.name}
            studentInfo={studentInfo}
          />
          <Pressable
            onPress={downloadPdf}
            disabled={downloading}
            style={({ pressed }) => [styles.download, pressed && styles.pressed, downloading && styles.disabled]}
            accessibilityRole="button"
          >
            {downloading ? (
              <ActivityIndicator size="small" color={palette.onPrimary} />
            ) : (
              <>
                <Ionicons name="download-outline" size={17} color={palette.onPrimary} />
                <Text style={styles.primaryText}>Download report</Text>
              </>
            )}
          </Pressable>
          <Pressable
            onPress={retake}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryText}>Retake this assessment</Text>
          </Pressable>
        </>
      );
    }

    if (!topic) {
      return topics.length === 0 ? (
        <StudentCard>
          <StudentNote>No assessments have been published in this section yet.</StudentNote>
        </StudentCard>
      ) : (
        topics.map((t) => {
          const open = isTopicEnabled(t.id);
          const done = completedTopicIds.has(String(t.id));
          return (
            <Pressable
              key={t.id}
              // A completed topic opens straight to its saved report; the student can still retake
              // it from there. An incomplete one starts a fresh attempt.
              onPress={() => pickTopic(t, { reopen: done })}
              style={({ pressed }) => [pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <StudentCard style={open ? undefined : styles.lockedCard}>
                <View style={styles.rowHead}>
                  {done ? (
                    <Ionicons name="checkmark-circle" size={17} color={DONE} />
                  ) : null}
                  <Text style={styles.rowTitle}>{t.name}</Text>
                  <Ionicons
                    name={open ? 'chevron-forward' : 'lock-closed'}
                    size={16}
                    color={open ? palette.deep : SLATE[400]}
                  />
                </View>
                {!open ? (
                  <Text style={styles.rowSub}>
                    Your counsellor has not opened this assessment yet.
                  </Text>
                ) : done ? (
                  <Text style={styles.rowSub}>Completed — tap to view your report.</Text>
                ) : null}
              </StudentCard>
            </Pressable>
          );
        })
      );
    }

    if (locked) {
      return (
        <EmptyState
          icon="lock-closed-outline"
          title="Not open yet"
          message="Your counsellor decides when each assessment becomes available. Check back once they have opened this one."
        />
      );
    }

    if (questionsLoading) {
      return <ActivityIndicator size="large" color={palette.primary} style={styles.loader} />;
    }

    if (questions.length === 0) {
      return (
        <StudentCard>
          <StudentNote>No questions have been added to this assessment yet.</StudentNote>
        </StudentCard>
      );
    }

    return (
      <>
        <StudentCard>
          <StudentCardTitle>{topic.name}</StudentCardTitle>
          <Text style={styles.progressText}>
            {answeredCount} of {questions.length} answered
          </Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${(answeredCount / questions.length) * 100}%` }]} />
          </View>
        </StudentCard>

        {questions.map((q, index) => (
          <StudentCard key={q.id}>
            <View style={styles.qHead}>
              <Text style={styles.qNum}>Question {index + 1}</Text>
              {/* Speak only — the website has read-aloud here but no Jyora and no question
                  generator, because a psychometric item has no right answer to explain or vary. */}
              <ShreyaSpeakButton
                compact
                text={buildQuestionReadAloudText(q.questionText, PSYCHOMETRIC_OPTIONS)}
              />
            </View>
            <RichText html={q.questionText} />
            <View style={styles.optionRow}>
              {PSYCHOMETRIC_OPTIONS.map((option) => {
                const on = answers[q.id] === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setAnswers((prev) => ({ ...prev, [q.id]: option }))}
                    style={({ pressed }) => [
                      styles.option,
                      on && styles.optionOn,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.optionText, on && styles.optionTextOn]}>{option}</Text>
                  </Pressable>
                );
              })}
            </View>
          </StudentCard>
        ))}

        <Pressable
          onPress={submit}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>See my report</Text>
        </Pressable>
      </>
    );
  };

  const back = () => {
    if (results) return setResults(null);
    if (topic) {
      setTopic(null);
      setQuestions([]);
      setAnswers({});
      setLocked(false);
      return;
    }
    return null;
  };

  return (
    <StudentScaffold
      title="Psychometric Assessment"
      loading={loading || gate.loading}
      error={error}
      onRetry={load}
      toast={toast}
    >
      {gate.limited && !gate.loading ? <LimitedAccessNote /> : null}

      {topic ? (
        <Pressable
          onPress={back}
          style={({ pressed }) => [styles.crumb, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={14} color={palette.onDark} />
          <Text style={styles.crumbText} numberOfLines={1}>
            {chapter?.name ? `${chapter.name} › ` : ''}
            {topic.name}
          </Text>
        </Pressable>
      ) : (
        chapters.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chapterRow}
          >
            {chapters.map((c) => {
              const on = chapter?.id === c.id;
              const isLocked = gate.level('CHAPTER', c.id) === ACCESS.LOCKED;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => pickChapter(c)}
                  style={({ pressed }) => [
                    styles.chapter,
                    on && styles.chapterOn,
                    isLocked && styles.chapterLocked,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                >
                  {isLocked ? (
                    <Ionicons name="lock-closed" size={11} color={SLATE[500]} />
                  ) : null}
                  <Text style={[styles.chapterText, on && styles.chapterTextOn]}>{c.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )
      )}

      {body()}
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
    backgroundColor: p.glass,
    borderWidth: 1,
    borderColor: p.glassBorder,
    marginBottom: SPACING.md,
  },
  crumbText: { flex: 1, fontSize: TYPE.label, fontWeight: '600', color: p.onDark },

  chapterRow: { gap: 7, paddingBottom: SPACING.md, paddingRight: SPACING.md },
  chapter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: p.headerBorder,
  },
  chapterOn: { backgroundColor: p.primary, borderColor: p.primary },
  chapterLocked: { opacity: 0.6 },
  chapterText: { fontSize: TYPE.label, fontWeight: '600', color: p.onDark },
  chapterTextOn: { color: p.onPrimary },

  rowHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  rowTitle: { flex: 1, fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  rowSub: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 4 },
  lockedCard: { opacity: 0.65 },

  progressText: { fontSize: TYPE.label, fontWeight: '600', color: SLATE[600], marginBottom: 6 },
  track: { height: 8, borderRadius: 4, backgroundColor: SLATE[200], overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: p.primaryDark },

  qHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  qNum: { fontSize: TYPE.caption, fontWeight: '800', color: p.deep },
  optionRow: { flexDirection: 'row', gap: 7, marginTop: SPACING.sm },
  option: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: SLATE[100],
    borderWidth: 1,
    borderColor: SLATE[200],
  },
  optionOn: { backgroundColor: p.primaryDark, borderColor: p.primaryDark },
  optionText: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[700] },
  optionTextOn: { color: '#ffffff' },

  primary: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: p.primary,
    marginBottom: SPACING.lg,
  },
  primaryText: { fontSize: TYPE.heading, fontWeight: '700', color: p.onPrimary },
  // Its own style rather than `primary`: the download button carries an icon beside its label, and
  // `primary` is the Submit button, which does not.
  download: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: p.primary,
    marginBottom: SPACING.sm,
  },
  disabled: { opacity: 0.6 },
  secondary: {
    alignSelf: 'center',
    marginBottom: SPACING.lg,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: p.tint,
  },
  secondaryText: { fontSize: TYPE.label, fontWeight: '700', color: p.deep },

  pressed: { opacity: 0.78 },
}));
