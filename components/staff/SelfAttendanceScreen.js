import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING } from '../../constants/theme';
import { usePalette } from '../../components/ui/PaletteContext';
import {
  Card,
  CardTitle,
  CalendarGrid,
  MonthNavigator,
  ScreenScaffold,
  useToast,
} from '../ui';
import useStaffResource from '../../hooks/useStaffResource';
import {
  ATTENDANCE_STATUS,
  fetchSelfAttendanceSheet,
  markSelfAttendance,
} from '../../services/teacher/selfAttendanceService';
import { formatLongDate, isSunday, todayIso } from '../../utils/dates';
import { makeStyles } from '../../utils/makeStyles';

/**
 * Native Self Attendance — the staff member's own month sheet.
 *
 * Shared by the teacher panel and every app/staff/[role] shell: the backend guard admits nine
 * roles, so nothing here is teacher-specific.
 *
 * DEPARTURE FROM THE WEB, ON PURPOSE. frontendmain/src/School/Teacher/pages/TeacherSelfAttendance.js
 * renders a single-row, 31-column horizontally scrolling table with a sticky name column. That is
 * unreadable on a phone, so this is a month calendar instead. Same two endpoints, same data, no
 * backend change. The behaviours that ARE the web's are kept: Sundays are locked, tapping a marked
 * day pre-selects its current status, and the sheet is re-fetched after a successful save.
 *
 * Props:
 *   homeRoute — where the header's Back button lands when there is no history (deep link)
 */


// Tint plus text colour is enough to read a cell at a glance; a dot in the same colour would only
// restate it. CalendarGrid's `dot` slot is left for screens that need a second signal (My Calendar
// marking event days on top of attendance).
const CELL = {
  PRESENT: { bg: FEEDBACK.successBg, color: FEEDBACK.successText },
  ABSENT: { bg: FEEDBACK.errorBg, color: FEEDBACK.errorText },
};

function SummaryTile({ label, value, color }) {
  const styles = useStyles();
  return (
    <View style={styles.summaryTile}>
      <Text style={[styles.summaryValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function LegendItem({ color, label, hollow }) {
  const styles = useStyles();
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendSwatch,
          hollow
            ? { backgroundColor: '#ffffff', borderColor: SLATE[200] }
            : { backgroundColor: color, borderColor: color },
        ]}
      />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

export default function SelfAttendanceScreen({ homeRoute = '/teacher' }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const now = new Date();
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [selectedDate, setSelectedDate] = useState(null);
  const [pendingStatus, setPendingStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  const { toast, showToast } = useToast();

  // Memoised on the period alone — useStaffResource keys its effect on this identity, so an
  // inline arrow here would re-fetch on every render.
  const fetcher = useCallback(
    (signal) => fetchSelfAttendanceSheet(period.year, period.month, signal),
    [period.year, period.month],
  );

  const { data: sheet, loading, refreshing, error, reload, refresh, revalidate, setData } =
    useStaffResource(fetcher);

  const dates = useMemo(() => (Array.isArray(sheet?.dates) ? sheet.dates : []), [sheet]);
  const attendance = sheet?.attendance || {};
  const today = todayIso();

  const summary = useMemo(() => {
    let present = 0;
    let absent = 0;
    let unmarked = 0;
    dates.forEach((date) => {
      if (isSunday(date)) return; // Sundays are locked, so they aren't "unmarked" work days
      const status = attendance[date];
      if (status === ATTENDANCE_STATUS.PRESENT) present += 1;
      else if (status === ATTENDANCE_STATUS.ABSENT) absent += 1;
      else unmarked += 1;
    });
    return { present, absent, unmarked };
  }, [dates, attendance]);

  const changePeriod = (next) => {
    setPeriod(next);
    // The selection belongs to the month that is going away.
    setSelectedDate(null);
    setPendingStatus(null);
  };

  const getDay = useCallback(
    (dateStr) => {
      if (isSunday(dateStr)) {
        return { disabled: true, bg: SLATE[100], accessibilityLabel: `${dateStr}, Sunday, locked` };
      }
      const status = attendance[dateStr];
      const cell = CELL[status];
      return {
        bg: cell?.bg,
        color: cell?.color,
        bold: dateStr === today,
        borderColor: dateStr === today ? PALETTE.primary : undefined,
        accessibilityLabel: `${formatLongDate(dateStr)}, ${status ? status.toLowerCase() : 'not marked'}`,
      };
    },
    [attendance, today],
  );

  const openDay = (dateStr) => {
    setSelectedDate(dateStr);
    // Web parity: an already-marked day opens with its current status selected.
    setPendingStatus(attendance[dateStr] || null);
  };

  const closeDay = () => {
    setSelectedDate(null);
    setPendingStatus(null);
  };

  const save = async () => {
    if (!selectedDate || !pendingStatus || saving) return;

    const previous = attendance[selectedDate] ?? null;
    setSaving(true);
    // Paint the cell immediately; the round trip is a re-fetch away.
    setData((current) =>
      current
        ? { ...current, attendance: { ...current.attendance, [selectedDate]: pendingStatus } }
        : current,
    );

    try {
      await markSelfAttendance(selectedDate, pendingStatus);
      showToast('Attendance saved.', 'success');
      closeDay();
      // Silent, not refresh(): the optimistic cell is already correct (the endpoint is a plain
      // upsert of what we sent), so driving the RefreshControl here would flash a pull-to-refresh
      // spinner the user never asked for.
      await revalidate();
    } catch (e) {
      // Put the old value back — the optimistic paint was a lie.
      setData((current) =>
        current
          ? { ...current, attendance: { ...current.attendance, [selectedDate]: previous } }
          : current,
      );
      showToast(e?.message || 'Could not save your attendance.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenScaffold
      title="Self Attendance"
      fallbackRoute={homeRoute}
      loading={loading}
      // Only blank the screen when there is nothing to show. A failed pull-to-refresh must not
      // throw away the month the user is already looking at — it degrades to a notice instead.
      error={sheet ? '' : error}
      notice={sheet && error ? error : ''}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
      toast={toast}
    >
      <MonthNavigator
        year={period.year}
        month={period.month}
        onChange={changePeriod}
        disabled={saving}
      />

      <View style={styles.summaryRow}>
        <SummaryTile label="Present" value={summary.present} color={FEEDBACK.successText} />
        <SummaryTile label="Absent" value={summary.absent} color={FEEDBACK.errorText} />
        <SummaryTile label="Unmarked" value={summary.unmarked} color={SLATE[500]} />
      </View>

      <Card>
        <CardTitle>
          {sheet?.monthName ? `${sheet.monthName} ${sheet.year}` : 'Attendance'}
        </CardTitle>
        <CalendarGrid
          dates={dates}
          getDay={getDay}
          selectedDate={selectedDate}
          onDayPress={openDay}
        />
        <View style={styles.legend}>
          <LegendItem color={FEEDBACK.successText} label="Present" />
          <LegendItem color={FEEDBACK.errorText} label="Absent" />
          <LegendItem hollow label="Not marked" />
          <LegendItem color={SLATE[200]} label="Sunday" />
        </View>
      </Card>

      {selectedDate ? (
        <Card>
          <CardTitle>{formatLongDate(selectedDate)}</CardTitle>

          <View style={styles.statusRow}>
            {[
              { value: ATTENDANCE_STATUS.PRESENT, label: 'Present', icon: 'checkmark-circle', tone: FEEDBACK.successText, bg: FEEDBACK.successBg },
              { value: ATTENDANCE_STATUS.ABSENT, label: 'Absent', icon: 'close-circle', tone: FEEDBACK.errorText, bg: FEEDBACK.errorBg },
            ].map((option) => {
              const active = pendingStatus === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setPendingStatus(option.value)}
                  disabled={saving}
                  style={({ pressed }) => [
                    styles.statusBtn,
                    active && { backgroundColor: option.bg, borderColor: option.tone },
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <Ionicons
                    name={option.icon}
                    size={18}
                    color={active ? option.tone : SLATE[400]}
                  />
                  <Text style={[styles.statusText, active && { color: option.tone }]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={closeDay}
              disabled={saving}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={save}
              disabled={saving || !pendingStatus}
              style={({ pressed }) => [
                styles.saveBtn,
                (!pendingStatus || saving) && styles.saveBtnDisabled,
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
        </Card>
      ) : (
        <Text style={styles.hint}>
          Tap any day to mark yourself present or absent. Sundays are locked.
        </Text>
      )}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  summaryRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  summaryTile: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SLATE[200],
    paddingVertical: 12,
    alignItems: 'center',
  },
  summaryValue: { fontSize: 20, fontWeight: '800', color: SLATE[800] },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: SLATE[500],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 2,
  },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 12, height: 12, borderRadius: 4, borderWidth: 1 },
  legendText: { fontSize: 12, color: SLATE[500], fontWeight: '600' },

  statusRow: { flexDirection: 'row', gap: SPACING.sm },
  statusBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: SLATE[50],
  },
  statusText: { fontSize: 14, fontWeight: '700', color: SLATE[600] },

  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SLATE[200],
  },
  cancelText: { fontSize: 14, fontWeight: '700', color: SLATE[600] },
  saveBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: p.primaryDark,
  },
  saveBtnDisabled: { backgroundColor: SLATE[300] },
  saveText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  pressed: { opacity: 0.75 },

  hint: {
    fontSize: 12.5,
    color: SLATE[500],
    textAlign: 'center',
    lineHeight: 18,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
}));
