import { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { SLATE, SPACING } from '../../../constants/theme';
import {
  Card,
  CardTitle,
  EmptyState,
  InfoRow,
  ProgressBar,
  ScreenScaffold,
  Select,
  StatusChip,
  TextField,
} from '../../ui';
import { usePalette } from '../../ui/PaletteContext';
import makeStyles from '../../../utils/makeStyles';
import useStaffResource from '../../../hooks/useStaffResource';
import {
  INCENTIVE_STATUS_TONE,
  fetchIncentiveLedger,
  fetchIncentiveSummary,
  fetchIncentiveYears,
} from '../../../services/sales/salesService';
import { humanise, inr, shortDate } from './salesFormat';

/**
 * My Incentive.
 *
 * The screen leads with what crossing the threshold is WORTH rather than with how far away it is,
 * because under the retroactive rule those are wildly different numbers: a rep ₹1L short is not
 * ₹10,000 away from their first payout, they are one deal away from ₹2,00,000. Showing only the
 * gap would understate the incentive the company is actually offering.
 */
export default function SalesIncentiveScreen({ homeRoute = '/staff/sales' }) {
  const palette = usePalette();
  const styles = useStyles();
  const [fy, setFy] = useState(null);
  const [simulate, setSimulate] = useState('');

  const yearsFetcher = useCallback((signal) => fetchIncentiveYears(signal), []);
  const { data: yearsData } = useStaffResource(yearsFetcher);
  const years = useMemo(() => (Array.isArray(yearsData) ? yearsData : []), [yearsData]);
  const activeFy = fy ?? years[0] ?? null;

  const summaryFetcher = useCallback(
    (signal) => fetchIncentiveSummary(activeFy, signal),
    [activeFy],
  );
  const {
    data: summary,
    loading,
    error,
    refreshing,
    reload,
    refresh,
  } = useStaffResource(summaryFetcher);

  const ledgerFetcher = useCallback((signal) => fetchIncentiveLedger(activeFy, signal), [activeFy]);
  const { data: ledgerData } = useStaffResource(ledgerFetcher);
  const ledger = useMemo(() => (Array.isArray(ledgerData) ? ledgerData : []), [ledgerData]);

  const collected = Number(summary?.collectedInr || 0);
  const threshold = Number(summary?.thresholdInr || 0);
  const rate = Number(summary?.ratePercent || 0);
  const earned = Number(summary?.earnedInr || 0);
  // A PERCENTAGE, not a fraction. ProgressBar clamps to 0-100 and sets `width: ${pct}%`, so the
  // old `Math.min(1, …)` rendered a rep halfway to their threshold as a 0.5%-wide bar — visually
  // empty, on the single most motivating number in the panel.
  const progressPercent = threshold > 0 ? Math.min(100, (collected / threshold) * 100) : 0;

  const extra = Number(simulate || 0);
  const projected = collected + extra;
  const projectedQualified = projected >= threshold;
  const projectedEarning = projectedQualified ? (projected * rate) / 100 : 0;
  const projectedDelta = projectedEarning - earned;

  return (
    <ScreenScaffold
      title="My Incentive"
      fallbackRoute={homeRoute}
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {years.length > 1 ? (
        <Select
          variant="chip"
          value={activeFy}
          options={years.map((y) => ({
            value: y,
            label: `FY ${y}-${String((y + 1) % 100).padStart(2, '0')}`,
          }))}
          onChange={setFy}
          style={styles.yearPicker}
        />
      ) : null}

      <Card>
        {/* CardTitle takes CHILDREN — `title=`/`subtitle=` props are ignored and render an empty
            line. The secondary line is a sibling Text, which is what every correct caller does. */}
        <CardTitle>{summary?.financialYearLabel || 'This year'}</CardTitle>
        <Text style={styles.meta}>
          {`Your rate is ${rate}% on collected, ex-GST revenue`}
        </Text>
        <ProgressBar value={progressPercent} />
        <View style={styles.progressLabels}>
          <Text style={styles.meta}>{inr(collected)}</Text>
          <Text style={styles.meta}>{inr(threshold)}</Text>
        </View>

        {summary?.qualified ? (
          <View style={styles.qualified}>
            <StatusChip label="Qualified" tone="success" />
            <Text style={styles.body}>
              {`You have earned ${inr(earned)} at ${rate}% on everything collected this year.`}
            </Text>
          </View>
        ) : (
          <Text style={styles.body}>
            {`${inr(summary?.remainingToThresholdInr)} more collected revenue unlocks `}
            <Text style={[styles.strong, { color: palette.primaryDark }]}>
              {inr(summary?.unlockValueInr)}
            </Text>
            {` on what you have already banked — rising to ${inr(summary?.payoutAtThresholdInr)} at the threshold itself. Nothing is payable until you cross it.`}
          </Text>
        )}
      </Card>

      <Card>
        <CardTitle>Payouts</CardTitle>
        <InfoRow label="Earned this year" value={inr(earned)} />
        <InfoRow label="Pending approval" value={inr(summary?.pendingInr)} />
        <InfoRow label="Approved" value={inr(summary?.approvedInr)} />
        <InfoRow label="Paid" value={inr(summary?.paidInr)} />
      </Card>

      <Card>
        <CardTitle>What if I collect a bit more?</CardTitle>
        <Text style={styles.meta}>Enter an amount to see where it takes you.</Text>
        <TextField
          label="Additional collection, ex-GST"
          value={simulate}
          onChangeText={(v) => setSimulate(v.replace(/\D/g, ''))}
          keyboardType="number-pad"
          placeholder="500000"
        />
        {extra > 0 ? (
          <Text style={styles.body}>
            {projectedQualified
              ? `Collecting another ${inr(extra)} takes you to ${inr(projected)}. Your incentive would be ${inr(projectedEarning)} — an increase of ${inr(projectedDelta)}.`
              : `Collecting another ${inr(extra)} takes you to ${inr(projected)} — still ${inr(threshold - projected)} short of the threshold, so the incentive stays at ${inr(0)}.`}
          </Text>
        ) : null}
      </Card>

      <Card>
        <CardTitle>Ledger</CardTitle>
        <Text style={styles.meta}>
          A correction appends an adjustment rather than editing history, so the rows always sum to
          what you are owed.
        </Text>
        {ledger.length === 0 ? (
          <EmptyState
            icon="trophy-outline"
            title="Nothing accrued yet"
            message="Incentive appears here once your collected revenue crosses the threshold."
          />
        ) : (
          ledger.map((row) => (
            <View key={row.id} style={styles.ledgerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ledgerNote}>{row.note || '—'}</Text>
                <Text style={styles.meta}>
                  {`${shortDate(row.createdAt)} · ${Number(row.ratePercent)}% of ${inr(row.cumulativeCollectedInr)}`}
                </Text>
              </View>
              <View style={styles.ledgerRight}>
                <Text
                  style={[
                    styles.ledgerAmount,
                    Number(row.commissionInr) < 0 && styles.negative,
                  ]}
                >
                  {inr(row.commissionInr)}
                </Text>
                <StatusChip
                  label={humanise(row.status)}
                  tone={INCENTIVE_STATUS_TONE[row.status] || 'neutral'}
                />
              </View>
            </View>
          ))
        )}
      </Card>
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  yearPicker: { alignSelf: 'flex-start', marginBottom: SPACING.sm },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  meta: { fontSize: 12, color: SLATE[500] },
  body: { fontSize: 13, color: SLATE[600], lineHeight: 19, marginTop: SPACING.sm },
  strong: { fontWeight: '800' },
  qualified: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: SLATE[100],
  },
  ledgerNote: { fontSize: 13, color: SLATE[700] },
  ledgerRight: { alignItems: 'flex-end', gap: 4 },
  ledgerAmount: { fontSize: 14, fontWeight: '700', color: SLATE[800] },
  negative: { color: '#dc2626' },
}));
