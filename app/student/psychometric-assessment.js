import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

const arr = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const unwrap = (value) => (value?.data && typeof value.data === 'object' ? value.data : value || {});
const labelOf = (node, fallback = '') => String(node?.title || node?.name || node?.label || fallback || '').trim();
const toMessage = (err) => err?.response?.data?.message || err?.message || 'Server error. Please try again.';

const normalizeQuestionOptions = (question) => {
  const options = arr(question?.options || question?.choices || question?.answers || question?.answerOptions || question?.mcqOptions);
  if (options.length > 0) {
    return options.map((option, index) => {
      if (typeof option === 'string') {
        return { id: `${index}`, text: option };
      }
      return {
        id: String(option.id || option.optionId || option.key || index),
        text: option.text || option.label || option.option || option.value || `Option ${index + 1}`,
      };
    });
  }

  const optionKeys = Object.keys(question || {}).filter((key) => /^option[A-Za-z0-9]*$/.test(key)).sort();
  return optionKeys
    .map((key, index) => ({ id: `${index}`, text: String(question[key]) }))
    .filter((option) => option.text && option.text !== 'undefined' && option.text !== 'null');
};

const normalizeCategories = (payload) => {
  const data = unwrap(payload);
  const list = arr(data?.categories || data?.assessments || data?.items || data?.tabs || payload);
  return list
    .map((item, index) => ({
      id: item?.categoryId || item?.assessmentId || item?.id || item?.slug || item?.code || `${index}`,
      name: labelOf(item, `Assessment ${index + 1}`),
      raw: item,
    }))
    .filter((item) => item.name);
};

const normalizeInstructions = (payload, fallbackName) => {
  const data = unwrap(payload);
  const bulletSource =
    data?.instructions
    || data?.introPoints
    || data?.points
    || data?.bullets
    || data?.descriptionPoints
    || data?.overview;

  const bullets = arr(bulletSource)
    .map((point) => (typeof point === 'string' ? point : point?.text || point?.description || point?.content || ''))
    .filter(Boolean);

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
  };
};

const normalizeQuestions = (payload) => {
  const data = unwrap(payload);
  return arr(data?.questions || data?.items || data?.assessmentQuestions || payload).map((question, index) => ({
    ...question,
    __id: String(question?.questionId || question?.qid || question?.id || index),
  }));
};

function ResultCard({ result, onBack }) {
  const score = result?.score ?? result?.correct ?? result?.totalScore ?? result?.obtainedMarks;
  const total = result?.total ?? result?.totalQuestions ?? result?.maxScore;
  const percentage = result?.percentage ?? result?.percent ?? (score != null && total ? Math.round((score / total) * 100) : null);
  const highlights = arr(result?.traits || result?.strengths || result?.recommendations || result?.insights || result?.summaryPoints)
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

        <TouchableOpacity style={styles.primaryButton} onPress={onBack}>
          <Text style={styles.primaryButtonText}>Back to Assessments</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

export default function PsychometricAssessmentScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [instruction, setInstruction] = useState({ title: '', bullets: [], status: '', answers: null, result: null });

  const [view, setView] = useState('landing');
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answersMap, setAnswersMap] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const activeCategory = useMemo(
    () => categories.find((item) => String(item.id) === String(activeCategoryId)) || null,
    [categories, activeCategoryId],
  );

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await studentService.getPsychometricCategories();
      const parsed = normalizeCategories(data);
      setCategories(parsed);
      if (parsed.length > 0) {
        setActiveCategoryId(parsed[0].id);
      }
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
      const categoryId = category.id;
      const data = await studentService.getPsychometricIntro(categoryId);
      setInstruction(normalizeInstructions(data, category.name));
    } catch (detailError) {
      setInstruction({ title: category.name, bullets: [], status: '', answers: null, result: null });
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
      const existing =
        existingAnswers[key]
        || existingAnswers[question?.id]
        || existingAnswers[question?.questionId]
        || existingAnswers[index]
        || null;

      if (existing == null) return;

      const options = normalizeQuestionOptions(question);

      if (typeof existing === 'number') {
        const option = options[existing];
        if (option) map[key] = { index: existing, optionId: option.id, text: option.text };
        return;
      }

      if (typeof existing === 'string') {
        const optionIndex = options.findIndex((option) => option.id === existing || option.text === existing);
        if (optionIndex >= 0) {
          const option = options[optionIndex];
          map[key] = { index: optionIndex, optionId: option.id, text: option.text };
        }
      }
    });

    return map;
  }, []);

  const startAssessment = useCallback(async () => {
    if (!activeCategory) return;

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
      setError(toMessage(startError));
    } finally {
      setLoading(false);
    }
  }, [activeCategory, instruction.status, instruction.result, instruction.answers, loadQuestions, buildInitialAnswers]);

  const submitAssessment = useCallback(async () => {
    if (!activeCategory) return;

    setSubmitting(true);
    setError('');
    try {
      const answers = questions
        .map((question, index) => {
          const key = question.__id;
          const selected = answersMap[key];
          if (!selected) return null;
          return {
            questionId: question?.questionId || question?.id || key,
            optionId: selected.optionId,
            selectedOptionId: selected.optionId,
            selectedOptionIndex: selected.index,
            selectedAnswer: selected.text,
            order: index,
          };
        })
        .filter(Boolean);

      const payload = {
        categoryId: activeCategory.id,
        answers,
      };

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
      setError(toMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }, [activeCategory, questions, answersMap]);

  const question = questions[currentIndex] || null;
  const options = question ? normalizeQuestionOptions(question) : [];
  const selectedAnswer = question ? answersMap[question.__id] : null;
  const progress = questions.length ? Math.round(((currentIndex + 1) / questions.length) * 100) : 0;

  const startLabel = useMemo(() => {
    if (instruction.status === 'completed') return instruction.result ? 'View Result' : 'Retake Assessment';
    if (instruction.status === 'in_progress' || instruction.status === 'in-progress') return 'Resume Assessment';
    return 'Start Assessment';
  }, [instruction.status, instruction.result]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => (view === 'landing' ? router.back() : setView('landing'))}>
          <Text style={styles.backText}>{view === 'landing' ? '← Back' : '← Assessments'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Psychometric Assessment</Text>
        <View style={{ width: 52 }} />
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      ) : null}

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
              return (
                <TouchableOpacity key={String(category.id)} style={[styles.tabPill, active && styles.tabPillActive]} onPress={() => setActiveCategoryId(category.id)}>
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{category.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{instruction.title || labelOf(activeCategory, 'Psychometric Assessment')}</Text>

              {instruction.bullets.length > 0 ? (
                instruction.bullets.map((point, index) => (
                  <View key={`${point}-${index}`} style={styles.bulletRow}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>{point}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.placeholderText}>Instructions will appear here after selecting an assessment category.</Text>
              )}

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
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>{`${progress}%`}</Text>
          </View>

          <View style={styles.questionHeader}>
            <Text style={styles.questionCounter}>{`Question ${currentIndex + 1} of ${questions.length}`}</Text>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {question ? (
              <View style={styles.card}>
                <Text style={styles.questionText}>{question?.questionText || question?.question || question?.text || 'Question'}</Text>

                <View style={styles.optionsWrap}>
                  {options.map((option, index) => {
                    const selected = selectedAnswer?.index === index;
                    return (
                      <Pressable
                        key={option.id}
                        style={[styles.optionRow, selected && styles.optionRowSelected]}
                        onPress={() => {
                          setAnswersMap((prev) => ({
                            ...prev,
                            [question.__id]: { index, optionId: option.id, text: option.text },
                          }));
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
            ) : (
              <View style={styles.card}><Text style={styles.placeholderText}>No questions available for this assessment.</Text></View>
            )}
          </ScrollView>

          <View style={styles.navRow}>
            <TouchableOpacity
              style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
              disabled={currentIndex === 0}
              onPress={() => setCurrentIndex((index) => Math.max(0, index - 1))}
            >
              <Text style={styles.navButtonText}>Previous</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navButton, styles.navButtonPrimary, (!selectedAnswer || submitting) && styles.navButtonDisabled]}
              disabled={!selectedAnswer || submitting}
              onPress={() => {
                if (currentIndex >= questions.length - 1) {
                  submitAssessment();
                } else {
                  setCurrentIndex((index) => index + 1);
                }
              }}
            >
              <Text style={styles.navButtonPrimaryText}>{currentIndex >= questions.length - 1 ? (submitting ? 'Submitting...' : 'Submit') : 'Next'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {!loading && view === 'result' ? (
        <ResultCard
          result={instruction.result || {}}
          onBack={() => {
            setView('landing');
            setQuestions([]);
            setCurrentIndex(0);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: STUDENT.border,
  },
  backText: { color: STUDENT.accentCyan, fontSize: 12, fontWeight: '700' },
  headerTitle: { color: STUDENT.textPrimary, fontSize: 16, fontWeight: '800' },
  tabScroll: { maxHeight: 58, borderBottomWidth: 1, borderBottomColor: STUDENT.border },
  tabContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  tabPill: {
    backgroundColor: STUDENT.bgCard,
    borderColor: STUDENT.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  tabPillActive: { backgroundColor: STUDENT.accent, borderColor: STUDENT.accent },
  tabText: { color: STUDENT.textSecondary, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingVertical: 14 },
  card: {
    backgroundColor: STUDENT.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: STUDENT.border,
    padding: 16,
  },
  cardTitle: { color: STUDENT.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 10 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  bulletDot: { color: STUDENT.accentCyan, marginRight: 8, marginTop: 1, fontSize: 16, fontWeight: '700' },
  bulletText: { color: STUDENT.textSecondary, fontSize: 13, lineHeight: 20, flex: 1 },
  primaryButton: {
    marginTop: 12,
    backgroundColor: STUDENT.accent,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 12,
  },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  progressWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressBar: { flex: 1, height: 9, borderRadius: 999, backgroundColor: STUDENT.bgCardAlt, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: STUDENT.accentCyan },
  progressText: { color: STUDENT.textPrimary, fontWeight: '700', minWidth: 40, textAlign: 'right' },
  questionHeader: { paddingHorizontal: 16, paddingBottom: 2 },
  questionCounter: { color: STUDENT.textSecondary, fontWeight: '600', fontSize: 13 },
  questionText: { color: STUDENT.textPrimary, fontSize: 16, lineHeight: 24, marginBottom: 14, fontWeight: '700' },
  optionsWrap: { gap: 8 },
  optionRow: {
    borderWidth: 1,
    borderColor: STUDENT.border,
    borderRadius: 12,
    backgroundColor: STUDENT.bgCardAlt,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionRowSelected: { borderColor: STUDENT.accent, backgroundColor: 'rgba(79,70,229,0.16)' },
  optionLetterWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: STUDENT.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLetterWrapSelected: { borderColor: STUDENT.accentCyan, backgroundColor: 'rgba(6,182,212,0.16)' },
  optionLetter: { color: STUDENT.textMuted, fontWeight: '700', fontSize: 12 },
  optionLetterSelected: { color: STUDENT.accentCyan },
  optionText: { color: STUDENT.textSecondary, flex: 1, fontSize: 13, lineHeight: 20 },
  navRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: STUDENT.border,
    flexDirection: 'row',
    gap: 10,
  },
  navButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: STUDENT.border,
    backgroundColor: STUDENT.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
  },
  navButtonPrimary: { backgroundColor: STUDENT.accent, borderColor: STUDENT.accent },
  navButtonDisabled: { opacity: 0.55 },
  navButtonText: { color: STUDENT.textPrimary, fontWeight: '700' },
  navButtonPrimaryText: { color: '#fff', fontWeight: '800' },
  resultPct: { color: STUDENT.accentGreen, fontSize: 36, fontWeight: '800', marginTop: 4 },
  resultScore: { color: STUDENT.textSecondary, fontSize: 14, marginTop: 4, marginBottom: 8 },
  resultSummary: { color: STUDENT.textSecondary, lineHeight: 20, fontSize: 13 },
  highlightWrap: { marginTop: 12 },
  errorBanner: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: 'rgba(244,63,94,0.16)',
    borderColor: 'rgba(244,63,94,0.35)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  errorText: { color: '#fecdd3', fontSize: 12 },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  mutedText: { color: STUDENT.textMuted },
  placeholderText: { color: STUDENT.textMuted, fontSize: 13, lineHeight: 20 },
});
