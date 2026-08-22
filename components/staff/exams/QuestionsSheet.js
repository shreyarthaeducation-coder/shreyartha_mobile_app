import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, PORTALS, SLATE, SPACING } from '../../../constants/theme';
import { FormSheet, Select, TextField } from '../../ui';
import {
  BLOOM_TAXONOMY,
  QUESTION_TYPES,
  SKILLS_MEASURED,
  buildQuestionPayload,
  createExamQuestion,
  deleteExamQuestion,
  fetchExamQuestions,
  updateExamQuestion,
} from '../../../services/teacher/examService';
import { fetchChapters } from '../../../services/teacher/resourceService';

/**
 * Question paper editor for one exam — the native `QuestionManager`.
 *
 * List and form share one sheet, swapping in place exactly as the web does (the web replaces the
 * list with the form rather than stacking a second modal, and that reads better on a phone too).
 *
 * Note the exam's question count decides which marks screen the teacher gets, so `onChanged` must
 * bubble up: adding the first question to an exam flips it from flat to per-question marking.
 */

const PALETTE = PORTALS.school;

const emptyForm = {
  questionType: 'MCQ',
  questionStatement: '',
  optionA: '',
  optionB: '',
  optionC: '',
  optionD: '',
  bloomsTaxonomy: '',
  skillSet: '',
  sampleAnswer: '',
  marks: '1',
};

const OPTION_KEYS = ['optionA', 'optionB', 'optionC', 'optionD'];

export default function QuestionsSheet({
  visible,
  exam,
  academicIqSubjectId,
  onClose,
  onChanged,
  showToast,
}) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chapters, setChapters] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [chapterId, setChapterId] = useState(null);
  const [topicId, setTopicId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!exam?.id) return;
    setLoading(true);
    try {
      setQuestions(await fetchExamQuestions(exam.id));
    } catch (e) {
      showToast?.(e?.message || 'Could not load the questions.', 'error');
    } finally {
      setLoading(false);
    }
  }, [exam?.id, showToast]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  // Chapters are optional context for a question; a subject with no curriculum link simply
  // leaves the picker empty rather than blocking the form.
  useEffect(() => {
    if (!visible || !academicIqSubjectId) {
      setChapters([]);
      return undefined;
    }
    let alive = true;
    (async () => {
      try {
        const list = await fetchChapters(academicIqSubjectId);
        if (alive) setChapters(list);
      } catch {
        if (alive) setChapters([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [visible, academicIqSubjectId]);

  const chapter = chapters.find((c) => c.id === chapterId) || null;
  const topics = chapter?.topics || [];
  const topic = topics.find((t) => t.id === topicId) || null;

  const totalMarks = useMemo(
    () => questions.reduce((sum, q) => sum + (q.marks || 0), 0),
    [questions],
  );

  const filledOptions = OPTION_KEYS.filter((key) => (form[key] || '').trim()).length;
  const mcqValid = form.questionType !== 'MCQ' || filledOptions >= 2;
  const formValid = !!form.questionStatement.trim() && mcqValid;

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setChapterId(null);
    setTopicId(null);
    setShowForm(true);
  };

  const openEdit = (q) => {
    setEditingId(q.id);
    setForm({
      questionType: q.questionType || 'MCQ',
      questionStatement: q.questionStatement || '',
      optionA: q.optionA || '',
      optionB: q.optionB || '',
      optionC: q.optionC || '',
      optionD: q.optionD || '',
      bloomsTaxonomy: q.bloomsTaxonomy || '',
      skillSet: q.skillSet || '',
      sampleAnswer: q.sampleAnswer || '',
      marks: String(q.marks ?? 1),
    });
    setChapterId(q.chapterId ?? null);
    setTopicId(q.topicId ?? null);
    setShowForm(true);
  };

  const save = async () => {
    if (!formValid) return;
    setSaving(true);
    try {
      const payload = buildQuestionPayload(form, chapter, topic);
      if (editingId) await updateExamQuestion(exam.id, editingId, payload);
      else await createExamQuestion(exam.id, payload);
      setShowForm(false);
      setEditingId(null);
      await load();
      onChanged?.();
      showToast?.(editingId ? 'Question updated.' : 'Question added.', 'success');
    } catch (e) {
      showToast?.(e?.message || 'Could not save the question.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (q) => {
    Alert.alert(
      'Delete this question?',
      'Any marks already entered against it will be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteExamQuestion(exam.id, q.id);
              await load();
              onChanged?.();
              showToast?.('Question deleted.', 'success');
            } catch (e) {
              showToast?.(e?.message || 'Could not delete the question.', 'error');
            }
          },
        },
      ],
    );
  };

  const isMcq = form.questionType === 'MCQ';

  return (
    <FormSheet
      visible={visible}
      title={showForm ? (editingId ? 'Edit question' : 'New question') : 'Question paper'}
      subtitle={
        showForm
          ? exam?.examName
          : `${questions.length} question${questions.length === 1 ? '' : 's'} · ${totalMarks} marks`
      }
      onClose={showForm ? () => setShowForm(false) : onClose}
      onSubmit={showForm ? save : undefined}
      submitting={saving}
      submitDisabled={!formValid}
      submitLabel={editingId ? 'Save changes' : 'Add question'}
      headerAction={showForm ? undefined : { icon: 'add', label: 'Add question', onPress: openNew }}
      fullHeight
    >
      {showForm ? (
        <>
          <Select
            label="Question type"
            value={form.questionType}
            options={QUESTION_TYPES}
            onChange={(questionType) => setForm((f) => ({ ...f, questionType }))}
          />
          <TextField
            label="Question"
            required
            value={form.questionStatement}
            onChangeText={(questionStatement) => setForm((f) => ({ ...f, questionStatement }))}
            placeholder="Type the question…"
            multiline
            inputStyle={styles.multiline}
          />

          {isMcq ? (
            <>
              {OPTION_KEYS.map((key, index) => (
                <TextField
                  key={key}
                  label={`Option ${String.fromCharCode(65 + index)}`}
                  value={form[key]}
                  onChangeText={(text) => setForm((f) => ({ ...f, [key]: text }))}
                  placeholder={`Option ${String.fromCharCode(65 + index)}`}
                />
              ))}
              {!mcqValid ? (
                <Text style={styles.error}>Add at least 2 options for an MCQ question.</Text>
              ) : null}
            </>
          ) : null}

          <Select
            label="Chapter"
            value={chapterId}
            options={chapters.map((c) => ({ value: c.id, label: c.name }))}
            onChange={(value) => {
              setChapterId(value);
              setTopicId(null);
            }}
            placeholder={
              academicIqSubjectId ? 'Optional' : 'Subject not linked to curriculum content'
            }
            disabled={!academicIqSubjectId}
          />
          <Select
            label="Topic"
            value={topicId}
            options={topics.map((t) => ({ value: t.id, label: t.displayName || t.name }))}
            onChange={setTopicId}
            placeholder={chapterId ? 'Optional' : 'Choose a chapter first'}
            disabled={!chapterId}
          />
          <Select
            label="Bloom's taxonomy"
            value={form.bloomsTaxonomy}
            options={[
              { value: '', label: 'Not set' },
              ...BLOOM_TAXONOMY.map((b) => ({ value: b, label: b })),
            ]}
            onChange={(bloomsTaxonomy) => setForm((f) => ({ ...f, bloomsTaxonomy }))}
          />
          <Select
            label="Skill set"
            // 33 options — this is the searchable variant's reason for existing.
            searchable
            value={form.skillSet}
            options={[
              { value: '', label: 'Not set' },
              ...SKILLS_MEASURED.map((s) => ({ value: s, label: s })),
            ]}
            onChange={(skillSet) => setForm((f) => ({ ...f, skillSet }))}
          />
          <TextField
            label="Marks"
            value={form.marks}
            onChangeText={(marks) =>
              setForm((f) => ({ ...f, marks: marks.replace(/[^0-9.]/g, '') }))
            }
            keyboardType="numeric"
          />
          <TextField
            label="Sample answer"
            value={form.sampleAnswer}
            onChangeText={(sampleAnswer) => setForm((f) => ({ ...f, sampleAnswer }))}
            placeholder="Optional"
            multiline
            inputStyle={styles.multiline}
          />
        </>
      ) : loading ? (
        <ActivityIndicator size="large" color={PALETTE.primary} style={styles.loader} />
      ) : questions.length === 0 ? (
        <Text style={styles.empty}>
          No questions yet. Tap ＋ above to build this exam&apos;s question paper.
        </Text>
      ) : (
        questions.map((q, index) => (
          <View key={q.id} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardIndex}>Q{index + 1}</Text>
              <Text style={styles.cardMarks}>{q.marks ?? 0} marks</Text>
              <Pressable
                onPress={() => openEdit(q)}
                hitSlop={6}
                style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Edit question ${index + 1}`}
              >
                <Ionicons name="pencil" size={15} color={SLATE[600]} />
              </Pressable>
              <Pressable
                onPress={() => confirmDelete(q)}
                hitSlop={6}
                style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Delete question ${index + 1}`}
              >
                <Ionicons name="trash-outline" size={15} color={FEEDBACK.errorText} />
              </Pressable>
            </View>
            <Text style={styles.cardText}>{q.questionStatement}</Text>
            {[q.optionA, q.optionB, q.optionC, q.optionD].some(Boolean) ? (
              <View style={styles.options}>
                {[q.optionA, q.optionB, q.optionC, q.optionD].map((option, i) =>
                  option ? (
                    <Text key={i} style={styles.option}>
                      {String.fromCharCode(65 + i)}. {option}
                    </Text>
                  ) : null,
                )}
              </View>
            ) : null}
            <View style={styles.metaRow}>
              {[q.chapterName, q.topicName, q.bloomsTaxonomy, q.skillSet]
                .filter(Boolean)
                .map((meta) => (
                  <View key={meta} style={styles.metaChip}>
                    <Text style={styles.metaText} numberOfLines={1}>
                      {meta}
                    </Text>
                  </View>
                ))}
            </View>
          </View>
        ))
      )}
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  loader: { marginVertical: SPACING.xl },
  empty: { fontSize: 13, color: SLATE[500], textAlign: 'center', paddingVertical: SPACING.lg },
  error: { fontSize: 12.5, color: FEEDBACK.errorText, marginBottom: SPACING.md, fontWeight: '600' },
  multiline: { height: 84, textAlignVertical: 'top' },

  card: {
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 12,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    backgroundColor: '#ffffff',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  cardIndex: { flex: 1, fontSize: 12.5, fontWeight: '800', color: PALETTE.primaryDark },
  cardMarks: { fontSize: 11.5, fontWeight: '700', color: SLATE[500] },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLATE[50],
  },
  cardText: { fontSize: 13.5, color: SLATE[800], lineHeight: 19 },
  options: { marginTop: 5, gap: 2 },
  option: { fontSize: 12.5, color: SLATE[600] },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7 },
  metaChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: SLATE[100],
    maxWidth: '100%',
  },
  metaText: { fontSize: 11, fontWeight: '600', color: SLATE[500] },

  pressed: { opacity: 0.72 },
});
