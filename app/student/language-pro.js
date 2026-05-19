import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import RichText from '../../components/RichText';
import { STUDENT } from '../../constants/theme';
import { useSubscription } from '../../context/SubscriptionContext';
import { studentService } from '../../services/studentService';

const LANDING_CARDS = [
  { key: 'personalized', title: 'Personalized Resources', subtitle: 'Based on Your English Level' },
  { key: 'school', title: 'School Resources', subtitle: 'Structured school-level communication resources' },
];

const FOCUS_AREAS = [
  { key: 'Listening', emoji: '🎧' },
  { key: 'Speaking', emoji: '🗣️' },
  { key: 'Reading', emoji: '📖' },
  { key: 'Writing', emoji: '✍️' },
];

const ACTIVITY_CATALOG = [
  { key: 'listen', label: '🎧 Listen', tokens: ['listen', 'listening', 'audio'], defaultVisible: true },
  { key: 'read_speak', label: '📖 Read & Speak', tokens: ['read', 'speak', 'reading', 'read speak'], defaultVisible: true },
  { key: 'record_voice', label: '🎙️ Record Your Voice', tokens: ['record', 'voice', 'speaking'], defaultVisible: true },
  { key: 'understanding', label: '📝 Test Your Understanding', tokens: ['understanding', 'quiz', 'test', 'question'], defaultVisible: true },
  { key: 'write', label: '✍️ Writing', tokens: ['write', 'writing', 'prompt'], defaultVisible: false },
];

const emptyRunnerState = { index: 0, answers: {}, submitted: false, result: null };
const arr = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const unwrap = (value) => (value?.data && typeof value.data === 'object' ? value.data : value || {});
const normalizeText = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const asText = (value) => String(value ?? '').trim();
const nodeLabel = (node, fallback = '') => String(node?.name || node?.title || node?.label || node?.chapterName || node?.topicName || fallback || '').trim();
const isProbablyUrl = (value) => /^https?:\/\//i.test(String(value || '').trim());
const toMessage = (err, fallback = 'Server error. Please try again.') => err?.response?.data?.message || err?.message || fallback;
const isPremiumAccessError = (err) => [402, 403].includes(err?.response?.status || err?.status) || /premium|subscription|upgrade|paid|locked/i.test(toMessage(err, ''));

function boolFromValue(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  const token = normalizeText(value);
  if (!token) return null;
  if (['true', 'yes', 'y', '1', 'premium', 'pro', 'paid', 'locked'].includes(token)) return true;
  if (['false', 'no', 'n', '0', 'free', 'basic', 'open'].includes(token)) return false;
  return null;
}

function formatTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor((milliseconds || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function buildRecordingFileName() {
  return `language-pro-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.m4a`;
}

function levelBadge(levelRaw) {
  const token = normalizeText(levelRaw || 'Beginner');
  if (token.includes('advanced') || token.includes('proficient')) {
    return { label: 'ADVANCED', color: '#14532d', background: '#bbf7d0' };
  }
  if (token.includes('intermediate') || token.includes('average') || token.includes('developing') || token.includes('progress')) {
    return { label: 'INTERMEDIATE', color: '#9a3412', background: '#fed7aa' };
  }
  return { label: 'BEGINNER', color: '#991b1b', background: '#fecaca' };
}

function extractStudentClass(...sources) {
  for (const source of sources) {
    const raw = source?.studentClass || source?.className || source?.currentClass || source?.class || source?.grade || source?.gradeLevel || source?.student?.className || source?.student?.class;
    const value = String(raw || '').match(/\d+/)?.[0] || asText(raw);
    if (value) return value;
  }
  return '';
}

function isPremiumItem(item = {}) {
  const explicit = [
    item?.isPremium,
    item?.premium,
    item?.premiumOnly,
    item?.locked,
    item?.isLocked,
    item?.requiresSubscription,
  ].find((value) => boolFromValue(value) !== null);
  if (explicit !== undefined) return Boolean(boolFromValue(explicit));
  const accessText = normalizeText(item?.accessLevel || item?.tier || item?.plan || item?.visibility || item?.tag || item?.badge);
  return ['premium', 'pro', 'paid', 'locked'].some((token) => accessText.includes(token));
}

function normalizeActivityKey(value) {
  const token = normalizeText(value);
  if (!token) return '';
  if (token.includes('record') || token.includes('voice')) return 'record_voice';
  if (token.includes('understanding') || token.includes('quiz') || token.includes('question') || token.includes('test')) return 'understanding';
  if (token.includes('write')) return 'write';
  if (token.includes('read') || token.includes('speak')) return 'read_speak';
  if (token.includes('listen') || token.includes('audio')) return 'listen';
  return token.replace(/\s+/g, '_');
}

function extractActivityEntries(node = {}) {
  const sources = [
    ...arr(node?.activities),
    ...arr(node?.modes),
    ...arr(node?.tabs),
    ...arr(node?.contentTypes),
    ...arr(node?.modules),
  ];

  const map = new Map();
  ACTIVITY_CATALOG.forEach((definition) => {
    if (definition.defaultVisible) {
      map.set(definition.key, { key: definition.key, label: definition.label, isPremium: false });
    }
  });

  sources.forEach((entry) => {
    const label = entry?.label || entry?.name || entry?.title || entry?.mode || entry?.type || entry;
    const key = normalizeActivityKey(label);
    const definition = ACTIVITY_CATALOG.find((item) => item.key === key);
    if (!definition) return;
    map.set(definition.key, {
      key: definition.key,
      label: definition.label,
      isPremium: isPremiumItem(entry),
      raw: entry,
    });
  });

  const rawNode = node?.raw || node;
  if (rawNode?.writing || rawNode?.write || rawNode?.writingPrompt || rawNode?.prompt) {
    map.set('write', { key: 'write', label: '✍️ Writing', isPremium: false });
  }

  return [...map.values()];
}

function extractEmbeddedActivityContent(node, activityKey) {
  const raw = node?.raw || node || {};
  const activityMap = {
    listen: [
      raw?.listen,
      raw?.listening,
      raw?.audio,
      raw?.audioContent,
      raw?.listeningContent,
      raw?.activities?.listen,
    ],
    read_speak: [
      raw?.readSpeak,
      raw?.readAndSpeak,
      raw?.reading,
      raw?.readingContent,
      raw?.speak,
      raw?.activities?.read_speak,
    ],
    record_voice: [
      raw?.recordYourVoice,
      raw?.recordVoice,
      raw?.voiceRecording,
      raw?.speakingPrompt,
      raw?.activities?.record_voice,
    ],
    understanding: [
      raw?.testYourUnderstanding,
      raw?.understanding,
      raw?.quiz,
      raw?.questions,
      raw?.activities?.understanding,
    ],
    write: [
      raw?.write,
      raw?.writing,
      raw?.writingPrompt,
      raw?.prompt,
      raw?.activities?.write,
    ],
  };
  const direct = activityMap[activityKey]?.find(Boolean) || null;
  if (direct && typeof direct === 'object') return direct;
  if (typeof direct === 'string') return { content: direct };
  return null;
}

function normalizeAttachment(item, index) {
  if (!item) return null;
  if (typeof item === 'string') {
    return {
      label: isProbablyUrl(item) ? `Attachment ${index + 1}` : item,
      url: isProbablyUrl(item) ? item : '',
      type: 'link',
    };
  }
  const url = item?.url || item?.link || item?.src || item?.fileUrl || item?.downloadUrl || '';
  return {
    label: item?.title || item?.name || item?.label || `Attachment ${index + 1}`,
    url,
    type: String(item?.type || item?.mimeType || item?.mediaType || 'link').toLowerCase(),
  };
}

function extractAttachments(content = {}) {
  return [
    ...arr(content?.attachments),
    ...arr(content?.resources),
    ...arr(content?.files),
    ...arr(content?.media),
    ...arr(content?.documents),
  ].map(normalizeAttachment).filter((item) => item?.url);
}

function extractAudioAssets(content = {}) {
  return [
    ...arr(content?.audio),
    ...arr(content?.audios),
    ...arr(content?.audioFiles),
    ...arr(content?.audioUrls),
    ...arr(content?.recordings),
    ...extractAttachments(content).filter((item) => item.type.includes('audio') || /\.mp3|\.wav|\.m4a|\.aac/i.test(item.url)),
  ].map((item, index) => normalizeAttachment(item, index)).filter((item) => item?.url);
}

function mergeContent(primary, secondary) {
  if (!primary) return secondary;
  if (!secondary) return primary;
  if (typeof primary !== 'object' || typeof secondary !== 'object') {
    return secondary || primary;
  }
  return {
    ...primary,
    ...secondary,
    attachments: [...arr(primary?.attachments), ...arr(secondary?.attachments)],
    resources: [...arr(primary?.resources), ...arr(secondary?.resources)],
    files: [...arr(primary?.files), ...arr(secondary?.files)],
    questions: [...arr(primary?.questions), ...arr(secondary?.questions)],
  };
}

function toContentObject(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  return { content: value };
}

function classNumber(value) {
  const match = String(value || '').match(/\d+/);
  return match ? Number(match[0]) : Number.NaN;
}

function normalizeChapter(node, index, parentSection = {}) {
  const classValue = extractStudentClass(node, parentSection);
  return {
    id: String(node?.topicId || node?.chapterId || node?.id || node?.slug || `${parentSection?.id || 'chapter'}-${index}`),
    name: nodeLabel(node, `Topic ${index + 1}`),
    description: asText(node?.description || node?.summary || node?.helperText || ''),
    classValue,
    levelName: asText(node?.levelName || node?.groupName || parentSection?.levelName || ''),
    isPremium: isPremiumItem(node),
    activities: extractActivityEntries(node),
    raw: node,
  };
}

function normalizeSection(section, index) {
  const children = arr(section?.chapters || section?.topics || section?.children || section?.items || section?.lessons || section?.resources);
  const chapters = children.length ? children.map((node, childIndex) => normalizeChapter(node, childIndex, section)) : [normalizeChapter(section, 0, section)];
  const classValue = extractStudentClass(section, chapters[0]);
  const title = nodeLabel(section, classValue ? `Class ${classValue}` : `Section ${index + 1}`);
  return {
    id: String(section?.id || section?.classId || section?.slug || `section-${index}`),
    title,
    description: asText(section?.description || section?.helperText || section?.summary || 'Content tailored to help you improve: Reading, Listening, Writing, Speaking'),
    classValue,
    levelName: asText(section?.levelName || section?.groupName || section?.subtitle || ''),
    chapters,
    raw: section,
  };
}

function extractResourceRoot(payload, resourceType) {
  const data = unwrap(payload);
  const candidates = resourceType === 'personalized'
    ? [
      data?.personalizedResources,
      data?.personalized,
      data?.personalised,
      data?.resources?.personalized,
      data?.resources?.personalised,
      data?.languagePro?.personalized,
      data?.tree?.personalized,
    ]
    : [
      data?.schoolResources,
      data?.school,
      data?.resources?.school,
      data?.languagePro?.school,
      data?.tree?.school,
    ];
  const found = candidates.find((candidate) => candidate && (Array.isArray(candidate) || typeof candidate === 'object'));
  if (found) return found;
  return data?.sections || data?.classes || data?.items || data?.resources || data;
}

function buildSectionsFromTree(payload, resourceType, studentClass) {
  const root = extractResourceRoot(payload, resourceType);
  const source = Array.isArray(root) ? root : arr(root?.sections || root?.classes || root?.items || root?.children || root?.resources);
  const sections = source.map(normalizeSection).filter((section) => section.chapters.length > 0);
  if (!sections.length) return [];
  const currentClass = classNumber(studentClass);
  const ordered = [...sections].sort((left, right) => {
    const leftRank = Number.isNaN(classNumber(left.classValue)) ? -1 : classNumber(left.classValue);
    const rightRank = Number.isNaN(classNumber(right.classValue)) ? -1 : classNumber(right.classValue);
    return rightRank - leftRank;
  });
  if (Number.isNaN(currentClass)) return ordered;
  const current = ordered.find((section) => classNumber(section.classValue) === currentClass);
  const lower = ordered.find((section) => classNumber(section.classValue) === currentClass - 1);
  const remainder = ordered.filter((section) => section !== current && section !== lower);
  return [current, lower, ...remainder].filter(Boolean);
}

function buildFallbackSectionsFromTopics(topicPayload, studentClass, levelName) {
  const topics = arr(unwrap(topicPayload)?.topics || unwrap(topicPayload)?.items || unwrap(topicPayload));
  if (!topics.length) return [];
  const grouped = topics.reduce((acc, topic, index) => {
    const classValue = extractStudentClass(topic) || studentClass || '';
    const key = classValue || 'general';
    if (!acc[key]) acc[key] = [];
    acc[key].push(normalizeChapter(topic, index, { classValue, levelName }));
    return acc;
  }, {});

  return Object.entries(grouped).map(([classValue, chapters], index) => ({
    id: `fallback-${classValue || index}`,
    title: classValue === 'general' ? 'Language Pro Topics' : `Class ${classValue}${levelName ? ` (${String(levelName).toUpperCase()})` : ''}`,
    description: 'Content tailored to help you improve: Reading, Listening, Writing, Speaking',
    classValue: classValue === 'general' ? '' : classValue,
    levelName,
    chapters,
    raw: {},
  }));
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

function normalizeQuizQuestions(payload) {
  const data = unwrap(payload);
  return arr(data?.questions || data?.items || data?.quiz || payload).map((question, index) => ({
    ...question,
    __id: String(question?.questionId || question?.id || question?.qid || index),
  }));
}

function resolveCorrectOptionIndex(question) {
  const explicit = Number.isInteger(question?.correctOptionIndex)
    ? question.correctOptionIndex
    : Number.isInteger(question?.answerIndex)
      ? question.answerIndex
      : Number.isInteger(question?.correctAnswerIndex)
        ? question.correctAnswerIndex
        : null;
  if (explicit !== null) return explicit;
  const options = normalizeQuestionOptions(question);
  const flagged = options.findIndex((option) => option.isCorrect);
  if (flagged >= 0) return flagged;
  const answerToken = normalizeText(question?.correctAnswer || question?.answer || question?.correctOption || '');
  if (!answerToken) return -1;
  if (/^[a-e]$/.test(answerToken)) return answerToken.charCodeAt(0) - 97;
  return options.findIndex((option) => normalizeText(option.text) === answerToken);
}

function getAnswerStats(questions, answers) {
  let correct = 0;
  let wrong = 0;
  let unanswered = 0;
  questions.forEach((question, index) => {
    const questionId = String(question?.__id || question?.id || index);
    const selectedIndex = answers[questionId];
    const correctIndex = resolveCorrectOptionIndex(question);
    if (selectedIndex === undefined || selectedIndex === null) {
      unanswered += 1;
    } else if (selectedIndex === correctIndex) {
      correct += 1;
    } else {
      wrong += 1;
    }
  });
  return {
    score: correct,
    correct,
    wrong,
    unanswered,
    totalPossible: questions.length,
  };
}

function QuestionRunner({ questions, state, setState, onSubmit, submitting }) {
  if (!questions.length) {
    return (
      <View style={styles.contentCard}>
        <Text style={styles.contentCardTitle}>Test Your Understanding</Text>
        <Text style={styles.placeholderText}>No understanding questions are currently available for this topic.</Text>
      </View>
    );
  }

  if (state.submitted && state.result) {
    return (
      <View style={styles.contentCard}>
        <Text style={styles.contentCardTitle}>Result</Text>
        <Text style={styles.resultScore}>{`${state.result.score} / ${state.result.totalPossible || questions.length}`}</Text>
        <Text style={styles.resultSummary}>
          {state.result.message || `Correct: ${state.result.correct} • Wrong: ${state.result.wrong} • Unanswered: ${state.result.unanswered}`}
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => setState(emptyRunnerState)}>
          <Text style={styles.primaryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const question = questions[state.index];
  const questionId = String(question?.__id || question?.id || state.index);
  const options = normalizeQuestionOptions(question);
  const selectedIndex = state.answers[questionId];
  const progress = ((state.index + 1) / questions.length) * 100;

  return (
    <View style={styles.contentCard}>
      <Text style={styles.contentCardTitle}>Test Your Understanding</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
      <Text style={styles.questionMeta}>{`Question ${state.index + 1} of ${questions.length}`}</Text>
      <RichText html={question?.questionText || question?.question || question?.text || ''} textStyle={styles.questionText} />
      <View style={styles.optionList}>
        {options.map((option, index) => {
          const active = selectedIndex === index;
          return (
            <Pressable
              key={option.id}
              style={[styles.optionCard, active && styles.optionCardActive]}
              onPress={() => setState((prev) => ({ ...prev, answers: { ...prev.answers, [questionId]: index } }))}
            >
              <Text style={[styles.optionMarker, active && styles.optionMarkerActive]}>{String.fromCharCode(65 + index)}</Text>
              <View style={styles.optionTextWrap}>
                <RichText html={option.text} textStyle={styles.optionText} />
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.quizNav}>
        <TouchableOpacity
          style={[styles.secondaryButton, state.index === 0 && styles.disabled]}
          disabled={state.index === 0}
          onPress={() => setState((prev) => ({ ...prev, index: Math.max(0, prev.index - 1) }))}
        >
          <Text style={styles.secondaryButtonText}>Previous</Text>
        </TouchableOpacity>
        {state.index < questions.length - 1 ? (
          <TouchableOpacity style={styles.primaryButtonCompact} onPress={() => setState((prev) => ({ ...prev, index: prev.index + 1 }))}>
            <Text style={styles.primaryButtonText}>Next</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.primaryButtonCompact, submitting && styles.disabled]} disabled={submitting} onPress={onSubmit}>
            <Text style={styles.primaryButtonText}>{submitting ? 'Submitting...' : 'Submit'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function UpgradeModal({ visible, onClose, onUpgrade }) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Premium feature</Text>
          <Text style={styles.modalText}>This Language Pro activity is available for Premium students. Upgrade to unlock the full experience.</Text>
          <TouchableOpacity style={styles.modalPrimaryBtn} onPress={onUpgrade}>
            <Text style={styles.modalPrimaryText}>Upgrade Now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalSecondaryBtn} onPress={onClose}>
            <Text style={styles.modalSecondaryText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function AudioPlayerCard({ title, uri, audioState, onTogglePlayback, onSeek }) {
  const isActive = audioState.uri === uri;
  const duration = isActive ? (audioState.durationMillis || 0) : 0;
  const position = isActive ? (audioState.positionMillis || 0) : 0;
  const progress = duration > 0 ? `${Math.min(100, Math.round((position / duration) * 100))}%` : '0%';

  return (
    <View style={styles.audioCard}>
      <Text style={styles.audioTitle}>{title}</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: progress }]} />
      </View>
      <Text style={styles.audioMeta}>{`${formatTime(position)} / ${formatTime(duration)}`}</Text>
      <View style={styles.audioButtonsRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => onSeek(-10000)} disabled={!isActive}>
          <Text style={styles.secondaryButtonText}>-10s</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButtonCompact} onPress={() => onTogglePlayback(uri)}>
          <Text style={styles.primaryButtonText}>{isActive && audioState.playing ? 'Pause' : 'Play'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => onSeek(10000)} disabled={!isActive}>
          <Text style={styles.secondaryButtonText}>+10s</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function LanguageProScreen() {
  const router = useRouter();
  const { isPremium, plan, loading: subscriptionLoading } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [screenError, setScreenError] = useState('');
  const [skillsProfile, setSkillsProfile] = useState({});
  const [studentProfile, setStudentProfile] = useState({});
  const [treePayload, setTreePayload] = useState({});
  const [fallbackSections, setFallbackSections] = useState([]);
  const [view, setView] = useState('landing');
  const [resourceType, setResourceType] = useState('personalized');
  const [activeFocusArea, setActiveFocusArea] = useState('Listening');
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [activeActivityKey, setActiveActivityKey] = useState('listen');
  const [contentCache, setContentCache] = useState({});
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizState, setQuizState] = useState(emptyRunnerState);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState('idle');
  const [recordedUri, setRecordedUri] = useState('');
  const [recordingFeedback, setRecordingFeedback] = useState(null);
  const [recordingSubmitting, setRecordingSubmitting] = useState(false);
  const [audioState, setAudioState] = useState({ uri: '', playing: false, positionMillis: 0, durationMillis: 0 });

  const soundRef = useRef(null);
  const recordingRef = useRef(null);

  const communicationRatings = useMemo(() => ({
    Listening: skillsProfile?.englishCommunicationRating?.Listening || skillsProfile?.communicationRatings?.Listening || skillsProfile?.listeningRating || 'Beginner',
    Speaking: skillsProfile?.englishCommunicationRating?.Speaking || skillsProfile?.communicationRatings?.Speaking || skillsProfile?.speakingRating || 'Beginner',
    Reading: skillsProfile?.englishCommunicationRating?.Reading || skillsProfile?.communicationRatings?.Reading || skillsProfile?.readingRating || 'Beginner',
    Writing: skillsProfile?.englishCommunicationRating?.Writing || skillsProfile?.communicationRatings?.Writing || skillsProfile?.writingRating || 'Beginner',
  }), [skillsProfile]);

  const activeLevel = communicationRatings[activeFocusArea] || 'Beginner';
  const studentClass = useMemo(() => extractStudentClass(studentProfile, skillsProfile), [studentProfile, skillsProfile]);

  const treeSections = useMemo(
    () => buildSectionsFromTree(treePayload, resourceType, studentClass),
    [treePayload, resourceType, studentClass],
  );

  const sections = treeSections.length ? treeSections : fallbackSections;
  const activityCacheKey = `${resourceType}:${activeFocusArea}:${activeLevel}:${studentClass}:${selectedChapter?.id || 'none'}:${activeActivityKey}`;
  const currentActivityContent = contentCache[activityCacheKey] || null;
  const activityTabs = useMemo(() => {
    const mergedTabs = extractActivityEntries(selectedChapter || {});
    if (currentActivityContent?.writingPrompt || currentActivityContent?.write) {
      const hasWrite = mergedTabs.some((item) => item.key === 'write');
      if (!hasWrite) mergedTabs.push({ key: 'write', label: '✍️ Writing', isPremium: false });
    }
    return mergedTabs;
  }, [selectedChapter, currentActivityContent]);

  const selectedActivity = activityTabs.find((item) => item.key === activeActivityKey) || activityTabs[0] || ACTIVITY_CATALOG[0];

  const isLockedForCurrentUser = useCallback((item) => Boolean(item?.isPremium) && !isPremium, [isPremium]);
  const openUpgrade = useCallback(() => setShowUpgradeModal(true), []);
  const closeUpgrade = useCallback(() => setShowUpgradeModal(false), []);

  const unloadSound = useCallback(async () => {
    if (!soundRef.current) return;
    try {
      soundRef.current.setOnPlaybackStatusUpdate(null);
      await soundRef.current.unloadAsync();
    } catch {
      // Best effort cleanup only.
    } finally {
      soundRef.current = null;
      setAudioState({ uri: '', playing: false, positionMillis: 0, durationMillis: 0 });
    }
  }, []);

  useEffect(() => () => {
    unloadSound();
    if (recordingRef.current) {
      recordingRef.current.stopAndUnloadAsync().catch(() => {});
    }
  }, [unloadSound]);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setScreenError('');
    try {
      const [skillsResponse, profileResponse, treeResponse] = await Promise.all([
        studentService.getSkillsProfile().catch(() => ({})),
        studentService.getProfile().catch(() => ({})),
        studentService.getLanguageProTree().catch(() => ({})),
      ]);
      setSkillsProfile(unwrap(skillsResponse));
      setStudentProfile(unwrap(profileResponse));
      setTreePayload(unwrap(treeResponse));
    } catch (error) {
      setScreenError(toMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const loadFallbackTopics = useCallback(async () => {
    try {
      const response = await studentService.getLanguageProTopics({
        resourceType,
        focusArea: activeFocusArea,
        level: resourceType === 'personalized' ? activeLevel : '',
        mode: 'listen',
      });
      setFallbackSections(buildFallbackSectionsFromTopics(response, studentClass, activeLevel));
    } catch {
      setFallbackSections([]);
    }
  }, [resourceType, activeFocusArea, activeLevel, studentClass]);

  useEffect(() => {
    if (view !== 'resources' || treeSections.length > 0) return;
    loadFallbackTopics();
  }, [view, treeSections.length, loadFallbackTopics]);

  useEffect(() => {
    if (!selectedChapter) return;
    const firstTab = activityTabs[0]?.key || 'listen';
    if (!activityTabs.some((tab) => tab.key === activeActivityKey)) {
      setActiveActivityKey(firstTab);
    }
  }, [selectedChapter, activityTabs, activeActivityKey]);

  useEffect(() => {
    setQuizState(emptyRunnerState);
    setQuizQuestions([]);
    setActivityError('');
    setRecordedUri('');
    setRecordingFeedback(null);
    setRecordingStatus('idle');
  }, [selectedChapter?.id, activeActivityKey]);

  const togglePlayback = useCallback(async (uri) => {
    if (!uri) return;
    try {
      if (soundRef.current && audioState.uri === uri) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await soundRef.current.pauseAsync();
        } else if (status.isLoaded) {
          await soundRef.current.playAsync();
        }
        return;
      }

      await unloadSound();
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, progressUpdateIntervalMillis: 250 },
        (status) => {
          if (!status.isLoaded) return;
          setAudioState({
            uri,
            playing: status.isPlaying,
            positionMillis: status.positionMillis || 0,
            durationMillis: status.durationMillis || 0,
          });
        },
      );
      soundRef.current = sound;
    } catch (error) {
      setActivityError(toMessage(error, 'Unable to play audio right now.'));
    }
  }, [audioState.uri, unloadSound]);

  const seekAudio = useCallback(async (offset) => {
    if (!soundRef.current || !audioState.uri) return;
    try {
      const status = await soundRef.current.getStatusAsync();
      if (!status.isLoaded) return;
      const nextPosition = Math.max(0, Math.min((status.durationMillis || 0), (status.positionMillis || 0) + offset));
      await soundRef.current.setPositionAsync(nextPosition);
    } catch {
      // Ignore seek errors; playback can continue from the current position.
    }
  }, [audioState.uri]);

  const loadActivityContent = useCallback(async () => {
    if (!selectedChapter) return;
    if (isLockedForCurrentUser(selectedActivity)) {
      openUpgrade();
      return;
    }
    if (contentCache[activityCacheKey]) return;

    const embedded = toContentObject(extractEmbeddedActivityContent(selectedChapter, activeActivityKey));
    setActivityLoading(true);
    setActivityError('');
    try {
      const response = await studentService.getLanguageProTopicContent(selectedChapter.id, {
        resourceType,
        focusArea: activeFocusArea,
        level: resourceType === 'personalized' ? activeLevel : '',
        mode: activeActivityKey,
        classValue: studentClass,
        activity: activeActivityKey,
      });
      let payload = toContentObject(unwrap(response));
      payload = mergeContent(embedded, payload);
      setContentCache((prev) => ({ ...prev, [activityCacheKey]: payload }));

      if (activeActivityKey === 'understanding') {
        let questions = normalizeQuizQuestions(payload);
        if (!questions.length) {
          const questionResponse = await studentService.getLanguageProQuestions(selectedChapter.id, {
            resourceType,
            focusArea: activeFocusArea,
            level: resourceType === 'personalized' ? activeLevel : '',
            mode: activeActivityKey,
            classValue: studentClass,
            activity: activeActivityKey,
          });
          questions = normalizeQuizQuestions(questionResponse);
        }
        setQuizQuestions(questions);
      }
    } catch (error) {
      if (isPremiumAccessError(error)) {
        openUpgrade();
      } else if (embedded) {
        setContentCache((prev) => ({ ...prev, [activityCacheKey]: embedded }));
        if (activeActivityKey === 'understanding') {
          setQuizQuestions(normalizeQuizQuestions(embedded));
        }
      } else {
        setActivityError(toMessage(error, 'Unable to load this activity right now.'));
      }
    } finally {
      setActivityLoading(false);
    }
  }, [
    selectedChapter,
    selectedActivity,
    contentCache,
    activityCacheKey,
    isLockedForCurrentUser,
    openUpgrade,
    activeActivityKey,
    resourceType,
    activeFocusArea,
    activeLevel,
    studentClass,
  ]);

  useEffect(() => {
    if (!selectedChapter) return;
    loadActivityContent();
  }, [selectedChapter, activeActivityKey, loadActivityContent]);

  const openResourceType = useCallback((nextType) => {
    setResourceType(nextType);
    setSelectedChapter(null);
    setActiveActivityKey('listen');
    setView('resources');
  }, []);

  const handleSelectChapter = useCallback((chapter) => {
    if (isLockedForCurrentUser(chapter)) {
      openUpgrade();
      return;
    }
    setSelectedChapter(chapter);
  }, [isLockedForCurrentUser, openUpgrade]);

  const submitQuiz = useCallback(async () => {
    if (!selectedChapter) return;
    setQuizSubmitting(true);
    setActivityError('');
    const fallbackResult = getAnswerStats(quizQuestions, quizState.answers);
    try {
      const answers = quizQuestions.map((question, index) => {
        const questionId = String(question?.questionId || question?.id || question?.__id || index);
        const selectedIndex = quizState.answers[String(question?.__id || question?.id || index)];
        if (selectedIndex === undefined || selectedIndex === null) return null;
        const option = normalizeQuestionOptions(question)[selectedIndex];
        return {
          questionId,
          selectedOptionIndex: selectedIndex,
          selectedOptionId: option?.id,
          selectedAnswer: option?.text,
          order: index,
        };
      }).filter(Boolean);
      const response = await studentService.submitLanguageProQuiz(selectedChapter.id, { answers }, {
        resourceType,
        focusArea: activeFocusArea,
        level: resourceType === 'personalized' ? activeLevel : '',
        mode: activeActivityKey,
        classValue: studentClass,
        activity: activeActivityKey,
      });
      const payload = unwrap(response);
      const result = payload?.result || payload?.report || payload?.scorecard || payload;
      setQuizState((prev) => ({
        ...prev,
        submitted: true,
        result: {
          ...fallbackResult,
          score: Number(result?.score ?? result?.correct ?? fallbackResult.score),
          correct: Number(result?.correct ?? fallbackResult.correct),
          wrong: Number(result?.wrong ?? fallbackResult.wrong),
          unanswered: Number(result?.unanswered ?? fallbackResult.unanswered),
          totalPossible: Number(result?.total ?? result?.totalQuestions ?? fallbackResult.totalPossible),
          message: result?.message || result?.summary || '',
        },
      }));
    } catch (error) {
      if (isPremiumAccessError(error)) {
        openUpgrade();
      } else {
        setActivityError(toMessage(error, 'Unable to submit answers right now. Showing local score instead.'));
        setQuizState((prev) => ({ ...prev, submitted: true, result: fallbackResult }));
      }
    } finally {
      setQuizSubmitting(false);
    }
  }, [
    selectedChapter,
    quizQuestions,
    quizState.answers,
    resourceType,
    activeFocusArea,
    activeLevel,
    activeActivityKey,
    studentClass,
    openUpgrade,
  ]);

  const startRecording = useCallback(async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Microphone permission needed', 'Please allow microphone access so you can record and submit your speaking activity.');
        return;
      }
      await unloadSound();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
      setRecordingStatus('recording');
      setRecordedUri('');
      setRecordingFeedback(null);
    } catch (error) {
      setActivityError(toMessage(error, 'Unable to start recording right now.'));
    }
  }, [unloadSound]);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      setRecordedUri(uri || '');
      setRecordingStatus(uri ? 'recorded' : 'idle');
    } catch (error) {
      setActivityError(toMessage(error, 'Unable to finish recording.'));
      setRecordingStatus('idle');
    }
  }, []);

  const submitRecording = useCallback(async () => {
    if (!selectedChapter || !recordedUri) return;
    setRecordingSubmitting(true);
    setActivityError('');
    try {
      const form = new FormData();
      form.append('file', {
        uri: recordedUri,
        name: buildRecordingFileName(),
        type: 'audio/m4a',
      });
      form.append('topicId', String(selectedChapter.id));
      form.append('activity', activeActivityKey);
      form.append('resourceType', resourceType);
      form.append('focusArea', activeFocusArea);
      form.append('level', activeLevel);
      if (studentClass) form.append('class', studentClass);
      // Keep recording upload metadata with the file so the backend fallbacks can grade/store the same blob across deployments.
      const response = await studentService.uploadLanguageProRecording(selectedChapter.id, form, {
        resourceType,
        focusArea: activeFocusArea,
        level: resourceType === 'personalized' ? activeLevel : '',
        mode: activeActivityKey,
        classValue: studentClass,
        activity: activeActivityKey,
      });
      setRecordingFeedback(unwrap(response));
    } catch (error) {
      if (isPremiumAccessError(error)) {
        openUpgrade();
      } else {
        setActivityError(toMessage(error, 'Unable to submit your recording right now.'));
      }
    } finally {
      setRecordingSubmitting(false);
    }
  }, [selectedChapter, recordedUri, activeActivityKey, resourceType, activeFocusArea, activeLevel, studentClass, openUpgrade]);

  const audioAssets = useMemo(() => extractAudioAssets(currentActivityContent || {}), [currentActivityContent]);
  const attachments = useMemo(() => extractAttachments(currentActivityContent || {}), [currentActivityContent]);
  const contentText = useMemo(
    () => currentActivityContent?.content || currentActivityContent?.text || currentActivityContent?.body || currentActivityContent?.description || currentActivityContent?.passage || currentActivityContent?.readingPassage || '',
    [currentActivityContent],
  );
  const speakingPrompt = currentActivityContent?.prompt || currentActivityContent?.speakingPrompt || currentActivityContent?.recordPrompt || currentActivityContent?.question || '';
  const writingPrompt = currentActivityContent?.writingPrompt || currentActivityContent?.prompt || currentActivityContent?.write || currentActivityContent?.writing || '';

  const renderActivityPanel = () => {
    if (!selectedChapter) {
      return (
        <View style={styles.emptyStateCard}>
          <Text style={styles.emptyTitle}>Select a topic to view content</Text>
          <Text style={styles.placeholderText}>Choose a chapter from the list above to open its Language Pro activities.</Text>
        </View>
      );
    }

    if (activityLoading) {
      return (
        <View style={styles.emptyStateCard}>
          <ActivityIndicator color={STUDENT.accentCyan} />
          <Text style={styles.placeholderText}>Loading activity…</Text>
        </View>
      );
    }

    if (activeActivityKey === 'listen') {
      return (
        <View style={styles.contentCard}>
          <Text style={styles.contentCardTitle}>Listening</Text>
          {audioAssets.length > 0 ? audioAssets.map((item, index) => (
            <AudioPlayerCard
              key={`${item.url}-${index}`}
              title={item.label || `Audio ${index + 1}`}
              uri={item.url}
              audioState={audioState}
              onTogglePlayback={togglePlayback}
              onSeek={seekAudio}
            />
          )) : <Text style={styles.placeholderText}>No audio file is available for this topic yet.</Text>}
          {contentText ? <RichText html={contentText} textStyle={styles.contentBody} /> : null}
        </View>
      );
    }

    if (activeActivityKey === 'read_speak') {
      return (
        <View style={styles.contentCard}>
          <Text style={styles.contentCardTitle}>Read & Speak</Text>
          {contentText ? <RichText html={contentText} textStyle={styles.contentBody} /> : <Text style={styles.placeholderText}>No passage is available for this activity yet.</Text>}
          {speakingPrompt ? (
            <View style={styles.promptCard}>
              <Text style={styles.promptTitle}>Speaking Prompt</Text>
              <RichText html={speakingPrompt} textStyle={styles.promptText} />
            </View>
          ) : null}
        </View>
      );
    }

    if (activeActivityKey === 'record_voice') {
      return (
        <View style={styles.contentCard}>
          <Text style={styles.contentCardTitle}>Record Your Voice</Text>
          {speakingPrompt ? <RichText html={speakingPrompt} textStyle={styles.contentBody} /> : <Text style={styles.placeholderText}>Read the passage aloud and submit your recording for feedback.</Text>}
          <View style={styles.audioButtonsRow}>
            {recordingStatus === 'recording' ? (
              <TouchableOpacity style={styles.primaryButtonCompact} onPress={stopRecording}>
                <Text style={styles.primaryButtonText}>Stop Recording</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.primaryButtonCompact} onPress={startRecording}>
                <Text style={styles.primaryButtonText}>{recordedUri ? 'Record Again' : 'Start Recording'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.secondaryButton, (!recordedUri || recordingSubmitting) && styles.disabled]} disabled={!recordedUri || recordingSubmitting} onPress={submitRecording}>
              <Text style={styles.secondaryButtonText}>{recordingSubmitting ? 'Submitting...' : 'Submit Recording'}</Text>
            </TouchableOpacity>
          </View>
          {recordedUri ? (
            <AudioPlayerCard
              title="Your recording"
              uri={recordedUri}
              audioState={audioState}
              onTogglePlayback={togglePlayback}
              onSeek={seekAudio}
            />
          ) : null}
          {recordingFeedback ? (
            <View style={styles.feedbackCard}>
              <Text style={styles.promptTitle}>Feedback</Text>
              <Text style={styles.contentBodyText}>{recordingFeedback?.message || recordingFeedback?.summary || recordingFeedback?.feedback || 'Your recording has been submitted successfully.'}</Text>
              {(recordingFeedback?.score ?? recordingFeedback?.rating) != null ? <Text style={styles.feedbackScore}>{`Score: ${recordingFeedback?.score ?? recordingFeedback?.rating}`}</Text> : null}
            </View>
          ) : null}
        </View>
      );
    }

    if (activeActivityKey === 'understanding') {
      return <QuestionRunner questions={quizQuestions} state={quizState} setState={setQuizState} onSubmit={submitQuiz} submitting={quizSubmitting} />;
    }

    return (
      <View style={styles.contentCard}>
        <Text style={styles.contentCardTitle}>Writing</Text>
        {writingPrompt ? <RichText html={writingPrompt} textStyle={styles.contentBody} /> : <Text style={styles.placeholderText}>No writing prompt is available for this topic yet.</Text>}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <View style={styles.centerWrap}>
          <ActivityIndicator color={STUDENT.accent} size="large" />
          <Text style={styles.placeholderText}>Loading Language Pro…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (view === 'landing') {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>Language Pro</Text>
            <Text style={styles.heroSubtitle}>Where Confidence Meets Communication</Text>
            <Text style={styles.heroBody}>
              Build confidence in listening, speaking, reading, and writing through guided Language Pro resources tailored to your class and current communication level.
            </Text>
          </View>

          {screenError ? <Text style={styles.errorText}>{screenError}</Text> : null}

          {LANDING_CARDS.map((card) => (
            <TouchableOpacity key={card.key} style={styles.landingCard} onPress={() => openResourceType(card.key)}>
              <Text style={styles.landingTitle}>{card.title}</Text>
              <Text style={styles.landingSub}>{card.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => { setView('landing'); setSelectedChapter(null); }}>
          <Text style={styles.backText}>← Back to Language Pro</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{resourceType === 'personalized' ? 'Personalized Resources' : 'School Resources'}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.topBanner}>
          <Text style={styles.topBannerTitle}>{resourceType === 'personalized' ? 'Personalized Resources' : 'School Resources'}</Text>
          <Text style={styles.topBannerSub}>Where Confidence Meets Communication</Text>
        </View>

        <View style={styles.focusPanel}>
          <View style={styles.focusHeaderRow}>
            <Text style={styles.focusHeading}>Focus Areas</Text>
            <Text style={styles.planChipText}>{subscriptionLoading ? 'Plan: Checking…' : `Plan: ${plan || 'Free'}`}</Text>
          </View>
          <View style={styles.focusRow}>
            {FOCUS_AREAS.map((focus) => {
              const active = activeFocusArea === focus.key;
              const badge = levelBadge(communicationRatings[focus.key]);
              return (
                <TouchableOpacity key={focus.key} style={[styles.focusChip, active && styles.focusChipActive]} onPress={() => setActiveFocusArea(focus.key)}>
                  <Text style={styles.focusChipTitle}>{`${focus.emoji} ${focus.key}`}</Text>
                  <View style={[styles.levelBadge, { backgroundColor: badge.background }]}>
                    <Text style={[styles.levelBadgeText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.classLabel}>{studentClass ? `Class: ${studentClass}` : 'Class not available yet'}</Text>
        </View>

        {screenError ? <Text style={styles.errorText}>{screenError}</Text> : null}
        {activityError ? <Text style={styles.errorText}>{activityError}</Text> : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Topics</Text>
          <Text style={styles.sectionDescription}>Content tailored to help you improve: Reading, Listening, Writing, Speaking</Text>
          {sections.length > 0 ? sections.map((section) => (
            <View key={section.id} style={styles.chapterGroup}>
              <Text style={styles.chapterGroupTitle}>{section.title}{section.levelName ? ` (${section.levelName})` : ''}</Text>
              {section.description ? <Text style={styles.chapterGroupSub}>{section.description}</Text> : null}
              {section.chapters.map((chapter) => {
                const active = String(selectedChapter?.id) === String(chapter.id);
                const locked = isLockedForCurrentUser(chapter);
                return (
                  <TouchableOpacity key={chapter.id} style={[styles.chapterCard, active && styles.chapterCardActive]} onPress={() => handleSelectChapter(chapter)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.chapterTitle}>{locked ? '🔒 ' : ''}{chapter.name}</Text>
                      {chapter.description ? <Text style={styles.chapterDesc}>{chapter.description}</Text> : null}
                    </View>
                    <Text style={styles.chapterChevron}>›</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )) : (
            <View style={styles.emptyStateCard}>
              <Text style={styles.placeholderText}>No Language Pro chapters are available for this view yet.</Text>
            </View>
          )}
        </View>

        {selectedChapter ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{selectedChapter.name}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
              {activityTabs.map((activity) => {
                const active = activity.key === activeActivityKey;
                const locked = isLockedForCurrentUser(activity);
                return (
                  <TouchableOpacity
                    key={activity.key}
                    style={[styles.modeTab, active && styles.modeTabActive]}
                    onPress={() => {
                      if (locked) {
                        openUpgrade();
                        return;
                      }
                      setActiveActivityKey(activity.key);
                    }}
                  >
                    <Text style={[styles.modeTabText, active && styles.modeTabTextActive]}>{locked ? '🔒 ' : ''}{activity.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {renderActivityPanel()}

        {attachments.length > 0 ? (
          <View style={styles.contentCard}>
            <Text style={styles.contentCardTitle}>Resources</Text>
            {attachments.map((item, index) => (
              <TouchableOpacity key={`${item.url}-${index}`} style={styles.attachmentRow} onPress={() => Linking.openURL(item.url).catch(() => {})}>
                <Text style={styles.attachmentText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <UpgradeModal
        visible={showUpgradeModal}
        onClose={closeUpgrade}
        onUpgrade={() => {
          closeUpgrade();
          router.push('/student/account');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 28 },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  heroCard: {
    borderRadius: 20,
    backgroundColor: STUDENT.bgCard,
    borderWidth: 1,
    borderColor: STUDENT.border,
    padding: 18,
    marginBottom: 16,
  },
  heroTitle: { color: STUDENT.textPrimary, fontSize: 26, fontWeight: '900' },
  heroSubtitle: { color: '#facc15', fontSize: 15, fontWeight: '700', marginTop: 6 },
  heroBody: { color: STUDENT.textSecondary, marginTop: 10, lineHeight: 21, fontSize: 13 },
  landingCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: STUDENT.borderBlue,
    backgroundColor: '#0c1c38',
    padding: 18,
    marginBottom: 12,
  },
  landingTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  landingSub: { color: '#bfdbfe', fontSize: 13, marginTop: 6 },
  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: STUDENT.border,
  },
  backText: { color: STUDENT.accentCyan, fontWeight: '700', fontSize: 13 },
  headerTitle: { color: STUDENT.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 8 },
  topBanner: {
    borderRadius: 18,
    backgroundColor: '#facc15',
    padding: 16,
    marginBottom: 14,
  },
  topBannerTitle: { color: '#111827', fontWeight: '900', fontSize: 20 },
  topBannerSub: { color: '#374151', marginTop: 4, fontWeight: '700', fontSize: 13 },
  focusPanel: {
    borderRadius: 18,
    backgroundColor: 'rgba(6,182,212,0.18)',
    borderWidth: 1,
    borderColor: STUDENT.borderCyan,
    padding: 14,
    marginBottom: 14,
  },
  focusHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 12 },
  focusHeading: { color: STUDENT.textPrimary, fontSize: 15, fontWeight: '800' },
  focusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  focusChip: {
    width: '48%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: STUDENT.border,
    backgroundColor: 'rgba(15,23,42,0.55)',
    padding: 10,
  },
  focusChipActive: { borderColor: STUDENT.accentCyan, backgroundColor: 'rgba(6,182,212,0.18)' },
  focusChipTitle: { color: STUDENT.textPrimary, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  classLabel: { color: '#e0f2fe', marginTop: 10, fontWeight: '700', fontSize: 12 },
  levelBadge: { borderRadius: 999, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3 },
  levelBadgeText: { fontSize: 10, fontWeight: '900' },
  planChipText: {
    alignSelf: 'flex-start',
    color: STUDENT.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: STUDENT.border,
    backgroundColor: STUDENT.bgCard,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sectionCard: {
    borderRadius: 18,
    backgroundColor: STUDENT.bgCard,
    borderWidth: 1,
    borderColor: STUDENT.border,
    padding: 14,
    marginBottom: 14,
  },
  sectionTitle: { color: STUDENT.textPrimary, fontSize: 17, fontWeight: '800' },
  sectionDescription: { color: STUDENT.textSecondary, marginTop: 6, fontSize: 12, lineHeight: 18 },
  chapterGroup: { marginTop: 14 },
  chapterGroupTitle: { color: '#fef08a', fontWeight: '800', fontSize: 13 },
  chapterGroupSub: { color: STUDENT.textMuted, marginTop: 4, fontSize: 12, lineHeight: 18 },
  chapterCard: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: STUDENT.border,
    backgroundColor: STUDENT.bgCardAlt,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chapterCardActive: { borderColor: STUDENT.accentCyan, backgroundColor: 'rgba(6,182,212,0.12)' },
  chapterTitle: { color: STUDENT.textPrimary, fontSize: 14, fontWeight: '700' },
  chapterDesc: { color: STUDENT.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 18 },
  chapterChevron: { color: STUDENT.textMuted, fontSize: 20, fontWeight: '800' },
  tabRow: { gap: 8, paddingTop: 10 },
  modeTab: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: STUDENT.border,
    backgroundColor: STUDENT.bgCardAlt,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  modeTabActive: { borderColor: STUDENT.accent, backgroundColor: STUDENT.accent },
  modeTabText: { color: STUDENT.textSecondary, fontSize: 12, fontWeight: '700' },
  modeTabTextActive: { color: '#fff' },
  emptyStateCard: {
    borderRadius: 18,
    backgroundColor: STUDENT.bgCard,
    borderWidth: 1,
    borderColor: STUDENT.border,
    padding: 18,
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  emptyTitle: { color: STUDENT.textPrimary, fontSize: 18, fontWeight: '800' },
  placeholderText: { color: STUDENT.textMuted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  contentCard: {
    borderRadius: 18,
    backgroundColor: STUDENT.bgCard,
    borderWidth: 1,
    borderColor: STUDENT.border,
    padding: 16,
    marginBottom: 14,
  },
  contentCardTitle: { color: STUDENT.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 10 },
  contentBody: { color: STUDENT.textSecondary, fontSize: 13, lineHeight: 21 },
  contentBodyText: { color: STUDENT.textSecondary, fontSize: 13, lineHeight: 21 },
  promptCard: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: STUDENT.bgCardAlt,
    borderWidth: 1,
    borderColor: STUDENT.border,
    padding: 12,
  },
  promptTitle: { color: '#fef08a', fontWeight: '800', marginBottom: 6, fontSize: 13 },
  promptText: { color: STUDENT.textSecondary, fontSize: 13, lineHeight: 20 },
  audioCard: {
    borderRadius: 14,
    backgroundColor: STUDENT.bgCardAlt,
    borderWidth: 1,
    borderColor: STUDENT.border,
    padding: 12,
    marginBottom: 10,
  },
  audioTitle: { color: STUDENT.textPrimary, fontWeight: '700', fontSize: 13 },
  audioMeta: { color: STUDENT.textMuted, fontSize: 12, marginTop: 8 },
  audioButtonsRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: { height: '100%', backgroundColor: STUDENT.accentCyan },
  feedbackCard: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: STUDENT.border,
    paddingTop: 14,
  },
  feedbackScore: { color: STUDENT.accentGreen, fontWeight: '800', marginTop: 8 },
  questionMeta: { color: STUDENT.textMuted, fontSize: 12, marginTop: 8, marginBottom: 10 },
  questionText: { color: STUDENT.textPrimary, fontSize: 15, lineHeight: 23, fontWeight: '700' },
  optionList: { gap: 8, marginTop: 12 },
  optionCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: STUDENT.border,
    backgroundColor: STUDENT.bgCardAlt,
    padding: 10,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  optionCardActive: { borderColor: STUDENT.accentCyan, backgroundColor: 'rgba(6,182,212,0.14)' },
  optionMarker: {
    width: 26,
    height: 26,
    borderRadius: 13,
    textAlign: 'center',
    lineHeight: 24,
    borderWidth: 1,
    borderColor: STUDENT.border,
    color: STUDENT.textMuted,
    fontWeight: '800',
    fontSize: 12,
  },
  optionMarkerActive: { color: STUDENT.accentCyan, borderColor: STUDENT.accentCyan },
  optionTextWrap: { flex: 1 },
  optionText: { color: STUDENT.textSecondary, fontSize: 13, lineHeight: 20 },
  quizNav: { flexDirection: 'row', gap: 10, marginTop: 14 },
  primaryButton: {
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: STUDENT.accent,
    alignItems: 'center',
    paddingVertical: 12,
  },
  primaryButtonCompact: {
    borderRadius: 12,
    backgroundColor: STUDENT.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryButtonText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: STUDENT.border,
    backgroundColor: STUDENT.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: { color: STUDENT.textSecondary, fontWeight: '700', fontSize: 13 },
  disabled: { opacity: 0.55 },
  resultScore: { color: STUDENT.accentGreen, fontSize: 34, fontWeight: '900' },
  resultSummary: { color: STUDENT.textSecondary, marginTop: 8, lineHeight: 20, fontSize: 13 },
  attachmentRow: {
    borderTopWidth: 1,
    borderTopColor: STUDENT.border,
    paddingTop: 10,
    marginTop: 10,
  },
  attachmentText: { color: '#93c5fd', fontWeight: '700', fontSize: 13 },
  errorText: { color: '#fda4af', fontSize: 12, marginBottom: 10, lineHeight: 18 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.68)', justifyContent: 'center', padding: 22 },
  modalCard: {
    borderRadius: 18,
    backgroundColor: STUDENT.bgCard,
    borderWidth: 1,
    borderColor: STUDENT.border,
    padding: 18,
  },
  modalTitle: { color: STUDENT.textPrimary, fontSize: 18, fontWeight: '900' },
  modalText: { color: STUDENT.textSecondary, marginTop: 8, lineHeight: 21, fontSize: 13 },
  modalPrimaryBtn: { marginTop: 16, borderRadius: 12, backgroundColor: STUDENT.accent, alignItems: 'center', paddingVertical: 12 },
  modalPrimaryText: { color: '#fff', fontWeight: '800' },
  modalSecondaryBtn: { marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: STUDENT.border, alignItems: 'center', paddingVertical: 12 },
  modalSecondaryText: { color: STUDENT.textSecondary, fontWeight: '700' },
});
