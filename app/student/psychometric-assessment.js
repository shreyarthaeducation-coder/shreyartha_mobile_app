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
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { STUDENT } from '../../constants/theme';
import { studentService } from '../../services/studentService';
import { useSubscription } from '../../context/SubscriptionContext';

const arr = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const unwrap = (value) => (value?.data && typeof value.data === 'object' ? value.data : value || {});
const labelOf = (node, fallback = '') => String(node?.title || node?.name || node?.label || fallback || '').trim();
const toMessage = (err) => err?.response?.data?.message || err?.message || 'Server error. Please try again.';
const isPremiumAccessError = (err) => [402, 403].includes(err?.response?.status || err?.status)
  || /premium|subscription|upgrade|paid/i.test(toMessage(err));

const normalizeQuestionOptions = (question) => {
  const options = arr(question?.options || question?.choices || question?.answers || question?.answerOptions || question?.mcqOptions);
  if (options.length > 0) {
    return options.map((option, index) => (typeof option === 'string'
      ? { id: `${index}`, text: option }
      : {
        id: String(option.id || option.optionId || option.key || index),
        text: option.text || option.label || option.option || option.value || `Option ${index + 1}`,
      }));
  }
  const optionKeys = Object.keys(question || {}).filter((key) => /^option[A-Za-z0-9]*$/.test(key)).sort();
  return optionKeys.map((key, index) => ({ id: `${index}`, text: String(question[key]) })).filter((option) => option.text && option.text !== 'undefined' && option.text !== 'null');
};

const normalizeHistory = (historyPayload) => arr(historyPayload)
  .map((item, index) => {
    const score = item?.score ?? item?.totalScore ?? item?.obtainedMarks;
    const total = item?.total ?? item?.maxScore ?? item?.totalQuestions;
    const percent = item?.percentage ?? item?.percent;
    const date = item?.attemptedAt || item?.submittedAt || item?.createdAt || item?.date;
    return {
      id: String(item?.id || item?.attemptId || index),
      label: String(item?.label || item?.name || (date ? new Date(date).toLocaleDateString() : `Attempt ${index + 1}`)),
      score: score != null ? `${score}${total != null ? ` / ${total}` : ''}` : (percent != null ? `${percent}%` : 'Completed'),
    };
  });

const isCategoryPremium = (item = {}) => {
  const explicitFlags = [item?.isPremium, item?.premium, item?.premiumOnly, item?.isLocked];
  for (let i = 0; i < explicitFlags.length; i += 1) {
    if (typeof explicitFlags[i] === 'boolean') return explicitFlags[i];
  }
  const text = String(item?.accessLevel || item?.tier || item?.plan || item?.type || item?.visibility || '').toLowerCase();
  return ['premium', 'pro', 'paid', 'locked'].some((key) => text.includes(key));
};

const normalizeCategories = (payload) => {
  const data = unwrap(payload);
  const list = arr(data?.categories || data?.assessments || data?.items || data?.tabs || payload);
  return list.map((item, index) => ({
    id: item?.categoryId || item?.assessmentId || item?.id || item?.slug || item?.code || `${index}`,
    name: labelOf(item, `Assessment ${index + 1}`),
    isPremium: isCategoryPremium(item),
    history: normalizeHistory(item?.history || item?.attempts || item?.previousAttempts),
    raw: item,
  })).filter((item) => item.name);
};

const normalizeInstructions = (payload, fallbackName) => {
  const data = unwrap(payload);
  const bulletSource = data?.instructions || data?.introPoints || data?.points || data?.bullets || data?.descriptionPoints || data?.overview;
  const bullets = arr(bulletSource).map((point) => (typeof point === 'string' ? point : point?.text || point?.description || point?.content || '')).filter(Boolean);
  if (!bullets.length) {
    const introText = data?.intro || data?.description || data?.content || data?.note;
    if (introText) bullets.push(String(introText));
  }
  return {
    title: labelOf(data, fallbackName || 'Psychometric Assessment'),
    bullets,
    status: String(data?.status || data?.attemptStatus || data?.assessmentStatus || '').toLowerCase(),
    answers: data?.answers || data?.selectedAnswers || null,
    result: data?.result || data?.report || data?.scorecard || null,
    history: normalizeHistory(data?.history || data?.attempts || data?.previousAttempts),
  };
};

const normalizeQuestions = (payload) => {
  const data = unwrap(payload);
  return arr(data?.questions || data?.items || data?.assessmentQuestions || payload).map((question, index) => ({
    ...question,
    __id: String(question?.questionId || question?.qid || question?.id || index),
  }));
};

const isMultiSelectQuestion = (question = {}) => Boolean(
  question?.multiple
  || question?.multiSelect
  || question?.allowsMultiple
  || question?.questionType === 'MULTI_SELECT'
  || question?.questionType === 'multiple'
  || question?.type === 'MULTIPLE'
  || question?.type === 'multi',
);

function ResultCard({ result, onBack, showPremiumBlur, onUpgrade }) {
  const score = result?.score ?? result?.correct ?? result?.totalScore ?? result?.obtainedMarks;
  const total = result?.total ?? result?.totalQuestions ?? result?.maxScore;
  const percentage = result?.percentage ?? result?.percent ?? (score != null && total ? Math.round((score / total) * 100) : null);
  const highlights = arr(result?.traits || result?.strengths || result?.summaryPoints)
    .map((item) => (typeof item === 'string' ? item : item?.title || item?.label || item?.text || item?.description || ''))
    .filter(Boolean);
  const premiumInsights = arr(result?.recommendations || result?.insights || result?.careerRecommendations || result?.nextSteps)
    .map((item) => (typeof item === 'string' ? item : item?.title || item?.label || item?.text || item?.description || ''))
    .filter(Boolean);
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Assessment Report</Text>
        {percentage != null ? <Text style={styles.resultPct}>{`${percentage}%`}</Text> : null}
        {(score != null || total != null) ? <Text style={styles.resultScore}>{`${score ?? 0}${total != null ? ` / ${total}` : ''}`}</Text> : null}
        <Text style={styles.resultSummary}>{String(result?.summary || result?.message || result?.overall || 'Your assessment has been completed successfully.')}</Text>

        {highlights.length > 0 ? (
          <View style={styles.highlightWrap}>
            {highlights.map((text, index) => (
              <View key={`${text}-${index}`} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{text}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {premiumInsights.length > 0 ? (
          <View style={styles.premiumResultWrap}>
            <Text style={styles.premiumTitle}>Detailed Insights</Text>
            {premiumInsights.map((text, index) => (
              <View key={`${text}-${index}`} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{text}</Text>
              </View>
            ))}
            {showPremiumBlur ? (
              <BlurView intensity={55} tint="dark" style={styles.blurOverlay}>
                <Text style={styles.blurTitle}>Premium unlock required</Text>
                <TouchableOpacity style={styles.blurButton} onPress={onUpgrade}>
                  <Text style={styles.blurButtonText}>Upgrade to Premium</Text>
                </TouchableOpacity>
              </BlurView>
            ) : null}
          </View>
        ) : null}

        <TouchableOpacity style={styles.primaryButton} onPress={onBack}>
          <Text style={styles.primaryButtonText}>Back to Assessments</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

export default function PsychometricAssessmentScreen() {
  const router = useRouter();
  const { isPremium, plan, loading: subscriptionLoading } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [instruction, setInstruction] = useState({ title: '', bullets: [], status: '', answers: null, result: null, history: [] });
  const [view, setView] = useState('landing');
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answersMap, setAnswersMap] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const activeCategory = useMemo(() => categories.find((item) => String(item.id) === String(activeCategoryId)) || null, [categories, activeCategoryId]);

  // Central premium gate for this module. Keep this check reusable for other premium-locked features.
  const isCategoryLockedForCurrentUser = useCallback((category) => Boolean(category?.isPremium) && !isPremium, [isPremium]);
  const openUpgrade = useCallback(() => setShowUpgradeModal(true), []);
  const closeUpgrade = useCallback(() => setShowUpgradeModal(false), []);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await studentService.getPsychometricCategories();
      const parsed = normalizeCategories(data);
      setCategories(parsed);
      if (parsed.length > 0) setActiveCategoryId(parsed[0].id);
    } catch (loadError) {
      setError(toMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const loadCategoryDetails = useCallback(async (category) => {
    if (!category) return;
    setError('');
    try {
      const data = await studentService.getPsychometricIntro(category.id);
      setInstruction(normalizeInstructions(data, category.name));
    } catch (detailError) {
      setInstruction({ title: category.name, bullets: [], status: '', answers: null, result: null, history: category?.history || [] });
      setError(toMessage(detailError));
    }
  }, []);

  useEffect(() => {
    if (!activeCategory) return;
    loadCategoryDetails(activeCategory);
  }, [activeCategory, loadCategoryDetails]);

  const loadQuestions = useCallback(async (categoryId) => {
    const data = await studentService.getPsychometricQuestions(categoryId);
    return normalizeQuestions(data);
  }, []);

  const buildInitialAnswers = useCallback((qs, existingAnswers) => {
    if (!existingAnswers) return {};
    const map = {};
    qs.forEach((question, index) => {
      const key = question.__id;
      const options = normalizeQuestionOptions(question);
      const existing = existingAnswers[key] || existingAnswers[question?.id] || existingAnswers[question?.questionId] || existingAnswers[index] || null;
      if (existing == null) return;
      const values = arr(existing);
      const selected = values.map((entry) => {
        if (typeof entry === 'number') {
          const option = options[entry];
          return option ? { index: entry, optionId: option.id, text: option.text } : null;
        }
        if (typeof entry === 'string') {
          const optionIndex = options.findIndex((option) => option.id === entry || option.text === entry);
          if (optionIndex >= 0) {
            const option = options[optionIndex];
            return { index: optionIndex, optionId: option.id, text: option.text };
          }
        }
        if (entry && typeof entry === 'object') {
          const optionId = String(entry?.optionId || entry?.selectedOptionId || entry?.id || '');
          const optionIndex = options.findIndex((option) => option.id === optionId || option.text === entry?.text);
          if (optionIndex >= 0) {
            const option = options[optionIndex];
            return { index: optionIndex, optionId: option.id, text: option.text };
          }
        }
        return null;
      }).filter(Boolean);
      if (!selected.length) return;
      map[key] = isMultiSelectQuestion(question) ? selected : selected[0];
    });
    return map;
  }, []);

  const startAssessment = useCallback(async () => {
    if (!activeCategory) return;
    if (isCategoryLockedForCurrentUser(activeCategory)) {
      openUpgrade();
      return;
    }
    if (instruction.status === 'completed' && instruction.result) {
      setView('result');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const questionList = await loadQuestions(activeCategory.id);
      setQuestions(questionList);
      setCurrentIndex(0);
      setAnswersMap(buildInitialAnswers(questionList, instruction.answers || {}));
      setView('runner');
    } catch (startError) {
      if (isPremiumAccessError(startError)) {
        openUpgrade();
        return;
      }
      setError(toMessage(startError));
    } finally {
      setLoading(false);
    }
  }, [activeCategory, isCategoryLockedForCurrentUser, instruction.status, instruction.result, instruction.answers, openUpgrade, loadQuestions, buildInitialAnswers]);

  const submitAssessment = useCallback(async () => {
    if (!activeCategory) return;
    setSubmitting(true);
    setError('');
    try {
      const answers = questions.map((question, index) => {
        const key = question.__id;
        const selected = answersMap[key];
        if (!selected) return null;
        if (Array.isArray(selected)) {
          const optionIds = selected.map((value) => value.optionId);
          return {
            questionId: question?.questionId || question?.id || key,
            optionIds,
            selectedOptionIds: optionIds,
            selectedOptionIndices: selected.map((value) => value.index),
            selectedAnswers: selected.map((value) => value.text),
            optionId: optionIds[0],
            selectedOptionId: optionIds[0],
            selectedOptionIndex: selected[0]?.index,
            selectedAnswer: selected[0]?.text,
            order: index,
          };
        }
        return {
          questionId: question?.questionId || question?.id || key,
          optionId: selected.optionId,
          selectedOptionId: selected.optionId,
          selectedOptionIndex: selected.index,
          selectedAnswer: selected.text,
          order: index,
        };
      }).filter(Boolean);

      const payload = { categoryId: activeCategory.id, answers };
      const submitResponse = await studentService.submitPsychometricAssessment(activeCategory.id, payload);
      const submitData = unwrap(submitResponse);
      const resultPayload = submitData?.result || submitData?.report || submitData;
      if (resultPayload && Object.keys(resultPayload).length > 0) {
        setInstruction((prev) => ({ ...prev, status: 'completed', result: resultPayload }));
        setView('result');
      } else {
        const resultResponse = await studentService.getPsychometricResult(activeCategory.id);
        setInstruction((prev) => ({ ...prev, status: 'completed', result: unwrap(resultResponse) }));
        setView('result');
      }
    } catch (submitError) {
      if (isPremiumAccessError(submitError)) {
        openUpgrade();
        return;
      }
      setError(toMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }, [activeCategory, questions, answersMap, openUpgrade]);

  const question = questions[currentIndex] || null;
  const options = question ? normalizeQuestionOptions(question) : [];
  const questionSelection = question ? answersMap[question.__id] : null;
  const selectedArray = Array.isArray(questionSelection) ? questionSelection : (questionSelection ? [questionSelection] : []);
  const hasSelection = selectedArray.length > 0;
  const progress = questions.length ? Math.round(((currentIndex + 1) / questions.length) * 100) : 0;
  const questionIsMulti = isMultiSelectQuestion(question || {});
  const maxSelections = Number(question?.maxSelections || question?.maxSelect || question?.maxChoice || 0);

  const startLabel = useMemo(() => {
    if (instruction.status === 'completed') return instruction.result ? 'View Result' : 'Retake Assessment';
    if (instruction.status === 'in_progress' || instruction.status === 'in-progress') return 'Resume Assessment';
    return 'Start Assessment';
  }, [instruction.status, instruction.result]);

  const historyList = instruction.history?.length ? instruction.history : activeCategory?.history || [];
  const showPremiumResultBlur = !isPremium && Boolean(activeCategory?.isPremium);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => (view === 'landing' ? router.back() : setView('landing'))}>
          <Text style={styles.backText}>{view === 'landing' ? '← Back' : '← Assessments'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Psychometric Assessment</Text>
        <View style={{ width: 52 }} />
      </View>

      <View style={styles.planChipWrap}>
        <Text style={styles.planChipText}>{subscriptionLoading ? 'Plan: Checking...' : `Plan: ${isPremium ? 'Premium' : plan || 'Free'}`}</Text>
      </View>

      {error ? <View style={styles.errorBanner}><Text style={styles.errorText}>⚠️ {error}</Text></View> : null}

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={STUDENT.accent} />
          <Text style={styles.mutedText}>Loading assessment data...</Text>
        </View>
      ) : null}

      {!loading && view === 'landing' ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabContent}>
            {categories.map((category) => {
              const active = String(category.id) === String(activeCategoryId);
              const locked = isCategoryLockedForCurrentUser(category);
              return (
                <TouchableOpacity key={String(category.id)} style={[styles.tabPill, active && styles.tabPillActive]} onPress={() => setActiveCategoryId(category.id)}>
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{locked ? '🔒 ' : ''}{category.name}</Text>
                  <View style={[styles.accessBadge, locked ? styles.badgePremium : styles.badgeFree]}>
                    <Text style={styles.accessBadgeText}>{locked ? 'Premium' : (category.isPremium ? 'Premium' : 'Free')}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{instruction.title || labelOf(activeCategory, 'Psychometric Assessment')}</Text>
              {instruction.bullets.length > 0
                ? instruction.bullets.map((point, index) => (
                  <View key={`${point}-${index}`} style={styles.bulletRow}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>{point}</Text>
                  </View>
                ))
                : <Text style={styles.placeholderText}>Instructions will appear here after selecting an assessment category.</Text>}

              {historyList.length > 0 ? (
                <View style={styles.historyWrap}>
                  <Text style={styles.historyTitle}>Previous Attempts</Text>
                  {historyList.slice(0, 4).map((item) => (
                    <View key={item.id} style={styles.historyRow}>
                      <Text style={styles.historyLabel}>{item.label}</Text>
                      <Text style={styles.historyScore}>{item.score}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <TouchableOpacity style={styles.primaryButton} onPress={startAssessment}>
                <Text style={styles.primaryButtonText}>{startLabel}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </>
      ) : null}

      {!loading && view === 'runner' ? (
        <View style={{ flex: 1 }}>
          <View style={styles.progressWrap}>
            <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
            <Text style={styles.progressText}>{`${progress}%`}</Text>
          </View>
          <View style={styles.questionHeader}>
            <Text style={styles.questionCounter}>{`Question ${currentIndex + 1} of ${questions.length}`}</Text>
            {questionIsMulti ? <Text style={styles.multiText}>Select {maxSelections > 0 ? `up to ${maxSelections}` : 'one or more'} options</Text> : null}
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {question ? (
              <View style={styles.card}>
                <Text style={styles.questionText}>{question?.questionText || question?.question || question?.text || 'Question'}</Text>
                <View style={styles.optionsWrap}>
                  {options.map((option, index) => {
                    const selected = selectedArray.some((item) => item.index === index);
                    return (
                      <Pressable
                        key={option.id}
                        style={[styles.optionRow, selected && styles.optionRowSelected]}
                        onPress={() => {
                          setAnswersMap((prev) => {
                            const current = prev[question.__id];
                            const list = Array.isArray(current) ? current : (current ? [current] : []);
                            const exists = list.findIndex((item) => item.index === index);
                            const value = { index, optionId: option.id, text: option.text };
                            if (questionIsMulti) {
                              if (exists >= 0) return { ...prev, [question.__id]: list.filter((item) => item.index !== index) };
                              if (maxSelections > 0 && list.length >= maxSelections) return { ...prev, [question.__id]: [...list.slice(1), value] };
                              return { ...prev, [question.__id]: [...list, value] };
                            }
                            return { ...prev, [question.__id]: value };
                          });
                        }}
                      >
                        <View style={[styles.optionLetterWrap, selected && styles.optionLetterWrapSelected]}>
                          <Text style={[styles.optionLetter, selected && styles.optionLetterSelected]}>{String.fromCharCode(65 + index)}</Text>
                        </View>
                        <Text style={styles.optionText}>{option.text}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : <View style={styles.card}><Text style={styles.placeholderText}>No questions available for this assessment.</Text></View>}
          </ScrollView>

          <View style={styles.navRow}>
            <TouchableOpacity style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]} disabled={currentIndex === 0} onPress={() => setCurrentIndex((index) => Math.max(0, index - 1))}>
              <Text style={styles.navButtonText}>Previous</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonPrimary, (!hasSelection || submitting) && styles.navButtonDisabled]}
              disabled={!hasSelection || submitting}
              onPress={() => (currentIndex >= questions.length - 1 ? submitAssessment() : setCurrentIndex((index) => index + 1))}
            >
              <Text style={styles.navButtonPrimaryText}>{currentIndex >= questions.length - 1 ? (submitting ? 'Submitting...' : 'Submit') : 'Next'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {!loading && view === 'result' ? (
        <ResultCard
          result={instruction.result || {}}
          showPremiumBlur={showPremiumResultBlur}
          onUpgrade={openUpgrade}
          onBack={() => {
            setView('landing');
            setQuestions([]);
            setCurrentIndex(0);
          }}
        />
      ) : null}

      <Modal transparent visible={showUpgradeModal} animationType="fade" onRequestClose={closeUpgrade}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Premium feature</Text>
            <Text style={styles.modalText}>This psychometric assessment content is available for Premium students. Upgrade to unlock full reports and advanced insights.</Text>
            <TouchableOpacity style={styles.modalPrimaryBtn} onPress={() => { closeUpgrade(); router.push('/student/account'); }}>
              <Text style={styles.modalPrimaryText}>Upgrade Now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSecondaryBtn} onPress={closeUpgrade}>
              <Text style={styles.modalSecondaryText}>Maybe later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: STUDENT.border },
  backText: { color: STUDENT.accentCyan, fontSize: 12, fontWeight: '700' },
  headerTitle: { color: STUDENT.textPrimary, fontSize: 16, fontWeight: '800' },
  planChipWrap: { paddingHorizontal: 16, paddingTop: 10 },
  planChipText: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: STUDENT.bgCardAlt, borderWidth: 1, borderColor: STUDENT.border, color: STUDENT.textSecondary, fontSize: 11, fontWeight: '700' },
  tabScroll: { maxHeight: 68, borderBottomWidth: 1, borderBottomColor: STUDENT.border, marginTop: 10 },
  tabContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  tabPill: { backgroundColor: STUDENT.bgCard, borderColor: STUDENT.border, borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  tabPillActive: { backgroundColor: STUDENT.accent, borderColor: STUDENT.accent },
  tabText: { color: STUDENT.textSecondary, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  accessBadge: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  badgeFree: { backgroundColor: 'rgba(16,185,129,0.2)' },
  badgePremium: { backgroundColor: 'rgba(245,158,11,0.22)' },
  accessBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingVertical: 14 },
  card: { backgroundColor: STUDENT.bgCard, borderRadius: 16, borderWidth: 1, borderColor: STUDENT.border, padding: 16 },
  cardTitle: { color: STUDENT.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 10 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  bulletDot: { color: STUDENT.accentCyan, marginRight: 8, marginTop: 1, fontSize: 16, fontWeight: '700' },
  bulletText: { color: STUDENT.textSecondary, fontSize: 13, lineHeight: 20, flex: 1 },
  historyWrap: { marginTop: 10, borderTopWidth: 1, borderTopColor: STUDENT.border, paddingTop: 10 },
  historyTitle: { color: STUDENT.textPrimary, fontWeight: '700', marginBottom: 6 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  historyLabel: { color: STUDENT.textSecondary, fontSize: 12 },
  historyScore: { color: STUDENT.accentGreen, fontWeight: '700', fontSize: 12 },
  primaryButton: { marginTop: 12, backgroundColor: STUDENT.accent, borderRadius: 14, alignItems: 'center', paddingVertical: 12 },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  progressWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressBar: { flex: 1, height: 9, borderRadius: 999, backgroundColor: STUDENT.bgCardAlt, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: STUDENT.accentCyan },
  progressText: { color: STUDENT.textPrimary, fontWeight: '700', minWidth: 40, textAlign: 'right' },
  questionHeader: { paddingHorizontal: 16, paddingBottom: 2 },
  questionCounter: { color: STUDENT.textSecondary, fontWeight: '600', fontSize: 13 },
  multiText: { color: STUDENT.textMuted, fontSize: 11, marginTop: 2 },
  questionText: { color: STUDENT.textPrimary, fontSize: 16, lineHeight: 24, marginBottom: 14, fontWeight: '700' },
  optionsWrap: { gap: 8 },
  optionRow: { borderWidth: 1, borderColor: STUDENT.border, borderRadius: 12, backgroundColor: STUDENT.bgCardAlt, paddingVertical: 10, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionRowSelected: { borderColor: STUDENT.accent, backgroundColor: 'rgba(79,70,229,0.16)' },
  optionLetterWrap: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: STUDENT.border, alignItems: 'center', justifyContent: 'center' },
  optionLetterWrapSelected: { borderColor: STUDENT.accentCyan, backgroundColor: 'rgba(6,182,212,0.16)' },
  optionLetter: { color: STUDENT.textMuted, fontWeight: '700', fontSize: 12 },
  optionLetterSelected: { color: STUDENT.accentCyan },
  optionText: { color: STUDENT.textSecondary, flex: 1, fontSize: 13, lineHeight: 20 },
  navRow: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: STUDENT.border, flexDirection: 'row', gap: 10 },
  navButton: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: STUDENT.border, backgroundColor: STUDENT.bgCard, alignItems: 'center', justifyContent: 'center', paddingVertical: 11 },
  navButtonPrimary: { backgroundColor: STUDENT.accent, borderColor: STUDENT.accent },
  navButtonDisabled: { opacity: 0.55 },
  navButtonText: { color: STUDENT.textPrimary, fontWeight: '700' },
  navButtonPrimaryText: { color: '#fff', fontWeight: '800' },
  resultPct: { color: STUDENT.accentGreen, fontSize: 36, fontWeight: '800', marginTop: 4 },
  resultScore: { color: STUDENT.textSecondary, fontSize: 14, marginTop: 4, marginBottom: 8 },
  resultSummary: { color: STUDENT.textSecondary, lineHeight: 20, fontSize: 13 },
  highlightWrap: { marginTop: 12 },
  premiumResultWrap: { marginTop: 14, borderTopWidth: 1, borderTopColor: STUDENT.border, paddingTop: 12, position: 'relative' },
  premiumTitle: { color: STUDENT.textPrimary, fontWeight: '700', marginBottom: 8 },
  blurOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 12, overflow: 'hidden', gap: 10 },
  blurTitle: { color: '#fff', fontWeight: '700' },
  blurButton: { backgroundColor: STUDENT.accent, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  blurButtonText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  errorBanner: { marginHorizontal: 16, marginTop: 10, backgroundColor: 'rgba(244,63,94,0.16)', borderColor: 'rgba(244,63,94,0.35)', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  errorText: { color: '#fecdd3', fontSize: 12 },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  mutedText: { color: STUDENT.textMuted },
  placeholderText: { color: STUDENT.textMuted, fontSize: 13, lineHeight: 20 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.6)', alignItems: 'center', justifyContent: 'center', padding: 22 },
  modalCard: { width: '100%', maxWidth: 420, backgroundColor: STUDENT.bgCard, borderColor: STUDENT.border, borderWidth: 1, borderRadius: 16, padding: 18 },
  modalTitle: { color: STUDENT.textPrimary, fontSize: 18, fontWeight: '800' },
  modalText: { color: STUDENT.textSecondary, lineHeight: 20, marginTop: 8 },
  modalPrimaryBtn: { marginTop: 14, backgroundColor: STUDENT.accent, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  modalPrimaryText: { color: '#fff', fontWeight: '800' },
  modalSecondaryBtn: { marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: STUDENT.border, paddingVertical: 11, alignItems: 'center' },
  modalSecondaryText: { color: STUDENT.textSecondary, fontWeight: '700' },
});
