import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING } from '../../constants/theme';
import { usePalette } from '../../components/ui/PaletteContext';
import {
  Card,
  CardTitle,
  DateTimeField,
  EMPTY_SCHOOL_SCOPE,
  EmptyState,
  FormSheet,
  MonthNavigator,
  SchoolClassPicker,
  ScreenScaffold,
  Select,
  StatusChip,
  TextField,
  useToast,
} from '../ui';
import useStaffResource from '../../hooks/useStaffResource';
import {
  TEACHER_COUNSELLING_BASE,
  fetchCounsellingClasses,
  fetchCounsellingStudents,
  fetchSessionsForDate,
  saveCounsellingSession,
} from '../../services/teacher/counsellingService';
import {
  COMMON_FIELDS,
  counsellingTypesForRole,
  emptyCommon,
  emptyFormFor,
  typeLabel,
} from '../../constants/counsellingConfig';
import { formatLongDate, isSunday } from '../../utils/dates';
import { makeStyles } from '../../utils/makeStyles';

/**
 * Native Counselling Needs and Notes.
 *
 * The web is a student × 31-date grid with two sticky columns and 42px cells — the one layout that
 * genuinely cannot be squeezed onto a phone. Inverted here: class → section → month → a **student
 * list**, then a student's month as a list of days, then the session sheet.
 *
 * A teacher gets two counselling types (Academic, Parent), enforced server-side.
 */


function ScoreRow({ value, onChange, disabled }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const { min, max } = COMMON_FIELDS.improvementScore;
  const options = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <View style={styles.scoreRow}>
      {options.map((n) => {
        const active = Number(value) === n;
        return (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            disabled={disabled}
            style={({ pressed }) => [
              styles.scoreBtn,
              active && { backgroundColor: PALETTE.primaryDark, borderColor: PALETTE.primaryDark },
              pressed && styles.pressed,
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Score ${n}`}
          >
            <Text style={[styles.scoreText, active && styles.scoreTextActive]}>{n}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function CounsellingNotesScreen({
  homeRoute = '/teacher',
  // A teacher sees two counselling types; a counsellor sees all eight. Both the client filter and
  // the server's ALLOWED_TYPES enforce it, so passing the wrong role here is visible immediately.
  role = 'teacher',
  apiBase = TEACHER_COUNSELLING_BASE,
  // 'schoolClass' switches the picker and the roster params for the Shreyartha counsellor. The
  // session read and write are identical across portals, so nothing else changes.
  scopeKind = 'classSection',
  schoolsEndpoint,
}) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const TYPES = useMemo(() => counsellingTypesForRole(role), [role]);

  const now = new Date();
  const schoolScoped = scopeKind === 'schoolClass';
  const [klass, setKlass] = useState(null);
  const [section, setSection] = useState(null);
  // Portal B's scope: School → Class, no academic year and no section tier.
  const [schoolScope, setSchoolScope] = useState(EMPTY_SCHOOL_SCOPE);
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [student, setStudent] = useState(null);

  const [sheetDate, setSheetDate] = useState(null);
  const [existing, setExisting] = useState([]);
  const [existingLoading, setExistingLoading] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [form, setForm] = useState({});
  const [common, setCommon] = useState(emptyCommon);
  const [saving, setSaving] = useState(false);

  const { toast, showToast } = useToast();

  const classesFetcher = useCallback(
    (signal) => fetchCounsellingClasses(undefined, signal, apiBase),
    [apiBase],
  );
  const { data: classes, loading: classesLoading, error: classesError, reload } =
    // Portal B has no /counselling/classes endpoint at all — SchoolClassPicker fetches its own
    // scope. Firing this would 404 and strand the screen on an error state.
    useStaffResource(classesFetcher, { enabled: !schoolScoped, initialData: [] });

  const classList = classes || [];
  const sectionList = klass?.sections || [];

  // One scope object for both portals, so everything below this line is shared.
  const scope = schoolScoped
    ? schoolScope
    : { className: klass?.className || '', sectionName: section?.sectionName || '' };
  const scopeReady = schoolScoped ? !!schoolScope.classId : !!(klass && section);
  const scopeKey = `${scope.className}|${scope.sectionName}|${scope.classId}`;

  const rosterFetcher = useCallback(
    (signal) =>
      fetchCounsellingStudents(
        { scope, year: period.year, month: period.month, apiBase, scopeKind },
        signal,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scopeKey, period.year, period.month, apiBase, scopeKind],
  );
  const {
    data: roster,
    loading: rosterLoading,
    refreshing,
    refresh,
    revalidate: revalidateRoster,
  } = useStaffResource(rosterFetcher, {
    enabled: scopeReady,
    initialData: { students: [], sessions: {} },
  });

  const students = roster?.students || [];
  const sessions = roster?.sessions || {};

  const dates = useMemo(() => {
    const days = new Date(period.year, period.month, 0).getDate();
    const pad = (n) => String(n).padStart(2, '0');
    return Array.from(
      { length: days },
      (_, i) => `${period.year}-${pad(period.month)}-${pad(i + 1)}`,
    );
  }, [period]);

  const sessionCount = useCallback(
    (studentId, date) => {
      const entry = sessions[`${studentId}_${date}`];
      return Array.isArray(entry) ? entry.length : entry ? 1 : 0;
    },
    [sessions],
  );

  const totalFor = useCallback(
    (studentId) => dates.reduce((sum, date) => sum + sessionCount(studentId, date), 0),
    [dates, sessionCount],
  );

  const openDay = async (date) => {
    if (isSunday(date)) return;
    setSheetDate(date);
    setSelectedType(null);
    setForm({});
    setCommon(emptyCommon());
    setExistingLoading(true);
    try {
      setExisting(await fetchSessionsForDate({ studentId: student.studentId, date, apiBase }));
    } catch {
      setExisting([]);
    } finally {
      setExistingLoading(false);
    }
  };

  const pickType = (type) => {
    setSelectedType(type);
    setForm(emptyFormFor(type));
    setCommon(emptyCommon());
  };

  const toggleMulti = (key, option) =>
    setForm((prev) => {
      const list = Array.isArray(prev[key]) ? prev[key] : [];
      return {
        ...prev,
        [key]: list.includes(option) ? list.filter((v) => v !== option) : [...list, option],
      };
    });

  const submit = async () => {
    if (!selectedType) return;
    setSaving(true);
    try {
      await saveCounsellingSession({
        studentId: student.studentId,
        date: sheetDate,
        counsellingType: selectedType.key,
        // Sent explicitly; the web omits both and lets the server guess from the student record.
        className: scope.className,
        sectionName: scope.sectionName || '',
        common: {
          ...common,
          followUpDate: common.followUpDate ? common.followUpDate.slice(0, 10) : null,
        },
        // Nested, not spread — see saveCounsellingSession for why the web loses these answers.
        formData: form,
        apiBase,
      });
      showToast('Session saved.', 'success');
      setSheetDate(null);
      await revalidateRoster();
    } catch (e) {
      // The duplicate guard is (student, date, type, author); its message is worth showing.
      showToast(e?.message || 'Could not save the session.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const renderStudentMonth = () => (
    <>
      <Pressable
        onPress={() => setStudent(null)}
        style={({ pressed }) => [styles.backRow, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Ionicons name="chevron-back" size={15} color={PALETTE.primaryDark} />
        <Text style={styles.backText}>All students</Text>
      </Pressable>

      <Card>
        <CardTitle>{student.studentName}</CardTitle>
        {dates.map((date) => {
          const count = sessionCount(student.studentId, date);
          const sunday = isSunday(date);
          return (
            <Pressable
              key={date}
              onPress={() => openDay(date)}
              disabled={sunday}
              style={({ pressed }) => [
                styles.dayRow,
                sunday && styles.dayRowMuted,
                pressed && !sunday && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${formatLongDate(date)}, ${count} session(s)`}
            >
              <Text style={[styles.dayLabel, sunday && styles.dayLabelMuted]}>
                {formatLongDate(date)}
              </Text>
              {sunday ? (
                <Text style={styles.dayNote}>Sunday</Text>
              ) : count > 0 ? (
                <StatusChip label={`${count} session${count === 1 ? '' : 's'}`} tone="info" />
              ) : (
                <Ionicons name="add-circle-outline" size={18} color={SLATE[400]} />
              )}
            </Pressable>
          );
        })}
      </Card>
    </>
  );

  return (
    <ScreenScaffold
      title="Counselling Notes"
      fallbackRoute={homeRoute}
      loading={classesLoading}
      error={classList.length === 0 ? classesError : ''}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={scopeReady ? refresh : undefined}
      toast={toast}
    >
      {!schoolScoped && classList.length === 0 ? (
        <EmptyState
          icon="school-outline"
          title="No classes assigned"
          message="Once classes are assigned to you, their students appear here."
        />
      ) : (
        <>
          {schoolScoped ? (
            <SchoolClassPicker
              endpoint={schoolsEndpoint}
              value={schoolScope}
              onChange={(next) => {
                setSchoolScope(next);
                setStudent(null);
              }}
              style={styles.schoolPicker}
            />
          ) : (
            <View style={styles.pickers}>
              <Select
                variant="chip"
                label="Class"
                placeholder="Class"
                value={klass?.classId}
                options={classList.map((c) => ({ value: c.classId, label: `Class ${c.className}` }))}
                onChange={(id) => {
                  setKlass(classList.find((c) => c.classId === id) || null);
                  setSection(null);
                  setStudent(null);
                }}
              />
              <Select
                variant="chip"
                label="Section"
                placeholder="Section"
                value={section?.sectionId}
                options={sectionList.map((s) => ({
                  value: s.sectionId,
                  label: `Section ${s.sectionName}`,
                }))}
                onChange={(id) => {
                  setSection(sectionList.find((s) => s.sectionId === id) || null);
                  setStudent(null);
                }}
                disabled={!klass}
              />
            </View>
          )}

          {scopeReady ? (
            <MonthNavigator
              year={period.year}
              month={period.month}
              onChange={(next) => {
                setPeriod(next);
                setStudent(null);
              }}
              style={styles.month}
            />
          ) : null}

          {!scopeReady ? (
            <EmptyState
              icon="people-outline"
              title={schoolScoped ? 'Choose a class' : 'Choose a section'}
              message={
                schoolScoped
                  ? 'Pick a school and class to see its students.'
                  : 'Pick a class and section to see its students.'
              }
            />
          ) : rosterLoading ? (
            <ActivityIndicator size="large" color={PALETTE.primary} style={styles.loader} />
          ) : students.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title="No students"
              message={
                schoolScoped
                  ? 'This class has no students registered.'
                  : 'This section has no students registered.'
              }
            />
          ) : student ? (
            renderStudentMonth()
          ) : (
            students.map((s) => {
              const total = totalFor(s.studentId);
              return (
                <Pressable
                  key={s.studentId}
                  onPress={() => setStudent(s)}
                  style={({ pressed }) => [styles.studentRow, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <Text style={styles.studentName} numberOfLines={1}>
                    {s.studentName}
                  </Text>
                  {total > 0 ? (
                    <StatusChip label={`${total} this month`} tone="info" />
                  ) : (
                    <Text style={styles.studentNone}>No sessions</Text>
                  )}
                  <Ionicons name="chevron-forward" size={16} color={SLATE[400]} />
                </Pressable>
              );
            })
          )}
        </>
      )}

      <FormSheet
        visible={!!sheetDate}
        title={sheetDate ? formatLongDate(sheetDate) : 'Session'}
        subtitle={student?.studentName}
        onClose={() => setSheetDate(null)}
        onSubmit={selectedType ? submit : undefined}
        submitting={saving}
        submitLabel="Save session"
        fullHeight
      >
        {existingLoading ? (
          <ActivityIndicator size="small" color={PALETTE.primary} style={styles.loader} />
        ) : existing.length > 0 ? (
          <View style={styles.existing}>
            <Text style={styles.existingTitle}>Already recorded today</Text>
            {existing.map((s) => (
              <View key={s.id} style={styles.existingRow}>
                <Text style={styles.existingType}>{typeLabel(s.counsellingType)}</Text>
                <Text style={styles.existingStatus}>{s.caseStatus || '—'}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {!selectedType ? (
          <>
            <Text style={styles.pickPrompt}>What kind of session was this?</Text>
            {TYPES.map((type) => (
              <Pressable
                key={type.key}
                onPress={() => pickType(type)}
                style={({ pressed }) => [styles.typeBtn, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Text style={styles.typeText}>{type.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={SLATE[400]} />
              </Pressable>
            ))}
          </>
        ) : (
          <>
            <Pressable
              onPress={() => setSelectedType(null)}
              style={({ pressed }) => [styles.backRow, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Ionicons name="chevron-back" size={15} color={PALETTE.primaryDark} />
              <Text style={styles.backText}>{selectedType.label}</Text>
            </Pressable>

            {selectedType.fields.map((field) =>
              field.type === 'select' ? (
                <Select
                  key={field.key}
                  label={field.label}
                  value={form[field.key]}
                  options={[
                    { value: '', label: 'Not set' },
                    ...field.options.map((o) => ({ value: o, label: o })),
                  ]}
                  onChange={(value) => setForm((f) => ({ ...f, [field.key]: value }))}
                />
              ) : (
                <View key={field.key} style={styles.multiBlock}>
                  <Text style={styles.multiLabel}>{field.label}</Text>
                  <View style={styles.multiWrap}>
                    {field.options.map((option) => {
                      const on = (form[field.key] || []).includes(option);
                      return (
                        <Pressable
                          key={option}
                          onPress={() => toggleMulti(field.key, option)}
                          style={({ pressed }) => [
                            styles.multiChip,
                            on && { backgroundColor: PALETTE.tint, borderColor: PALETTE.primary },
                            pressed && styles.pressed,
                          ]}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: on }}
                        >
                          <Text style={[styles.multiChipText, on && { color: PALETTE.primaryDark }]}>
                            {option}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ),
            )}

            <Select
              label={COMMON_FIELDS.sessionMode.label}
              value={common.sessionMode}
              options={[
                { value: '', label: 'Not set' },
                ...COMMON_FIELDS.sessionMode.options.map((o) => ({ value: o, label: o })),
              ]}
              onChange={(sessionMode) => setCommon((c) => ({ ...c, sessionMode }))}
            />
            <Select
              label={COMMON_FIELDS.caseStatus.label}
              value={common.caseStatus}
              options={[
                { value: '', label: 'Not set' },
                ...COMMON_FIELDS.caseStatus.options.map((o) => ({ value: o, label: o })),
              ]}
              onChange={(caseStatus) => setCommon((c) => ({ ...c, caseStatus }))}
            />

            <Text style={styles.multiLabel}>{COMMON_FIELDS.improvementScore.label}</Text>
            {/* A row of ten taps rather than a slider — more precise on a phone, and it avoids
                pulling in a slider dependency for one field. */}
            <ScoreRow
              value={common.improvementScore}
              onChange={(improvementScore) => setCommon((c) => ({ ...c, improvementScore }))}
              disabled={saving}
            />

            <TextField
              label={COMMON_FIELDS.counselorNotes.label}
              value={common.counselorNotes}
              onChangeText={(counselorNotes) => setCommon((c) => ({ ...c, counselorNotes }))}
              placeholder="What was discussed, and what happens next"
              multiline
              inputStyle={styles.multiline}
            />
            <DateTimeField
              label={COMMON_FIELDS.followUpDate.label}
              mode="date"
              value={common.followUpDate}
              onChange={(followUpDate) => setCommon((c) => ({ ...c, followUpDate }))}
              clearable
              placeholder="Optional"
            />
          </>
        )}
      </FormSheet>
    </ScreenScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  pickers: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  // ScreenScaffold already pads its content; cancel the picker's own padding.
  schoolPicker: { paddingHorizontal: 0, paddingVertical: 0 },
  month: { marginTop: SPACING.md },
  loader: { marginVertical: SPACING.lg },

  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.sm,
  },
  studentName: { flex: 1, fontSize: 14.5, fontWeight: '600', color: SLATE[800] },
  studentNone: { fontSize: 11.5, color: SLATE[400], fontStyle: 'italic' },

  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  backText: { fontSize: 13, fontWeight: '700', color: p.primaryDark },

  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  dayRowMuted: { opacity: 0.55 },
  dayLabel: { flex: 1, fontSize: 13.5, color: SLATE[700], fontWeight: '600' },
  dayLabelMuted: { color: SLATE[400] },
  dayNote: { fontSize: 11.5, color: SLATE[400], fontStyle: 'italic' },

  existing: {
    padding: SPACING.sm,
    borderRadius: 10,
    backgroundColor: SLATE[50],
    marginBottom: SPACING.md,
  },
  existingTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: SLATE[500],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  existingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  existingType: { flex: 1, fontSize: 13, fontWeight: '600', color: SLATE[700] },
  existingStatus: { fontSize: 12, color: SLATE[500] },

  pickPrompt: { fontSize: 13.5, color: SLATE[600], marginBottom: SPACING.sm },
  typeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SLATE[200],
    marginBottom: SPACING.sm,
  },
  typeText: { flex: 1, fontSize: 14.5, fontWeight: '700', color: SLATE[800] },

  multiBlock: { marginBottom: SPACING.md },
  multiLabel: { fontSize: 13, fontWeight: '600', color: SLATE[700], marginBottom: 6 },
  multiWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  multiChip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
  },
  multiChipText: { fontSize: 12.5, fontWeight: '600', color: SLATE[600] },

  scoreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.md },
  scoreBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: SLATE[50],
  },
  scoreText: { fontSize: 13, fontWeight: '700', color: SLATE[600] },
  scoreTextActive: { color: '#ffffff' },

  multiline: { height: 88, textAlignVertical: 'top' },
  pressed: { opacity: 0.72 },
}));
