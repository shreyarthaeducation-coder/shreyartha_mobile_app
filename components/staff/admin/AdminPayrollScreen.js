import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import {
  Card,
  EmptyState,
  FormSheet,
  ScreenScaffold,
  SegmentedTabs,
  Select,
  SensitiveGate,
  StatusChip,
  useToast,
} from '../../ui';
import { makeStyles } from '../../../utils/makeStyles';
import useSensitiveReveal from '../../../hooks/useSensitiveReveal';
import { MONTH_NAMES, formatPeriod, formatRupees } from '../../../utils/currency';
import { downloadAndShare } from '../../../utils/downloadFile';
import {
  adminPayslipPdfPath,
  fetchEmployeeProfile,
  fetchEmployees,
  fetchPayrollRun,
  fetchPayrollRuns,
  fetchSalaryStructure,
  lockPayrollRun,
  markPayrollRunPaid,
  previewSalary,
  runPayroll,
  saveSalaryStructure,
} from '../../../services/admin/hrAdminService';

/**
 * Payroll Management — salary structures and payroll runs.
 *
 * Ports School/Admin/pages/AdminPayrollManagement.js.
 *
 * ── NOT components/staff/PayrollScreen.js ───────────────────────────────────
 * That one is `/api/staff/hr/payslips` — MY payslips. This is `/api/school-admin/hr` — setting
 * everyone's salary and computing the month.
 *
 * ── DRAFT → LOCKED → PAID, AND LOCKING IS THE IRREVERSIBLE STEP ─────────────
 * Computing a run creates a DRAFT that can be recomputed freely. **Locking is what makes payslips
 * visible to staff** and freezes the figures; "Mark as Paid" is only a bookkeeping flag afterwards.
 * The web guards the lock with `window.confirm`, which does not exist in React Native — an `Alert`
 * confirmation replaces it, because losing that guard would make an irreversible action a
 * single tap.
 */

const TABS = [
  { value: 'employees', label: 'Salary Structures' },
  { value: 'runs', label: 'Payroll Runs' },
];

const RUN_TONE = { DRAFT: 'warning', LOCKED: 'info', PAID: 'success' };

const LOP_BASIS = [
  { value: 'FIXED_30', label: 'Fixed 30 days' },
  { value: 'CALENDAR', label: 'Calendar days' },
  { value: 'WORKING_DAYS', label: 'Working days' },
];

/**
 * The first of the current month, from LOCAL calendar fields.
 *
 * The web does `new Date().toISOString().slice(0, 8) + "01"`, which reads the month in UTC — at
 * 00:30 IST on the 1st that is still the previous month, so the structure would take effect a month
 * early. Same family as the `toISOString()` bug the parent calendar shipped once.
 */
function firstOfThisMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

const EMPTY_SALARY = {
  monthlyGross: '',
  effectiveFrom: '',
  autoDeriveBreakup: true,
  includeConveyance: true,
  pfApplicable: true,
  pfOnFullBasic: false,
  esiApplicable: false,
  ptApplicable: true,
  lopBasis: 'FIXED_30',
  notes: '',
};

function ToggleRow({ label, hint, value, onChange, disabled, styles, palette }) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint ? <Text style={styles.toggleHint}>{hint}</Text> : null}
      </View>
      <Switch
        value={!!value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: palette.primary }}
      />
    </View>
  );
}

export default function AdminPayrollScreen({ homeRoute = '/staff/principal' }) {
  const styles = useStyles();
  const palette = usePalette();
  const { toast, showToast } = useToast();
  const sensitive = useSensitiveReveal({
    title: 'Show employee salary details?',
    message:
      "This screen shows other employees' salary structures and statutory deductions. Only "
      + 'continue if nobody else can see your screen.',
  });

  const [tab, setTab] = useState('employees');
  const [employees, setEmployees] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Salary editor
  const [editing, setEditing] = useState(null);
  const [salary, setSalary] = useState(EMPTY_SALARY);
  const [metro, setMetro] = useState(false);
  const [preview, setPreview] = useState(null);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sheetError, setSheetError] = useState('');

  // Run detail
  const [openRun, setOpenRun] = useState(null);
  const [runDetail, setRunDetail] = useState(null);
  const [runLoading, setRunLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  // Compute controls
  const now = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(String(now.getFullYear()));
  const [running, setRunning] = useState(false);

  const load = useCallback(
    async (isRefresh) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        if (tab === 'employees') {
          const data = await fetchEmployees();
          setEmployees(Array.isArray(data) ? data : []);
        } else {
          const data = await fetchPayrollRuns();
          setRuns(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        setError(e?.message || 'Could not load payroll data.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [tab],
  );

  useEffect(() => {
    load();
  }, [load]);

  /* ── Salary editor ──────────────────────────────────────────────────────── */

  const openSalary = async (employee) => {
    setEditing(employee);
    setSheetError('');
    setPreview(null);
    setSalaryLoading(true);
    try {
      const [structure, profile] = await Promise.all([
        fetchSalaryStructure(employee.schoolUserId),
        fetchEmployeeProfile(employee.schoolUserId),
      ]);
      setMetro(!!profile?.metroHra);
      setSalary({
        ...EMPTY_SALARY,
        monthlyGross: structure?.configured ? String(structure.monthlyGross ?? '') : '',
        effectiveFrom: structure?.effectiveFrom || firstOfThisMonth(),
        pfApplicable: structure?.configured ? !!structure.pfApplicable : true,
        pfOnFullBasic: structure?.configured ? !!structure.pfOnFullBasic : false,
        esiApplicable: structure?.configured ? !!structure.esiApplicable : false,
        ptApplicable: structure?.configured ? !!structure.ptApplicable : true,
        lopBasis: structure?.lopBasis || 'FIXED_30',
        notes: structure?.notes || '',
      });
    } catch (e) {
      setSheetError(e?.message || 'Could not load the salary structure.');
    } finally {
      setSalaryLoading(false);
    }
  };

  // Live breakup preview, debounced so typing does not spam the API — the web does the same at
  // 350 ms. A failed preview is silent: it is an aid, not a gate on saving.
  useEffect(() => {
    const gross = Number(salary.monthlyGross);
    if (!editing || !gross || gross <= 0) {
      setPreview(null);
      return undefined;
    }
    let alive = true;
    const id = setTimeout(async () => {
      try {
        const data = await previewSalary({
          monthlyGross: gross,
          metro,
          includeConveyance: salary.includeConveyance,
        });
        if (alive) setPreview(data);
      } catch {
        if (alive) setPreview(null);
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [editing, salary.monthlyGross, salary.includeConveyance, metro]);

  const submitSalary = async () => {
    if (!editing) return;
    const gross = Number(salary.monthlyGross);
    if (!Number.isFinite(gross) || gross <= 0) {
      setSheetError('Enter a monthly gross greater than zero.');
      return;
    }
    setSaving(true);
    setSheetError('');
    try {
      await saveSalaryStructure(editing.schoolUserId, { ...salary, monthlyGross: gross });
      const name = editing.fullName;
      setEditing(null);
      showToast(`Salary saved for ${name}.`);
      load();
    } catch (e) {
      setSheetError(e?.message || 'Could not save the salary structure.');
    } finally {
      setSaving(false);
    }
  };

  /* ── Runs ───────────────────────────────────────────────────────────────── */

  const compute = async () => {
    const y = Number(year);
    if (!Number.isFinite(y) || y < 2000 || y > 2100) {
      showToast('Enter a valid year.', 'error');
      return;
    }
    setRunning(true);
    try {
      const result = await runPayroll(y, Number(month));
      const skipped = Array.isArray(result?.skipped) ? result.skipped : [];
      showToast(
        `Computed ${result?.employeeCount ?? 0} payslip(s) for ${MONTH_NAMES[month - 1]} ${y}.` +
          (skipped.length ? ` Skipped: ${skipped.join('; ')}.` : ''),
      );
      load();
    } catch (e) {
      showToast(e?.message || 'Could not run payroll.', 'error');
    } finally {
      setRunning(false);
    }
  };

  const openRunDetail = async (run) => {
    setOpenRun(run);
    setRunDetail(null);
    setSheetError('');
    setRunLoading(true);
    try {
      setRunDetail(await fetchPayrollRun(run.id));
    } catch (e) {
      setSheetError(e?.message || 'Could not load the payroll run.');
    } finally {
      setRunLoading(false);
    }
  };

  const doLock = async () => {
    if (!openRun) return;
    setBusy(true);
    try {
      await lockPayrollRun(openRun.id);
      setOpenRun(null);
      showToast('Payroll locked. Payslips are now visible to staff.');
      load();
    } catch (e) {
      setSheetError(e?.message || 'Could not lock the run.');
    } finally {
      setBusy(false);
    }
  };

  // `window.confirm` does not exist in React Native, and this action cannot be undone.
  const confirmLock = () => {
    Alert.alert(
      'Lock this payroll run?',
      'Payslips become visible to staff and the figures can no longer change.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Lock & Release', style: 'destructive', onPress: doLock },
      ],
    );
  };

  const markPaid = async () => {
    if (!openRun) return;
    setBusy(true);
    try {
      await markPayrollRunPaid(openRun.id);
      setOpenRun(null);
      showToast('Payroll marked as paid.');
      load();
    } catch (e) {
      setSheetError(e?.message || 'Could not mark the run paid.');
    } finally {
      setBusy(false);
    }
  };

  const downloadSlip = async (slip) => {
    setDownloadingId(slip.id);
    try {
      const safeName = String(slip.employeeName || 'payslip').replace(/[^A-Za-z0-9-]+/g, '-');
      const filename = `payslip-${safeName}-${slip.periodYear}-${String(slip.periodMonth).padStart(2, '0')}.pdf`;
      const { shared } = await downloadAndShare(adminPayslipPdfPath(slip.id), filename);
      if (!shared) showToast('Saved, but sharing is unavailable on this device.', 'info');
    } catch (e) {
      setSheetError(e?.message || 'Could not download the payslip.');
    } finally {
      setDownloadingId(null);
    }
  };

  /* ── Render ─────────────────────────────────────────────────────────────── */

  const monthOptions = MONTH_NAMES.map((m, i) => ({ value: i + 1, label: m }));

  let body;
  if (tab === 'employees') {
    body = employees.length ? (
      employees.map((e) => (
        <Card key={e.schoolUserId} style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.cardHeadText}>
              <Text style={styles.name}>{e.fullName || '—'}</Text>
              <Text style={styles.sub}>{[e.userType, e.email].filter(Boolean).join(' · ')}</Text>
            </View>
            <Pressable
              onPress={() => openSalary(e)}
              hitSlop={8}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Edit salary for ${e.fullName}`}
            >
              <Ionicons name="create-outline" size={17} color={SLATE[600]} />
            </Pressable>
          </View>
          <View style={styles.grossRow}>
            <Text style={styles.grossLabel}>Monthly gross</Text>
            <Text style={[styles.gross, { color: palette.primaryDark }]}>
              {e.monthlyGross != null ? formatRupees(e.monthlyGross) : 'Not set'}
            </Text>
          </View>
        </Card>
      ))
    ) : (
      <EmptyState icon="people-outline" title="No employees on the payroll yet" />
    );
  } else {
    body = (
      <>
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Run payroll</Text>
          <Select label="Month" value={month} options={monthOptions} onChange={setMonth} />
          <Text style={styles.label}>Year</Text>
          <TextInput
            style={styles.input}
            value={year}
            onChangeText={setYear}
            keyboardType="number-pad"
            editable={!running}
          />
          <Pressable
            onPress={compute}
            disabled={running}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: palette.primary },
              (pressed || running) && styles.pressed,
            ]}
            accessibilityRole="button"
          >
            {running ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryText}>Compute Payroll</Text>
            )}
          </Pressable>
          <Text style={styles.hint}>
            Computing creates a draft you can review and recompute. Payslips only become visible to
            staff once the run is locked.
          </Text>
        </Card>

        {runs.length ? (
          runs.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => openRunDetail(r)}
              style={({ pressed }) => [pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Open payroll for ${formatPeriod(r.periodYear, r.periodMonth)}`}
            >
              <Card style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={styles.cardHeadText}>
                    <Text style={styles.name}>{formatPeriod(r.periodYear, r.periodMonth)}</Text>
                    <Text style={styles.sub}>{r.employeeCount ?? 0} employee(s)</Text>
                  </View>
                  <StatusChip label={r.status} tone={RUN_TONE[r.status] || 'neutral'} />
                </View>
                <View style={styles.figures}>
                  <View style={styles.figure}>
                    <Text style={styles.figureLabel}>Gross</Text>
                    <Text style={styles.figureValue}>{formatRupees(r.totalGross)}</Text>
                  </View>
                  <View style={styles.figure}>
                    <Text style={styles.figureLabel}>Deductions</Text>
                    <Text style={styles.figureValue}>{formatRupees(r.totalDeductions)}</Text>
                  </View>
                  <View style={styles.figure}>
                    <Text style={styles.figureLabel}>Net payable</Text>
                    <Text style={[styles.figureValue, { color: palette.primaryDark }]}>
                      {formatRupees(r.totalNet)}
                    </Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          ))
        ) : (
          <EmptyState icon="calculator-outline" title="No payroll has been run yet." />
        )}
      </>
    );
  }

  return (
    <>
      <ScreenScaffold
        title="Payroll Management"
        fallbackRoute={homeRoute}
        loading={loading}
        error={error}
        onRetry={load}
        refreshing={refreshing}
        onRefresh={() => load(true)}
        toast={toast}
      >
        <Text style={styles.intro}>
          Salary is split as Basic 50% of gross (Code on Wages), HRA 40% of Basic (50% in metros),
          with special allowance as the balance.
        </Text>

        <SegmentedTabs options={TABS} value={tab} onChange={setTab} />

        {/* This screen shows OTHER employees' salary structures and statutory deductions, so the
            confirmation names that explicitly — the consequence of leaving it on screen is not the
            viewer's own privacy. The explainer above stays visible; it contains no figures. */}
        <SensitiveGate
          revealed={sensitive.revealed}
          onReveal={sensitive.reveal}
          onHide={sensitive.hide}
          title="Employee salary details are hidden"
          message="This screen shows every employee's salary structure, deductions and payroll runs."
          actionLabel="Show payroll"
        >
          <View style={styles.body}>{body}</View>
        </SensitiveGate>
      </ScreenScaffold>

      {/* ── Salary editor ───────────────────────────────────────────────────── */}
      <FormSheet
        visible={!!editing}
        title="Salary structure"
        subtitle={editing?.fullName}
        onClose={() => setEditing(null)}
        onSubmit={submitSalary}
        submitLabel="Save salary"
        submitting={saving}
        submitDisabled={salaryLoading}
        fullHeight
      >
        {salaryLoading ? (
          <ActivityIndicator size="large" color={palette.primary} style={styles.sheetLoader} />
        ) : (
          <>
            <Text style={styles.label}>Monthly gross (₹)</Text>
            <TextInput
              style={styles.input}
              value={salary.monthlyGross}
              onChangeText={(monthlyGross) => setSalary((p) => ({ ...p, monthlyGross }))}
              placeholder="e.g. 45000"
              placeholderTextColor={SLATE[400]}
              keyboardType="number-pad"
              editable={!saving}
            />

            {preview ? (
              <View style={styles.preview}>
                <Text style={styles.previewTitle}>Derived breakup</Text>
                {[
                  ['Basic', preview.basic],
                  ['HRA', preview.hra],
                  ['Conveyance', preview.conveyance],
                  ['Special allowance', preview.specialAllowance],
                  ['Employee PF', preview.employeePf],
                  ['Professional tax', preview.professionalTax],
                  ['Net', preview.net],
                ]
                  .filter(([, v]) => v != null)
                  .map(([label, value]) => (
                    <View key={label} style={styles.previewRow}>
                      <Text style={styles.previewLabel}>{label}</Text>
                      <Text style={styles.previewValue}>{formatRupees(value)}</Text>
                    </View>
                  ))}
              </View>
            ) : null}

            <Text style={styles.label}>Effective from</Text>
            <TextInput
              style={styles.input}
              value={salary.effectiveFrom}
              onChangeText={(effectiveFrom) => setSalary((p) => ({ ...p, effectiveFrom }))}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={SLATE[400]}
              editable={!saving}
            />

            <ToggleRow
              label="Metro HRA"
              hint="50% of basic instead of 40%. Read from the employee's HR profile."
              value={metro}
              onChange={setMetro}
              disabled={saving}
              styles={styles}
              palette={palette}
            />
            <ToggleRow
              label="Include conveyance"
              value={salary.includeConveyance}
              onChange={(includeConveyance) => setSalary((p) => ({ ...p, includeConveyance }))}
              disabled={saving}
              styles={styles}
              palette={palette}
            />
            <ToggleRow
              label="PF applicable"
              value={salary.pfApplicable}
              onChange={(pfApplicable) => setSalary((p) => ({ ...p, pfApplicable }))}
              disabled={saving}
              styles={styles}
              palette={palette}
            />
            <ToggleRow
              label="PF on full basic"
              hint="Otherwise capped at the statutory wage ceiling."
              value={salary.pfOnFullBasic}
              onChange={(pfOnFullBasic) => setSalary((p) => ({ ...p, pfOnFullBasic }))}
              disabled={saving}
              styles={styles}
              palette={palette}
            />
            <ToggleRow
              label="ESI applicable"
              value={salary.esiApplicable}
              onChange={(esiApplicable) => setSalary((p) => ({ ...p, esiApplicable }))}
              disabled={saving}
              styles={styles}
              palette={palette}
            />
            <ToggleRow
              label="Professional tax"
              value={salary.ptApplicable}
              onChange={(ptApplicable) => setSalary((p) => ({ ...p, ptApplicable }))}
              disabled={saving}
              styles={styles}
              palette={palette}
            />

            <Select
              label="Loss-of-pay basis"
              value={salary.lopBasis}
              options={LOP_BASIS}
              onChange={(lopBasis) => setSalary((p) => ({ ...p, lopBasis }))}
            />

            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={styles.textarea}
              value={salary.notes}
              onChangeText={(notes) => setSalary((p) => ({ ...p, notes }))}
              placeholder="Internal notes (optional)"
              placeholderTextColor={SLATE[400]}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!saving}
            />
          </>
        )}
        {sheetError ? <Text style={styles.sheetError}>{sheetError}</Text> : null}
      </FormSheet>

      {/* ── Run detail ──────────────────────────────────────────────────────── */}
      <FormSheet
        visible={!!openRun}
        title={openRun ? formatPeriod(openRun.periodYear, openRun.periodMonth) : 'Payroll'}
        subtitle={runDetail ? `Net payable ${formatRupees(runDetail.totalNet)}` : undefined}
        onClose={() => setOpenRun(null)}
        fullHeight
      >
        {runLoading ? (
          <ActivityIndicator size="large" color={palette.primary} style={styles.sheetLoader} />
        ) : runDetail ? (
          <>
            <View style={styles.runActions}>
              {runDetail.status === 'DRAFT' ? (
                <Pressable
                  onPress={confirmLock}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    { backgroundColor: palette.primary },
                    (pressed || busy) && styles.pressed,
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryText}>Lock &amp; Release Payslips</Text>
                </Pressable>
              ) : null}
              {runDetail.status === 'LOCKED' ? (
                <Pressable
                  onPress={markPaid}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    { backgroundColor: FEEDBACK.successText },
                    (pressed || busy) && styles.pressed,
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryText}>Mark as Paid</Text>
                </Pressable>
              ) : null}
            </View>

            {(runDetail.payslips || []).map((slip) => (
              <View key={slip.id} style={styles.slipRow}>
                <View style={styles.slipText}>
                  <Text style={styles.slipName}>{slip.employeeName}</Text>
                  <Text style={styles.sub}>Net {formatRupees(slip.netPay)}</Text>
                </View>
                <Pressable
                  onPress={() => downloadSlip(slip)}
                  disabled={downloadingId === slip.id}
                  style={({ pressed }) => [
                    styles.pdfBtn,
                    { backgroundColor: palette.primary },
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Download payslip for ${slip.employeeName}`}
                >
                  {downloadingId === slip.id ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="download-outline" size={14} color="#ffffff" />
                      <Text style={styles.pdfText}>PDF</Text>
                    </>
                  )}
                </Pressable>
              </View>
            ))}

            {!(runDetail.payslips || []).length ? (
              <EmptyState icon="document-outline" title="This run produced no payslips." />
            ) : null}
          </>
        ) : (
          <EmptyState icon="alert-circle-outline" title="Payroll run not found." />
        )}
        {sheetError ? <Text style={styles.sheetError}>{sheetError}</Text> : null}
      </FormSheet>
    </>
  );
}

const useStyles = makeStyles((p) => ({
  intro: { fontSize: 13, color: SLATE[500], lineHeight: 19, marginBottom: SPACING.md },
  body: { marginTop: SPACING.md },
  card: { marginBottom: SPACING.sm },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  cardHeadText: { flex: 1 },
  name: { fontSize: 15, fontWeight: '800', color: SLATE[800] },
  sub: { fontSize: 12.5, color: SLATE[500], marginTop: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: SLATE[800], marginBottom: SPACING.sm },
  grossRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  grossLabel: { fontSize: 13, color: SLATE[500] },
  gross: { fontSize: 15, fontWeight: '800' },
  figures: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  figure: { flex: 1 },
  figureLabel: { fontSize: 11.5, color: SLATE[500] },
  figureValue: { fontSize: 13.5, fontWeight: '700', color: SLATE[800], marginTop: 2 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: p.tint,
  },
  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  primaryText: { color: '#ffffff', fontSize: 14.5, fontWeight: '700' },
  hint: { fontSize: 12, color: SLATE[500], lineHeight: 18, marginTop: SPACING.sm },
  pressed: { opacity: 0.75 },

  runActions: { marginBottom: SPACING.md },
  slipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: SLATE[100],
  },
  slipText: { flex: 1 },
  slipName: { fontSize: 14, fontWeight: '700', color: SLATE[800] },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    minWidth: 68,
    justifyContent: 'center',
  },
  pdfText: { color: '#ffffff', fontSize: 12.5, fontWeight: '700' },

  preview: {
    marginTop: SPACING.md,
    backgroundColor: p.tint,
    borderRadius: 12,
    padding: SPACING.sm,
  },
  previewTitle: { fontSize: 12.5, fontWeight: '800', color: SLATE[700], marginBottom: 6 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  previewLabel: { fontSize: 12.5, color: SLATE[600] },
  previewValue: { fontSize: 12.5, fontWeight: '700', color: SLATE[800] },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  toggleText: { flex: 1 },
  toggleLabel: { fontSize: 13.5, fontWeight: '700', color: SLATE[700] },
  toggleHint: { fontSize: 11.5, color: SLATE[500], marginTop: 2, lineHeight: 16 },

  label: {
    fontSize: 13,
    fontWeight: '700',
    color: SLATE[700],
    marginTop: SPACING.md,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14.5,
    color: SLATE[800],
    backgroundColor: '#ffffff',
  },
  textarea: {
    minHeight: 84,
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14.5,
    color: SLATE[800],
    backgroundColor: '#ffffff',
  },
  sheetLoader: { marginVertical: SPACING.xl },
  sheetError: { color: FEEDBACK.errorText, fontSize: 12.5, marginTop: SPACING.sm },
}));
