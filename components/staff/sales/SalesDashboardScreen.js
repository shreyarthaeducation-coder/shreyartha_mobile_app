import { useCallback, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SLATE, SPACING, TYPE } from '../../../constants/theme';
import {
  Card,
  CardTitle,
  EmptyState,
  InfoRow,
  ProgressBar,
  ScreenScaffold,
  SegmentedDonut,
  StatusChip,
} from '../../ui';
import { usePalette } from '../../ui/PaletteContext';
import makeStyles from '../../../utils/makeStyles';
import useStaffResource from '../../../hooks/useStaffResource';
import { fetchDashboard } from '../../../services/sales/salesService';
import {
  READING_COLORS,
  UNRATED_COLOR,
  hasReading,
  inr,
  inrShort,
  readingLabel,
  shortDate,
} from './salesFormat';

/**
 * The rep's own numbers, in one place.
 *
 * `fetchDashboard` had existed since the panel was built and had never been called from anywhere
 * — the mobile app simply had no dashboard. This is that screen.
 *
 * It leads with **Sales analysis**: where this rep's schools sit in the funnel, and whether this
 * month is ahead of or behind their own recent form. Everything below is supporting detail.
 */
export default function SalesDashboardScreen({ homeRoute = '/staff/sales' }) {
  const router = useRouter();
  const palette = usePalette();
  const styles = useStyles();

  const fetcher = useCallback((signal) => fetchDashboard(signal), []);
  const { data, loading, error, refreshing, reload, refresh } = useStaffResource(fetcher);

  const analysis = data?.salesAnalysis;
  const incentive = data?.incentive || {};
  const followUps = useMemo(
    () => (Array.isArray(data?.dueFollowUps) ? data.dueFollowUps : []),
    [data],
  );

  // Every reading, plus a "not yet rated" bucket. A school with no rated visit is counted rather
  // than dropped: those are the leads a rep has entered and not worked, and hiding them would
  // make an untouched pipeline look like an empty one.
  const slices = useMemo(() => {
    const raw = Array.isArray(analysis?.slices) ? analysis.slices : [];
    return raw
      .map((s) => ({
        key: s.reading == null ? 'none' : String(s.reading),
        label: s.reading == null ? 'Not yet rated' : readingLabel(s.reading),
        value: Number(s.count) || 0,
        color: s.reading == null ? UNRATED_COLOR : READING_COLORS[s.reading],
      }))
      .filter((s) => s.value > 0);
  }, [analysis]);

  const totalSchools = Number(analysis?.totalSchools) || 0;

  // ProgressBar takes 0-100. The incentive threshold is the one number a rep checks most, and it
  // was rendering as an empty bar on this panel until that was fixed.
  const collected = Number(incentive.collectedInr || 0);
  const threshold = Number(incentive.thresholdInr || 0);
  const incentivePercent = threshold > 0 ? Math.min(100, (collected / threshold) * 100) : 0;

  const months = useMemo(
    () => (Array.isArray(data?.monthlyRevenue) ? data.monthlyRevenue : []),
    [data],
  );
  // Peak-relative bars, the shipped precedent from PartnerOverviewScreen. LineChart and
  // GroupedBars are both hardcoded to a 0-100 percentage axis, so rupees cannot plot on them.
  const peak = useMemo(
    () => months.reduce((m, r) => Math.max(m, Number(r?.collectedInr || 0)), 0),
    [months],
  );
  const activeMonths = useMemo(
    () => months.filter((m) => Number(m?.collectedInr || 0) > 0),
    [months],
  );

  return (
    <ScreenScaffold
      title="Dashboard"
      fallbackRoute={homeRoute}
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      <Card>
        <CardTitle>Sales analysis</CardTitle>
        <Text style={styles.cardNote}>
          {totalSchools === 0
            ? 'No schools yet.'
            : `${totalSchools} school${totalSchools === 1 ? '' : 's'} by Customer Reading · ${data?.financialYearLabel || ''}`}
        </Text>

        {slices.length === 0 ? (
          <Text style={styles.meta}>
            Add a lead and log a visit — your funnel will appear here.
          </Text>
        ) : (
          <View style={styles.analysisRow}>
            <SegmentedDonut
              segments={slices}
              centreValue={totalSchools}
              centreCaption="schools"
            />
            {/* The legend is not decoration. Five of the seven slices are steps of one blue ramp,
                so the counts beside the names are what make the chart readable. */}
            <View style={styles.legend}>
              {slices.map((s) => (
                <View key={s.key} style={styles.legendRow}>
                  <View style={[styles.swatch, { backgroundColor: s.color }]} />
                  <Text style={styles.legendLabel} numberOfLines={1}>
                    {s.label}
                  </Text>
                  <Text style={styles.legendCount}>{s.value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Deviation deviation={data?.deviation} styles={styles} />
      </Card>

      <Card>
        <CardTitle>This month</CardTitle>
        <InfoRow
          icon="location-outline"
          label="Visits"
          value={`${data?.visitsThisMonth ?? 0} · ${data?.visitsToday ?? 0} today`}
        />
        <InfoRow icon="business-outline" label="My schools" value={String(data?.schoolCount ?? 0)} />
        <InfoRow
          icon="cash-outline"
          label="Deals collected"
          value={`${data?.dealsCollected ?? 0} · ${data?.dealsSubmitted ?? 0} awaiting approval`}
        />
        <InfoRow
          icon="wallet-outline"
          label="Collected (ex-GST)"
          value={inr(incentive.collectedInr)}
        />
      </Card>

      <Card>
        <CardTitle>Incentive progress</CardTitle>
        <Text style={styles.cardNote}>{incentive.financialYearLabel || ''}</Text>
        <ProgressBar value={incentivePercent} />
        <View style={styles.progressLabels}>
          <Text style={styles.meta}>{inr(collected)}</Text>
          <Text style={styles.meta}>{inr(threshold)}</Text>
        </View>
        {incentive.qualified ? (
          <View style={styles.chipRow}>
            <StatusChip label="Qualified" tone="success" />
          </View>
        ) : null}
      </Card>

      <Card>
        <CardTitle>Revenue by month</CardTitle>
        <Text style={styles.cardNote}>Collected, ex-GST. April first, like the financial year.</Text>
        {activeMonths.length === 0 ? (
          <Text style={styles.meta}>Nothing collected yet this year.</Text>
        ) : (
          months.map((m) => (
            <View key={m.monthIndex} style={styles.monthRow}>
              <Text style={styles.monthLabel} numberOfLines={1}>
                {m.label}
              </Text>
              <View style={styles.monthBar}>
                {/* Relative to the best month, not to a target — there is no target in this
                    module, and inventing a 100% would misrepresent the number. */}
                <ProgressBar
                  value={peak > 0 ? (Number(m.collectedInr || 0) / peak) * 100 : 0}
                  height={7}
                />
              </View>
              <Text style={styles.monthValue}>{inrShort(m.collectedInr)}</Text>
            </View>
          ))
        )}
      </Card>

      <Card>
        <CardTitle>Follow-ups due</CardTitle>
        {followUps.length === 0 ? (
          <EmptyState
            icon="checkmark-circle-outline"
            title="Nothing due"
            message="Schools you have set a follow-up date for appear here when that date arrives."
          />
        ) : (
          followUps.map((l) => (
            <Pressable
              key={l.id}
              onPress={() => router.push('/staff/sales/sales-leads')}
              style={({ pressed }) => [styles.followRow, pressed && styles.pressed]}
            >
              <View style={styles.followText}>
                <Text style={styles.followName}>{l.schoolName}</Text>
                <Text style={styles.meta}>
                  {`Due ${shortDate(l.nextFollowUpDate)}`}
                  {[l.city, l.pincode].filter(Boolean).length
                    ? ` · ${[l.city, l.pincode].filter(Boolean).join(' · ')}`
                    : ''}
                </Text>
              </View>
              {hasReading(l.currentReading) ? (
                <Text style={[styles.followReading, { color: palette.primaryDark }]}>
                  {readingLabel(l.currentReading)}
                </Text>
              ) : null}
            </Pressable>
          ))
        )}
      </Card>
    </ScreenScaffold>
  );
}

/**
 * This month against the rep's own trailing three completed months.
 *
 * There is no revenue target anywhere in this module, so "deviation" is measured against the
 * rep's own recent form. "Not enough history" is the correct answer in a rep's first months, not
 * a failure — saying so beats showing a number computed from nothing.
 */
function Deviation({ deviation, styles }) {
  if (!deviation) return null;

  const pct = deviation.deviationPercent;
  const has = pct !== null && pct !== undefined;
  const value = Number(pct);
  const tone = !has ? '' : value > 0 ? 'ok' : value < 0 ? 'bad' : '';

  return (
    <View style={styles.deviation}>
      <Text style={styles.deviationLabel}>{`Sales deviation · ${deviation.label || ''}`}</Text>
      {has ? (
        <>
          <Text
            style={[
              styles.deviationValue,
              tone === 'ok' && styles.deviationUp,
              tone === 'bad' && styles.deviationDown,
            ]}
          >
            {`${value > 0 ? '▲ +' : value < 0 ? '▼ ' : ''}${value.toFixed(1)}%`}
          </Text>
          <Text style={styles.meta}>
            {`${inrShort(deviation.currentInr)} vs ${inrShort(deviation.baselineInr)} average of the last ${deviation.monthsOfHistory} month${deviation.monthsOfHistory === 1 ? '' : 's'}`}
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.deviationValue}>—</Text>
          <Text style={styles.meta}>
            {deviation.monthsOfHistory === 0
              ? 'No completed month to compare against yet.'
              : 'Nothing collected in the last few months, so there is no baseline.'}
          </Text>
        </>
      )}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  cardNote: { fontSize: TYPE.label, color: SLATE[500], marginTop: -4, marginBottom: SPACING.sm },
  meta: { fontSize: TYPE.label, color: SLATE[500], marginTop: 2 },

  analysisRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  legend: { flex: 1, gap: 4 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  legendLabel: { flex: 1, fontSize: TYPE.label, color: SLATE[700] },
  legendCount: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },

  deviation: {
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
    paddingTop: SPACING.sm,
    marginTop: SPACING.sm,
  },
  deviationLabel: {
    fontSize: TYPE.caption,
    fontWeight: '700',
    color: SLATE[500],
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  deviationValue: { fontSize: TYPE.headline, fontWeight: '800', color: SLATE[800], marginTop: 2 },
  deviationUp: { color: '#16a34a' },
  deviationDown: { color: '#dc2626' },

  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  chipRow: { flexDirection: 'row', marginTop: SPACING.sm },

  monthRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 7 },
  monthLabel: { minWidth: 74, fontSize: TYPE.label, color: SLATE[500] },
  monthBar: { flex: 1 },
  monthValue: { minWidth: 62, fontSize: TYPE.label, color: SLATE[700], textAlign: 'right' },

  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  followText: { flex: 1 },
  followName: { fontSize: TYPE.heading, fontWeight: '600', color: SLATE[800] },
  followReading: { fontSize: TYPE.label, fontWeight: '700' },
  pressed: { opacity: 0.85 },
}));
