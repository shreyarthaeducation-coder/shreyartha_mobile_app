import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SLATE, SPACING } from '../../../constants/theme';
import { Card, CardTitle, EmptyState, InfoRow, ScreenScaffold, StatusChip } from '../../ui';
import makeStyles from '../../../utils/makeStyles';
import useStaffResource from '../../../hooks/useStaffResource';
import { fetchMySchools } from '../../../services/sales/salesService';
import { gstLabel, humanise, inr, inrShort, shortDate } from './salesFormat';

/**
 * My Schools — the rep's assigned schools and what each has bought.
 *
 * Base, GST and total are always three separate figures. The school's cheque is the total, but
 * only the base is revenue and only the base drives incentive; collapsing them into one number is
 * how a rep ends up believing they are 18% closer to their threshold than they are.
 */
export default function SalesSchoolsScreen({ homeRoute = '/staff/sales' }) {
  const styles = useStyles();
  const [expanded, setExpanded] = useState(null);

  const fetcher = useCallback((signal) => fetchMySchools(signal), []);
  const { data, loading, error, refreshing, reload, refresh } = useStaffResource(fetcher);

  const schools = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const totals = useMemo(
    () =>
      schools.reduce(
        (acc, s) => ({
          base: acc.base + Number(s.baseRevenueInr || 0),
          gst: acc.gst + Number(s.gstInr || 0),
          total: acc.total + Number(s.totalRevenueInr || 0),
          collected: acc.collected + Number(s.collectedBaseInr || 0),
        }),
        { base: 0, gst: 0, total: 0, collected: 0 },
      ),
    [schools],
  );

  return (
    <ScreenScaffold
      title="My Schools"
      fallbackRoute={homeRoute}
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {schools.length === 0 ? (
        <EmptyState
          icon="business-outline"
          title="No schools assigned"
          message="Ask the admin team to link the schools you have onboarded. A sale can only be filed against an assigned school."
        />
      ) : (
        <>
          <Card>
            <CardTitle>{`${schools.length} school${schools.length > 1 ? "s" : ""}`}</CardTitle>
            <InfoRow label="Revenue (ex-GST)" value={inr(totals.base)} />
            <InfoRow label={gstLabel()} value={inr(totals.gst)} />
            <InfoRow label="Invoiced total" value={inr(totals.total)} />
            <InfoRow label="Collected (ex-GST)" value={inr(totals.collected)} />
          </Card>

          {schools.map((s) => {
            const open = expanded === s.schoolId;
            const outstanding = Number(s.outstandingBaseInr || 0);
            return (
              <Card key={s.schoolId} style={styles.card}>
                <Pressable onPress={() => setExpanded(open ? null : s.schoolId)}>
                  <View style={styles.head}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{s.schoolName}</Text>
                      <Text style={styles.meta}>
                        {[s.schoolCode, s.board, s.noOfStudents ? `${s.noOfStudents} students` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                    <StatusChip
                      label={outstanding > 0 ? inrShort(outstanding) : 'Clear'}
                      tone={outstanding > 0 ? 'warning' : 'success'}
                    />
                  </View>

                  <View style={styles.figures}>
                    <Figure label="Base" value={inrShort(s.baseRevenueInr)} />
                    <Figure label="GST" value={inrShort(s.gstInr)} />
                    <Figure label="Total" value={inrShort(s.totalRevenueInr)} strong />
                  </View>

                  <Text style={styles.toggle}>
                    {open ? 'Hide deals' : `${s.dealCount} deal${s.dealCount === 1 ? '' : 's'} — tap to view`}
                  </Text>
                </Pressable>

                {open
                  ? (s.deals || []).map((d) => (
                      <View key={d.id} style={styles.deal}>
                        <View style={styles.dealHead}>
                          <Text style={styles.dealDate}>{shortDate(d.createdAt)}</Text>
                          <StatusChip label={humanise(d.status)} tone={dealTone(d.status)} />
                        </View>
                        <Text style={styles.meta}>
                          {(d.items || [])
                            .map((i) => `${i.productName}${i.grade ? ` (${i.grade})` : ''}`)
                            .join(', ') || '—'}
                        </Text>
                        <Text style={styles.meta}>
                          {`${humanise(d.paymentMethod)} · ${inr(d.baseAmountInr)} + ${inr(d.gstAmountInr)} GST = ${inr(d.totalAmountInr)}`}
                        </Text>
                      </View>
                    ))
                  : null}
              </Card>
            );
          })}
        </>
      )}
    </ScreenScaffold>
  );
}

function dealTone(status) {
  if (status === 'COLLECTED') return 'success';
  if (status === 'REJECTED') return 'error';
  if (status === 'SUBMITTED') return 'warning';
  return 'info';
}

function Figure({ label, value, strong }) {
  const styles = useStyles();
  return (
    <View style={styles.figure}>
      <Text style={styles.figureLabel}>{label}</Text>
      <Text style={[styles.figureValue, strong && styles.figureStrong]}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((p) => ({
  card: { marginBottom: SPACING.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  name: { fontSize: 15, fontWeight: '700', color: SLATE[800] },
  meta: { fontSize: 12.5, color: SLATE[500], marginTop: 2 },
  figures: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm },
  figure: { flex: 1 },
  figureLabel: { fontSize: 11, color: SLATE[400], textTransform: 'uppercase', letterSpacing: 0.4 },
  figureValue: { fontSize: 15, fontWeight: '600', color: SLATE[700], marginTop: 2 },
  figureStrong: { color: p.primaryDark, fontWeight: '800' },
  toggle: { fontSize: 12.5, color: p.link, fontWeight: '600', marginTop: SPACING.sm },
  deal: {
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
    paddingTop: SPACING.sm,
    marginTop: SPACING.sm,
  },
  dealHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dealDate: { fontSize: 13, fontWeight: '600', color: SLATE[700] },
}));
