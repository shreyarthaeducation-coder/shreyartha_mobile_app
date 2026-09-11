import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE, leading } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import {
  Card,
  DateTimeField,
  EmptyState,
  FormSheet,
  MonthNavigator,
  ScreenScaffold,
  SegmentedTabs,
  Select,
  StatusChip,
  TextField,
  useToast,
} from '../../ui';
import useStaffResource from '../../../hooks/useStaffResource';
import {
  DURATION_OPTIONS,
  MEETING_STATUS,
  NEXT_MEETING_STATUSES,
  createMeeting,
  fetchMeetingCalendar,
  fetchMeetingStaff,
  fetchMeetings,
  monthBounds,
  notifyAttendees,
  updateMeetingStatus,
} from '../../../services/admin/meetingService';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * Live Meeting — Google Meet sessions with STAFF attendees.
 *
 * The sibling of Live Classes, not a variant of it: there is no school or class scope (the school
 * comes from the token) and attendees are picked from the school's staff list.
 *
 * A meeting created while GOOGLE_CALENDAR_ENABLED is off saves with a NULL Meet link and the flow
 * still succeeds — so the success message never promises a link, and a missing one is not an error.
 */

const TABS = [
  { value: 'meetings', label: 'Meetings', icon: 'list-outline' },
  { value: 'calendar', label: 'Calendar', icon: 'calendar-outline' },
];

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  ...Object.entries(MEETING_STATUS).map(([value, meta]) => ({ value, label: meta.label })),
];

const EMPTY_FORM = { title: '', when: '', durationMinutes: '60' };

/**
 * @param {object} props
 * @param {number} [props.bottomInset] extra scroll padding. This screen is a TAB ROOT on the
 *   Principal panel — the only staff footer with a fourth tab — and `PortalTabBar` is
 *   `position: absolute`, so without this its last meeting card sits underneath the bar. Zero for
 *   every other role, which reaches this screen by pushing rather than as a root.
 */
export default function StaffMeetingScreen({ homeRoute, apiBase, bottomInset = 0 }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const { toast, showToast } = useToast();

  const [tab, setTab] = useState('meetings');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const now = new Date();
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [picked, setPicked] = useState([]);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const query = useMemo(() => ({ page, status }), [page, status]);
  const listFetcher = useCallback(
    (signal) => fetchMeetings(apiBase, query, signal),
    [apiBase, query],
  );
  const { data, loading, error, refreshing, reload, refresh, revalidate } = useStaffResource(
    listFetcher,
    { enabled: tab === 'meetings', initialData: { items: [], total: 0 } },
  );

  const bounds = useMemo(() => monthBounds(period.year, period.month), [period]);
  const calendarFetcher = useCallback(
    (signal) => fetchMeetingCalendar(apiBase, bounds, signal),
    [apiBase, bounds],
  );
  const { data: calendar, loading: calendarLoading } = useStaffResource(calendarFetcher, {
    enabled: tab === 'calendar',
    initialData: null,
  });

  // Only fetched when the create sheet is open — this is a whole-school staff list.
  const staffFetcher = useCallback((signal) => fetchMeetingStaff(apiBase, signal), [apiBase]);
  const { data: staff, loading: staffLoading } = useStaffResource(staffFetcher, {
    enabled: sheetOpen,
    initialData: [],
  });

  const meetings = data?.items || [];
  const total = data?.total || 0;
  const staffRows = staff || [];
  const days = calendar?.calendar || [];

  const toggleStaff = (id) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));

  const submit = async () => {
    if (!form.title.trim()) {
      showToast('Title is required.', 'error');
      return;
    }
    if (!form.when) {
      showToast('Pick a date and time.', 'error');
      return;
    }
    if (picked.length === 0) {
      showToast('Select at least one staff member.', 'error');
      return;
    }
    setSaving(true);
    try {
      const [meetingDate, clock] = form.when.split('T');
      await createMeeting(apiBase, {
        title: form.title,
        meetingDate,
        // The API takes HH:mm; DateTimeField emits seconds too.
        meetingTime: (clock || '').slice(0, 5),
        durationMinutes: form.durationMinutes,
        attendeeIds: picked,
      });
      // Deliberately does not claim a Meet link was generated — it is null when Calendar is off.
      showToast('Meeting created.', 'success');
      setSheetOpen(false);
      setForm(EMPTY_FORM);
      setPicked([]);
      await revalidate();
    } catch (e) {
      showToast(e?.message || 'Failed to create the meeting.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (meeting, next) => {
    setBusyId(meeting.meetingId);
    try {
      await updateMeetingStatus(apiBase, meeting.meetingId, next);
      await revalidate();
    } catch (e) {
      showToast(e?.message || 'Status update failed.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const notify = async (meeting) => {
    setBusyId(meeting.meetingId);
    try {
      const res = await notifyAttendees(apiBase, meeting.meetingId);
      showToast(
        `Sent ${res?.emailsSent ?? 0} emails and ${res?.whatsappSent ?? 0} WhatsApp messages.`,
        'success',
      );
    } catch (e) {
      showToast(e?.message || 'Notification failed.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const lastPage = Math.max(Math.ceil(total / 10) - 1, 0);

  return (
    <ScreenScaffold
      title="Live Meeting"
      fallbackRoute={homeRoute}
      loading={tab === 'meetings' && loading}
      error={tab === 'meetings' ? error : ''}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
      toast={toast}
      contentStyle={bottomInset ? { paddingBottom: bottomInset } : undefined}
    >
      <SegmentedTabs options={TABS} value={tab} onChange={setTab} style={styles.tabs} />

      {tab === 'meetings' ? (
        <View>
          <View style={styles.filter}>
            <Select
              variant="chip"
              label="Status"
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(0);
              }}
              options={STATUS_FILTERS}
            />
          </View>

          {meetings.length === 0 ? (
            <EmptyState
              icon="videocam-outline"
              title="No meetings"
              message="Schedule a meeting to bring your staff together on Google Meet."
              actionLabel="Schedule a meeting"
              onAction={() => setSheetOpen(true)}
            />
          ) : (
            meetings.map((meeting) => {
              const meta = MEETING_STATUS[meeting.status] || {
                label: meeting.status,
                tone: 'neutral',
              };
              const nextOptions = NEXT_MEETING_STATUSES[meeting.status] || [];
              return (
                <Card key={meeting.meetingId} style={styles.item}>
                  <View style={styles.head}>
                    <Text style={styles.title} numberOfLines={2}>
                      {meeting.title}
                    </Text>
                    <StatusChip label={meta.label} tone={meta.tone} />
                  </View>
                  <Text style={styles.when}>
                    {meeting.meetingDate} · {meeting.meetingTime} · {meeting.durationMinutes} min
                  </Text>
                  <Text style={styles.attendees}>
                    {meeting.attendees?.length || 0} staff invited
                  </Text>

                  {meeting.googleMeetLink ? (
                    <Pressable
                      onPress={() => Linking.openURL(meeting.googleMeetLink)}
                      style={({ pressed }) => [
                        styles.joinBtn,
                        { backgroundColor: PALETTE.primary },
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="link"
                    >
                      <Ionicons name="videocam" size={18} color="#ffffff" />
                      <Text style={styles.joinText}>Join Google Meet</Text>
                    </Pressable>
                  ) : (
                    // Null link means Calendar was off when this was created — not a failure.
                    <Text style={styles.noLink}>No Meet link was generated for this meeting.</Text>
                  )}

                  <View style={styles.actionRow}>
                    {nextOptions.map((next) => (
                      <Pressable
                        key={next}
                        onPress={() => changeStatus(meeting, next)}
                        disabled={busyId === meeting.meetingId}
                        style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
                        accessibilityRole="button"
                      >
                        <Text style={styles.ghostText}>
                          Mark {MEETING_STATUS[next]?.label || next}
                        </Text>
                      </Pressable>
                    ))}
                    <Pressable
                      onPress={() => notify(meeting)}
                      disabled={busyId === meeting.meetingId}
                      style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
                      accessibilityRole="button"
                    >
                      <Text style={styles.ghostText}>Notify</Text>
                    </Pressable>
                  </View>
                </Card>
              );
            })
          )}

          {total > 10 ? (
            <View style={styles.pager}>
              <Pressable
                onPress={() => setPage((p) => Math.max(p - 1, 0))}
                disabled={page === 0}
                style={({ pressed }) => [styles.pagerBtn, (pressed || page === 0) && styles.pressed]}
                accessibilityRole="button"
              >
                <Ionicons name="chevron-back" size={20} color={SLATE[600]} />
              </Pressable>
              <Text style={styles.pagerText}>
                Page {page + 1} of {lastPage + 1}
              </Text>
              <Pressable
                onPress={() => setPage((p) => Math.min(p + 1, lastPage))}
                disabled={page >= lastPage}
                style={({ pressed }) => [
                  styles.pagerBtn,
                  (pressed || page >= lastPage) && styles.pressed,
                ]}
                accessibilityRole="button"
              >
                <Ionicons name="chevron-forward" size={20} color={SLATE[600]} />
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : (
        <View>
          <MonthNavigator year={period.year} month={period.month} onChange={setPeriod} />
          {calendarLoading ? (
            <ActivityIndicator style={styles.spinner} color={PALETTE.primary} />
          ) : days.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              title="Nothing this month"
              message="No meetings are scheduled in this month."
            />
          ) : (
            // Days with no meetings are omitted by the endpoint, so this is a list, not a grid.
            days.map((day) => (
              <Card key={day.date} style={styles.item}>
                <Text style={styles.dayDate}>{day.date}</Text>
                {(day.meetings || []).map((entry) => {
                  const meta = MEETING_STATUS[entry.status] || {
                    label: entry.status,
                    tone: 'neutral',
                  };
                  return (
                    <View key={entry.meetingId} style={styles.dayRow}>
                      <Text style={styles.dayText} numberOfLines={1}>
                        {entry.time} · {entry.title}
                      </Text>
                      <StatusChip label={meta.label} tone={meta.tone} />
                    </View>
                  );
                })}
              </Card>
            ))
          )}
        </View>
      )}

      {tab === 'meetings' && meetings.length > 0 ? (
        <Pressable
          onPress={() => setSheetOpen(true)}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: PALETTE.primary },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Schedule a meeting"
        >
          <Ionicons name="add" size={26} color="#ffffff" />
        </Pressable>
      ) : null}

      <FormSheet
        visible={sheetOpen}
        title="Schedule a meeting"
        onClose={() => setSheetOpen(false)}
        onSubmit={submit}
        submitLabel="Schedule"
        submitting={saving}
        fullHeight
      >
        <TextField
          label="Title"
          required
          value={form.title}
          onChangeText={(title) => setForm((prev) => ({ ...prev, title }))}
          placeholder="e.g. Monthly staff review"
        />
        {/* ONE picker, split on the way out. DateTimeField always emits a full
            `yyyy-MM-ddTHH:mm:ss` string whatever its mode, but the API takes `meetingDate` and
            `meetingTime` as two fields — so the split happens here rather than asking for the
            same instant twice. */}
        <DateTimeField
          label="When"
          value={form.when}
          onChange={(when) => setForm((prev) => ({ ...prev, when }))}
        />
        <Select
          label="Duration"
          value={form.durationMinutes}
          onChange={(durationMinutes) => setForm((prev) => ({ ...prev, durationMinutes }))}
          options={DURATION_OPTIONS.map((value) => ({
            value: String(value),
            label: `${value} minutes`,
          }))}
        />

        <View style={styles.attendeeHead}>
          <Text style={styles.groupLabel}>Attendees ({picked.length})</Text>
          {staffRows.length ? (
            <Pressable
              onPress={() =>
                setPicked(
                  picked.length === staffRows.length ? [] : staffRows.map((s) => s.staffId),
                )
              }
              style={({ pressed }) => [pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={[styles.selectAll, { color: PALETTE.primaryDark }]}>
                {picked.length === staffRows.length ? 'Clear all' : 'Select all'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {staffLoading ? (
          <ActivityIndicator style={styles.spinner} color={PALETTE.primary} />
        ) : staffRows.length === 0 ? (
          <Text style={styles.hint}>No other verified staff members were found.</Text>
        ) : (
          staffRows.map((member) => {
            const selected = picked.includes(member.staffId);
            return (
              <Pressable
                key={member.staffId}
                onPress={() => toggleStaff(member.staffId)}
                style={({ pressed }) => [styles.staffRow, pressed && styles.pressed]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
              >
                <Ionicons
                  name={selected ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={selected ? PALETTE.primary : SLATE[300]}
                />
                <Text style={styles.staffName} numberOfLines={1}>
                  {member.staffName}
                </Text>
                {member.userType ? <StatusChip label={member.userType} tone="neutral" /> : null}
              </Pressable>
            );
          })
        )}

        <Text style={styles.hint}>
          A Google Meet link is generated automatically when the school&apos;s calendar integration
          is switched on.
        </Text>
      </FormSheet>
    </ScreenScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  tabs: { marginBottom: SPACING.sm },
  filter: { flexDirection: 'row', marginBottom: SPACING.sm },
  item: { marginBottom: SPACING.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  when: { fontSize: TYPE.label, color: SLATE[600], fontWeight: '600', marginTop: 5 },
  attendees: { fontSize: TYPE.label, color: SLATE[500], marginTop: 2 },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 9,
    paddingVertical: 9,
    marginTop: SPACING.sm,
  },
  joinText: { color: '#ffffff', fontWeight: '700', fontSize: TYPE.heading },
  noLink: { fontSize: TYPE.label, color: SLATE[500], fontStyle: 'italic', marginTop: SPACING.sm },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: SPACING.sm },
  ghostBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: SLATE[200],
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  ghostText: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[600] },
  pressed: { opacity: 0.7 },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  pagerBtn: { padding: 6 },
  pagerText: { fontSize: TYPE.label, color: SLATE[500], fontWeight: '700' },
  dayDate: { fontSize: TYPE.heading, fontWeight: '800', color: p.primaryDark },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  dayText: { flex: 1, fontSize: TYPE.label, color: SLATE[700] },
  attendeeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
  },
  groupLabel: { fontSize: TYPE.label, fontWeight: '800', color: p.primaryDark },
  selectAll: { fontSize: TYPE.label, fontWeight: '700' },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: SLATE[100],
  },
  staffName: { flex: 1, fontSize: TYPE.heading, color: SLATE[700], fontWeight: '600' },
  spinner: { marginTop: SPACING.md },
  fab: {
    position: 'absolute',
    right: SPACING.md,
    bottom: SPACING.md,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  hint: { fontSize: TYPE.label, color: SLATE[500], lineHeight: leading(TYPE.label), marginTop: SPACING.sm },
}));
