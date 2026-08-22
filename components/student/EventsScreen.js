import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, QUIZ, SLATE, SPACING, TYPE } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import { CalendarGrid, EmptyState, MonthNavigator } from '../ui';
import StudentScaffold from './StudentScaffold';
import { StudentCard, StudentCardTitle } from './StudentCard';
import {
  eventId,
  eventTitle,
  fetchAttendanceForMonth,
  fetchEventsForMonth,
  fetchNotifications,
  groupEventsByDate,
  isHoliday,
} from '../../services/student/eventsService';
import { formatLongDate, isSunday, todayIso } from '../../utils/dates';

/**
 * Events & Info — the month calendar with events, holidays and the student's own attendance.
 *
 * THE ENDPOINT SPELLINGS DIFFER WITHIN THIS ONE SCREEN, and that is not a mistake:
 * `/api/students/events/calendar` is plural, `/api/student/attendance/calendar` is singular. See
 * services/student/eventsService.js. This screen is where that trap bites first.
 *
 * The web caches events per month and re-renders from cache while refetching, so stepping through
 * months never blanks. Kept — on mobile a blank frame per month step is much worse than on desktop.
 */

const ATTENDANCE_TINT = {
  PRESENT: { bg: QUIZ.correctBg, color: FEEDBACK.successOnBg },
  ABSENT: { bg: QUIZ.wrongBg, color: FEEDBACK.errorOnBg },
  LATE: { bg: FEEDBACK.warningBg, color: FEEDBACK.warningOnBg },
};

/** Every day of a month as ISO strings — CalendarGrid is driven by a date list, not a cursor. */
function monthDates(year, month) {
  const total = new Date(year, month, 0).getDate(); // month is 1-based; day 0 = last of prev
  const mm = String(month).padStart(2, '0');
  return Array.from({ length: total }, (_, i) => `${year}-${mm}-${String(i + 1).padStart(2, '0')}`);
}

export default function EventsScreen() {
  const styles = useStyles();
  const palette = usePalette();

  const now = new Date();
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [selectedDate, setSelectedDate] = useState(todayIso);

  const [events, setEvents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [counselling, setCounselling] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Month -> events. Survives navigation within the screen so stepping back is instant.
  const cache = useRef(new Map());

  const load = useCallback(async () => {
    const key = `${period.year}-${period.month}`;
    const cached = cache.current.get(key);
    if (cached) {
      setEvents(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const list = await fetchEventsForMonth(period);
      cache.current.set(key, list);
      setEvents(list);
    } catch (e) {
      // Only surface an error when there is nothing to show; a stale month beats an error page.
      if (!cached) setError(e?.message || 'Could not load events for this month.');
    } finally {
      setLoading(false);
    }

    // Attendance is a best-effort overlay — a free student has none, and that is not a failure.
    try {
      const att = await fetchAttendanceForMonth(period);
      setAttendance(att.classAttendance);
      setCounselling(att.counselling);
    } catch {
      setAttendance({});
      setCounselling({});
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetchNotifications()
      .then(setNotifications)
      .catch(() => setNotifications([]));
  }, []);

  const byDate = useMemo(() => groupEventsByDate(events), [events]);
  const dates = useMemo(() => monthDates(period.year, period.month), [period]);

  const getDay = useCallback(
    (date) => {
      const status = String(attendance[date] || '').toUpperCase();
      const tint = ATTENDANCE_TINT[status];
      const dayEvents = byDate[date] || [];
      const holiday = dayEvents.some(isHoliday);
      return {
        bg: tint?.bg || (isSunday(date) ? SLATE[100] : undefined),
        color: tint?.color,
        dot: dayEvents.length ? (holiday ? '#ef4444' : palette.primaryDark) : undefined,
        bold: date === todayIso(),
        accessibilityLabel: `${formatLongDate(date)}${status ? `, ${status.toLowerCase()}` : ''}${
          dayEvents.length ? `, ${dayEvents.length} event(s)` : ''
        }`,
      };
    },
    [attendance, byDate, palette.primaryDark],
  );

  const dayEvents = selectedDate ? byDate[selectedDate] || [] : [];
  const dayCounselling = selectedDate ? counselling[selectedDate] : null;

  return (
    <StudentScaffold title="Events & Info" loading={loading && !events.length} error={error} onRetry={load}>
      {notifications.length > 0 ? (
        <StudentCard style={styles.notice}>
          <View style={styles.noticeTop}>
            <Ionicons name="notifications" size={16} color={palette.deep} />
            <Text style={styles.noticeTitle}>
              {notifications.length === 1 ? 'Notification' : `${notifications.length} notifications`}
            </Text>
          </View>
          {notifications.slice(0, 3).map((n, i) => (
            <Text key={n.id ?? i} style={styles.noticeText} numberOfLines={3}>
              {n.title ? `${n.title} — ` : ''}
              {n.message || n.body || ''}
            </Text>
          ))}
        </StudentCard>
      ) : null}

      <StudentCard>
        <MonthNavigator
          year={period.year}
          month={period.month}
          onChange={(next) => {
            setPeriod(next);
            setSelectedDate(null);
          }}
        />
        <CalendarGrid
          dates={dates}
          getDay={getDay}
          selectedDate={selectedDate}
          onDayPress={(date) => setSelectedDate(date === selectedDate ? null : date)}
        />

        <View style={styles.legend}>
          <LegendDot color={FEEDBACK.successText} label="Present" styles={styles} />
          <LegendDot color={FEEDBACK.errorText} label="Absent" styles={styles} />
          <LegendDot color={palette.primaryDark} label="Event" styles={styles} />
          <LegendDot color="#ef4444" label="Holiday" styles={styles} />
        </View>
      </StudentCard>

      {selectedDate ? (
        <StudentCard>
          <StudentCardTitle>{formatLongDate(selectedDate)}</StudentCardTitle>

          {dayCounselling ? (
            <View style={styles.counselling}>
              <Ionicons name="chatbubbles-outline" size={14} color={palette.deep} />
              <Text style={styles.counsellingText}>Counselling session: {dayCounselling}</Text>
            </View>
          ) : null}

          {dayEvents.length === 0 ? (
            <Text style={styles.none}>Nothing scheduled for this day.</Text>
          ) : (
            dayEvents.map((event, i) => (
              <View key={eventId(event, i)} style={styles.event}>
                <View
                  style={[styles.eventBar, { backgroundColor: isHoliday(event) ? '#ef4444' : palette.primary }]}
                />
                <View style={styles.eventText}>
                  <Text style={styles.eventTitle}>{eventTitle(event)}</Text>
                  {event.description ? (
                    <Text style={styles.eventDesc} numberOfLines={3}>
                      {event.description}
                    </Text>
                  ) : null}
                  {isHoliday(event) ? <Text style={styles.holidayTag}>Holiday</Text> : null}
                </View>
              </View>
            ))
          )}
        </StudentCard>
      ) : (
        <EmptyState
          icon="calendar-outline"
          title="Pick a day"
          message="Tap a date to see what is happening."
        />
      )}

      {loading && events.length > 0 ? (
        <ActivityIndicator size="small" color={palette.primary} style={styles.inlineLoader} />
      ) : null}
    </StudentScaffold>
  );
}

function LegendDot({ color, label, styles }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((p) => ({
  notice: { borderColor: p.primary },
  noticeTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  noticeTitle: { fontSize: TYPE.label, fontWeight: '700', color: p.deep },
  noticeText: { fontSize: TYPE.body, lineHeight: 19, color: SLATE[700], marginTop: 2 },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginTop: SPACING.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: TYPE.caption, color: SLATE[500], fontWeight: '600' },

  counselling: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: p.tint,
    marginBottom: SPACING.sm,
  },
  counsellingText: { flex: 1, fontSize: TYPE.label, fontWeight: '600', color: p.deep },

  none: { fontSize: TYPE.body, color: SLATE[500], fontStyle: 'italic' },
  event: { flexDirection: 'row', gap: SPACING.sm, paddingVertical: 9 },
  eventBar: { width: 3, borderRadius: 2 },
  eventText: { flex: 1 },
  eventTitle: { fontSize: TYPE.heading, fontWeight: '600', color: SLATE[800] },
  eventDesc: { fontSize: TYPE.label, lineHeight: 18, color: SLATE[600], marginTop: 2 },
  holidayTag: { fontSize: TYPE.caption, fontWeight: '700', color: FEEDBACK.errorOnBg, marginTop: 3 },

  inlineLoader: { marginVertical: SPACING.md },
}));
