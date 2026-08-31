import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import {
  Card,
  DateTimeField,
  EmptyState,
  FormSheet,
  ScreenScaffold,
  SegmentedTabs,
  Select,
  StatusChip,
  useToast,
} from '../../ui';
import { makeStyles } from '../../../utils/makeStyles';
import { formatRupees, formatShortDate } from '../../../utils/currency';
import { toIsoDate } from '../../../utils/dates';
import {
  assignStudents,
  createStructure,
  deleteStructure,
  fetchFeeDashboard,
  fetchFeeRecord,
  fetchFeeRecords,
  fetchPayments,
  fetchRazorpayConfig,
  fetchStructures,
  logOfflinePayment,
  saveRazorpayConfig,
  updateStructure,
} from '../../../services/admin/schoolFeeAdminService';
import { fetchStudents } from '../../../services/admin/studentService';

/**
 * Fee Management — the school-admin side of school fees.
 *
 * Ports School/Admin/pages/FeeManagement.js (1,113 lines, four tabs). This is the ADMIN half; the
 * parent's `components/parent/FeesScreen.js` is the payer half, and the two share no code because
 * they share no endpoints.
 *
 * ── PRINCIPAL ONLY, NOT VICE PRINCIPAL ──────────────────────────────────────
 * `SchoolAdminFeeController` is `hasRole('SCHOOL_ADMIN')` on every method, and a Principal reaches
 * it through `PRINCIPAL implies SCHOOL_ADMIN`. A VP implies only TEACHER, so this screen must never
 * be on the VP menu — see constants/staffRoles.js and scripts/checkadminhr.mjs.
 *
 * ── ACADEMIC YEAR IS AN EXACT STRING MATCH ──────────────────────────────────
 * The server compares `academicYear` literally: "2025-26" and "2025-2026" are different years and
 * the second returns nothing rather than erroring. The default is built from local calendar fields,
 * never `toISOString()`.
 */

const TABS = [
  { value: 'setup', label: 'Setup' },
  { value: 'students', label: 'Student Fees' },
  { value: 'payments', label: 'Payments' },
  { value: 'due', label: 'Due & Overdue' },
];

const FREQUENCIES = [
  { value: 'ANNUAL', label: 'Annual · 1 payment' },
  { value: 'QUARTERLY', label: 'Quarterly · 4 payments' },
  { value: 'MONTHLY', label: 'Monthly · 12 payments' },
];

const RECORD_STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'PAID', label: 'Paid' },
  { value: 'OVERDUE', label: 'Overdue' },
];

const PAYMENT_MODES = [
  { value: '', label: 'All modes' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
];

const RECORD_TONE = {
  PAID: 'success',
  PARTIAL: 'warning',
  PENDING: 'neutral',
  OVERDUE: 'error',
};

/** "2026-27", from LOCAL calendar fields — the web builds the same string. */
function defaultAcademicYear() {
  const y = new Date().getFullYear();
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
}

const EMPTY_STRUCTURE = {
  academicYear: '',
  className: '',
  totalAmount: '',
  paymentFrequency: 'ANNUAL',
  installmentCount: '1',
  firstDueDate: '',
  dayOfMonth: '',
  lateFeePerDay: '0',
  notes: '',
};

const EMPTY_OFFLINE = { amount: '', installmentId: '', paymentDate: '', adminNotes: '' };

/**
 * @param {object} props
 * @param {string} [props.initialTab] which tab to open on. The Principal's home has two fee cards —
 *   Total Fees Collected and Fees Pending — and they are two views of THIS screen rather than two
 *   screens, so each deep-links to its own tab. Anything not in `TABS` is ignored rather than
 *   trusted: the value arrives from a URL, and an unrecognised one would otherwise render a screen
 *   with every tab inactive and no content at all.
 */
export default function FeeManagementScreen({ homeRoute = '/staff/principal', apiBase, initialTab }) {
  const styles = useStyles();
  const palette = usePalette();
  const { toast, showToast } = useToast();

  const [tab, setTab] = useState(
    TABS.some((t) => t.value === initialTab) ? initialTab : 'setup',
  );
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Setup
  const [config, setConfig] = useState(null);
  const [configForm, setConfigForm] = useState({ keyId: '', keySecret: '', webhookSecret: '' });
  const [structures, setStructures] = useState([]);
  const [structureSheet, setStructureSheet] = useState(null); // null | {} | existing
  const [structureForm, setStructureForm] = useState(EMPTY_STRUCTURE);
  const [assigning, setAssigning] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);

  // Records
  const [records, setRecords] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [offlineForm, setOfflineForm] = useState(EMPTY_OFFLINE);

  // Payments
  const [payments, setPayments] = useState([]);
  const [mode, setMode] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // Due & Overdue
  const [dashboard, setDashboard] = useState(null);
  const [overdue, setOverdue] = useState([]);

  const [saving, setSaving] = useState(false);
  const [sheetError, setSheetError] = useState('');

  const load = useCallback(
    async (isRefresh) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        if (tab === 'setup') {
          const [cfg, list] = await Promise.all([
            fetchRazorpayConfig().catch(() => null),
            fetchStructures(),
          ]);
          setConfig(cfg);
          setStructures(Array.isArray(list) ? list : []);
        } else if (tab === 'students') {
          const data = await fetchFeeRecords(academicYear, statusFilter);
          setRecords(Array.isArray(data) ? data : []);
        } else if (tab === 'payments') {
          const data = await fetchPayments({ mode, from, to });
          setPayments(Array.isArray(data) ? data : []);
        } else {
          const [dash, od] = await Promise.all([
            fetchFeeDashboard(academicYear),
            fetchFeeRecords(academicYear, 'OVERDUE'),
          ]);
          setDashboard(dash);
          setOverdue(Array.isArray(od) ? od : []);
        }
      } catch (e) {
        setError(e?.message || 'Could not load fee data.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [tab, academicYear, statusFilter, mode, from, to],
  );

  useEffect(() => {
    load();
  }, [load]);

  /* ── Setup: Razorpay ────────────────────────────────────────────────────── */

  const submitConfig = async () => {
    if (!configForm.keyId.trim() || !configForm.keySecret.trim()) {
      showToast('Key ID and Key Secret are both required.', 'error');
      return;
    }
    setSaving(true);
    try {
      const saved = await saveRazorpayConfig(configForm);
      setConfig(saved);
      // Never keep the secrets in state after a successful save.
      setConfigForm({ keyId: '', keySecret: '', webhookSecret: '' });
      showToast('Razorpay credentials saved.');
    } catch (e) {
      showToast(e?.message || 'Failed to save credentials.', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ── Setup: structures ──────────────────────────────────────────────────── */

  const openStructure = (existing) => {
    setStructureForm(
      existing
        ? {
            academicYear: existing.academicYear || academicYear,
            className: existing.className || '',
            totalAmount: String(existing.totalAmount ?? ''),
            paymentFrequency: existing.paymentFrequency || 'ANNUAL',
            installmentCount: String(existing.installmentCount ?? 1),
            firstDueDate: existing.firstDueDate || '',
            dayOfMonth: existing.dayOfMonth != null ? String(existing.dayOfMonth) : '',
            lateFeePerDay: String(existing.lateFeePerDay ?? 0),
            notes: existing.notes || '',
          }
        : { ...EMPTY_STRUCTURE, academicYear },
    );
    setSheetError('');
    setStructureSheet(existing || {});
  };

  const submitStructure = async () => {
    const total = Number(structureForm.totalAmount);
    if (!structureForm.academicYear.trim()) {
      setSheetError('Academic year is required.');
      return;
    }
    if (!structureForm.className.trim()) {
      setSheetError('Class is required.');
      return;
    }
    if (!Number.isFinite(total) || total <= 0) {
      setSheetError('Enter a total greater than zero.');
      return;
    }
    if (!structureForm.firstDueDate) {
      setSheetError('First due date is required.');
      return;
    }
    setSaving(true);
    setSheetError('');
    try {
      const payload = {
        ...structureForm,
        totalAmount: total,
        installmentCount: Number(structureForm.installmentCount) || 1,
        dayOfMonth: structureForm.dayOfMonth !== '' ? Number(structureForm.dayOfMonth) : null,
        lateFeePerDay: structureForm.lateFeePerDay !== '' ? Number(structureForm.lateFeePerDay) : 0,
        notes: structureForm.notes || null,
      };
      if (structureSheet?.id) await updateStructure(structureSheet.id, payload);
      else await createStructure(payload);
      setStructureSheet(null);
      showToast('Fee structure saved.');
      load();
    } catch (e) {
      setSheetError(e?.message || 'Failed to save. Please check all fields.');
    } finally {
      setSaving(false);
    }
  };

  // `window.confirm` has no React Native equivalent, and this delete is permanent.
  const confirmDeleteStructure = (structure) => {
    Alert.alert(
      'Delete this fee structure?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteStructure(structure.id);
              setStructures((prev) => prev.filter((s) => s.id !== structure.id));
              showToast('Structure deleted.');
            } catch (e) {
              showToast(e?.message || 'Failed to delete.', 'error');
            }
          },
        },
      ],
    );
  };

  /* ── Setup: assign students ─────────────────────────────────────────────── */

  const openAssign = async (structure) => {
    setAssigning(structure);
    setSelectedStudents([]);
    setSheetError('');
    setSaving(true);
    try {
      // Not a fee route — the roster lives under the descriptor's `classes` base, and
      // services/admin/studentService already unwraps its { stats, students } envelope.
      const { students: roster } = await fetchStudents(apiBase);
      setStudents(roster);
    } catch (e) {
      setSheetError(e?.message || 'Could not load the student list.');
    } finally {
      setSaving(false);
    }
  };

  const submitAssign = async () => {
    if (!assigning || !selectedStudents.length) {
      setSheetError('Select at least one student.');
      return;
    }
    setSaving(true);
    setSheetError('');
    try {
      await assignStudents(assigning.id, selectedStudents);
      const count = selectedStudents.length;
      setAssigning(null);
      showToast(`Assigned to ${count} student${count === 1 ? '' : 's'}.`);
    } catch (e) {
      setSheetError(e?.message || 'Could not assign the structure.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStudent = (id) =>
    setSelectedStudents((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  /* ── Records ────────────────────────────────────────────────────────────── */

  const openDetail = async (record) => {
    setDetail({ record });
    setOfflineForm(EMPTY_OFFLINE);
    setSheetError('');
    setDetailLoading(true);
    try {
      setDetail(await fetchFeeRecord(record.id));
    } catch (e) {
      setSheetError(e?.message || 'Could not load the fee record.');
    } finally {
      setDetailLoading(false);
    }
  };

  const submitOffline = async () => {
    const amount = Number(offlineForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setSheetError('Enter an amount greater than zero.');
      return;
    }
    const recordId = detail?.record?.id ?? detail?.id;
    setSaving(true);
    setSheetError('');
    try {
      await logOfflinePayment({
        feeRecordId: recordId,
        amount,
        installmentId: offlineForm.installmentId ? Number(offlineForm.installmentId) : null,
        paymentDate: offlineForm.paymentDate || null,
        adminNotes: offlineForm.adminNotes || null,
      });
      setDetail(null);
      showToast('Offline payment recorded.');
      load();
    } catch (e) {
      setSheetError(e?.message || 'Could not record the payment.');
    } finally {
      setSaving(false);
    }
  };

  /* ── Render ─────────────────────────────────────────────────────────────── */

  const visibleRecords = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return records;
    return records.filter((r) =>
      [r.studentName, r.className, r.section, r.studentEmail]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle)),
    );
  }, [records, search]);

  const configured = config && config.configured !== false;

  const recordCard = (r) => (
    <Pressable
      key={r.id}
      onPress={() => openDetail(r)}
      style={({ pressed }) => [pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Open fee record for ${r.studentName}`}
    >
      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.cardHeadText}>
            <Text style={styles.name}>{r.studentName || '—'}</Text>
            <Text style={styles.sub}>
              {[r.className, r.section].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <StatusChip label={r.status} tone={RECORD_TONE[r.status] || 'neutral'} />
        </View>
        <View style={styles.figures}>
          <View style={styles.figure}>
            <Text style={styles.figureLabel}>Billed</Text>
            <Text style={styles.figureValue}>{formatRupees(r.totalAmount)}</Text>
          </View>
          <View style={styles.figure}>
            <Text style={styles.figureLabel}>Paid</Text>
            <Text style={styles.figureValue}>{formatRupees(r.paidAmount)}</Text>
          </View>
          <View style={styles.figure}>
            <Text style={styles.figureLabel}>Balance</Text>
            <Text style={[styles.figureValue, { color: palette.primaryDark }]}>
              {formatRupees(r.balanceAmount)}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );

  let body;
  if (tab === 'setup') {
    body = (
      <>
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>School Razorpay credentials</Text>
          <Text style={styles.hint}>
            Payments go directly to your school&apos;s Razorpay account.
          </Text>

          {configured ? (
            <View style={styles.statusBox}>
              <View style={[styles.statusDot, { backgroundColor: FEEDBACK.successText }]} />
              <Text style={styles.statusText}>
                Connected · Key ID {config.keyId} · {config.active ? 'Active' : 'Inactive'}
              </Text>
            </View>
          ) : (
            <View style={[styles.statusBox, styles.statusMissing]}>
              <Text style={styles.statusText}>
                No credentials configured yet. Add them below.
              </Text>
            </View>
          )}

          <Text style={styles.label}>Razorpay Key ID</Text>
          <TextInput
            style={styles.input}
            value={configForm.keyId}
            onChangeText={(keyId) => setConfigForm((f) => ({ ...f, keyId }))}
            placeholder="rzp_live_..."
            placeholderTextColor={SLATE[400]}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!saving}
          />

          <Text style={styles.label}>Razorpay Key Secret</Text>
          <TextInput
            style={styles.input}
            value={configForm.keySecret}
            onChangeText={(keySecret) => setConfigForm((f) => ({ ...f, keySecret }))}
            placeholder="Key Secret"
            placeholderTextColor={SLATE[400]}
            secureTextEntry
            autoCapitalize="none"
            editable={!saving}
          />

          <Text style={styles.label}>Webhook Secret</Text>
          <TextInput
            style={styles.input}
            value={configForm.webhookSecret}
            onChangeText={(webhookSecret) => setConfigForm((f) => ({ ...f, webhookSecret }))}
            placeholder="Webhook Secret"
            placeholderTextColor={SLATE[400]}
            secureTextEntry
            autoCapitalize="none"
            editable={!saving}
          />

          <Pressable
            onPress={submitConfig}
            disabled={saving}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: palette.primary },
              (pressed || saving) && styles.pressed,
            ]}
            accessibilityRole="button"
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryText}>Save credentials</Text>
            )}
          </Pressable>
        </Card>

        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Fee structures</Text>
          <Pressable
            onPress={() => openStructure(null)}
            style={({ pressed }) => [
              styles.addBtn,
              { backgroundColor: palette.primary },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Add a fee structure"
          >
            <Ionicons name="add" size={16} color="#ffffff" />
            <Text style={styles.addText}>New</Text>
          </Pressable>
        </View>

        {structures.length ? (
          structures.map((s) => (
            <Card key={s.id} style={styles.card}>
              <View style={styles.cardHead}>
                <View style={styles.cardHeadText}>
                  <Text style={styles.name}>{s.className}</Text>
                  <Text style={styles.sub}>
                    {s.academicYear} · {s.paymentFrequency} · {s.installmentCount} installment
                    {s.installmentCount === 1 ? '' : 's'}
                  </Text>
                </View>
                <Text style={[styles.gross, { color: palette.primaryDark }]}>
                  {formatRupees(s.totalAmount)}
                </Text>
              </View>
              <View style={styles.structureActions}>
                <Pressable
                  onPress={() => openAssign(s)}
                  style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <Text style={styles.ghostText}>Assign students</Text>
                </Pressable>
                <Pressable
                  onPress={() => openStructure(s)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${s.className} structure`}
                >
                  <Ionicons name="create-outline" size={17} color={SLATE[600]} />
                </Pressable>
                <Pressable
                  onPress={() => confirmDeleteStructure(s)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${s.className} structure`}
                >
                  <Ionicons name="trash-outline" size={17} color={FEEDBACK.errorText} />
                </Pressable>
              </View>
            </Card>
          ))
        ) : (
          <EmptyState icon="pricetags-outline" title="No fee structures yet" />
        )}
      </>
    );
  } else if (tab === 'students') {
    body = (
      <>
        <Text style={styles.label}>Academic year</Text>
        <TextInput
          style={styles.input}
          value={academicYear}
          onChangeText={setAcademicYear}
          placeholder="2026-27"
          placeholderTextColor={SLATE[400]}
          autoCapitalize="none"
        />
        <Select
          label="Status"
          value={statusFilter}
          options={RECORD_STATUSES}
          onChange={setStatusFilter}
        />
        <Text style={styles.label}>Search</Text>
        <TextInput
          style={styles.input}
          value={search}
          onChangeText={setSearch}
          placeholder="Student name, class or email"
          placeholderTextColor={SLATE[400]}
          autoCapitalize="none"
        />

        <View style={styles.body}>
          {visibleRecords.length ? (
            visibleRecords.map(recordCard)
          ) : (
            <EmptyState icon="school-outline" title="No fee records match" />
          )}
        </View>
      </>
    );
  } else if (tab === 'payments') {
    body = (
      <>
        <Select label="Mode" value={mode} options={PAYMENT_MODES} onChange={setMode} />
        <DateTimeField
          label="From"
          mode="date"
          value={from}
          onChange={(v) => setFrom(v ? v.slice(0, 10) : '')}
          clearable
          placeholder="Any date"
        />
        <DateTimeField
          label="To"
          mode="date"
          value={to}
          onChange={(v) => setTo(v ? v.slice(0, 10) : '')}
          clearable
          placeholder="Any date"
        />

        <View style={styles.body}>
          {payments.length ? (
            payments.map((pmt) => (
              <Card key={pmt.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={styles.cardHeadText}>
                    <Text style={styles.name}>{pmt.studentName || '—'}</Text>
                    <Text style={styles.sub}>
                      {[pmt.paymentMode, formatShortDate(pmt.paymentDate || pmt.createdAt)]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <Text style={[styles.gross, { color: palette.primaryDark }]}>
                    {formatRupees(pmt.amount)}
                  </Text>
                </View>
                {pmt.razorpayOrderId ? (
                  <Text style={styles.sub}>Order {pmt.razorpayOrderId}</Text>
                ) : null}
                {pmt.adminNotes ? <Text style={styles.reason}>{pmt.adminNotes}</Text> : null}
              </Card>
            ))
          ) : (
            <EmptyState icon="card-outline" title="No payments in this range" />
          )}
        </View>
      </>
    );
  } else {
    const stats = [
      { key: 'totalBilled', label: 'Total billed', currency: true },
      { key: 'totalCollected', label: 'Collected', currency: true },
      { key: 'outstanding', label: 'Outstanding', currency: true },
      { key: 'overdueCount', label: 'Overdue students', currency: false },
      { key: 'upcomingIn7Days', label: 'Due in 7 days', currency: false },
    ];
    body = (
      <>
        {dashboard ? (
          <View style={styles.statGrid}>
            {stats.map((s) => (
              <View key={s.key} style={styles.statCard}>
                <Text style={styles.statLabel}>{s.label}</Text>
                <Text style={styles.statValue}>
                  {s.currency ? formatRupees(dashboard[s.key]) : (dashboard[s.key] ?? 0)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Overdue students</Text>
        {overdue.length ? (
          overdue.map(recordCard)
        ) : (
          <EmptyState icon="checkmark-circle-outline" title="Nothing is overdue" />
        )}
      </>
    );
  }

  const detailRecord = detail?.record || detail;

  return (
    <>
      <ScreenScaffold
        title="Fee Management"
        fallbackRoute={homeRoute}
        loading={loading}
        error={error}
        onRetry={load}
        refreshing={refreshing}
        onRefresh={() => load(true)}
        toast={toast}
      >
        <SegmentedTabs options={TABS} value={tab} onChange={setTab} scrollable />
        <View style={styles.body}>{body}</View>
      </ScreenScaffold>

      {/* ── Fee structure editor ────────────────────────────────────────────── */}
      <FormSheet
        visible={!!structureSheet}
        title={structureSheet?.id ? 'Edit fee structure' : 'New fee structure'}
        onClose={() => setStructureSheet(null)}
        onSubmit={submitStructure}
        submitLabel="Save structure"
        submitting={saving}
        fullHeight
      >
        <Text style={styles.label}>Academic year *</Text>
        <TextInput
          style={styles.input}
          value={structureForm.academicYear}
          onChangeText={(v) => setStructureForm((p) => ({ ...p, academicYear: v }))}
          placeholder="2026-27"
          placeholderTextColor={SLATE[400]}
          autoCapitalize="none"
          editable={!saving}
        />

        <Text style={styles.label}>Class *</Text>
        <TextInput
          style={styles.input}
          value={structureForm.className}
          onChangeText={(v) => setStructureForm((p) => ({ ...p, className: v }))}
          placeholder="e.g. Class 9"
          placeholderTextColor={SLATE[400]}
          editable={!saving}
        />

        <Text style={styles.label}>Total fees (₹) *</Text>
        <TextInput
          style={styles.input}
          value={structureForm.totalAmount}
          onChangeText={(v) => setStructureForm((p) => ({ ...p, totalAmount: v }))}
          keyboardType="number-pad"
          placeholderTextColor={SLATE[400]}
          editable={!saving}
        />

        <Select
          label="Payment frequency"
          value={structureForm.paymentFrequency}
          options={FREQUENCIES}
          onChange={(paymentFrequency) => setStructureForm((p) => ({ ...p, paymentFrequency }))}
        />

        <Text style={styles.label}>Number of installments *</Text>
        <TextInput
          style={styles.input}
          value={structureForm.installmentCount}
          onChangeText={(v) => setStructureForm((p) => ({ ...p, installmentCount: v }))}
          keyboardType="number-pad"
          editable={!saving}
        />

        <DateTimeField
          label="First due date *"
          mode="date"
          value={structureForm.firstDueDate}
          onChange={(v) =>
            setStructureForm((p) => ({ ...p, firstDueDate: v ? v.slice(0, 10) : '' }))
          }
          placeholder="Select a date"
        />

        <Text style={styles.label}>Day of month (recurring)</Text>
        <TextInput
          style={styles.input}
          value={structureForm.dayOfMonth}
          onChangeText={(v) => setStructureForm((p) => ({ ...p, dayOfMonth: v }))}
          placeholder="1–28"
          placeholderTextColor={SLATE[400]}
          keyboardType="number-pad"
          editable={!saving}
        />

        <Text style={styles.label}>Late fee per day (₹)</Text>
        <TextInput
          style={styles.input}
          value={structureForm.lateFeePerDay}
          onChangeText={(v) => setStructureForm((p) => ({ ...p, lateFeePerDay: v }))}
          keyboardType="number-pad"
          editable={!saving}
        />

        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={styles.textarea}
          value={structureForm.notes}
          onChangeText={(v) => setStructureForm((p) => ({ ...p, notes: v }))}
          placeholder="Optional"
          placeholderTextColor={SLATE[400]}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          editable={!saving}
        />
        {sheetError ? <Text style={styles.sheetError}>{sheetError}</Text> : null}
      </FormSheet>

      {/* ── Assign students ─────────────────────────────────────────────────── */}
      <FormSheet
        visible={!!assigning}
        title="Assign students"
        subtitle={assigning ? `${assigning.className} · ${assigning.academicYear}` : undefined}
        onClose={() => setAssigning(null)}
        onSubmit={submitAssign}
        submitLabel={`Assign (${selectedStudents.length})`}
        submitting={saving}
        fullHeight
      >
        {students.length ? (
          students.map((s) => {
            const picked = selectedStudents.includes(s.userId);
            return (
              <Pressable
                key={s.userId}
                onPress={() => toggleStudent(s.userId)}
                style={({ pressed }) => [styles.studentRow, pressed && styles.pressed]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: picked }}
              >
                <Ionicons
                  name={picked ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={picked ? palette.primary : SLATE[400]}
                />
                <View style={styles.studentText}>
                  <Text style={styles.studentName}>{s.fullName}</Text>
                  <Text style={styles.sub}>
                    {[s.currentClass, s.section, s.email].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </Pressable>
            );
          })
        ) : (
          <EmptyState icon="people-outline" title="No students to assign" />
        )}
        {sheetError ? <Text style={styles.sheetError}>{sheetError}</Text> : null}
      </FormSheet>

      {/* ── Fee record detail + offline payment ─────────────────────────────── */}
      <FormSheet
        visible={!!detail}
        title={detailRecord?.studentName || 'Fee record'}
        subtitle={
          detailRecord
            ? `${formatRupees(detailRecord.paidAmount)} of ${formatRupees(detailRecord.totalAmount)} paid`
            : undefined
        }
        onClose={() => setDetail(null)}
        onSubmit={submitOffline}
        submitLabel="Record offline payment"
        submitting={saving}
        submitDisabled={detailLoading}
        fullHeight
      >
        {detailLoading ? (
          <ActivityIndicator size="large" color={palette.primary} style={styles.sheetLoader} />
        ) : (
          <>
            {(detailRecord?.installments || []).map((inst) => (
              <View key={inst.id ?? inst.installmentNumber} style={styles.instRow}>
                <View style={styles.studentText}>
                  <Text style={styles.studentName}>Installment {inst.installmentNumber}</Text>
                  <Text style={styles.sub}>
                    Due {formatShortDate(inst.dueDate)}
                    {inst.id != null ? ` · id ${inst.id}` : ''}
                  </Text>
                </View>
                <View style={styles.instRight}>
                  <Text style={styles.figureValue}>{formatRupees(inst.amount)}</Text>
                  <StatusChip
                    label={inst.status}
                    tone={RECORD_TONE[inst.status] || 'neutral'}
                  />
                </View>
              </View>
            ))}

            <Text style={styles.sectionTitle}>Log an offline payment</Text>
            <Text style={styles.label}>Amount (₹) *</Text>
            <TextInput
              style={styles.input}
              value={offlineForm.amount}
              onChangeText={(amount) => setOfflineForm((p) => ({ ...p, amount }))}
              keyboardType="number-pad"
              editable={!saving}
            />

            <Text style={styles.label}>Installment id (optional)</Text>
            <TextInput
              style={styles.input}
              value={offlineForm.installmentId}
              onChangeText={(installmentId) => setOfflineForm((p) => ({ ...p, installmentId }))}
              placeholder="Leave blank to apply to the balance"
              placeholderTextColor={SLATE[400]}
              keyboardType="number-pad"
              editable={!saving}
            />

            <DateTimeField
              label="Payment date"
              mode="date"
              value={offlineForm.paymentDate}
              onChange={(v) =>
                setOfflineForm((p) => ({ ...p, paymentDate: v ? v.slice(0, 10) : '' }))
              }
              clearable
              placeholder={toIsoDate(new Date())}
            />

            <Text style={styles.label}>Admin notes</Text>
            <TextInput
              style={styles.textarea}
              value={offlineForm.adminNotes}
              onChangeText={(adminNotes) => setOfflineForm((p) => ({ ...p, adminNotes }))}
              placeholder="Cheque number, receipt reference…"
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
    </>
  );
}

const useStyles = makeStyles((p) => ({
  body: { marginTop: SPACING.md },
  card: { marginBottom: SPACING.sm },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  cardHeadText: { flex: 1 },
  name: { fontSize: 15, fontWeight: '800', color: SLATE[800] },
  sub: { fontSize: 12.5, color: SLATE[500], marginTop: 2 },
  reason: { fontSize: 13, color: SLATE[600], lineHeight: 19, marginTop: 6 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: SLATE[800],
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  hint: { fontSize: 12, color: SLATE[500], lineHeight: 18, marginBottom: SPACING.sm },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
  },
  gross: { fontSize: 15, fontWeight: '800' },

  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: FEEDBACK.successBg,
    borderRadius: 10,
    padding: 11,
    marginBottom: SPACING.sm,
  },
  statusMissing: { backgroundColor: FEEDBACK.warningBg },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { flex: 1, fontSize: 12.5, color: SLATE[700], lineHeight: 18 },

  figures: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  figure: { flex: 1 },
  figureLabel: { fontSize: 11.5, color: SLATE[500] },
  figureValue: { fontSize: 13.5, fontWeight: '700', color: SLATE[800], marginTop: 2 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  statCard: {
    width: '47.8%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: p.primary,
  },
  statLabel: { fontSize: 11.5, color: SLATE[500] },
  statValue: { fontSize: 15, fontWeight: '800', color: SLATE[800], marginTop: 3 },

  structureActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  ghostBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: p.tint,
  },
  ghostText: { fontSize: 12.5, fontWeight: '700', color: p.primaryDark },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLATE[100],
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addText: { color: '#ffffff', fontSize: 12.5, fontWeight: '700' },
  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  primaryText: { color: '#ffffff', fontSize: 14.5, fontWeight: '700' },
  pressed: { opacity: 0.75 },

  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: SLATE[100],
  },
  studentText: { flex: 1 },
  studentName: { fontSize: 14, fontWeight: '700', color: SLATE[800] },
  instRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: SLATE[100],
  },
  instRight: { alignItems: 'flex-end', gap: 4 },

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
