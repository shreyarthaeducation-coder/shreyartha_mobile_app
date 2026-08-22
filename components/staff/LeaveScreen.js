import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { FEEDBACK, PORTALS, SLATE, SPACING } from '../../constants/theme';
import {
  Card,
  CardTitle,
  DateTimeField,
  EmptyState,
  FormSheet,
  ProgressBar,
  ScreenScaffold,
  SegmentedTabs,
  Select,
  StatusChip,
  TextField,
  useToast,
} from '../ui';
import useStaffResource from '../../hooks/useStaffResource';
import {
  LEAVE_STATUS_TONE,
  applyLeave,
  estimateLeaveDays,
  fetchLeaveBalances,
  fetchLeaveRequests,
  withdrawLeave,
} from '../../services/teacher/hrService';
import {
  balanceUsage,
  currentLeaveYear,
  dayLabel,
  formatDays,
  formatShortDate,
  recentLeaveYears,
} from '../../utils/currency';
import { todayIso } from '../../utils/dates';

/**
 * Native Leave Management — balances, requests and applying.
 *
 * The leave year runs 1 April – 31 March and balances reset each April. Note the Requests tab is
 * NOT filtered by the selected year: the endpoint takes no year parameter and returns everything.
 */

const PALETTE = PORTALS.school;

const TABS = [
  { value: 'balances', label: 'Balances', icon: 'wallet-outline' },
  { value: 'requests', label: 'Requests', icon: 'document-text-outline' },
];

export default function LeaveScreen({ homeRoute = '/teacher' }) {
  const [tab, setTab] = useState('balances');
  const [leaveYear, setLeaveYear] = useState(currentLeaveYear);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const { toast, showToast } = useToast();
  const years = useMemo(() => recentLeaveYears(4), []);

  const balancesFetcher = useCallback(
    (signal) => fetchLeaveBalances(leaveYear, signal),
    [leaveYear],
  );
  const {
    data: balances,
    loading: balancesLoading,
    error: balancesError,
    refreshing,
    reload,
    refresh,
    revalidate: revalidateBalances,
  } = useStaffResource(balancesFetcher, { initialData: [] });

  const requestsFetcher = useCallback((signal) => fetchLeaveRequests(signal), []);
  const { data: requests, loading: requestsLoading, revalidate: revalidateRequests } =
    useStaffResource(requestsFetcher, { initialData: [] });

  const balanceList = balances || [];
  const requestList = requests || [];

  const openApply = () => {
    setForm({
      leaveTypeCode: balanceList[0]?.code || 'CASUAL',
      startDate: `${todayIso()}T09:00:00`,
      endDate: `${todayIso()}T09:00:00`,
      halfDayStart: false,
      halfDayEnd: false,
      reason: '',
      contactDuringLeave: '',
    });
    setSheetOpen(true);
  };

  const startDate = form?.startDate?.slice(0, 10) || '';
  const endDate = form?.endDate?.slice(0, 10) || '';
  const sameDay = !!startDate && startDate === endDate;

  const estimate = form
    ? estimateLeaveDays({
        startDate,
        endDate,
        halfDayStart: form.halfDayStart,
        // A hidden half-day-end flag must not keep counting once the range collapses to one day.
        halfDayEnd: sameDay ? false : form.halfDayEnd,
      })
    : 0;

  const selectedType = balanceList.find((b) => b.code === form?.leaveTypeCode) || null;
  const insufficient =
    selectedType && !selectedType.unlimited && estimate > Number(selectedType.available ?? 0);

  const submit = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await applyLeave({
        leaveTypeCode: form.leaveTypeCode,
        startDate,
        endDate,
        halfDayStart: !!form.halfDayStart,
        halfDayEnd: sameDay ? false : !!form.halfDayEnd,
        reason: form.reason,
        contactDuringLeave: form.contactDuringLeave,
      });
      showToast('Leave request submitted. Your approver has been notified.', 'success');
      setSheetOpen(false);
      await Promise.all([revalidateBalances(), revalidateRequests()]);
    } catch (e) {
      // The server rejects boundary-spanning, overlapping and over-limit requests with a specific
      // message; the web replaces all of them with "Could not apply", which helps nobody.
      showToast(e?.message || 'Could not submit the request.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmWithdraw = (request) => {
    Alert.alert('Withdraw this request?', `${request.leaveTypeName}, ${formatShortDate(request.startDate)}.`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: async () => {
          setBusyId(request.id);
          try {
            await withdrawLeave(request.id);
            showToast('Leave request withdrawn.', 'success');
            await Promise.all([revalidateBalances(), revalidateRequests()]);
          } catch (e) {
            showToast(e?.message || 'Could not withdraw the request.', 'error');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const renderBalances = () => {
    if (balanceList.length === 0) {
      return (
        <EmptyState
          icon="wallet-outline"
          title="No leave types configured"
          message="Your school has not set up leave types yet."
        />
      );
    }
    return balanceList.map((b) => {
      const usage = balanceUsage(b);
      return (
        <Card key={b.code}>
          <View style={styles.balanceHead}>
            <Text style={styles.balanceName}>{b.name}</Text>
            <Text style={styles.balanceLeft}>
              {b.unlimited ? '—' : `${formatDays(b.available)} left`}
            </Text>
          </View>

          {b.unlimited ? (
            <Text style={styles.note}>Unpaid — deducted from salary as loss of pay.</Text>
          ) : (
            <>
              <ProgressBar
                value={usage.percent}
                color={usage.percent >= 100 ? FEEDBACK.errorText : PALETTE.primary}
                style={styles.balanceBar}
              />
              <View style={styles.balanceStats}>
                {/* "Entitled" is opening + accrued + adjusted — the same figure the meter uses.
                    The web labels bare `accrued` as Entitled, so its number and its bar disagree
                    whenever opening or adjusted is non-zero. */}
                <Text style={styles.balanceStat}>Entitled {formatDays(usage.entitled)}</Text>
                <Text style={styles.balanceStat}>Used {formatDays(b.used)}</Text>
                <Text style={styles.balanceStat}>Pending {formatDays(b.pending)}</Text>
                {Number(b.adjusted) !== 0 ? (
                  <Text style={styles.balanceStat}>Adjusted {formatDays(b.adjusted)}</Text>
                ) : null}
              </View>
              {b.accrualMode === 'MONTHLY' ? (
                <Text style={styles.note}>Accrues 1 day a month once probation is complete.</Text>
              ) : null}
            </>
          )}
        </Card>
      );
    });
  };

  const renderRequests = () => {
    if (requestsLoading) {
      return <ActivityIndicator size="large" color={PALETTE.primary} style={styles.loader} />;
    }
    if (requestList.length === 0) {
      return (
        <EmptyState
          icon="document-text-outline"
          title="No leave applied for yet"
          message="Tap Apply above to submit your first request."
        />
      );
    }
    return requestList.map((r) => (
      <Card key={r.id}>
        <View style={styles.requestHead}>
          <View style={styles.requestText}>
            <Text style={styles.requestType}>{r.leaveTypeName}</Text>
            <Text style={styles.requestDates}>
              {formatShortDate(r.startDate)}
              {r.halfDayStart ? ' (half)' : ''}
              {r.endDate !== r.startDate ? ` – ${formatShortDate(r.endDate)}` : ''}
              {r.halfDayEnd && r.endDate !== r.startDate ? ' (half)' : ''}
              {' · '}
              {formatDays(r.totalDays)} {dayLabel(r.totalDays)}
            </Text>
          </View>
          <StatusChip label={r.status} tone={LEAVE_STATUS_TONE[r.status] || 'neutral'} />
        </View>

        {r.reason ? <Text style={styles.requestReason}>{r.reason}</Text> : null}
        {r.decidedByName ? (
          <Text style={styles.requestDecision}>
            {r.status === 'APPROVED' ? 'Approved' : 'Decided'} by {r.decidedByName}
            {r.decisionRemarks ? ` — ${r.decisionRemarks}` : ''}
          </Text>
        ) : null}

        {r.status === 'PENDING' ? (
          busyId === r.id ? (
            <ActivityIndicator size="small" color={PALETTE.primary} style={styles.rowBusy} />
          ) : (
            <Pressable
              onPress={() => confirmWithdraw(r)}
              style={({ pressed }) => [styles.withdrawBtn, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.withdrawText}>Withdraw</Text>
            </Pressable>
          )
        ) : null}
      </Card>
    ));
  };

  return (
    <ScreenScaffold
      title="Leave Management"
      fallbackRoute={homeRoute}
      loading={balancesLoading && balanceList.length === 0}
      error={balanceList.length === 0 && balancesError ? balancesError : ''}
      notice={balanceList.length > 0 && balancesError ? balancesError : ''}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
      toast={toast}
    >
      <View style={styles.toolbar}>
        <View style={styles.yearPicker}>
          <Select
            variant="chip"
            label="Leave year"
            value={leaveYear}
            options={years.map((y) => ({ value: y, label: y }))}
            onChange={setLeaveYear}
          />
        </View>
        <Pressable
          onPress={openApply}
          style={({ pressed }) => [styles.applyBtn, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.applyText}>Apply</Text>
        </Pressable>
      </View>
      <Text style={styles.yearNote}>
        Runs 1 April to 31 March. Balances reset each April.
      </Text>

      <SegmentedTabs options={TABS} value={tab} onChange={setTab} style={styles.tabs} />

      {tab === 'balances' ? renderBalances() : renderRequests()}

      <FormSheet
        visible={sheetOpen}
        title="Apply for leave"
        onClose={() => setSheetOpen(false)}
        onSubmit={submit}
        submitting={saving}
        submitDisabled={estimate <= 0 || !!insufficient}
        submitLabel="Submit request"
      >
        {form ? (
          <>
            <Select
              label="Leave type"
              value={form.leaveTypeCode}
              options={balanceList.map((b) => ({
                value: b.code,
                label: b.unlimited
                  ? `${b.name} (unpaid)`
                  : `${b.name} — ${formatDays(b.available)} left`,
              }))}
              onChange={(leaveTypeCode) => setForm((f) => ({ ...f, leaveTypeCode }))}
            />
            <DateTimeField
              label="From"
              mode="date"
              value={form.startDate}
              onChange={(value) =>
                setForm((f) => ({
                  ...f,
                  startDate: value,
                  // Keep the range valid rather than letting the server reject it.
                  endDate: f.endDate && f.endDate < value ? value : f.endDate,
                }))
              }
            />
            <DateTimeField
              label="To"
              mode="date"
              value={form.endDate}
              minimumDate={startDate ? new Date(`${startDate}T00:00:00`) : undefined}
              onChange={(endDate) => setForm((f) => ({ ...f, endDate }))}
            />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Half day on the first day</Text>
              <Switch
                value={!!form.halfDayStart}
                onValueChange={(halfDayStart) => setForm((f) => ({ ...f, halfDayStart }))}
                trackColor={{ true: PALETTE.accent, false: SLATE[300] }}
                thumbColor={form.halfDayStart ? PALETTE.primaryDark : '#ffffff'}
              />
            </View>
            {!sameDay ? (
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Half day on the last day</Text>
                <Switch
                  value={!!form.halfDayEnd}
                  onValueChange={(halfDayEnd) => setForm((f) => ({ ...f, halfDayEnd }))}
                  trackColor={{ true: PALETTE.accent, false: SLATE[300] }}
                  thumbColor={form.halfDayEnd ? PALETTE.primaryDark : '#ffffff'}
                />
              </View>
            ) : null}

            <View style={[styles.estimate, insufficient && styles.estimateBad]}>
              <Text style={[styles.estimateText, insufficient && styles.estimateTextBad]}>
                This request is {formatDays(estimate)} {dayLabel(estimate)}.
                {insufficient
                  ? ` That is more than your ${selectedType.name} balance of ${formatDays(selectedType.available)} — apply under Loss of Pay instead.`
                  : selectedType && !selectedType.unlimited && estimate > 0
                    ? ` You would have ${formatDays(Number(selectedType.available) - estimate)} left.`
                    : ''}
              </Text>
            </View>

            <TextField
              label="Reason"
              value={form.reason}
              onChangeText={(reason) => setForm((f) => ({ ...f, reason }))}
              placeholder="Briefly explain the reason for your leave"
              multiline
              inputStyle={styles.multiline}
            />
            <TextField
              label="Contact during leave"
              value={form.contactDuringLeave}
              onChangeText={(contactDuringLeave) => setForm((f) => ({ ...f, contactDuringLeave }))}
              placeholder="Optional"
              keyboardType="phone-pad"
            />
          </>
        ) : null}
      </FormSheet>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  yearPicker: { flex: 1, flexDirection: 'row' },
  applyBtn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: PALETTE.primaryDark,
  },
  applyText: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
  yearNote: { fontSize: 11.5, color: SLATE[500], marginTop: 6 },
  tabs: { marginTop: SPACING.md },
  loader: { marginVertical: SPACING.xl },

  balanceHead: { flexDirection: 'row', alignItems: 'baseline', gap: SPACING.sm },
  balanceName: { flex: 1, fontSize: 15, fontWeight: '700', color: SLATE[800] },
  balanceLeft: { fontSize: 14, fontWeight: '800', color: PALETTE.primaryDark },
  balanceBar: { marginTop: SPACING.sm },
  balanceStats: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginTop: SPACING.sm },
  balanceStat: { fontSize: 12, color: SLATE[500], fontWeight: '600' },
  note: { fontSize: 11.5, color: SLATE[500], fontStyle: 'italic', marginTop: 6 },

  requestHead: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  requestText: { flex: 1 },
  requestType: { fontSize: 14.5, fontWeight: '700', color: SLATE[800] },
  requestDates: { fontSize: 12, color: SLATE[500], marginTop: 2 },
  requestReason: { fontSize: 12.5, color: SLATE[600], marginTop: 6 },
  requestDecision: { fontSize: 11.5, color: SLATE[500], marginTop: 4, fontStyle: 'italic' },
  rowBusy: { marginTop: SPACING.sm, alignSelf: 'flex-start' },
  withdrawBtn: {
    alignSelf: 'flex-start',
    marginTop: SPACING.sm,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: FEEDBACK.errorBorder,
    backgroundColor: FEEDBACK.errorBg,
  },
  withdrawText: { fontSize: 12.5, fontWeight: '700', color: FEEDBACK.errorText },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  switchLabel: { flex: 1, fontSize: 13.5, color: SLATE[700], fontWeight: '600' },

  estimate: {
    padding: SPACING.sm,
    borderRadius: 10,
    backgroundColor: PALETTE.tint,
    marginBottom: SPACING.md,
  },
  estimateBad: { backgroundColor: FEEDBACK.errorBg },
  estimateText: { fontSize: 12.5, color: SLATE[700], lineHeight: 17 },
  estimateTextBad: { color: FEEDBACK.errorText },
  multiline: { height: 76, textAlignVertical: 'top' },

  pressed: { opacity: 0.72 },
});
