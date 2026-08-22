import { useCallback, useMemo, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { FEEDBACK, SLATE, SPACING } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { CalendarGrid, Card, EmptyState, MonthNavigator, ScreenScaffold, StatusChip } from '../ui';
import useStaffResource from '../../hooks/useStaffResource';
import { parentApi } from '../../services/parentApi';
import {
  EVENT_COLORS,
  HOLIDAY_COLOR,
  fetchAttendanceMap,
  fetchMonthEvents,
  groupEventsByDate,
  isHolidayEvent,
  summariseAttendance,
} from '../../services/parent/calendarService';
import { formatLongDate, formatLongDateTime, isSunday } from '../../utils/dates';
import { makeStyles } from '../../utils/makeStyles';

/**
 * ONE SCREEN FOR BOTH "Attendance" AND "Schedule".
 *
 * The web has two pages that are ~70% the same code with accidental differences — Schedule lacks
 * the month picker, the event badges and the holiday styling that Attendance has, and pulls every
 * event ever instead of the month's. Rather than port that split, both tabs render this component
 * and differ only in title and emphasis: `mode="attendance"` leads with the presence summary,
 * `mode="schedule"` leads with the event feed.
 *
 * The web puts up to two text badges in each 50px cell, which is unreadable on a phone. Here a
 * cell carries the attendance tint plus up to three event dots, and tapping a day filters the feed
 * below — the same pattern MyCalendarScreen already uses for staff.
 */

const ATTENDANCE_TINT = {
  PRESENT: { bg: FEEDBACK.successBg, color: FEEDBACK.successText },
  ABSENT: { bg: FEEDBACK.errorBg, color: FEEDBACK.errorText },
};

const BASE_URL = 'https://shreyartha.com';

/** Banner paths may be absolute or server-relative; S3 stores them unencoded. */
const bannerUri = (event) => {
  const path = event?.bannerImageUrl || event?.bannerImagePath;
  if (!path) return '';
  return encodeURI(path.startsWith('http') ? path : `${BASE_URL}${path}`);
};

export default function ParentCalendarScreen({ mode = 'attendance' }) {
  const styles = useStyles();
  const palette = usePalette();
  const now = new Date();
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [selectedDate, setSelectedDate] = useState(null);

  const fetcher = useCallback(
    (signal) =>
      parentApi.settleAll({
        events: fetchMonthEvents(period, signal),
        // Already swallows its own failures — a non-school child has no attendance at all.
        attendance: fetchAttendanceMap(period, signal),
      }),
    [period],
  );
  const { data, loading, error, refreshing, reload, refresh } = useStaffResource(fetcher, {
    initialData: null,
  });

  const events = data?.events?.data || [];
  const attendance = data?.attendance?.data || {};
  const eventsError = data?.events?.error;

  const byDate = useMemo(() => groupEventsByDate(events), [events]);
  const summary = useMemo(() => summariseAttendance(attendance), [attendance]);

  const dates = useMemo(() => {
    const days = new Date(period.year, period.month, 0).getDate();
    const pad = (n) => String(n).padStart(2, '0');
    return Array.from(
      { length: days },
      (_, i) => `${period.year}-${pad(period.month)}-${pad(i + 1)}`,
    );
  }, [period]);

  const changePeriod = (next) => {
    setPeriod(next);
    setSelectedDate(null);
  };

  const getDay = useCallback(
    (date) => {
      const status = attendance[date];
      const tint = ATTENDANCE_TINT[status];
      const dayEvents = byDate[date] || [];
      return {
        bg: tint?.bg || (isSunday(date) ? SLATE[100] : undefined),
        color: tint?.color,
        dots: dayEvents
          .slice(0, 3)
          .map((event, i) => (isHolidayEvent(event) ? HOLIDAY_COLOR : EVENT_COLORS[i % EVENT_COLORS.length])),
      };
    },
    [attendance, byDate],
  );

  // Tapping a day filters the feed; tapping it again clears the filter.
  const feed = selectedDate ? byDate[selectedDate] || [] : events;

  return (
    <ScreenScaffold
      title={mode === 'schedule' ? 'Schedule' : 'Attendance'}
      fallbackRoute="/parent"
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      <MonthNavigator year={period.year} month={period.month} onChange={changePeriod} />

      {mode === 'attendance' ? (
        <Card style={styles.summary}>
          {summary.marked === 0 ? (
            // Every day of the month is a key with a null value when unmarked, so count VALUES.
            // The web's key-count guard makes it claim "0 recorded" on a month with data.
            <Text style={styles.summaryEmpty}>No attendance recorded this month.</Text>
          ) : (
            <View style={styles.summaryRow}>
              <View style={styles.summaryCell}>
                <Text style={[styles.summaryValue, { color: FEEDBACK.successText }]}>
                  {summary.present}
                </Text>
                <Text style={styles.summaryLabel}>Present</Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={[styles.summaryValue, { color: FEEDBACK.errorText }]}>
                  {summary.absent}
                </Text>
                <Text style={styles.summaryLabel}>Absent</Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryValue}>{summary.marked}</Text>
                <Text style={styles.summaryLabel}>Recorded</Text>
              </View>
            </View>
          )}
        </Card>
      ) : null}

      <CalendarGrid
        dates={dates}
        getDay={getDay}
        selectedDate={selectedDate}
        onDayPress={(date) => setSelectedDate(date === selectedDate ? null : date)}
        style={styles.grid}
      />

      <View style={styles.legend}>
        <Legend color={FEEDBACK.successText} label="Present" />
        <Legend color={FEEDBACK.errorText} label="Absent" />
        <Legend color={HOLIDAY_COLOR} label="Holiday" />
        <Legend color={EVENT_COLORS[0]} label="Event" />
      </View>

      <Text style={styles.feedTitle}>
        {selectedDate ? formatLongDate(selectedDate) : 'This month'}
      </Text>

      {eventsError ? (
        <Text style={styles.error}>Could not load events for this month.</Text>
      ) : feed.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title="Nothing scheduled"
          message={
            selectedDate ? 'No events on this day.' : 'No events or holidays this month.'
          }
        />
      ) : (
        feed.map((event, index) => {
          const banner = bannerUri(event);
          const holiday = isHolidayEvent(event);
          return (
            <Card key={`${event.id || event.title}-${index}`} style={styles.item}>
              {banner ? (
                <Image source={{ uri: banner }} style={styles.banner} resizeMode="cover" />
              ) : null}
              <View style={styles.itemHead}>
                <Text style={styles.itemTitle} numberOfLines={2}>
                  {event.title}
                </Text>
                <StatusChip
                  label={holiday ? 'National Holiday' : 'School Event'}
                  tone={holiday ? 'warning' : 'info'}
                />
              </View>
              {event.description ? (
                <Text style={styles.itemText} numberOfLines={4}>
                  {event.description}
                </Text>
              ) : null}
              <Text style={styles.when}>
                {formatLongDateTime(event.startDateTime)}
                {event.endDateTime ? ` → ${formatLongDateTime(event.endDateTime)}` : ''}
              </Text>
              {event.targetClasses ? (
                <View style={styles.classRow}>
                  {String(event.targetClasses)
                    .split(',')
                    .map((cls) => cls.trim())
                    .filter(Boolean)
                    .map((cls) => (
                      <StatusChip key={cls} label={cls} tone="neutral" />
                    ))}
                </View>
              ) : null}
            </Card>
          );
        })
      )}
    </ScreenScaffold>
  );
}

function Legend({ color, label }) {
  const styles = useStyles();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  summary: { marginTop: SPACING.sm },
  summaryRow: { flexDirection: 'row' },
  summaryCell: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 20, fontWeight: '800', color: SLATE[800] },
  summaryLabel: { fontSize: 11.5, color: SLATE[500], fontWeight: '600', marginTop: 2 },
  summaryEmpty: { fontSize: 13, color: SLATE[400], textAlign: 'center' },
  grid: { marginTop: SPACING.sm },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: SPACING.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: 11.5, color: SLATE[500], fontWeight: '600' },
  feedTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: SLATE[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  item: { marginBottom: SPACING.sm },
  banner: { width: '100%', height: 120, borderRadius: 10, marginBottom: SPACING.sm },
  itemHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  itemTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: SLATE[800] },
  itemText: { fontSize: 13, color: SLATE[500], lineHeight: 19, marginTop: 5 },
  when: { fontSize: 12.5, color: SLATE[600], fontWeight: '600', marginTop: 8 },
  classRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  error: { fontSize: 13, color: FEEDBACK.errorText, marginTop: SPACING.sm },
}));
