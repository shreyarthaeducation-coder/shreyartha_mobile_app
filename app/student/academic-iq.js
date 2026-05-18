import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { STUDENT } from '../../constants/theme';
import { studentService } from '../../services/studentService';
import { api } from '../../services/apiService';

const LEARNING_CATEGORIES = [
  { key: 'personalized', title: 'Personalized Resources', subtitle: 'Resources curated for your profile.', icon: '🧠' },
  { key: 'school', title: 'School Materials', subtitle: 'Complete curriculum resources.', icon: '📚' },
  { key: 'practice', title: 'Practice Zone', subtitle: 'Questions, scoring and revision practice.', icon: '📝' },
  { key: 'competitive', title: 'Competitive Exam', subtitle: 'Exam-ready preparation tracks.', icon: '🏆' },
];

const normalizeText = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const arr = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const unwrap = (value) => (value?.data && typeof value.data === 'object' ? value.data : value || {});

const classToken = (value) => {
  const match = String(value || '').match(/\d+/);
  return match ? match[0] : String(value || '').trim();
};

const chapterFromSubject = (subject) => arr(subject?.chapters || subject?.children || subject?.topics || subject?.items);
const topicFromChapter = (chapter) => arr(chapter?.topics || chapter?.children || chapter?.items || chapter?.lessons);

const nodeLabel = (node, fallback = '') => String(node?.name || node?.title || node?.label || fallback || '').trim();

const parseQuestionOptions = (question) => {
  const options = arr(question?.options || question?.choices || question?.answers || question?.answerOptions || question?.mcqOptions);
  if (options.length > 0) {
    return options.map((option, index) => {
      if (typeof option === 'string') {
        return { id: `${index}`, text: option, isCorrect: false };
      }
      return {
        id: String(option.id || option.optionId || option.key || index),
        text: option.text || option.label || option.option || option.value || `Option ${index + 1}`,
        isCorrect: Boolean(option.isCorrect || option.correct || option.answer === true),
      };
    });
  }
  const letters = ['A', 'B', 'C', 'D', 'E'];
  return letters
    .map((letter) => question?.[`option${letter}`])
    .filter(Boolean)
    .map((text, index) => ({ id: `${index}`, text: String(text), isCorrect: false }));
};

const isCorrectAnswer = (question, optionIndex) => {
  const options = parseQuestionOptions(question);
  if (options.some((option) => option.isCorrect)) {
    return Boolean(options[optionIndex]?.isCorrect);
  }
  const answerIndex =
    Number.isInteger(question?.correctOptionIndex)
      ? question.correctOptionIndex
      : Number.isInteger(question?.answerIndex)
        ? question.answerIndex
        : Number.isInteger(question?.correctAnswerIndex)
          ? question.correctAnswerIndex
          : null;
  if (answerIndex != null) return answerIndex === optionIndex;
  const answerText = normalizeText(question?.answer || question?.correctAnswer || question?.correctOption);
  if (!answerText) return false;
  return normalizeText(options[optionIndex]?.text) === answerText;
};

async function requestFirst(candidates) {
  let lastError;
  for (const candidate of candidates) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await candidate();
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) throw lastError;
  return null;
}

function CategoryCard({ item, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.85} style={styles.categoryCard} onPress={onPress}>
      <Text style={styles.categoryEmoji}>{item.icon}</Text>
      <Text style={styles.categoryTitle}>{item.title}</Text>
      <Text style={styles.categorySubtitle}>{item.subtitle}</Text>
    </TouchableOpacity>
  );
}

function SubjectTabs({ subjects, activeId, onSelect }) {
  return (
    <ScrollView horizontal style={styles.subjectTabsScroll} contentContainerStyle={styles.subjectTabsContent} showsHorizontalScrollIndicator={false}>
      {subjects.map((subject) => {
        const id = subject.id || nodeLabel(subject);
        const active = id === activeId;
        return (
          <TouchableOpacity key={String(id)} style={[styles.subjectPill, active && styles.subjectPillActive]} onPress={() => onSelect(subject)}>
            <Text style={[styles.subjectPillText, active && styles.subjectPillTextActive]}>{nodeLabel(subject, 'Subject')}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function NodeCard({ index, title, subtitle, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.nodeCard}>
      <View style={styles.nodeLeft}>
        {Number.isFinite(index) ? (
          <View style={styles.nodeNumberWrap}>
            <Text style={styles.nodeNumber}>{index + 1}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.nodeTitle}>{title}</Text>
          {subtitle ? <Text style={styles.nodeSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <Text style={styles.nodeChevron}>›</Text>
    </TouchableOpacity>
  );
}

function ContentViewer({ payload }) {
  const html = payload?.html || payload?.content || payload?.body || payload?.text || payload?.description;
  const links = arr(payload?.files || payload?.attachments || payload?.videos || payload?.urls || payload?.resources);
  return (
    <View style={styles.leafCard}>
      <Text style={styles.leafHeading}>Topic Content</Text>
      {html ? <Text style={styles.contentText}>{String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}</Text> : <Text style={styles.placeholderText}>No content is available for this topic yet.</Text>}
      {links.length > 0 ? (
        <View style={styles.linksWrap}>
          {links.map((item, index) => {
            const label = typeof item === 'string' ? item : item.title || item.name || item.url || `Resource ${index + 1}`;
            return (
              <View key={`${label}-${index}`} style={styles.linkChip}>
                <Text style={styles.linkChipText} numberOfLines={1}>{label}</Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function PracticeViewer({ questions, quizState, onPickOption, onSubmitOption, onNextQuestion, onRestart }) {
  if (!questions.length) {
    return (
      <View style={styles.leafCard}>
        <Text style={styles.leafHeading}>Practice Zone</Text>
        <Text style={styles.placeholderText}>No practice questions are currently available for this topic.</Text>
      </View>
    );
  }

  if (quizState.showResult) {
    return (
      <View style={styles.leafCard}>
        <Text style={styles.leafHeading}>Practice Results</Text>
        <Text style={styles.resultScore}>{`${quizState.score} / ${questions.length}`}</Text>
        <Text style={styles.placeholderText}>Great effort! Keep practicing to improve your score.</Text>
        <TouchableOpacity style={styles.actionButton} onPress={onRestart}>
          <Text style={styles.actionButtonText}>Retry Practice</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const question = questions[quizState.currentIndex];
  const options = parseQuestionOptions(question);
  return (
    <View style={styles.leafCard}>
      <Text style={styles.leafHeading}>{`Question ${quizState.currentIndex + 1} of ${questions.length}`}</Text>
      <Text style={styles.questionText}>{question?.questionText || question?.question || question?.text || 'Question'}</Text>
      <View style={styles.optionsWrap}>
        {options.map((option, index) => {
          const selected = quizState.selectedOption === index;
          const answered = quizState.submitted;
          const selectedWrong = answered && selected && !isCorrectAnswer(question, index);
          const selectedRight = answered && isCorrectAnswer(question, index);
          return (
            <Pressable
              key={option.id}
              onPress={() => onPickOption(index)}
              disabled={answered}
              style={[styles.optionCard, selected && styles.optionCardActive, selectedWrong && styles.optionWrong, selectedRight && styles.optionRight]}
            >
              <Text style={styles.optionText}>{option.text}</Text>
            </Pressable>
          );
        })}
      </View>
      {!quizState.submitted ? (
        <TouchableOpacity style={[styles.actionButton, quizState.selectedOption == null && styles.disabled]} disabled={quizState.selectedOption == null} onPress={onSubmitOption}>
          <Text style={styles.actionButtonText}>Submit Answer</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.actionButton} onPress={onNextQuestion}>
          <Text style={styles.actionButtonText}>{quizState.currentIndex + 1 >= questions.length ? 'View Result' : 'Next Question'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function AcademicIQLearningHub() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tree, setTree] = useState([]);
  const [academicProfile, setAcademicProfile] = useState({});
  const [examCategories, setExamCategories] = useState([]);
  const [hiddenExamIds, setHiddenExamIds] = useState([]);
  const [hiddenAcademicNodeIds, setHiddenAcademicNodeIds] = useState([]);

  const [view, setView] = useState('landing');
  const [activeCategory, setActiveCategory] = useState('personalized');
  const [activeSubjectId, setActiveSubjectId] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [leafLoading, setLeafLoading] = useState(false);
  const [topicPayload, setTopicPayload] = useState(null);
  const [topicQuestions, setTopicQuestions] = useState([]);
  const [quizState, setQuizState] = useState({ currentIndex: 0, selectedOption: null, submitted: false, score: 0, showResult: false });

  const [sheetVisible, setSheetVisible] = useState(false);
  const [selectedExamCategory, setSelectedExamCategory] = useState(null);
  const [selectedExam, setSelectedExam] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [treeRes, profileRes, examsRes, hiddenExamRes, hiddenAcademicRes] = await Promise.all([
        studentService.getAcademicIQTree().catch(() => ({})),
        studentService.getAcademicProfile().catch(() => ({})),
        studentService.getCompetitiveExams().catch(() => []),
        studentService.getStudentHiddenNodes('COMPETITIVE_EXAM').catch(() => []),
        studentService.getStudentHiddenNodes('ACADEMIC_IQ').catch(() => []),
      ]);
      const parsedTree = arr(unwrap(treeRes).curriculums || unwrap(treeRes).nodes || unwrap(treeRes).children || unwrap(treeRes));
      setTree(parsedTree);
      setAcademicProfile(unwrap(profileRes));
      setExamCategories(arr(unwrap(examsRes).exams || unwrap(examsRes)));
      setHiddenExamIds(arr(unwrap(hiddenExamRes).hiddenNodeIds || unwrap(hiddenExamRes)));
      setHiddenAcademicNodeIds(arr(unwrap(hiddenAcademicRes).hiddenNodeIds || unwrap(hiddenAcademicRes)));
    } catch (loadError) {
      setError(loadError?.message || 'Unable to load Academic IQ learning hub.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectedCurriculumNode = useMemo(() => {
    if (!tree.length) return null;
    return tree.find((node) => node.id === academicProfile?.curriculumId) || tree[0];
  }, [tree, academicProfile?.curriculumId]);

  const selectedClassNode = useMemo(() => {
    const classes = arr(selectedCurriculumNode?.classes || selectedCurriculumNode?.children);
    if (!classes.length) return null;
    return classes.find((node) => node.id === academicProfile?.classId)
      || classes.find((node) => classToken(nodeLabel(node)) === classToken(academicProfile?.classLabel || academicProfile?.className || academicProfile?.class))
      || classes[0];
  }, [selectedCurriculumNode, academicProfile?.classId, academicProfile?.classLabel, academicProfile?.className, academicProfile?.class]);

  const subjects = useMemo(() => {
    const all = arr(selectedClassNode?.subjects || selectedClassNode?.children)
      .filter((node) => !hiddenAcademicNodeIds.includes(node?.id));
    if (activeCategory !== 'personalized') return all;
    const selectedIds = new Set(arr(academicProfile?.challengingSubjectIds || academicProfile?.subjectIds));
    const selectedNames = new Set(arr(academicProfile?.challengingSubjects || academicProfile?.subjectNames).map((name) => normalizeText(name)));
    const filtered = all.filter((subject) => selectedIds.has(subject?.id) || selectedNames.has(normalizeText(nodeLabel(subject))));
    return filtered.length > 0 ? filtered : all;
  }, [selectedClassNode, hiddenAcademicNodeIds, activeCategory, academicProfile?.challengingSubjectIds, academicProfile?.subjectIds, academicProfile?.challengingSubjects, academicProfile?.subjectNames]);

  useEffect(() => {
    if (!subjects.length) {
      setActiveSubjectId(null);
      return;
    }
    if (!subjects.some((subject) => (subject.id || nodeLabel(subject)) === activeSubjectId)) {
      setActiveSubjectId(subjects[0].id || nodeLabel(subjects[0]));
      setSelectedChapter(null);
      setSelectedTopic(null);
      setTopicPayload(null);
      setTopicQuestions([]);
    }
  }, [subjects, activeSubjectId]);

  const activeSubject = useMemo(
    () => subjects.find((subject) => (subject.id || nodeLabel(subject)) === activeSubjectId) || null,
    [subjects, activeSubjectId],
  );

  const chapters = useMemo(() => {
    const all = chapterFromSubject(activeSubject).filter((node) => !hiddenAcademicNodeIds.includes(node?.id));
    if (activeCategory !== 'personalized') return all;
    const chapterMap = academicProfile?.chapters && typeof academicProfile.chapters === 'object' ? academicProfile.chapters : {};
    const allowedIds = new Set(Object.values(chapterMap).flatMap((entry) => arr(entry).map((value) => String(value))));
    if (allowedIds.size === 0) return all;
    const filtered = all.filter((chapter) => allowedIds.has(String(chapter?.id)) || allowedIds.has(nodeLabel(chapter)));
    return filtered.length > 0 ? filtered : all;
  }, [activeSubject, hiddenAcademicNodeIds, activeCategory, academicProfile?.chapters]);

  const topics = useMemo(() => {
    const all = topicFromChapter(selectedChapter).filter((node) => !hiddenAcademicNodeIds.includes(node?.id));
    if (activeCategory !== 'personalized') return all;
    const topicMap = academicProfile?.topics && typeof academicProfile.topics === 'object' ? academicProfile.topics : {};
    const allowedIds = new Set(Object.values(topicMap).flatMap((entry) => arr(entry).map((value) => String(value))));
    if (allowedIds.size === 0) return all;
    const filtered = all.filter((topic) => allowedIds.has(String(topic?.id)) || allowedIds.has(nodeLabel(topic)));
    return filtered.length > 0 ? filtered : all;
  }, [selectedChapter, hiddenAcademicNodeIds, activeCategory, academicProfile?.topics]);

  const openTopicLeaf = useCallback(async (topic) => {
    const topicId = topic?.id || topic?.topicId || topic?.slug || nodeLabel(topic);
    setSelectedTopic(topic);
    setLeafLoading(true);
    setError('');
    setTopicPayload(null);
    setTopicQuestions([]);
    setQuizState({ currentIndex: 0, selectedOption: null, submitted: false, score: 0, showResult: false });

    try {
      if (activeCategory === 'practice') {
        const questionData = await requestFirst([
          () => studentService.getTopicQuestions(topicId, activeCategory),
          () => api.get(`/api/academiciq/topics/${encodeURIComponent(topicId)}/questions`),
          () => api.get(`/api/students/practice/topics/${encodeURIComponent(topicId)}/questions`),
          () => api.get(`/api/practice/topics/${encodeURIComponent(topicId)}/questions`),
        ]);
        const parsedQuestions = arr(unwrap(questionData).questions || unwrap(questionData).items || unwrap(questionData));
        setTopicQuestions(parsedQuestions);
      } else {
        const contentData = await requestFirst([
          () => studentService.getTopicContent(topicId, activeCategory),
          () => api.get(`/api/academiciq/topics/${encodeURIComponent(topicId)}/content`),
          () => api.get(`/api/academiciq/topic/${encodeURIComponent(topicId)}`),
          () => api.get(`/api/students/resources/topics/${encodeURIComponent(topicId)}`),
          () => api.get(`/api/study/topics/${encodeURIComponent(topicId)}/content`),
        ]);
        setTopicPayload(unwrap(contentData));
      }
    } catch (topicError) {
      setError(topicError?.message || 'Unable to load topic details.');
    } finally {
      setLeafLoading(false);
    }
  }, [activeCategory]);

  const filteredExamCategories = useMemo(
    () => examCategories.filter((category) => !hiddenExamIds.includes(category?.id)),
    [examCategories, hiddenExamIds],
  );

  const examCategoryCards = useMemo(() => filteredExamCategories.map((category) => ({
    ...category,
    count: arr(category?.entranceExams || category?.exams || category?.children).length,
    title: nodeLabel(category, 'Exam Category'),
  })), [filteredExamCategories]);

  const activeExamItems = useMemo(
    () => arr(selectedExamCategory?.entranceExams || selectedExamCategory?.exams || selectedExamCategory?.children),
    [selectedExamCategory],
  );

  const examSubjects = useMemo(() => {
    if (!selectedExam) return [];
    const subjectsList = arr(selectedExam?.subjects || selectedExam?.subjectList || selectedExam?.papers || selectedExam?.children);
    if (subjectsList.length > 0) return subjectsList.map((item) => (typeof item === 'string' ? { name: item } : item));
    const examName = normalizeText(nodeLabel(selectedExam));
    if (examName.includes('jee') || examName.includes('engineering')) return [{ name: 'Physics' }, { name: 'Chemistry' }, { name: 'Mathematics' }];
    if (examName.includes('neet') || examName.includes('medical')) return [{ name: 'Physics' }, { name: 'Chemistry' }, { name: 'Biology' }];
    return [];
  }, [selectedExam]);

  const categoryTitle = LEARNING_CATEGORIES.find((item) => item.key === activeCategory)?.title || 'Academic IQ';

  const resetLearningStack = useCallback(() => {
    setSelectedChapter(null);
    setSelectedTopic(null);
    setTopicPayload(null);
    setTopicQuestions([]);
    setQuizState({ currentIndex: 0, selectedOption: null, submitted: false, score: 0, showResult: false });
  }, []);

  const openCategory = useCallback((key) => {
    if (key === 'competitive') {
      setView('competitive');
      return;
    }
    setActiveCategory(key);
    resetLearningStack();
    setView('learning');
  }, [resetLearningStack]);

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={STUDENT.accent} />
          <Text style={styles.mutedText}>Loading Academic IQ...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderLearningView = () => (
    <>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => { setView('landing'); resetLearningStack(); }}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{categoryTitle}</Text>
        <View style={styles.langChip}><Text style={styles.langText}>English ▾</Text></View>
      </View>

      <SubjectTabs
        subjects={subjects}
        activeId={activeSubjectId}
        onSelect={(subject) => {
          setActiveSubjectId(subject.id || nodeLabel(subject));
          resetLearningStack();
        }}
      />

      <View style={styles.sectionHeaderWrap}>
        <Text style={styles.sectionTitle}>{nodeLabel(activeSubject, 'Subject')}</Text>
      </View>

      {selectedTopic ? (
        leafLoading ? (
          <View style={styles.centerWrap}><ActivityIndicator size="small" color={STUDENT.accent} /></View>
        ) : activeCategory === 'practice' ? (
          <PracticeViewer
            questions={topicQuestions}
            quizState={quizState}
            onPickOption={(index) => setQuizState((prev) => ({ ...prev, selectedOption: index }))}
            onSubmitOption={() => {
              setQuizState((prev) => {
                const question = topicQuestions[prev.currentIndex];
                const correct = isCorrectAnswer(question, prev.selectedOption);
                return { ...prev, submitted: true, score: prev.score + (correct ? 1 : 0) };
              });
            }}
            onNextQuestion={() => {
              setQuizState((prev) => {
                if (prev.currentIndex + 1 >= topicQuestions.length) {
                  return { ...prev, showResult: true };
                }
                return {
                  ...prev,
                  currentIndex: prev.currentIndex + 1,
                  selectedOption: null,
                  submitted: false,
                };
              });
            }}
            onRestart={() => setQuizState({ currentIndex: 0, selectedOption: null, submitted: false, score: 0, showResult: false })}
          />
        ) : (
          <ContentViewer payload={topicPayload || {}} />
        )
      ) : selectedChapter ? (
        <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent}>
          <TouchableOpacity onPress={() => setSelectedChapter(null)}><Text style={styles.inlineBack}>← Chapters</Text></TouchableOpacity>
          {topics.length > 0 ? topics.map((topic, index) => (
            <NodeCard key={String(topic?.id || `${nodeLabel(topic)}-${index}`)} index={index} title={nodeLabel(topic, `Topic ${index + 1}`)} onPress={() => openTopicLeaf(topic)} />
          )) : <Text style={styles.placeholderText}>No topics available for this chapter.</Text>}
        </ScrollView>
      ) : (
        <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent}>
          {chapters.length > 0 ? chapters.map((chapter, index) => (
            <NodeCard
              key={String(chapter?.id || `${nodeLabel(chapter)}-${index}`)}
              index={index}
              title={nodeLabel(chapter, `Chapter ${index + 1}`)}
              subtitle={chapter?.description || chapter?.summary}
              onPress={() => setSelectedChapter(chapter)}
            />
          )) : <Text style={styles.placeholderText}>No chapters available for this subject.</Text>}
        </ScrollView>
      )}
    </>
  );

  const renderCompetitiveSelection = () => (
    <>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => setView('landing')}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Competitive Exam Selection</Text>
        <View style={styles.langChip}><Text style={styles.langText}>English ▾</Text></View>
      </View>
      <ScrollView style={styles.listScroll} contentContainerStyle={styles.gridContent}>
        {examCategoryCards.map((category) => (
          <TouchableOpacity
            key={String(category?.id || category.title)}
            style={styles.examCategoryCard}
            onPress={() => {
              setSelectedExamCategory(category);
              setSheetVisible(true);
            }}
          >
            <Text style={styles.examCardIcon}>🎯</Text>
            <Text style={styles.examCardTitle}>{category.title}</Text>
            <View style={styles.examCountPill}><Text style={styles.examCountText}>{`${category.count} Exams`}</Text></View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={sheetVisible} transparent animationType="slide" onRequestClose={() => setSheetVisible(false)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setSheetVisible(false)}>
          <Pressable style={styles.sheetCard}>
            <Text style={styles.sheetTitle}>{nodeLabel(selectedExamCategory, 'Exams')}</Text>
            <ScrollView style={{ maxHeight: 280 }}>
              {activeExamItems.map((exam, index) => {
                const locked = Boolean(exam?.locked || exam?.isLocked || hiddenExamIds.includes(exam?.id));
                return (
                  <TouchableOpacity
                    key={String(exam?.id || `${nodeLabel(exam)}-${index}`)}
                    style={[styles.sheetItem, locked && styles.sheetItemLocked]}
                    disabled={locked}
                    onPress={() => {
                      setSelectedExam(exam);
                      setSheetVisible(false);
                    }}
                  >
                    <Text style={styles.sheetItemText}>{nodeLabel(exam, `Exam ${index + 1}`)}</Text>
                    <Text style={styles.sheetItemIcon}>{locked ? '🔒' : '›'}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );

  const renderExamDetail = () => (
    <>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => setSelectedExam(null)}>
          <Text style={styles.backText}>{`← Back to ${nodeLabel(selectedExamCategory, 'Category')}`}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.analyticsPill} onPress={() => router.push('/student/academic')}>
          <Text style={styles.analyticsPillText}>My Analytics</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.examBanner}>
        <Text style={styles.examBannerTitle}>{nodeLabel(selectedExam, 'Exam')}</Text>
        <Text style={styles.examBannerSub}>{`Part of ${nodeLabel(selectedExamCategory, 'Category')}`}</Text>
      </View>

      <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent}>
        {examSubjects.length > 0 ? examSubjects.map((subject, index) => (
          <View key={`${nodeLabel(subject)}-${index}`} style={styles.examSubjectRow}>
            <Text style={styles.examSubjectText}>{nodeLabel(subject, `Subject ${index + 1}`)}</Text>
            <Text style={styles.nodeChevron}>›</Text>
          </View>
        )) : <Text style={styles.placeholderText}>Subject breakdown will appear when exam data is available.</Text>}

        <View style={styles.actionPanel}>
          <Text style={styles.actionPanelTitle}>Practice Zone</Text>
          <Text style={styles.actionPanelSub}>Chapter-wise and subject-wise exam practice.</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={async () => {
              try {
                const examId = selectedExam?.id || selectedExam?.examId;
                if (!examId) return;
                await requestFirst([
                  () => api.get(`/api/competitiveexam/exams/${encodeURIComponent(examId)}/practice-zone`),
                  () => api.get(`/api/competitiveexam/exams/${encodeURIComponent(examId)}/practice`),
                  () => studentService.getExamDetail(examId),
                ]);
              } catch {
                // Keep UI interactive while endpoint rollout is in progress.
              }
            }}
          >
            <Text style={styles.actionButtonText}>Open Practice Zone</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionPanel}>
          <Text style={styles.actionPanelTitle}>Mock Test</Text>
          <Text style={styles.actionPanelSub}>Full-length tests with analytics and score tracking.</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={async () => {
              try {
                const examId = selectedExam?.id || selectedExam?.examId;
                if (!examId) return;
                await requestFirst([
                  () => studentService.getExamMockTests(examId),
                  () => api.get(`/api/competitiveexam/exams/${encodeURIComponent(examId)}/mock-tests`),
                  () => api.get(`/api/competitiveexam/exams/${encodeURIComponent(examId)}/mocktest`),
                ]);
              } catch {
                // Keep UI interactive while endpoint rollout is in progress.
              }
            }}
          >
            <Text style={styles.actionButtonText}>Open Mock Tests</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      ) : null}

      {view === 'landing' ? (
        <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent}>
          <View style={styles.heroHeader}>
            <Text style={styles.heroTitle}>Academic IQ</Text>
            <Text style={styles.heroSub}>Choose a category to access your personalized learning resources.</Text>
          </View>
          <View style={styles.categoryGrid}>
            {LEARNING_CATEGORIES.map((item) => (
              <CategoryCard key={item.key} item={item} onPress={() => openCategory(item.key)} />
            ))}
          </View>
        </ScrollView>
      ) : view === 'learning' ? renderLearningView() : selectedExam ? renderExamDetail() : renderCompetitiveSelection()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: STUDENT.bg },
  heroHeader: { marginBottom: 16 },
  heroTitle: { color: STUDENT.textPrimary, fontSize: 28, fontWeight: '800' },
  heroSub: { color: STUDENT.textSecondary, marginTop: 6, lineHeight: 20 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  categoryCard: {
    width: '48.5%',
    minHeight: 150,
    borderRadius: 16,
    padding: 14,
    backgroundColor: STUDENT.bgCard,
    borderWidth: 1,
    borderColor: STUDENT.border,
  },
  categoryEmoji: { fontSize: 28 },
  categoryTitle: { color: STUDENT.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 8 },
  categorySubtitle: { color: STUDENT.textMuted, fontSize: 12, marginTop: 6, lineHeight: 17 },
  headerRow: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  backText: { color: STUDENT.accentCyan, fontWeight: '700', fontSize: 12 },
  headerTitle: { color: STUDENT.textPrimary, fontWeight: '700', fontSize: 14, flex: 1, textAlign: 'center' },
  langChip: { backgroundColor: STUDENT.bgCard, borderWidth: 1, borderColor: STUDENT.border, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  langText: { color: STUDENT.textPrimary, fontSize: 12 },
  subjectTabsScroll: { maxHeight: 52, borderTopWidth: 1, borderTopColor: STUDENT.border, borderBottomWidth: 1, borderBottomColor: STUDENT.border },
  subjectTabsContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  subjectPill: { backgroundColor: STUDENT.bgCard, borderRadius: 20, borderWidth: 1, borderColor: STUDENT.border, paddingVertical: 6, paddingHorizontal: 12 },
  subjectPillActive: { backgroundColor: STUDENT.accent, borderColor: STUDENT.accent },
  subjectPillText: { color: STUDENT.textSecondary, fontSize: 12, fontWeight: '600' },
  subjectPillTextActive: { color: '#fff' },
  sectionHeaderWrap: { paddingHorizontal: 16, paddingTop: 14 },
  sectionTitle: { color: STUDENT.textPrimary, fontSize: 18, fontWeight: '700' },
  listScroll: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingVertical: 14 },
  gridContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  nodeCard: {
    backgroundColor: STUDENT.bgCard,
    borderWidth: 1,
    borderColor: STUDENT.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nodeLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  nodeNumberWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(79,70,229,0.2)', alignItems: 'center', justifyContent: 'center' },
  nodeNumber: { color: STUDENT.textPrimary, fontWeight: '700' },
  nodeTitle: { color: STUDENT.textPrimary, fontSize: 14, fontWeight: '700' },
  nodeSubtitle: { color: STUDENT.textMuted, fontSize: 11, marginTop: 3 },
  nodeChevron: { color: STUDENT.textMuted, fontSize: 22, lineHeight: 22 },
  inlineBack: { color: STUDENT.accentCyan, marginBottom: 10, fontWeight: '700' },
  leafCard: { backgroundColor: STUDENT.bgCard, borderWidth: 1, borderColor: STUDENT.border, borderRadius: 14, padding: 14, marginHorizontal: 16, marginTop: 12 },
  leafHeading: { color: STUDENT.textPrimary, fontWeight: '700', fontSize: 16, marginBottom: 8 },
  contentText: { color: STUDENT.textSecondary, lineHeight: 20 },
  linksWrap: { marginTop: 10, gap: 8 },
  linkChip: { borderWidth: 1, borderColor: STUDENT.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: STUDENT.bgCardAlt },
  linkChipText: { color: STUDENT.textSecondary, fontSize: 12 },
  questionText: { color: STUDENT.textPrimary, lineHeight: 22, fontSize: 15, marginBottom: 10 },
  optionsWrap: { gap: 8 },
  optionCard: { borderWidth: 1, borderColor: STUDENT.border, borderRadius: 12, padding: 10, backgroundColor: STUDENT.bgCardAlt },
  optionCardActive: { borderColor: STUDENT.accent },
  optionWrong: { borderColor: STUDENT.accentRose, backgroundColor: 'rgba(244,63,94,0.12)' },
  optionRight: { borderColor: STUDENT.accentGreen, backgroundColor: 'rgba(16,185,129,0.12)' },
  optionText: { color: STUDENT.textSecondary },
  actionButton: { backgroundColor: STUDENT.accent, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', marginTop: 12 },
  actionButtonText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.5 },
  placeholderText: { color: STUDENT.textMuted, lineHeight: 19 },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  mutedText: { color: STUDENT.textMuted },
  resultScore: { color: STUDENT.accentGreen, fontSize: 28, fontWeight: '800' },
  errorBanner: { marginHorizontal: 16, marginTop: 12, marginBottom: 2, backgroundColor: 'rgba(244,63,94,0.18)', borderColor: 'rgba(244,63,94,0.35)', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  errorText: { color: '#fecdd3', fontSize: 12 },
  examCategoryCard: {
    width: '48.5%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: STUDENT.border,
    backgroundColor: STUDENT.bgCard,
    padding: 12,
    minHeight: 128,
  },
  examCardIcon: { fontSize: 22 },
  examCardTitle: { color: STUDENT.textPrimary, fontWeight: '700', marginTop: 8, fontSize: 13, lineHeight: 18 },
  examCountPill: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: 'rgba(79,70,229,0.22)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  examCountText: { color: STUDENT.accentCyan, fontSize: 11, fontWeight: '600' },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheetCard: { backgroundColor: '#0b1222', borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 24, borderTopWidth: 1, borderColor: STUDENT.border },
  sheetTitle: { color: STUDENT.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: STUDENT.border, backgroundColor: STUDENT.bgCard, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 8 },
  sheetItemLocked: { opacity: 0.5 },
  sheetItemText: { color: STUDENT.textPrimary, flex: 1, fontWeight: '600' },
  sheetItemIcon: { color: STUDENT.textMuted, fontSize: 18 },
  analyticsPill: { backgroundColor: STUDENT.accent, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  analyticsPillText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  examBanner: { marginHorizontal: 16, marginTop: 10, borderWidth: 1, borderColor: 'rgba(245,158,11,0.45)', backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 14, padding: 14 },
  examBannerTitle: { color: '#fbbf24', fontWeight: '800', fontSize: 18 },
  examBannerSub: { color: '#fde68a', marginTop: 5, fontSize: 12 },
  examSubjectRow: { borderWidth: 1, borderColor: STUDENT.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 8, backgroundColor: STUDENT.bgCard, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  examSubjectText: { color: STUDENT.textPrimary, fontWeight: '600' },
  actionPanel: { borderWidth: 1, borderColor: STUDENT.border, borderRadius: 14, backgroundColor: STUDENT.bgCard, padding: 14, marginTop: 10 },
  actionPanelTitle: { color: STUDENT.textPrimary, fontSize: 16, fontWeight: '700' },
  actionPanelSub: { color: STUDENT.textSecondary, marginTop: 5, lineHeight: 19 },
});
