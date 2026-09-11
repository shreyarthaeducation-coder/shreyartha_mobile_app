import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, PORTALS, SLATE, SPACING, TYPE, leading } from '../../../constants/theme';
import { FormSheet, SegmentedTabs, Select, TextField } from '../../ui';
import { BLOOM_TAXONOMY, SKILLS_MEASURED } from '../../../services/teacher/examService';
import {
  DIFFICULTIES,
  MAX_PDF_IMPORT,
  buildPracticeQuestionPayload,
  bulkCreatePracticeQuestions,
  createPracticeQuestion,
  deletePracticeQuestion,
  fetchAdaptiveConfig,
  fetchCompanyQuestions,
  fetchCustomQuestions,
  levelLabel,
  parseQuestionPdf,
  saveCompanySelection,
  setAdaptiveEnabled,
  toBloomOption,
  updatePracticeQuestion,
} from '../../../services/teacher/adaptiveService';
import { pickPdf } from '../../../utils/filePicker';

/**
 * The question bank for one topic: the ON/OFF switch, the company selection and the teacher's own
 * questions.
 *
 * The switch is the whole point of the feature — OFF, students get the company bank; ON, they get
 * this teacher's pool. Its disable rule is `!canEnable && !enabled`, so an already-ON topic can
 * always be switched off even after its pool empties. The web conveys the disabled reason only in
 * a `title` tooltip, which is invisible on touch, so it is spelled out here.
 */

const PALETTE = PORTALS.school;

const BANK_TABS = [
  { value: 'company', label: 'Company' },
  { value: 'mine', label: 'Mine' },
];

const OPTION_KEYS = ['optionA', 'optionB', 'optionC', 'optionD'];

const emptyForm = {
  testLevel: 'BASIC',
  questionText: '',
  optionA: '',
  optionB: '',
  optionC: '',
  optionD: '',
  correctAnswer: 'A',
  bloomsLevel: '',
  skillSet: '',
  hint: '',
  solution: '',
};

export default function TopicBankSheet({ visible, scope, topic, chapter, onClose, showToast }) {
  const [bankTab, setBankTab] = useState('company');
  const [config, setConfig] = useState(null);
  const [company, setCompany] = useState([]);
  const [custom, setCustom] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingSelection, setSavingSelection] = useState(false);
  const [dirtySelection, setDirtySelection] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [importLevel, setImportLevel] = useState('BASIC');
  const [importing, setImporting] = useState(false);

  const args = useMemo(
    () => ({
      sectionId: scope?.sectionId,
      subjectId: scope?.subjectId,
      chapterId: chapter?.id ?? null,
      topicId: topic?.id,
    }),
    [scope?.sectionId, scope?.subjectId, chapter?.id, topic?.id],
  );

  const load = useCallback(async () => {
    if (!args.topicId) return;
    setLoading(true);
    try {
      // Three independent reads; the web fires them together too.
      const [cfg, companyList, customList] = await Promise.all([
        fetchAdaptiveConfig(args),
        fetchCompanyQuestions(args),
        fetchCustomQuestions(args),
      ]);
      setConfig(cfg);
      setCompany(companyList);
      setCustom(customList);
      setSelected(new Set(companyList.filter((q) => q.selected).map((q) => q.id)));
      setDirtySelection(false);
    } catch (e) {
      showToast?.(e?.message || 'Could not load this topic.', 'error');
    } finally {
      setLoading(false);
    }
  }, [args, showToast]);

  useEffect(() => {
    if (visible) {
      setBankTab('company');
      setShowForm(false);
      setEditingId(null);
      load();
    }
  }, [visible, load]);

  const refreshConfig = useCallback(async () => {
    try {
      setConfig(await fetchAdaptiveConfig(args));
    } catch {
      // The banner keeps its previous counts rather than blanking — same as the web.
    }
  }, [args]);

  const toggleEnabled = async (enabled) => {
    setSavingConfig(true);
    try {
      setConfig(await setAdaptiveEnabled({ ...args, enabled }));
      showToast?.(
        enabled
          ? 'Your question set is now live for this topic.'
          : 'Switched off — students see the company set again.',
        'success',
      );
    } catch (e) {
      showToast?.(e?.message || 'Could not update this topic.', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const toggleCompany = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setDirtySelection(true);
  };

  const saveSelection = async () => {
    setSavingSelection(true);
    try {
      // Replaces the whole selection — an empty set is a legal "deselect everything".
      setConfig(await saveCompanySelection({ ...args, ids: Array.from(selected) }));
      setCompany(await fetchCompanyQuestions(args));
      setDirtySelection(false);
      showToast?.('Selection saved.', 'success');
    } catch (e) {
      showToast?.(e?.message || 'Could not save your selection.', 'error');
    } finally {
      setSavingSelection(false);
    }
  };

  const requestClose = () => {
    // The web drops unsaved company selections silently on close.
    if (!dirtySelection) {
      onClose?.();
      return;
    }
    Alert.alert('Discard unsaved selection?', 'Your company-question picks have not been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onClose },
    ]);
  };

  // ── custom question form ──────────────────────────────────────────────────
  const filledOptions = OPTION_KEYS.filter((k) => (form[k] || '').trim()).length;
  const answerFilled = !!(form[`option${form.correctAnswer}`] || '').trim();
  const formValid = !!form.questionText.trim() && filledOptions >= 2 && answerFilled;

  const openEdit = (q) => {
    setEditingId(q.id);
    setForm({
      testLevel: q.testLevel || 'BASIC',
      questionText: q.questionText || '',
      optionA: q.optionA || '',
      optionB: q.optionB || '',
      optionC: q.optionC || '',
      optionD: q.optionD || '',
      correctAnswer: q.correctAnswer || 'A',
      bloomsLevel: q.bloomsLevel || '',
      skillSet: q.skillSet || '',
      hint: q.hint || '',
      solution: q.solution || '',
    });
    setShowForm(true);
  };

  const saveQuestion = async () => {
    if (!formValid) return;
    setSaving(true);
    try {
      const payload = buildPracticeQuestionPayload(form, args);
      if (editingId) await updatePracticeQuestion(editingId, payload);
      else await createPracticeQuestion(payload);
      setCustom(await fetchCustomQuestions(args));
      await refreshConfig();
      setShowForm(false);
      setEditingId(null);
      showToast?.(editingId ? 'Question updated.' : 'Question added.', 'success');
    } catch (e) {
      showToast?.(e?.message || 'Could not save the question.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (q) => {
    Alert.alert('Delete this question?', 'Students will no longer be served it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePracticeQuestion(q.id);
            setCustom((prev) => prev.filter((x) => x.id !== q.id));
            await refreshConfig();
            showToast?.('Question deleted.', 'success');
          } catch (e) {
            showToast?.(e?.message || 'Could not delete the question.', 'error');
          }
        },
      },
    ]);
  };

  const importPdf = async () => {
    let file;
    try {
      file = await pickPdf();
    } catch (e) {
      showToast?.(e?.message || 'Could not open the file picker.', 'error');
      return;
    }
    if (!file) return;

    setImporting(true);
    try {
      const { questions, message } = await parseQuestionPdf(file);
      if (questions.length === 0) {
        showToast?.(message || 'No questions found in that PDF.', 'error');
        return;
      }
      // 50 is a per-request cap on both sides, not a per-topic limit.
      const batch = questions.slice(0, MAX_PDF_IMPORT);
      const payload = batch.map((q) => ({
        ...args,
        // The parsed format carries no difficulty, so the whole batch is stamped with one.
        testLevel: importLevel,
        questionText: q.questionText || '',
        optionA: q.optionA?.trim() || null,
        optionB: q.optionB?.trim() || null,
        optionC: q.optionC?.trim() || null,
        optionD: q.optionD?.trim() || null,
        correctAnswer: (q.correctAnswer || 'A').trim().toUpperCase(),
        bloomsLevel: toBloomOption(q.bloomsLevel),
        skillSet: q.skillSet?.trim() || null,
        hint: q.hint?.trim() || null,
        solution: q.solution?.trim() || null,
      }));

      await bulkCreatePracticeQuestions(payload);
      setCustom(await fetchCustomQuestions(args));
      await refreshConfig();
      showToast?.(
        `Imported ${batch.length} question${batch.length === 1 ? '' : 's'} as ${levelLabel(importLevel)}.`,
        'success',
      );
    } catch (e) {
      showToast?.(e?.message || 'Could not import the questions.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const switchLocked = !config?.canEnable && !config?.enabled;

  const renderQuestionCard = (q, { selectable }) => (
    <View key={`${q.source}-${q.id}`} style={styles.qCard}>
      <View style={styles.qHead}>
        {selectable ? (
          <Pressable
            onPress={() => toggleCompany(q.id)}
            hitSlop={6}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected.has(q.id) }}
          >
            <Ionicons
              name={selected.has(q.id) ? 'checkbox' : 'square-outline'}
              size={20}
              color={selected.has(q.id) ? PALETTE.primaryDark : SLATE[400]}
            />
          </Pressable>
        ) : null}
        <View style={styles.levelChip}>
          <Text style={styles.levelText}>{levelLabel(q.testLevel)}</Text>
        </View>
        <View style={styles.qSpacer} />
        {!selectable ? (
          <>
            <Pressable
              onPress={() => openEdit(q)}
              hitSlop={6}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Edit question"
            >
              <Ionicons name="pencil" size={17} color={SLATE[600]} />
            </Pressable>
            <Pressable
              onPress={() => confirmDelete(q)}
              hitSlop={6}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Delete question"
            >
              <Ionicons name="trash-outline" size={17} color={FEEDBACK.errorText} />
            </Pressable>
          </>
        ) : null}
      </View>

      <Text style={styles.qText}>{q.questionText}</Text>
      <View style={styles.qOptions}>
        {OPTION_KEYS.map((key, i) => {
          const value = q[key];
          if (!value) return null;
          const letter = String.fromCharCode(65 + i);
          const correct = q.correctAnswer === letter;
          return (
            <Text key={key} style={[styles.qOption, correct && styles.qOptionCorrect]}>
              {letter}. {value}
              {correct ? '  ✓' : ''}
            </Text>
          );
        })}
      </View>
      {q.bloomsLevel || q.skillSet ? (
        <View style={styles.qMeta}>
          {[q.bloomsLevel, q.skillSet].filter(Boolean).map((meta) => (
            <View key={meta} style={styles.qChip}>
              <Text style={styles.qChipText} numberOfLines={1}>
                {meta}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <FormSheet
      visible={visible}
      title={showForm ? (editingId ? 'Edit question' : 'New question') : topic?.label || 'Topic'}
      subtitle={showForm ? topic?.label : chapter?.name}
      onClose={showForm ? () => setShowForm(false) : requestClose}
      onSubmit={showForm ? saveQuestion : undefined}
      submitting={saving}
      submitDisabled={!formValid}
      submitLabel={editingId ? 'Save changes' : 'Add question'}
      headerAction={
        !showForm && bankTab === 'mine'
          ? {
              icon: 'add',
              label: 'Add question',
              onPress: () => {
                setEditingId(null);
                setForm(emptyForm);
                setShowForm(true);
              },
            }
          : undefined
      }
      fullHeight
    >
      {showForm ? (
        <>
          <Select
            label="Difficulty"
            value={form.testLevel}
            options={DIFFICULTIES}
            onChange={(testLevel) => setForm((f) => ({ ...f, testLevel }))}
          />
          <Text style={styles.hint}>
            Drives the adaptive ladder — two right answers move a student up a level, two wrong move
            them down.
          </Text>

          <TextField
            label="Question"
            required
            value={form.questionText}
            onChangeText={(questionText) => setForm((f) => ({ ...f, questionText }))}
            placeholder="Type the question…"
            multiline
            inputStyle={styles.multiline}
          />

          {OPTION_KEYS.map((key, index) => (
            <TextField
              key={key}
              label={`Option ${String.fromCharCode(65 + index)}`}
              value={form[key]}
              onChangeText={(text) => setForm((f) => ({ ...f, [key]: text }))}
              placeholder={`Option ${String.fromCharCode(65 + index)}`}
            />
          ))}
          {filledOptions < 2 ? <Text style={styles.error}>Add at least 2 options.</Text> : null}

          <Select
            label="Correct answer"
            value={form.correctAnswer}
            options={['A', 'B', 'C', 'D'].map((l) => ({ value: l, label: `Option ${l}` }))}
            onChange={(correctAnswer) => setForm((f) => ({ ...f, correctAnswer }))}
          />
          {!answerFilled ? (
            <Text style={styles.error}>Option {form.correctAnswer} is empty.</Text>
          ) : null}

          <Select
            label="Bloom's level"
            value={form.bloomsLevel}
            options={[
              { value: '', label: 'Not set' },
              ...BLOOM_TAXONOMY.map((b) => ({ value: b, label: b })),
            ]}
            onChange={(bloomsLevel) => setForm((f) => ({ ...f, bloomsLevel }))}
          />
          <Select
            label="Skill set"
            searchable
            value={form.skillSet}
            options={[
              { value: '', label: 'Not set' },
              ...SKILLS_MEASURED.map((s) => ({ value: s, label: s })),
            ]}
            onChange={(skillSet) => setForm((f) => ({ ...f, skillSet }))}
          />
          <TextField
            label="Hint"
            value={form.hint}
            onChangeText={(hint) => setForm((f) => ({ ...f, hint }))}
            placeholder="Optional"
            multiline
            inputStyle={styles.multiline}
          />
          <TextField
            label="Solution"
            value={form.solution}
            onChangeText={(solution) => setForm((f) => ({ ...f, solution }))}
            placeholder="Optional worked solution"
            multiline
            inputStyle={styles.multiline}
          />
        </>
      ) : loading ? (
        <ActivityIndicator size="large" color={PALETTE.primary} style={styles.loader} />
      ) : (
        <>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.switchLabel}>
                {config?.enabled ? 'My question set is ON' : 'Use my question set'}
              </Text>
              <Text style={styles.switchHint}>
                {switchLocked
                  ? 'Add a custom question or select a company question first.'
                  : config?.enabled
                    ? `Students are being served your ${config.effectivePoolSize}-question set — ${config.customCount} of your own and ${config.selectedCompanyCount} from the company bank.`
                    : `Students are seeing the company question set (${config?.companyTotalCount ?? 0} questions).`}
              </Text>
            </View>
            {savingConfig ? (
              <ActivityIndicator size="small" color={PALETTE.primary} />
            ) : (
              <Switch
                value={!!config?.enabled}
                disabled={switchLocked}
                onValueChange={toggleEnabled}
                trackColor={{ true: PALETTE.accent, false: SLATE[300] }}
                thumbColor={config?.enabled ? PALETTE.primaryDark : '#ffffff'}
              />
            )}
          </View>

          <SegmentedTabs
            options={[
              { ...BANK_TABS[0], label: `Company (${company.length})` },
              { ...BANK_TABS[1], label: `Mine (${custom.length})` },
            ]}
            value={bankTab}
            onChange={setBankTab}
            style={styles.bankTabs}
          />

          {bankTab === 'company' ? (
            company.length === 0 ? (
              <Text style={styles.empty}>
                The company question bank has nothing for this topic yet.
              </Text>
            ) : (
              <>
                <View style={styles.selectionBar}>
                  <Text style={styles.selectionCount}>
                    {selected.size} of {company.length} selected
                  </Text>
                  <Pressable
                    onPress={() => {
                      setSelected(new Set(company.map((q) => q.id)));
                      setDirtySelection(true);
                    }}
                    hitSlop={6}
                  >
                    <Text style={styles.selectionLink}>All</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setSelected(new Set());
                      setDirtySelection(true);
                    }}
                    hitSlop={6}
                  >
                    <Text style={styles.selectionLink}>None</Text>
                  </Pressable>
                  <Pressable
                    onPress={saveSelection}
                    disabled={savingSelection || !dirtySelection}
                    style={({ pressed }) => [
                      styles.saveSelection,
                      (!dirtySelection || savingSelection) && styles.saveSelectionOff,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                  >
                    {savingSelection ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.saveSelectionText}>Save</Text>
                    )}
                  </Pressable>
                </View>
                {company.map((q) => renderQuestionCard(q, { selectable: true }))}
              </>
            )
          ) : (
            <>
              <View style={styles.importRow}>
                <View style={styles.importLevel}>
                  <Select
                    label="Import as"
                    value={importLevel}
                    options={DIFFICULTIES}
                    onChange={setImportLevel}
                  />
                </View>
                <Pressable
                  onPress={importPdf}
                  disabled={importing}
                  style={({ pressed }) => [styles.importBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  {importing ? (
                    <ActivityIndicator size="small" color={PALETTE.primaryDark} />
                  ) : (
                    <>
                      <Ionicons name="document-attach-outline" size={18} color={PALETTE.primaryDark} />
                      <Text style={styles.importText}>Import PDF</Text>
                    </>
                  )}
                </Pressable>
              </View>

              {custom.length === 0 ? (
                <Text style={styles.empty}>
                  You haven&apos;t written any questions for this topic yet. Tap ＋ above, or import
                  a question paper.
                </Text>
              ) : (
                custom.map((q) => renderQuestionCard(q, { selectable: false }))
              )}
            </>
          )}
        </>
      )}
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  loader: { marginVertical: SPACING.xl },
  empty: { fontSize: TYPE.body, color: SLATE[500], textAlign: 'center', paddingVertical: SPACING.lg },
  error: { fontSize: TYPE.label, color: FEEDBACK.errorText, marginBottom: SPACING.md, fontWeight: '600' },
  hint: { fontSize: TYPE.caption, color: SLATE[500], marginTop: -SPACING.sm, marginBottom: SPACING.md },
  multiline: { height: 76, textAlignVertical: 'top' },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: 12,
    backgroundColor: SLATE[50],
    borderWidth: 1,
    borderColor: SLATE[200],
  },
  switchText: { flex: 1 },
  switchLabel: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  switchHint: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 3, lineHeight: leading(TYPE.caption) },
  bankTabs: { marginTop: SPACING.md, marginBottom: SPACING.sm },

  selectionBar: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  selectionCount: { flex: 1, fontSize: TYPE.label, fontWeight: '700', color: SLATE[600] },
  selectionLink: { fontSize: TYPE.label, fontWeight: '700', color: PALETTE.primaryDark },
  saveSelection: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: PALETTE.primaryDark,
    minWidth: 58,
    alignItems: 'center',
  },
  saveSelectionOff: { backgroundColor: SLATE[300] },
  saveSelectionText: { fontSize: TYPE.label, fontWeight: '700', color: '#ffffff' },

  importRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm, marginBottom: SPACING.sm },
  importLevel: { flex: 1 },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: SLATE[200],
    marginBottom: SPACING.md,
  },
  importText: { fontSize: TYPE.body, fontWeight: '700', color: PALETTE.primaryDark },

  qCard: {
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 12,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  qHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  qSpacer: { flex: 1 },
  levelChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: PALETTE.tint },
  levelText: { fontSize: TYPE.micro, fontWeight: '800', color: PALETTE.primaryDark },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLATE[50],
  },
  qText: { fontSize: TYPE.body, color: SLATE[800], lineHeight: leading(TYPE.body) },
  qOptions: { marginTop: 6, gap: 2 },
  qOption: { fontSize: TYPE.label, color: SLATE[600] },
  qOptionCorrect: { color: FEEDBACK.successText, fontWeight: '700' },
  qMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7 },
  qChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: SLATE[100] },
  qChipText: { fontSize: TYPE.micro, fontWeight: '600', color: SLATE[500] },

  pressed: { opacity: 0.72 },
});
