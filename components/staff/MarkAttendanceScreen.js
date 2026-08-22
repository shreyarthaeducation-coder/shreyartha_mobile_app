import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SHADOWS, SLATE, SPACING } from '../../constants/theme';
import { usePalette } from '../../components/ui/PaletteContext';
import {
  CalendarGrid,
  EMPTY_SCHOOL_SCOPE,
  EMPTY_SCOPE,
  EmptyState,
  MonthNavigator,
  SchoolClassPicker,
  ScopePicker,
  ScreenScaffold,
  useToast,
} from '../ui';
import useStaffResource from '../../hooks/useStaffResource';
import {
  ATTENDANCE_ADAPTERS,
  ATTENDANCE_STATUS,
  TEACHER_ATTENDANCE_BASE,
  attendanceClassesLoaderFor,
  fetchAttendanceSheet,
  markAttendance,
} from '../../services/teacher/attendanceService';
import { addDays, formatLongDate, isSunday, parseIsoDate, todayIso } from '../../utils/dates';
import { makeStyles } from '../../utils/makeStyles';

/**
 * Native Mark Attendance — class attendance for one date at a time.
 *
 * DEPARTURE FROM THE WEB. frontendmain/src/School/Teacher/pages/TeacherAttendance.js is a
 * student × date grid with two sticky columns. Both axes cannot fit a phone, so the date becomes a
 * selector and the students become the list: pick a date, mark the roster, save.
 *
 * The 📅 button opens the month grid, tinted by COVERAGE (how much of the class is marked that
 * day) rather than by one person's status, which is what makes missed days findable.
 *
 * Portal A only. Portal B (`shreyartha_teacher`) returns the identical sheet DTO but picks scope as
 * School → Class with numeric ids and no sections, so it needs an adapter around this, not a copy.
 */


// Layout note: the plan had the scope chips scrolling away with the list and only the date bar
// pinned, but the chips sit ABOVE the date bar and a ListHeaderComponent renders BELOW anything
// pinned outside the list — that ordering can't be had without inverting the two. Both are pinned
// instead; together they cost ~110px, which still leaves a comfortable number of roster rows.

function ScopeSummary({ scope }) {
  const styles = useStyles();
  if (!scope.className) return null;
  return (
    <Text style={styles.scopeSummary} numberOfLines={1}>
      Class {scope.className}
      {scope.sectionName ? ` · Section ${scope.sectionName}` : ''}
    </Text>
  );
}

function StatusToggle({ status, disabled, onPick }) {
  const styles = useStyles();
  const options = [
    { value: ATTENDANCE_STATUS.PRESENT, short: 'P', tone: FEEDBACK.successText, bg: FEEDBACK.successBg },
    { value: ATTENDANCE_STATUS.ABSENT, short: 'A', tone: FEEDBACK.errorText, bg: FEEDBACK.errorBg },
  ];

  return (
    <View style={styles.toggle}>
      {options.map((option) => {
        const active = status === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onPick(option.value)}
            disabled={disabled}
            style={({ pressed }) => [
              styles.toggleBtn,
              active && { backgroundColor: option.bg, borderColor: option.tone },
              pressed && styles.pressed,
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.value === ATTENDANCE_STATUS.PRESENT ? 'Present' : 'Absent'}
          >
            <Text style={[styles.toggleText, active && { color: option.tone }]}>{option.short}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function StudentRow({ index, student, status, disabled, onPick }) {
  const styles = useStyles();
  const pct =
    student.totalMarked > 0 ? Math.round((student.presentCount / student.totalMarked) * 100) : null;

  return (
    <View style={styles.row}>
      <Text style={styles.rowIndex}>{index + 1}</Text>
      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={1}>
          {student.studentName}
        </Text>
        <Text style={styles.rowMeta}>
          {pct === null
            ? 'No marks this month'
            : `This month: P ${student.presentCount} · A ${student.absentCount} · ${pct}%`}
        </Text>
      </View>
      <StatusToggle status={status} disabled={disabled} onPick={onPick} />
    </View>
  );
}

export default function MarkAttendanceScreen({
  homeRoute = '/teacher',
  // The school-bound counsellor is this screen against `/api/counselor/attendance` — same
  // endpoints, same DTOs, same name-keying.
  apiBase = TEACHER_ATTENDANCE_BASE,
  // The Shreyartha counsellor is NOT: its endpoints are id-keyed and its scope is School → Class
  // with no academic year, so it swaps both the picker and the request builder. The response is
  // the same DTO, so everything below the fetch is shared.
  scopeKind = 'classSection',
  schoolsEndpoint,
}) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const schoolScoped = scopeKind === 'schoolClass';
  const adapter = ATTENDANCE_ADAPTERS[scopeKind] || ATTENDANCE_ADAPTERS.classSection;

  const [scope, setScope] = useState(schoolScoped ? EMPTY_SCHOOL_SCOPE : EMPTY_SCOPE);
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const { toast, showToast } = useToast();

  // The date drives which month's sheet we hold, so stepping across a boundary re-keys the fetch.
  const period = useMemo(() => {
    const date = parseIsoDate(selectedDate) || new Date();
    return { year: date.getFullYear(), month: date.getMonth() + 1 };
  }, [selectedDate]);

  const ready = adapter.isReady(scope);

  // Cached per namespace — ScopePicker's fetcher effect keys on this identity, so a fresh function
  // each render would refetch the class list forever.
  const classesLoader = useMemo(() => attendanceClassesLoaderFor(apiBase), [apiBase]);

  // Primitives only in the deps: `scope` is a new object on every pick.
  const scopeKey = `${scope.className}|${scope.sectionName}|${scope.classId}`;
  const fetcher = useCallback(
    (signal) =>
      fetchAttendanceSheet(
        { scope, year: period.year, month: period.month, apiBase, adapter },
        signal,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scopeKey, period.year, period.month, apiBase, adapter],
  );

  const { data: sheet, loading, refreshing, error, reload, refresh, revalidate } = useStaffResource(
    fetcher,
    { enabled: ready },
  );

  const students = useMemo(() => (Array.isArray(sheet?.students) ? sheet.students : []), [sheet]);
  const listData = ready ? students : [];

  // Seed the edit map from the server whenever the sheet or the date changes.
  //
  // AN UNMARKED STUDENT STARTS BLANK — neither P nor A. The web pre-fills every student as ABSENT
  // (`existing || "ABSENT"`, TeacherAttendance.js:121); we deliberately don't, and we don't default
  // to Present either. The blank state IS the feature: it turns the roster into a live progress
  // meter, so a teacher part-way through a roll-call can see exactly who she has already called.
  // Pre-filling anything destroys that signal. Please don't "fix" this back to match the web.
  useEffect(() => {
    const next = {};
    students.forEach((student) => {
      const saved = student.attendance?.[selectedDate];
      if (saved) next[student.studentId] = saved;
    });
    setEdits(next);
  }, [students, selectedDate]);

  // `ready &&` matters: changing the academic year resets the scope but leaves the previous
  // class's sheet in memory, and without this the stale roster would keep reporting itself dirty
  // and re-prompt on the next scope change. At the moment the guard runs, `ready` is still true.
  const dirty = useMemo(
    () =>
      ready &&
      students.some(
        (student) =>
          (edits[student.studentId] ?? null) !== (student.attendance?.[selectedDate] ?? null),
      ),
    [ready, students, edits, selectedDate],
  );

  const tally = useMemo(() => {
    let present = 0;
    let absent = 0;
    students.forEach((student) => {
      const status = edits[student.studentId];
      if (status === ATTENDANCE_STATUS.PRESENT) present += 1;
      else if (status === ATTENDANCE_STATUS.ABSENT) absent += 1;
    });
    return { present, absent, marked: present + absent, total: students.length };
  }, [students, edits]);

  // How much of the class is marked on each day of the month — drives the calendar tint.
  const coverage = useMemo(() => {
    const map = {};
    if (!students.length) return map;
    (sheet?.dates || []).forEach((date) => {
      let marked = 0;
      students.forEach((student) => {
        if (student.attendance?.[date]) marked += 1;
      });
      map[date] = marked === 0 ? 'none' : marked === students.length ? 'all' : 'partial';
    });
    return map;
  }, [sheet, students]);

  // The web silently drops in-progress edits when the scope changes. A phone makes that far too
  // easy to do by accident, so confirm first.
  const guardUnsaved = useCallback(
    (proceed) => {
      if (!dirty || saving) {
        proceed();
        return;
      }
      Alert.alert(
        'Discard unsaved attendance?',
        `You have unsaved changes for ${formatLongDate(selectedDate)}.`,
        [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: proceed },
        ],
      );
    },
    [dirty, saving, selectedDate],
  );

  const changeScope = (next) => guardUnsaved(() => setScope(next));
  const changeDate = (next) => guardUnsaved(() => setSelectedDate(next));

  const setAll = (status) => {
    const next = {};
    students.forEach((student) => {
      next[student.studentId] = status;
    });
    setEdits(next);
  };

  const save = async () => {
    if (!ready || saving || tally.marked === 0) return;

    setSaving(true);
    try {
      // Send the whole roster, like the web. The server upserts on (teacher, student, date) inside
      // one transaction, so a full payload is idempotent and can't half-apply.
      await markAttendance({
        scope,
        date: selectedDate,
        // Only the students actually marked. Unmarked ones are omitted rather than guessed at:
        // a null status NPEs server-side, and since /mark is an upsert, leaving them out simply
        // leaves their existing row (if any) alone. That's what makes a partial save work — mark
        // fifteen, save, carry on.
        entries: students
          .filter((student) => edits[student.studentId])
          .map((student) => ({
            studentId: student.studentId,
            status: edits[student.studentId],
          })),
        apiBase,
        adapter,
      });
      showToast('Attendance saved.', 'success');
      // Silent: the roster already shows what we sent, so this only refreshes the month counters.
      await revalidate();
    } catch (e) {
      showToast(e?.message || 'Could not save attendance.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const listBody = () => {
    if (!ready) {
      return (
        <EmptyState
          icon="school-outline"
          title="Choose a class"
          message="Pick an academic year, class and section to load the roster."
        />
      );
    }
    if (loading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PALETTE.primary} />
        </View>
      );
    }
    if (error) {
      return (
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load the roster"
          message={error}
          actionLabel="Try again"
          onAction={reload}
        />
      );
    }
    return (
      <EmptyState
        icon="people-outline"
        title="No students in this section"
        message="Students need to be registered and assigned to this class and section before you can mark attendance."
      />
    );
  };

  return (
    <ScreenScaffold title="Mark Attendance" fallbackRoute={homeRoute} scroll={false} toast={toast}>
      <View style={styles.header}>
        {schoolScoped ? (
          <SchoolClassPicker
            endpoint={schoolsEndpoint}
            value={scope}
            onChange={changeScope}
            style={styles.schoolPicker}
          />
        ) : (
          <ScopePicker loadClasses={classesLoader} value={scope} onChange={changeScope} />
        )}

        {ready ? (
          <>
            <View style={styles.dateBar}>
              <Pressable
                onPress={() => changeDate(addDays(selectedDate, -1))}
                hitSlop={8}
                style={({ pressed }) => [styles.dateArrow, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Previous day"
              >
                <Ionicons name="chevron-back" size={18} color={PALETTE.primaryDark} />
              </Pressable>

              <Text style={styles.dateLabel} numberOfLines={1}>
                {formatLongDate(selectedDate)}
                {selectedDate === todayIso() ? '  ·  Today' : ''}
              </Text>

              <Pressable
                onPress={() => changeDate(addDays(selectedDate, 1))}
                hitSlop={8}
                style={({ pressed }) => [styles.dateArrow, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Next day"
              >
                <Ionicons name="chevron-forward" size={18} color={PALETTE.primaryDark} />
              </Pressable>

              <Pressable
                onPress={() => setCalendarOpen(true)}
                hitSlop={8}
                style={({ pressed }) => [styles.calendarBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Pick a date from the month"
              >
                <Ionicons name="calendar-outline" size={17} color="#ffffff" />
              </Pressable>
            </View>

            <View style={styles.statusLine}>
              <ScopeSummary scope={scope} />
              {students.length > 0 ? (
                <Text style={styles.tally}>
                  {tally.marked} of {tally.total} marked
                  {tally.marked > 0 ? ` · ${tally.present} P · ${tally.absent} A` : ''}
                  {dirty ? '  ·  Unsaved' : ''}
                </Text>
              ) : null}
            </View>
          </>
        ) : null}
      </View>

      {/* A failed refresh must not throw away the roster being marked — it degrades to a notice
          and the list stays put. Only a load with nothing to show falls through to listBody(). */}
      {error && students.length > 0 ? <Text style={styles.notice}>{error}</Text> : null}

      <FlatList
        style={styles.list}
        // Not `students` directly: a scope reset leaves the previous class's sheet in memory, and
        // rendering it under a picker that says nothing is selected would show the wrong roster.
        data={listData}
        keyExtractor={(item) => String(item.studentId)}
        renderItem={({ item, index }) => (
          <StudentRow
            index={index}
            student={item}
            status={edits[item.studentId]}
            disabled={saving}
            onPick={(status) =>
              setEdits((prev) => {
                // Tapping the lit option clears it — but only while it is unsaved. Once a mark is
                // on the server there is no way to un-mark it (the API has no delete for a single
                // attendance record), so offering a clear that silently does nothing would lie.
                // A saved student can still be switched P↔A.
                const savedOnServer = !!item.attendance?.[selectedDate];
                if (prev[item.studentId] === status && !savedOnServer) {
                  const next = { ...prev };
                  delete next[item.studentId];
                  return next;
                }
                return { ...prev, [item.studentId]: status };
              })
            }
          />
        )}
        ListEmptyComponent={listBody}
        contentContainerStyle={listData.length ? styles.listContent : styles.listContentEmpty}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          ready ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => guardUnsaved(refresh)}
              tintColor={PALETTE.primary}
              colors={[PALETTE.primary]}
            />
          ) : undefined
        }
      />

      {ready && students.length > 0 ? (
        <View style={styles.footer}>
          <Pressable
            onPress={() => setAll(ATTENDANCE_STATUS.PRESENT)}
            disabled={saving}
            style={({ pressed }) => [styles.bulkBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={[styles.bulkText, { color: FEEDBACK.successText }]}>All present</Text>
          </Pressable>
          <Pressable
            onPress={() => setAll(ATTENDANCE_STATUS.ABSENT)}
            disabled={saving}
            style={({ pressed }) => [styles.bulkBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={[styles.bulkText, { color: FEEDBACK.errorText }]}>All absent</Text>
          </Pressable>
          <Pressable
            onPress={save}
            disabled={saving || tally.marked === 0}
            style={({ pressed }) => [
              styles.saveBtn,
              (saving || tally.marked === 0) && styles.saveBtnDisabled,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.saveText}>Save</Text>
            )}
          </Pressable>
        </View>
      ) : null}

      <Modal
        visible={calendarOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCalendarOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setCalendarOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />
            <MonthNavigator
              year={period.year}
              month={period.month}
              // Jumping months from here lands on the 1st; the sheet re-fetches off the new date.
              onChange={({ year, month }) =>
                changeDate(`${year}-${String(month).padStart(2, '0')}-01`)
              }
            />
            <View style={styles.sheetGrid}>
              <CalendarGrid
                dates={sheet?.dates || []}
                selectedDate={selectedDate}
                onDayPress={(date) => {
                  setCalendarOpen(false);
                  changeDate(date);
                }}
                getDay={(date) => {
                  const state = coverage[date];
                  return {
                    // Sundays are tinted but stay markable — the web's Mark Attendance has no
                    // Sunday guard, unlike Self Attendance which locks them.
                    bg: isSunday(date) ? SLATE[100] : undefined,
                    dot:
                      state === 'all'
                        ? FEEDBACK.successText
                        : state === 'partial'
                          ? FEEDBACK.warningText
                          : undefined,
                    bold: date === todayIso(),
                    accessibilityLabel: `${formatLongDate(date)}, ${
                      state === 'all' ? 'fully marked' : state === 'partial' ? 'partly marked' : 'not marked'
                    }`,
                  };
                }}
              />
            </View>
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: FEEDBACK.successText }]} />
                <Text style={styles.legendText}>All marked</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: FEEDBACK.warningText }]} />
                <Text style={styles.legendText}>Partly marked</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.legendDotEmpty]} />
                <Text style={styles.legendText}>Not marked</Text>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  // SchoolClassPicker pads itself for screens that drop it straight under a header; here the
  // header already pads, so cancel it rather than double-indenting the chips.
  schoolPicker: { paddingHorizontal: 0, paddingVertical: 0 },
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: SLATE[200],
    gap: SPACING.sm,
  },
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SLATE[50],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SLATE[200],
    padding: 5,
  },
  dateArrow: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateLabel: { flex: 1, textAlign: 'center', fontSize: 14.5, fontWeight: '700', color: SLATE[800] },
  calendarBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: p.primaryDark,
  },
  statusLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  scopeSummary: { flexShrink: 1, fontSize: 12.5, fontWeight: '600', color: SLATE[500] },
  tally: { fontSize: 12.5, fontWeight: '700', color: SLATE[600] },

  list: { flex: 1 },
  listContent: { paddingBottom: SPACING.sm },
  listContentEmpty: { flexGrow: 1, justifyContent: 'center' },
  centered: { paddingVertical: SPACING.xxl, alignItems: 'center', justifyContent: 'center' },
  notice: {
    fontSize: 12.5,
    color: FEEDBACK.errorText,
    textAlign: 'center',
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    backgroundColor: FEEDBACK.errorBg,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 11,
    paddingHorizontal: SPACING.md,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: SLATE[100],
  },
  rowIndex: { width: 22, fontSize: 12.5, fontWeight: '700', color: SLATE[400] },
  rowText: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '600', color: SLATE[800] },
  rowMeta: { fontSize: 11.5, color: SLATE[500], marginTop: 2 },

  toggle: { flexDirection: 'row', gap: 6 },
  toggleBtn: {
    width: 40,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: SLATE[50],
  },
  toggleText: { fontSize: 14, fontWeight: '800', color: SLATE[400] },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: SLATE[200],
    ...SHADOWS.md,
  },
  bulkBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SLATE[200],
  },
  bulkText: { fontSize: 13, fontWeight: '700' },
  saveBtn: {
    flex: 1.1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: p.primaryDark,
  },
  saveBtnDisabled: { backgroundColor: SLATE[300] },
  saveText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  pressed: { opacity: 0.72 },

  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: SLATE[300],
    marginBottom: SPACING.md,
  },
  sheetGrid: { marginTop: SPACING.md },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendDotEmpty: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: SLATE[300] },
  legendText: { fontSize: 12, color: SLATE[500], fontWeight: '600' },
}));
