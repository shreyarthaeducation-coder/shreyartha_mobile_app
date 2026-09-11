import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SHADOWS, SLATE, SPACING, TYPE } from '../../constants/theme';
import { usePalette } from '../../components/ui/PaletteContext';
import {
  Card,
  CardTitle,
  DateTimeField,
  EmptyState,
  FormSheet,
  ScreenScaffold,
  SegmentedTabs,
  Select,
  useToast,
} from '../ui';
import useStaffResource from '../../hooks/useStaffResource';
import {
  DURATION_OPTIONS,
  NEXT_STATUSES,
  SESSION_PAGE_SIZE,
  SESSION_STATUS_META,
  createSession,
  fetchClassStudents,
  fetchLiveSchools,
  fetchSessionCalendar,
  fetchSessions,
  notifyStudents,
  updateSessionStatus,
} from '../../services/teacher/liveSessionService';
import { formatLongDate, parseIsoDate, todayIso } from '../../utils/dates';
import { makeStyles } from '../../utils/makeStyles';

/**
 * Native Live Classes — schedule and run Google Meet sessions for a class.
 *
 * School → class chips (there is no section tier; see liveSessionService), then three tabs:
 * Sessions, Create and Calendar.
 *
 * Two honesty fixes over the web, both noted where they apply: the success message no longer claims
 * a Meet link was generated when it may be null, and "today" for the date picker is computed in
 * local time rather than UTC.
 */


const TABS = [
  { value: 'sessions', label: 'Sessions', icon: 'list-outline' },
  { value: 'create', label: 'Create', icon: 'add-circle-outline' },
  { value: 'calendar', label: 'Calendar', icon: 'calendar-outline' },
];

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  ...Object.entries(SESSION_STATUS_META).map(([value, meta]) => ({ value, label: meta.label })),
];

/** "10:30:00" or "10:30" → "10:30 am". The calendar feed sends seconds, the list rows don't. */
const prettyTime = (value) => {
  if (!value) return '';
  const [h, m] = String(value).split(':');
  const hours = Number(h);
  if (Number.isNaN(hours)) return String(value);
  const suffix = hours >= 12 ? 'pm' : 'am';
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${m ?? '00'} ${suffix}`;
};

function StatusPill({ status }) {
  const styles = useStyles();
  const meta = SESSION_STATUS_META[status] || { label: status, color: SLATE[500] };
  return (
    <View style={[styles.pill, { backgroundColor: `${meta.color}22` }]}>
      <Text style={[styles.pillText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

export default function LiveClassesScreen({
  homeRoute = '/teacher',
  // The Shreyartha counsellor's "Live Counselling" is this same screen: identical session
  // endpoints, a different list of schools and a different label. Both default to Live Classes,
  // so the teacher and Portal-A counsellor call sites pass neither.
  title = 'Live Classes',
  createLabel = 'Schedule a live class',
  schoolsEndpoint,
}) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const [school, setSchool] = useState(null);
  const [klass, setKlass] = useState(null);
  const [tab, setTab] = useState('sessions');

  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [busySession, setBusySession] = useState(null);

  const [month, setMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [picked, setPicked] = useState(() => new Set());
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(null);

  const { toast, showToast } = useToast();

  // ── schools ───────────────────────────────────────────────────────────────
  const schoolsFetcher = useCallback(
    (signal) => fetchLiveSchools(signal, schoolsEndpoint),
    [schoolsEndpoint],
  );
  const { data: schools, loading: schoolsLoading, error: schoolsError, reload: reloadSchools } =
    useStaffResource(schoolsFetcher, { initialData: [] });

  const schoolList = schools || [];
  const classList = school?.classes || [];

  useEffect(() => {
    if (school || schoolList.length === 0) return;
    const first = schoolList[0];
    setSchool(first);
    setKlass(first.classes?.[0] || null);
  }, [schoolList, school]);

  const ready = !!(school?.schoolId && klass?.classId);

  // ── sessions ──────────────────────────────────────────────────────────────
  const sessionsFetcher = useCallback(
    (signal) =>
      fetchSessions(
        { schoolId: school.schoolId, classId: klass.classId, page, status: statusFilter },
        signal,
      ),
    [school?.schoolId, klass?.classId, page, statusFilter],
  );
  const {
    data: sessionPage,
    loading: sessionsLoading,
    error: sessionsError,
    refreshing,
    reload: reloadSessions,
    refresh: refreshSessions,
    revalidate: revalidateSessions,
  } = useStaffResource(sessionsFetcher, {
    enabled: ready && tab === 'sessions',
    initialData: { content: [], totalElements: 0 },
  });

  const sessions = sessionPage?.content || [];
  const totalPages = Math.ceil((sessionPage?.totalElements || 0) / SESSION_PAGE_SIZE);

  // ── students for the picker ───────────────────────────────────────────────
  const studentsFetcher = useCallback(
    (signal) => fetchClassStudents({ schoolId: school.schoolId, classId: klass.classId }, signal),
    [school?.schoolId, klass?.classId],
  );
  const { data: students, loading: studentsLoading } = useStaffResource(studentsFetcher, {
    enabled: ready && tab === 'create',
    initialData: [],
  });
  const roster = students || [];

  // ── calendar ──────────────────────────────────────────────────────────────
  const calendarFetcher = useCallback(
    (signal) => {
      const last = new Date(month.year, month.month, 0).getDate();
      const pad = (n) => String(n).padStart(2, '0');
      return fetchSessionCalendar(
        {
          schoolId: school.schoolId,
          from: `${month.year}-${pad(month.month)}-01`,
          to: `${month.year}-${pad(month.month)}-${pad(last)}`,
        },
        signal,
      );
    },
    [school?.schoolId, month.year, month.month],
  );
  const { data: calendarDays, loading: calendarLoading } = useStaffResource(calendarFetcher, {
    enabled: !!school?.schoolId && tab === 'calendar',
    initialData: [],
  });

  // ── actions ───────────────────────────────────────────────────────────────
  const changeStatus = async (session, status) => {
    setBusySession(session.sessionId);
    try {
      await updateSessionStatus(session.sessionId, status);
      showToast(`Marked ${SESSION_STATUS_META[status]?.label || status}.`, 'success');
      await revalidateSessions();
    } catch (e) {
      showToast(e?.message || 'Could not update the session.', 'error');
    } finally {
      setBusySession(null);
    }
  };

  const notify = async (session) => {
    setBusySession(session.sessionId);
    try {
      const res = await notifyStudents(session.sessionId);
      showToast(
        `Sent ${res?.emailsSent ?? 0} email(s) and ${res?.whatsappSent ?? 0} WhatsApp message(s).`,
        'success',
      );
    } catch (e) {
      showToast(e?.message || 'Could not send notifications.', 'error');
    } finally {
      setBusySession(null);
    }
  };

  const openCreate = () => {
    setCreated(null);
    setForm({ sessionDate: null, sessionTime: null, durationMinutes: 60 });
    setPicked(new Set());
    setSheetOpen(true);
  };

  const togglePicked = (studentId) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const submitCreate = async () => {
    if (!form?.sessionDate) {
      showToast('Pick a date for the session.', 'error');
      return;
    }
    if (!form?.sessionTime) {
      showToast('Pick a start time.', 'error');
      return;
    }
    if (picked.size === 0) {
      showToast('Select at least one student.', 'error');
      return;
    }

    setCreating(true);
    try {
      const session = await createSession(
        { schoolId: school.schoolId, classId: klass.classId },
        {
          // DateTimeField hands back a full LocalDateTime; these two fields want the halves.
          sessionDate: form.sessionDate.slice(0, 10),
          sessionTime: form.sessionTime.slice(11, 16),
          durationMinutes: Number(form.durationMinutes) || 60,
          selectedStudentIds: Array.from(picked),
        },
      );
      setCreated(session);
      setSheetOpen(false);
      // Deliberately NOT "Meet link generated" — createSession catches a Calendar failure and
      // saves with a null link, so the web's message can be a lie. The card below says which.
      showToast('Session created.', 'success');
      setTab('sessions');
      setPage(0);
      await revalidateSessions();
    } catch (e) {
      showToast(e?.message || 'Could not create the session.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const confirmJoin = (link) => {
    if (!link) {
      Alert.alert('No meeting link', 'This session has no Google Meet link yet.');
      return;
    }
    Linking.openURL(link).catch(() => showToast('Could not open the meeting link.', 'error'));
  };

  // ── renderers ─────────────────────────────────────────────────────────────
  const renderSession = ({ item }) => {
    const busy = busySession === item.sessionId;
    const transitions = NEXT_STATUSES[item.sessionStatus] || [];
    return (
      <Card>
        <View style={styles.sessionHead}>
          <View style={styles.sessionText}>
            <Text style={styles.sessionDate}>
              {formatLongDate(item.sessionDate)} · {prettyTime(item.sessionTime)}
            </Text>
            <Text style={styles.sessionMeta}>
              {item.durationMinutes || 60} min · {item.students?.length ?? 0} student
              {(item.students?.length ?? 0) === 1 ? '' : 's'}
              {item.sectionName ? ` · Section ${item.sectionName}` : ''}
            </Text>
          </View>
          <StatusPill status={item.sessionStatus} />
        </View>

        {item.googleMeetLink ? (
          <Pressable
            onPress={() => confirmJoin(item.googleMeetLink)}
            style={({ pressed }) => [styles.joinBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Ionicons name="videocam" size={18} color="#ffffff" />
            <Text style={styles.joinText}>Join Google Meet</Text>
          </Pressable>
        ) : (
          <Text style={styles.noLink}>
            No meeting link — the calendar service was unavailable when this was scheduled.
          </Text>
        )}

        {busy ? (
          <ActivityIndicator size="small" color={PALETTE.primary} style={styles.sessionBusy} />
        ) : (
          <View style={styles.sessionActions}>
            {transitions.map((next) => (
              <Pressable
                key={next}
                onPress={() => changeStatus(item, next)}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Text style={styles.actionText}>
                  Mark {SESSION_STATUS_META[next]?.label || next}
                </Text>
              </Pressable>
            ))}
            {item.googleMeetLink && item.sessionStatus !== 'CANCELLED' ? (
              <Pressable
                onPress={() => notify(item)}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Ionicons name="paper-plane-outline" size={16} color={PALETTE.primaryDark} />
                <Text style={styles.actionText}>Notify</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </Card>
    );
  };

  const renderBody = () => {
    if (!ready) {
      return (
        <View style={styles.fill}>
          <EmptyState
            icon="school-outline"
            title={schoolsError ? "Couldn't load your schools" : 'No class selected'}
            message={schoolsError || 'Choose a school and class to see its live sessions.'}
            actionLabel={schoolsError ? 'Try again' : undefined}
            onAction={schoolsError ? reloadSchools : undefined}
          />
        </View>
      );
    }

    if (tab === 'calendar') {
      if (calendarLoading) {
        return (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={PALETTE.primary} />
          </View>
        );
      }
      const days = calendarDays || [];
      if (days.length === 0) {
        return (
          <View style={styles.fill}>
            <EmptyState
              icon="calendar-outline"
              title="Nothing scheduled"
              message="No live sessions in this month for this school."
            />
          </View>
        );
      }
      return (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {days.map((day) => (
            <View key={day.date} style={styles.calendarDay}>
              <Text style={styles.calendarDate}>{formatLongDate(day.date)}</Text>
              {(day.sessions || []).map((s) => (
                <View key={s.sessionId} style={styles.calendarRow}>
                  <Text style={styles.calendarTime}>{prettyTime(s.time)}</Text>
                  <Text style={styles.calendarClass} numberOfLines={1}>
                    Class {s.className} · {s.studentCount} student
                    {s.studentCount === 1 ? '' : 's'}
                  </Text>
                  {/* Note: the calendar feed calls this `status`, the list rows `sessionStatus`. */}
                  <StatusPill status={s.status} />
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      );
    }

    if (tab === 'create') {
      return (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {created ? (
            <Card>
              <CardTitle>Last session created</CardTitle>
              <Text style={styles.sessionDate}>
                {formatLongDate(created.sessionDate)} · {prettyTime(created.sessionTime)}
              </Text>
              {created.googleMeetLink ? (
                <Pressable
                  onPress={() => confirmJoin(created.googleMeetLink)}
                  style={({ pressed }) => [styles.joinBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <Ionicons name="videocam" size={18} color="#ffffff" />
                  <Text style={styles.joinText}>Join Google Meet</Text>
                </Pressable>
              ) : (
                <Text style={styles.noLink}>
                  Scheduled, but no meeting link was returned. It will appear here if the calendar
                  service comes back.
                </Text>
              )}
            </Card>
          ) : null}

          <EmptyState
            icon="add-circle-outline"
            title={createLabel}
            message={`Pick a date, time and the students from Class ${klass.className}.`}
            actionLabel="New session"
            onAction={openCreate}
          />
        </ScrollView>
      );
    }

    if (sessionsLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PALETTE.primary} />
        </View>
      );
    }

    return (
      <FlatList
        style={styles.list}
        data={sessions}
        keyExtractor={(item) => String(item.sessionId)}
        renderItem={renderSession}
        contentContainerStyle={sessions.length ? styles.listContent : styles.listContentEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshSessions}
            tintColor={PALETTE.primary}
            colors={[PALETTE.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.fill}>
            <EmptyState
              icon="videocam-outline"
              title={sessionsError ? "Couldn't load sessions" : 'No sessions yet'}
              message={sessionsError || 'Create one from the Create tab.'}
              actionLabel={sessionsError ? 'Try again' : undefined}
              onAction={sessionsError ? reloadSessions : undefined}
            />
          </View>
        }
        ListFooterComponent={
          totalPages > 1 ? (
            <View style={styles.pager}>
              <Pressable
                onPress={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                style={({ pressed }) => [
                  styles.pagerBtn,
                  page === 0 && styles.pagerDisabled,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
              >
                <Ionicons name="chevron-back" size={18} color={SLATE[600]} />
              </Pressable>
              <Text style={styles.pagerText}>
                Page {page + 1} of {totalPages}
              </Text>
              <Pressable
                onPress={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                style={({ pressed }) => [
                  styles.pagerBtn,
                  page >= totalPages - 1 && styles.pagerDisabled,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
              >
                <Ionicons name="chevron-forward" size={18} color={SLATE[600]} />
              </Pressable>
            </View>
          ) : null
        }
      />
    );
  };

  return (
    <ScreenScaffold title={title} fallbackRoute={homeRoute} scroll={false} toast={toast}>
      <View style={styles.header}>
        {schoolsLoading ? (
          <ActivityIndicator size="small" color={PALETTE.primary} />
        ) : (
          <View style={styles.pickers}>
            {schoolList.length > 1 ? (
              <Select
                variant="chip"
                label="School"
                value={school?.schoolId}
                options={schoolList.map((s) => ({ value: s.schoolId, label: s.schoolName }))}
                onChange={(id) => {
                  const next = schoolList.find((s) => s.schoolId === id);
                  setSchool(next);
                  setKlass(next?.classes?.[0] || null);
                  setPage(0);
                }}
              />
            ) : null}
            <Select
              variant="chip"
              label="Class"
              placeholder="Class"
              value={klass?.classId}
              options={classList.map((c) => ({ value: c.classId, label: `Class ${c.className}` }))}
              onChange={(id) => {
                setKlass(classList.find((c) => c.classId === id) || null);
                setPage(0);
              }}
              disabled={!school}
            />
            {tab === 'sessions' ? (
              <Select
                variant="chip"
                label="Status"
                value={statusFilter}
                options={STATUS_FILTERS}
                onChange={(value) => {
                  setStatusFilter(value);
                  setPage(0);
                }}
              />
            ) : null}
          </View>
        )}

        <SegmentedTabs options={TABS} value={tab} onChange={setTab} />
      </View>

      {renderBody()}

      <FormSheet
        visible={sheetOpen}
        title={createLabel}
        subtitle={klass ? `Class ${klass.className} · ${school?.schoolName || ''}` : undefined}
        onClose={() => setSheetOpen(false)}
        onSubmit={submitCreate}
        submitting={creating}
        submitLabel="Schedule"
      >
        {form ? (
          <>
            <DateTimeField
              label="Date"
              mode="date"
              value={form.sessionDate}
              onChange={(sessionDate) => setForm((f) => ({ ...f, sessionDate }))}
              // Local-time today. The web uses toISOString(), which is UTC and lands on yesterday
              // for the first 5.5 hours of every IST day.
              minimumDate={parseIsoDate(todayIso())}
              placeholder="Choose a date"
            />
            <DateTimeField
              label="Start time"
              mode="time"
              value={form.sessionTime}
              onChange={(sessionTime) => setForm((f) => ({ ...f, sessionTime }))}
              placeholder="Choose a time"
            />
            <Select
              label="Duration"
              value={form.durationMinutes}
              options={DURATION_OPTIONS.map((m) => ({ value: m, label: `${m} minutes` }))}
              onChange={(durationMinutes) => setForm((f) => ({ ...f, durationMinutes }))}
            />

            <View style={styles.rosterHead}>
              <Text style={styles.rosterTitle}>Students ({picked.size} selected)</Text>
              <Pressable
                onPress={() =>
                  setPicked(
                    picked.size === roster.length
                      ? new Set()
                      : new Set(roster.map((s) => s.studentId)),
                  )
                }
                hitSlop={6}
                accessibilityRole="button"
              >
                <Text style={styles.rosterToggle}>
                  {picked.size === roster.length ? 'Clear all' : 'Select all'}
                </Text>
              </Pressable>
            </View>

            {studentsLoading ? (
              <ActivityIndicator size="small" color={PALETTE.primary} />
            ) : roster.length === 0 ? (
              <Text style={styles.rosterEmpty}>No students found for this class.</Text>
            ) : (
              <>
                {roster.map((student) => {
                  const on = picked.has(student.studentId);
                  return (
                    <Pressable
                      key={student.studentId}
                      onPress={() => togglePicked(student.studentId)}
                      style={({ pressed }) => [styles.rosterRow, pressed && styles.pressed]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                    >
                      <Ionicons
                        name={on ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={on ? PALETTE.primaryDark : SLATE[400]}
                      />
                      <Text style={styles.rosterName} numberOfLines={1}>
                        {student.studentName}
                      </Text>
                      {student.section ? (
                        <Text style={styles.rosterSection}>{student.section}</Text>
                      ) : null}
                    </Pressable>
                  );
                })}
                {roster.length >= 200 ? (
                  <Text style={styles.rosterEmpty}>
                    Showing the first 200 students — this endpoint returns a single page.
                  </Text>
                ) : null}
              </>
            )}
          </>
        ) : null}
      </FormSheet>
    </ScreenScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: SLATE[200],
    gap: SPACING.sm,
  },
  pickers: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },

  list: { flex: 1 },
  fill: { flex: 1, justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  listContentEmpty: { flexGrow: 1, justifyContent: 'center' },

  sessionHead: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  sessionText: { flex: 1 },
  sessionDate: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  sessionMeta: { fontSize: TYPE.label, color: SLATE[500], marginTop: 2 },
  sessionBusy: { marginTop: SPACING.sm },
  sessionActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACING.sm },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: SLATE[50],
  },
  actionText: { fontSize: TYPE.label, fontWeight: '700', color: p.primaryDark },

  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: SPACING.sm,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: p.primaryDark,
  },
  joinText: { fontSize: TYPE.heading, fontWeight: '700', color: '#ffffff' },
  noLink: { fontSize: TYPE.label, color: SLATE[500], fontStyle: 'italic', marginTop: SPACING.sm },

  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: TYPE.caption, fontWeight: '800' },

  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
  },
  pagerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLATE[100],
  },
  pagerDisabled: { opacity: 0.4 },
  pagerText: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[600] },

  calendarDay: { marginBottom: SPACING.md },
  calendarDate: {
    fontSize: TYPE.label,
    fontWeight: '800',
    color: SLATE[500],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  calendarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    ...SHADOWS.sm,
  },
  calendarTime: { fontSize: TYPE.body, fontWeight: '800', color: p.primaryDark, minWidth: 70 },
  calendarClass: { flex: 1, fontSize: TYPE.body, color: SLATE[700] },

  rosterHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    marginBottom: 6,
  },
  rosterTitle: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[700] },
  rosterToggle: { fontSize: TYPE.label, fontWeight: '700', color: p.primaryDark },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: SLATE[100],
  },
  rosterName: { flex: 1, fontSize: TYPE.body, color: SLATE[800] },
  rosterSection: { fontSize: TYPE.caption, color: SLATE[500], fontWeight: '600' },
  rosterEmpty: { fontSize: TYPE.label, color: SLATE[500], fontStyle: 'italic', paddingVertical: 8 },

  pressed: { opacity: 0.72 },
}));
