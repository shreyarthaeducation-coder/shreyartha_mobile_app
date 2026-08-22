import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TYPE } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { StudentCard, StudentCardTitle } from '../StudentCard';
import {
  fetchSurveyQuestions,
  fetchSurveyResponses,
  submitSurvey,
} from '../../../services/student/careerService';

/**
 * Profile → Student Reflection. The wellbeing questionnaire.
 *
 * The KEY, the component name and the endpoints stay `survey` — that is what
 * /api/students/survey/* is called and what the counsellor's Wellness Groups reads. Only the
 * user-visible wording matches the website, which renamed this to "Student Reflection".
 *
 * WORTH KNOWING WHAT THIS FEEDS: the answers here are what the counsellor later sees in Wellness
 * Groups as LOW / MODERATE / HIGH index bands — the questions come back as the very same
 * `SurveyCategoryResponse` DTO that screen reads. Each option carries `marks`, and those marks are
 * what the bands are computed from, which is why the option order and text must not be reworded.
 *
 * **It locks once submitted**, as on the web: this is an assessment, not a preference form.
 */
export default function SurveyTab({ showToast }) {
  const styles = useStyles();
  const palette = usePalette();

  const [categories, setCategories] = useState([]);
  const [answers, setAnswers] = useState({});
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [qRes, rRes] = await Promise.allSettled([fetchSurveyQuestions(), fetchSurveyResponses()]);
    if (qRes.status === 'fulfilled') setCategories(qRes.value);
    if (rRes.status === 'fulfilled') {
      const prior = rRes.value || {};
      setAnswers(prior);
      // Any stored response means the student has already taken it.
      setLocked(Object.keys(prior).length > 0);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pick = (questionId, optionId) => {
    if (locked) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const total = categories.reduce((n, c) => n + (c.questions?.length || 0), 0);
  const answered = Object.values(answers).filter(Boolean).length;

  const submit = async () => {
    if (answered < total) {
      showToast?.(`Answer all ${total} questions before submitting.`, 'error');
      return;
    }
    setSaving(true);
    try {
      await submitSurvey(answers);
      setLocked(true);
      showToast?.('Reflection submitted.', 'success');
    } catch (e) {
      showToast?.(e?.message || 'Could not submit your reflection.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" color={palette.primary} style={styles.loader} />;
  }

  if (categories.length === 0) {
    return (
      <StudentCard>
        <Text style={styles.empty}>No reflection is available for you right now.</Text>
      </StudentCard>
    );
  }

  return (
    <>
      <StudentCard>
        <View style={styles.head}>
          <StudentCardTitle>Student Reflection</StudentCardTitle>
          {locked ? (
            <View style={styles.lock}>
              <Ionicons name="checkmark-circle" size={12} color={FEEDBACK.successOnBg} />
              <Text style={styles.lockText}>Submitted</Text>
            </View>
          ) : (
            <Text style={styles.progress}>
              {answered}/{total}
            </Text>
          )}
        </View>
        <Text style={styles.note}>
          Your answers help your counsellor understand how you are doing. There are no right
          answers.
        </Text>
      </StudentCard>

      {categories.map((category) => (
        <StudentCard key={category.id}>
          <StudentCardTitle>{category.name || category.indexName}</StudentCardTitle>
          {(category.questions || [])
            .slice()
            .sort((a, b) => (a.questionOrder || 0) - (b.questionOrder || 0))
            .map((q, qi) => (
              <View key={q.id} style={styles.question}>
                <Text style={styles.questionText}>
                  {qi + 1}. {q.questionText}
                </Text>
                {(q.options || [])
                  .slice()
                  .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
                  .map((opt) => {
                    const on = String(answers[q.id]) === String(opt.id);
                    return (
                      <Pressable
                        key={opt.id}
                        onPress={() => pick(q.id, opt.id)}
                        disabled={locked}
                        style={({ pressed }) => [
                          styles.option,
                          on && styles.optionOn,
                          pressed && !locked && styles.pressed,
                        ]}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on, disabled: locked }}
                      >
                        <Ionicons
                          name={on ? 'radio-button-on' : 'radio-button-off'}
                          size={16}
                          color={on ? palette.primaryDark : SLATE[300]}
                        />
                        <Text style={[styles.optionText, on && styles.optionTextOn]}>
                          {opt.optionText}
                        </Text>
                      </Pressable>
                    );
                  })}
              </View>
            ))}
        </StudentCard>
      ))}

      {locked ? (
        <Text style={styles.done}>
          You have already submitted your reflection. Thank you.
        </Text>
      ) : (
        <Pressable
          onPress={submit}
          disabled={saving}
          style={({ pressed }) => [styles.save, saving && styles.saveOff, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator size="small" color={palette.onPrimary} />
          ) : (
            <Text style={styles.saveText}>Submit Reflection</Text>
          )}
        </Pressable>
      )}
    </>
  );
}

const useStyles = makeStyles((p) => ({
  loader: { marginVertical: SPACING.xl },
  empty: { fontSize: TYPE.body, color: SLATE[500], textAlign: 'center' },

  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progress: { fontSize: TYPE.label, fontWeight: '700', color: p.deep, marginBottom: SPACING.sm },
  lock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#d1fae5',
    marginBottom: SPACING.sm,
  },
  lockText: { fontSize: TYPE.micro, fontWeight: '700', color: FEEDBACK.successOnBg },
  note: { fontSize: TYPE.label, lineHeight: 18, color: SLATE[600] },

  question: { marginBottom: SPACING.md },
  questionText: { fontSize: TYPE.body, fontWeight: '600', color: SLATE[800], marginBottom: 6 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
    marginBottom: 6,
  },
  optionOn: { borderColor: p.primary, backgroundColor: p.tint },
  optionText: { flex: 1, fontSize: TYPE.body, color: SLATE[700] },
  optionTextOn: { color: p.deep, fontWeight: '600' },

  done: { fontSize: TYPE.label, color: p.onDark, textAlign: 'center', marginBottom: SPACING.lg },
  save: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: p.primary,
    marginBottom: SPACING.lg,
  },
  saveOff: { backgroundColor: SLATE[400] },
  saveText: { fontSize: TYPE.heading, fontWeight: '700', color: p.onPrimary },
  pressed: { opacity: 0.78 },
}));
