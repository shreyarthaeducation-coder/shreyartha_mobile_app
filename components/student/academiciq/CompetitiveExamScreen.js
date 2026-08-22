import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, QUIZ, SLATE, SPACING, TYPE } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { EmptyState, useToast } from '../../ui';
import RichText from '../../RichText';
import StudentScaffold from '../StudentScaffold';
import { StudentCard, StudentCardTitle, StudentNote } from '../StudentCard';
import { SOURCES } from '../../../services/student/doubtService';
import AiActionBar from '../ai/AiActionBar';
import LimitedAccessNote from '../LimitedAccessNote';
import UnderstandingTest from '../skillsedge/UnderstandingTest';
import AdaptiveRunner from './AdaptiveRunner';
import useStudentAccess from '../../../hooks/useStudentAccess';
import useAdaptiveSession from '../../../hooks/useAdaptiveSession';
import { ACCESS } from '../../../services/student/accessService';
import {
  EXAM_SECTIONS,
  adaptiveEngine,
  fetchCategories,
  fetchMockTestPapers,
  fetchMyExam,
  fetchPracticeQuestions,
  fetchSubjectTree,
  fetchTopicContent,
  fetchUnderstandingQuestions,
  markTopicComplete,
} from '../../../services/student/competitiveExamService';

/**
 * Competitive Exam — the largest single screen in the student panel.
 *
 * Catalogue → sub-exam → subjects → chapters → topics, then three sections over the chosen topic:
 * Resources · Practice · Mock Test.
 *
 * MOCK TEST IS PREMIUM. The web refuses the section outright when the student's access is limited
 * and shows the upgrade banner instead of firing a call that would 403. Gated the same way here.
 *
 * TAPPING THE ACTIVE SECTION COLLAPSES BACK TO RESOURCES — that is the web's toggle behaviour, not
 * an accident, so it is preserved.
 *
 * The adaptive assessment runs through `useAdaptiveSession`. On the web this particular engine has
 * none of the repeat-question guards despite using the same protocol as the one that needed them.
 */

const ADAPTIVE_TOTAL = 15;

export default function CompetitiveExamScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const { toast, showToast } = useToast();
  const gate = useStudentAccess('COMPETITIVE_EXAM');

  const [categories, setCategories] = useState([]);
  const [myExam, setMyExam] = useState(null);
  const [subExam, setSubExam] = useState(null);
  const [examName, setExamName] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [treeLoading, setTreeLoading] = useState(false);
  const [error, setError] = useState('');

  const [openSubject, setOpenSubject] = useState(null);
  const [openChapter, setOpenChapter] = useState(null);
  const [topic, setTopic] = useState(null);
  const [content, setContent] = useState(null);
  const [contentLoading, setContentLoading] = useState(false);

  const [section, setSection] = useState('resources');
  const [adaptiveOpen, setAdaptiveOpen] = useState(false);
  const [practice, setPractice] = useState([]);
  const [practiceAnswers, setPracticeAnswers] = useState({});
  const [practiceScore, setPracticeScore] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [catRes, mineRes] = await Promise.allSettled([fetchCategories(), fetchMyExam()]);

    if (catRes.status !== 'fulfilled') {
      setError('Could not load the exam catalogue.');
      setLoading(false);
      return;
    }
    setCategories(catRes.value);

    // Kept, not just read once: it is gate 1 — which exam the student chose, and which entrance
    // exams under it. A failure leaves it null, and `isEntranceExamAllowed` then falls open rather
    // than locking a student out of content they are entitled to because one call failed.
    const mine = mineRes.status === 'fulfilled' ? mineRes.value : null;
    setMyExam(mine);

    // If the student is already set up with an exam, open straight into it.
    if (mine?.hasExam && mine.examId) {
      const found = catRes.value
        .flatMap((c) => c.subExams || c.exams || [])
        .find((e) => String(e.id) === String(mine.examId));
      if (found) {
        setLoading(false);
        openSubExam(found);
        return;
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const adaptive = useAdaptiveSession({
    ...adaptiveEngine(topic?.id),
    total: ADAPTIVE_TOTAL,
  });

  async function openSubExam(exam) {
    setSubExam(exam);
    setTopic(null);
    setTreeLoading(true);
    try {
      const data = await fetchSubjectTree(exam.id);
      setExamName(data?.name || exam.name || '');
      setSubjects(data?.subjects || []);
    } catch {
      setSubjects([]);
      showToast('Could not load this exam’s syllabus.', 'error');
    } finally {
      setTreeLoading(false);
    }
    // Papers only decorate the Mock Test section — never let them fail the screen.
    fetchMockTestPapers(exam.id)
      .then(setPapers)
      .catch(() => setPapers([]));
  }

  const openTopic = async (t, subjectName, chapterName) => {
    if (gate.level('TOPIC', t.id) === ACCESS.LOCKED) {
      showToast('Upgrade your plan to open this topic.', 'error');
      return;
    }
    setTopic({ ...t, subjectName, chapterName });
    setSection('resources');
    setAdaptiveOpen(false);
    setPractice([]);
    setPracticeAnswers({});
    setPracticeScore(null);
    setContent(null);
    setContentLoading(true);
    try {
      setContent(await fetchTopicContent(t.id));
    } catch {
      setContent({});
    } finally {
      setContentLoading(false);
    }
  };

  /** The web's toggle: tapping the active section returns to Resources. */
  const chooseSection = async (key) => {
    if (key === 'mockTest' && gate.limited) return; // premium — refuse rather than 403
    if (section === key) {
      setSection('resources');
      return;
    }
    setSection(key);
    if (key === 'practiceZone' && practice.length === 0 && topic) {
      try {
        setPractice(await fetchPracticeQuestions(topic.id));
      } catch {
        setPractice([]);
      }
    }
  };

  const submitPractice = () => {
    let correct = 0;
    practice.forEach((q) => {
      if (practiceAnswers[q.id] === q.correctOptionIndex) correct += 1;
    });
    setPracticeScore({
      correct,
      total: practice.length,
      percentage: practice.length ? Math.round((correct / practice.length) * 100) : 0,
    });
  };

  const complete = async () => {
    try {
      await markTopicComplete(topic.id);
      showToast('Marked as complete.', 'success');
    } catch (e) {
      showToast(e?.message || 'Could not update your progress.', 'error');
    }
  };

  const openUrl = (url) => {
    if (url) Linking.openURL(url).catch(() => showToast('Could not open that link.', 'error'));
  };

  /* ── Bodies ──────────────────────────────────────────────────────────── */

  const renderResources = () => {
    if (contentLoading) {
      return <ActivityIndicator size="large" color={palette.primary} style={styles.loader} />;
    }
    const body = content?.content || content?.topicContent || content?.description;
    return (
      <>
        <StudentCard>
          <StudentCardTitle>{topic.name}</StudentCardTitle>

          {/* No board/class here — the Competitive Exam hierarchy is exam → sub-exam → subject →
              chapter → topic, and the web's call site omits both fields for the same reason. */}
          <AiActionBar
            contentLabel="Topic Content"
            doubtSource={SOURCES.COMPETITIVE}
            context={{
              subjectName: topic.subjectName,
              chapterName: topic.chapterName,
              topicName: topic.name,
              contentLabel: 'Topic Content',
              contentHtml: body || '',
            }}
          />

          {body ? (
            <RichText html={body} />
          ) : (
            <StudentNote>No resources have been added for this topic yet.</StudentNote>
          )}
          {content?.videoUrl ? (
            <Pressable
              onPress={() => openUrl(content.videoUrl)}
              style={({ pressed }) => [styles.mediaBtn, pressed && styles.pressed]}
            >
              <Ionicons name="videocam-outline" size={15} color={palette.deep} />
              <Text style={styles.mediaText}>Watch the video</Text>
            </Pressable>
          ) : null}
          {content?.pdfUrl ? (
            <Pressable
              onPress={() => openUrl(content.pdfUrl)}
              style={({ pressed }) => [styles.mediaBtn, pressed && styles.pressed]}
            >
              <Ionicons name="document-text-outline" size={15} color={palette.deep} />
              <Text style={styles.mediaText}>Open the PDF</Text>
            </Pressable>
          ) : null}
        </StudentCard>

        <UnderstandingTest
          key={`ce-${topic.id}`}
          moduleId={topic.id}
          loadQuestions={fetchUnderstandingQuestions}
          showToast={showToast}
          topicName={topic.name}
          subjectName={topic.subjectName}
          chapterName={topic.chapterName}
        />

        <Pressable
          onPress={complete}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>Mark this topic complete</Text>
        </Pressable>
      </>
    );
  };

  const renderPractice = () => {
    if (adaptiveOpen) {
      return (
        <AdaptiveRunner
          session={adaptive}
          title="Adaptive Assessment"
          subtitle={topic.name}
          onExit={() => {
            adaptive.leave();
            setAdaptiveOpen(false);
          }}
        />
      );
    }

    return (
      <>
        <Pressable
          onPress={() => {
            setAdaptiveOpen(true);
            adaptive.begin();
          }}
          style={({ pressed }) => [styles.adaptiveBtn, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Ionicons name="flash-outline" size={16} color="#ffffff" />
          <Text style={styles.adaptiveText}>Take the adaptive assessment</Text>
        </Pressable>

        {practiceScore ? (
          <StudentCard>
            <StudentCardTitle>Your score</StudentCardTitle>
            <Text style={styles.scoreValue}>
              {practiceScore.correct}
              <Text style={styles.scoreMax}>/{practiceScore.total}</Text>
            </Text>
            <Text style={styles.scorePct}>{practiceScore.percentage}%</Text>
            <Pressable
              onPress={() => {
                setPracticeAnswers({});
                setPracticeScore(null);
              }}
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryText}>Try again</Text>
            </Pressable>
          </StudentCard>
        ) : null}

        {practice.length === 0 ? (
          <StudentCard>
            <StudentNote>No practice questions for this topic yet.</StudentNote>
          </StudentCard>
        ) : (
          practice.map((q, index) => (
            <StudentCard key={q.id}>
              <Text style={styles.qNum}>Question {index + 1}</Text>
              <RichText html={q.questionText} />
              {(q.options || []).map((text, i) => {
                const picked = practiceAnswers[q.id] === i;
                const isCorrect = practiceScore && q.correctOptionIndex === i;
                const isWrong = practiceScore && picked && q.correctOptionIndex !== i;
                return (
                  <Pressable
                    key={i}
                    onPress={() =>
                      !practiceScore && setPracticeAnswers((prev) => ({ ...prev, [q.id]: i }))
                    }
                    disabled={!!practiceScore}
                    style={({ pressed }) => [
                      styles.option,
                      picked && styles.optionPicked,
                      isCorrect && styles.optionCorrect,
                      isWrong && styles.optionWrong,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.optionKey}>{String.fromCharCode(65 + i)}</Text>
                    <View style={styles.optionBody}>
                      <RichText html={String(text)} textStyle={styles.optionText} />
                    </View>
                  </Pressable>
                );
              })}
            </StudentCard>
          ))
        )}

        {practice.length > 0 && !practiceScore ? (
          <Pressable
            onPress={submitPractice}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>Check my answers</Text>
          </Pressable>
        ) : null}
      </>
    );
  };

  const renderMockTest = () =>
    gate.limited ? (
      <LimitedAccessNote />
    ) : papers.length === 0 ? (
      <StudentCard>
        <StudentNote>No mock test papers have been published for this exam yet.</StudentNote>
      </StudentCard>
    ) : (
      papers.map((paper) => (
        <StudentCard key={paper.id}>
          <View style={styles.rowHead}>
            <Text style={styles.paperName}>{paper.name || paper.title}</Text>
            <Ionicons name="chevron-forward" size={15} color={palette.deep} />
          </View>
          {paper.durationMinutes ? (
            <Text style={styles.paperMeta}>{paper.durationMinutes} minutes</Text>
          ) : null}
        </StudentCard>
      ))
    );

  /* ── Screen ──────────────────────────────────────────────────────────── */

  const visibleSubjects = gate.visible('SUBJECT', subjects);

  /**
   * GATE 1 of 4 — the student's own exam choice, from their Academic IQ profile.
   *
   * The other three (role-access, hidden-nodes, premium Mock Test) were already in place; this is
   * the one the student reported missing, and without it the entire catalogue is openable
   * regardless of what they chose.
   *
   * ── AN EMPTY `entranceExamIds` MEANS ALL ARE ALLOWED ─────────────────────────
   * The web's `isEntranceExamSelected` reads `(!ids?.length) ? true : ids.includes(id)`. That
   * branch is easy to invert into "none are allowed", which would lock a student out of the exam
   * they *did* choose simply because they never narrowed it to specific entrance exams. Getting
   * this backwards is worse than having no gate at all.
   *
   * Ids are compared as strings — the profile stores them in a CSV column, so a number/string
   * mismatch would silently lock everything.
   */
  const isEntranceExamAllowed = (examId) => {
    const ids = myExam?.entranceExamIds;
    if (!Array.isArray(ids) || ids.length === 0) return true;
    return ids.map(String).includes(String(examId));
  };

  const renderCatalogue = () =>
    categories.length === 0 ? (
      <EmptyState
        icon="trophy-outline"
        title="No exams yet"
        message="No competitive exams have been published yet."
      />
    ) : (
      <>
        {/* No exam chosen — the web's `ce-no-selection-warning`, with the route out. Without this
            the whole catalogue reads as locked for no stated reason. */}
        {!myExam?.hasExam ? (
          <StudentCard>
            <Text style={styles.warn}>
              You have not selected a competitive exam yet. Choose one in your Academic IQ profile
              to unlock its syllabus.
            </Text>
            <Pressable
              onPress={() => router.push('/student/profile')}
              style={({ pressed }) => [styles.warnLink, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.warnLinkText}>Open Profile Settings</Text>
              <Ionicons name="chevron-forward" size={14} color={palette.deep} />
            </Pressable>
          </StudentCard>
        ) : null}

        {categories.map((category) => (
          <StudentCard key={category.id}>
            <StudentCardTitle>{category.name}</StudentCardTitle>
            {(category.subExams || category.exams || []).map((exam) => {
              const allowed = isEntranceExamAllowed(exam.id);
              return (
                <Pressable
                  key={exam.id}
                  onPress={() => {
                    if (!allowed) {
                      showToast('This entrance exam is not selected in your profile.', 'error');
                      return;
                    }
                    openSubExam(exam);
                  }}
                  style={({ pressed }) => [
                    styles.examRow,
                    !allowed && styles.examLocked,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !allowed }}
                >
                  <Text style={styles.examName}>{exam.name}</Text>
                  <Ionicons
                    name={allowed ? 'chevron-forward' : 'lock-closed'}
                    size={15}
                    color={allowed ? palette.deep : SLATE[400]}
                  />
                </Pressable>
              );
            })}
          </StudentCard>
        ))}
      </>
    );

  const renderTree = () => {
    if (treeLoading) {
      return <ActivityIndicator size="large" color={palette.primary} style={styles.loader} />;
    }
    if (visibleSubjects.length === 0) {
      return (
        <StudentCard>
          <StudentNote>No syllabus has been published for this exam yet.</StudentNote>
        </StudentCard>
      );
    }
    return visibleSubjects.map((subject) => {
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
          >
            <Text style={styles.subjectName}>{subject.name}</Text>
            <Ionicons
              name={subjectOpen ? 'chevron-up' : 'chevron-down'}
              size={16}
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
                      <Ionicons name={chapterOpen ? 'remove' : 'add'} size={15} color={SLATE[500]} />
                    </Pressable>
                    {chapterOpen
                      ? topics.map((t) => (
                          <Pressable
                            key={t.id}
                            onPress={() => openTopic(t, subject.name, chapter.name)}
                            style={({ pressed }) => [styles.topic, pressed && styles.pressed]}
                            accessibilityRole="button"
                          >
                            <Ionicons name="document-text-outline" size={13} color={palette.deep} />
                            <Text style={styles.topicName}>{t.name}</Text>
                          </Pressable>
                        ))
                      : null}
                  </View>
                );
              })
            : null}
        </StudentCard>
      );
    });
  };

  const back = () => {
    if (adaptiveOpen) {
      adaptive.leave();
      setAdaptiveOpen(false);
      return;
    }
    if (topic) {
      setTopic(null);
      setContent(null);
      return;
    }
    if (subExam) {
      setSubExam(null);
      setSubjects([]);
      setPapers([]);
    }
  };

  return (
    <StudentScaffold
      title="Competitive Exam"
      loading={loading || gate.loading}
      error={error}
      onRetry={load}
      toast={toast}
    >
      {gate.limited && !gate.loading ? <LimitedAccessNote /> : null}

      {subExam ? (
        <Pressable
          onPress={back}
          style={({ pressed }) => [styles.crumb, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={14} color={palette.onDark} />
          <Text style={styles.crumbText} numberOfLines={1}>
            {[examName || subExam.name, topic?.subjectName, topic?.name].filter(Boolean).join(' › ')}
          </Text>
        </Pressable>
      ) : null}

      {topic ? (
        <>
          <View style={styles.sectionRow}>
            {EXAM_SECTIONS.map((s) => {
              const on = section === s.key;
              const blocked = s.premium && gate.limited;
              return (
                <Pressable
                  key={s.key}
                  onPress={() => chooseSection(s.key)}
                  disabled={blocked}
                  style={({ pressed }) => [
                    styles.section,
                    on && styles.sectionOn,
                    blocked && styles.sectionBlocked,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on, disabled: blocked }}
                >
                  {blocked ? <Ionicons name="lock-closed" size={11} color={SLATE[500]} /> : null}
                  <Text style={[styles.sectionText, on && styles.sectionTextOn]}>{s.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {section === 'practiceZone'
            ? renderPractice()
            : section === 'mockTest'
              ? renderMockTest()
              : renderResources()}
        </>
      ) : subExam ? (
        renderTree()
      ) : (
        renderCatalogue()
      )}
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

  examRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: SLATE[200],
  },
  examLocked: { opacity: 0.55 },
  warn: { fontSize: TYPE.body, color: FEEDBACK.warningOnBg, lineHeight: 20 },
  warnLink: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: SPACING.sm },
  warnLinkText: { fontSize: TYPE.label, fontWeight: '700', color: p.deep },
  examName: { flex: 1, fontSize: TYPE.body, fontWeight: '600', color: SLATE[700] },

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
  topicName: { flex: 1, fontSize: TYPE.label, color: SLATE[600] },

  sectionRow: { flexDirection: 'row', gap: 7, marginBottom: SPACING.md },
  section: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: p.headerBorder,
  },
  sectionOn: { backgroundColor: p.primary, borderColor: p.primary },
  sectionBlocked: { opacity: 0.55 },
  sectionText: { fontSize: TYPE.label, fontWeight: '600', color: p.onDark },
  sectionTextOn: { color: p.onPrimary },

  paperName: { flex: 1, fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  paperMeta: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 3 },

  mediaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: SPACING.sm,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: p.tint,
  },
  mediaText: { fontSize: TYPE.label, fontWeight: '600', color: p.deep },

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

  qNum: { fontSize: TYPE.caption, fontWeight: '800', color: p.deep, marginBottom: 4 },
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
  optionKey: { fontSize: TYPE.label, fontWeight: '800', color: SLATE[500], width: 15 },
  optionBody: { flex: 1 },
  optionText: { fontSize: TYPE.body, color: SLATE[700], lineHeight: 19 },

  scoreValue: { fontSize: TYPE.figure, fontWeight: '800', color: p.primaryDark, textAlign: 'center' },
  scoreMax: { fontSize: TYPE.title, fontWeight: '600', color: SLATE[400] },
  scorePct: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[500], textAlign: 'center' },

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
    marginBottom: SPACING.lg,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: p.tint,
  },
  secondaryText: { fontSize: TYPE.label, fontWeight: '700', color: p.deep },

  pressed: { opacity: 0.78 },
}));
