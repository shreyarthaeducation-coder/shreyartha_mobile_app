import { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../../components/ui/PaletteContext';
import { CalendarGrid, Card, CardTitle, EmptyState, MonthNavigator, ScreenScaffold } from '../ui';
import useStaffResource from '../../hooks/useStaffResource';
import {
  EVENT_SOURCE,
  fetchAttendanceCalendar,
  fetchCalendarEvents,
  groupEventsByDate,
} from '../../services/teacher/calendarService';
import { formatLongDate, isSunday, todayIso } from '../../utils/dates';
import { makeStyles } from '../../utils/makeStyles';
import AttendanceDayDetail, { STATUS_META } from './AttendanceDayDetail';

/**
 * Native My Calendar — school events, national holidays, own leave and own attendance on one month.
 *
 * Role-agnostic on purpose: the web component is shared by six dashboards, so this can serve the
 * `app/staff/[role]` shells unchanged when they get their turn.
 *
 * The web puts up to two text badges in each 50px cell, which is unreadable on a phone. Here the
 * cell carries an attendance tint plus up to three event dots, and tapping a day lists what is on
 * it — the same pattern Homework already uses.
 */


const ATTENDANCE_TINT = {
  PRESENT: { bg: STATUS_META.PRESENT.bg, color: STATUS_META.PRESENT.onBg },
  WORK_FROM_HOME: { bg: STATUS_META.WORK_FROM_HOME.bg, color: STATUS_META.WORK_FROM_HOME.onBg },
  ABSENT: { bg: STATUS_META.ABSENT.bg, color: STATUS_META.ABSENT.onBg },
};

// Stable identity, so the resource's first render has the shape the fetcher returns.
const EMPTY_ATTENDANCE = { attendance: {}, details: {} };

const prettyTime = (value) => {
  const match = /T(\d{2}):(\d{2})/.exec(String(value || ''));
  if (!match) return '';
  const hours = Number(match[1]);
  const suffix = hours >= 12 ? 'pm' : 'am';
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${match[2]} ${suffix}`;
};

function LegendItem({ color, label, hollow }) {
  const styles = useStyles();
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendDot,
          hollow ? { backgroundColor: '#ffffff', borderColor: SLATE[300] } : { backgroundColor: color, borderColor: color },
        ]}
      />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

export default function MyCalendarScreen({ homeRoute = '/teacher' }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const now = new Date();
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [selectedDate, setSelectedDate] = useState(null);

  const eventsFetcher = useCallback((signal) => fetchCalendarEvents(period, signal), [period]);
  const {
    data: events,
    loading: eventsLoading,
    refreshing,
    error: eventsError,
    reload,
    refresh,
  } = useStaffResource(eventsFetcher, { initialData: [] });

  const attendanceFetcher = useCallback(
    (signal) => fetchAttendanceCalendar(period, signal),
    [period],
  );
  // Attendance dots are best-effort, exactly as on the web — a failure here must not blank the
  // month, so its error is deliberately not surfaced.
  const { data: attendance } = useStaffResource(attendanceFetcher, { initialData: EMPTY_ATTENDANCE });

  const eventList = events || [];
  const attendanceMap = attendance?.attendance || {};
  // When and where each day was marked, and that day's sign-in.
  const attendanceDetails = attendance?.details || {};

  const byDate = useMemo(() => groupEventsByDate(eventList), [eventList]);

  const dates = useMemo(() => {
    const days = new Date(period.year, period.month, 0).getDate();
    const pad = (n) => String(n).padStart(2, '0');
    return Array.from(
      { length: days },
      (_, i) => `${period.year}-${pad(period.month)}-${pad(i + 1)}`,
    );
  }, [period]);

  const summary = useMemo(() => {
    let present = 0;
    let absent = 0;
    // Every day of the month is a key with a null value when unmarked, so count values, not keys —
    // the web's key-count guard makes its summary bar claim "0 recorded" on an empty month.
    Object.values(attendanceMap).forEach((status) => {
      // Work from home is a working day; the server counts it with PRESENT everywhere.
      if (status === 'PRESENT' || status === 'WORK_FROM_HOME') present += 1;
      else if (status === 'ABSENT') absent += 1;
    });
    return { present, absent, marked: present + absent };
  }, [attendanceMap]);

  const changePeriod = (next) => {
    setPeriod(next);
    setSelectedDate(null);
  };

  const getDay = useCallback(
    (date) => {
      const status = attendanceMap[date];
      const tint = ATTENDANCE_TINT[status];
      const dayEvents = byDate[date] || [];
      return {
        bg: tint?.bg || (isSunday(date) ? SLATE[100] : undefined),
        color: tint?.color,
        // One dot for the day's first event; the count is in the label below.
        dot: dayEvents.length
          ? EVENT_SOURCE[dayEvents[0].source]?.color || PALETTE.primary
          : undefined,
        bold: date === todayIso(),
        accessibilityLabel: `${formatLongDate(date)}${
          status ? `, ${(STATUS_META[status]?.label || status).toLowerCase()}` : ''
        }${
          dayEvents.length ? `, ${dayEvents.length} event(s)` : ''
        }`,
      };
    },
    [attendanceMap, byDate],
  );

  const dayEvents = selectedDate ? byDate[selectedDate] || [] : [];

  return (
    <ScreenScaffold
      title="My Calendar"
      fallbackRoute={homeRoute}
      loading={eventsLoading && eventList.length === 0}
      error={eventList.length === 0 && eventsError ? eventsError : ''}
      notice={eventList.length > 0 && eventsError ? eventsError : ''}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      <MonthNavigator year={period.year} month={period.month} onChange={changePeriod} />

      <View style={styles.summaryRow}>
        <View style={styles.summaryTile}>
          <Text style={[styles.summaryValue, { color: FEEDBACK.successText }]}>
            {summary.present}
          </Text>
          <Text style={styles.summaryLabel}>Present</Text>
        </View>
        <View style={styles.summaryTile}>
          <Text style={[styles.summaryValue, { color: FEEDBACK.errorText }]}>{summary.absent}</Text>
          <Text style={styles.summaryLabel}>Absent</Text>
        </View>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryValue}>{eventList.length}</Text>
          <Text style={styles.summaryLabel}>Events</Text>
        </View>
      </View>

      <Card>
        <CardTitle>{formatLongDate(dates[0]).split(',')[1]?.trim() || 'Month'}</CardTitle>
        <CalendarGrid
          dates={dates}
          getDay={getDay}
          selectedDate={selectedDate}
          onDayPress={(date) => setSelectedDate(date === selectedDate ? null : date)}
        />
        <View style={styles.legend}>
          <LegendItem color={STATUS_META.PRESENT.color} label="Present" />
          <LegendItem color={STATUS_META.WORK_FROM_HOME.color} label="Work from home" />
          <LegendItem color={STATUS_META.ABSENT.color} label="Absent" />
          {Object.entries(EVENT_SOURCE).map(([key, meta]) => (
            <LegendItem key={key} color={meta.color} label={meta.label} />
          ))}
          <LegendItem hollow label="Nothing marked" />
        </View>
      </Card>

      {selectedDate ? (
        <Card>
          <CardTitle>{formatLongDate(selectedDate)}</CardTitle>
          <View style={styles.attendanceBlock}>
            <AttendanceDayDetail date={selectedDate} detail={attendanceDetails[selectedDate]} />
          </View>

          {dayEvents.length === 0 ? (
            <Text style={styles.empty}>Nothing scheduled.</Text>
          ) : (
            dayEvents.map((event, index) => {
              const meta = EVENT_SOURCE[event.source] || {
                label: 'Event',
                color: PALETTE.primary,
              };
              return (
                <View key={`${event.id}-${index}`} style={styles.eventRow}>
                  <View style={[styles.eventBar, { backgroundColor: meta.color }]} />
                  <View style={styles.eventText}>
                    <Text style={[styles.eventSource, { color: meta.color }]}>{meta.label}</Text>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    {event.description ? (
                      <Text style={styles.eventDesc} numberOfLines={3}>
                        {event.description}
                      </Text>
                    ) : null}
                    {!event.allDay ? (
                      <Text style={styles.eventTime}>
                        {prettyTime(event.startDateTime)}
                        {event.endDateTime ? ` – ${prettyTime(event.endDateTime)}` : ''}
                      </Text>
                    ) : (
                      <Text style={styles.eventTime}>All day</Text>
                    )}
                  </View>
                  {event.bannerImageUrl ? (
                    <Pressable
                      onPress={() => Linking.openURL(encodeURI(event.bannerImageUrl)).catch(() => {})}
                      hitSlop={6}
                      style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel="Open event banner"
                    >
                      <Ionicons name="image-outline" size={18} color={PALETTE.primaryDark} />
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          )}
        </Card>
      ) : eventList.length === 0 && !eventsLoading ? (
        <EmptyState
          icon="calendar-outline"
          title="Nothing this month"
          message="School events, holidays and your approved leave will appear here."
        />
      ) : (
        <Text style={styles.hint}>Tap a day to see what is on it.</Text>
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
    paddingVertical: 11,
    alignItems: 'center',
  },
  summaryValue: { fontSize: TYPE.headline, fontWeight: '800', color: SLATE[800] },
  summaryLabel: {
    fontSize: TYPE.micro,
    fontWeight: '600',
    color: SLATE[500],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 2,
  },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1 },
  legendText: { fontSize: TYPE.caption, color: SLATE[500], fontWeight: '600' },

  attendanceBlock: { marginBottom: SPACING.md },
  empty: { fontSize: TYPE.label, color: SLATE[500], fontStyle: 'italic' },

  eventRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  eventBar: { width: 3, borderRadius: 2 },
  eventText: { flex: 1 },
  eventSource: { fontSize: TYPE.micro, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  eventTitle: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800], marginTop: 1 },
  eventDesc: { fontSize: TYPE.label, color: SLATE[600], marginTop: 2, lineHeight: leading(TYPE.label) },
  eventTime: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 2, fontWeight: '600' },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLATE[50],
  },

  hint: { fontSize: TYPE.label, color: SLATE[500], textAlign: 'center', marginTop: SPACING.md },
  pressed: { opacity: 0.72 },
}));
