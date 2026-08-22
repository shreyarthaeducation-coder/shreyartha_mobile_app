import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { Card, CardTitle, EmptyState, ScreenScaffold, StatusChip, TextField } from '../ui';
import { ProgressBar } from '../ui/charts';
import useStaffResource from '../../hooks/useStaffResource';
import { parentApi } from '../../services/parentApi';
import {
  defaultAcademicYear,
  fetchFeeStatus,
  fetchPaymentHistory,
  isPayable,
  paidPercent,
  paymentDate,
  statusTone,
} from '../../services/parent/feeService';
import { PARENT_BASE } from '../../constants/parentMenu';
import { formatRupees, formatShortDate } from '../../utils/currency';
import { makeStyles } from '../../utils/makeStyles';

/**
 * School Fees — dues, the installment schedule and the payment history.
 *
 * ── PAYING HAPPENS IN THE WEBVIEW, PERMANENTLY ───────────────────────────────
 * The checkout is Razorpay's browser SDK. Rather than add a native payment module — which would
 * mean an EAS dev-client build for an app that otherwise runs in Expo Go — "Pay Now" opens the
 * website's own fees page through app/parent/feature.js, with the session already injected. UPI
 * app redirects work there because it is a real browser context.
 *
 * Confirmation is WEBHOOK-driven: there is no client verify endpoint for school fees. So on return
 * this screen simply refetches. It refetches on focus rather than after a fixed delay, because
 * nothing guarantees the webhook has landed — the website waits a flat 3 seconds and reloads once,
 * which is a guess. A dismissed checkout leaves a PENDING row that neither endpoint returns, so the
 * installment correctly stays unpaid and the Pay button stays available.
 */

function SummaryTile({ label, value, tone }) {
  const styles = useStyles();
  return (
    <View style={[styles.tile, tone ? { borderTopColor: tone } : null]}>
      <Text style={styles.tileValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

export default function FeesScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();

  const [year, setYear] = useState(defaultAcademicYear);
  // Committed separately from the text field. The website refetches on EVERY KEYSTROKE — its
  // loader is a useCallback keyed on the raw input — so typing "2026-27" fires seven requests,
  // six of them for years that do not exist.
  const [committedYear, setCommittedYear] = useState(defaultAcademicYear);

  const fetcher = useCallback(
    (signal) =>
      parentApi.settleAll({
        status: fetchFeeStatus(committedYear, signal),
        history: fetchPaymentHistory(signal),
      }),
    [committedYear],
  );
  const { data, loading, error, refreshing, reload, refresh, revalidate } = useStaffResource(
    fetcher,
    { initialData: null },
  );

  // Coming back from the WebView checkout: re-read quietly rather than flashing a spinner.
  useFocusEffect(
    useCallback(() => {
      revalidate();
    }, [revalidate]),
  );

  const status = data?.status?.data;
  const statusError = data?.status?.error;
  const history = data?.history?.data || [];
  const enrolled = !!status?.enrolled;
  const percent = paidPercent(status);

  const openCheckout = () =>
    // `label`, NOT `title` — app/parent/feature.js reads `label`; the student twin reads `title`,
    // and passing the wrong one silently yields the "Shreyartha" fallback header.
    router.push({
      pathname: '/parent/feature',
      params: { label: 'School Fees', path: `${PARENT_BASE}/fees` },
    });

  return (
    <ScreenScaffold
      title="School Fees"
      fallbackRoute="/parent"
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      <TextField
        label="Academic year"
        value={year}
        onChangeText={setYear}
        onBlur={() => setCommittedYear(year.trim())}
        onSubmitEditing={() => setCommittedYear(year.trim())}
        placeholder="2026-27"
        returnKeyType="done"
      />

      {statusError ? (
        // The three refusals — not a parent, not verified, no child linked — all arrive here with
        // the server's own wording, which is more useful than a generic failure.
        <Card style={styles.block}>
          <Text style={styles.refusal}>{statusError}</Text>
        </Card>
      ) : !enrolled ? (
        <EmptyState
          icon="cash-outline"
          title="No fee record"
          message={`No fee record was found for ${committedYear}.`}
        />
      ) : (
        <>
          <View style={styles.tileRow}>
            <SummaryTile label="Total" value={formatRupees(status.totalAmount, { decimals: 0 })} tone={palette.primary} />
            <SummaryTile label="Paid" value={formatRupees(status.paidAmount, { decimals: 0 })} tone={FEEDBACK.successText} />
            <SummaryTile label="Remaining" value={formatRupees(status.remainingAmount, { decimals: 0 })} tone={FEEDBACK.warningText} />
          </View>

          <Card style={styles.block}>
            <View style={styles.progressHead}>
              <CardTitle style={styles.progressTitle}>Payment progress</CardTitle>
              <StatusChip label={status.status} tone={statusTone(status.status)} />
            </View>
            {/* Clamped and zero-guarded in paidPercent — the web prints >100% when overpaid and
                NaN% when the total is zero. */}
            <ProgressBar value={percent} color={palette.primary} label={`${percent}% paid`} />
          </Card>

          {status.nextDueDate ? (
            <Card style={[styles.block, styles.dueCard]}>
              <Text style={styles.dueLabel}>Next payment</Text>
              <Text style={styles.dueAmount}>{formatRupees(status.nextDueAmount)}</Text>
              <Text style={styles.dueDate}>Due {formatShortDate(status.nextDueDate)}</Text>
              {status.nextInstallmentId ? (
                <Pressable
                  onPress={openCheckout}
                  style={({ pressed }) => [
                    styles.payBtn,
                    { backgroundColor: palette.primary },
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={styles.payText}>Pay now</Text>
                  <Ionicons name="open-outline" size={15} color="#ffffff" />
                </Pressable>
              ) : null}
            </Card>
          ) : null}

          <Text style={styles.sectionTitle}>Installments</Text>
          {(status.installments || []).length === 0 ? (
            <Text style={styles.muted}>No installments found.</Text>
          ) : (
            status.installments.map((inst) => (
              <Card key={inst.id} style={styles.row}>
                <View style={styles.rowHead}>
                  <Text style={styles.rowTitle}>Installment {inst.installmentNumber}</Text>
                  <StatusChip label={inst.status} tone={statusTone(inst.status)} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowMeta}>Due {formatShortDate(inst.dueDate)}</Text>
                  <Text style={styles.rowAmount}>{formatRupees(inst.amount)}</Text>
                </View>
                {isPayable(inst) ? (
                  <Pressable
                    onPress={openCheckout}
                    style={({ pressed }) => [styles.rowPay, pressed && styles.pressed]}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.rowPayText, { color: palette.primaryDark }]}>Pay</Text>
                    <Ionicons name="chevron-forward" size={14} color={palette.primaryDark} />
                  </Pressable>
                ) : null}
              </Card>
            ))
          )}
        </>
      )}

      <Text style={styles.sectionTitle}>Payment history</Text>
      {history.length === 0 ? (
        // Only CAPTURED rows come back, so a payment appears here once the webhook has landed.
        <Text style={styles.muted}>No payments recorded yet.</Text>
      ) : (
        history.map((payment) => (
          <Card key={payment.id} style={styles.row}>
            <View style={styles.rowHead}>
              <Text style={styles.rowTitle}>{formatRupees(payment.amount)}</Text>
              <StatusChip
                label={payment.paymentMode === 'ONLINE' ? 'Online' : 'Offline'}
                tone={payment.paymentMode === 'ONLINE' ? 'info' : 'warning'}
              />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowMeta}>{formatShortDate(paymentDate(payment)) || '—'}</Text>
              <Text style={styles.receipt}>{payment.receiptNumber || '—'}</Text>
            </View>
          </Card>
        ))
      )}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  block: { marginTop: SPACING.sm },
  tileRow: { flexDirection: 'row', gap: 8, marginTop: SPACING.sm },
  tile: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SLATE[200],
    borderTopWidth: 3,
    borderTopColor: SLATE[300],
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  tileValue: { fontSize: 16, fontWeight: '800', color: SLATE[800] },
  tileLabel: { fontSize: 11.5, color: SLATE[500], fontWeight: '600', marginTop: 3 },
  progressHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  progressTitle: { flex: 1, marginBottom: 0 },
  dueCard: { borderLeftWidth: 3, borderLeftColor: FEEDBACK.warningText },
  dueLabel: { fontSize: 12, color: SLATE[500], fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  dueAmount: { fontSize: 22, fontWeight: '800', color: SLATE[800], marginTop: 4 },
  dueDate: { fontSize: 13, color: SLATE[500], marginTop: 2 },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: SPACING.sm,
  },
  payText: { color: '#ffffff', fontWeight: '700', fontSize: 14.5 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: SLATE[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  muted: { fontSize: 13, color: SLATE[400], fontStyle: 'italic' },
  refusal: { fontSize: 13.5, color: SLATE[600], lineHeight: 20 },
  row: { marginBottom: SPACING.sm },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { flex: 1, fontSize: 14.5, fontWeight: '700', color: SLATE[800] },
  rowBody: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  rowMeta: { flex: 1, fontSize: 12.5, color: SLATE[500] },
  rowAmount: { fontSize: 14, fontWeight: '700', color: SLATE[800] },
  receipt: { fontSize: 12, color: SLATE[500], fontWeight: '600' },
  rowPay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  rowPayText: { fontSize: 13.5, fontWeight: '700' },
  pressed: { opacity: 0.7 },
}));
