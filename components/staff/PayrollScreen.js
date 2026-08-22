import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PORTALS, SLATE, SPACING } from '../../constants/theme';
import {
  Card,
  CardTitle,
  EmptyState,
  FormSheet,
  ScreenScaffold,
  SegmentedTabs,
  Select,
  SensitiveGate,
  useToast,
} from '../ui';
import useStaffResource from '../../hooks/useStaffResource';
import useSensitiveReveal from '../../hooks/useSensitiveReveal';
import { confirmPayslipExport } from '../../utils/confirmSensitive';
import { fetchPayslips, payslipPdfPath } from '../../services/teacher/hrService';
import {
  currentLeaveYear,
  formatDays,
  formatPeriod,
  formatRupees,
  formatShortDate,
} from '../../utils/currency';
import { downloadAndShare } from '../../utils/downloadFile';

/**
 * Native Payroll Management — payslips and their PDFs.
 *
 * Only payslips from a **published** payroll run are returned, so an empty year is a normal state.
 * Unlike the exam and adaptive reports, the PDF here is generated server-side, so it is downloaded
 * rather than screenshotted — see utils/downloadFile.js for why the content type is checked.
 */

const PALETTE = PORTALS.school;

const TABS = [
  { value: 'latest', label: 'Latest', icon: 'receipt-outline' },
  { value: 'year', label: 'Year', icon: 'calendar-outline' },
];

function Row({ label, value, strong }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, strong && styles.rowStrong]}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.rowStrong]}>{value}</Text>
    </View>
  );
}

function Fact({ label, value }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value || '-'}</Text>
    </View>
  );
}

/** Rows whose amount is zero are dropped, matching the web. */
const nonZero = (rows) => rows.filter(([, v]) => Number(v) !== 0);

function PayslipDetail({ slip, onDownload, downloading }) {
  if (!slip) return <Text style={styles.empty}>No payslip to show.</Text>;

  const earnings = nonZero([
    ['Basic salary', slip.basic],
    ['House rent allowance', slip.hra],
    ['Conveyance allowance', slip.conveyance],
    ['Medical allowance', slip.medicalAllowance],
    ['Special allowance', slip.specialAllowance],
    ['Other allowance', slip.otherAllowance],
  ]);
  const deductions = nonZero([
    ['Provident fund (EPF)', slip.pfEmployee],
    ['ESI', slip.esiEmployee],
    ['Professional tax', slip.professionalTax],
    ['Income tax (TDS)', slip.tds],
    ['Other deductions', slip.otherDeductions],
  ]);

  return (
    <>
      <Card>
        <View style={styles.slipHead}>
          <View style={styles.slipText}>
            <Text style={styles.slipPeriod}>
              {formatPeriod(slip.periodYear, slip.periodMonth)}
            </Text>
            <Text style={styles.slipMeta}>
              {slip.payslipNumber} · FY {slip.financialYear} ·{' '}
              {slip.taxRegime === 'OLD' ? 'Old' : 'New'} regime
            </Text>
          </View>
          <Pressable
            onPress={() => onDownload(slip)}
            disabled={downloading}
            style={({ pressed }) => [styles.pdfBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Download payslip PDF"
          >
            {downloading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="download-outline" size={15} color="#ffffff" />
                <Text style={styles.pdfText}>PDF</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.facts}>
          <Fact label="Employee" value={slip.employeeName} />
          <Fact label="Code" value={slip.employeeCode} />
          <Fact label="Designation" value={slip.designation} />
          <Fact label="Joined" value={formatShortDate(slip.dateOfJoining)} />
          <Fact label="UAN" value={slip.uanNumber} />
          <Fact label="Bank A/C" value={slip.bankAccountMasked} />
        </View>

        <View style={styles.daysStrip}>
          <Text style={styles.dayStat}>Total {formatDays(slip.totalDays)}</Text>
          <Text style={styles.dayStat}>Paid {formatDays(slip.paidDays)}</Text>
          <Text style={[styles.dayStat, Number(slip.lopDays) > 0 && styles.lop]}>
            Loss of pay {formatDays(slip.lopDays)}
          </Text>
        </View>
      </Card>

      <Card>
        <CardTitle>Earnings</CardTitle>
        {earnings.length === 0 ? (
          <Text style={styles.empty}>None</Text>
        ) : (
          earnings.map(([label, value]) => (
            <Row key={label} label={label} value={formatRupees(value)} />
          ))
        )}
        <View style={styles.divider} />
        <Row label="Gross earnings" value={formatRupees(slip.grossEarnings)} strong />
      </Card>

      <Card>
        <CardTitle>Deductions</CardTitle>
        {deductions.length === 0 ? (
          <Text style={styles.empty}>None</Text>
        ) : (
          deductions.map(([label, value]) => (
            <Row key={label} label={label} value={formatRupees(value)} />
          ))
        )}
        <View style={styles.divider} />
        <Row label="Total deductions" value={formatRupees(slip.totalDeductions)} strong />
      </Card>

      <Card>
        <View style={styles.netRow}>
          <Text style={styles.netLabel}>Net pay</Text>
          <Text style={styles.netValue}>{formatRupees(slip.netPay)}</Text>
        </View>
        {slip.netPayWords ? <Text style={styles.netWords}>{slip.netPayWords}</Text> : null}
      </Card>

      <Card>
        <CardTitle>Employer contributions</CardTitle>
        <Text style={styles.note}>Paid by the school, not deducted from your salary.</Text>
        <Row label="EPF" value={formatRupees(slip.employerPf)} />
        <Row label="EPS" value={formatRupees(slip.employerEps)} />
        <Row label="EDLI" value={formatRupees(slip.employerEdli)} />
        <Row label="Admin charges" value={formatRupees(slip.employerAdminCharges)} />
        {Number(slip.employerEsi) > 0 ? (
          <Row label="ESI" value={formatRupees(slip.employerEsi)} />
        ) : null}
      </Card>
    </>
  );
}

export default function PayrollScreen({ homeRoute = '/teacher' }) {
  const [tab, setTab] = useState('latest');
  const [fy, setFy] = useState(currentLeaveYear);
  const [viewing, setViewing] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const { toast, showToast } = useToast();
  // Payslips carry the full salary breakup, statutory numbers and a masked bank account, so the
  // screen opens locked. Re-masks on blur — see hooks/useSensitiveReveal.js for why that matters.
  const sensitive = useSensitiveReveal({
    title: 'Show your payslips?',
    message:
      'Payslips contain your salary breakup, statutory deductions and bank details. Make sure '
      + 'nobody else can see your screen.',
  });

  const fetcher = useCallback((signal) => fetchPayslips(fy, signal), [fy]);
  const { data, loading, error, refreshing, reload, refresh } = useStaffResource(fetcher, {
    initialData: { financialYears: [], payslips: [] },
  });

  const payslips = data?.payslips || [];
  // The selected year is always offered even when the server lists no payslips for it.
  const years = useMemo(() => {
    const list = data?.financialYears || [];
    return list.includes(fy) ? list : [fy, ...list];
  }, [data, fy]);

  const totals = useMemo(
    () =>
      payslips.reduce(
        (acc, s) => ({
          gross: acc.gross + Number(s.grossEarnings || 0),
          deductions: acc.deductions + Number(s.totalDeductions || 0),
          net: acc.net + Number(s.netPay || 0),
        }),
        { gross: 0, deductions: 0, net: 0 },
      ),
    [payslips],
  );

  const download = async (slip) => {
    // Confirmed separately from the on-screen reveal: a downloaded PDF outlives this screen and
    // can be shared out of the app, which is a different decision from looking at it here.
    if (!(await confirmPayslipExport())) return;
    setDownloadingId(slip.id);
    try {
      const filename = `payslip-${slip.periodYear}-${String(slip.periodMonth).padStart(2, '0')}.pdf`;
      const { shared } = await downloadAndShare(payslipPdfPath(slip.id), filename);
      if (!shared) showToast('Saved, but sharing is unavailable on this device.', 'info');
    } catch (e) {
      showToast(e?.message || 'Could not download the payslip.', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <ScreenScaffold
      title="Payroll Management"
      fallbackRoute={homeRoute}
      loading={loading}
      error={payslips.length === 0 && error ? error : ''}
      notice={payslips.length > 0 && error ? error : ''}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
      toast={toast}
    >
      <View style={styles.toolbar}>
        <Select
          variant="chip"
          label="Financial year"
          value={fy}
          options={years.map((y) => ({ value: y, label: `FY ${y}` }))}
          onChange={setFy}
        />
      </View>

      <SegmentedTabs options={TABS} value={tab} onChange={setTab} style={styles.tabs} />

      <SensitiveGate
        revealed={sensitive.revealed}
        onReveal={sensitive.reveal}
        onHide={sensitive.hide}
        title="Payslips are hidden"
        message="Your salary breakup, statutory deductions and bank details are on this screen."
        actionLabel="Show payslips"
      >
      {payslips.length === 0 ? (
        <EmptyState
          icon="receipt-outline"
          title={`No payslips for FY ${fy}`}
          message="Payslips appear here once your school releases that month's payroll."
        />
      ) : tab === 'latest' ? (
        <PayslipDetail
          slip={payslips[0]}
          onDownload={download}
          downloading={downloadingId === payslips[0]?.id}
        />
      ) : (
        <>
          {payslips.map((slip) => (
            <Card key={slip.id}>
              <View style={styles.yearHead}>
                <Text style={styles.yearMonth}>
                  {formatPeriod(slip.periodYear, slip.periodMonth)}
                </Text>
                <Text style={styles.yearNet}>{formatRupees(slip.netPay)}</Text>
              </View>
              <View style={styles.yearStats}>
                <Text style={styles.yearStat}>Gross {formatRupees(slip.grossEarnings)}</Text>
                <Text style={styles.yearStat}>
                  Deductions {formatRupees(slip.totalDeductions)}
                </Text>
                <Text style={styles.yearStat}>Paid {formatDays(slip.paidDays)} days</Text>
              </View>
              <View style={styles.yearActions}>
                <Pressable
                  onPress={() => setViewing(slip)}
                  style={({ pressed }) => [styles.viewBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <Text style={styles.viewText}>View</Text>
                </Pressable>
                <Pressable
                  onPress={() => download(slip)}
                  disabled={downloadingId === slip.id}
                  style={({ pressed }) => [styles.pdfBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  {downloadingId === slip.id ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="download-outline" size={15} color="#ffffff" />
                      <Text style={styles.pdfText}>PDF</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </Card>
          ))}

          <Card>
            <CardTitle>Year to date</CardTitle>
            <Row label="Gross" value={formatRupees(totals.gross)} />
            <Row label="Deductions" value={formatRupees(totals.deductions)} />
            <View style={styles.divider} />
            <Row label="Net" value={formatRupees(totals.net)} strong />
          </Card>
        </>
      )}
      </SensitiveGate>

      <FormSheet
        visible={!!viewing}
        title={viewing ? formatPeriod(viewing.periodYear, viewing.periodMonth) : 'Payslip'}
        subtitle={viewing?.payslipNumber}
        onClose={() => setViewing(null)}
        fullHeight
      >
        <PayslipDetail
          slip={viewing}
          onDownload={download}
          downloading={downloadingId === viewing?.id}
        />
      </FormSheet>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row' },
  tabs: { marginTop: SPACING.md },
  empty: { fontSize: 12.5, color: SLATE[400], fontStyle: 'italic' },
  note: { fontSize: 11.5, color: SLATE[500], fontStyle: 'italic', marginBottom: 6 },
  divider: { height: 1, backgroundColor: SLATE[200], marginVertical: 7 },

  slipHead: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  slipText: { flex: 1 },
  slipPeriod: { fontSize: 17, fontWeight: '800', color: SLATE[800] },
  slipMeta: { fontSize: 11.5, color: SLATE[500], marginTop: 2 },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 9,
    backgroundColor: PALETTE.primaryDark,
    minWidth: 68,
    justifyContent: 'center',
  },
  pdfText: { fontSize: 12.5, fontWeight: '700', color: '#ffffff' },

  facts: { flexDirection: 'row', flexWrap: 'wrap', marginTop: SPACING.md },
  fact: { width: '50%', paddingVertical: 5 },
  factLabel: { fontSize: 10.5, color: SLATE[500], fontWeight: '600', textTransform: 'uppercase' },
  factValue: { fontSize: 13, color: SLATE[800], marginTop: 1 },

  daysStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  dayStat: { fontSize: 12, color: SLATE[600], fontWeight: '600' },
  lop: { color: '#b45309' },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  rowLabel: { flex: 1, fontSize: 13, color: SLATE[600] },
  rowValue: { fontSize: 13, color: SLATE[800], fontWeight: '600' },
  rowStrong: { fontWeight: '800', color: SLATE[900] },

  netRow: { flexDirection: 'row', alignItems: 'center' },
  netLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: SLATE[700] },
  netValue: { fontSize: 20, fontWeight: '800', color: PALETTE.primaryDark },
  netWords: { fontSize: 11.5, color: SLATE[500], fontStyle: 'italic', marginTop: 4 },

  yearHead: { flexDirection: 'row', alignItems: 'baseline', gap: SPACING.sm },
  yearMonth: { flex: 1, fontSize: 15, fontWeight: '700', color: SLATE[800] },
  yearNet: { fontSize: 15, fontWeight: '800', color: PALETTE.primaryDark },
  yearStats: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginTop: 6 },
  yearStat: { fontSize: 11.5, color: SLATE[500], fontWeight: '600' },
  yearActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  viewBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: SLATE[200],
  },
  viewText: { fontSize: 12.5, fontWeight: '700', color: PALETTE.primaryDark },

  pressed: { opacity: 0.72 },
});
