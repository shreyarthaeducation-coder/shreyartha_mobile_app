import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE } from '../../constants/theme';
import { Card, EmptyState, ScreenScaffold, StatusChip } from '../ui';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import useStaffResource from '../../hooks/useStaffResource';
import useSortableRows from '../../hooks/useSortableRows';
import { fetchMonetization, monetizationTotals } from '../../services/partner/analyticsService';
import { formatRupees, formatShortDate } from '../../utils/currency';

/**
 * Monetization — every commissionable subscription attributed to this partner.
 *
 * Ports frontendmain/src/Partner/platform/PartnerMonetization.js: the stat tiles, the sortable
 * searchable table, and the default `purchasedAt desc` ordering.
 *
 * CANCELLED rows are excluded from revenue and from the collected total but still listed and still
 * counted — a refunded subscription pays no commission, and hiding it entirely would leave a
 * partner unable to see why their total moved. See monetizationTotals.
 *
 * A phone has no room for a nine-column table, so each row is a card. The column headers become a
 * sort bar over the three fields anyone actually sorts by; `useSortableRows` keeps the web's
 * none → asc → desc cycle, which is the only way back to the server's newest-first order.
 */

const SORTS = [
  ['purchasedAt', 'Date'],
  ['studentName', 'Student'],
  ['revenue', 'Revenue'],
];

export default function PartnerMonetizationScreen({ homeRoute = '/partner' }) {
  const styles = useStyles();
  const palette = usePalette();
  const { data, loading, error, refreshing, refresh, reload } = useStaffResource(fetchMonetization);

  const all = Array.isArray(data) ? data : [];
  const totals = monetizationTotals(all);
  const { rows, search, setSearch, toggle, indicatorFor } = useSortableRows(all, {
    searchKeys: ['studentName', 'partnerCode', 'subscriptionType', 'sourcePartnerName'],
    initialSort: { key: 'purchasedAt', dir: 'desc' },
  });

  const indicatorIcon = (key) => {
    const state = indicatorFor(key);
    if (state === 'asc') return 'arrow-up';
    if (state === 'desc') return 'arrow-down';
    return 'swap-vertical';
  };

  return (
    <ScreenScaffold
      title="Monetization"
      fallbackRoute={homeRoute}
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {all.length === 0 && !loading ? (
        <EmptyState
          icon="cash-outline"
          title="No earnings yet"
          message="Subscriptions purchased with your partner code will appear here."
        />
      ) : (
        <>
          <View style={styles.stats}>
            {[
              ['Revenue', formatRupees(totals.revenue)],
              ['Collected', formatRupees(totals.collected)],
            ].map(([label, value]) => (
              <View key={label} style={styles.statWide}>
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
              ['Cancelled', totals.cancelled],
            ].map(([label, value]) => (
              <View key={label} style={styles.stat}>
                <Text style={styles.statSmall}>{value}</Text>
                <Text style={styles.statLabel}>{label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={SLATE[400]} />
            <TextInput
              style={styles.search}
              value={search}
              onChangeText={setSearch}
              placeholder="Search student, code or plan"
              placeholderTextColor={SLATE[400]}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search ? (
              <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={16} color={SLATE[400]} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.sortBar}>
            {SORTS.map(([key, label]) => (
              <Pressable
                key={key}
                onPress={() => toggle(key)}
                style={({ pressed }) => [
                  styles.sortChip,
                  indicatorFor(key) !== 'none' && styles.sortChipOn,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Sort by ${label}`}
              >
                <Text
                  style={[
                    styles.sortText,
                    indicatorFor(key) !== 'none' && styles.sortTextOn,
                  ]}
                >
                  {label}
                </Text>
                <Ionicons
                  name={indicatorIcon(key)}
                  size={12}
                  color={indicatorFor(key) !== 'none' ? palette.onPrimary : palette.primaryDark}
                />
              </Pressable>
            ))}
          </View>

          {rows.length === 0 ? (
            <EmptyState
              icon="search-outline"
              title="No matches"
              message="No subscription matches that search."
            />
          ) : (
            rows.map((r) => {
              const cancelled = String(r.status || '').toUpperCase() === 'CANCELLED';
              const override = String(r.commissionType || '').toUpperCase() === 'MASTER_OVERRIDE';
              return (
                <Card key={r.subscriptionId}>
                  <View style={styles.rowHead}>
                    <Text style={styles.student} numberOfLines={1}>
                      {r.studentName || '—'}
                    </Text>
                    <Text style={[styles.revenue, cancelled && styles.struck]}>
                      {formatRupees(r.revenue)}
                    </Text>
                  </View>

                  <View style={styles.chips}>
                    {r.subscriptionType ? (
                      <StatusChip label={r.subscriptionType} tone="info" />
                    ) : null}
                    <StatusChip
                      label={override ? 'Master override' : 'Direct'}
                      tone={override ? 'warning' : 'success'}
                    />
                    {cancelled ? <StatusChip label="Cancelled" tone="error" /> : null}
                  </View>

                  {/* An override row is somebody else's sale — naming the source partner is the
                      only way a Master can reconcile it. */}
                  {override && r.sourcePartnerName ? (
                    <Text style={styles.meta}>
                      {`via ${r.sourcePartnerName}${r.sourcePartnerCode ? ` (${r.sourcePartnerCode})` : ''}`}
                    </Text>
                  ) : null}

                  <View style={styles.grid}>
                    {[
                      ['Paid', formatRupees(r.amountPaid)],
                      ['Commission', r.commissionPercent != null ? `${r.commissionPercent}%` : '—'],
                      ['Purchased', formatShortDate(r.purchasedAt)],
                      ['Expires', formatShortDate(r.expiresAt)],
                    ].map(([label, value]) => (
                      <View key={label} style={styles.cell}>
                        <Text style={styles.cellLabel}>{label}</Text>
                        <Text style={styles.cellValue}>{value || '—'}</Text>
                      </View>
                    ))}
                  </View>
                </Card>
              );
            })
          )}
        </>
      )}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  stats: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  statWide: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    backgroundColor: p.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: p.cardBorder,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    backgroundColor: p.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: p.cardBorder,
  },
  statValue: { fontSize: TYPE.title, fontWeight: '800', color: p.primaryDark },
  statSmall: { fontSize: TYPE.body, fontWeight: '800', color: p.primaryDark },
  statLabel: { fontSize: TYPE.micro, color: p.primaryDark, opacity: 0.7, marginTop: 2 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: SPACING.sm,
    backgroundColor: p.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: p.inputBorder,
    marginBottom: SPACING.sm,
  },
  search: { flex: 1, fontSize: TYPE.body, color: SLATE[800] },

  sortBar: { flexDirection: 'row', gap: 6, marginBottom: SPACING.sm },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: p.cardBorder,
    backgroundColor: p.card,
  },
  sortChipOn: { backgroundColor: p.primary, borderColor: p.primary },
  sortText: { fontSize: TYPE.caption, fontWeight: '600', color: p.primaryDark },
  sortTextOn: { color: p.onPrimary },

  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  student: { flex: 1, fontSize: TYPE.title, fontWeight: '700', color: p.primaryDark },
  revenue: { fontSize: TYPE.title, fontWeight: '800', color: p.primary },
  struck: { textDecorationLine: 'line-through', opacity: 0.6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  meta: { fontSize: TYPE.caption, color: p.primaryDark, opacity: 0.75, marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: SPACING.sm },
  cell: { width: '50%', paddingVertical: 4 },
  cellLabel: { fontSize: TYPE.micro, color: p.primaryDark, opacity: 0.6 },
  cellValue: { fontSize: TYPE.label, fontWeight: '600', color: p.primaryDark },
  pressed: { opacity: 0.75 },
}));
