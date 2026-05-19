import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { STUDENT } from '../../constants/theme';
import RichText from '../../components/RichText';
import { studentService } from '../../services/studentService';

const LEARNING_CATEGORIES = [
  { key: 'personalized', title: 'Personalized Resources', subtitle: 'Resources curated for your profile.', icon: '🧠' },
  { key: 'school', title: 'School Resources', subtitle: 'Complete curriculum resources.', icon: '📚' },
  { key: 'practice', title: 'Practice Zone', subtitle: 'Questions, scoring and revision practice.', icon: '📝' },
  { key: 'competitive', title: 'Competitive Exam', subtitle: 'Exam-ready preparation tracks.', icon: '🏆' },
];
const LEVELS = ['Basic', 'Intermediate', 'Advanced'];
const REFLECTION_ACCENT = '#FBBF24';
const REFLECTION_CHOICES = [
  { key: 'Beginner', color: '#DC2626', backgroundColor: 'rgba(220,38,38,0.16)' },
  { key: 'Developing', color: '#D97706', backgroundColor: 'rgba(217,119,6,0.18)' },
  { key: 'Progressing', color: '#2563EB', backgroundColor: 'rgba(37,99,235,0.18)' },
  { key: 'Proficient', color: '#16A34A', backgroundColor: 'rgba(22,163,74,0.18)' },
];
const TOPIC_BASE_TABS = [
  { key: 'lessonPlan', label: 'Lesson Plan' },
  { key: 'topicExplanation', label: 'Topic Explanation' },
  { key: 'realLifeRelevance', label: 'Real-Life Relevance' },
  { key: 'handwrittenNotes', label: 'Handwritten Notes' },
  { key: 'importanceForBoard', label: 'Importance for Board' },
  { key: 'difficultConcept', label: 'Difficult Concepts' },
  { key: 'understanding', label: 'Test Your Understanding', accent: '#FACC15' },
  { key: 'reflection', label: 'My Reflection', accent: '#F59E0B' },
];
const arr = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const unwrap = (value) => (value?.data && typeof value.data === 'object' ? value.data : value || {});
const normalizeText = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const stripHtml = (value) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const classToken = (value) => {
  const match = String(value || '').match(/\d+/);
  return match ? match[0] : String(value || '').trim();
};
const nodeLabel = (node, fallback = '') => String(node?.name || node?.title || node?.label || fallback || '').trim();
const isProbablyUrl = (value) => /^https?:\/\//i.test(String(value || '').trim());
const chapterFromSubject = (subject) => arr(subject?.chapters || subject?.chapterList || subject?.children || subject?.items || subject?.units);
const topicFromChapter = (chapter) => arr(chapter?.topics || chapter?.children || chapter?.items || chapter?.lessons);
const topicFromExamSubject = (subject) => {
  const directTopics = arr(subject?.topics || subject?.children || subject?.items || subject?.lessons);
  if (directTopics.length) return directTopics;
  return chapterFromSubject(subject).flatMap((chapter) => topicFromChapter(chapter));
};
const getNodeId = (node, fallback = '') => String(
  node?.id
  || node?.topicId
  || node?.chapterId
  || node?.subjectId
  || node?.subExamId
  || node?.examId
  || node?.entranceExamId
  || node?.entranceExamSubjectId
  || node?.competitiveExamSubjectId
  || node?.competitiveExamId
  || node?.mockTestId
  || node?.nodeId
  || node?.topic_id
  || node?.subject_id
  || node?.exam_id
  || node?.test_id
  || node?.testId
  || node?.slug
  || fallback
  || nodeLabel(node)
).trim();
// Extracts a backend-safe identifier by checking known ID fields in priority order.
const getApiId = (node, keys = []) => {
  for (const key of keys) {
    const value = node?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
};
const emptyRunnerState = { index: 0, answers: {}, submitted: false, result: null };
const emptyReflectionState = {
  phase: 'idle',
  loading: false,
  error: '',
  question: null,
  sessionState: null,
  step: 0,
  history: [],
  selection: '',
  summary: null,
  reflectionChoice: '',
  submittedMessage: '',
};

function toMessage(error, fallback) {
  const fallbackMessage = fallback ?? 'Server error. Please try again.';
  const payload = error?.response?.data;
  return payload?.message || payload?.error || payload?.details || payload?.detail || error?.message || fallbackMessage;
}

function logApiError(context, error) {
  if (!__DEV__) return;
  const payload = error?.response?.data;
  console.error(`[AcademicIQ] ${context}`, {
    status: error?.response?.status || error?.status || null,
    message: payload?.message || payload?.error || payload?.details || payload?.detail || error?.message || 'Unknown error',
    payload,
  });
}

function shuffleArray(items) {
  const cloned = [...items];
  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [cloned[index], cloned[swapIndex]] = [cloned[swapIndex], cloned[index]];
  }
  return cloned;
}

function optionValue(option) {
  if (typeof option === 'string') return option;
  return option?.value || option?.text || option?.label || option?.option || '';
}

function normalizeQuestionOptions(question) {
  const options = arr(question?.options || question?.choices || question?.answers || question?.answerOptions || question?.mcqOptions);
  if (options.length > 0) {
    return options.map((option, index) => ({
      id: String(option?.id || option?.optionId || option?.key || index),
      text: optionValue(option) || `Option ${index + 1}`,
      isCorrect: Boolean(option?.isCorrect || option?.correct || option?.answer === true),
    }));
  }
  return ['optionA', 'optionB', 'optionC', 'optionD', 'optionE']
    .map((key, index) => ({ id: `${index}`, text: String(question?.[key] || '').trim(), isCorrect: false }))
    .filter((option) => option.text);
}

function resolveCorrectOptionIndex(question) {
  const explicitIndex =
    Number.isInteger(question?.correctOptionIndex) ? question.correctOptionIndex
      : Number.isInteger(question?.answerIndex) ? question.answerIndex
        : Number.isInteger(question?.correctAnswerIndex) ? question.correctAnswerIndex
          : null;
  if (explicitIndex !== null) return explicitIndex;

  const options = normalizeQuestionOptions(question);
  const flaggedIndex = options.findIndex((option) => option.isCorrect);
  if (flaggedIndex >= 0) return flaggedIndex;

  const answerToken = normalizeText(question?.correctAnswer || question?.answer || question?.correctOption || '');
  if (!answerToken) return -1;
  if (/^[a-e]$/.test(answerToken)) return answerToken.charCodeAt(0) - 97;
  return options.findIndex((option) => normalizeText(option.text) === answerToken);
}

function getAnswerStats(questions, answers, { marksMode = false } = {}) {
  let correct = 0;
  let wrong = 0;
  let unanswered = 0;
  let score = 0;
  let totalPossible = 0;

  questions.forEach((question, index) => {
    const questionId = String(question?.id ?? index);
    const selectedIndex = answers[questionId];
    const correctIndex = resolveCorrectOptionIndex(question);
    const marks = Number(question?.marks ?? 1) || 0;
    const negativeMarks = Number(question?.negativeMarks ?? 0) || 0;
    totalPossible += marksMode ? marks : 1;

    if (selectedIndex === undefined || selectedIndex === null) {
      unanswered += 1;
      return;
    }
    if (selectedIndex === correctIndex) {
      correct += 1;
      score += marksMode ? marks : 1;
      return;
    }
    wrong += 1;
    if (marksMode) score -= negativeMarks;
  });

  return { correct, wrong, unanswered, score: Math.max(0, score), totalPossible };
}


function normalizeDifficultyLevel(level) {
  return String(level || '').trim().toUpperCase();
}

function normalizeAssetItem(item, defaultType = 'link', fallbackLabel = 'Attachment') {
  if (!item) return null;
  if (typeof item === 'string') {
    return {
      label: isProbablyUrl(item) ? fallbackLabel : item,
      url: isProbablyUrl(item) ? item : '',
      type: defaultType,
      description: '',
    };
  }
  const url = String(item?.url || item?.link || item?.src || item?.fileUrl || item?.downloadUrl || '').trim();
  return {
    label: String(item?.title || item?.name || item?.label || item?.fileName || fallbackLabel).trim() || fallbackLabel,
    url,
    type: String(item?.type || item?.mimeType || item?.kind || item?.mediaType || defaultType).toLowerCase(),
    description: stripHtml(item?.description || item?.caption || ''),
  };
}

function collectTopicAssets(content) {
  const images = [...arr(content?.images), ...arr(content?.imageUrls), ...arr(content?.diagrams)]
    .map((item, index) => normalizeAssetItem(item, 'image', `Image ${index + 1}`)).filter(Boolean);
  const videos = [...arr(content?.videos), ...arr(content?.videoUrls), ...arr(content?.videoLinks)]
    .map((item, index) => normalizeAssetItem(item, 'video', `Video ${index + 1}`)).filter(Boolean);
  const pdfs = [...arr(content?.pdfs), ...arr(content?.pdfUrls), ...arr(content?.documents)]
    .map((item, index) => normalizeAssetItem(item, 'pdf', `PDF ${index + 1}`)).filter(Boolean);
  const noteAttachments = [
    ...arr(content?.handwrittenNoteFiles),
    ...arr(content?.handwrittenNotesFiles),
    ...arr(content?.handwrittenNotesAttachments),
    ...arr(content?.handwrittenNotes).filter((item) => typeof item !== 'string' || isProbablyUrl(item)),
  ].map((item, index) => normalizeAssetItem(item, 'pdf', `Handwritten Note ${index + 1}`)).filter(Boolean);
  return { images, videos, pdfs, noteAttachments };
}

function buildTopicTabs(content) {
  const assets = collectTopicAssets(content || {});
  const mediaTabs = [];
  if (assets.videos.length > 0) mediaTabs.push({ key: 'videos', label: 'Videos' });
  if (assets.images.length > 0) mediaTabs.push({ key: 'images', label: 'Images' });
  if (assets.pdfs.length > 0) mediaTabs.push({ key: 'pdfs', label: 'PDFs' });
  return [...TOPIC_BASE_TABS.slice(0, 6), ...mediaTabs, ...TOPIC_BASE_TABS.slice(6)];
}

function findFirstTopicIdInSubject(subject) {
  const chapters = chapterFromSubject(subject);
  for (const chapter of chapters) {
    const firstTopic = topicFromChapter(chapter)[0];
    if (firstTopic) return getNodeId(firstTopic);
  }
  const directTopic = topicFromExamSubject(subject)[0];
  return directTopic ? getNodeId(directTopic) : null;
}

function findChapterIdForTopic(subject, topicId) {
  const chapters = chapterFromSubject(subject);
  for (const chapter of chapters) {
    if (topicFromChapter(chapter).some((topic) => getNodeId(topic) === topicId)) return getNodeId(chapter);
  }
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

function SubjectTabs({ items, activeId, onSelect }) {
  return (
    <ScrollView horizontal style={styles.subjectTabsScroll} contentContainerStyle={styles.subjectTabsContent} showsHorizontalScrollIndicator={false}>
      {items.map((item) => {
        const id = getNodeId(item);
        const active = id === activeId;
        return (
          <TouchableOpacity key={id} style={[styles.subjectPill, active && styles.subjectPillActive]} onPress={() => onSelect(item)}>
            <Text style={[styles.subjectPillText, active && styles.subjectPillTextActive]}>{nodeLabel(item, 'Item')}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function TopicTabBar({ tabs, activeKey, onSelect }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subjectTabsScroll} contentContainerStyle={styles.tabScrollContent}>
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        const accent = tab.accent || STUDENT.accent;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.topicTab,
              active && { backgroundColor: accent, borderColor: accent },
              !active && tab.accent && { borderColor: `${accent}99`, backgroundColor: `${accent}22` },
            ]}
            onPress={() => onSelect(tab.key)}
          >
            <Text style={[styles.topicTabText, active && styles.topicTabTextActive, !active && tab.accent && { color: accent }]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
function NodeCard({ title, subtitle, index, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.nodeCard}>
      <View style={styles.nodeLeft}>
        {Number.isFinite(index) ? (
          <View style={styles.nodeNumberWrap}><Text style={styles.nodeNumber}>{index + 1}</Text></View>
        ) : null}
        <View style={styles.nodeContentWrap}>
          <Text style={styles.nodeTitle}>{title}</Text>
          {subtitle ? <Text style={styles.nodeSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <Text style={styles.nodeChevron}>›</Text>
    </TouchableOpacity>
  );
}

function InlineNotice({ tone = 'error', text }) {
  if (!text) return null;
  const toneStyles = tone === 'warning'
    ? { borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.12)', color: '#FCD34D' }
    : { borderColor: 'rgba(244,63,94,0.4)', backgroundColor: 'rgba(244,63,94,0.12)', color: '#FECDD3' };
  return (
    <View style={[styles.noticeCard, { borderColor: toneStyles.borderColor, backgroundColor: toneStyles.backgroundColor }]}>
      <Text style={[styles.noticeText, { color: toneStyles.color }]}>{text}</Text>
    </View>
  );
}

function EmptyStateCard({ title, description, actionLabel, onPress }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyCardTitle}>{title}</Text>
      <Text style={styles.emptyCardText}>{description}</Text>
      {actionLabel && onPress ? (
        <TouchableOpacity style={styles.actionButton} onPress={onPress}>
          <Text style={styles.actionButtonText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function LimitedAccessBanner() {
  return (
    <View style={styles.limitedBanner}>
      <Text style={styles.limitedBannerTitle}>Limited Access</Text>
      <Text style={styles.limitedBannerText}>Only the first topic in each subject is available for your current student access level.</Text>
    </View>
  );
}

function AttachmentGrid({ items, onPreview }) {
  if (!items.length) return <Text style={styles.placeholderText}>No media available for this tab yet.</Text>;
  return (
    <View style={styles.attachmentGrid}>
      {items.map((item, index) => (
        <TouchableOpacity key={`${item.label}-${index}`} style={styles.attachmentCard} onPress={() => onPreview(item)}>
          <Text style={styles.attachmentEmoji}>{item.type.includes('image') ? '��️' : item.type.includes('video') ? '🎬' : '📄'}</Text>
          <Text style={styles.attachmentTitle} numberOfLines={2}>{item.label}</Text>
          {item.description ? <Text style={styles.attachmentSubtitle} numberOfLines={2}>{item.description}</Text> : null}
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ContentCard({ title, body, attachments, onPreview }) {
  return (
    <View style={styles.contentCardDark}>
      <Text style={styles.contentCardTitle}>{title}</Text>
      {body ? <RichText html={body} textStyle={styles.contentBody} /> : <Text style={styles.placeholderText}>No content is available for this section yet.</Text>}
      {attachments?.length ? <AttachmentGrid items={attachments} onPreview={onPreview} /> : null}
    </View>
  );
}

function QuestionRunner({
  title,
  subtitle,
  questions,
  state,
  setState,
  onSubmit,
  emptyMessage,
  accentColor,
  progressFillStyle,
  scoreSuffix,
}) {
  if (!questions.length) {
    return (
      <View style={styles.contentCardDark}>
        <Text style={styles.contentCardTitle}>{title}</Text>
        <Text style={styles.placeholderText}>{emptyMessage}</Text>
      </View>
    );
  }

  if (state.submitted && state.result) {
    return (
      <View style={styles.contentCardDark}>
        <Text style={styles.contentCardTitle}>{title}</Text>
        <Text style={styles.resultScore}>{`${state.result.score}${scoreSuffix ? ` ${scoreSuffix}` : ''}`}</Text>
        <Text style={styles.resultSubtext}>{`Correct: ${state.result.correct} • Wrong: ${state.result.wrong} • Unanswered: ${state.result.unanswered}`}</Text>
        <TouchableOpacity style={[styles.actionButton, { marginTop: 14 }]} onPress={() => setState(emptyRunnerState)}>
          <Text style={styles.actionButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const question = questions[state.index];
  const questionId = String(question?.id ?? state.index);
  const options = normalizeQuestionOptions(question);
  const selectedIndex = state.answers[questionId];
  const progress = ((state.index + 1) / questions.length) * 100;

  return (
    <View style={styles.contentCardDark}>
      <Text style={styles.contentCardTitle}>{title}</Text>
      {subtitle ? <Text style={styles.contentSupportText}>{subtitle}</Text> : null}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, progressFillStyle || { backgroundColor: accentColor || STUDENT.accent }, { width: `${progress}%` }]} />
      </View>
      <View style={styles.questionMetaRow}>
        <Text style={styles.questionCountText}>{`Question ${state.index + 1} of ${questions.length}`}</Text>
        {question?.bloomsLevel ? <Text style={styles.metaPill}>{question.bloomsLevel}</Text> : null}
      </View>
      <RichText html={question?.questionText || question?.question || question?.text || ''} textStyle={styles.questionText} />
      <View style={styles.metaInfoWrap}>
        {question?.marks != null ? <Text style={styles.metaInfo}>{`Marks: ${question.marks}`}</Text> : null}
        {question?.negativeMarks != null ? <Text style={styles.metaInfo}>{`Negative: ${question.negativeMarks}`}</Text> : null}
      </View>
      {question?.hint ? <View style={styles.hintWrap}><Text style={styles.hintPrefix}>Hint:</Text><RichText html={question.hint} textStyle={styles.hintText} /></View> : null}
      <View style={styles.optionsWrap}>
        {options.map((option, index) => {
          const active = selectedIndex === index;
          return (
            <Pressable
              key={option.id}
              style={[styles.optionCard, active && { borderColor: accentColor || STUDENT.accent, backgroundColor: `${accentColor || STUDENT.accent}22` }]}
              onPress={() => setState((prev) => ({ ...prev, answers: { ...prev.answers, [questionId]: index } }))}
            >
              <Text style={[styles.mockOptionLabel, active && { color: accentColor || STUDENT.accent, borderColor: accentColor || STUDENT.accent }]}>{String.fromCharCode(65 + index)}</Text>
              <View style={styles.optionTextWrap}>{/* Required so RenderHTML can shrink within row alongside option label */}<RichText html={option.text} textStyle={styles.optionText} /></View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.mockNavRow}>
        <TouchableOpacity
          style={[styles.mockNavBtn, state.index === 0 && styles.disabled]}
          disabled={state.index === 0}
          onPress={() => setState((prev) => ({ ...prev, index: Math.max(0, prev.index - 1) }))}
        >
          <Text style={styles.mockNavBtnText}>← Prev</Text>
        </TouchableOpacity>
        {state.index < questions.length - 1 ? (
          <TouchableOpacity style={[styles.mockNavBtn, styles.mockNavBtnPrimary]} onPress={() => setState((prev) => ({ ...prev, index: prev.index + 1 }))}>
            <Text style={styles.actionButtonText}>Next →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.mockNavBtn, styles.mockNavBtnPrimary]} onPress={onSubmit}>
            <Text style={styles.actionButtonText}>Submit</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function MyReflectionPanel({ state, onStart, onAnswer, onChooseLevel, onSubmitLevel }) {
  if (state.loading) {
    return (
      <View style={styles.contentCardDark}>
        <ActivityIndicator color={REFLECTION_ACCENT} />
        <Text style={styles.mutedText}>Loading adaptive reflection…</Text>
      </View>
    );
  }

  if (state.phase === 'idle') {
    return (
      <View style={styles.contentCardDark}>
        <Text style={styles.contentCardTitle}>My Reflection</Text>
        <Text style={styles.contentBody}>Take the adaptive reflection test to review your understanding and self-assess your confidence level.</Text>
        <TouchableOpacity style={[styles.actionButton, { backgroundColor: REFLECTION_ACCENT }]} onPress={onStart}>
          <Text style={styles.actionButtonText}>Start Reflection Test</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (state.phase === 'testing') {
    const options = normalizeQuestionOptions(state.question || {});
    return (
      <View style={styles.contentCardDark}>
        <Text style={styles.contentCardTitle}>My Reflection</Text>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(((state.step || 1) / 12) * 100, 100)}%`, backgroundColor: REFLECTION_ACCENT }]} /></View>
        <Text style={styles.questionCountText}>{`Adaptive Question ${Math.min(state.step || 1, 12)} of 12`}</Text>
        <RichText html={state.question?.questionText || state.question?.question || state.question?.text || ''} textStyle={styles.questionText} />
        <View style={styles.optionsWrap}>
          {options.map((option, index) => {
            const value = optionValue(option);
            const selected = normalizeText(state.selection) === normalizeText(value);
            return (
              <Pressable key={`${value}-${index}`} style={[styles.optionCard, selected && { borderColor: REFLECTION_ACCENT, backgroundColor: 'rgba(251,191,36,0.15)' }]} onPress={() => onAnswer(option, index)}>
                <Text style={[styles.mockOptionLabel, selected && { color: REFLECTION_ACCENT, borderColor: REFLECTION_ACCENT }]}>{String.fromCharCode(65 + index)}</Text>
                <View style={styles.optionTextWrap}><RichText html={value} textStyle={styles.optionText} /></View>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  if (state.phase === 'summary') {
    return (
      <View style={styles.contentCardDark}>
        <Text style={styles.contentCardTitle}>Reflection Summary</Text>
        <Text style={styles.resultScore}>{String(state.summary?.score ?? state.summary?.correctAnswers ?? state.history?.length ?? 0)}</Text>
        <Text style={styles.resultSubtext}>{state.summary?.message || state.summary?.summary || 'Adaptive test complete. Choose the reflection level that best matches your confidence.'}</Text>
        {state.summary?.recommendedLevel ? <Text style={styles.contentSupportText}>{`Recommended Level: ${state.summary.recommendedLevel}`}</Text> : null}
        <View style={styles.reflectionChoicesWrap}>
          {REFLECTION_CHOICES.map((choice) => {
            const active = choice.key === state.reflectionChoice;
            return (
              <TouchableOpacity key={choice.key} style={[styles.reflectionChoice, { borderColor: choice.color, backgroundColor: active ? choice.backgroundColor : 'transparent' }]} onPress={() => onChooseLevel(choice.key)}>
                <Text style={[styles.reflectionChoiceTitle, { color: choice.color }]}>{choice.key}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity style={[styles.actionButton, { backgroundColor: REFLECTION_ACCENT }, !state.reflectionChoice && styles.disabled]} disabled={!state.reflectionChoice} onPress={onSubmitLevel}>
          <Text style={styles.actionButtonText}>Submit Reflection</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.contentCardDark}>
      <Text style={styles.contentCardTitle}>Reflection Submitted</Text>
      <Text style={styles.contentBody}>{state.submittedMessage || 'Your reflection level has been saved successfully.'}</Text>
    </View>
  );
}
function MockTestCard({ test, onPress }) {
  const questionCount = test?.totalQuestions ?? test?.questionsCount ?? arr(test?.questions).length ?? 0;
  const duration = test?.duration ?? test?.durationMinutes ?? 0;
  return (
    <TouchableOpacity style={styles.mockTestCard} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.mockTestCardTitle}>{nodeLabel(test, 'Mock Test')}</Text>
      <View style={styles.mockTestCardMeta}>
        {duration > 0 ? <View style={styles.mockTestMetaPill}><Text style={styles.mockTestMetaText}>⏱ {duration} min</Text></View> : null}
        {questionCount > 0 ? <View style={styles.mockTestMetaPill}><Text style={styles.mockTestMetaText}>📝 {questionCount} Qs</Text></View> : null}
      </View>
      {test?.description ? <RichText html={test.description} textStyle={styles.mockTestCardSub} numberOfLines={2} /> : null}
      <Text style={styles.mockTestStartText}>Start Test →</Text>
    </TouchableOpacity>
  );
}

function MockTestRunner({ questions, mockTest, onSubmit, onBack }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState({});
  const [showPalette, setShowPalette] = useState(false);
  const durationMins = mockTest?.duration ?? mockTest?.durationMinutes ?? 0;
  const [timeRemaining, setTimeRemaining] = useState(durationMins > 0 ? durationMins * 60 : null);
  const answersRef = useRef(answers);
  const onSubmitRef = useRef(onSubmit);

  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { onSubmitRef.current = onSubmit; }, [onSubmit]);
  useEffect(() => {
    if (timeRemaining === null) return undefined;
    if (timeRemaining <= 0) {
      onSubmitRef.current(answersRef.current);
      return undefined;
    }
    const id = setTimeout(() => setTimeRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(id);
  }, [timeRemaining]);

  if (!questions.length) {
    return <View style={styles.centerWrap}><Text style={styles.placeholderText}>No questions available for this mock test.</Text><TouchableOpacity style={[styles.actionButton, { marginTop: 16 }]} onPress={onBack}><Text style={styles.actionButtonText}>Go Back</Text></TouchableOpacity></View>;
  }

  const question = questions[currentIndex];
  const qId = String(question?.id ?? currentIndex);
  const options = normalizeQuestionOptions(question);
  const selectedOption = answers[qId];
  const isFlagged = Boolean(flagged[qId]);
  const formatTime = (secs) => `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.mockRunnerHeader}>
        <TouchableOpacity onPress={onBack}><Text style={styles.backText}>✕ Exit</Text></TouchableOpacity>
        <Text style={styles.mockRunnerTitle} numberOfLines={1}>{nodeLabel(mockTest, 'Mock Test')}</Text>
        {timeRemaining !== null ? <Text style={[styles.mockTimerText, timeRemaining < 300 && styles.mockTimerWarning]}>⏱ {formatTime(timeRemaining)}</Text> : <View style={{ width: 60 }} />}
      </View>
      <View style={styles.mockProgressWrap}>
        <Text style={styles.mockProgressText}>{`Q ${currentIndex + 1} / ${questions.length}`}</Text>
        <TouchableOpacity onPress={() => setShowPalette((value) => !value)} style={styles.paletteToggle}><Text style={styles.paletteToggleText}>Navigate ▾</Text></TouchableOpacity>
        <Text style={styles.mockAnsweredCount}>{`✓ ${Object.keys(answers).length}/${questions.length}`}</Text>
      </View>
      {showPalette ? (
        <View style={styles.paletteWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 8, gap: 6 }}>
            {questions.map((q, index) => {
              const qKey = String(q?.id ?? index);
              const answered = answers[qKey] !== undefined;
              const flaggedQuestion = Boolean(flagged[qKey]);
              const current = index === currentIndex;
              return (
                <TouchableOpacity key={qKey} onPress={() => { setCurrentIndex(index); setShowPalette(false); }} style={[styles.paletteDot, answered && styles.paletteDotAnswered, flaggedQuestion && styles.paletteDotFlagged, current && styles.paletteDotCurrent]}>
                  <Text style={styles.paletteDotText}>{index + 1}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
      <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent}>
        <View style={styles.mockQuestionHeader}>
          <Text style={styles.mockQLabel}>{`Question ${currentIndex + 1}`}</Text>
          <TouchableOpacity onPress={() => setFlagged((prev) => ({ ...prev, [qId]: !prev[qId] }))} style={[styles.flagButton, isFlagged && styles.flagButtonActive]}><Text style={styles.flagButtonText}>{isFlagged ? '🚩 Flagged' : '🏳️ Flag'}</Text></TouchableOpacity>
        </View>
        <RichText html={question?.questionText || question?.question || question?.text || ''} textStyle={styles.questionText} />
        <View style={styles.optionsWrap}>
          {options.map((option, index) => {
            const selected = selectedOption === index;
            return (
              <Pressable key={option.id} onPress={() => setAnswers((prev) => ({ ...prev, [qId]: index }))} style={[styles.optionCard, selected && styles.optionCardActive]}>
                <Text style={[styles.mockOptionLabel, selected && styles.mockOptionLabelActive]}>{String.fromCharCode(65 + index)}</Text>
                <View style={styles.optionTextWrap}><RichText html={option.text} textStyle={styles.optionText} /></View>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.mockNavRow}>
          {currentIndex > 0 ? <TouchableOpacity style={styles.mockNavBtn} onPress={() => setCurrentIndex((value) => value - 1)}><Text style={styles.mockNavBtnText}>← Prev</Text></TouchableOpacity> : <View style={styles.mockNavBtn} />}
          {currentIndex < questions.length - 1 ? <TouchableOpacity style={[styles.mockNavBtn, styles.mockNavBtnPrimary]} onPress={() => setCurrentIndex((value) => value + 1)}><Text style={styles.actionButtonText}>Save & Next →</Text></TouchableOpacity> : <TouchableOpacity style={[styles.mockNavBtn, styles.mockNavBtnPrimary]} onPress={() => onSubmit(answersRef.current)}><Text style={styles.actionButtonText}>Submit Test</Text></TouchableOpacity>}
        </View>
      </ScrollView>
    </View>
  );
}

export default function AcademicIQScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [screenError, setScreenError] = useState('');
  const [tree, setTree] = useState([]);
  const [studentProfile, setStudentProfile] = useState({});
  const [studentRole, setStudentRole] = useState('');
  const [academicProfile, setAcademicProfile] = useState({});
  const [examCategories, setExamCategories] = useState([]);
  const [hiddenExamIds, setHiddenExamIds] = useState([]);
  const [hiddenAcademicNodeIds, setHiddenAcademicNodeIds] = useState([]);
  const [view, setView] = useState('landing');
  const [activeCategory, setActiveCategory] = useState('personalized');
  const [activeSubjectId, setActiveSubjectId] = useState(null);
  const [selectedChapterId, setSelectedChapterId] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [activeTopicTab, setActiveTopicTab] = useState('lessonPlan');
  const [topicLoading, setTopicLoading] = useState(false);
  const [topicContent, setTopicContent] = useState(null);
  const [topicError, setTopicError] = useState('');
  const [previewAsset, setPreviewAsset] = useState(null);
  const [understandingLoading, setUnderstandingLoading] = useState(false);
  const [understandingError, setUnderstandingError] = useState('');
  const [understandingInfo, setUnderstandingInfo] = useState(null);
  const [understandingQuestions, setUnderstandingQuestions] = useState([]);
  const [understandingState, setUnderstandingState] = useState(emptyRunnerState);
  const [practiceDifficulty, setPracticeDifficulty] = useState('Basic');
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceError, setPracticeError] = useState('');
  const [practiceQuestions, setPracticeQuestions] = useState([]);
  const [practiceState, setPracticeState] = useState(emptyRunnerState);
  const [practiceProgress, setPracticeProgress] = useState({});
  const [reflectionState, setReflectionState] = useState(emptyReflectionState);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [selectedExamCategory, setSelectedExamCategory] = useState(null);
  const [selectedExam, setSelectedExam] = useState(null);
  const [examDetailError, setExamDetailError] = useState('');
  const [examSection, setExamSection] = useState('resources');
  const [selectedExamSubjectId, setSelectedExamSubjectId] = useState(null);
  const [practiceZoneSubjects, setPracticeZoneSubjects] = useState([]);
  const [practiceZoneSubjectsLoading, setPracticeZoneSubjectsLoading] = useState(false);
  const [practiceZoneSubjectsError, setPracticeZoneSubjectsError] = useState('');
  const [selectedExamTopic, setSelectedExamTopic] = useState(null);
  const [examActiveTab, setExamActiveTab] = useState('lessonPlan');
  const [examTopicLoading, setExamTopicLoading] = useState(false);
  const [examTopicContent, setExamTopicContent] = useState(null);
  const [examTopicError, setExamTopicError] = useState('');
  const [examPracticeDifficulty, setExamPracticeDifficulty] = useState('Basic');
  const [examPracticeLoading, setExamPracticeLoading] = useState(false);
  const [examPracticeError, setExamPracticeError] = useState('');
  const [examPracticeQuestions, setExamPracticeQuestions] = useState([]);
  const [examPracticeState, setExamPracticeState] = useState(emptyRunnerState);
  const [examPracticeProgress, setExamPracticeProgress] = useState({});
  const [mockTests, setMockTests] = useState([]);
  const [mockTestsPage, setMockTestsPage] = useState(1);
  const [mockTestsHasMore, setMockTestsHasMore] = useState(false);
  const [mockTestsLoading, setMockTestsLoading] = useState(false);
  const [mockTestsLoadingMore, setMockTestsLoadingMore] = useState(false);
  const [selectedMockTest, setSelectedMockTest] = useState(null);
  const [mockTestQuestions, setMockTestQuestions] = useState([]);
  const [mockTestLoading, setMockTestLoading] = useState(false);
  const [mockTestResults, setMockTestResults] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setScreenError('');
    try {
      const [treeRes, profileRes, examsRes, hiddenExamRes, hiddenAcademicRes, studentRes, storedRoles] = await Promise.all([
        studentService.getAcademicIQTree().catch(() => ({})),
        studentService.getAcademicProfile().catch(() => ({})),
        studentService.getCompetitiveExams().catch(() => []),
        studentService.getStudentHiddenNodes('COMPETITIVE_EXAM').catch(() => []),
        studentService.getStudentHiddenNodes('ACADEMIC_IQ').catch(() => []),
        studentService.getProfile().catch(() => ({})),
        AsyncStorage.multiGet(['studentRole', 'cachedStudentRole']).catch(() => []),
      ]);
      setTree(arr(unwrap(treeRes).curriculums || unwrap(treeRes).nodes || unwrap(treeRes).children || unwrap(treeRes)));
      setAcademicProfile(unwrap(profileRes));
      setExamCategories(arr(unwrap(examsRes).exams || unwrap(examsRes)));
      setHiddenExamIds(arr(unwrap(hiddenExamRes).hiddenNodeIds || unwrap(hiddenExamRes)).map(String));
      setHiddenAcademicNodeIds(arr(unwrap(hiddenAcademicRes).hiddenNodeIds || unwrap(hiddenAcademicRes)).map(String));
      setStudentProfile(unwrap(studentRes));
      setStudentRole(arr(storedRoles).map((entry) => entry?.[1]).find(Boolean) || '');
    } catch (error) {
      setScreenError(toMessage(error, 'Unable to load Academic IQ right now.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isSchoolStudent = useMemo(() => String(studentProfile?.studentType || academicProfile?.studentType || '').toUpperCase() === 'SCHOOL', [studentProfile?.studentType, academicProfile?.studentType]);
  const isLimitedStudent = useMemo(() => /limited/i.test(String(studentRole || studentProfile?.role || academicProfile?.role || '')), [studentRole, studentProfile?.role, academicProfile?.role]);
  const showLimitedAccess = isSchoolStudent || isLimitedStudent;
  const hasAcademicCurriculumClassSelection = useMemo(() => Boolean(academicProfile?.curriculumId && (academicProfile?.classId || academicProfile?.className || academicProfile?.class)), [academicProfile?.curriculumId, academicProfile?.classId, academicProfile?.className, academicProfile?.class]);

  // Determine the student's enrolled/selected competitive exam (best-effort from profile).
  // Falls back to null (no filter applied) if not found in the profile response.
  const enrolledCompetitiveExamId = useMemo(() => {
    const id = String(
      studentProfile?.competitiveExamId ||
      studentProfile?.selectedExamId ||
      studentProfile?.enrolledExamId ||
      studentProfile?.selectedCompetitiveExamId ||
      academicProfile?.competitiveExamId ||
      academicProfile?.selectedExamId ||
      ''
    ).trim();
    return id || null;
  }, [studentProfile, academicProfile]);
  const selectedCurriculumNode = useMemo(() => {
    if (!tree.length) return null;
    return tree.find((node) => String(node?.id) === String(academicProfile?.curriculumId)) || tree[0];
  }, [tree, academicProfile?.curriculumId]);

  const selectedClassNode = useMemo(() => {
    const classes = arr(selectedCurriculumNode?.classes || selectedCurriculumNode?.children);
    if (!classes.length) return null;
    return classes.find((node) => String(node?.id) === String(academicProfile?.classId))
      || classes.find((node) => classToken(nodeLabel(node)) === classToken(academicProfile?.classLabel || academicProfile?.className || academicProfile?.class || studentProfile?.currentClass))
      || classes[0];
  }, [selectedCurriculumNode, academicProfile?.classId, academicProfile?.classLabel, academicProfile?.className, academicProfile?.class, studentProfile?.currentClass]);

  const subjects = useMemo(() => {
    const all = arr(selectedClassNode?.subjects || selectedClassNode?.children).filter((node) => !hiddenAcademicNodeIds.includes(String(node?.id)));
    if (activeCategory !== 'personalized') return all;
    const selectedIds = new Set(arr(academicProfile?.challengingSubjectIds || academicProfile?.subjectIds).map(String));
    const selectedNames = new Set(arr(academicProfile?.challengingSubjects || academicProfile?.subjectNames).map((name) => normalizeText(name)));
    const filtered = all.filter((subject) => selectedIds.has(String(subject?.id)) || selectedNames.has(normalizeText(nodeLabel(subject))));
    return filtered.length ? filtered : all;
  }, [selectedClassNode, hiddenAcademicNodeIds, activeCategory, academicProfile?.challengingSubjectIds, academicProfile?.subjectIds, academicProfile?.challengingSubjects, academicProfile?.subjectNames]);

  useEffect(() => {
    if (!subjects.length) {
      setActiveSubjectId(null);
      return;
    }
    if (!subjects.some((subject) => getNodeId(subject) === activeSubjectId)) {
      setActiveSubjectId(getNodeId(subjects[0]));
      setSelectedChapterId(null);
      setSelectedTopic(null);
    }
  }, [subjects, activeSubjectId]);

  const activeSubject = useMemo(() => subjects.find((subject) => getNodeId(subject) === activeSubjectId) || null, [subjects, activeSubjectId]);
  const rawChapters = useMemo(() => {
    const all = chapterFromSubject(activeSubject).filter((node) => !hiddenAcademicNodeIds.includes(String(node?.id)));
    if (activeCategory !== 'personalized') return all;
    const chapterMap = academicProfile?.chapters && typeof academicProfile.chapters === 'object' ? academicProfile.chapters : {};
    const allowedIds = new Set(Object.values(chapterMap).flatMap((entry) => arr(entry).map((value) => String(value))));
    if (!allowedIds.size) return all;
    const filtered = all.filter((chapter) => allowedIds.has(String(chapter?.id)) || allowedIds.has(nodeLabel(chapter)));
    return filtered.length ? filtered : all;
  }, [activeSubject, hiddenAcademicNodeIds, activeCategory, academicProfile?.chapters]);
  const limitedAcademicTopicId = useMemo(() => (showLimitedAccess ? findFirstTopicIdInSubject(activeSubject) : null), [showLimitedAccess, activeSubject]);
  const chapters = useMemo(() => {
    if (!showLimitedAccess || !limitedAcademicTopicId) return rawChapters;
    const limitedChapterId = findChapterIdForTopic(activeSubject, limitedAcademicTopicId);
    return rawChapters.filter((chapter) => getNodeId(chapter) === limitedChapterId);
  }, [rawChapters, showLimitedAccess, limitedAcademicTopicId, activeSubject]);

  useEffect(() => {
    if (!chapters.length) {
      setSelectedChapterId(null);
      return;
    }
    if (!chapters.some((chapter) => getNodeId(chapter) === selectedChapterId)) {
      setSelectedChapterId(getNodeId(chapters[0]));
    }
  }, [chapters, selectedChapterId]);

  const selectedChapter = useMemo(() => chapters.find((chapter) => getNodeId(chapter) === selectedChapterId) || null, [chapters, selectedChapterId]);
  const topics = useMemo(() => {
    const all = topicFromChapter(selectedChapter).filter((node) => !hiddenAcademicNodeIds.includes(String(node?.id)));
    let filtered = all;
    if (activeCategory === 'personalized') {
      const topicMap = academicProfile?.topics && typeof academicProfile.topics === 'object' ? academicProfile.topics : {};
      const allowedIds = new Set(Object.values(topicMap).flatMap((entry) => arr(entry).map((value) => String(value))));
      if (allowedIds.size) {
        const matched = all.filter((topic) => allowedIds.has(String(topic?.id)) || allowedIds.has(nodeLabel(topic)));
        filtered = matched.length ? matched : all;
      }
    }
    if (showLimitedAccess && limitedAcademicTopicId) return filtered.filter((topic) => getNodeId(topic) === limitedAcademicTopicId);
    return filtered;
  }, [selectedChapter, hiddenAcademicNodeIds, activeCategory, academicProfile?.topics, showLimitedAccess, limitedAcademicTopicId]);

  const filteredExamCategories = useMemo(() => {
    const base = examCategories.filter((category) => !hiddenExamIds.includes(String(category?.id)));
    if (!enrolledCompetitiveExamId) return base;
    // Only show categories that contain the student's enrolled exam
    const withEnrolled = base.filter((category) =>
      arr(category?.entranceExams || category?.exams || category?.children)
        .some((exam) => String(getApiId(exam, ['subExamId', 'id', 'examId', 'entranceExamId', 'entranceExamSubjectId', 'competitiveExamSubjectId', 'competitiveExamId', 'exam_id']) || '') === enrolledCompetitiveExamId),
    );
    return withEnrolled.length ? withEnrolled : base;
  }, [examCategories, hiddenExamIds, enrolledCompetitiveExamId]);
  const examCategoryCards = useMemo(() => filteredExamCategories.map((category) => ({ ...category, count: arr(category?.entranceExams || category?.exams || category?.children).length, title: nodeLabel(category, 'Exam Category') })), [filteredExamCategories]);
  const activeExamItems = useMemo(() => {
    const all = arr(selectedExamCategory?.entranceExams || selectedExamCategory?.exams || selectedExamCategory?.children)
      .filter((item) => !hiddenExamIds.includes(String(item?.id)));
    if (!enrolledCompetitiveExamId) return all;
    const enrolled = all.filter((item) => String(getApiId(item, ['subExamId', 'id', 'examId', 'entranceExamId', 'entranceExamSubjectId', 'competitiveExamSubjectId', 'competitiveExamId', 'exam_id']) || '') === enrolledCompetitiveExamId);
    return enrolled.length ? enrolled : all;
  }, [selectedExamCategory, hiddenExamIds, enrolledCompetitiveExamId]);

  // When in practice section, prefer practice-zone subjects (loaded separately); fall back to exam detail subjects
  const examSubjects = useMemo(() => {
    const baseSubjects = examSection === 'practice' && practiceZoneSubjects.length
      ? practiceZoneSubjects
      : arr(selectedExam?.subjects || selectedExam?.subjectList || selectedExam?.papers || selectedExam?.children);
    return baseSubjects
      .map((item) => (typeof item === 'string' ? { name: item } : item))
      .filter((subject) => !hiddenExamIds.includes(String(subject?.id)));
  }, [selectedExam, hiddenExamIds, examSection, practiceZoneSubjects]);

  // Load practice zone subjects when user enters the practice section
  useEffect(() => {
    if (examSection !== 'practice') return;
    const examId = getApiId(selectedExam, ['subExamId', 'id', 'examId', 'entranceExamId', 'entranceExamSubjectId', 'competitiveExamSubjectId', 'competitiveExamId', 'exam_id']) || getNodeId(selectedExam);
    // Only load if we haven't loaded yet and have no error; errors require a manual Retry
    if (!examId || practiceZoneSubjectsLoading) return;
    if (practiceZoneSubjects.length > 0 || practiceZoneSubjectsError) return;
    loadPracticeZoneSubjects(examId);
  }, [examSection, selectedExam, practiceZoneSubjects.length, practiceZoneSubjectsLoading, practiceZoneSubjectsError, loadPracticeZoneSubjects]);

  useEffect(() => {
    if (!examSubjects.length) {
      setSelectedExamSubjectId(null);
      return;
    }
    if (!examSubjects.some((subject) => getNodeId(subject) === selectedExamSubjectId)) {
      setSelectedExamSubjectId(getNodeId(examSubjects[0]));
      setSelectedExamTopic(null);
    }
  }, [examSubjects, selectedExamSubjectId]);

  const activeExamSubject = useMemo(() => examSubjects.find((subject) => getNodeId(subject) === selectedExamSubjectId) || null, [examSubjects, selectedExamSubjectId]);
  const limitedExamTopicId = useMemo(() => (showLimitedAccess ? findFirstTopicIdInSubject(activeExamSubject) : null), [showLimitedAccess, activeExamSubject]);
  const examTopics = useMemo(() => {
    const all = topicFromExamSubject(activeExamSubject).filter((node) => !hiddenExamIds.includes(String(node?.id)));
    if (showLimitedAccess && limitedExamTopicId) return all.filter((topic) => getNodeId(topic) === limitedExamTopicId);
    return all;
  }, [activeExamSubject, hiddenExamIds, showLimitedAccess, limitedExamTopicId]);

  const resetLearningTopicState = useCallback(() => {
    setSelectedTopic(null);
    setActiveTopicTab('lessonPlan');
    setTopicContent(null);
    setTopicError('');
    setUnderstandingInfo(null);
    setUnderstandingQuestions([]);
    setUnderstandingError('');
    setUnderstandingState(emptyRunnerState);
    setPracticeQuestions([]);
    setPracticeError('');
    setPracticeState(emptyRunnerState);
    setReflectionState(emptyReflectionState);
  }, []);

  const resetExamTopicState = useCallback(() => {
    setSelectedExamTopic(null);
    setExamActiveTab('lessonPlan');
    setExamTopicContent(null);
    setExamTopicError('');
    setExamPracticeQuestions([]);
    setExamPracticeError('');
    setExamPracticeState(emptyRunnerState);
  }, []);

  const loadPracticeZoneSubjects = useCallback(async (examId) => {
    if (!examId) return;
    setPracticeZoneSubjectsLoading(true);
    setPracticeZoneSubjectsError('');
    try {
      const response = await studentService.getExamSubjectTree(examId);
      const payload = unwrap(response);
      const subjects = arr(payload?.subjects || payload?.subjectList || payload?.papers || payload?.children || payload?.content || payload);
      setPracticeZoneSubjects(subjects);
    } catch (error) {
      logApiError('Competitive Exam practice subjects failed', error);
      setPracticeZoneSubjects([]);
      const status = error?.response?.status || error?.status;
      if (status === 401 || status === 403) {
        setPracticeZoneSubjectsError('Session expired. Please log in again.');
      } else if (status === 404) {
        setPracticeZoneSubjectsError('No practice zone subjects found for this exam.');
      } else {
        setPracticeZoneSubjectsError(toMessage(error, 'Unable to load subjects. Please try again.'));
      }
    } finally {
      setPracticeZoneSubjectsLoading(false);
    }
  }, []);

  const openCategory = useCallback((key) => {
    if (key === 'competitive') {
      setView('competitive');
      return;
    }
    setActiveCategory(key);
    setView('learning');
    setSelectedChapterId(null);
    resetLearningTopicState();
  }, [resetLearningTopicState]);

  const openTopic = useCallback((topic) => {
    setSelectedTopic(topic);
    setActiveTopicTab('lessonPlan');
    setUnderstandingInfo(null);
    setUnderstandingQuestions([]);
    setUnderstandingError('');
    setUnderstandingState(emptyRunnerState);
    setPracticeQuestions([]);
    setPracticeError('');
    setPracticeState(emptyRunnerState);
    setReflectionState(emptyReflectionState);
  }, []);

  const extractPracticeQuestions = useCallback((response, level) => {
    const payload = unwrap(response);
    // level may be uppercase (e.g. 'BASIC'); also try title-case and lowercase variants
    const upperLevel = level ? String(level).toUpperCase() : '';
    const lowerLevel = level ? String(level).toLowerCase() : '';
    const titleLevel = lowerLevel ? lowerLevel.charAt(0).toUpperCase() + lowerLevel.slice(1) : '';
    const keys = [upperLevel, lowerLevel, titleLevel, `${upperLevel}Questions`, `${lowerLevel}Questions`, `${titleLevel}Questions`, 'questions', 'items', 'content'].filter(Boolean);
    for (const key of keys) {
      if (Array.isArray(payload?.[key])) {
        const keyedItems = payload[key];
        if (!upperLevel) return keyedItems;
        const filteredByKey = keyedItems.filter(
          (item) => normalizeDifficultyLevel(item?.bloomsLevel || item?.testLevel || item?.difficulty || item?.level) === upperLevel,
        );
        return filteredByKey.length ? filteredByKey : keyedItems;
      }
    }
    if (payload?.levels && typeof payload.levels === 'object') {
      return arr(payload.levels[upperLevel] || payload.levels[lowerLevel] || payload.levels[titleLevel]);
    }
    const list = arr(payload);
    if (!upperLevel) return list;
    const filtered = list.filter(
      (item) => normalizeDifficultyLevel(item?.bloomsLevel || item?.testLevel || item?.difficulty || item?.level) === upperLevel,
    );
    return filtered.length ? filtered : list;
  }, []);

  const loadTopicContent = useCallback(async (topicId) => {
    setTopicLoading(true);
    setTopicError('');
    try {
      const response = await studentService.getAcademicIQTopicContent(topicId);
      const payload = unwrap(response);
      setTopicContent(payload?.content && typeof payload.content === 'object' ? { ...payload.content, ...payload } : payload);
    } catch (error) {
      setTopicContent(null);
      setTopicError(toMessage(error, 'Unable to load topic content.'));
    } finally {
      setTopicLoading(false);
    }
  }, []);

  const loadPracticeQuestions = useCallback(async (topicId, level) => {
    if (!topicId) {
      setPracticeQuestions([]);
      setPracticeError('Unable to load practice questions for this topic.');
      return;
    }
    setPracticeLoading(true);
    setPracticeError('');
    try {
      const normalizedLevel = normalizeDifficultyLevel(level);
      const response = await studentService.getPracticeZoneQuestions(topicId);
      setPracticeQuestions(extractPracticeQuestions(response, normalizedLevel));
    } catch (error) {
      logApiError('Practice Zone questions failed', error);
      setPracticeQuestions([]);
      const status = error?.response?.status || error?.status;
      if (status === 401 || status === 403) {
        setPracticeError('Session expired. Please log in again.');
      } else if (status === 404) {
        setPracticeError('No practice questions found for this topic.');
      } else {
        setPracticeError(toMessage(error, 'Unable to load practice questions. Please try again.'));
      }
    } finally {
      setPracticeLoading(false);
    }
  }, [extractPracticeQuestions]);
  useEffect(() => {
    if (!selectedTopic) return;
    const topicId = getApiId(selectedTopic, ['id', 'topicId', 'nodeId', 'topic_id', 'slug']) || getNodeId(selectedTopic);
    if (activeCategory === 'practice') loadPracticeQuestions(topicId, practiceDifficulty);
    else loadTopicContent(topicId);
  }, [selectedTopic, activeCategory, practiceDifficulty, loadPracticeQuestions, loadTopicContent]);

  const loadUnderstanding = useCallback(async () => {
    if (!selectedTopic) return;
    const topicId = getNodeId(selectedTopic);
    setUnderstandingLoading(true);
    setUnderstandingError('');
    try {
      const [infoResponse, questionsResponse] = await Promise.all([
        studentService.getUnderstandingInfo(topicId).catch(() => null),
        studentService.getUnderstandingQuestions(topicId),
      ]);
      setUnderstandingInfo(unwrap(infoResponse));
      setUnderstandingQuestions(shuffleArray(arr(unwrap(questionsResponse)?.questions || unwrap(questionsResponse)?.items || unwrap(questionsResponse))).slice(0, 15));
    } catch (error) {
      setUnderstandingQuestions([]);
      setUnderstandingError(toMessage(error, 'Unable to load Test Your Understanding questions.'));
    } finally {
      setUnderstandingLoading(false);
    }
  }, [selectedTopic]);

  useEffect(() => {
    if (activeTopicTab === 'understanding' && selectedTopic && !understandingLoading && !understandingQuestions.length && !understandingError) {
      loadUnderstanding();
    }
  }, [activeTopicTab, selectedTopic, understandingLoading, understandingQuestions.length, understandingError, loadUnderstanding]);

  const submitUnderstanding = useCallback(() => {
    Alert.alert('Submit Test', 'Are you sure you want to submit?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Submit', onPress: () => setUnderstandingState((prev) => ({ ...prev, submitted: true, result: getAnswerStats(understandingQuestions, prev.answers, { marksMode: true }) })) },
    ]);
  }, [understandingQuestions]);

  const submitPractice = useCallback(() => {
    if (!selectedTopic) return;
    const topicId = getNodeId(selectedTopic);
    const result = getAnswerStats(practiceQuestions, practiceState.answers, { marksMode: false });
    setPracticeState((prev) => ({ ...prev, submitted: true, result }));
    setPracticeProgress((prev) => ({ ...prev, [`${topicId}:${practiceDifficulty}`]: { completed: true, score: result.score, total: practiceQuestions.length } }));
  }, [selectedTopic, practiceQuestions, practiceState.answers, practiceDifficulty]);

  const beginReflection = useCallback(async () => {
    if (!selectedTopic) return;
    const topicId = getNodeId(selectedTopic);
    setReflectionState((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const response = await studentService.startTopicReflection(topicId, {});
      const payload = unwrap(response);
      setReflectionState({ ...emptyReflectionState, phase: 'testing', loading: false, question: payload?.question || payload?.nextQuestion || payload, sessionState: payload?.sessionState || payload?.state || payload?.session || null, step: 1 });
    } catch (error) {
      setReflectionState((prev) => ({ ...prev, loading: false, error: toMessage(error, 'Unable to start reflection test.') }));
    }
  }, [selectedTopic]);

  const finalizeReflectionSummary = useCallback(async (topicId, sessionState, history) => {
    try {
      const response = await studentService.submitTopicReflectionTest(topicId, { sessionState });
      setReflectionState((prev) => ({ ...prev, phase: 'summary', loading: false, summary: unwrap(response), history }));
    } catch {
      setReflectionState((prev) => ({ ...prev, phase: 'summary', loading: false, summary: { score: history.length, summary: 'Adaptive test complete. Choose the reflection level that best matches your confidence.' }, history }));
    }
  }, []);

  const answerReflection = useCallback(async (option, index) => {
    if (!selectedTopic || !reflectionState.question) return;
    const topicId = getNodeId(selectedTopic);
    const answer = optionValue(option);
    const questionId = reflectionState.question?.id || reflectionState.question?.questionId;
    const history = [...reflectionState.history, { questionId, answer }];
    setReflectionState((prev) => ({ ...prev, loading: true, selection: answer }));
    try {
      const response = await studentService.answerTopicReflection(topicId, { sessionState: reflectionState.sessionState, answer, questionId, optionIndex: index });
      const payload = unwrap(response);
      const nextQuestion = payload?.question || payload?.nextQuestion || null;
      const nextSessionState = payload?.sessionState || payload?.state || payload?.session || reflectionState.sessionState;
      const completed = Boolean(payload?.completed || payload?.isComplete || !nextQuestion || history.length >= 12);
      if (completed) {
        await finalizeReflectionSummary(topicId, nextSessionState, history);
        return;
      }
      setReflectionState((prev) => ({ ...prev, loading: false, question: nextQuestion, sessionState: nextSessionState, history, selection: '', step: history.length + 1 }));
    } catch (error) {
      setReflectionState((prev) => ({ ...prev, loading: false, error: toMessage(error, 'Unable to save your answer. Please try again.') }));
    }
  }, [selectedTopic, reflectionState.question, reflectionState.sessionState, reflectionState.history, finalizeReflectionSummary]);

  const submitReflectionLevel = useCallback(async () => {
    if (!selectedTopic || !reflectionState.reflectionChoice) return;
    const topicId = getNodeId(selectedTopic);
    setReflectionState((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const response = await studentService.submitTopicReflectionLevel(topicId, { sessionState: reflectionState.sessionState, reflectionLevel: reflectionState.reflectionChoice });
      const payload = unwrap(response);
      setReflectionState((prev) => ({ ...prev, phase: 'submitted', loading: false, submittedMessage: payload?.message || payload?.summary || 'Your reflection level has been submitted.' }));
    } catch (error) {
      setReflectionState((prev) => ({ ...prev, loading: false, error: toMessage(error, 'Unable to submit reflection level.') }));
    }
  }, [selectedTopic, reflectionState.reflectionChoice, reflectionState.sessionState]);

  const openExam = useCallback(async (exam) => {
    const selectedExamId = getApiId(exam, ['subExamId', 'id', 'examId', 'entranceExamId', 'entranceExamSubjectId', 'competitiveExamSubjectId', 'competitiveExamId', 'exam_id']) || getNodeId(exam);
    // Access control: block if this exam is not the student's enrolled one
    if (enrolledCompetitiveExamId && String(selectedExamId || '') !== enrolledCompetitiveExamId) {
      Alert.alert('Access Denied', 'This exam is not part of your enrollment. Please contact your administrator to change your exam enrollment.');
      return;
    }
    setSelectedExam(exam);
    setExamDetailError('');
    setExamSection('resources');
    resetExamTopicState();
    setPracticeZoneSubjects([]);
    setPracticeZoneSubjectsError('');
    setSheetVisible(false);
    try {
      if (!selectedExamId) {
        setExamDetailError('Unable to open this exam right now.');
        return;
      }
      const detail = await studentService.getExamSubjectTree(selectedExamId);
      const payload = unwrap(detail);
      if (payload && Object.keys(payload).length > 0) setSelectedExam((prev) => ({ ...prev, ...payload, id: prev?.id || prev?.examId || selectedExamId }));
    } catch (error) {
      logApiError('Competitive exam detail fetch failed', error);
      setExamDetailError(toMessage(error, 'Unable to load exam details. Please try again.'));
    }
  }, [resetExamTopicState, enrolledCompetitiveExamId]);

  const openExamTopic = useCallback((topic) => {
    setSelectedExamTopic(topic);
    setExamActiveTab('lessonPlan');
    setExamPracticeQuestions([]);
    setExamPracticeState(emptyRunnerState);
    setExamTopicContent(null);
    setExamTopicError('');
  }, []);

  const loadExamTopicContent = useCallback(async (topicId) => {
    setExamTopicLoading(true);
    setExamTopicError('');
    try {
      const response = await studentService.getExamTopicContent(topicId);
      const payload = unwrap(response);
      setExamTopicContent(payload?.content && typeof payload.content === 'object' ? { ...payload.content, ...payload } : payload);
    } catch (error) {
      logApiError('Competitive Exam topic content failed', error);
      setExamTopicContent(null);
      const status = error?.response?.status || error?.status;
      if (status === 401 || status === 403) {
        setExamTopicError('Session expired. Please log in again.');
      } else if (status === 404) {
        setExamTopicError('Content not found for this topic.');
      } else {
        setExamTopicError(toMessage(error, 'Server error. Please try again.'));
      }
    } finally {
      setExamTopicLoading(false);
    }
  }, []);

  const loadExamPracticeQuestions = useCallback(async (topicId, level) => {
    if (!topicId) {
      setExamPracticeQuestions([]);
      setExamPracticeError('Unable to load practice questions for this topic.');
      return;
    }
    setExamPracticeLoading(true);
    setExamPracticeError('');
    try {
      const normalizedLevel = normalizeDifficultyLevel(level);
      const response = await studentService.getExamTopicPracticeQuestions(topicId);
      setExamPracticeQuestions(extractPracticeQuestions(response, normalizedLevel));
    } catch (error) {
      logApiError('Competitive Exam practice questions failed', error);
      setExamPracticeQuestions([]);
      const status = error?.response?.status || error?.status;
      if (status === 401 || status === 403) {
        setExamPracticeError('Session expired. Please log in again.');
      } else if (status === 404) {
        setExamPracticeError('No practice questions found for this topic.');
      } else {
        setExamPracticeError(toMessage(error, 'Unable to load practice questions. Please try again.'));
      }
    } finally {
      setExamPracticeLoading(false);
    }
  }, [extractPracticeQuestions]);

  useEffect(() => {
    if (!selectedExamTopic) return;
    const topicId = getApiId(selectedExamTopic, ['id', 'topicId', 'nodeId', 'topic_id', 'slug']) || getNodeId(selectedExamTopic);
    if (examSection === 'practice') loadExamPracticeQuestions(topicId, examPracticeDifficulty);
    else loadExamTopicContent(topicId);
  }, [selectedExamTopic, examSection, examPracticeDifficulty, loadExamTopicContent, loadExamPracticeQuestions]);

  const submitExamPractice = useCallback(() => {
    if (!selectedExamTopic) return;
    const topicId = getNodeId(selectedExamTopic);
    const result = getAnswerStats(examPracticeQuestions, examPracticeState.answers, { marksMode: false });
    setExamPracticeState((prev) => ({ ...prev, submitted: true, result }));
    setExamPracticeProgress((prev) => ({ ...prev, [`${topicId}:${examPracticeDifficulty}`]: { completed: true, score: result.score, total: examPracticeQuestions.length } }));
  }, [selectedExamTopic, examPracticeQuestions, examPracticeState.answers, examPracticeDifficulty]);
  const parseMockTestsPage = useCallback((response) => {
    const payload = unwrap(response);
    const pagedContent = Array.isArray(payload?.content) ? payload.content : null;
    const list = arr(payload?.mockTests || payload?.tests || payload?.papers || payload?.items || pagedContent || payload);
    // Spring Boot returns `last: true` when on the last page; also support explicit hasNext/hasNextPage
    const explicitHasMore =
      payload?.hasNext ?? payload?.hasNextPage ?? payload?.pagination?.hasNext ?? payload?.meta?.hasNext ??
      (payload?.last !== undefined ? !payload.last : undefined);
    // Spring Boot returns `number` as 0-indexed page; convert to 1-indexed for UI tracking
    const rawPage = Number(payload?.page ?? payload?.currentPage ?? payload?.number ?? payload?.pagination?.page ?? payload?.meta?.page ?? 0);
    const currentPage = rawPage + 1; // Convert to 1-indexed UI page
    const totalPages = Number(payload?.totalPages ?? payload?.pages ?? payload?.pagination?.totalPages ?? payload?.meta?.totalPages ?? 0);
    const hasMore = typeof explicitHasMore === 'boolean' ? explicitHasMore : totalPages > 0 && currentPage < totalPages;
    return { list, hasMore };
  }, []);

  const loadMockTestsPage = useCallback(async (page, append = false) => {
    const examId = getApiId(selectedExam, ['subExamId', 'id', 'examId', 'entranceExamId', 'entranceExamSubjectId', 'competitiveExamSubjectId', 'competitiveExamId', 'exam_id']) || getNodeId(selectedExam);
    if (!examId) return;
    if (append) setMockTestsLoadingMore(true);
    else setMockTestsLoading(true);
    try {
      const data = await studentService.getMockTestPapersForSubject(examId).catch(() => (
        studentService.getExamMockTests(examId, page > 1 ? { page } : undefined)
      ));
      const { list, hasMore } = parseMockTestsPage(data);
      setMockTests((prev) => (append ? [...prev, ...list] : list));
      setMockTestsPage(page);
      setMockTestsHasMore(hasMore);
    } catch (error) {
      logApiError('Mock Test list failed', error);
      if (!append) setMockTests([]);
      const status = error?.response?.status || error?.status;
      if (status === 401 || status === 403) {
        setScreenError('Session expired. Please log in again.');
      } else if (status === 404) {
        setScreenError('No mock tests found for this exam.');
      } else {
        setScreenError(toMessage(error, 'Unable to load mock tests. Please try again.'));
      }
    } finally {
      if (append) setMockTestsLoadingMore(false);
      else setMockTestsLoading(false);
    }
  }, [selectedExam, parseMockTestsPage]);

  const openMockTestList = useCallback(async () => {
    setView('mockTestList');
    setMockTests([]);
    setMockTestsPage(1);
    setMockTestsHasMore(false);
    setSelectedMockTest(null);
    setMockTestQuestions([]);
    setMockTestResults(null);
    setScreenError('');
    await loadMockTestsPage(1, false);
  }, [loadMockTestsPage]);

  const openMockTest = useCallback(async (test) => {
    const mockTestId = getApiId(test, ['id', 'testId', 'mockTestId', 'test_id']) || getNodeId(test);
    setSelectedMockTest(test);
    setView('mockTestRunner');
    setMockTestLoading(true);
    setMockTestQuestions([]);
    setMockTestResults(null);
    setScreenError('');
    try {
      const data = await studentService.getMockTestPaperQuestions(mockTestId);
      setMockTestQuestions(arr(unwrap(data)?.questions || unwrap(data)?.items || unwrap(data)));
    } catch (error) {
      logApiError('Mock Test questions failed', error);
      const status = error?.response?.status || error?.status;
      if (status === 401 || status === 403) {
        setScreenError('Session expired. Please log in again.');
      } else {
        setScreenError(toMessage(error, 'Unable to load test questions. Please try again.'));
      }
    } finally {
      setMockTestLoading(false);
    }
  }, []);

  const handleSubmitMockTest = useCallback(async (answersMap) => {
    const mockTestId = getApiId(selectedMockTest, ['id', 'testId', 'mockTestId', 'test_id']) || getNodeId(selectedMockTest);
    setView('mockTestResults');
    setMockTestLoading(true);
    try {
      const payload = { answers: Object.entries(answersMap).map(([questionId, optionIndex]) => ({ questionId, selectedOption: optionIndex })) };
      const data = await studentService.submitMockTest(mockTestId, payload);
      const parsed = unwrap(data);
      const scoreValue = parsed?.score ?? parsed?.correct;
      const totalValue = parsed?.total ?? parsed?.totalQuestions;
      const hasScore = scoreValue !== null && scoreValue !== undefined && Number.isFinite(Number(scoreValue));
      const hasTotal = totalValue !== null && totalValue !== undefined && Number.isFinite(Number(totalValue));
      if (hasScore && hasTotal) {
        setMockTestResults(parsed);
      } else {
        try {
          const resultData = await studentService.getMockTestResult(mockTestId);
          setMockTestResults(resultData ? unwrap(resultData) : parsed);
        } catch (resultError) {
          logApiError('Mock Test result fetch failed', resultError);
          setMockTestResults(parsed);
        }
      }
    } catch (error) {
      logApiError('Mock Test submit failed', error);
      const result = getAnswerStats(mockTestQuestions, answersMap, { marksMode: false });
      setMockTestResults({ score: result.score, total: mockTestQuestions.length, percentage: mockTestQuestions.length ? Math.round((result.score / mockTestQuestions.length) * 100) : 0 });
    } finally {
      setMockTestLoading(false);
    }
  }, [selectedMockTest, mockTestQuestions]);

  const learningTabs = useMemo(() => buildTopicTabs(topicContent || {}), [topicContent]);
  const examTabs = useMemo(() => buildTopicTabs(examTopicContent || {}), [examTopicContent]);
  const currentPracticeProgress = practiceProgress[`${getNodeId(selectedTopic)}:${practiceDifficulty}`];
  const currentExamPracticeProgress = examPracticeProgress[`${getNodeId(selectedExamTopic)}:${examPracticeDifficulty}`];

  const renderAcademicTopicPanel = () => {
    const assets = collectTopicAssets(topicContent || {});
    if (topicLoading) return <View style={styles.centerWrap}><ActivityIndicator color={STUDENT.accent} /><Text style={styles.mutedText}>Loading topic…</Text></View>;
    if (activeTopicTab === 'understanding') {
      if (understandingLoading) return <View style={styles.centerWrap}><ActivityIndicator color="#FACC15" /><Text style={styles.mutedText}>Loading Test Your Understanding…</Text></View>;
      const maxScore = getAnswerStats(understandingQuestions, {}, { marksMode: true }).totalPossible || 0;
      return <><InlineNotice text={understandingError} /><QuestionRunner title="Test Your Understanding" subtitle={understandingInfo?.title || understandingInfo?.description || ''} questions={understandingQuestions} state={understandingState} setState={setUnderstandingState} onSubmit={submitUnderstanding} emptyMessage="No understanding questions are currently available for this topic." accentColor="#FACC15" progressFillStyle={styles.tyuProgressFill} scoreSuffix={`/ ${maxScore}`} /></>;
    }
    if (activeTopicTab === 'reflection') {
      return <><InlineNotice text={reflectionState.error} /><MyReflectionPanel state={reflectionState} onStart={beginReflection} onAnswer={answerReflection} onChooseLevel={(value) => setReflectionState((prev) => ({ ...prev, reflectionChoice: value }))} onSubmitLevel={submitReflectionLevel} /></>;
    }
    if (activeTopicTab === 'videos' || activeTopicTab === 'images' || activeTopicTab === 'pdfs') {
      return <ContentCard title={learningTabs.find((tab) => tab.key === activeTopicTab)?.label || 'Media'} attachments={assets[activeTopicTab]} onPreview={setPreviewAsset} />;
    }
    const handwrittenText = topicContent?.handwrittenNotes && !Array.isArray(topicContent.handwrittenNotes) && !isProbablyUrl(topicContent.handwrittenNotes) ? topicContent.handwrittenNotes : '';
    return <><InlineNotice text={topicError} /><ContentCard title={learningTabs.find((tab) => tab.key === activeTopicTab)?.label || 'Topic'} body={activeTopicTab === 'handwrittenNotes' ? handwrittenText : topicContent?.[activeTopicTab]} attachments={activeTopicTab === 'handwrittenNotes' ? assets.noteAttachments : []} onPreview={setPreviewAsset} /></>;
  };

  const renderPracticePanel = () => (
    <>
      <ScrollView horizontal style={styles.subjectTabsScroll} contentContainerStyle={styles.subjectTabsContent} showsHorizontalScrollIndicator={false}>
        {LEVELS.map((level) => {
          const active = level === practiceDifficulty;
          const progress = practiceProgress[`${getNodeId(selectedTopic)}:${level}`];
          return <TouchableOpacity key={level} style={[styles.subjectPill, active && styles.subjectPillActive]} onPress={() => { setPracticeDifficulty(level); setPracticeState(emptyRunnerState); }}><Text style={[styles.subjectPillText, active && styles.subjectPillTextActive]}>{level}</Text>{progress?.completed ? <Text style={styles.levelDoneText}> ✓</Text> : null}</TouchableOpacity>;
        })}
      </ScrollView>
      {currentPracticeProgress?.completed ? <InlineNotice tone="warning" text={`Completed ${practiceDifficulty}: ${currentPracticeProgress.score}/${currentPracticeProgress.total}`} /> : null}
      {practiceError ? (
        <View style={styles.errorRetryWrap}>
          <InlineNotice text={practiceError} />
          <TouchableOpacity style={styles.retryButton} onPress={() => { setPracticeError(''); loadPracticeQuestions(getApiId(selectedTopic, ['id', 'topicId', 'nodeId', 'topic_id', 'slug']) || getNodeId(selectedTopic), practiceDifficulty); }}>
            <Text style={styles.retryButtonText}>↺ Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {practiceLoading ? <View style={styles.centerWrap}><ActivityIndicator color={STUDENT.accentCyan} /><Text style={styles.mutedText}>Loading practice questions…</Text></View> : <QuestionRunner title="Practice Zone" questions={practiceQuestions} state={practiceState} setState={setPracticeState} onSubmit={submitPractice} emptyMessage="No practice questions are currently available for this topic." accentColor={STUDENT.accentCyan} scoreSuffix={`/ ${practiceQuestions.length}`} />}
    </>
  );

  const renderLearningView = () => {
    if (!hasAcademicCurriculumClassSelection && (activeCategory === 'personalized' || activeCategory === 'practice')) {
      return <EmptyStateCard title="Academic IQ profile required" description="Academic IQ profile does not contain selected curriculum/class. Please set Academic IQ selections first." actionLabel="Open Profile" onPress={() => router.push('/student/profile')} />;
    }
    return (
      <>
        <View style={styles.headerRow}><TouchableOpacity onPress={() => { setView('landing'); resetLearningTopicState(); }}><Text style={styles.backText}>← Back</Text></TouchableOpacity><Text style={styles.headerTitle}>{LEARNING_CATEGORIES.find((item) => item.key === activeCategory)?.title || 'Academic IQ'}</Text><View style={styles.langChip}><Text style={styles.langText}>English ▾</Text></View></View>
        {showLimitedAccess ? <LimitedAccessBanner /> : null}
        <InlineNotice text={screenError} />
        {subjects.length ? <SubjectTabs items={subjects} activeId={activeSubjectId} onSelect={(subject) => { setActiveSubjectId(getNodeId(subject)); setSelectedChapterId(null); resetLearningTopicState(); }} /> : null}
        <View style={styles.sectionHeaderWrap}><Text style={styles.sectionTitleLight}>{nodeLabel(activeSubject, 'Subject')}</Text></View>
        {selectedTopic ? (
          <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent}>
            <TouchableOpacity onPress={() => setSelectedTopic(null)}><Text style={styles.inlineBack}>← Topics</Text></TouchableOpacity>
            {activeCategory === 'practice' ? renderPracticePanel() : <><TopicTabBar tabs={learningTabs} activeKey={activeTopicTab} onSelect={setActiveTopicTab} />{renderAcademicTopicPanel()}</>}
          </ScrollView>
        ) : selectedChapter ? (
          <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent}><TouchableOpacity onPress={() => setSelectedChapterId(null)}><Text style={styles.inlineBack}>← Chapters</Text></TouchableOpacity>{topics.length > 0 ? topics.map((topic, index) => <NodeCard key={getNodeId(topic, `${index}`)} index={index} title={nodeLabel(topic, `Topic ${index + 1}`)} onPress={() => openTopic(topic)} />) : <Text style={styles.placeholderText}>No topics available for this chapter.</Text>}</ScrollView>
        ) : (
          <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent}>{chapters.length > 0 ? chapters.map((chapter, index) => <NodeCard key={getNodeId(chapter, `${index}`)} index={index} title={nodeLabel(chapter, `Chapter ${index + 1}`)} subtitle={chapter?.description || chapter?.summary} onPress={() => setSelectedChapterId(getNodeId(chapter))} />) : <Text style={styles.placeholderText}>No chapters available for this subject.</Text>}</ScrollView>
        )}
      </>
    );
  };

  const renderCompetitiveSelection = () => (
    <>
      <View style={styles.headerRow}><TouchableOpacity onPress={() => setView('landing')}><Text style={styles.backText}>← Back</Text></TouchableOpacity><Text style={styles.headerTitle}>Competitive Exam</Text><View style={styles.langChip}><Text style={styles.langText}>English ▾</Text></View></View>
      <InlineNotice text={screenError} />
      {!selectedExam ? (
        <ScrollView style={styles.listScroll} contentContainerStyle={styles.gridContent}>{examCategoryCards.map((category) => <TouchableOpacity key={String(category?.id || category.title)} style={styles.examCategoryCard} onPress={() => { setSelectedExamCategory(category); setSheetVisible(true); }}><Text style={styles.examCardIcon}>🎯</Text><Text style={styles.examCardTitle}>{category.title}</Text><View style={styles.examCountPill}><Text style={styles.examCountText}>{`${category.count} Exams`}</Text></View></TouchableOpacity>)}</ScrollView>
      ) : (
        <>
          <View style={styles.headerRowCompact}><TouchableOpacity onPress={() => { setSelectedExam(null); setSelectedExamSubjectId(null); resetExamTopicState(); }}><Text style={styles.backText}>{`← ${nodeLabel(selectedExamCategory, 'Categories')}`}</Text></TouchableOpacity><TouchableOpacity style={styles.analyticsPill} onPress={() => router.push('/student/academic')}><Text style={styles.analyticsPillText}>My Analytics</Text></TouchableOpacity></View>
          <View style={styles.examBanner}><Text style={styles.examBannerTitle}>{nodeLabel(selectedExam, 'Exam')}</Text><Text style={styles.examBannerSub}>{`Part of ${nodeLabel(selectedExamCategory, 'Category')}`}</Text></View>
          <InlineNotice text={examDetailError} />
          {showLimitedAccess ? <LimitedAccessBanner /> : null}
          <ScrollView horizontal style={styles.subjectTabsScroll} contentContainerStyle={styles.subjectTabsContent} showsHorizontalScrollIndicator={false}>{[{ key: 'resources', label: 'Resources' }, { key: 'practice', label: 'Practice Zone' }, { key: 'mock', label: 'Mock Test' }].map((section) => <TouchableOpacity key={section.key} style={[styles.subjectPill, examSection === section.key && styles.subjectPillActive]} onPress={() => { if (section.key === 'mock') { openMockTestList(); return; } setExamSection(section.key); resetExamTopicState(); }}><Text style={[styles.subjectPillText, examSection === section.key && styles.subjectPillTextActive]}>{section.label}</Text></TouchableOpacity>)}</ScrollView>
          {examSection === 'practice' && practiceZoneSubjectsLoading ? (
            <View style={styles.centerWrap}><ActivityIndicator color={STUDENT.accentCyan} /><Text style={styles.mutedText}>Loading practice subjects…</Text></View>
          ) : examSection === 'practice' && practiceZoneSubjectsError && !examSubjects.length ? (
            <View style={styles.errorRetryWrap}>
              <InlineNotice text={practiceZoneSubjectsError} />
              <TouchableOpacity style={styles.retryButton} onPress={() => { setPracticeZoneSubjectsError(''); loadPracticeZoneSubjects(getApiId(selectedExam, ['subExamId', 'id', 'examId', 'entranceExamId', 'entranceExamSubjectId', 'competitiveExamSubjectId', 'competitiveExamId', 'exam_id']) || getNodeId(selectedExam)); }}>
                <Text style={styles.retryButtonText}>↺ Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <SubjectTabs items={examSubjects} activeId={selectedExamSubjectId} onSelect={(subject) => { setSelectedExamSubjectId(getNodeId(subject)); resetExamTopicState(); }} />
          )}
          <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent}>
            {selectedExamTopic ? (
              <>
                <TouchableOpacity onPress={() => setSelectedExamTopic(null)}><Text style={styles.inlineBack}>← Topics</Text></TouchableOpacity>
                {examSection === 'practice' ? (
                  <>
                    <ScrollView horizontal style={styles.subjectTabsScroll} contentContainerStyle={styles.subjectTabsContent} showsHorizontalScrollIndicator={false}>{LEVELS.map((level) => { const active = level === examPracticeDifficulty; const progress = examPracticeProgress[`${getNodeId(selectedExamTopic)}:${level}`]; return <TouchableOpacity key={level} style={[styles.subjectPill, active && styles.subjectPillActive]} onPress={() => { setExamPracticeDifficulty(level); setExamPracticeState(emptyRunnerState); }}><Text style={[styles.subjectPillText, active && styles.subjectPillTextActive]}>{level}</Text>{progress?.completed ? <Text style={styles.levelDoneText}> ✓</Text> : null}</TouchableOpacity>; })}</ScrollView>
                    {currentExamPracticeProgress?.completed ? <InlineNotice tone="warning" text={`Completed ${examPracticeDifficulty}: ${currentExamPracticeProgress.score}/${currentExamPracticeProgress.total}`} /> : null}
                    {examPracticeError ? (
                      <View style={styles.errorRetryWrap}>
                        <InlineNotice text={examPracticeError} />
                        <TouchableOpacity style={styles.retryButton} onPress={() => { setExamPracticeError(''); loadExamPracticeQuestions(getApiId(selectedExamTopic, ['id', 'topicId', 'nodeId', 'topic_id', 'slug']) || getNodeId(selectedExamTopic), examPracticeDifficulty); }}>
                          <Text style={styles.retryButtonText}>↺ Retry</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                    {examPracticeLoading ? <View style={styles.centerWrap}><ActivityIndicator color={STUDENT.accentCyan} /><Text style={styles.mutedText}>Loading questions…</Text></View> : <QuestionRunner title="Competitive Practice Zone" questions={examPracticeQuestions} state={examPracticeState} setState={setExamPracticeState} onSubmit={submitExamPractice} emptyMessage="No practice questions are currently available for this topic." accentColor={STUDENT.accentCyan} scoreSuffix={`/ ${examPracticeQuestions.length}`} />}
                  </>
                ) : (
                  <>{examTopicLoading ? <View style={styles.centerWrap}><ActivityIndicator color={STUDENT.accent} /><Text style={styles.mutedText}>Loading topic…</Text></View> : <><TopicTabBar tabs={examTabs} activeKey={examActiveTab} onSelect={setExamActiveTab} /><InlineNotice text={examTopicError} />{examActiveTab === 'videos' || examActiveTab === 'images' || examActiveTab === 'pdfs' ? <ContentCard title={examTabs.find((tab) => tab.key === examActiveTab)?.label || 'Media'} attachments={collectTopicAssets(examTopicContent || {})[examActiveTab]} onPreview={setPreviewAsset} /> : <ContentCard title={examTabs.find((tab) => tab.key === examActiveTab)?.label || 'Topic'} body={examTopicContent?.[examActiveTab]} attachments={examActiveTab === 'handwrittenNotes' ? collectTopicAssets(examTopicContent || {}).noteAttachments : []} onPreview={setPreviewAsset} />}</>}</>
                )}
              </>
            ) : examTopics.length > 0 ? examTopics.map((topic, index) => <NodeCard key={getNodeId(topic, `${index}`)} index={index} title={nodeLabel(topic, `Topic ${index + 1}`)} subtitle={topic?.description || topic?.summary} onPress={() => openExamTopic(topic)} />) : <Text style={styles.placeholderText}>Topics will appear here when this exam subject is available.</Text>}
          </ScrollView>
        </>
      )}
      <Modal visible={sheetVisible} transparent animationType="slide" onRequestClose={() => setSheetVisible(false)}><Pressable style={styles.sheetOverlay} onPress={() => setSheetVisible(false)}><Pressable style={styles.sheetCard}><Text style={styles.sheetTitle}>{nodeLabel(selectedExamCategory, 'Exams')}</Text><ScrollView style={styles.sheetScrollView}>{activeExamItems.map((exam, index) => <TouchableOpacity key={String(exam?.id || `${nodeLabel(exam)}-${index}`)} style={styles.sheetItem} onPress={() => openExam(exam)}><Text style={styles.sheetItemText}>{nodeLabel(exam, `Exam ${index + 1}`)}</Text><Text style={styles.sheetItemIcon}>›</Text></TouchableOpacity>)}</ScrollView></Pressable></Pressable></Modal>
    </>
  );
  const renderMockTestList = () => (
    <>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => setView('competitive')}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mock Tests</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.examBanner}>
        <Text style={styles.examBannerTitle}>{nodeLabel(selectedExam, 'Exam')}</Text>
        <Text style={styles.examBannerSub}>Select a mock test paper to begin</Text>
      </View>

      {mockTestsLoading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={STUDENT.accent} />
          <Text style={styles.mutedText}>Loading mock tests...</Text>
        </View>
      ) : (
        <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent}>
          {screenError ? (
            <View style={styles.errorRetryWrap}>
              <InlineNotice text={screenError} />
              <TouchableOpacity style={styles.retryButton} onPress={() => { setScreenError(''); loadMockTestsPage(1, false); }}>
                <Text style={styles.retryButtonText}>↺ Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {mockTests.length > 0 ? mockTests.map((test, index) => (
            <MockTestCard key={String(test?.id || `mock-${index}`)} test={test} onPress={() => openMockTest(test)} />
          )) : !screenError ? (
            <View style={styles.centerWrap}>
              <Text style={{ fontSize: 32 }}>📋</Text>
              {/* Show empty state only when there is no error (error is shown above with retry button) */}
              <Text style={styles.placeholderText}>No mock tests are available for this exam yet.</Text>
            </View>
          ) : null}
          {mockTestsHasMore ? (
            <TouchableOpacity
              style={[styles.actionButton, mockTestsLoadingMore && styles.disabled]}
              disabled={mockTestsLoadingMore}
              onPress={() => loadMockTestsPage(mockTestsPage + 1, true)}
            >
              <Text style={styles.actionButtonText}>{mockTestsLoadingMore ? 'Loading…' : 'Load More Tests'}</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      )}
    </>
  );

  const renderMockTestRunner = () => (
    mockTestLoading ? (
      <View style={styles.centerWrap}>
        <ActivityIndicator size="large" color={STUDENT.accent} />
        <Text style={styles.mutedText}>Loading test...</Text>
      </View>
    ) : (
      <MockTestRunner
        questions={mockTestQuestions}
        mockTest={selectedMockTest}
        onSubmit={handleSubmitMockTest}
        onBack={() => setView('mockTestList')}
      />
    )
  );
  const renderMockTestResults = () => {
    const score = mockTestResults?.score ?? mockTestResults?.correct ?? 0;
    const total = mockTestResults?.total ?? mockTestResults?.totalQuestions ?? mockTestQuestions.length;
    const percentage = mockTestResults?.percentage ?? (total > 0 ? Math.round((score / total) * 100) : 0);
    const resultMessage = percentage >= 80
      ? '🎉 Excellent! Outstanding performance!'
      : percentage >= 60
        ? '👍 Good work! Keep it up!'
        : percentage >= 40
          ? '📚 Keep practicing to improve!'
          : "💪 Don't give up! Practice makes perfect!";

    return (
      <>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => {
              setView('mockTestList');
              setMockTestResults(null);
              setMockTestQuestions([]);
              setSelectedMockTest(null);
            }}
          >
            <Text style={styles.backText}>← Back to Tests</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Test Results</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent}>
          <View style={styles.resultsCard}>
            <Text style={styles.resultsTestName}>{nodeLabel(selectedMockTest, 'Mock Test')}</Text>
            <Text style={styles.resultsScore}>{`${score} / ${total}`}</Text>
            <View style={styles.resultsPercentWrap}>
              <Text style={styles.resultsPercent}>{`${percentage}%`}</Text>
            </View>
            <Text style={styles.resultsMessage}>{resultMessage}</Text>
          </View>
        </ScrollView>
      </>
    );
  };

  if (loading) return <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}><View style={styles.centerWrap}><ActivityIndicator size="large" color={STUDENT.accent} /><Text style={styles.mutedText}>Loading Academic IQ...</Text></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      {view === 'landing' ? <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent}><View style={styles.heroHeader}><Text style={styles.heroTitle}>Academic IQ</Text><Text style={styles.heroSub}>Explore resources, practice questions, and competitive exam preparation tailored to your learning journey.</Text></View><InlineNotice text={screenError} /><View style={styles.categoryGrid}>{LEARNING_CATEGORIES.map((item) => <CategoryCard key={item.key} item={item} onPress={() => openCategory(item.key)} />)}</View></ScrollView> : view === 'learning' ? renderLearningView() : view === 'competitive' ? renderCompetitiveSelection() : view === 'mockTestList' ? renderMockTestList() : view === 'mockTestRunner' ? renderMockTestRunner() : renderMockTestResults()}
      <Modal visible={Boolean(previewAsset)} animationType="slide" onRequestClose={() => setPreviewAsset(null)}>
        <SafeAreaView style={styles.previewRoot}>
          <View style={styles.previewHeader}><TouchableOpacity onPress={() => setPreviewAsset(null)}><Text style={styles.backText}>← Close</Text></TouchableOpacity><TouchableOpacity onPress={() => previewAsset?.url && Linking.openURL(previewAsset.url).catch(() => {})}><Text style={styles.backText}>Open Externally</Text></TouchableOpacity></View>
          <Text style={styles.previewTitle}>{previewAsset?.label}</Text>
          {previewAsset?.type?.includes('image') ? <Image source={{ uri: previewAsset?.url }} style={styles.previewImage} resizeMode="contain" /> : previewAsset?.url ? <WebView source={{ uri: previewAsset.url }} style={styles.previewWebview} /> : <View style={styles.centerWrap}><Text style={styles.placeholderText}>Preview unavailable for this attachment.</Text></View>}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  previewRoot: { flex: 1, backgroundColor: '#020617' },
  previewHeader: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewTitle: { color: '#fff', fontSize: 16, fontWeight: '700', paddingHorizontal: 16, paddingBottom: 8 },
  previewImage: { flex: 1, width: '100%' },
  previewWebview: { flex: 1, backgroundColor: '#fff' },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 20 },
  mutedText: { color: STUDENT.textMuted, fontSize: 13 },
  heroHeader: { marginBottom: 16 },
  heroTitle: { color: STUDENT.textPrimary, fontSize: 28, fontWeight: '800' },
  heroSub: { color: STUDENT.textSecondary, marginTop: 6, lineHeight: 20 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  categoryCard: { width: '48.5%', minHeight: 150, borderRadius: 16, padding: 14, backgroundColor: 'rgba(17,24,39,0.95)', borderWidth: 1, borderColor: STUDENT.border },
  categoryEmoji: { fontSize: 30, marginBottom: 10 },
  categoryTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  categorySubtitle: { color: STUDENT.textSecondary, fontSize: 12, marginTop: 8, lineHeight: 18 },
  headerRow: { paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerRowCompact: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: STUDENT.textPrimary, fontSize: 22, fontWeight: '800', flex: 1, textAlign: 'center' },
  backText: { color: STUDENT.accent, fontWeight: '700', fontSize: 13 },
  langChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: STUDENT.bgCard, borderWidth: 1, borderColor: STUDENT.border },
  langText: { color: STUDENT.textSecondary, fontSize: 11, fontWeight: '600' },
  subjectTabsScroll: { maxHeight: 56 },
  subjectTabsContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  tabScrollContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  subjectPill: { backgroundColor: STUDENT.bgCard, borderRadius: 20, borderWidth: 1, borderColor: STUDENT.border, paddingVertical: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  subjectPillActive: { backgroundColor: STUDENT.accent, borderColor: STUDENT.accent },
  subjectPillText: { color: STUDENT.textSecondary, fontSize: 12, fontWeight: '600' },
  subjectPillTextActive: { color: '#fff' },
  levelDoneText: { color: '#fff', fontWeight: '700' },
  sectionHeaderWrap: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  sectionTitleLight: { color: STUDENT.textPrimary, fontSize: 18, fontWeight: '700' },
  listScroll: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 20, gap: 10 },
  gridContent: { paddingHorizontal: 16, paddingBottom: 20, gap: 10, flexDirection: 'row', flexWrap: 'wrap' },
  inlineBack: { color: STUDENT.accent, fontWeight: '700', marginBottom: 8 },
  nodeCard: { backgroundColor: 'rgba(17,24,39,0.98)', borderRadius: 14, borderWidth: 1, borderColor: STUDENT.border, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nodeLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  nodeNumberWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: STUDENT.glow, alignItems: 'center', justifyContent: 'center' },
  nodeNumber: { color: '#fff', fontWeight: '700' },
  nodeContentWrap: { flex: 1 },
  nodeTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  nodeSubtitle: { color: STUDENT.textSecondary, fontSize: 12, marginTop: 4 },
  nodeChevron: { color: STUDENT.textSecondary, fontSize: 20 },
  contentCardDark: { backgroundColor: 'rgba(17,24,39,0.98)', borderRadius: 16, borderWidth: 1, borderColor: STUDENT.border, padding: 14, gap: 10 },
  contentCardTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  contentBody: { color: STUDENT.textSecondary, fontSize: 13, lineHeight: 20 },
  contentSupportText: { color: STUDENT.textMuted, fontSize: 12, lineHeight: 18 },
  placeholderText: { color: STUDENT.textMuted, fontSize: 13, lineHeight: 18 },
  attachmentGrid: { gap: 10 },
  attachmentCard: { borderRadius: 12, borderWidth: 1, borderColor: STUDENT.border, backgroundColor: 'rgba(10,15,30,0.8)', padding: 12 },
  attachmentEmoji: { fontSize: 20 },
  attachmentTitle: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 6 },
  attachmentSubtitle: { color: STUDENT.textSecondary, fontSize: 11, marginTop: 4 },
  topicTab: { borderRadius: 18, borderWidth: 1, borderColor: STUDENT.border, backgroundColor: STUDENT.bgCard, paddingVertical: 8, paddingHorizontal: 12 },
  topicTabText: { color: STUDENT.textSecondary, fontSize: 12, fontWeight: '700' },
  topicTabTextActive: { color: '#fff' },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  tyuProgressFill: { backgroundColor: '#FACC15' },
  questionMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  questionCountText: { color: STUDENT.textMuted, fontSize: 12, fontWeight: '700' },
  metaPill: { color: '#67E8F9', borderWidth: 1, borderColor: 'rgba(103,232,249,0.4)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, fontSize: 11, overflow: 'hidden' },
  metaInfoWrap: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  metaInfo: { color: STUDENT.textSecondary, fontSize: 12 },
  questionText: { color: '#fff', fontSize: 15, lineHeight: 22 },
  hintWrap: { gap: 2 },
  hintPrefix: { color: '#FDE68A', fontSize: 12, fontWeight: '700', marginBottom: 2 },
  hintText: { color: '#FDE68A', fontSize: 12, lineHeight: 18 },
  optionsWrap: { gap: 10 },
  optionCard: { borderWidth: 1, borderColor: STUDENT.border, borderRadius: 12, padding: 12, backgroundColor: 'rgba(10,15,30,0.85)', flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionCardActive: { borderColor: STUDENT.accent, backgroundColor: 'rgba(79,70,229,0.16)' },
  optionTextWrap: { flex: 1 },
  optionText: { color: '#fff', fontSize: 13, lineHeight: 19 },
  mockOptionLabel: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: STUDENT.border, color: STUDENT.textSecondary, textAlign: 'center', lineHeight: 22, fontWeight: '700' },
  mockOptionLabelActive: { color: '#fff', borderColor: '#fff' },
  mockNavRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  mockNavBtn: { flex: 1, minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: STUDENT.border, alignItems: 'center', justifyContent: 'center' },
  mockNavBtnPrimary: { backgroundColor: STUDENT.accent, borderColor: STUDENT.accent },
  mockNavBtnText: { color: STUDENT.textSecondary, fontWeight: '700' },
  actionButton: { backgroundColor: STUDENT.accent, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 14 },
  actionButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  resultScore: { color: '#fff', fontSize: 30, fontWeight: '900' },
  resultSubtext: { color: STUDENT.textSecondary, fontSize: 13, lineHeight: 20 },
  noticeCard: { marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  noticeText: { fontSize: 12, lineHeight: 18, fontWeight: '600' },
  errorRetryWrap: { marginHorizontal: 16, marginVertical: 6 },
  retryButton: { marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: STUDENT.accent },
  retryButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  emptyCard: { margin: 16, borderRadius: 16, borderWidth: 1, borderColor: STUDENT.border, backgroundColor: 'rgba(17,24,39,0.95)', padding: 16, gap: 10 },
  emptyCardTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  emptyCardText: { color: STUDENT.textSecondary, fontSize: 13, lineHeight: 20 },
  limitedBanner: { marginHorizontal: 16, marginBottom: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(250,204,21,0.4)', backgroundColor: 'rgba(250,204,21,0.12)', padding: 12 },
  limitedBannerTitle: { color: '#FACC15', fontSize: 13, fontWeight: '800' },
  limitedBannerText: { color: '#FDE68A', fontSize: 12, lineHeight: 18, marginTop: 4 },
  examCategoryCard: { width: '48.5%', minHeight: 140, borderRadius: 16, padding: 14, backgroundColor: 'rgba(17,24,39,0.95)', borderWidth: 1, borderColor: STUDENT.border, gap: 10 },
  examCardIcon: { fontSize: 28 },
  examCardTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  examCountPill: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: STUDENT.glow, paddingHorizontal: 10, paddingVertical: 6 },
  examCountText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  examBanner: { marginHorizontal: 16, marginBottom: 10, borderRadius: 16, padding: 14, backgroundColor: 'rgba(17,24,39,0.98)', borderWidth: 1, borderColor: STUDENT.border },
  examBannerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  examBannerSub: { color: STUDENT.textSecondary, fontSize: 12, marginTop: 6 },
  analyticsPill: { borderRadius: 999, borderWidth: 1, borderColor: STUDENT.borderCyan, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: STUDENT.glowCyan },
  analyticsPillText: { color: '#67E8F9', fontSize: 12, fontWeight: '700' },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(2,6,23,0.6)', justifyContent: 'flex-end' },
  sheetCard: { backgroundColor: '#0F172A', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, maxHeight: '75%' },
  sheetTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 12 },
  sheetScrollView: { maxHeight: 420 },
  sheetItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetItemText: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
  sheetItemIcon: { color: STUDENT.textSecondary, fontSize: 18 },
  mockTestCard: { borderRadius: 14, borderWidth: 1, borderColor: STUDENT.border, backgroundColor: 'rgba(17,24,39,0.98)', padding: 14, gap: 10 },
  mockTestCardTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  mockTestCardMeta: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  mockTestMetaPill: { borderRadius: 999, backgroundColor: STUDENT.glow, paddingHorizontal: 10, paddingVertical: 5 },
  mockTestMetaText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  mockTestCardSub: { color: STUDENT.textSecondary, fontSize: 12, lineHeight: 18 },
  mockTestStartText: { color: '#67E8F9', fontSize: 12, fontWeight: '700' },
  mockRunnerHeader: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mockRunnerTitle: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '800', textAlign: 'center', marginHorizontal: 12 },
  mockTimerText: { color: '#fff', fontWeight: '800', fontVariant: ['tabular-nums'] },
  mockTimerWarning: { color: '#FCA5A5' },
  mockProgressWrap: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  mockProgressText: { color: STUDENT.textSecondary, fontSize: 12, fontWeight: '700' },
  paletteToggle: { borderRadius: 999, borderWidth: 1, borderColor: STUDENT.border, paddingHorizontal: 10, paddingVertical: 6 },
  paletteToggleText: { color: STUDENT.textSecondary, fontSize: 11, fontWeight: '700' },
  mockAnsweredCount: { color: STUDENT.textSecondary, fontSize: 12, fontWeight: '700' },
  paletteWrap: { paddingHorizontal: 8 },
  paletteDot: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: STUDENT.border, justifyContent: 'center', alignItems: 'center' },
  paletteDotAnswered: { backgroundColor: 'rgba(16,185,129,0.18)', borderColor: 'rgba(16,185,129,0.55)' },
  paletteDotFlagged: { backgroundColor: 'rgba(245,158,11,0.18)', borderColor: 'rgba(245,158,11,0.55)' },
  paletteDotCurrent: { borderColor: STUDENT.accent, backgroundColor: 'rgba(79,70,229,0.24)' },
  paletteDotText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  mockQuestionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  mockQLabel: { color: '#fff', fontSize: 14, fontWeight: '800' },
  flagButton: { borderRadius: 999, borderWidth: 1, borderColor: STUDENT.border, paddingHorizontal: 10, paddingVertical: 6 },
  flagButtonActive: { borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.16)' },
  flagButtonText: { color: STUDENT.textSecondary, fontSize: 11, fontWeight: '700' },
  resultsCard: { borderRadius: 18, borderWidth: 1, borderColor: STUDENT.border, backgroundColor: 'rgba(17,24,39,0.98)', padding: 20, alignItems: 'center', gap: 10 },
  resultsTestName: { color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  resultsScore: { color: '#fff', fontSize: 34, fontWeight: '900' },
  resultsPercentWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: STUDENT.glow, alignItems: 'center', justifyContent: 'center' },
  resultsPercent: { color: '#fff', fontSize: 22, fontWeight: '900' },
  resultsMessage: { color: STUDENT.textSecondary, textAlign: 'center', lineHeight: 20 },
  reflectionChoicesWrap: { gap: 10 },
  reflectionChoice: { borderRadius: 12, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 14 },
  reflectionChoiceTitle: { fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.55 },
});
