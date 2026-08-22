import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import {
  Card,
  EmptyState,
  FormSheet,
  ScreenScaffold,
  Select,
  StatusChip,
  TextField,
  useToast,
} from '../../ui';
import useStaffResource from '../../../hooks/useStaffResource';
import {
  SUBJECT_TYPES,
  availableAcademicSubjects,
  availableClasses,
  availableCodingSubjects,
  availableSections,
  buildSubjectPayload,
  createAcademicYear,
  createClasses,
  createSections,
  createSubjects,
  deleteClass,
  deleteSection,
  deleteSubject,
  fetchAcademicCatalogue,
  fetchCodingCurriculums,
  fetchSchoolClasses,
  importAcademicYear,
  updateSubject,
} from '../../../services/admin/classService';
import { defaultAcademicYear, fetchAcademicYears } from '../../../services/teacher/scopeService';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * Class Management — the school's Academic Year → Class → Section → Subject tree.
 *
 * The web lays this out as three side-by-side columns, which cannot work on a phone, so the native
 * screen is an accordion: classes expand to sections, sections expand to subjects, and each level
 * has its own add button. Every write is bulk (see classService) and every delete is destructive
 * and cascading, so all three confirm.
 *
 * Everything creatable comes from a CATALOGUE, not free text: the school's board decides which
 * classes and subjects exist. Only a custom subject can be typed.
 */

function Chip({ label, selected, onPress }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && { backgroundColor: PALETTE.tint, borderColor: PALETTE.primary },
        pressed && styles.pressed,
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
    >
      <Text style={[styles.chipText, selected && { color: PALETTE.primaryDark }]}>{label}</Text>
    </Pressable>
  );
}

export default function ClassManagementScreen({ homeRoute, apiBase, academicYearWrites }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const { toast, showToast } = useToast();

  const [years, setYears] = useState([]);
  const [yearId, setYearId] = useState(null);
  const [openClass, setOpenClass] = useState(null);
  const [openSection, setOpenSection] = useState(null);

  // Which sheet is open: 'year' | 'import' | 'class' | 'section' | 'subject' | 'editSubject'
  const [sheet, setSheet] = useState(null);
  const [saving, setSaving] = useState(false);

  const [yearLabel, setYearLabel] = useState('');
  const [importFrom, setImportFrom] = useState(null);
  const [pickedClasses, setPickedClasses] = useState([]);
  const [pickedSections, setPickedSections] = useState([]);
  const [pickedAcademic, setPickedAcademic] = useState([]);
  const [pickedCoding, setPickedCoding] = useState([]);
  const [codes, setCodes] = useState({});
  const [customName, setCustomName] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [subjectType, setSubjectType] = useState('THEORY');
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ subjectName: '', subjectCode: '', subjectType: '' });

  const loadYears = useCallback(async () => {
    const rows = await fetchAcademicYears();
    setYears(rows);
    setYearId((prev) => prev ?? defaultAcademicYear(rows)?.id ?? null);
    return rows;
  }, []);

  useEffect(() => {
    loadYears().catch(() => setYears([]));
  }, [loadYears]);

  const classesFetcher = useCallback(
    (signal) => fetchSchoolClasses(apiBase, yearId, signal),
    [apiBase, yearId],
  );
  const { data, loading, error, refreshing, reload, refresh, revalidate } = useStaffResource(
    classesFetcher,
    { enabled: !!yearId, initialData: [] },
  );

  const catalogueFetcher = useCallback(
    (signal) => fetchAcademicCatalogue(apiBase, signal),
    [apiBase],
  );
  const { data: catalogue } = useStaffResource(catalogueFetcher, {
    initialData: { classes: [], board: null },
  });

  const codingFetcher = useCallback((signal) => fetchCodingCurriculums(signal), []);
  const { data: coding } = useStaffResource(codingFetcher, { initialData: [] });

  const classes = data || [];
  const catalogueClasses = catalogue?.classes || [];
  const codingCurriculums = coding || [];

  const currentClass = useMemo(
    () => classes.find((c) => c.id === openClass) || null,
    [classes, openClass],
  );
  const currentSection = useMemo(
    () => (currentClass?.sections || []).find((s) => s.id === openSection) || null,
    [currentClass, openSection],
  );

  const creatableClasses = useMemo(
    () => availableClasses(catalogueClasses, classes),
    [catalogueClasses, classes],
  );
  const creatableSections = useMemo(() => availableSections(currentClass), [currentClass]);
  const creatableAcademic = useMemo(
    () => availableAcademicSubjects(catalogueClasses, currentClass, currentSection),
    [catalogueClasses, currentClass, currentSection],
  );
  const creatableCoding = useMemo(
    () => availableCodingSubjects(codingCurriculums, currentSection),
    [codingCurriculums, currentSection],
  );

  // Only years that actually have classes are worth importing from, and never the current one.
  const importableYears = useMemo(
    () => years.filter((y) => y.id !== yearId && y.classCount > 0),
    [years, yearId],
  );

  const closeSheet = () => {
    setSheet(null);
    setPickedClasses([]);
    setPickedSections([]);
    setPickedAcademic([]);
    setPickedCoding([]);
    setCodes({});
    setCustomName('');
    setCustomCode('');
    setSubjectType('THEORY');
    setYearLabel('');
    setImportFrom(null);
    setEditing(null);
  };

  const run = async (fn, okMessage) => {
    setSaving(true);
    try {
      await fn();
      showToast(okMessage, 'success');
      closeSheet();
      await revalidate();
    } catch (e) {
      showToast(e?.message || 'Something went wrong.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (kind, name, fn) =>
    Alert.alert(
      `Delete ${kind}?`,
      `"${name}" and everything inside it will be removed. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await fn();
              showToast(`${kind} deleted.`, 'success');
              await revalidate();
            } catch (e) {
              showToast(e?.message || `Failed to delete ${kind}.`, 'error');
            }
          },
        },
      ],
    );

  const toggle = (list, setList, value) =>
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const submitSubjects = () =>
    run(
      () =>
        createSubjects(apiBase, {
          sectionId: currentSection.id,
          subjects: buildSubjectPayload({
            academicNames: pickedAcademic,
            codingNames: pickedCoding,
            customName,
            codes,
            customCode,
            subjectType,
            catalogueSubjects: creatableAcademic,
            codingCurriculums: creatableCoding,
          }),
        }),
      'Subjects added.',
    );

  return (
    <ScreenScaffold
      title="Class Management"
      fallbackRoute={homeRoute}
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
      toast={toast}
    >
      <View style={styles.yearBar}>
        <Select
          variant="chip"
          label="Academic year"
          value={yearId}
          onChange={setYearId}
          options={years.map((year) => ({
            value: year.id,
            label: year.current ? `${year.yearLabel} (Current)` : year.yearLabel,
          }))}
          placeholder="Choose a year"
        />
        <Pressable
          onPress={() => setSheet('year')}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Add academic year"
        >
          <Ionicons name="add-circle-outline" size={22} color={PALETTE.primaryDark} />
        </Pressable>
        {importableYears.length ? (
          <Pressable
            onPress={() => setSheet('import')}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Import from another year"
          >
            <Ionicons name="download-outline" size={20} color={PALETTE.primaryDark} />
          </Pressable>
        ) : null}
      </View>

      {catalogue?.board ? <Text style={styles.board}>Board: {catalogue.board}</Text> : null}

      {!yearId ? (
        <EmptyState
          icon="calendar-outline"
          title="No academic year"
          message="Create an academic year before adding classes."
          actionLabel="Add academic year"
          onAction={() => setSheet('year')}
        />
      ) : classes.length === 0 ? (
        <EmptyState
          icon="school-outline"
          title="No classes yet"
          message="Add the classes your school runs this year."
          actionLabel="Add classes"
          onAction={() => setSheet('class')}
        />
      ) : (
        classes.map((cls) => {
          const expanded = openClass === cls.id;
          return (
            <Card key={cls.id} style={styles.node}>
              <View style={styles.nodeHead}>
                <Pressable
                  onPress={() => {
                    setOpenClass(expanded ? null : cls.id);
                    setOpenSection(null);
                  }}
                  style={({ pressed }) => [styles.nodeTap, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                >
                  <Ionicons
                    name={expanded ? 'chevron-down' : 'chevron-forward'}
                    size={17}
                    color={PALETTE.primaryDark}
                  />
                  <Text style={styles.className}>Class {cls.className}</Text>
                  <StatusChip label={`${(cls.sections || []).length} sections`} tone="neutral" />
                </Pressable>
                <Pressable
                  onPress={() =>
                    confirmDelete('class', `Class ${cls.className}`, () =>
                      deleteClass(apiBase, cls.id),
                    )
                  }
                  style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete class ${cls.className}`}
                >
                  <Ionicons name="trash-outline" size={17} color={SLATE[400]} />
                </Pressable>
              </View>

              {expanded ? (
                <View style={styles.nodeBody}>
                  {(cls.sections || []).map((section) => {
                    const open = openSection === section.id;
                    return (
                      <View key={section.id} style={styles.section}>
                        <View style={styles.nodeHead}>
                          <Pressable
                            onPress={() => setOpenSection(open ? null : section.id)}
                            style={({ pressed }) => [styles.nodeTap, pressed && styles.pressed]}
                            accessibilityRole="button"
                            accessibilityState={{ expanded: open }}
                          >
                            <Ionicons
                              name={open ? 'chevron-down' : 'chevron-forward'}
                              size={15}
                              color={SLATE[500]}
                            />
                            <Text style={styles.sectionName}>Section {section.sectionName}</Text>
                            <StatusChip
                              label={`${(section.subjects || []).length} subjects`}
                              tone="neutral"
                            />
                          </Pressable>
                          <Pressable
                            onPress={() =>
                              confirmDelete(
                                'section',
                                `Section ${section.sectionName}`,
                                () => deleteSection(apiBase, section.id),
                              )
                            }
                            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                            accessibilityRole="button"
                            accessibilityLabel={`Delete section ${section.sectionName}`}
                          >
                            <Ionicons name="trash-outline" size={15} color={SLATE[400]} />
                          </Pressable>
                        </View>

                        {open ? (
                          <View style={styles.subjectList}>
                            {(section.subjects || []).map((subject) => (
                              <View key={subject.id} style={styles.subject}>
                                <View style={styles.subjectText}>
                                  <Text style={styles.subjectName}>{subject.subjectName}</Text>
                                  <Text style={styles.subjectMeta}>
                                    {[subject.subjectCode, subject.subjectType]
                                      .filter(Boolean)
                                      .join(' · ')}
                                    {subject.academicIqSubjectId ? ' · linked' : ''}
                                  </Text>
                                </View>
                                <Pressable
                                  onPress={() => {
                                    setEditing(subject);
                                    setEditForm({
                                      subjectName: subject.subjectName || '',
                                      subjectCode: subject.subjectCode || '',
                                      subjectType: subject.subjectType || 'THEORY',
                                    });
                                    setSheet('editSubject');
                                  }}
                                  style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Edit ${subject.subjectName}`}
                                >
                                  <Ionicons name="pencil-outline" size={15} color={SLATE[400]} />
                                </Pressable>
                                <Pressable
                                  onPress={() =>
                                    confirmDelete('subject', subject.subjectName, () =>
                                      deleteSubject(apiBase, subject.id),
                                    )
                                  }
                                  style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Delete ${subject.subjectName}`}
                                >
                                  <Ionicons name="trash-outline" size={15} color={SLATE[400]} />
                                </Pressable>
                              </View>
                            ))}
                            <Pressable
                              onPress={() => {
                                setOpenSection(section.id);
                                setSheet('subject');
                              }}
                              style={({ pressed }) => [styles.addRow, pressed && styles.pressed]}
                              accessibilityRole="button"
                            >
                              <Ionicons name="add" size={16} color={PALETTE.primaryDark} />
                              <Text style={[styles.addText, { color: PALETTE.primaryDark }]}>
                                Add subjects
                              </Text>
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}

                  <Pressable
                    onPress={() => setSheet('section')}
                    style={({ pressed }) => [styles.addRow, pressed && styles.pressed]}
                    accessibilityRole="button"
                  >
                    <Ionicons name="add" size={16} color={PALETTE.primaryDark} />
                    <Text style={[styles.addText, { color: PALETTE.primaryDark }]}>
                      Add sections
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </Card>
          );
        })
      )}

      {yearId && classes.length > 0 ? (
        <Pressable
          onPress={() => setSheet('class')}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: PALETTE.primary },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Add classes"
        >
          <Ionicons name="add" size={26} color="#ffffff" />
        </Pressable>
      ) : null}

      {/* ── academic year ─────────────────────────────────────────────────── */}
      <FormSheet
        visible={sheet === 'year'}
        title="New academic year"
        onClose={closeSheet}
        onSubmit={() =>
          run(async () => {
            const created = await createAcademicYear(academicYearWrites, yearLabel);
            await loadYears();
            if (created?.id) setYearId(created.id);
          }, 'Academic year added.')
        }
        submitLabel="Add"
        submitting={saving}
        submitDisabled={!yearLabel.trim()}
      >
        <TextField
          label="Year label"
          required
          value={yearLabel}
          onChangeText={setYearLabel}
          placeholder="e.g. 2026-27"
        />
        <Text style={styles.hint}>
          A new year starts empty. Use Import to copy last year&apos;s classes into it.
        </Text>
      </FormSheet>

      <FormSheet
        visible={sheet === 'import'}
        title="Import from another year"
        onClose={closeSheet}
        onSubmit={() =>
          run(async () => {
            const result = await importAcademicYear(academicYearWrites, importFrom, yearId);
            showToast(
              `Imported ${result.classesCopied ?? 0} classes, ${result.sectionsCopied ?? 0} sections, ${result.subjectsCopied ?? 0} subjects.`,
              'success',
            );
          }, 'Import complete.')
        }
        submitLabel="Import"
        submitting={saving}
        submitDisabled={!importFrom}
      >
        <Select
          label="Copy from"
          value={importFrom}
          onChange={setImportFrom}
          options={importableYears.map((year) => ({
            value: year.id,
            label: `${year.yearLabel} (${year.classCount} classes)`,
          }))}
          placeholder="Choose a year"
        />
        <Text style={styles.hint}>
          Copies classes, sections and subjects into the year selected above. Existing entries stay.
        </Text>
      </FormSheet>

      {/* ── classes ───────────────────────────────────────────────────────── */}
      <FormSheet
        visible={sheet === 'class'}
        title="Add classes"
        subtitle="From your board's curriculum"
        onClose={closeSheet}
        onSubmit={() =>
          run(
            () => createClasses(apiBase, { classNames: pickedClasses, academicYearId: yearId }),
            `${pickedClasses.length} class(es) added.`,
          )
        }
        submitLabel="Add"
        submitting={saving}
        submitDisabled={pickedClasses.length === 0}
      >
        {creatableClasses.length === 0 ? (
          <Text style={styles.hint}>Every class in your curriculum has already been added.</Text>
        ) : (
          <View style={styles.chipWrap}>
            {creatableClasses.map((cls) => (
              <Chip
                key={cls.name}
                label={cls.name}
                selected={pickedClasses.includes(cls.name)}
                onPress={() => toggle(pickedClasses, setPickedClasses, cls.name)}
              />
            ))}
          </View>
        )}
      </FormSheet>

      {/* ── sections ──────────────────────────────────────────────────────── */}
      <FormSheet
        visible={sheet === 'section'}
        title="Add sections"
        subtitle={currentClass ? `Class ${currentClass.className}` : undefined}
        onClose={closeSheet}
        onSubmit={() =>
          run(
            () => createSections(apiBase, { classId: currentClass.id, sectionNames: pickedSections }),
            `${pickedSections.length} section(s) added.`,
          )
        }
        submitLabel="Add"
        submitting={saving}
        submitDisabled={pickedSections.length === 0}
      >
        {creatableSections.length === 0 ? (
          <Text style={styles.hint}>This class already has every section (A–F).</Text>
        ) : (
          <View style={styles.chipWrap}>
            {creatableSections.map((name) => (
              <Chip
                key={name}
                label={name}
                selected={pickedSections.includes(name)}
                onPress={() => toggle(pickedSections, setPickedSections, name)}
              />
            ))}
          </View>
        )}
      </FormSheet>

      {/* ── subjects ──────────────────────────────────────────────────────── */}
      <FormSheet
        visible={sheet === 'subject'}
        title="Add subjects"
        subtitle={
          currentClass && currentSection
            ? `Class ${currentClass.className} · Section ${currentSection.sectionName}`
            : undefined
        }
        onClose={closeSheet}
        onSubmit={submitSubjects}
        submitLabel="Add"
        submitting={saving}
        submitDisabled={
          pickedAcademic.length === 0 && pickedCoding.length === 0 && !customName.trim()
        }
        fullHeight
      >
        <Select
          label="Type"
          value={subjectType}
          onChange={setSubjectType}
          options={SUBJECT_TYPES}
        />

        {creatableAcademic.length ? (
          <>
            <Text style={styles.groupLabel}>Curriculum subjects</Text>
            <View style={styles.chipWrap}>
              {creatableAcademic.map((subject) => (
                <Chip
                  key={subject.name}
                  label={subject.name}
                  selected={pickedAcademic.includes(subject.name)}
                  onPress={() => {
                    toggle(pickedAcademic, setPickedAcademic, subject.name);
                    // Seed the code from the catalogue, as the web's Select-All does.
                    setCodes((prev) =>
                      prev[subject.name] === undefined
                        ? { ...prev, [subject.name]: subject.subjectCode || '' }
                        : prev,
                    );
                  }}
                />
              ))}
            </View>
          </>
        ) : null}

        {creatableCoding.length ? (
          <>
            <Text style={styles.groupLabel}>Coding Pro</Text>
            <View style={styles.chipWrap}>
              {creatableCoding.map((curriculum) => (
                <Chip
                  key={curriculum.name}
                  label={curriculum.name}
                  selected={pickedCoding.includes(curriculum.name)}
                  onPress={() => toggle(pickedCoding, setPickedCoding, curriculum.name)}
                />
              ))}
            </View>
          </>
        ) : null}

        {/* Every subject needs a code — the backend takes the batch or none of it. */}
        {[...pickedAcademic, ...pickedCoding].map((name) => (
          <TextField
            key={name}
            label={`${name} code`}
            required
            value={codes[name] || ''}
            onChangeText={(value) => setCodes((prev) => ({ ...prev, [name]: value }))}
            placeholder="e.g. MATH01"
          />
        ))}

        <Text style={styles.groupLabel}>Custom subject</Text>
        <TextField
          label="Name"
          value={customName}
          onChangeText={setCustomName}
          placeholder="Only if it is not in the curriculum"
        />
        {customName.trim() ? (
          <TextField
            label="Code"
            required
            value={customCode}
            onChangeText={setCustomCode}
            placeholder="e.g. ART01"
          />
        ) : null}
      </FormSheet>

      <FormSheet
        visible={sheet === 'editSubject'}
        title="Edit subject"
        onClose={closeSheet}
        onSubmit={() =>
          run(() => updateSubject(apiBase, editing.id, editForm), 'Subject updated.')
        }
        submitLabel="Save"
        submitting={saving}
        submitDisabled={!editForm.subjectName.trim() || !editForm.subjectCode.trim()}
      >
        <TextField
          label="Name"
          required
          value={editForm.subjectName}
          onChangeText={(subjectName) => setEditForm((prev) => ({ ...prev, subjectName }))}
        />
        <TextField
          label="Code"
          required
          value={editForm.subjectCode}
          onChangeText={(subjectCode) => setEditForm((prev) => ({ ...prev, subjectCode }))}
        />
        <Select
          label="Type"
          value={editForm.subjectType}
          onChange={(value) => setEditForm((prev) => ({ ...prev, subjectType: value }))}
          options={SUBJECT_TYPES}
        />
      </FormSheet>
    </ScreenScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  yearBar: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  board: { fontSize: 12, color: SLATE[500], fontWeight: '600', marginTop: 6 },
  iconBtn: { padding: 5 },
  node: { marginTop: SPACING.sm },
  nodeHead: { flexDirection: 'row', alignItems: 'center' },
  nodeTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 4 },
  className: { flex: 1, fontSize: 15, fontWeight: '700', color: SLATE[800] },
  nodeBody: { marginTop: 6 },
  section: {
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
    paddingTop: 6,
    marginTop: 6,
    paddingLeft: 8,
  },
  sectionName: { flex: 1, fontSize: 13.5, fontWeight: '700', color: SLATE[700] },
  subjectList: { paddingLeft: 12, marginTop: 4 },
  subject: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: SLATE[100],
  },
  subjectText: { flex: 1 },
  subjectName: { fontSize: 13, fontWeight: '600', color: SLATE[700] },
  subjectMeta: { fontSize: 11, color: SLATE[400], marginTop: 1 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 },
  addText: { fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  fab: {
    position: 'absolute',
    right: SPACING.md,
    bottom: SPACING.md,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: SPACING.sm },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
  },
  chipText: { fontSize: 13, fontWeight: '700', color: SLATE[600] },
  groupLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    color: p.primaryDark,
    marginTop: SPACING.sm,
    marginBottom: 6,
  },
  hint: { fontSize: 12.5, color: SLATE[500], lineHeight: 18, marginTop: 4 },
}));
