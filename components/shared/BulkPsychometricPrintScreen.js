import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TYPE } from '../../constants/theme';
import { EmptyState, ScreenScaffold, Select } from '../ui';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import {
  fetchPrintRoster,
  fetchPrintStudents,
  printStudentsReports,
} from '../../services/shared/psychometricReportService';

/**
 * Print psychometric reports — choose a class (and section), tick students, and get one PDF: the
 * framework cover once, then every report each chosen student has completed, exactly as each would
 * print it themselves. Handed to the share sheet, which prints, saves or sends it.
 *
 * Shared by the teacher, vice principal, both counsellors and the principal; `apiBase` is the
 * panel's own endpoint family (services/shared/psychometricReportService.js).
 */
export default function BulkPsychometricPrintScreen({ apiBase, homeRoute }) {
  const styles = useStyles();
  const palette = usePalette();

  const [roster, setRoster] = useState(null);
  const [rosterError, setRosterError] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [className, setClassName] = useState('');
  const [section, setSection] = useState('');
  const [students, setStudents] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const loadRoster = useCallback(
    (code) => {
      setRosterError('');
      setRoster(null);
      fetchPrintRoster(apiBase, code)
        .then((r) => {
          setRoster(r);
          setSchoolCode(r?.schoolCode || '');
        })
        .catch((e) => setRosterError(e?.message || 'Could not load the classes.'));
    },
    [apiBase],
  );

  useEffect(() => loadRoster(''), [loadRoster]);

  useEffect(() => {
    setSelected(new Set());
    if (!className) {
      setStudents(null);
      return undefined;
    }
    const controller = new AbortController();
    setStudents(null);
    fetchPrintStudents(apiBase, { className, section, schoolCode }, controller.signal)
      .then((list) => setStudents(Array.isArray(list) ? list : []))
      .catch((e) => {
        if (e?.name !== 'AbortError') setMessage({ tone: 'error', text: e?.message || 'Could not load the students.' });
      });
    return () => controller.abort();
  }, [apiBase, schoolCode, className, section]);

  const classes = roster?.classes || [];
  const sections = useMemo(
    () => classes.find((c) => c.className === className)?.sections || [],
    [classes, className],
  );
  const printable = (students || []).filter((s) => s.completedTopics > 0);
  const max = roster?.maxStudents || 40;
  const allChosen = printable.length > 0 && printable.every((s) => selected.has(s.studentId));

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const print = async () => {
    if (!selected.size) return;
    if (selected.size > max) {
      setMessage({ tone: 'error', text: `Print at most ${max} students at a time.` });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const { printed, skipped } = await printStudentsReports(apiBase, [...selected]);
      setMessage({
        tone: printed ? 'success' : 'error',
        text: printed
          ? `${printed} report${printed === 1 ? '' : 's'} ready.` +
            (skipped.length ? ` Skipped (not taken): ${skipped.join(', ')}.` : '')
          : 'None of these students has completed an assessment yet.',
      });
    } catch (e) {
      setMessage({ tone: 'error', text: e?.message || 'The reports could not be printed.' });
    } finally {
      setBusy(false);
    }
  };

  const schools = roster?.schools || [];

  return (
    <ScreenScaffold
      title="Print psychometric reports"
      fallbackRoute={homeRoute}
      loading={!roster && !rosterError}
      error={rosterError}
      onRetry={() => loadRoster(schoolCode)}
    >
      <Text style={styles.intro}>
        Choose students — each one's completed reports print together, in one PDF.
      </Text>

      <View style={styles.pickers}>
        {schools.length > 1 ? (
          <Select
            label="School"
            value={schoolCode}
            options={schools.map((s) => ({ value: s.schoolCode, label: s.schoolName }))}
            onChange={(code) => {
              setClassName('');
              setSection('');
              loadRoster(code);
            }}
            disabled={busy}
          />
        ) : null}
        <Select
          label="Class"
          placeholder="Choose a class"
          value={className}
          options={classes.map((c) => ({ value: c.className, label: `Class ${c.className}` }))}
          onChange={(v) => {
            setClassName(v);
            setSection('');
          }}
          disabled={busy}
        />
        <Select
          label="Section"
          placeholder="All sections"
          value={section}
          options={[{ value: '', label: 'All sections' }, ...sections.map((s) => ({ value: s, label: s }))]}
          onChange={setSection}
          disabled={busy || !className}
        />
      </View>

      {message ? (
        <Text
          style={[styles.message, { color: message.tone === 'success' ? FEEDBACK.success : FEEDBACK.error }]}
          accessibilityLiveRegion="polite"
        >
          {message.text}
        </Text>
      ) : null}

      {!className ? (
        <EmptyState icon="people-outline" title="Choose a class" message="Its students appear here to tick." />
      ) : students === null ? (
        <ActivityIndicator size="large" color={palette.primary} style={styles.loader} />
      ) : students.length === 0 ? (
        <EmptyState icon="people-outline" title="No students" message="Nobody is in this class yet." />
      ) : (
        <>
          <Pressable
            style={styles.row}
            onPress={() =>
              setSelected(allChosen ? new Set() : new Set(printable.slice(0, max).map((s) => s.studentId)))
            }
            disabled={busy || printable.length === 0}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: allChosen, disabled: busy || printable.length === 0 }}
          >
            <Ionicons name={allChosen ? 'checkbox' : 'square-outline'} size={22} color={palette.primary} />
            <Text style={styles.allLabel}>Select all with reports ({printable.length})</Text>
            <Text style={styles.muted}>{selected.size} chosen</Text>
          </Pressable>

          {students.map((s) => {
            const has = s.completedTopics > 0;
            const checked = selected.has(s.studentId);
            return (
              <Pressable
                key={s.studentId}
                style={[styles.row, !has && styles.rowOff]}
                onPress={() => toggle(s.studentId)}
                disabled={busy || !has}
                accessibilityRole="checkbox"
                accessibilityState={{ checked, disabled: busy || !has }}
                accessibilityLabel={`${s.name}, ${has ? `${s.completedTopics} reports` : 'not taken'}`}
              >
                <Ionicons
                  name={checked ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={has ? palette.primary : SLATE[300]}
                />
                <Text style={styles.name} numberOfLines={1}>
                  {s.name}
                </Text>
                <Text style={[styles.count, !has && styles.countOff]}>
                  {has ? `${s.completedTopics} report${s.completedTopics === 1 ? '' : 's'}` : 'Not taken'}
                </Text>
              </Pressable>
            );
          })}
        </>
      )}

      <Pressable
        style={[styles.printBtn, { backgroundColor: palette.primary }, (!selected.size || busy) && styles.printOff]}
        onPress={print}
        disabled={!selected.size || busy}
        accessibilityRole="button"
      >
        {busy ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <>
            <Ionicons name="print-outline" size={20} color="#ffffff" />
            <Text style={styles.printText}>
              {selected.size ? `Print ${selected.size} report set${selected.size === 1 ? '' : 's'}` : 'Choose students'}
            </Text>
          </>
        )}
      </Pressable>
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  intro: { fontSize: TYPE.label, color: SLATE[600], marginBottom: SPACING.md },
  pickers: { gap: SPACING.sm, marginBottom: SPACING.md },
  message: { fontSize: TYPE.label, marginBottom: SPACING.md },
  loader: { marginTop: SPACING.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: SLATE[100],
  },
  rowOff: { opacity: 0.6 },
  allLabel: { flex: 1, fontSize: TYPE.label, fontWeight: '700', color: SLATE[800] },
  muted: { fontSize: TYPE.caption, color: SLATE[500] },
  name: { flex: 1, fontSize: TYPE.body, color: SLATE[800] },
  count: {
    fontSize: TYPE.caption,
    fontWeight: '700',
    color: '#166534',
    backgroundColor: '#dcfce7',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  countOff: { color: SLATE[500], backgroundColor: SLATE[100] },
  printBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderRadius: 12,
    minHeight: 50,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  printOff: { opacity: 0.5 },
  printText: { color: '#ffffff', fontSize: TYPE.body, fontWeight: '700' },
}));

/**
 * The entry point each host screen shows: a full-width button that opens the screen above.
 * `route` is the role's own print route (/teacher/psychometric-print, /staff/<role>/psychometric-print).
 */
export function PsychometricPrintLink({ route, onPress, label = 'Print psychometric reports' }) {
  const styles = useLinkStyles();
  const palette = usePalette();
  return (
    <Pressable
      style={[styles.link, { borderColor: palette.primary }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint={route ? 'Opens the print screen' : undefined}
    >
      <Ionicons name="print-outline" size={18} color={palette.primary} />
      <Text style={[styles.linkText, { color: palette.primary }]}>{label}</Text>
    </Pressable>
  );
}

const useLinkStyles = makeStyles(() => ({
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  linkText: { fontSize: TYPE.label, fontWeight: '700' },
}));
