import { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { FEEDBACK, SLATE, SPACING } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import {
  Card,
  EmptyState,
  MonthNavigator,
  ScreenScaffold,
  SegmentedTabs,
  Select,
  StatusChip,
} from '../../ui';
import { ProgressBar } from '../../ui/charts';
import useStaffResource from '../../../hooks/useStaffResource';
import {
  ATTENDANCE_ROLES,
  fetchStaffAttendanceCalendar,
  fetchStaffSessions,
  formatDuration,
  formatLocation,
  roleLabel,
  summarise,
} from '../../../services/admin/adminAttendanceService';
import { formatLongDateTime } from '../../../utils/dates';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * Staff Attendance — the school-wide view of who logged in, when, and from where.
 *
 * READ-ONLY, matching the web. Its settings panel and click-to-toggle override sit behind a flag
 * that compares `schoolUserType` to "ROLE_SCHOOL_ADMIN", a value that string never holds, so
 * nobody can reach them there either. See adminAttendanceService's header.
 *
 * The web renders a 31-column grid with three sticky columns — unusable on a phone — so the
 * Summary tab is one card per staff member with a present/absent bar, and Sessions is a list.
 */

const TABS = [
  { value: 'summary', label: 'Summary', icon: 'stats-chart-outline' },
  { value: 'sessions', label: 'Sessions', icon: 'list-outline' },
];

function SessionCard({ record }) {
  const styles = useStyles();
  return (
    <Card style={styles.item}>
      <View style={styles.head}>
        <Text style={styles.name} numberOfLines={1}>
          {record.name || '—'}
        </Text>
        <StatusChip
          label={record.status === 'INCOMPLETE' ? 'No logout' : record.status || '—'}
          tone={record.status === 'PRESENT' ? 'success' : 'warning'}
        />
      </View>
      <Text style={styles.sub} numberOfLines={1}>
        {roleLabel(record.role)}
        {record.email ? ` · ${record.email}` : ''}
      </Text>

      <View style={styles.timeRow}>
        <View style={styles.timeCol}>
          <Text style={styles.timeLabel}>In</Text>
          <Text style={styles.timeValue}>
            {record.loginAt ? formatLongDateTime(record.loginAt) : '—'}
          </Text>
          <Text style={styles.locationText}>{formatLocation(record.loginLocation)}</Text>
        </View>
        <View style={styles.timeCol}>
          <Text style={styles.timeLabel}>Out</Text>
          <Text style={styles.timeValue}>
            {record.logoutAt ? formatLongDateTime(record.logoutAt) : '—'}
          </Text>
          <Text style={styles.locationText}>{formatLocation(record.logoutLocation)}</Text>
        </View>
      </View>

      <Text style={styles.duration}>Duration: {formatDuration(record)}</Text>
    </Card>
  );
}

export default function StaffAttendanceScreen({ homeRoute, apiBase }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const now = new Date();
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [role, setRole] = useState('ALL');
  const [tab, setTab] = useState('summary');

  const query = useMemo(
    () => ({ year: period.year, month: period.month, role }),
    [period.year, period.month, role],
  );

  const calendarFetcher = useCallback(
    (signal) => fetchStaffAttendanceCalendar(apiBase, query, signal),
    [apiBase, query],
  );
  const {
    data: calendar,
    loading,
    error,
    refreshing,
    reload,
    refresh,
  } = useStaffResource(calendarFetcher, { initialData: null });

  const sessionsFetcher = useCallback(
    (signal) => fetchStaffSessions(apiBase, query, signal),
    [apiBase, query],
  );
  // Only fetched when its tab is open — a month of sessions for a whole school is a big payload.
  const { data: sessions, error: sessionsError } = useStaffResource(sessionsFetcher, {
    enabled: tab === 'sessions',
    initialData: [],
  });

  const dates = calendar?.dates || [];
  const staff = calendar?.staff || [];
  const sessionRows = sessions || [];

  return (
    <ScreenScaffold
      title="Staff Attendance"
      fallbackRoute={homeRoute}
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      <MonthNavigator
        year={period.year}
        month={period.month}
        onChange={setPeriod}
        yearOptions={[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]}
      />
      <View style={styles.filter}>
        <Select
          variant="chip"
          label="Role"
          value={role}
          onChange={setRole}
          options={ATTENDANCE_ROLES}
        />
      </View>

      <SegmentedTabs options={TABS} value={tab} onChange={setTab} style={styles.tabs} />

      {tab === 'summary' ? (
        staff.length === 0 ? (
          <EmptyState
            icon="timer-outline"
            title="No attendance yet"
            message="Nobody has logged in during this month."
          />
        ) : (
          staff.map((member) => {
            const totals = summarise(member, dates);
            return (
              <Card key={member.id} style={styles.item}>
                <View style={styles.head}>
                  <Text style={styles.name} numberOfLines={1}>
                    {member.name}
                  </Text>
                  <StatusChip label={roleLabel(member.role)} tone="info" />
                </View>
                <ProgressBar
                  value={totals.percent}
                  color={PALETTE.primary}
                  label={`${totals.percent}% present`}
                  showValue={false}
                />
                <View style={styles.countRow}>
                  <Text style={[styles.count, { color: FEEDBACK.successText }]}>
                    {totals.present} present
                  </Text>
                  <Text style={[styles.count, { color: FEEDBACK.errorText }]}>
                    {totals.absent} absent
                  </Text>
                  {/* Every day of the month is a key; unmarked days are neither. */}
                  <Text style={styles.count}>
                    {Math.max(dates.length - totals.present - totals.absent, 0)} no record
                  </Text>
                </View>
              </Card>
            );
          })
        )
      ) : sessionsError ? (
        <Text style={styles.error}>Could not load staff attendance sessions.</Text>
      ) : sessionRows.length === 0 ? (
        <EmptyState
          icon="list-outline"
          title="No sessions"
          message="No login sessions were recorded in this month."
        />
      ) : (
        sessionRows.map((record, index) => (
          <SessionCard key={`${record.email}-${record.loginAt}-${index}`} record={record} />
        ))
      )}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  filter: { flexDirection: 'row', marginTop: SPACING.sm },
  tabs: { marginTop: SPACING.sm, marginBottom: SPACING.sm },
  item: { marginBottom: SPACING.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  name: { flex: 1, fontSize: 15, fontWeight: '700', color: SLATE[800] },
  sub: { fontSize: 12, color: SLATE[500], marginTop: -4, marginBottom: 6 },
  countRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  count: { fontSize: 12, fontWeight: '700', color: SLATE[500] },
  timeRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: 4 },
  timeCol: { flex: 1 },
  timeLabel: { fontSize: 11, fontWeight: '800', color: SLATE[400], letterSpacing: 0.4 },
  timeValue: { fontSize: 12.5, color: SLATE[800], fontWeight: '600', marginTop: 2 },
  locationText: { fontSize: 11.5, color: SLATE[500], marginTop: 2 },
  duration: { fontSize: 12.5, color: SLATE[600], fontWeight: '700', marginTop: 8 },
  error: { fontSize: 13, color: FEEDBACK.errorText, marginTop: SPACING.sm },
}));
