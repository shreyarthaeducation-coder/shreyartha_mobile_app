import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Platform, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE, leading } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import {
  Card,
  CardTitle,
  EmptyState,
  FormSheet,
  ScreenScaffold,
  Select,
  StatusChip,
  TextField,
  useToast,
} from '../../ui';
import { DuplicateStudentsCard, StudentMergeSheet } from '../shared/StudentMerge';
import useStaffResource from '../../../hooks/useStaffResource';
import { fetchSchoolClasses } from '../../../services/admin/classService';
import { defaultAcademicYear, fetchAcademicYears } from '../../../services/teacher/scopeService';
import {
  IMPORT_FILE_TYPES,
  ORIGIN_LABEL,
  STATUS_TEXT,
  ROSTER_EXPORT_FORMAT,
  commitStudentImport,
  downloadImportTemplate,
  fetchRoster,
  fetchRosterDuplicates,
  fetchUnplaced,
  isBlocked,
  mergeRosterStudents,
  naturalAction,
  placeStudent,
  previewRosterMerge,
  previewStudentImport,
  setFormalPhoto,
  uploadImage,
} from '../../../services/admin/studentRosterService';
import { normaliseDoubtImage } from '../../../utils/doubtImage';
import { pickFile, pickImage, takePhoto } from '../../../utils/filePicker';
import { makeStyles } from '../../../utils/makeStyles';
import StudentSearchBar from '../shared/StudentSearchBar';
import { useStudentSearch } from '../../../utils/studentSearch';

/**
 * Manage Students — a school's own roster, per academic year and section, and the spreadsheet
 * import that fills it. Mirrors frontendmain/src/School/Admin/pages/ManageStudents.js.
 *
 * ── THE IMPORT NEVER WRITES UNTIL THE SECOND STEP ───────────────────────────
 * Step 1 uploads the file to `preview`, which parses and reports and saves NOTHING. Step 2 shows one
 * card per row with the action it would take, each switchable off. Only `commit` writes, and only
 * the rows still switched on. That separation is the whole safety of the feature: a spreadsheet with
 * a wrong column can be read, inspected and abandoned with no trace.
 *
 * Rows the server cannot act on are shown as blocked rather than hidden. A silently dropped row is a
 * child who does not arrive and whom nobody goes looking for.
 */

export default function ManageStudentsScreen({ homeRoute, apiBase }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const { toast, showToast } = useToast();

  const [years, setYears] = useState([]);
  const [yearId, setYearId] = useState(null);
  const [classId, setClassId] = useState(null);
  const [sectionId, setSectionId] = useState(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [step, setStep] = useState(1); // 1 choose file · 2 review · 3 done
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [rowActions, setRowActions] = useState({}); // rowNumber -> action | 'SKIP'
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState('');

  // Students on no roster, the same child twice, and the placement being edited.
  const [unplaced, setUnplaced] = useState([]);
  const [duplicates, setDuplicates] = useState([]);
  const [mergePair, setMergePair] = useState(null);
  const [mergePlan, setMergePlan] = useState(null);
  const [placing, setPlacing] = useState(null); // { student, sectionId, rollNumber }

  // ── the year / class / section chain ──────────────────────────────────────
  useEffect(() => {
    let active = true;
    fetchAcademicYears()
      .then((list) => {
        if (!active) return;
        setYears(list || []);
        setYearId((prev) => prev ?? defaultAcademicYear(list || [])?.id ?? null);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const classLoader = useCallback(
    (signal) => fetchSchoolClasses(apiBase, yearId, signal),
    [apiBase, yearId],
  );
  const { data: classes, loading: loadingClasses, error: classError, reload: reloadClasses } =
    useStaffResource(classLoader);

  const classList = useMemo(() => classes || [], [classes]);
  const selectedClass = useMemo(
    () => classList.find((c) => c.id === classId) || null,
    [classList, classId],
  );
  const sections = selectedClass?.sections || [];

  // A class or year change must not leave a section id from the previous tree selected — it would
  // load somebody else's roster under this class's name.
  useEffect(() => { setClassId(null); setSectionId(null); }, [yearId]);
  useEffect(() => { setSectionId(null); }, [classId]);

  const rosterLoader = useCallback(
    (signal) => (sectionId ? fetchRoster(sectionId, signal) : Promise.resolve([])),
    [sectionId],
  );
  const { data: roster, loading: loadingRoster, refreshing, error: rosterError, reload, refresh, revalidate } =
    useStaffResource(rosterLoader);

  const students = useMemo(() => (Array.isArray(roster) ? roster : roster?.students || []), [roster]);
  const studentSearch = useStudentSearch(students);

  // ── students in no section ────────────────────────────────────────────────
  // Quietly: a school with nothing stranded sees nothing, and a failure must not take the roster down.
  const loadUnplaced = useCallback(async () => {
    if (!yearId) {
      setUnplaced([]);
      return;
    }
    try {
      setUnplaced(await fetchUnplaced(yearId));
    } catch {
      setUnplaced([]);
    }
  }, [yearId]);
  useEffect(() => {
    loadUnplaced();
  }, [loadUnplaced]);

  const loadDuplicates = useCallback(async () => {
    if (!sectionId) {
      setDuplicates([]);
      return;
    }
    try {
      setDuplicates(await fetchRosterDuplicates(sectionId));
    } catch {
      setDuplicates([]);
    }
  }, [sectionId]);
  useEffect(() => {
    loadDuplicates();
  }, [loadDuplicates]);

  // Every section of the year, flattened, so a placement can go anywhere — not only under the class
  // picked above.
  const allSections = useMemo(
    () =>
      classList.flatMap((cls) =>
        (cls.sections || []).map((sec) => ({ value: sec.id, label: `Class ${cls.className} - ${sec.sectionName}` })),
      ),
    [classList],
  );

  const openPlacement = (student, presetSectionId) =>
    setPlacing({
      student,
      sectionId: presetSectionId ?? null,
      rollNumber: student.rollNumber || '',
    });

  const savePlacement = () =>
    run('place', async () => {
      if (!placing?.sectionId) return;
      await placeStudent({
        studentId: placing.student.studentId,
        sectionId: placing.sectionId,
        rollNumber: placing.rollNumber,
      });
      showToast(`${placing.student.studentName} placed.`, 'success');
      setPlacing(null);
      // Both lists shift: the student leaves "not in any section" and joins a roster.
      await Promise.all([revalidate(), loadUnplaced()]);
    });

  const changePhoto = (student) => {
    const attach = (source) =>
      run(`photo-${student.studentId}`, async () => {
        const picked = source === 'camera' ? await takePhoto() : await pickImage();
        if (!picked) return;
        if (picked.denied) {
          showToast('Allow camera or photo access to set the photograph.', 'error');
          return;
        }
        const file = await normaliseDoubtImage(picked.uri);
        const url = await uploadImage({ ...file, name: 'formal-photo.jpg' });
        await setFormalPhoto(student.studentId, url);
        showToast('Photo saved.', 'success');
        await revalidate();
      });
    const options = [
      { text: 'Take photo', onPress: () => attach('camera') },
      { text: 'Choose photo', onPress: () => attach('library') },
    ];
    if (student.formalPhotoUrl) {
      options.push({
        text: 'Remove photo',
        style: 'destructive',
        onPress: () =>
          run(`photo-${student.studentId}`, async () => {
            await setFormalPhoto(student.studentId, '');
            showToast('Photo removed.', 'success');
            await revalidate();
          }),
      });
    }
    if (Platform.OS === 'ios') options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(`${student.studentName}'s formal photo`, 'Used on report cards — the student’s own picture stays theirs.', options, {
      cancelable: true,
    });
  };

  const openMerge = async (pair) => {
    setMergePair(pair);
    setMergePlan(null);
    try {
      setMergePlan(await previewRosterMerge(pair.schoolRecord.studentId, pair.selfRegistered.studentId));
    } catch (e) {
      showToast(e?.message || 'Could not check that pair.', 'error');
      setMergePair(null);
    }
  };

  const confirmMerge = () =>
    run('merge', async () => {
      await mergeRosterStudents(mergePair.schoolRecord.studentId, mergePair.selfRegistered.studentId);
      showToast(`${mergePair.schoolRecord.fullName} is now one record. They sign in with the account they already had.`, 'success');
      setMergePair(null);
      setMergePlan(null);
      await Promise.all([revalidate(), loadDuplicates()]);
    });

  const run = async (key, action) => {
    if (busy) return;
    setBusy(key);
    try {
      await action();
    } catch (e) {
      showToast(e?.message || 'Something went wrong. Please try again.', 'error');
    } finally {
      setBusy('');
    }
  };

  // ── import ────────────────────────────────────────────────────────────────
  const openImport = () => {
    setStep(1);
    setFile(null);
    setPreview(null);
    setRowActions({});
    setResult(null);
    setSheetOpen(true);
  };

  const closeImport = () => {
    if (busy) return; // never abandon a commit mid-flight
    setSheetOpen(false);
  };

  const choose = () =>
    run('file', async () => {
      const picked = await pickFile(IMPORT_FILE_TYPES);
      if (!picked) return;
      if (!/\.(xlsx|xls|csv)$/i.test(picked.name || '')) {
        showToast('Choose an Excel (.xlsx) or .csv file.', 'error');
        return;
      }
      setFile(picked);
    });

  const parse = () =>
    run('parse', async () => {
      if (!file || !yearId) return;
      const res = await previewStudentImport(yearId, file);
      const actions = {};
      (res?.rows || []).forEach((r) => { actions[r.rowNumber] = r.action || naturalAction(r); });
      setPreview(res);
      setRowActions(actions);
      setStep(2);
    });

  const toggleRow = (row) => {
    const natural = naturalAction(row);
    if (natural === 'SKIP') return; // blocked rows have nothing to switch on
    setRowActions((prev) => ({
      ...prev,
      [row.rowNumber]: (prev[row.rowNumber] || 'SKIP') === 'SKIP' ? natural : 'SKIP',
    }));
  };

  const included = (preview?.rows || []).filter((r) => (rowActions[r.rowNumber] || 'SKIP') !== 'SKIP');

  const commit = () =>
    run('commit', async () => {
      if (!preview || included.length === 0) return;
      const rows = preview.rows.map((r) => ({ ...r, action: rowActions[r.rowNumber] || 'SKIP' }));
      const res = await commitStudentImport(yearId, rows);
      setResult(res);
      setStep(3);
      await revalidate();
    });

  const template = (format = null) =>
    run(format ? 'exportTemplate' : 'template', async () => {
      await downloadImportTemplate(format);
      showToast('Template saved.', 'success');
    });

  const yearOptions = years.map((y) => ({ value: y.id, label: y.yearLabel || String(y.id) }));
  const classOptions = classList.map((c) => ({ value: c.id, label: c.className }));
  const sectionOptions = sections.map((s) => ({ value: s.id, label: s.sectionName }));

  return (
    <ScreenScaffold
      title="Manage Students"
      fallbackRoute={homeRoute}
      loading={loadingClasses && !classList.length}
      error={classError || (sectionId ? rosterError : null)}
      onRetry={sectionId ? reload : reloadClasses}
      refreshing={refreshing}
      onRefresh={refresh}
      toast={toast}
    >
      <Card>
        <CardTitle>Choose a section</CardTitle>
        <Select
          label="Academic year"
          value={yearId}
          options={yearOptions}
          onChange={setYearId}
          placeholder="Choose…"
        />
        <Select
          label="Class"
          value={classId}
          options={classOptions}
          onChange={setClassId}
          placeholder={classList.length ? 'Choose…' : 'No classes in this year'}
          disabled={!classList.length}
        />
        <Select
          label="Section"
          value={sectionId}
          options={sectionOptions}
          onChange={setSectionId}
          placeholder={selectedClass ? 'Choose…' : 'Pick a class first'}
          disabled={!selectedClass}
        />

        <View style={styles.actionRow}>
          <Pressable
            onPress={openImport}
            disabled={!!busy || !yearId}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Ionicons name="cloud-upload-outline" size={19} color="#ffffff" />
            <Text style={styles.primaryText}>Import students</Text>
          </Pressable>
          <Pressable
            onPress={() => template(null)}
            disabled={!!busy}
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Ionicons name="download-outline" size={19} color={PALETTE.primaryDark} />
            <Text style={[styles.secondaryText, { color: PALETTE.primaryDark }]}>
              {busy === 'template' ? 'Saving…' : 'Blank template'}
            </Text>
          </Pressable>
          {/* The shape a school's existing student system already exports — bring what you have
              instead of retyping it into ours. */}
          <Pressable
            onPress={() => template(ROSTER_EXPORT_FORMAT)}
            disabled={!!busy}
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Ionicons name="document-text-outline" size={19} color={PALETTE.primaryDark} />
            <Text style={[styles.secondaryText, { color: PALETTE.primaryDark }]}>
              {busy === 'exportTemplate' ? 'Saving…' : 'School-export template'}
            </Text>
          </Pressable>
        </View>
      </Card>

      {unplaced.length > 0 ? (
        <Card>
          <CardTitle>
            {unplaced.length} student{unplaced.length === 1 ? '' : 's'} not in any section
          </CardTitle>
          {unplaced.map((u) => (
            <View key={u.studentId} style={styles.studentRow}>
              <View style={styles.studentMain}>
                <Text style={styles.studentName} numberOfLines={1}>{u.studentName || '—'}</Text>
                <Text style={styles.studentMeta} numberOfLines={2}>
                  {u.reason || [u.currentClass, u.email].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Pressable
                onPress={() => openPlacement(u, null)}
                disabled={!!busy}
                style={({ pressed }) => [styles.smallBtn, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Text style={[styles.smallText, { color: PALETTE.primaryDark }]}>Place</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      ) : null}

      {sectionId ? <DuplicateStudentsCard duplicates={duplicates} onReview={openMerge} /> : null}

      {!sectionId ? (
        <EmptyState
          icon="people-outline"
          title="Pick a section"
          message="Choose an academic year, class and section to see who is on the roster."
        />
      ) : loadingRoster ? null : students.length === 0 ? (
        <EmptyState
          icon="person-add-outline"
          title="Nobody here yet"
          message="This section has no students. Import a spreadsheet to add them."
        />
      ) : (
        <Card>
          <View style={styles.headRow}>
            <CardTitle>{students.length} student{students.length === 1 ? '' : 's'}</CardTitle>
          </View>
          <StudentSearchBar search={studentSearch} />
          {studentSearch.results.map((s) => (
            // The roster row is SectionRosterRow: studentId and studentName. It used to be read as
            // `id` and `fullName`, which the server does not send — every name showed as "—".
            <View key={s.studentId ?? s.enrollmentId ?? `${s.studentName}-${s.email}`} style={styles.studentRow}>
              {s.formalPhotoUrl ? (
                <Image source={{ uri: s.formalPhotoUrl }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.photoEmpty]}>
                  <Ionicons name="person-outline" size={18} color={SLATE[400]} />
                </View>
              )}
              <View style={styles.studentMain}>
                <Text style={styles.studentName} numberOfLines={1}>{s.studentName || s.fullName || '—'}</Text>
                <Text style={styles.studentMeta} numberOfLines={1}>
                  {[s.rollNumber ? `Roll ${s.rollNumber}` : null, s.admissionNumber ? `Adm. ${s.admissionNumber}` : null]
                    .filter(Boolean)
                    .join(' · ') || s.email || 'No email — school record only'}
                </Text>
                <View style={styles.rowActions}>
                  <Pressable onPress={() => openPlacement(s, sectionId)} disabled={!!busy} accessibilityRole="button">
                    <Text style={[styles.smallText, { color: PALETTE.primaryDark }]}>Place / Edit</Text>
                  </Pressable>
                  <Pressable onPress={() => changePhoto(s)} disabled={!!busy} accessibilityRole="button">
                    <Text style={[styles.smallText, { color: PALETTE.primaryDark }]}>
                      {busy === `photo-${s.studentId}` ? 'Saving…' : 'Photo'}
                    </Text>
                  </Pressable>
                </View>
              </View>
              {s.origin ? (
                <StatusChip
                  label={ORIGIN_LABEL[s.origin] || s.origin}
                  tone={s.origin === 'SELF_SIGNUP' ? 'success' : 'neutral'}
                />
              ) : null}
            </View>
          ))}
        </Card>
      )}

      <FormSheet
        visible={sheetOpen}
        title={step === 1 ? 'Import students' : step === 2 ? 'Review before importing' : 'Imported'}
        onClose={closeImport}
        onSubmit={step === 1 ? parse : step === 2 ? commit : closeImport}
        submitLabel={
          step === 1 ? (busy === 'parse' ? 'Reading…' : 'Read the file')
            : step === 2 ? (busy === 'commit' ? 'Importing…' : `Import ${included.length}`)
              : 'Done'
        }
        submitDisabled={(step === 1 && !file) || (step === 2 && included.length === 0) || !!busy}
      >
        {step === 1 ? (
          <>
            <Text style={styles.body}>
              An Excel (.xlsx) or .csv file. Nothing is saved until you have seen what it contains —
              the next step only reads it.
            </Text>
            <Pressable
              onPress={choose}
              disabled={!!busy}
              style={({ pressed }) => [styles.filePick, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Ionicons name="document-attach-outline" size={22} color={PALETTE.primaryDark} />
              <Text style={[styles.secondaryText, { color: PALETTE.primaryDark }]} numberOfLines={1}>
                {file ? file.name : 'Choose a file'}
              </Text>
            </Pressable>
          </>
        ) : step === 2 ? (
          <>
            <Text style={styles.body}>
              {included.length} of {(preview?.rows || []).length} rows will be imported. Tap a row to
              leave it out.
            </Text>
            {(preview?.rows || []).map((row) => {
              const blocked = isBlocked(row);
              const on = (rowActions[row.rowNumber] || 'SKIP') !== 'SKIP';
              const meta = STATUS_TEXT[row.status];
              return (
                <Pressable
                  key={row.rowNumber}
                  onPress={() => toggleRow(row)}
                  disabled={blocked || !!busy}
                  style={({ pressed }) => [
                    styles.reviewRow,
                    on && styles.reviewRowOn,
                    blocked && styles.reviewRowBlocked,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: blocked }}
                  accessibilityLabel={`Row ${row.rowNumber}, ${row.fullName || 'no name'}`}
                >
                  <Ionicons
                    name={blocked ? 'alert-circle-outline' : on ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={blocked ? '#b45309' : on ? PALETTE.primaryDark : SLATE[500]}
                  />
                  <View style={styles.reviewMain}>
                    <Text style={styles.studentName} numberOfLines={1}>
                      {row.fullName || `Row ${row.rowNumber}`}
                    </Text>
                    <Text style={styles.studentMeta} numberOfLines={2}>
                      {blocked
                        ? row.message || 'This row cannot be imported.'
                        : meta?.note || row.status}
                    </Text>
                  </View>
                  {meta ? <StatusChip label={meta.label} tone={meta.tone} /> : null}
                </Pressable>
              );
            })}
          </>
        ) : (
          <>
            <Text style={styles.body}>
              {(result?.created ?? 0)} new account{(result?.created ?? 0) === 1 ? '' : 's'},{' '}
              {(result?.recordsCreated ?? 0)} school record
              {(result?.recordsCreated ?? 0) === 1 ? '' : 's'}, {(result?.upgraded ?? 0)} upgraded,{' '}
              {(result?.linked ?? 0)} linked.
            </Text>
            <Text style={styles.body}>
              Pick the class and section above to see them on the roster.
            </Text>
          </>
        )}
      </FormSheet>

      <FormSheet
        visible={!!placing}
        title={placing ? `Place ${placing.student.studentName}` : 'Place'}
        subtitle="A section and a roll number"
        onClose={() => setPlacing(null)}
        onSubmit={savePlacement}
        submitting={busy === 'place'}
        submitDisabled={!placing?.sectionId}
        submitLabel="Save"
      >
        <Select
          label="Section"
          value={placing?.sectionId ?? null}
          options={allSections}
          onChange={(value) => setPlacing((prev) => ({ ...prev, sectionId: value }))}
          placeholder={allSections.length ? 'Choose…' : 'No sections in this year'}
          searchable={allSections.length > 12}
        />
        <TextField
          label="Roll number"
          value={placing?.rollNumber ?? ''}
          onChangeText={(value) => setPlacing((prev) => ({ ...prev, rollNumber: value }))}
          placeholder="Optional"
        />
      </FormSheet>

      <StudentMergeSheet
        pair={mergePair}
        plan={mergePlan}
        merging={busy === 'merge'}
        onConfirm={confirmMerge}
        onClose={() => {
          setMergePair(null);
          setMergePlan(null);
        }}
      />
    </ScreenScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  body: {
    fontSize: TYPE.body,
    color: SLATE[600],
    lineHeight: leading(TYPE.body),
    marginBottom: SPACING.sm,
  },

  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: p.primary,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  primaryText: { color: '#ffffff', fontSize: TYPE.body, fontWeight: '700' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: p.cardBorder,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  secondaryText: { fontSize: TYPE.body, fontWeight: '700' },
  pressed: { opacity: 0.85 },

  filePick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: p.cardBorder,
    borderRadius: 12,
    padding: SPACING.md,
  },

  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: SLATE[200],
  },
  studentMain: { flex: 1 },
  photo: { width: 40, height: 40, borderRadius: 20, backgroundColor: SLATE[100] },
  photoEmpty: { alignItems: 'center', justifyContent: 'center' },
  rowActions: { flexDirection: 'row', gap: SPACING.md, marginTop: 4 },
  smallBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: p.primary,
  },
  smallText: { fontSize: TYPE.label, fontWeight: '700' },
  studentName: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },
  studentMeta: { fontSize: TYPE.label, color: SLATE[500], lineHeight: leading(TYPE.label) },

  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 12,
    marginBottom: 8,
  },
  reviewRowOn: { borderColor: p.primary },
  // Amber rather than red: a blocked row is information about the spreadsheet, not a failure the
  // person just caused, and the import still proceeds without it.
  reviewRowBlocked: { borderColor: '#fcd34d', backgroundColor: '#fffbeb' },
  reviewMain: { flex: 1 },
}));
