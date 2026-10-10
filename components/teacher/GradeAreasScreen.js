import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, PORTALS, SLATE, SPACING, TYPE } from '../../constants/theme';
import { Card, EmptyState, FormSheet, ScreenScaffold, TextField, useToast } from '../ui';
import {
  GRADE_AREA_CATEGORIES,
  addGradeField,
  addGradeFieldsBulk,
  fetchGradeSections,
  fetchGradeSheet,
  removeGradeField,
  saveGrades,
} from '../../services/teacher/gradeAreaService';
import StudentSearchBar from '../staff/shared/StudentSearchBar';
import { useStudentSearch } from '../../utils/studentSearch';

/**
 * Scholastics / Co-Scholastics / Additional Skills — the website's GradeAreas, one screen for all
 * three: a teacher records "Life Skill: A" exactly as "Robotics: A".
 *
 * The website draws students × areas. On a phone one AREA is shown at a time — its column — with
 * every student's grade beside their name and "Set all" for the column, which is the website's own
 * "set the whole column, then fix the few who differ" move. What is typed is kept apart from the
 * sheet, so switching areas loses nothing, and Save sends only what changed.
 */

const PALETTE = PORTALS.school;
const key = (fieldId, studentId) => `${fieldId}:${studentId}`;

export default function GradeAreasScreen({ category, homeRoute = '/teacher' }) {
  const meta = GRADE_AREA_CATEGORIES[category];
  const { toast, showToast } = useToast();
  const [sections, setSections] = useState(null);
  const [sectionId, setSectionId] = useState(null);
  const [sheet, setSheet] = useState(null);
  const studentSearch = useStudentSearch(sheet?.students);
  const [fieldId, setFieldId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [newField, setNewField] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkNames, setBulkNames] = useState('');
  const [bulkSections, setBulkSections] = useState([]);
  const [setAllOpen, setSetAllOpen] = useState(false);
  const [setAllValue, setSetAllValue] = useState('A');

  useEffect(() => {
    let alive = true;
    fetchGradeSections()
      .then((rows) => {
        if (!alive) return;
        setSections(rows);
        if (rows.length === 1) setSectionId(rows[0].sectionId);
      })
      .catch(() => alive && setSections([]));
    return () => {
      alive = false;
    };
  }, []);

  const loadSheet = useCallback(
    async (id, keepField) => {
      if (!id) {
        setSheet(null);
        return;
      }
      setLoading(true);
      setEdits({});
      try {
        const res = await fetchGradeSheet(category, id);
        setSheet(res);
        const fields = res?.fields || [];
        setFieldId((current) =>
          keepField && fields.some((f) => f.id === current) ? current : fields[0]?.id ?? null,
        );
      } catch (e) {
        setSheet(null);
        showToast(e?.message || 'Could not load that section.', 'error');
      } finally {
        setLoading(false);
      }
    },
    [category, showToast],
  );

  useEffect(() => {
    loadSheet(sectionId, false);
  }, [sectionId, loadSheet]);

  const field = sheet?.fields?.find((f) => f.id === fieldId) || null;
  const dirty = Object.keys(edits).length;
  const gradeOf = (student) => {
    const k = key(fieldId, student.studentId);
    return k in edits ? edits[k] : student.grades?.[fieldId] ?? '';
  };

  const selectSection = (id) => {
    const go = () => setSectionId(id);
    if (!dirty) return go();
    Alert.alert('Leave without saving?', `${dirty} grade change(s) are not saved yet.`, [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: go },
    ]);
    return undefined;
  };

  const save = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      const grades = Object.entries(edits).map(([k, grade]) => {
        const [f, s] = k.split(':');
        return { fieldId: Number(f), studentId: Number(s), grade };
      });
      const res = await saveGrades(sectionId, grades);
      showToast(`Saved ${res?.saved ?? grades.length} grade(s).`, 'success');
      await loadSheet(sectionId, true);
    } catch (e) {
      showToast(e?.message || 'Could not save.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addField = async () => {
    const name = newField.trim();
    if (!name || !sectionId) return;
    try {
      await addGradeField(category, sectionId, name);
      setNewField('');
      await loadSheet(sectionId, true);
    } catch (e) {
      showToast(e?.message || 'Could not add that area.', 'error');
    }
  };

  const removeField = () => {
    if (!field) return;
    Alert.alert(
      `Remove "${field.fieldName}"?`,
      'It is removed from this section, and every grade recorded against it is deleted too.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeGradeField(field.id);
              await loadSheet(sectionId, false);
            } catch (e) {
              showToast(e?.message || 'Could not remove that area.', 'error');
            }
          },
        },
      ],
    );
  };

  /** "Set the whole column, then fix the few who differ." Local until Save. */
  const applySetAll = () => {
    if (!sheet || !fieldId) return;
    setEdits((prev) => {
      const next = { ...prev };
      sheet.students.forEach((s) => {
        next[key(fieldId, s.studentId)] = setAllValue;
      });
      return next;
    });
    setSetAllOpen(false);
  };

  const bulkAdd = async () => {
    const names = bulkNames
      .split(/[\n,]/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (!names.length || !bulkSections.length) return;
    try {
      const res = await addGradeFieldsBulk(category, names, bulkSections);
      showToast(
        `Added ${res?.created ?? 0} area(s) across ${res?.sectionsTouched ?? 0} section(s).${
          res?.alreadyPresent ? ` ${res.alreadyPresent} were already there.` : ''
        }`,
        'success',
      );
      setBulkOpen(false);
      setBulkNames('');
      setBulkSections([]);
      await loadSheet(sectionId, true);
    } catch (e) {
      showToast(e?.message || 'Could not add those areas.', 'error');
    }
  };

  const Chip = ({ label, active, onPress }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.chipOn, pressed && styles.pressed]}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );

  const sectionLabel = useMemo(() => (s) => `Class ${s.className} – ${s.sectionName}`, []);

  return (
    <ScreenScaffold title={meta?.title || 'Grades'} fallbackRoute={homeRoute} scroll={false} toast={toast}>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.blurb}>{meta?.blurb}</Text>

        {sections === null ? (
          <ActivityIndicator size="large" color={PALETTE.primary} style={styles.loader} />
        ) : sections.length === 0 ? (
          <EmptyState
            icon="school-outline"
            title="No classes yet"
            message="You have no classes yet. Once you are assigned classes, the same classes appear here."
          />
        ) : (
          <>
            <Text style={styles.label}>Class & section</Text>
            <View style={styles.chips}>
              {sections.map((s) => (
                <Chip
                  key={s.sectionId}
                  label={sectionLabel(s)}
                  active={s.sectionId === sectionId}
                  onPress={() => selectSection(s.sectionId)}
                />
              ))}
            </View>
            {sections.length > 1 ? (
              <Pressable onPress={() => setBulkOpen(true)} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
                <Text style={styles.linkText}>＋ Add areas to several sections</Text>
              </Pressable>
            ) : null}

            {!sectionId ? (
              <Text style={styles.hint}>Choose a class and section to begin.</Text>
            ) : loading ? (
              <ActivityIndicator size="large" color={PALETTE.primary} style={styles.loader} />
            ) : !sheet ? null : (
              <>
                <View style={styles.addRow}>
                  <TextInput
                    style={styles.addInput}
                    value={newField}
                    onChangeText={setNewField}
                    placeholder={`Add an area (e.g. ${meta?.example})`}
                    placeholderTextColor={SLATE[500]}
                    maxLength={150}
                    onSubmitEditing={addField}
                    accessibilityLabel="New area"
                  />
                  <Pressable
                    onPress={addField}
                    disabled={!newField.trim()}
                    style={({ pressed }) => [styles.addBtn, !newField.trim() && styles.disabled, pressed && styles.pressed]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.addBtnText}>Add area</Text>
                  </Pressable>
                </View>

                {sheet.fields.length === 0 ? (
                  <Text style={styles.hint}>
                    No areas yet for Class {sheet.className} – {sheet.sectionName}. Add one above, or ask your School
                    Admin to set them up for every section at once.
                  </Text>
                ) : sheet.students.length === 0 ? (
                  <Text style={styles.hint}>No students in this section yet.</Text>
                ) : (
                  <>
                    <Text style={styles.label}>Area</Text>
                    <View style={styles.chips}>
                      {sheet.fields.map((f) => (
                        <Chip key={f.id} label={f.fieldName} active={f.id === fieldId} onPress={() => setFieldId(f.id)} />
                      ))}
                    </View>

                    {field ? (
                      <Card>
                        <View style={styles.fieldHead}>
                          <Text style={styles.fieldName}>{field.fieldName}</Text>
                          <Pressable onPress={() => setSetAllOpen(true)} style={({ pressed }) => [styles.smallBtn, pressed && styles.pressed]}>
                            <Text style={styles.smallBtnText}>Set all</Text>
                          </Pressable>
                          <Pressable
                            onPress={removeField}
                            hitSlop={6}
                            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                            accessibilityLabel={`Remove ${field.fieldName}`}
                          >
                            <Ionicons name="trash-outline" size={17} color={FEEDBACK.errorText} />
                          </Pressable>
                        </View>
                        <StudentSearchBar search={studentSearch} />
                        {studentSearch.results.map((s) => {
                          const changed = key(fieldId, s.studentId) in edits;
                          return (
                            <View key={s.studentId} style={styles.row}>
                              <View style={styles.rowName}>
                                <Text style={styles.name} numberOfLines={1}>
                                  {s.studentName}
                                </Text>
                                {s.rollNumber ? <Text style={styles.meta}>Roll {s.rollNumber}</Text> : null}
                              </View>
                              <TextInput
                                style={[styles.gradeInput, changed && styles.gradeChanged]}
                                value={gradeOf(s)}
                                maxLength={50}
                                autoCapitalize="characters"
                                onChangeText={(v) => setEdits((prev) => ({ ...prev, [key(fieldId, s.studentId)]: v }))}
                                accessibilityLabel={`${s.studentName}, ${field.fieldName}`}
                              />
                            </View>
                          );
                        })}
                      </Card>
                    ) : null}
                  </>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      {sheet && sheet.fields.length > 0 ? (
        <View style={styles.saveBar}>
          <Text style={styles.saveText}>{dirty === 0 ? 'No changes yet' : `${dirty} change(s) not yet saved`}</Text>
          <Pressable
            onPress={save}
            disabled={saving || dirty === 0}
            style={({ pressed }) => [styles.saveBtn, (saving || dirty === 0) && styles.disabled, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save grades'}</Text>
          </Pressable>
        </View>
      ) : null}

      <FormSheet
        visible={setAllOpen}
        title={field ? `Set all — ${field.fieldName}` : 'Set all'}
        subtitle="Every student in the section; change individuals afterwards"
        onClose={() => setSetAllOpen(false)}
        onSubmit={applySetAll}
        submitLabel="Set for everyone"
      >
        <TextField label="Grade" value={setAllValue} onChangeText={setSetAllValue} autoCapitalize="characters" maxLength={50} />
      </FormSheet>

      <FormSheet
        visible={bulkOpen}
        title="Add areas to several sections"
        subtitle="One area per line — a section that already has one keeps it"
        onClose={() => setBulkOpen(false)}
        onSubmit={bulkAdd}
        submitDisabled={!bulkNames.trim() || !bulkSections.length}
        submitLabel="Add areas"
        fullHeight
      >
        <TextField
          label="Areas"
          value={bulkNames}
          onChangeText={setBulkNames}
          placeholder={'Life Skill\nSEWA Activity\nDiscipline'}
          multiline
          inputStyle={styles.multiline}
        />
        <Text style={styles.label}>Sections</Text>
        <View style={styles.chips}>
          {(sections || []).map((s) => {
            const on = bulkSections.includes(s.sectionId);
            return (
              <Chip
                key={s.sectionId}
                label={sectionLabel(s)}
                active={on}
                onPress={() =>
                  setBulkSections((prev) => (on ? prev.filter((x) => x !== s.sectionId) : [...prev, s.sectionId]))
                }
              />
            );
          })}
        </View>
      </FormSheet>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  listContent: { padding: SPACING.md, paddingBottom: 96, gap: SPACING.sm },
  loader: { marginVertical: SPACING.lg },
  blurb: { fontSize: TYPE.body, color: SLATE[600] },
  label: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[700], marginTop: SPACING.sm },
  hint: { fontSize: TYPE.label, color: SLATE[500], marginVertical: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
  },
  chipOn: { backgroundColor: PALETTE.tint, borderColor: PALETTE.primary },
  chipText: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[600] },
  chipTextOn: { color: PALETTE.primaryDark },
  link: { alignSelf: 'flex-start', paddingVertical: 4 },
  linkText: { fontSize: TYPE.label, fontWeight: '700', color: PALETTE.primaryDark },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: SPACING.sm },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: TYPE.body,
    color: SLATE[900],
    backgroundColor: '#ffffff',
  },
  addBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: PALETTE.primary },
  addBtnText: { fontSize: TYPE.label, fontWeight: '700', color: '#ffffff' },
  fieldHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  fieldName: { flex: 1, fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  smallBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PALETTE.primary,
    backgroundColor: PALETTE.tint,
  },
  smallBtnText: { fontSize: TYPE.label, fontWeight: '700', color: PALETTE.primaryDark },
  iconBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: SLATE[50] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  rowName: { flex: 1 },
  name: { fontSize: TYPE.body, fontWeight: '600', color: SLATE[800] },
  meta: { fontSize: TYPE.caption, color: SLATE[500] },
  gradeInput: {
    width: 84,
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 8,
    textAlign: 'center',
    fontSize: TYPE.heading,
    fontWeight: '700',
    color: SLATE[900],
    backgroundColor: '#ffffff',
  },
  gradeChanged: { backgroundColor: FEEDBACK.warningBg, borderColor: FEEDBACK.warningText },
  saveBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: SLATE[200],
  },
  saveText: { flex: 1, fontSize: TYPE.label, color: SLATE[600] },
  saveBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: PALETTE.primary },
  saveBtnText: { fontSize: TYPE.body, fontWeight: '700', color: '#ffffff' },
  multiline: { height: 110, textAlignVertical: 'top' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
});
