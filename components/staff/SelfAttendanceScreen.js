import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE, leading } from '../../constants/theme';
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
  captureMarkLocation,
  fetchSelfAttendanceSheet,
  markSelfAttendance,
} from '../../services/teacher/selfAttendanceService';
import { formatLongDate, isSunday, toLocalDateTimeString, todayIso } from '../../utils/dates';
import { makeStyles } from '../../utils/makeStyles';
import AttendanceDayDetail, { STATUS_META, noFixReason } from './AttendanceDayDetail';

/**
 * Native Self Attendance — the staff member's own month sheet.
 *
 * Shared by the teacher panel (its footer (+) opens it) and every app/staff/[role] shell: the
 * backend guard admits nine roles, so nothing here is teacher-specific.
 *
 * DEPARTURE FROM THE WEB, ON PURPOSE. frontendmain/src/School/Teacher/pages/TeacherSelfAttendance.js
 * renders a single-row, 31-column horizontally scrolling table with a sticky name column. That is
 * unreadable on a phone, so this is a month calendar instead. Same endpoints, same data. The
 * behaviours that ARE the web's are kept: Sundays are locked, tapping a marked day pre-selects its
 * current status, and the sheet is re-fetched after a successful save.
 *
 * WHERE AND WHEN. Every mark carries the device's location (asked for at the moment of saving) and
 * the server stamps the time; tapping any day shows both, plus that day's sign-in. A day a sales
 * check-in marked present is shown with its school and cannot be changed here — the server refuses
 * that change, so the screen does not offer it.
 *
 * Props:
 *   homeRoute — where the header's Back button lands when there is no history (deep link)
 */

const OPTIONS = [
  { value: ATTENDANCE_STATUS.PRESENT, icon: 'checkmark-circle' },
  { value: ATTENDANCE_STATUS.WORK_FROM_HOME, icon: 'home' },
  { value: ATTENDANCE_STATUS.ABSENT, icon: 'close-circle' },
];

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
  const [locating, setLocating] = useState(false);

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
  const details = sheet?.details || {};
  const today = todayIso();
  const showingThisMonth = dates.includes(today);

  const summary = useMemo(() => {
    let present = 0;
    let absent = 0;
    let unmarked = 0;
    dates.forEach((date) => {
      const status = attendance[date];
      // An unmarked Sunday is locked, not an unmarked work day. A marked one — a check-in on a
      // Sunday — is real work and counts.
      if (isSunday(date) && !status) return;
      // Work from home is a working day, and the server counts it with PRESENT everywhere.
      if (status === ATTENDANCE_STATUS.PRESENT || status === ATTENDANCE_STATUS.WORK_FROM_HOME) present += 1;
      else if (status === ATTENDANCE_STATUS.ABSENT) absent += 1;
      else unmarked += 1;
    });
    return { present, absent, unmarked };
  }, [dates, attendance]);

  const isLocked = (date) => !!date && (isSunday(date) || !!details[date]?.locked);
  const selectedLocked = isLocked(selectedDate);

  const changePeriod = (next) => {
    setPeriod(next);
    // The selection belongs to the month that is going away.
    setSelectedDate(null);
    setPendingStatus(null);
  };

  const getDay = useCallback(
    (dateStr) => {
      const status = attendance[dateStr];
      const meta = STATUS_META[status];
      if (isSunday(dateStr) && !status) {
        return { disabled: true, bg: SLATE[100], accessibilityLabel: `${dateStr}, Sunday, locked` };
      }
      return {
        bg: meta?.bg,
        color: meta?.onBg,
        bold: dateStr === today,
        borderColor: dateStr === today ? PALETTE.primary : undefined,
        accessibilityLabel: `${formatLongDate(dateStr)}, ${meta ? meta.label.toLowerCase() : 'not marked'}`,
      };
    },
    [attendance, today, PALETTE.primary],
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

  /**
   * Mark one day, with the device's location. Returns whether it saved.
   *
   * The location is asked for BEFORE the optimistic paint, so the cell does not flip and then sit
   * for up to 12 s while the GPS settles. The paint includes a provisional detail (now, and the
   * fix just taken) so the day card does not briefly claim "marked before times were recorded";
   * the re-fetch replaces it with the server's own stamp.
   */
  const markDay = async (date, status) => {
    if (!date || !status || saving || isLocked(date)) return false;

    const previousStatus = attendance[date] ?? null;
    const previousDetail = details[date];
    setSaving(true);
    setLocating(true);
    const location = await captureMarkLocation();
    setLocating(false);

    const provisional = {
      ...(previousDetail || {}),
      status,
      source: 'MANUAL',
      locked: false,
      markedAt: toLocalDateTimeString(new Date()),
      latitude: location.latitude,
      longitude: location.longitude,
      accuracyMetres: location.accuracy,
      resolvedAddress: location.resolvedAddress,
      pincode: location.pincode,
      locationStatus: location.locationStatus,
      placeName: null,
    };
    setData((current) =>
      current
        ? {
            ...current,
            attendance: { ...current.attendance, [date]: status },
            details: { ...(current.details || {}), [date]: provisional },
          }
        : current,
    );

    try {
      await markSelfAttendance(date, status, location);
      showToast(
        location.locationStatus === 'ok'
          ? 'Attendance saved with your location.'
          : `Attendance saved, without a location — ${noFixReason(location.locationStatus).toLowerCase()}.`,
        'success',
      );
      // Silent, not refresh(): the optimistic cell is already right, so driving the RefreshControl
      // here would flash a pull-to-refresh spinner the user never asked for.
      await revalidate();
      return true;
    } catch (e) {
      // Put the old values back — the optimistic paint was a lie.
      setData((current) => {
        if (!current) return current;
        const nextDetails = { ...(current.details || {}) };
        if (previousDetail) nextDetails[date] = previousDetail;
        else delete nextDetails[date];
        return {
          ...current,
          attendance: { ...current.attendance, [date]: previousStatus },
          details: nextDetails,
        };
      });
      // The server's words: e.g. a day a school check-in already marked present.
      showToast(e?.message || 'Could not save your attendance.', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (!selectedDate || !pendingStatus || selectedLocked) return;
    if (await markDay(selectedDate, pendingStatus)) closeDay();
  };

  const todayStatus = attendance[today];
  const todayDetail = details[today];
  const showToday = showingThisMonth && !(isSunday(today) && !todayStatus && !todayDetail);

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
      {showToday ? (
        <Card>
          <CardTitle>Today</CardTitle>
          {todayStatus || todayDetail ? (
            <AttendanceDayDetail date={today} detail={todayDetail || { status: todayStatus }} />
          ) : null}
          {!todayStatus && !isSunday(today) ? (
            <>
              <Text style={styles.todayPrompt}>
                You haven't marked today yet. The time and your location are recorded when you do.
              </Text>
              <View style={styles.quickRow}>
                <Pressable
                  onPress={() => markDay(today, ATTENDANCE_STATUS.PRESENT)}
                  disabled={saving}
                  style={({ pressed }) => [
                    styles.quickPrimary,
                    { backgroundColor: PALETTE.primaryDark },
                    saving && styles.saveBtnDisabled,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Mark me present today"
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={21} color="#ffffff" />
                      <Text style={styles.quickPrimaryText}>I'm present</Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => markDay(today, ATTENDANCE_STATUS.WORK_FROM_HOME)}
                  disabled={saving}
                  style={({ pressed }) => [styles.quickSecondary, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Mark today as work from home"
                >
                  <Ionicons name="home" size={19} color={STATUS_META.WORK_FROM_HOME.color} />
                  <Text style={styles.quickSecondaryText}>Work from home</Text>
                </Pressable>
              </View>
              {locating ? <Text style={styles.locatingText}>Getting your location…</Text> : null}
            </>
          ) : null}
        </Card>
      ) : null}

      <MonthNavigator
        year={period.year}
        month={period.month}
        onChange={changePeriod}
        disabled={saving}
      />

      <View style={styles.summaryRow}>
        <SummaryTile label="Present" value={summary.present} color={STATUS_META.PRESENT.color} />
        <SummaryTile label="Absent" value={summary.absent} color={STATUS_META.ABSENT.color} />
        <SummaryTile label="Unmarked" value={summary.unmarked} color={SLATE[600]} />
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
          <LegendItem color={STATUS_META.PRESENT.color} label="Present" />
          <LegendItem color={STATUS_META.WORK_FROM_HOME.color} label="Work from home" />
          <LegendItem color={STATUS_META.ABSENT.color} label="Absent" />
          <LegendItem hollow label="Not marked" />
          <LegendItem color={SLATE[200]} label="Sunday" />
        </View>
      </Card>

      {selectedDate ? (
        <Card>
          <CardTitle>{formatLongDate(selectedDate)}</CardTitle>
          <AttendanceDayDetail date={selectedDate} detail={details[selectedDate]} />

          {selectedLocked ? (
            <Pressable
              onPress={closeDay}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>Close</Text>
            </Pressable>
          ) : (
            <>
              <View style={styles.statusList}>
                {OPTIONS.map((option) => {
                  const meta = STATUS_META[option.value];
                  const active = pendingStatus === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setPendingStatus(option.value)}
                      disabled={saving}
                      style={({ pressed }) => [
                        styles.statusBtn,
                        active && { backgroundColor: meta.bg, borderColor: meta.onBg },
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                    >
                      <Ionicons
                        name={option.icon}
                        size={22}
                        color={active ? meta.onBg : SLATE[500]}
                      />
                      <Text style={[styles.statusText, active && { color: meta.onBg }]}>
                        {meta.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {locating ? <Text style={styles.locatingText}>Getting your location…</Text> : null}

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
            </>
          )}
        </Card>
      ) : (
        <Text style={styles.hint}>
          Tap a day to see when and where it was marked, or to mark it. Your location is recorded
          with each mark. Sundays are locked.
        </Text>
      )}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  todayPrompt: {
    fontSize: TYPE.body,
    lineHeight: leading(TYPE.body),
    color: SLATE[700],
  },
  quickRow: { gap: SPACING.sm, marginTop: SPACING.md },
  quickPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    paddingVertical: 12,
    borderRadius: 12,
  },
  quickPrimaryText: { fontSize: TYPE.heading, fontWeight: '800', color: '#ffffff' },
  quickSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
  },
  quickSecondaryText: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[700] },
  locatingText: {
    fontSize: TYPE.label,
    color: SLATE[600],
    textAlign: 'center',
    marginTop: SPACING.sm,
  },

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
  summaryValue: { fontSize: TYPE.headline, fontWeight: '800', color: SLATE[800] },
  summaryLabel: {
    fontSize: TYPE.caption,
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
  legendText: { fontSize: TYPE.label, color: SLATE[500], fontWeight: '600' },

  statusList: {
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  statusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: SLATE[50],
  },
  statusText: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[600] },

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
  closeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    marginTop: SPACING.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SLATE[200],
  },
  cancelText: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[600] },
  saveBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: p.primaryDark,
  },
  saveBtnDisabled: { backgroundColor: SLATE[300] },
  saveText: { fontSize: TYPE.heading, fontWeight: '700', color: '#ffffff' },
  pressed: { opacity: 0.75 },

  hint: {
    fontSize: TYPE.label,
    color: SLATE[500],
    textAlign: 'center',
    lineHeight: leading(TYPE.label),
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
}));
