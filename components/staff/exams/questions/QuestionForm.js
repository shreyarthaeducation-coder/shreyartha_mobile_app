import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { FEEDBACK, SLATE, TYPE } from '../../../../constants/theme';
import { Select, TextField } from '../../../ui';
import {
  BLOOM_TAXONOMY,
  QUESTION_TYPES,
  SKILLS_MEASURED,
  addSchoolSkillSet,
  addSubjectChapter,
  addSubjectTopic,
  mergeSkillSets,
} from '../../../../services/teacher/examService';
import { formProblems } from '../../../../utils/questionPaper';
import { LinkButton, PALETTE } from '../marks/marksParts';
import ImageSlot from './ImageSlot';
import RichField from './RichField';

/**
 * The question form — the website's QuestionManager form, field for field.
 *
 * The form holds EVERY field of the question (services/teacher/examService → questionToForm), the
 * ones it does not show included, so a save never erases what it did not display.
 */

const ADD_NEW = '__add_new__';
const OPTION_KEYS = ['optionA', 'optionB', 'optionC', 'optionD'];
const OPTION_IMAGE_KEYS = ['optionAImageUrl', 'optionBImageUrl', 'optionCImageUrl', 'optionDImageUrl'];
const norm = (s) => String(s || '').trim().toLowerCase();

export default function QuestionForm({
  form,
  setForm,
  chapters,
  setChapters,
  loadingChapters,
  sectionSubjectId,
  skillAdditions,
  setSkillAdditions,
  parentLabel,
  partsTotal,
  saving,
  onError,
}) {
  const [addingChapter, setAddingChapter] = useState(null); // null | typed name
  const [addingTopic, setAddingTopic] = useState(null);
  const [addingSkill, setAddingSkill] = useState(null);
  const [busy, setBusy] = useState(false);
  const [curriculumError, setCurriculumError] = useState('');

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const isMcq = form.questionType === 'MCQ';

  // Matched by name, not id: a chapter the school added has no platform id, and the question
  // stores the name anyway.
  const chapter = chapters.find((c) => norm(c.name) === norm(form.chapterName)) || null;
  const topics = chapter?.topics || [];

  // A saved name the curriculum no longer lists still shows, or picking nothing would blank it.
  const chapterOptions = [
    ...chapters.map((c) => ({ value: c.name, label: c.name })),
    ...(form.chapterName && !chapter ? [{ value: form.chapterName, label: form.chapterName }] : []),
    ...(sectionSubjectId ? [{ value: ADD_NEW, label: '+ Add a new chapter…' }] : []),
  ];
  const topicKnown = topics.some((t) => norm(t.displayName || t.name) === norm(form.topicName));
  const topicOptions = [
    ...topics.map((t) => ({ value: t.displayName || t.name, label: t.displayName || t.name })),
    ...(form.topicName && !topicKnown ? [{ value: form.topicName, label: form.topicName }] : []),
    ...(sectionSubjectId && form.chapterName ? [{ value: ADD_NEW, label: '+ Add a new topic…' }] : []),
  ];
  const skills = mergeSkillSets(SKILLS_MEASURED, skillAdditions, form.skillSet);

  const pickChapter = (value) => {
    setCurriculumError('');
    if (value === ADD_NEW) {
      setAddingChapter('');
      return;
    }
    const picked = chapters.find((c) => norm(c.name) === norm(value));
    setForm((f) => ({
      ...f,
      chapterId: picked?.id != null ? String(picked.id) : '',
      chapterName: picked ? picked.name : value || '',
      topicId: '',
      topicName: '',
    }));
  };

  const pickTopic = (value) => {
    setCurriculumError('');
    if (value === ADD_NEW) {
      setAddingTopic('');
      return;
    }
    const picked = topics.find((t) => norm(t.displayName || t.name) === norm(value));
    setForm((f) => ({
      ...f,
      topicId: picked?.id != null ? String(picked.id) : '',
      topicName: picked ? picked.displayName || picked.name : value || '',
    }));
  };

  // The server returns the whole list back, merged and ordered — no second round trip.
  const addChapter = async () => {
    const name = String(addingChapter || '').trim();
    if (!name) return;
    setBusy(true);
    setCurriculumError('');
    try {
      const list = await addSubjectChapter(sectionSubjectId, name);
      setChapters(list);
      const added = list.find((c) => norm(c.name) === norm(name));
      setForm((f) => ({
        ...f,
        chapterId: added?.id != null ? String(added.id) : '',
        chapterName: added ? added.name : name,
        topicId: '',
        topicName: '',
      }));
      setAddingChapter(null);
    } catch (e) {
      setCurriculumError(e?.message || 'Could not add that chapter.');
    } finally {
      setBusy(false);
    }
  };

  const addTopic = async () => {
    const name = String(addingTopic || '').trim();
    if (!name || !form.chapterName) return;
    setBusy(true);
    setCurriculumError('');
    try {
      const list = await addSubjectTopic(sectionSubjectId, form.chapterName, name);
      setChapters(list);
      const ch = list.find((c) => norm(c.name) === norm(form.chapterName));
      const added = (ch?.topics || []).find((t) => norm(t.displayName || t.name) === norm(name));
      setForm((f) => ({
        ...f,
        topicId: added?.id != null ? String(added.id) : '',
        topicName: added ? added.displayName || added.name : name,
      }));
      setAddingTopic(null);
    } catch (e) {
      setCurriculumError(e?.message || 'Could not add that topic.');
    } finally {
      setBusy(false);
    }
  };

  const addSkill = async () => {
    const name = String(addingSkill || '').trim();
    if (!name) return;
    setBusy(true);
    try {
      const list = await addSchoolSkillSet(name);
      setSkillAdditions(list);
      // The server tidies the spelling and hands back the existing one when it was there already.
      setField('skillSet', list.find((s) => norm(s) === norm(name)) || name);
      setAddingSkill(null);
    } catch (e) {
      onError?.(e?.message || 'Could not add that skill set.');
    } finally {
      setBusy(false);
    }
  };

  const problems = formProblems(form);

  return (
    <>
      {parentLabel ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            A sub-question of {parentLabel}. Its chapter and topic come from the question it sits under.
          </Text>
        </View>
      ) : null}

      <Select
        label="Question type"
        value={form.questionType}
        options={QUESTION_TYPES}
        onChange={(questionType) => setField('questionType', questionType)}
        disabled={saving}
      />

      <RichField
        label="Question"
        required
        value={form.questionStatement}
        onChange={(v) => setField('questionStatement', v)}
        placeholder={form.questionType === 'PARAGRAPH' ? 'The passage or instructions…' : 'Type the question…'}
        disabled={saving}
      />
      <ImageSlot
        label="the question"
        url={form.questionImageUrl}
        onChange={(url) => setField('questionImageUrl', url)}
        disabled={saving}
        onError={onError}
      />

      {isMcq ? (
        <>
          <Text style={styles.sectionLabel}>Options — add 2 to 4: text, a picture, or both</Text>
          {OPTION_KEYS.map((key, i) => (
            <View key={key} style={styles.option}>
              <RichField
                label={`Option ${String.fromCharCode(65 + i)}`}
                value={form[key]}
                onChange={(v) => setField(key, v)}
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                multiline={false}
                disabled={saving}
              />
              <ImageSlot
                label={`option ${String.fromCharCode(65 + i)}`}
                url={form[OPTION_IMAGE_KEYS[i]]}
                onChange={(url) => setField(OPTION_IMAGE_KEYS[i], url)}
                disabled={saving}
                onError={onError}
              />
            </View>
          ))}
        </>
      ) : null}

      <Select
        label="Chapter"
        value={form.chapterName || null}
        options={chapterOptions}
        onChange={pickChapter}
        placeholder={
          !sectionSubjectId
            ? 'Choose a class and subject first'
            : loadingChapters
              ? 'Loading chapters…'
              : 'Optional'
        }
        disabled={!sectionSubjectId || saving || !!parentLabel}
        searchable={chapterOptions.length > 12}
      />
      {addingChapter !== null ? (
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            value={addingChapter}
            onChangeText={setAddingChapter}
            placeholder="New chapter's name"
            placeholderTextColor={SLATE[500]}
            accessibilityLabel="New chapter's name"
          />
          <LinkButton label={busy ? 'Adding…' : 'Add'} onPress={addChapter} disabled={busy} />
          <LinkButton label="Cancel" onPress={() => setAddingChapter(null)} disabled={busy} />
        </View>
      ) : null}

      <Select
        label="Topic"
        value={form.topicName || null}
        options={topicOptions}
        onChange={pickTopic}
        placeholder={form.chapterName ? 'Optional' : 'Choose a chapter first'}
        disabled={!form.chapterName || saving || !!parentLabel}
        searchable={topicOptions.length > 12}
      />
      {addingTopic !== null ? (
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            value={addingTopic}
            onChangeText={setAddingTopic}
            placeholder="New topic's name"
            placeholderTextColor={SLATE[500]}
            accessibilityLabel="New topic's name"
          />
          <LinkButton label={busy ? 'Adding…' : 'Add'} onPress={addTopic} disabled={busy} />
          <LinkButton label="Cancel" onPress={() => setAddingTopic(null)} disabled={busy} />
        </View>
      ) : null}
      {curriculumError ? <Text style={styles.error}>{curriculumError}</Text> : null}
      {busy ? <ActivityIndicator size="small" color={PALETTE.primary} /> : null}

      <Select
        label="Bloom's taxonomy"
        value={form.bloomsTaxonomy}
        options={[{ value: '', label: 'Not set' }, ...BLOOM_TAXONOMY.map((b) => ({ value: b, label: b }))]}
        onChange={(bloomsTaxonomy) => setField('bloomsTaxonomy', bloomsTaxonomy)}
        disabled={saving}
      />
      <Select
        label="Skill set"
        searchable
        value={form.skillSet}
        options={[
          { value: '', label: 'Not set' },
          ...skills.map((s) => ({ value: s, label: s })),
          { value: ADD_NEW, label: '+ Add a new skill set…' },
        ]}
        onChange={(value) => (value === ADD_NEW ? setAddingSkill('') : setField('skillSet', value))}
        disabled={saving}
      />
      {addingSkill !== null ? (
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            value={addingSkill}
            onChangeText={setAddingSkill}
            placeholder="New skill set — added for the whole school"
            placeholderTextColor={SLATE[500]}
            accessibilityLabel="New skill set"
          />
          <LinkButton label={busy ? 'Adding…' : 'Add'} onPress={addSkill} disabled={busy} />
          <LinkButton label="Cancel" onPress={() => setAddingSkill(null)} disabled={busy} />
        </View>
      ) : null}

      {partsTotal != null ? (
        <TextField label="Marks" value={String(partsTotal)} editable={false} helper={
          <Text style={styles.hint}>The sum of its sub-questions — change their marks to change this.</Text>
        } />
      ) : (
        <TextField
          label="Marks"
          value={form.marks}
          // Whole marks: the server stores what a question is worth as a whole number.
          onChangeText={(marks) => setField('marks', marks.replace(/[^0-9]/g, ''))}
          keyboardType="numeric"
          placeholder="No maximum"
          helper={
            form.marks === '' ? (
              <Text style={styles.hint}>No maximum of its own: the paper is marked out of its total marks instead.</Text>
            ) : form.questionType === 'PARAGRAPH' ? (
              <Text style={styles.hint}>A passage usually carries no marks — its sub-questions do.</Text>
            ) : null
          }
        />
      )}

      <RichField
        label="Sample answer"
        value={form.sampleAnswer}
        onChange={(v) => setField('sampleAnswer', v)}
        placeholder="Optional"
        disabled={saving}
      />
      <ImageSlot
        label="the sample answer"
        url={form.sampleAnswerImageUrl}
        onChange={(url) => setField('sampleAnswerImageUrl', url)}
        disabled={saving}
        onError={onError}
      />

      {problems.map((p) => (
        <Text key={p} style={styles.error}>
          {p}
        </Text>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: PALETTE.tint,
    marginBottom: 10,
  },
  bannerText: { fontSize: TYPE.label, color: PALETTE.primaryDark, fontWeight: '600' },
  sectionLabel: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[700], marginVertical: 6 },
  option: { paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: SLATE[100], marginBottom: 4 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -4, marginBottom: 10 },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: TYPE.body,
    color: SLATE[900],
  },
  hint: { fontSize: TYPE.label, color: SLATE[500] },
  error: { fontSize: TYPE.label, color: FEEDBACK.errorText, marginVertical: 3, fontWeight: '600' },
});
