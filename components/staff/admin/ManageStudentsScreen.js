import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
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
  useToast,
} from '../../ui';
import useStaffResource from '../../../hooks/useStaffResource';
import { fetchSchoolClasses } from '../../../services/admin/classService';
import { defaultAcademicYear, fetchAcademicYears } from '../../../services/teacher/scopeService';
import {
  IMPORT_FILE_TYPES,
  ORIGIN_LABEL,
  STATUS_TEXT,
  commitStudentImport,
  downloadImportTemplate,
  fetchRoster,
  isBlocked,
  naturalAction,
  previewStudentImport,
} from '../../../services/admin/studentRosterService';
import { pickFile } from '../../../utils/filePicker';
import { makeStyles } from '../../../utils/makeStyles';

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

  const template = () =>
    run('template', async () => {
      await downloadImportTemplate();
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
            onPress={template}
            disabled={!!busy}
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Ionicons name="download-outline" size={19} color={PALETTE.primaryDark} />
            <Text style={[styles.secondaryText, { color: PALETTE.primaryDark }]}>
              {busy === 'template' ? 'Saving…' : 'Blank template'}
            </Text>
          </Pressable>
        </View>
      </Card>

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
          {students.map((s) => (
            <View key={s.id ?? `${s.fullName}-${s.email}`} style={styles.studentRow}>
              <View style={styles.studentMain}>
                <Text style={styles.studentName} numberOfLines={1}>{s.fullName || '—'}</Text>
                <Text style={styles.studentMeta} numberOfLines={1}>
                  {s.email || 'No email — school record only'}
                </Text>
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
