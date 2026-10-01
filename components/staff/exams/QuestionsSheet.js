import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, PORTALS, SLATE, SPACING, TYPE, leading } from '../../../constants/theme';
import { FormSheet } from '../../ui';
import QuestionHtml, { KATEX_CSS } from '../../QuestionHtml';
import {
  QUESTION_TYPES,
  buildQuestionPayload,
  createExamQuestion,
  deleteExamQuestion,
  fetchExamQuestions,
  fetchSchoolSkillSets,
  fetchSubjectChapters,
  fetchTeacherProfile,
  joinEitherOr,
  questionToForm,
  reorderQuestions,
  splitEitherOr,
  updateExamQuestion,
} from '../../../services/teacher/examService';
import { paperItems } from '../../../utils/marksSheetScan';
import {
  formProblems,
  groupingProblem,
  hasParts,
  isChoice,
  itemHasNoMaximum,
  itemMarks,
  paperHtml,
  paperTotal,
  partLabel,
  reorderIds,
  setCount as countSets,
} from '../../../utils/questionPaper';
import { LinkButton, SetChips } from './marks/marksParts';
import QuestionForm from './questions/QuestionForm';
import CopyPanel from './questions/CopyPanel';
import ImportPanel from './questions/ImportPanel';
import { sharePaperPdf } from './questions/printPaper';

/**
 * Question paper editor for one exam — the native QuestionManager.
 *
 * List, form, copy and import share one sheet, swapping in place as the website does. One SET is one
 * question paper — its own numbering, total and printout — shown on its own tab. The paper is drawn
 * as a student meets it (utils/marksSheetScan.paperItems): an either/or choice is ONE question with
 * OR between its alternatives, and a question holding a passage lists its lettered sub-questions.
 *
 * The exam's question count decides which marks screen opens first, so `onChanged` must bubble up.
 */

const PALETTE = PORTALS.school;
const OPTION_KEYS = ['optionA', 'optionB', 'optionC', 'optionD'];
const OPTION_IMAGE_KEYS = ['optionAImageUrl', 'optionBImageUrl', 'optionCImageUrl', 'optionDImageUrl'];
const typeLabel = (value) => QUESTION_TYPES.find((t) => t.value === value)?.label || value;

export default function QuestionsSheet({ visible, exam, sectionSubjectId, onClose, onChanged, showToast }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeSet, setActiveSet] = useState(1);
  // A set just added and not yet written in: it exists only once its first question does.
  const [draftSet, setDraftSet] = useState(null);
  const [view, setView] = useState('list'); // list | form | copyFrom | copyTo | import
  const [editingId, setEditingId] = useState(null);
  const [subParent, setSubParent] = useState(null);
  const [form, setForm] = useState(questionToForm(null));
  const [saving, setSaving] = useState(false);
  const [chapters, setChapters] = useState([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [skillAdditions, setSkillAdditions] = useState([]);
  const [grouping, setGrouping] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [printing, setPrinting] = useState(false);

  const toastError = useCallback((message) => showToast?.(message, 'error'), [showToast]);

  const load = useCallback(async () => {
    if (!exam?.id) return;
    setLoading(true);
    try {
      setQuestions(await fetchExamQuestions(exam.id));
    } catch (e) {
      toastError(e?.message || 'Could not load the questions.');
    } finally {
      setLoading(false);
    }
  }, [exam?.id, toastError]);

  useEffect(() => {
    if (!visible) return;
    setView('list');
    setActiveSet(1);
    setDraftSet(null);
    setGrouping(false);
    setSelected(new Set());
    setNotice('');
    load();
  }, [visible, load]);

  // Chapters for the exam's own subject, whatever curriculum (or none) backs it, with what the
  // school added — /api/teacher/curriculum, keyed by the section-subject.
  useEffect(() => {
    if (!visible || !sectionSubjectId) {
      setChapters([]);
      return undefined;
    }
    let alive = true;
    setLoadingChapters(true);
    fetchSubjectChapters(sectionSubjectId)
      .then((list) => alive && setChapters(list))
      .catch(() => alive && setChapters([]))
      .finally(() => alive && setLoadingChapters(false));
    return () => {
      alive = false;
    };
  }, [visible, sectionSubjectId]);

  useEffect(() => {
    if (!visible) return undefined;
    let alive = true;
    fetchSchoolSkillSets()
      .then((list) => alive && setSkillAdditions(list))
      // A school that added nothing, or a role the endpoint does not serve, gets the built-ins.
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [visible]);

  const sets = countSets(questions, draftSet);
  // A set is its questions: deleting Set 2's last question deletes Set 2.
  useEffect(() => {
    if (activeSet > sets) setActiveSet(sets);
  }, [activeSet, sets]);

  const items = useMemo(() => paperItems(questions, activeSet), [questions, activeSet]);
  const total = paperTotal(items, exam?.maxMarks);
  const selectedQuestions = questions.filter((q) => selected.has(q.id));
  const groupingBlocked = selected.size > 0 ? groupingProblem(selectedQuestions) : null;

  const numberOf = (question) => {
    const index = items.findIndex(
      (item) => item.alternatives.some((a) => a.id === question.id) || item.parts.some((p) => p.id === question.id),
    );
    return index >= 0 ? `Q${index + 1}` : 'the question';
  };

  // ── Form ──────────────────────────────────────────────────────────────────────────────────────

  const openNew = () => {
    setEditingId(null);
    setSubParent(null);
    setForm(questionToForm(null));
    setNotice('');
    setView('form');
  };

  /** A part under an existing question — it inherits the chapter and topic of the passage. */
  const openSubQuestion = (parent) => {
    setEditingId(null);
    setSubParent(parent);
    setForm({
      ...questionToForm(null),
      chapterId: parent.chapterId != null ? String(parent.chapterId) : '',
      chapterName: parent.chapterName || '',
      topicId: parent.topicId != null ? String(parent.topicId) : '',
      topicName: parent.topicName || '',
      // Parts of a passage are usually written out rather than picked from four options.
      questionType: 'SHORT_ANSWER',
    });
    setNotice('');
    setView('form');
  };

  const openEdit = (question) => {
    setEditingId(question.id);
    setSubParent(null);
    // Every field, the unshown ones included, so the save cannot erase them.
    setForm(questionToForm(question));
    setView('form');
  };

  const editingParts = editingId ? questions.filter((q) => q.parentQuestionId === editingId) : [];
  const partsTotal = editingParts.length ? editingParts.reduce((sum, p) => sum + (p.marks || 0), 0) : null;
  const problems = formProblems(form);

  const save = async () => {
    if (problems.length) return;
    setSaving(true);
    try {
      const payload = buildQuestionPayload(form, {
        questionSet: activeSet,
        parentQuestionId: subParent ? subParent.id : null,
      });
      if (editingId) await updateExamQuestion(exam.id, editingId, payload);
      else await createExamQuestion(exam.id, payload);
      setView('list');
      setEditingId(null);
      setSubParent(null);
      // The set has a question now, so it is real.
      setDraftSet(null);
      await load();
      onChanged?.();
      showToast?.(editingId ? 'Question updated.' : 'Question added.', 'success');
    } catch (e) {
      toastError(e?.message || 'Could not save the question.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (question) => {
    // Deleting a passage takes its parts with it, so the warning says so.
    const partCount = questions.filter((q) => q.parentQuestionId === question.id).length;
    Alert.alert(
      'Delete this question?',
      partCount
        ? `It and its ${partCount} sub-question${partCount !== 1 ? 's' : ''} will be deleted. Any marks already entered against them will be removed.`
        : 'Any marks already entered against it will be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteExamQuestion(exam.id, question.id);
              await load();
              onChanged?.();
              showToast?.('Question deleted.', 'success');
            } catch (e) {
              toastError(e?.message || 'Could not delete the question.');
            }
          },
        },
      ],
    );
  };

  // ── Sets, order, either/or ────────────────────────────────────────────────────────────────────

  const openSet = (set) => {
    setActiveSet(set);
    setGrouping(false);
    setSelected(new Set());
    setNotice('');
  };

  /** A new, empty paper. Nothing is saved: Set N exists once its first question does. */
  const addSet = () => {
    const next = sets + 1;
    setDraftSet(next);
    openSet(next);
  };

  /** Moves one item — a choice travels as the one question it is, a passage with its parts. */
  const move = async (index, direction) => {
    const ids = reorderIds(items, index, direction);
    if (!ids) return;
    const previous = questions;
    setQuestions(
      questions.map((q) => {
        const position = ids.indexOf(q.id);
        return position === -1 ? q : { ...q, questionOrder: position + 1 };
      }),
    );
    setBusy(true);
    try {
      const list = await reorderQuestions(exam.id, ids);
      if (list) setQuestions(list);
      onChanged?.();
    } catch (e) {
      setQuestions(previous);
      toastError(e?.message || 'Could not change the order.');
    } finally {
      setBusy(false);
    }
  };

  const join = () => {
    const problem = groupingProblem(selectedQuestions);
    if (problem) {
      toastError(problem);
      return;
    }
    Alert.alert(
      'Join as either/or?',
      'The paper will show them as a single question worth its marks once, and any marks already entered against the alternatives will be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Join',
          onPress: async () => {
            setBusy(true);
            try {
              const list = await joinEitherOr(exam.id, [...selected]);
              if (list) setQuestions(list);
              setGrouping(false);
              setSelected(new Set());
              setNotice('Joined into one either/or question.');
              onChanged?.();
            } catch (e) {
              toastError(e?.message || 'Could not join those questions.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const split = (groupId) =>
    Alert.alert('Split this either/or choice?', 'Its alternatives become separate questions again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Split',
        onPress: async () => {
          try {
            const list = await splitEitherOr(exam.id, groupId);
            if (list) setQuestions(list);
            setNotice('Split back into separate questions.');
            onChanged?.();
          } catch (e) {
            toastError(e?.message || 'Could not split that choice.');
          }
        },
      },
    ]);

  // ── The printed paper ─────────────────────────────────────────────────────────────────────────

  const printPaper = async () => {
    setPrinting(true);
    try {
      let school = {};
      try {
        school = (await fetchTeacherProfile()) || {};
      } catch {
        // A paper without the school's letterhead is still a paper.
      }
      const html = paperHtml(
        {
          schoolName: school.schoolName,
          schoolLogo: school.schoolLogo,
          examName: exam.examName,
          examCode: exam.examCode,
          className: exam.className,
          sectionName: exam.sectionName,
          subjectName: exam.subjectName,
          set: activeSet,
          setCount: sets,
          totalMarks: total,
          katexCss: KATEX_CSS,
        },
        items,
      );
      const code = exam.examCode || exam.id;
      await sharePaperPdf(html, `Question_Paper_${code}${sets > 1 ? `_Set_${activeSet}` : ''}.pdf`);
    } catch (e) {
      toastError(e?.message || 'Could not make the question paper PDF.');
    } finally {
      setPrinting(false);
    }
  };

  // ── Rendering ─────────────────────────────────────────────────────────────────────────────────

  const questionBody = (q) => (
    <>
      <QuestionHtml html={q.questionStatement} textStyle={styles.cardText} />
      {q.questionImageUrl ? <Image source={{ uri: q.questionImageUrl }} style={styles.image} resizeMode="contain" /> : null}
      {q.questionType === 'MCQ' && OPTION_KEYS.some((k, i) => q[k] || q[OPTION_IMAGE_KEYS[i]]) ? (
        <View style={styles.options}>
          {OPTION_KEYS.map((key, i) =>
            q[key] || q[OPTION_IMAGE_KEYS[i]] ? (
              <View key={key} style={styles.optionRow}>
                <Text style={styles.option}>{String.fromCharCode(65 + i)}.</Text>
                <View style={styles.optionBody}>
                  {q[key] ? <QuestionHtml html={q[key]} textStyle={styles.option} /> : null}
                  {q[OPTION_IMAGE_KEYS[i]] ? (
                    <Image source={{ uri: q[OPTION_IMAGE_KEYS[i]] }} style={styles.optionImage} resizeMode="contain" />
                  ) : null}
                </View>
              </View>
            ) : null,
          )}
        </View>
      ) : null}
      <View style={styles.metaRow}>
        {[q.chapterName, q.topicName, q.bloomsTaxonomy, q.skillSet].filter(Boolean).map((meta) => (
          <View key={meta} style={styles.metaChip}>
            <Text style={styles.metaText} numberOfLines={1}>
              {meta}
            </Text>
          </View>
        ))}
      </View>
    </>
  );

  const IconBtn = ({ icon, onPress, label, color = SLATE[600], disabled }) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [styles.iconBtn, disabled && styles.disabled, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={17} color={color} />
    </Pressable>
  );

  const renderItem = (item, index) => {
    const choice = isChoice(item);
    const q = item.lead;
    const pickable = grouping && !choice && !hasParts(item);
    const picked = selected.has(q.id);
    return (
      <View key={q.id} style={[styles.card, choice && styles.cardChoice, picked && styles.cardPicked]}>
        <View style={styles.cardHead}>
          {pickable ? (
            <IconBtn
              icon={picked ? 'checkbox' : 'square-outline'}
              color={picked ? PALETTE.primary : SLATE[500]}
              label={`Select Q${index + 1}`}
              onPress={() =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (next.has(q.id)) next.delete(q.id);
                  else next.add(q.id);
                  return next;
                })
              }
            />
          ) : null}
          <Text style={styles.cardIndex}>Q{index + 1}</Text>
          <Text style={styles.cardBadge}>{choice ? 'Either / OR' : typeLabel(q.questionType)}</Text>
          <Text style={styles.cardMarks}>
            {itemHasNoMaximum(item) ? 'no maximum' : `${itemMarks(item)} marks`}
            {hasParts(item) ? ' in total' : ''}
          </Text>
          {!grouping ? (
            <>
              <IconBtn icon="arrow-up" label={`Move Q${index + 1} up`} onPress={() => move(index, -1)} disabled={busy || index === 0} />
              <IconBtn
                icon="arrow-down"
                label={`Move Q${index + 1} down`}
                onPress={() => move(index, 1)}
                disabled={busy || index === items.length - 1}
              />
            </>
          ) : null}
        </View>

        {choice ? (
          <>
            {item.alternatives.map((alt, i) => (
              <View key={alt.id}>
                {i > 0 ? <Text style={styles.or}>OR</Text> : null}
                <View style={styles.alternative}>
                  {questionBody(alt)}
                  {!grouping ? (
                    <View style={styles.cardActions}>
                      <IconBtn icon="pencil" label={`Edit alternative ${i + 1} of Q${index + 1}`} onPress={() => openEdit(alt)} />
                      <IconBtn
                        icon="trash-outline"
                        color={FEEDBACK.errorText}
                        label={`Delete alternative ${i + 1} of Q${index + 1}`}
                        onPress={() => confirmDelete(alt)}
                      />
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
            {!grouping ? (
              <LinkButton icon="git-branch-outline" label="Split into separate questions" onPress={() => split(q.eitherOrGroup)} />
            ) : null}
          </>
        ) : (
          <>
            {questionBody(q)}
            {hasParts(item) ? (
              <View style={styles.parts}>
                {item.parts.map((part, p) => (
                  <View key={part.id} style={styles.part}>
                    <View style={styles.cardHead}>
                      <Text style={styles.partIndex}>
                        Q{index + 1}({partLabel(p)})
                      </Text>
                      <Text style={styles.cardMarks}>{part.marks == null ? 'no maximum' : `${part.marks} marks`}</Text>
                      {!grouping ? (
                        <>
                          <IconBtn icon="pencil" label={`Edit Q${index + 1}(${partLabel(p)})`} onPress={() => openEdit(part)} />
                          <IconBtn
                            icon="trash-outline"
                            color={FEEDBACK.errorText}
                            label={`Delete Q${index + 1}(${partLabel(p)})`}
                            onPress={() => confirmDelete(part)}
                          />
                        </>
                      ) : null}
                    </View>
                    {questionBody(part)}
                  </View>
                ))}
              </View>
            ) : null}
            {!grouping ? (
              <View style={styles.cardActions}>
                <LinkButton icon="add-outline" label="Sub-question" onPress={() => openSubQuestion(q)} />
                <IconBtn icon="pencil" label={`Edit Q${index + 1}`} onPress={() => openEdit(q)} />
                <IconBtn icon="trash-outline" color={FEEDBACK.errorText} label={`Delete Q${index + 1}`} onPress={() => confirmDelete(q)} />
              </View>
            ) : null}
          </>
        )}
      </View>
    );
  };

  const inForm = view === 'form';
  const title = inForm
    ? editingId
      ? 'Edit question'
      : subParent
        ? 'New sub-question'
        : 'New question'
    : view === 'import'
      ? 'Import questions'
      : view === 'list'
        ? 'Question paper'
        : 'Copy a paper';

  return (
    <FormSheet
      visible={visible}
      title={title}
      subtitle={
        inForm
          ? `${exam?.examName || ''}${sets > 1 ? ` · Set ${activeSet}` : ''}`
          : `${items.length} question${items.length === 1 ? '' : 's'} · ${total ?? '—'} marks${sets > 1 ? ` · Set ${activeSet}` : ''}`
      }
      onClose={view === 'list' ? onClose : () => setView('list')}
      onSubmit={inForm ? save : undefined}
      submitting={saving}
      submitDisabled={inForm && problems.length > 0}
      submitLabel={editingId ? 'Save changes' : 'Add question'}
      headerAction={view === 'list' && !grouping ? { icon: 'add', label: 'Add question', onPress: openNew } : undefined}
      fullHeight
    >
      {inForm ? (
        <QuestionForm
          form={form}
          setForm={setForm}
          chapters={chapters}
          setChapters={setChapters}
          loadingChapters={loadingChapters}
          sectionSubjectId={sectionSubjectId}
          skillAdditions={skillAdditions}
          setSkillAdditions={setSkillAdditions}
          parentLabel={subParent ? numberOf(subParent) : null}
          partsTotal={partsTotal}
          saving={saving}
          onError={toastError}
        />
      ) : view === 'copyFrom' || view === 'copyTo' ? (
        <CopyPanel
          mode={view === 'copyFrom' ? 'from' : 'to'}
          examId={exam?.id}
          className={exam?.className}
          questionCount={questions.length}
          setCount={sets}
          onCancel={() => setView('list')}
          onError={toastError}
          onDone={async (message, changedHere) => {
            setNotice(message);
            setView('list');
            if (changedHere) await load();
            onChanged?.();
          }}
        />
      ) : view === 'import' ? (
        <ImportPanel
          examId={exam?.id}
          questionSet={activeSet}
          chapters={chapters}
          onCancel={() => setView('list')}
          onError={toastError}
          onDone={async (message) => {
            setNotice(message);
            setView('list');
            setDraftSet(null);
            await load();
            onChanged?.();
          }}
        />
      ) : loading ? (
        <ActivityIndicator size="large" color={PALETTE.primary} style={styles.loader} />
      ) : (
        <>
          <View style={styles.setRow}>
            <SetChips sets={Array.from({ length: sets }, (_, i) => i + 1)} value={activeSet} onPick={openSet} disabled={grouping} />
            <LinkButton icon="add-outline" label="Add set" onPress={addSet} disabled={grouping} />
          </View>

          <View style={styles.toolRow}>
            {items.length > 1 ? (
              <LinkButton
                icon="git-merge-outline"
                label={grouping ? 'Cancel either/or' : 'Either / OR'}
                onPress={() => {
                  setGrouping((g) => !g);
                  setSelected(new Set());
                }}
              />
            ) : null}
            {!grouping ? (
              <>
                <LinkButton icon="document-text-outline" label="Import" onPress={() => setView('import')} />
                <LinkButton icon="copy-outline" label="Copy from another class" onPress={() => setView('copyFrom')} />
                {questions.length ? (
                  <LinkButton icon="share-social-outline" label="Copy to other sections" onPress={() => setView('copyTo')} />
                ) : null}
                {items.length ? (
                  <LinkButton
                    icon="print-outline"
                    label={printing ? 'Making PDF…' : 'Download paper'}
                    onPress={printPaper}
                    disabled={printing}
                  />
                ) : null}
              </>
            ) : null}
          </View>

          {grouping ? (
            <View style={styles.groupBar}>
              <Text style={styles.groupText}>
                Select 2 or more questions to join into one either/or question. They must all be worth the same marks; the
                paper shows them as a single question with OR between them.
              </Text>
              {groupingBlocked ? <Text style={styles.error}>{groupingBlocked}</Text> : null}
              <LinkButton
                icon="git-merge-outline"
                label={busy ? 'Joining…' : `Join ${selected.size} as either/or`}
                onPress={join}
                disabled={busy || selected.size < 2 || !!groupingBlocked}
              />
            </View>
          ) : null}

          {notice ? (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          ) : null}

          {items.length === 0 ? (
            <Text style={styles.empty}>
              {sets > 1 && activeSet > 1
                ? `Set ${activeSet} has no questions yet. Tap ＋ above to write its first, or import it.`
                : 'No questions yet. Tap ＋ above to build this exam’s question paper, or import one.'}
            </Text>
          ) : (
            items.map(renderItem)
          )}
        </>
      )}
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  loader: { marginVertical: SPACING.xl },
  empty: { fontSize: TYPE.body, color: SLATE[500], textAlign: 'center', paddingVertical: SPACING.lg },
  error: { fontSize: TYPE.label, color: FEEDBACK.errorText, marginVertical: 4, fontWeight: '600' },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 },
  toolRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
  groupBar: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: PALETTE.tint,
    marginBottom: 8,
    gap: 6,
  },
  groupText: { fontSize: TYPE.label, color: PALETTE.primaryDark },
  notice: { padding: 10, borderRadius: 8, backgroundColor: SLATE[50], borderWidth: 1, borderColor: SLATE[200], marginBottom: 8 },
  noticeText: { fontSize: TYPE.label, color: SLATE[700] },

  card: {
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 12,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    backgroundColor: '#ffffff',
  },
  cardChoice: { borderColor: '#c4b5fd', backgroundColor: '#faf5ff' },
  cardPicked: { borderColor: PALETTE.primary, backgroundColor: PALETTE.tint },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  cardIndex: { fontSize: TYPE.label, fontWeight: '800', color: PALETTE.primaryDark },
  cardBadge: { flex: 1, fontSize: TYPE.caption, fontWeight: '700', color: SLATE[500] },
  cardMarks: { fontSize: TYPE.caption, fontWeight: '700', color: SLATE[500] },
  cardActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 6 },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLATE[50],
  },
  cardText: { fontSize: TYPE.body, color: SLATE[800], lineHeight: leading(TYPE.body) },
  image: { width: '100%', height: 150, marginTop: 6, borderRadius: 8, backgroundColor: SLATE[50] },
  options: { marginTop: 5, gap: 3 },
  optionRow: { flexDirection: 'row', gap: 6 },
  optionBody: { flex: 1 },
  option: { fontSize: TYPE.label, color: SLATE[600] },
  optionImage: { width: 140, height: 90, borderRadius: 6, backgroundColor: SLATE[50], marginTop: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7 },
  metaChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: SLATE[100],
    maxWidth: '100%',
  },
  metaText: { fontSize: TYPE.caption, fontWeight: '600', color: SLATE[500] },
  or: { textAlign: 'center', fontSize: TYPE.label, fontWeight: '800', color: '#7c3aed', marginVertical: 6 },
  alternative: { paddingLeft: 6 },
  parts: { marginTop: 8, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: SLATE[100], gap: 8 },
  part: {},
  partIndex: { flex: 1, fontSize: TYPE.label, fontWeight: '800', color: SLATE[600] },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.72 },
});
