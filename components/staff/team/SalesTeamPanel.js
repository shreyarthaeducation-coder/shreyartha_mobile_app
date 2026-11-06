import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE } from '../../../constants/theme';
import { EmptyState, FormSheet, ScreenScaffold, Select, StatusChip, useToast } from '../../ui';
import { usePalette } from '../../ui/PaletteContext';
import useStaffResource from '../../../hooks/useStaffResource';
import { staffApi } from '../../../services/staffApi';
import FieldsSheet from '../../portal/FieldsSheet';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * My Team → Sales team (6 Nov 2026) — the website's StaffSalesTeam, for a manager with sales
 * employees under them: the month at a glance, approving or rejecting their submitted sales,
 * verifying each month's incentive before HQ pays it, and a rep's work with moving their leads and
 * schools to a teammate. `/api/staff/sales-team/**` answers only for the caller's own reports.
 */

const T = '/api/staff/sales-team';
const inr = (v) => (v === null || v === undefined || v === '' ? '—' : `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`);
const date = (v) => (v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const time = (v) => (v ? new Date(v).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '');
const DAY = {
  NOT_STARTED: { label: 'Not started', tone: 'neutral' },
  STARTED: { label: 'Working', tone: 'success' },
  ENDED: { label: 'Day ended', tone: 'info' },
};

function recentMonths(now = new Date()) {
  const out = [];
  for (let i = 0; i < 6; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) });
  }
  return out;
}

function Button({ label, icon, onPress, tone = 'ghost' }) {
  const styles = useStyles();
  const palette = usePalette();
  const solid = tone === 'primary';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, solid ? { backgroundColor: palette.primary, borderColor: palette.primary } : { borderColor: palette.primary }, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      {icon ? <Ionicons name={icon} size={15} color={solid ? palette.onPrimary : palette.primaryDark} /> : null}
      <Text style={[styles.buttonText, { color: solid ? palette.onPrimary : palette.primaryDark }]}>{label}</Text>
    </Pressable>
  );
}

function RepSheet({ rep, month, onClose, onChanged }) {
  const styles = useStyles();
  const fetcher = useCallback((signal) => staffApi.get(`${T}/reps/${rep.salesUserId}`, { params: { month }, signal }), [rep, month]);
  const { data: d, loading, reload } = useStaffResource(fetcher, { initialData: null });
  const [moving, setMoving] = useState(null); // { kind: 'lead'|'school', item }
  const teammates = (d?.teammates || []).map((t) => ({ value: String(t.salesUserId), label: t.fullName }));
  const schools = useMemo(() => {
    const map = new Map();
    (d?.leads || []).forEach((l) => {
      if (l.schoolId == null) return;
      if (!map.has(l.schoolId)) map.set(l.schoolId, { schoolId: l.schoolId, schoolName: l.schoolName, leads: 0 });
      map.get(l.schoolId).leads += 1;
    });
    return [...map.values()];
  }, [d]);

  return (
    <FormSheet visible title={`${rep.fullName} — ${month}`} onClose={onClose} fullHeight>
      {loading || !d ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : (
        <View>
          <Text style={styles.section}>Schools ({schools.length})</Text>
          {schools.length === 0 ? <Text style={styles.muted}>No school.</Text> : null}
          {schools.map((s) => (
            <View key={s.schoolId} style={styles.line}>
              <View style={styles.lineText}>
                <Text style={styles.name}>{s.schoolName}</Text>
                <Text style={styles.muted}>{s.leads} lead(s)</Text>
              </View>
              {teammates.length ? <Button label="Move" icon="swap-horizontal-outline" onPress={() => setMoving({ kind: 'school', item: s })} /> : null}
            </View>
          ))}
          <Text style={styles.section}>Leads ({(d.leads || []).length})</Text>
          {(d.leads || []).length === 0 ? <Text style={styles.muted}>No lead.</Text> : null}
          {(d.leads || []).map((l) => (
            <View key={l.id} style={styles.line}>
              <View style={styles.lineText}>
                <Text style={styles.name}>{l.schoolName}</Text>
                <Text style={styles.muted}>
                  {[l.city, l.pincode, l.stage && String(l.stage).replace(/_/g, ' ').toLowerCase(), l.nextFollowUpDate && `follow up ${date(l.nextFollowUpDate)}`].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {teammates.length ? <Button label="Move" icon="swap-horizontal-outline" onPress={() => setMoving({ kind: 'lead', item: l })} /> : null}
            </View>
          ))}
          <Text style={styles.section}>Visits ({(d.visits || []).length})</Text>
          {(d.visits || []).length === 0 ? <Text style={styles.muted}>No visit this month.</Text> : null}
          {(d.visits || []).map((v) => (
            <View key={v.id} style={styles.line}>
              <View style={styles.lineText}>
                <Text style={styles.name}>
                  {date(v.visitDate || v.checkInAt)} {v.checkInAt ? `· ${time(v.checkInAt)}` : ''}
                </Text>
                <Text style={styles.muted}>{[v.resolvedAddress, v.distanceFromLeadKm != null ? `${v.distanceFromLeadKm} km from the lead` : ''].filter(Boolean).join(' · ')}</Text>
                {v.remarks ? <Text style={styles.muted}>{v.remarks}</Text> : null}
              </View>
              {v.geoFlagged ? <StatusChip label="Location check" tone="warning" /> : null}
            </View>
          ))}
        </View>
      )}
      <FieldsSheet
        visible={!!moving}
        title={moving ? `Move ${moving.kind === 'lead' ? 'lead' : 'school'} — ${moving.item.schoolName}` : ''}
        submitLabel="Move"
        fields={[{ key: 'to', label: 'Move to', type: 'select', options: teammates, required: true }]}
        onSubmit={async (v) => {
          const to = Number(v.to);
          if (moving.kind === 'lead') await staffApi.post(`${T}/leads/${moving.item.id}/reassign`, { toSalesUserId: to });
          else await staffApi.post(`${T}/schools/${moving.item.schoolId}/reassign`, { fromSalesUserId: rep.salesUserId, toSalesUserId: to });
          const name = teammates.find((t) => t.value === String(to))?.label;
          setMoving(null);
          onChanged(`${moving.item.schoolName} moved to ${name}.`);
          reload();
        }}
        onClose={() => setMoving(null)}
      />
    </FormSheet>
  );
}

export default function SalesTeamPanel() {
  const styles = useStyles();
  const palette = usePalette();
  const { toast, showToast } = useToast();
  const months = useMemo(() => recentMonths(), []);
  const [month, setMonth] = useState(months[0].value);
  const [rep, setRep] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const fetcher = useCallback((signal) => staffApi.get(`${T}/overview`, { params: { month }, signal }), [month]);
  const { data, loading, error, reload, refreshing, refresh } = useStaffResource(fetcher, { initialData: null });
  const t = data?.totals || {};

  const act = async (fn, message) => {
    try {
      await fn();
      showToast(message, 'success');
      reload();
    } catch (e) {
      showToast(e?.message || 'That did not work.', 'error');
    }
  };

  return (
    <ScreenScaffold embedded loading={loading} error={error} onRetry={reload} refreshing={refreshing} onRefresh={refresh} toast={toast}>
      <Select variant="chip" label="Month" value={month} onChange={setMonth} options={months} />
      <View style={styles.grid}>
        {[
          ['Sales employees', t.reps ?? 0],
          ['Visits', t.visits ?? 0],
          ['New leads', t.newLeads ?? 0],
          ['Sales awaiting approval', t.dealsSubmitted ?? 0],
          ['Fully paid sales', inr(t.eligibleInr)],
          ['Team incentive', inr(t.incentiveInr)],
        ].map(([label, value]) => (
          <View key={label} style={[styles.tile, { borderTopColor: palette.primary }]}>
            <Text style={styles.tileLabel}>{label}</Text>
            <Text style={[styles.tileValue, { color: palette.primaryDark }]}>{String(value)}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.section}>Team · {data?.monthLabel || ''}</Text>
      {(data?.reps || []).length === 0 ? <EmptyState title="No sales employee reports to you" /> : null}
      {(data?.reps || []).map((r) => {
        const day = DAY[r.today?.state] || DAY.NOT_STARTED;
        return (
          <View key={r.salesUserId} style={styles.card}>
            <View style={styles.head}>
              <View style={styles.lineText}>
                <Text style={styles.name}>{r.fullName}</Text>
                <Text style={styles.muted}>{r.designation || r.email}</Text>
              </View>
              <StatusChip label={`${day.label}${r.today?.startedAt ? ` · ${time(r.today.startedAt)}` : ''}`} tone={day.tone} />
            </View>
            <Text style={styles.muted}>
              Visits {r.visits} · New leads {r.newLeads} · Awaiting approval {r.dealsSubmitted}
            </Text>
            <Text style={styles.muted}>
              Fully paid {inr(r.eligibleInr)} · Incentive {inr(r.incentiveInr)} ({Number(r.currentRatePercent || 0)}% slab)
            </Text>
            <View style={styles.actions}>
              <Button label="View work" icon="eye-outline" onPress={() => setRep(r)} />
            </View>
          </View>
        );
      })}

      <Text style={styles.section}>Sales to approve ({(data?.dealsToApprove || []).length})</Text>
      {(data?.dealsToApprove || []).length === 0 ? <Text style={styles.muted}>No sale from your team is waiting for approval.</Text> : null}
      {(data?.dealsToApprove || []).map((d) => (
        <View key={d.id} style={styles.card}>
          <Text style={styles.name}>
            #{d.id} · {d.schoolName}
          </Text>
          <Text style={styles.muted}>
            {d.employeeName} · Base {inr(d.baseAmountInr)} · Total {inr(d.totalAmountInr)} · {date(d.createdAt)}
          </Text>
          <View style={styles.actions}>
            <Button tone="primary" label="Approve" icon="checkmark-circle-outline" onPress={() => act(() => staffApi.post(`${T}/deals/${d.id}/approve`, {}), `Sale #${d.id} approved.`)} />
            <Button label="Reject" icon="close-circle-outline" onPress={() => setRejecting(d)} />
          </View>
        </View>
      ))}

      <Text style={styles.section}>Incentives to verify ({(data?.incentivesToVerify || []).length})</Text>
      <Text style={styles.muted}>Check the month's fully paid sales, then verify. HQ approves and pays only what you have verified.</Text>
      {(data?.incentivesToVerify || []).map((l) => (
        <View key={l.id} style={styles.card}>
          <Text style={styles.name}>
            {l.employeeName} · {l.periodLabel}
          </Text>
          <Text style={styles.muted}>
            Collected {inr(l.cumulativeCollectedInr)} · Incentive {inr(l.commissionInr)}
          </Text>
          {l.note ? <Text style={styles.muted}>{l.note}</Text> : null}
          <View style={styles.actions}>
            <Button
              tone="primary"
              label="Verify"
              icon="shield-checkmark-outline"
              onPress={() => act(() => staffApi.post(`${T}/incentives/${l.id}/verify`, {}), `${l.employeeName}'s incentive for ${l.periodLabel} verified.`)}
            />
          </View>
        </View>
      ))}

      <FieldsSheet
        visible={!!rejecting}
        title={rejecting ? `Reject sale #${rejecting.id}` : ''}
        submitLabel="Reject"
        fields={[{ key: 'reason', label: 'Reason (the employee sees this)', type: 'multiline', required: true }]}
        onSubmit={async (v) => {
          const d = rejecting;
          await staffApi.post(`${T}/deals/${d.id}/reject`, { reason: v.reason.trim() });
          setRejecting(null);
          showToast(`Sale #${d.id} rejected.`, 'success');
          reload();
        }}
        onClose={() => setRejecting(null)}
      />
      {rep ? (
        <RepSheet
          rep={rep}
          month={month}
          onClose={() => setRep(null)}
          onChanged={(message) => {
            showToast(message, 'success');
            reload();
          }}
        />
      ) : null}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginVertical: SPACING.md },
  tile: { flexBasis: '47%', flexGrow: 1, backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1, borderColor: SLATE[200], borderTopWidth: 3, padding: SPACING.sm },
  tileLabel: { fontSize: TYPE.caption, fontWeight: '700', color: SLATE[600] },
  tileValue: { fontSize: TYPE.heading, fontWeight: '800', marginTop: 2 },
  section: { fontSize: TYPE.label, fontWeight: '800', color: SLATE[500], textTransform: 'uppercase', letterSpacing: 0.5, marginTop: SPACING.md, marginBottom: SPACING.sm },
  card: { backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1, borderColor: SLATE[200], padding: SPACING.md, marginBottom: SPACING.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 4 },
  name: { fontSize: TYPE.body, fontWeight: '800', color: SLATE[900] },
  muted: { fontSize: TYPE.caption, color: SLATE[600], marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
  button: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  buttonText: { fontSize: TYPE.label, fontWeight: '800' },
  pressed: { opacity: 0.85 },
  line: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: SLATE[100] },
  lineText: { flex: 1 },
}));
