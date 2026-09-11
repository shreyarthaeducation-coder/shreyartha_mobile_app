import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE } from '../../constants/theme';
import { Card, CardTitle, EmptyState, ProgressBar, ScreenScaffold, Select } from '../ui';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import { fetchProfile } from '../../services/partner/profileService';
import {
  fetchEarningFinancialYears,
  fetchMonthlyEarnings,
  fetchMonetization,
  monetizationTotals,
} from '../../services/partner/analyticsService';
import { formatRupees } from '../../utils/currency';

/**
 * Dashboard — the partner's identity, their headline numbers, and earnings by month.
 *
 * Ports frontendmain/src/Partner/platform/PartnerDashboard.js + PartnerAnalytics.js.
 *
 * ── WHY THERE IS NO PIE AND NO LINE CHART ───────────────────────────────────────────────────────
 * The web draws a Recharts pie (subscriptions by type) and a line (earnings by month). Neither maps
 * onto the native chart kit as-is:
 *   • `DonutChart` takes a single `value` — it is a progress ring, not a multi-segment pie.
 *   • `LineChart` is a 0-100 PERCENTAGE chart. Earnings are rupees, so plotting them there would
 *     either mis-scale the axis or require normalising the values, and a money chart whose y-axis
 *     silently means "percent of the best month" is worse than no chart.
 * So both become relative bars with the exact figure printed alongside: the bar carries the shape,
 * the number carries the truth, and nothing is implied that the data does not say. Building a real
 * pie/currency-line pair is worth doing, but it is a chart-kit change, not a dashboard change.
 *
 * The web fetches the profile THREE times on this route (layout, dashboard, analytics). Here it is
 * fetched once.
 */

export default function PartnerOverviewScreen({ homeRoute = '/partner' }) {
  const styles = useStyles();
  const palette = usePalette();

  const [profile, setProfile] = useState(null);
  const [totals, setTotals] = useState(null);
  const [years, setYears] = useState([]);
  const [startYear, setStartYear] = useState(null);
  const [months, setMonths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (mode) => {
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    setError('');
    setNotice('');

    // The profile is the spine — without it there is no dashboard. Everything after it is an
    // enrichment and is allowed to fail on its own.
    let me = null;
    try {
      me = await fetchProfile();
      setProfile(me);
    } catch (e) {
      setError(e?.message || 'Could not load your partner profile.');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const [monetizationRes, yearsRes] = await Promise.allSettled([
      fetchMonetization(),
      fetchEarningFinancialYears(),
    ]);

    if (monetizationRes.status === 'fulfilled') {
      const rows = Array.isArray(monetizationRes.value) ? monetizationRes.value : [];
      setTotals(monetizationTotals(rows));
    } else {
      setTotals(null);
      setNotice('Earnings summary is unavailable right now.');
    }

    const fyList = yearsRes.status === 'fulfilled' && Array.isArray(yearsRes.value)
      ? yearsRes.value
      : [];
    setYears(fyList);
    setStartYear((cur) => (cur != null ? cur : fyList[0]?.startYear ?? null));

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load('load');
  }, [load]);

  // Monthly buckets reload whenever the FY changes, without touching the rest of the screen.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (startYear == null) return;
      try {
        const data = await fetchMonthlyEarnings(startYear);
        if (alive) setMonths(Array.isArray(data) ? data : []);
      } catch {
        if (alive) setMonths([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [startYear]);

  const peak = months.reduce((m, r) => Math.max(m, Number(r?.total || 0)), 0);
  const schools = profile?.linkedSchoolCodes || [];
  const isMaster = String(profile?.partnerType || '').toUpperCase() === 'MASTER';

  return (
    <ScreenScaffold
      title="Dashboard"
      fallbackRoute={homeRoute}
      loading={loading}
      error={error}
      notice={notice}
      onRetry={() => load('load')}
      refreshing={refreshing}
      onRefresh={() => load('refresh')}
    >
      <Card>
        <CardTitle>{profile?.fullName || 'Partner'}</CardTitle>
        <View style={styles.codeRow}>
          <Ionicons name="pricetag-outline" size={17} color={palette.primary} />
          <Text style={styles.code}>{profile?.partnerCode || '—'}</Text>
          {isMaster ? (
            <View style={styles.tier}>
              <Text style={styles.tierText}>MASTER</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.hint}>
          Families who enter this code at checkout are attributed to you.
        </Text>

        <View style={styles.schoolWrap}>
          <Text style={styles.schoolLabel}>
            {`Linked school${schools.length === 1 ? '' : 's'} (${schools.length})`}
          </Text>
          <View style={styles.schoolChips}>
            {schools.length === 0 ? (
              <Text style={styles.hint}>No schools linked yet.</Text>
            ) : (
              schools.map((c) => (
                <View key={c} style={styles.schoolChip}>
                  <Text style={styles.schoolChipText}>{c}</Text>
                </View>
              ))
            )}
          </View>
        </View>
      </Card>

      {totals ? (
        <Card>
          <CardTitle>Earnings to date</CardTitle>
          <View style={styles.stats}>
            {[
              ['Revenue', formatRupees(totals.revenue)],
              ['Collected', formatRupees(totals.collected)],
            ].map(([label, value]) => (
              <View key={label} style={styles.stat}>
                <Text style={styles.statValue}>{value}</Text>
                <Text style={styles.statLabel}>{label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.stats}>
            {[
              ['Subscriptions', totals.active],
              ['Direct', totals.primary],
              ['Override', totals.override],
            ].map(([label, value]) => (
              <View key={label} style={styles.statSmallCell}>
                <Text style={styles.statSmall}>{value}</Text>
                <Text style={styles.statLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      <Card>
        <CardTitle>Earnings by month</CardTitle>
        {years.length > 1 ? (
          <Select
            variant="chip"
            label="Financial year"
            value={startYear}
            options={years.map((y) => ({ value: y.startYear, label: y.label }))}
            onChange={setStartYear}
          />
        ) : null}

        {months.length === 0 ? (
          <EmptyState
            icon="bar-chart-outline"
            title="No earnings recorded"
            message="Monthly earnings appear here once subscriptions are purchased with your code."
          />
        ) : (
          months.map((m) => (
            <View key={m.label} style={styles.monthRow}>
              <View style={styles.monthHead}>
                <Text style={styles.monthLabel}>{m.label}</Text>
                <Text style={styles.monthValue}>{formatRupees(m.total)}</Text>
              </View>
              {/* The bar is RELATIVE to the best month of the year; the rupee figure beside it is
                  the actual number. Anything else would need a currency-aware chart. */}
              <ProgressBar value={peak > 0 ? (Number(m.total || 0) / peak) * 100 : 0} height={7} />
              {m.masterOverride ? (
                <Text style={styles.split}>
                  {`Direct ${formatRupees(m.primary)} · Override ${formatRupees(m.masterOverride)}`}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </Card>
    </ScreenScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  code: { fontSize: TYPE.title, fontWeight: '800', color: p.primary, letterSpacing: 0.5 },
  tier: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: p.tint,
  },
  tierText: { fontSize: TYPE.micro, fontWeight: '800', color: p.primaryDark, letterSpacing: 0.5 },
  hint: { fontSize: TYPE.caption, color: SLATE[600], marginTop: 4 },

  schoolWrap: { marginTop: SPACING.md },
  schoolLabel: {
    fontSize: TYPE.micro,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: SLATE[600],
    marginBottom: 6,
  },
  schoolChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  schoolChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: p.tint,
    borderWidth: 1,
    borderColor: p.cardBorder,
  },
  schoolChipText: { fontSize: TYPE.caption, fontWeight: '600', color: p.primaryDark },

  stats: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  stat: { flex: 1, alignItems: 'center' },
  statSmallCell: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: TYPE.title, fontWeight: '800', color: p.primaryDark },
  statSmall: { fontSize: TYPE.body, fontWeight: '800', color: p.primaryDark },
  statLabel: { fontSize: TYPE.micro, color: SLATE[600], marginTop: 2 },

  monthRow: { marginTop: SPACING.sm },
  monthHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  monthLabel: { fontSize: TYPE.label, fontWeight: '600', color: p.primaryDark },
  monthValue: { fontSize: TYPE.label, fontWeight: '700', color: p.primaryDark },
  split: { fontSize: TYPE.micro, color: SLATE[600], marginTop: 3 },
}));
