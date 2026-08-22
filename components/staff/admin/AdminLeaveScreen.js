import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import {
  Card,
  EmptyState,
  FormSheet,
  ScreenScaffold,
  SegmentedTabs,
  Select,
  StatusChip,
  useToast,
} from '../../ui';
import { makeStyles } from '../../../utils/makeStyles';
import {
  currentLeaveYear,
  dayLabel,
  formatDays,
  formatShortDate,
  recentLeaveYears,
} from '../../../utils/currency';
import {
  adjustBalance,
  decideLeave,
  fetchAllBalances,
  fetchLeaveRequests,
  fetchLeaveTypes,
} from '../../../services/admin/hrAdminService';

/**
 * Leave Management — the APPROVER side.
 *
 * Ports School/Admin/pages/AdminLeaveManagement.js: the pending queue, full history, every staff
 * member's balances, and the school's leave policy.
 *
 * ── NOT THE SAME SCREEN AS components/staff/LeaveScreen.js ───────────────────
 * That one is `/api/staff/hr` — MY leave, MY balances, and applying. This one is
 * `/api/school-admin/hr` — EVERYONE's. The two namespaces share verb names and differ only in the
 * prefix, so confusing them shows a principal their own leave on a screen labelled "Pending
 * Approval", with no error to give it away.
 *
 * ── WHO SEES IT ─────────────────────────────────────────────────────────────
 * Principal and Vice Principal. `SchoolAdminHrController` is
 * `hasAnyRole('SCHOOL_ADMIN','VICE_PRINCIPAL')` and `PRINCIPAL implies SCHOOL_ADMIN`, so both are
 * authorised; the website mounts this on neither dashboard, which is the gap being closed.
 *
 * The leave year runs **1 April to 31 March** and unused leave lapses at the boundary — it is never
 * a calendar year. `currentLeaveYear()` in utils/currency encodes that.
 */

const TABS = [
  { key: 'pending', label: 'Pending Approval' },
  { key: 'all', label: 'All Requests' },
  { key: 'balances', label: 'Staff Balances' },
  { key: 'policy', label: 'Leave Policy' },
];

const STATUS_TONE = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  WITHDRAWN: 'neutral',
};

function RequestCard({ request, showActions, onDecide, styles }) {
  const half = (flag) => (flag ? ' (half)' : '');
  return (
    <Card style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.cardHeadText}>
          <Text style={styles.name}>{request.employeeName || '—'}</Text>
          <Text style={styles.sub}>{request.employeeEmail || ''}</Text>
        </View>
        <StatusChip label={request.status} tone={STATUS_TONE[request.status] || 'neutral'} />
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.meta}>{request.userType || '—'}</Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.meta}>{request.leaveTypeName || '—'}</Text>
        {/* `paid` false is the exception and the web flags it, so flag it here too. */}
        {request.paid === false ? (
          <>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.unpaid}>Unpaid</Text>
          </>
        ) : null}
      </View>

      <Text style={styles.dates}>
        {formatShortDate(request.startDate)}
        {half(request.halfDayStart)} → {formatShortDate(request.endDate)}
        {half(request.halfDayEnd)}
        {'  ·  '}
        {formatDays(request.totalDays)} {dayLabel(request.totalDays)}
      </Text>

      {request.reason ? <Text style={styles.reason}>{request.reason}</Text> : null}
      {request.contactDuringLeave ? (
        <Text style={styles.sub}>Contact: {request.contactDuringLeave}</Text>
      ) : null}
      {request.decidedByName ? (
        <Text style={styles.sub}>Decided by {request.decidedByName}</Text>
      ) : null}
      {request.decisionRemarks ? (
        <Text style={styles.sub}>“{request.decisionRemarks}”</Text>
      ) : null}

      {showActions ? (
        <View style={styles.actions}>
          <Pressable
            onPress={() => onDecide(request, 'APPROVE')}
            style={({ pressed }) => [styles.approve, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Approve leave for ${request.employeeName}`}
          >
            <Ionicons name="checkmark" size={15} color="#ffffff" />
            <Text style={styles.actionText}>Approve</Text>
          </Pressable>
          <Pressable
            onPress={() => onDecide(request, 'REJECT')}
            style={({ pressed }) => [styles.reject, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Reject leave for ${request.employeeName}`}
          >
            <Ionicons name="close" size={15} color="#ffffff" />
            <Text style={styles.actionText}>Reject</Text>
          </Pressable>
        </View>
      ) : null}
    </Card>
  );
}

function BalanceCard({ row, onAdjust, styles }) {
  return (
    <Card style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.cardHeadText}>
          <Text style={styles.name}>{row.fullName || '—'}</Text>
          <Text style={styles.sub}>
            {[row.userType, row.email].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Pressable
          onPress={() => onAdjust(row)}
          hitSlop={8}
          style={({ pressed }) => [styles.adjustBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Adjust balance for ${row.fullName}`}
        >
          <Ionicons name="create-outline" size={17} color={SLATE[600]} />
        </Pressable>
      </View>

      {(row.balances || []).map((b) => (
        <View key={b.leaveTypeCode || b.leaveTypeName} style={styles.balanceRow}>
          <Text style={styles.balanceName}>{b.leaveTypeName}</Text>
          <Text style={styles.balanceValue}>
            {b.unlimited ? '—' : `${formatDays(b.available)} left`}
          </Text>
        </View>
      ))}
    </Card>
  );
}

export default function AdminLeaveScreen({ homeRoute = '/staff/principal' }) {
  const styles = useStyles();
  const palette = usePalette();
  const { toast, showToast } = useToast();

  const [tab, setTab] = useState('pending');
  const [leaveYear, setLeaveYear] = useState(currentLeaveYear());
  const [requests, setRequests] = useState([]);
  const [balances, setBalances] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [deciding, setDeciding] = useState(null); // { request, action }
  const [remarks, setRemarks] = useState('');
  const [adjusting, setAdjusting] = useState(null); // a balance row
  const [adjustForm, setAdjustForm] = useState({ leaveTypeCode: '', days: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [sheetError, setSheetError] = useState('');

  const years = useMemo(() => recentLeaveYears(4).map((y) => ({ value: y, label: y })), []);

  const load = useCallback(
    async (isRefresh) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        if (tab === 'pending' || tab === 'all') {
          // 'ALL' is a literal sentinel — the controller defaults an omitted status to PENDING, so
          // the All tab must say so explicitly. See services/admin/hrAdminService.
          const data = await fetchLeaveRequests(tab === 'pending' ? 'PENDING' : 'ALL');
          setRequests(Array.isArray(data) ? data : []);
        } else if (tab === 'balances') {
          const data = await fetchAllBalances(leaveYear);
          setBalances(Array.isArray(data) ? data : []);
        } else {
          const data = await fetchLeaveTypes();
          setTypes(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        setError(e?.message || 'Could not load leave data.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [tab, leaveYear],
  );

  useEffect(() => {
    load();
  }, [load]);

  const openDecision = (request, action) => {
    setRemarks('');
    setSheetError('');
    setDeciding({ request, action });
  };

  const submitDecision = async () => {
    if (!deciding) return;
    setSaving(true);
    setSheetError('');
    try {
      await decideLeave(deciding.request.id, deciding.action, remarks.trim());
      const verb = deciding.action === 'APPROVE' ? 'approved' : 'rejected';
      setDeciding(null);
      showToast(`Leave ${verb}.`);
      load();
    } catch (e) {
      // Shown inside the sheet: the toast renders behind the modal while it is open.
      setSheetError(e?.message || 'Could not record the decision.');
    } finally {
      setSaving(false);
    }
  };

  const openAdjust = (row) => {
    setAdjustForm({
      leaveTypeCode: row.balances?.[0]?.leaveTypeCode || '',
      days: '',
      reason: '',
    });
    setSheetError('');
    setAdjusting(row);
  };

  const submitAdjust = async () => {
    if (!adjusting) return;
    const days = Number(adjustForm.days);
    if (!adjustForm.leaveTypeCode) {
      setSheetError('Pick a leave type.');
      return;
    }
    if (!Number.isFinite(days) || days === 0) {
      setSheetError('Enter a number of days — negative to debit.');
      return;
    }
    setSaving(true);
    setSheetError('');
    try {
      await adjustBalance(adjusting.schoolUserId, {
        leaveTypeCode: adjustForm.leaveTypeCode,
        days,
        reason: adjustForm.reason.trim(),
      });
      setAdjusting(null);
      showToast('Balance adjusted.');
      load();
    } catch (e) {
      setSheetError(e?.message || 'Could not adjust the balance.');
    } finally {
      setSaving(false);
    }
  };

  const pendingSuffix = tab === 'pending' && requests.length ? ` (${requests.length})` : '';
  const tabOptions = TABS.map((t) => ({
    value: t.key,
    label: t.key === 'pending' ? `${t.label}${pendingSuffix}` : t.label,
  }));

  const adjustTypeOptions = (adjusting?.balances || []).map((b) => ({
    value: b.leaveTypeCode,
    label: b.leaveTypeName,
  }));

  let body;
  if (tab === 'policy') {
    body = types.length ? (
      types.map((t) => (
        <Card key={t.code || t.name} style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.cardHeadText}>
              <Text style={styles.name}>{t.name}</Text>
              <Text style={styles.sub}>{t.code}</Text>
            </View>
            <Text style={[styles.entitle, { color: palette.primaryDark }]}>
              {t.unlimited ? 'Unlimited' : `${formatDays(t.annualDays)} ${dayLabel(t.annualDays)}`}
            </Text>
          </View>
          {t.paid === false ? <Text style={styles.unpaid}>Unpaid leave</Text> : null}
          {t.description ? <Text style={styles.reason}>{t.description}</Text> : null}
        </Card>
      ))
    ) : (
      <EmptyState icon="document-text-outline" title="No leave types configured" />
    );
  } else if (tab === 'balances') {
    body = (
      <>
        <Select
          label="Leave year"
          value={leaveYear}
          options={years}
          onChange={setLeaveYear}
          style={styles.yearPicker}
        />
        {balances.length ? (
          balances.map((row) => (
            <BalanceCard
              key={row.schoolUserId}
              row={row}
              onAdjust={openAdjust}
              styles={styles}
            />
          ))
        ) : (
          <EmptyState icon="people-outline" title="No staff balances for this year" />
        )}
      </>
    );
  } else {
    body = requests.length ? (
      requests.map((r) => (
        <RequestCard
          key={r.id}
          request={r}
          showActions={tab === 'pending'}
          onDecide={openDecision}
          styles={styles}
        />
      ))
    ) : (
      <EmptyState
        icon="checkmark-done-outline"
        title={
          tab === 'pending'
            ? 'No leave requests are waiting for approval.'
            : 'No leave requests yet.'
        }
      />
    );
  }

  return (
    <>
      <ScreenScaffold
        title="Leave Management"
        fallbackRoute={homeRoute}
        loading={loading}
        error={error}
        onRetry={load}
        refreshing={refreshing}
        onRefresh={() => load(true)}
        toast={toast}
      >
        <Text style={styles.intro}>
          Approve staff leave and review balances. The leave year runs 1 April to 31 March.
        </Text>

        <SegmentedTabs options={tabOptions} value={tab} onChange={setTab} scrollable />

        <View style={styles.body}>{body}</View>
      </ScreenScaffold>

      <FormSheet
        visible={!!deciding}
        title={deciding?.action === 'APPROVE' ? 'Approve leave' : 'Reject leave'}
        subtitle={deciding?.request?.employeeName}
        onClose={() => setDeciding(null)}
        onSubmit={submitDecision}
        submitLabel={deciding?.action === 'APPROVE' ? 'Approve' : 'Reject'}
        submitting={saving}
      >
        <Text style={styles.label}>Remarks</Text>
        <TextInput
          style={styles.textarea}
          value={remarks}
          onChangeText={setRemarks}
          placeholder="Visible to the requester (optional)"
          placeholderTextColor={SLATE[400]}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          editable={!saving}
        />
        {sheetError ? <Text style={styles.sheetError}>{sheetError}</Text> : null}
      </FormSheet>

      <FormSheet
        visible={!!adjusting}
        title="Adjust balance"
        subtitle={adjusting?.fullName}
        onClose={() => setAdjusting(null)}
        onSubmit={submitAdjust}
        submitLabel="Save adjustment"
        submitting={saving}
      >
        <Select
          label="Leave type"
          value={adjustForm.leaveTypeCode}
          options={adjustTypeOptions}
          onChange={(leaveTypeCode) => setAdjustForm((p) => ({ ...p, leaveTypeCode }))}
          placeholder="Select a leave type"
        />

        <Text style={styles.label}>Days</Text>
        <TextInput
          style={styles.input}
          value={adjustForm.days}
          onChangeText={(days) => setAdjustForm((p) => ({ ...p, days }))}
          placeholder="e.g. 2 to credit, -1 to debit"
          placeholderTextColor={SLATE[400]}
          // A minus sign is meaningful here — a debit — so this cannot be numeric-only on Android,
          // where "numeric" hides the sign on several keyboards.
          keyboardType="numbers-and-punctuation"
          editable={!saving}
        />

        <Text style={styles.label}>Reason</Text>
        <TextInput
          style={styles.textarea}
          value={adjustForm.reason}
          onChangeText={(reason) => setAdjustForm((p) => ({ ...p, reason }))}
          placeholder="Why this adjustment was made"
          placeholderTextColor={SLATE[400]}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          editable={!saving}
        />
        {sheetError ? <Text style={styles.sheetError}>{sheetError}</Text> : null}
      </FormSheet>
    </>
  );
}

const useStyles = makeStyles((p) => ({
  intro: { fontSize: 13, color: SLATE[500], lineHeight: 19, marginBottom: SPACING.md },
  body: { marginTop: SPACING.md },
  yearPicker: { marginBottom: SPACING.md },
  card: { marginBottom: SPACING.sm },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  cardHeadText: { flex: 1 },
  name: { fontSize: 15, fontWeight: '800', color: SLATE[800] },
  sub: { fontSize: 12.5, color: SLATE[500], marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  meta: { fontSize: 12.5, color: SLATE[600], fontWeight: '600' },
  metaDot: { fontSize: 12.5, color: SLATE[400] },
  unpaid: { fontSize: 12.5, fontWeight: '700', color: FEEDBACK.errorText },
  dates: { fontSize: 13, color: SLATE[700], marginTop: 8, fontWeight: '600' },
  reason: { fontSize: 13, color: SLATE[600], lineHeight: 19, marginTop: 6 },
  entitle: { fontSize: 14, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  approve: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: FEEDBACK.successText,
  },
  reject: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: FEEDBACK.errorText,
  },
  actionText: { color: '#ffffff', fontSize: 13.5, fontWeight: '700' },
  adjustBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: p.tint,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
    marginTop: 6,
  },
  balanceName: { flex: 1, fontSize: 13, color: SLATE[600] },
  balanceValue: { fontSize: 13, fontWeight: '700', color: SLATE[800] },
  pressed: { opacity: 0.75 },

  label: {
    fontSize: 13,
    fontWeight: '700',
    color: SLATE[700],
    marginTop: SPACING.md,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14.5,
    color: SLATE[800],
    backgroundColor: '#ffffff',
  },
  textarea: {
    minHeight: 84,
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14.5,
    color: SLATE[800],
    backgroundColor: '#ffffff',
  },
  sheetError: { color: FEEDBACK.errorText, fontSize: 12.5, marginTop: SPACING.sm },
}));
