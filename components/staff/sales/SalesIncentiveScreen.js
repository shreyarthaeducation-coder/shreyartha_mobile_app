import { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { SLATE, SPACING, TYPE, leading } from '../../../constants/theme';
import { Card, CardTitle, EmptyState, InfoRow, ScreenScaffold, Select, StatusChip, TextField } from '../../ui';
import { usePalette } from '../../ui/PaletteContext';
import makeStyles from '../../../utils/makeStyles';
import useStaffResource from '../../../hooks/useStaffResource';
import { INCENTIVE_STATUS_TONE, fetchIncentiveMonth, fetchIncentiveMonths } from '../../../services/sales/salesService';
import { inr, shortDate } from './salesFormat';

/**
 * My Incentive — Annexure B (24 Oct 2026), as on the website's page.
 *
 * Each month's fully paid, ex-GST sales earn the slabs slab by slab, like income tax: 3% on the first
 * 30 lakh, 6% on the next 30 lakh, and so on. A sale counts in the month its full payment is
 * recorded; a part-paid or unpaid one waits, and is listed with the reason.
 */

/** What each ledger status means to the rep, in the order an incentive moves through them. */
const STATUS_LABEL = {
  PENDING: 'Pending verification',
  VERIFIED: 'Verified by manager',
  APPROVED: 'Approved by HQ',
  PAID: 'Paid',
  REVERSED: 'Adjustment',
};

/** The same slab-wise sum as the server's SalesIncentiveSlabs — for the "what if" box only. */
function slabIncentive(slabs, amount) {
  const sales = Math.max(0, Number(amount || 0));
  let total = 0;
  let current = 0;
  (slabs || []).forEach((s, i) => {
    const floor = Number(s.fromInr || 0);
    const ceiling = s.upToInr == null ? Infinity : Number(s.upToInr);
    if (sales > floor) {
      total += ((Math.min(sales, ceiling) - floor) * Number(s.ratePercent || 0)) / 100;
      current = i;
    }
  });
  return { incentive: Math.round(total * 100) / 100, currentSlab: current };
}

export default function SalesIncentiveScreen({ homeRoute = '/staff/sales' }) {
  const palette = usePalette();
  const styles = useStyles();
  const [month, setMonth] = useState(null);
  const [simulate, setSimulate] = useState('');

  const monthsFetcher = useCallback((signal) => fetchIncentiveMonths(signal), []);
  const { data: monthsData } = useStaffResource(monthsFetcher);
  const months = useMemo(() => (Array.isArray(monthsData) ? monthsData : []), [monthsData]);
  const activeMonth = month ?? months[0]?.month ?? '';

  const pageFetcher = useCallback((signal) => fetchIncentiveMonth(activeMonth, signal), [activeMonth]);
  const { data: page, loading, error, refreshing, reload, refresh } = useStaffResource(pageFetcher);

  const slabs = page?.slabs || [];
  const breakdown = page?.breakdown || [];
  const ledger = page?.ledger || [];
  const counted = page?.countedDeals || [];
  const waiting = page?.notCountedDeals || [];
  const nextRate = page?.nextRatePercent;

  const extra = Number(simulate || 0);
  const projected = slabIncentive(slabs, Number(page?.eligibleInr || 0) + extra);
  const projectedDelta = projected.incentive - Number(page?.incentiveInr || 0);

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
      {months.length > 1 ? (
        <Select
          variant="chip"
          value={activeMonth}
          options={months.map((m) => ({ value: m.month, label: m.label }))}
          onChange={setMonth}
          style={styles.monthPicker}
        />
      ) : null}

      {page && !page.monthly ? (
        <Card>
          <Text style={styles.body}>
            {`${page.monthLabel} is before the monthly slabs began${page.schemeStart ? ` (${page.schemeStart})` : ''}; its incentive was worked out under the earlier financial-year rule.`}
          </Text>
        </Card>
      ) : null}

      <Card>
        <CardTitle>{page?.monthLabel || 'This month'}</CardTitle>
        <Text style={styles.meta}>
          Fully paid sales (ex-GST) earn the slabs slab by slab: every part of the month&apos;s sales earns its own
          slab&apos;s rate.
        </Text>
        <InfoRow label="Eligible sales" value={inr(page?.eligibleInr)} />
        <InfoRow label="Incentive this month" value={inr(page?.incentiveInr)} />
        <InfoRow
          label="Current slab"
          value={`${Number(page?.currentRatePercent || 0)}% · ${(slabs[page?.currentSlab] || {}).label || ''}`}
        />
        <Text style={[styles.body, { color: palette.primaryDark }]}>
          {nextRate == null
            ? 'You are in the top slab: every further rupee paid in full this month earns the top rate.'
            : `${inr(page?.toNextSlabInr)} more paid in full this month and the rest earns ${Number(nextRate)}%.`}
        </Text>
      </Card>

      <Card>
        <CardTitle>How this month is worked out</CardTitle>
        {breakdown.map((b, i) => {
          const reached = Number(b.salesInr || 0) > 0;
          const current = i === page?.currentSlab;
          return (
            <View key={b.label} style={[styles.slabRow, current && reached && { backgroundColor: palette.tint }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.slabLabel, current && reached && styles.strong]}>{b.label}</Text>
                <Text style={styles.meta}>
                  {reached ? `${inr(b.salesInr)} at ${Number(b.ratePercent)}%` : `${Number(b.ratePercent)}%`}
                </Text>
              </View>
              <Text style={styles.slabAmount}>{reached ? inr(b.incentiveInr) : '—'}</Text>
            </View>
          );
        })}
        <View style={styles.slabTotal}>
          <Text style={styles.strongBody}>Total</Text>
          <Text style={styles.strongBody}>{inr(page?.incentiveInr)}</Text>
        </View>
      </Card>

      {page?.monthly ? (
        <Card>
          <CardTitle>What if another sale is paid in full this month?</CardTitle>
          <TextField
            label="Sale value, ex-GST"
            value={simulate}
            onChangeText={(v) => setSimulate(v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            placeholder="500000"
          />
          {extra > 0 ? (
            <Text style={styles.body}>
              {`The month would reach ${inr(Number(page?.eligibleInr || 0) + extra)}, earning ${inr(projected.incentive)} — ${inr(projectedDelta)} more, in the ${Number((slabs[projected.currentSlab] || {}).ratePercent || 0)}% slab.`}
            </Text>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <CardTitle>Sales counted this month</CardTitle>
        {counted.length === 0 ? (
          <Text style={styles.meta}>{`No sale was paid in full in ${page?.monthLabel || 'this month'}.`}</Text>
        ) : (
          counted.map((d) => (
            <View key={d.id} style={styles.ledgerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ledgerNote}>{d.schoolName || `Sale #${d.id}`}</Text>
                <Text style={styles.meta}>{`#${d.id} · paid in full ${shortDate(d.collectedAt)}`}</Text>
              </View>
              <Text style={styles.ledgerAmount}>{inr(d.baseAmountInr)}</Text>
            </View>
          ))
        )}
      </Card>

      <Card>
        <CardTitle>Not counted yet</CardTitle>
        <Text style={styles.meta}>
          No incentive is paid on a pending, part-paid or unpaid sale. Each counts in the month its full payment is
          received.
        </Text>
        {waiting.length === 0 ? (
          <Text style={[styles.meta, styles.spaced]}>Nothing waiting.</Text>
        ) : (
          waiting.map((d) => (
            <View key={d.id} style={styles.ledgerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ledgerNote}>{d.schoolName || `Sale #${d.id}`}</Text>
                <Text style={styles.meta}>{d.reason}</Text>
              </View>
              <Text style={styles.ledgerAmount}>{inr(d.baseAmountInr)}</Text>
            </View>
          ))
        )}
      </Card>

      <Card>
        <CardTitle>{`Ledger · ${page?.monthLabel || ''}`}</CardTitle>
        <Text style={styles.meta}>
          Your reporting manager verifies the month&apos;s incentive, then HQ approves and pays it. A correction adds
          an adjustment row rather than changing an old one.
        </Text>
        {ledger.length === 0 ? (
          <EmptyState icon="trophy-outline" title="Nothing booked yet" message="Incentive appears here once a sale is paid in full." />
        ) : (
          ledger.map((row) => (
            <View key={row.id} style={styles.ledgerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ledgerNote}>{row.note || '—'}</Text>
                <Text style={styles.meta}>{`${shortDate(row.createdAt)} · month's sales ${inr(row.cumulativeCollectedInr)}`}</Text>
              </View>
              <View style={styles.ledgerRight}>
                <Text style={[styles.ledgerAmount, Number(row.commissionInr) < 0 && styles.negative]}>
                  {inr(row.commissionInr)}
                </Text>
                <StatusChip
                  label={STATUS_LABEL[row.status] || row.status}
                  tone={INCENTIVE_STATUS_TONE[row.status] || 'neutral'}
                />
              </View>
            </View>
          ))
        )}
      </Card>

      {(page?.paymentConditions || []).length > 0 ? (
        <Card>
          <CardTitle>Payment and eligibility conditions</CardTitle>
          {page.paymentConditions.map((c, i) => (
            <Text key={c} style={styles.body}>{`${i + 1}. ${c}`}</Text>
          ))}
          {page.generalConditions ? <Text style={[styles.meta, styles.spaced]}>{page.generalConditions}</Text> : null}
        </Card>
      ) : null}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  monthPicker: { alignSelf: 'flex-start', marginBottom: SPACING.sm },
  meta: { fontSize: TYPE.label, color: SLATE[500], lineHeight: leading(TYPE.label) },
  spaced: { marginTop: SPACING.sm },
  body: { fontSize: TYPE.body, color: SLATE[600], lineHeight: leading(TYPE.body), marginTop: SPACING.sm },
  strong: { fontWeight: '800' },
  strongBody: { fontSize: TYPE.body, fontWeight: '800', color: SLATE[800] },
  slabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: SLATE[100],
  },
  slabLabel: { fontSize: TYPE.body, color: SLATE[700] },
  slabAmount: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  slabTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: SPACING.sm, paddingHorizontal: 6 },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: SLATE[100],
  },
  ledgerNote: { fontSize: TYPE.body, color: SLATE[700] },
  ledgerRight: { alignItems: 'flex-end', gap: 4 },
  ledgerAmount: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  negative: { color: '#dc2626' },
}));
