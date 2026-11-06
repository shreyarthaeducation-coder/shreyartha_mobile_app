import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SLATE, SPACING, TYPE } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { staffApi } from '../../../services/staffApi';
import CrudListScreen from '../../portal/CrudListScreen';
import ParentTabsScreen from '../../parent/ParentTabsScreen';
import SalesTeamPanel from './SalesTeamPanel';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * My Team (5 Nov 2026) — the website's StaffMyTeam, for anyone who is someone's reporting manager:
 * the Manager login, and HR. Two tabs: the people who report to you (extend a probation before
 * its end date, read its history) and their leave waiting for you.
 *
 * `/api/staff/hr/my-team` answers only for the caller's own direct reports; the server decides who
 * may still be extended (`canExtendProbation`), so the button follows that and nothing else.
 */

const TEAM = '/api/staff/hr/my-team';

const EVENT_LABELS = {
  EXTENDED: 'Extended',
  CONFIRMED_AUTO: 'Confirmed automatically',
  CONFIRMED_MANUAL: 'Confirmed by HR',
  REMINDER_T14: 'Reminder — 14 days left',
  REMINDER_T7: 'Reminder — 7 days left',
  REMINDER_T1: 'Reminder — 1 day left',
  CONTRACT_REMINDER_T30: 'Contract ends in 30 days',
};

export const day = (v) => {
  if (!v) return '';
  const d = new Date(String(v).length <= 10 ? `${v}T00:00:00` : v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const days = (n) => (n == null ? '' : `${n} ${Number(n) === 1 ? 'day' : 'days'}`);

const MONTHS = [1, 2, 3, 4, 5, 6].map((m) => ({ value: String(m), label: `${m} ${m === 1 ? 'month' : 'months'}` }));

/** The probation's history, fetched when asked for — the website's History button. */
export function ProbationHistory({ load }) {
  const styles = useStyles();
  const palette = usePalette();
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');

  if (events === null) {
    return (
      <Pressable
        onPress={() => load().then((e) => setEvents(Array.isArray(e) ? e : [])).catch((e) => setError(e?.message || 'Could not load the history.'))}
        accessibilityRole="button"
        hitSlop={6}
      >
        <Text style={[styles.link, { color: palette.primaryDark }]}>{error || 'Show probation history'}</Text>
      </Pressable>
    );
  }
  if (!events.length) return <Text style={styles.muted}>No probation events yet.</Text>;
  return (
    <View style={styles.history}>
      {events.map((e) => (
        <View key={e.id} style={styles.event}>
          <Text style={styles.eventTitle}>
            {EVENT_LABELS[e.eventType] || e.eventType} · {day(e.createdAt)}
          </Text>
          <Text style={styles.muted}>
            {e.oldEndDate && e.eventType === 'EXTENDED' ? `${day(e.oldEndDate)} → ${day(e.newEndDate)}` : day(e.newEndDate)}
            {e.actorName ? ` · ${e.actorName}` : ''}
          </Text>
          {e.reason ? <Text style={styles.muted}>{e.reason}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function TeamPeople() {
  return (
    <CrudListScreen
      embedded
      load={() => staffApi.get(TEAM)}
      itemKey={(p) => p.schoolUserId}
      emptyTitle="Nobody reports to you yet"
      emptyMessage="HR sets reporting managers."
      describe={(p) => ({
        title: p.fullName,
        subtitle: p.designation || p.email,
        chips: [
          p.employmentTypeLabel ? { label: p.employmentTypeLabel, tone: 'info' } : null,
          p.pendingLeave ? { label: `${p.pendingLeave} leave pending`, tone: 'warning' } : null,
        ],
        meta: [
          ['Joined', day(p.dateOfJoining)],
          [
            'Probation ends',
            p.probationEndDate
              ? `${day(p.probationEndDate)} · ${p.probationDaysLeft > 0 ? `${days(p.probationDaysLeft)} left` : 'Due for confirmation'}`
              : '',
          ],
        ],
      })}
      renderExtra={(p) =>
        p.probationEndDate ? <ProbationHistory load={() => staffApi.get(`${TEAM}/${p.schoolUserId}/probation/history`)} /> : null
      }
      actions={[
        {
          key: 'extend',
          label: 'Extend probation',
          icon: 'time-outline',
          when: (p) => !!p.canExtendProbation,
          fields: [
            { key: 'extendByMonths', label: 'Extend by', type: 'select', options: MONTHS, default: '1' },
            { key: 'newEndDate', label: 'Or a new end date', type: 'date', helper: 'Leave empty to extend by the months above.' },
            {
              key: 'reason',
              label: 'Reason',
              type: 'multiline',
              required: true,
              placeholder: 'e.g. Needs more time to reach the field-visit targets agreed at joining',
            },
          ],
          run: (p, v) =>
            staffApi.post(
              `${TEAM}/${p.schoolUserId}/probation/extend`,
              v.newEndDate ? { newEndDate: v.newEndDate, reason: v.reason } : { extendByMonths: Number(v.extendByMonths || 1), reason: v.reason },
            ),
          done: 'Probation extended.',
        },
      ]}
    />
  );
}

/** A leave queue with Approve / Reject and the remarks the requester will see. */
export function LeaveQueue({ load, decide, emptyMessage }) {
  const decision = (action, label) => ({
    key: action.toLowerCase(),
    label,
    icon: action === 'APPROVE' ? 'checkmark-circle-outline' : 'close-circle-outline',
    when: (r) => r.status === 'PENDING',
    fields: [{ key: 'remarks', label: 'Remarks (they will see this)', type: 'multiline', required: action === 'REJECT' }],
    run: (r, v) => decide(r.id, action, v.remarks || ''),
    done: action === 'APPROVE' ? 'Approved.' : 'Rejected.',
  });
  return (
    <CrudListScreen
      embedded
      load={load}
      emptyTitle="Nothing waiting"
      emptyMessage={emptyMessage}
      describe={(r) => ({
        title: r.employeeName,
        subtitle: [r.leaveTypeName, r.paid === false ? 'Unpaid' : ''].filter(Boolean).join(' · '),
        chips: [{ label: r.status, tone: r.status === 'APPROVED' ? 'success' : r.status === 'REJECTED' ? 'error' : 'warning' }],
        meta: [
          ['From', day(r.startDate)],
          ['To', day(r.endDate)],
          ['Days', r.totalDays],
        ],
        body: r.reason,
      })}
      actions={[decision('APPROVE', 'Approve'), decision('REJECT', 'Reject')]}
    />
  );
}

export default function MyTeamScreen({ homeRoute }) {
  // The Sales team tab appears only for a manager with sales employees under them, as the website
  // decides it: `/api/staff/sales-team/summary` with salesReports > 0. Any failure hides it.
  const [salesTeam, setSalesTeam] = useState(false);
  useEffect(() => {
    let alive = true;
    staffApi
      .get('/api/staff/sales-team/summary')
      .then((s) => alive && setSalesTeam((s?.salesReports || 0) > 0))
      .catch(() => alive && setSalesTeam(false));
    return () => {
      alive = false;
    };
  }, []);
  return (
    <ParentTabsScreen
      title="My Team"
      fallbackRoute={homeRoute}
      tabs={[
        { value: 'people', label: 'My Team', render: () => <TeamPeople /> },
        {
          value: 'leave',
          label: 'Leave to approve',
          render: () => (
            <LeaveQueue
              load={() => staffApi.get(`${TEAM}/leave/requests`, { params: { status: 'PENDING' } })}
              decide={(id, action, remarks) => staffApi.post(`${TEAM}/leave/requests/${id}/decision`, { action, remarks })}
              emptyMessage="No leave requests from your team are waiting."
            />
          ),
        },
        // Last, so it never takes the first tab's place once the summary answers.
        ...(salesTeam ? [{ value: 'sales', label: 'Sales team', render: () => <SalesTeamPanel /> }] : []),
      ]}
    />
  );
}

const useStyles = makeStyles(() => ({
  link: { fontSize: TYPE.caption, fontWeight: '700', marginTop: SPACING.xs },
  muted: { fontSize: TYPE.caption, color: SLATE[600], marginTop: 2 },
  history: { marginTop: SPACING.sm, gap: SPACING.xs },
  event: { borderLeftWidth: 2, borderLeftColor: SLATE[200], paddingLeft: SPACING.sm },
  eventTitle: { fontSize: TYPE.caption, fontWeight: '700', color: SLATE[800] },
}));
