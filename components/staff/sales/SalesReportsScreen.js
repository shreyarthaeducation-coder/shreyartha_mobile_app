import { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { SLATE, SPACING, TYPE, leading } from '../../../constants/theme';
import {
  Card,
  CardTitle,
  EmptyState,
  InfoRow,
  MonthNavigator,
  ProgressBar,
  ScreenScaffold,
  SegmentedTabs,
  StatusChip,
} from '../../ui';
import makeStyles from '../../../utils/makeStyles';
import useStaffResource from '../../../hooks/useStaffResource';
import { fetchClosureReport, fetchVisitReport } from '../../../services/sales/salesService';
import {
  CUSTOMER_READINGS,
  hasReading,
  humanise,
  readingLabel,
  readingTone,
  shortDate,
} from './salesFormat';

const TABS = [
  { value: 'closure', label: 'Reading', icon: 'trending-up-outline' },
  { value: 'visits', label: 'My visits', icon: 'walk-outline' },
];

// RATING_LABEL lived here — five words for a 1-5 "closure likelihood" that were never shown at
// the point of input. The scale is now the 0-5 Customer Reading, and its labels live in
// salesFormat.js next to the picker that finally displays them.

export default function SalesReportsScreen({ homeRoute = '/staff/sales' }) {
  const [tab, setTab] = useState('closure');
  return tab === 'closure' ? (
    <ClosureReport homeRoute={homeRoute} tab={tab} setTab={setTab} />
  ) : (
    <VisitReport homeRoute={homeRoute} tab={tab} setTab={setTab} />
  );
}

/* ── Closure ──────────────────────────────────────────────────────────────── */

function ClosureReport({ homeRoute, tab, setTab }) {
  const styles = useStyles();
  const fetcher = useCallback((signal) => fetchClosureReport(undefined, signal), []);
  const { data, loading, error, refreshing, reload, refresh } = useStaffResource(fetcher);

  const rows = useMemo(() => data?.rows || [], [data]);
  const distribution = data?.distribution || {};
  const maxCount = Math.max(1, ...Object.values(distribution).map(Number));

  // A weighted COUNT, not a rupee forecast. `expectedStudents` is the rep's own guess, and
  // multiplying it by a list price would dress an estimate up as a number the company could plan
  // against. Summing the probabilities is honest about what the rating actually measures.
  const weighted = rows.reduce((sum, r) => sum + Number(r.probabilityPercent || 0) / 100, 0);

  return (
    <ScreenScaffold
      title="Reports"
      fallbackRoute={homeRoute}
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      <SegmentedTabs options={TABS} value={tab} onChange={setTab} />

      <Card>
        {/* CardTitle takes CHILDREN — `title=`/`subtitle=` render an empty line. */}
        <CardTitle>Customer Reading</CardTitle>
        {data?.financialYearLabel ? (
          <Text style={styles.cardNote}>{data.financialYearLabel}</Text>
        ) : null}
        <InfoRow label="Rated visits" value={String(rows.length)} />
        <InfoRow label="Weighted pipeline" value={weighted.toFixed(1)} />
        <InfoRow
          label="Late stage (4–5)"
          value={String((Number(distribution['4']) || 0) + (Number(distribution['5']) || 0))}
        />
        <InfoRow label="Lost" value={String(Number(distribution['0']) || 0)} />
      </Card>

      <Card>
        <CardTitle>Visits by reading</CardTitle>
        {/* Highest first, so the funnel reads top-down. 0 is included and sits at the bottom:
            without it every lost sale would be invisible on this screen, which is exactly the
            outcome a sales manager most wants to see. */}
        {[...CUSTOMER_READINGS].reverse().map((r) => {
          const count = Number(distribution[String(r.value)] || 0);
          return (
            <View key={r.value} style={styles.distRow}>
              <Text style={styles.distLabel}>{`${r.value} · ${r.label}`}</Text>
              <View style={styles.distBar}>
                {/* A PERCENTAGE of the tallest bar. ProgressBar clamps 0-100, so the old
                    `count / maxCount` fraction drew every bar at under 1% — all of them empty. */}
                <ProgressBar value={(count / maxCount) * 100} />
              </View>
              <Text style={styles.distCount}>{count}</Text>
            </View>
          );
        })}
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          icon="trending-up-outline"
          title="Nothing rated yet"
          message="Set a visit's Customer Reading when you check in and it appears here."
        />
      ) : (
        rows.map((r) => (
          <Card key={r.visitId} style={styles.card}>
            <View style={styles.head}>
              <Text style={styles.school}>{r.schoolName || '—'}</Text>
              <StatusChip
                label={readingLabel(r.customerReading)}
                tone={readingTone(r.customerReading)}
              />
            </View>
            <Text style={styles.meta}>
              {`${shortDate(r.visitDate)} · ${humanise(r.visitType)} · ${r.probabilityPercent}% weight`}
            </Text>
            {r.metPersonName ? (
              <Text style={styles.meta}>
                {`Met ${r.metPersonName}${r.metPersonDesignation ? ` · ${r.metPersonDesignation}` : ''}`}
              </Text>
            ) : null}
            <Text style={styles.meta}>
              {`Pincode ${r.pincode || '—'}`}
              {r.expectedStudents ? ` · ${r.expectedStudents} students` : ''}
            </Text>
            {r.geoFlagged ? (
              <View style={styles.flagRow}>
                <StatusChip label="Location flagged" tone="error" />
              </View>
            ) : null}
            {r.remarks ? <Text style={styles.remarks}>{r.remarks}</Text> : null}
          </Card>
        ))
      )}
    </ScreenScaffold>
  );
}

/* ── Visits ───────────────────────────────────────────────────────────────── */

function VisitReport({ homeRoute, tab, setTab }) {
  const styles = useStyles();
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const fetcher = useCallback((signal) => fetchVisitReport(year, month, signal), [year, month]);
  const { data, loading, error, refreshing, reload, refresh } = useStaffResource(fetcher);

  const byType = data?.byType || {};
  const visits = data?.visits || [];

  return (
    <ScreenScaffold
      title="Reports"
      fallbackRoute={homeRoute}
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      <SegmentedTabs options={TABS} value={tab} onChange={setTab} />

      <Card>
        <MonthNavigator
          year={year}
          month={month}
          onChange={({ year: y, month: m }) => {
            setYear(y);
            setMonth(m);
          }}
        />
        <InfoRow label="Visits logged" value={String(data?.totalVisits ?? 0)} />
        <InfoRow label="Still planned" value={String(data?.plannedVisits ?? 0)} />
        <InfoRow label="Schools covered" value={String(data?.uniqueLeads ?? 0)} />
        {/* Distinct days with a check-in, not calendar days — four visits on one day and nothing
            all week should not read as a busy month. */}
        <InfoRow label="Days in the field" value={String(data?.workingDays ?? 0)} />
        <InfoRow
          label="Avg. Customer Reading"
          value={String(data?.averageCustomerReading ?? '—')}
        />
        {Number(data?.flaggedVisits) > 0 ? (
          <InfoRow label="Location flagged" value={String(data.flaggedVisits)} />
        ) : null}
      </Card>

      <Card>
        <CardTitle>Nature of visits</CardTitle>
        {Object.entries(byType).map(([type, count]) => (
          <InfoRow key={type} label={humanise(type)} value={String(count)} />
        ))}
      </Card>

      {visits.length === 0 ? (
        <EmptyState
          icon="walk-outline"
          title="No visits this month"
          message="Check in at a school and it appears here."
        />
      ) : (
        visits.map((v) => (
          <Card key={v.id} style={styles.card}>
            <View style={styles.head}>
              <Text style={styles.school}>{humanise(v.visitType)}</Text>
              <Text style={styles.meta}>{shortDate(v.visitDate)}</Text>
            </View>
            {v.metPersonName ? (
              <Text style={styles.meta}>
                {`Met ${v.metPersonName}${v.metPersonDesignation ? ` · ${v.metPersonDesignation}` : ''}`}
              </Text>
            ) : null}
            <Text style={styles.meta}>
              {`Pincode ${v.pincode || '—'}`}
              {hasReading(v.customerReading) ? ` · ${readingLabel(v.customerReading)}` : ''}
            </Text>
            {v.remarks ? <Text style={styles.remarks}>{v.remarks}</Text> : null}
          </Card>
        ))
      )}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  card: { marginBottom: SPACING.sm },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  school: { flex: 1, fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  meta: { fontSize: TYPE.label, color: SLATE[500], marginTop: 2 },
  // A card's secondary line. CardTitle takes only children, so a subtitle is a sibling Text —
  // the idiom every correct caller in the app already uses.
  cardNote: { fontSize: TYPE.label, color: SLATE[500], marginTop: -4, marginBottom: SPACING.sm },
  remarks: { fontSize: TYPE.label, color: SLATE[600], marginTop: 6, lineHeight: leading(TYPE.label) },
  flagRow: { flexDirection: 'row', marginTop: 6 },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 5,
  },
  // Widened from 96: "Closure / Sales win" is the longest reading label and was being clipped.
  distLabel: { minWidth: 132, fontSize: TYPE.label, color: SLATE[600] },
  distBar: { flex: 1 },
  distCount: { minWidth: 26, textAlign: 'right', fontSize: TYPE.label, color: SLATE[500] },
}));
