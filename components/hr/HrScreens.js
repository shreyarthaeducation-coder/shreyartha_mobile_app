import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TYPE } from '../../constants/theme';
import { EmptyState, ScreenScaffold, SenderEmailSheet, StatusChip, useToast } from '../ui';
import { usePalette } from '../ui/PaletteContext';
import useStaffResource from '../../hooks/useStaffResource';
import { staffApi } from '../../services/staffApi';
import { HR_PORTAL as BASE } from '../../services/admin/hrAdminService';
import { downloadAndShare } from '../../utils/downloadFile';
import { formatRupees } from '../../utils/currency';
import CrudListScreen from '../portal/CrudListScreen';
import FieldsSheet from '../portal/FieldsSheet';
import { ProbationHistory, day } from '../staff/team/MyTeamScreen';
import { makeStyles } from '../../utils/makeStyles';

/**
 * The HR portal (5 Nov 2026) — the website's Hr/platform, for HR executives (userType HR) on
 * `/api/staff/hr-portal`, which is `hasAnyRole('SHREYARTHA_HR','SHREYARTHA_ADMIN')`. Every
 * Shreyartha employee's record, probation, payroll and offer letters.
 *
 * What stays on the website, opened in the app's web view rather than rebuilt: an employee's
 * Salary & CTC editor (the CTC calculator with Annexure B) and writing an offer letter (its section
 * editor, template and live PDF preview). Everything an HR executive does to a record that already
 * exists — confirm, extend, record an exit, send, revise, withdraw, onboard, run and lock payroll,
 * download payslips — is native.
 */

/**
 * The panel these screens sit in: `/staff/hr`, or `/staff/shreyartha_admin` — the website lets the
 * Shreyartha Admin run HR too (HR_PORTAL_TYPES), and the backend guard names it. Read from the
 * route, so a link inside the portal never drops someone into another role's shell.
 */
function useRoot() {
  const { role } = useLocalSearchParams();
  return `/staff/${String(role || 'hr').toLowerCase()}`;
}

export const EMPLOYMENT_TYPE_LABELS = {
  PERMANENT: 'Permanent Employee',
  PROBATIONARY: 'Probationary Employee',
  CONTRACT: 'Contract Employee',
  CONSULTANT: 'Consultant',
  INTERN: 'Internship',
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const rupees = (v) => (v === null || v === undefined || v === '' ? '—' : formatRupees(v, { decimals: 0 }));

const daysLeft = (n) => {
  if (n === null || n === undefined) return null;
  if (n <= 0) return { label: 'Due now', tone: 'error' };
  return { label: `${n} ${n === 1 ? 'day' : 'days'} left`, tone: n <= 14 ? 'warning' : 'info' };
};

/** Opens a website page inside the app's web view, signed in as this HR executive. */
const openOnWebsite = (root, path, label) =>
  router.push({ pathname: `${root}/feature`, params: { path, label } });

function Button({ label, icon, onPress, tone = 'primary', busy }) {
  const styles = useStyles();
  const palette = usePalette();
  const solid = tone === 'primary';
  const danger = tone === 'danger';
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        solid ? { backgroundColor: palette.primary, borderColor: palette.primary } : { borderColor: danger ? FEEDBACK.errorText : palette.primary },
        pressed && styles.pressed,
      ]}
    >
      {icon ? <Ionicons name={icon} size={16} color={solid ? palette.onPrimary : danger ? FEEDBACK.errorText : palette.primaryDark} /> : null}
      <Text style={[styles.buttonText, { color: solid ? palette.onPrimary : danger ? FEEDBACK.errorText : palette.primaryDark }]}>
        {busy ? '…' : label}
      </Text>
    </Pressable>
  );
}

function Section({ title, children, right }) {
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

function Row({ label, value }) {
  const styles = useStyles();
  if (value === null || value === undefined || value === '') return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{String(value)}</Text>
    </View>
  );
}

/* ── Dashboard ─────────────────────────────────────────────────────────────────────────────── */

export function HrDashboardScreen() {
  const ROOT = useRoot();
  const styles = useStyles();
  const palette = usePalette();
  const fetcher = useCallback((signal) => staffApi.get(`${BASE}/dashboard`, { signal }), []);
  const { data, loading, error, reload, refreshing, refresh } = useStaffResource(fetcher, { initialData: null });
  const d = data || {};
  const offers = d.offersByStatus || {};
  const run = d.currentMonthRun;
  const today = new Date(d.today || Date.now());

  const stats = [
    { label: 'Headcount', value: d.headcount, note: 'Approved, not exited', to: `${ROOT}/hr-employees` },
    { label: 'Records to complete', value: d.incompleteRecords, note: 'Missing type, salary, manager, bank or PAN', to: `${ROOT}/hr-employees` },
    { label: 'Leave to approve', value: d.pendingLeave, to: `${ROOT}/leave-management` },
    { label: 'Probation ending', value: d.probationDueSoon, note: 'In the next 30 days', to: `${ROOT}/hr-probation` },
    { label: 'Offers awaiting reply', value: (offers.SENT || 0) + (offers.VIEWED || 0), note: `${offers.ACCEPTED || 0} accepted`, to: `${ROOT}/hr-offers` },
    { label: 'Awaiting approval', value: d.awaitingApproval, note: 'New sign-ups — approved by the platform admin' },
  ];

  return (
    <ScreenScaffold title="HR Dashboard" fallbackRoute={ROOT} loading={loading} error={error} onRetry={reload} refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.grid}>
        {stats.map((s) => (
          <Pressable
            key={s.label}
            disabled={!s.to}
            onPress={() => s.to && router.push(s.to)}
            style={({ pressed }) => [styles.stat, { borderTopColor: palette.primary }, pressed && styles.pressed]}
            accessibilityRole={s.to ? 'button' : undefined}
          >
            <Text style={styles.statLabel}>{s.label}</Text>
            <Text style={[styles.statValue, { color: palette.primaryDark }]}>{s.value ?? 0}</Text>
            {s.note ? <Text style={styles.statNote}>{s.note}</Text> : null}
          </Pressable>
        ))}
      </View>

      <Section title={`Payroll — ${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`}>
        {run ? (
          <>
            <Row label="Status" value={run.status} />
            <Row label="Employees" value={run.employeeCount} />
            <Row label="Net pay" value={rupees(run.totalNet)} />
            <View style={styles.buttons}>
              <Button label="Open run" icon="open-outline" tone="ghost" onPress={() => router.push(`${ROOT}/hr-payroll-run?id=${run.id}`)} />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.muted}>Not run yet this month.</Text>
            <View style={styles.buttons}>
              <Button label="Run payroll" icon="calculator-outline" onPress={() => router.push(`${ROOT}/hr-payroll`)} />
            </View>
          </>
        )}
        {d.previousMonthRun && d.previousMonthRun.status !== 'PAID' ? (
          <Text style={styles.warn}>Last month's run is still {String(d.previousMonthRun.status).toLowerCase()}.</Text>
        ) : null}
      </Section>

      <Section title="People by engagement">
        {Object.entries(d.byEmploymentType || {}).map(([type, count]) => (
          <Pressable key={type} onPress={() => router.push(`${ROOT}/hr-employees?type=${type}`)} accessibilityRole="button">
            <Row label={type === 'UNCLASSIFIED' ? 'Not classified yet' : EMPLOYMENT_TYPE_LABELS[type] || type} value={count} />
          </Pressable>
        ))}
      </Section>

      <Section title="Upcoming probation confirmations">
        {(d.probationUpcoming || []).length === 0 ? <Text style={styles.muted}>Nobody is on probation.</Text> : null}
        {(d.probationUpcoming || []).map((p) => (
          <Pressable key={p.schoolUserId} onPress={() => router.push(`${ROOT}/hr-employee?id=${p.schoolUserId}`)} accessibilityRole="button">
            <Row label={p.fullName} value={`${day(p.probationEndDate)}${p.daysLeft != null ? ` · ${daysLeft(p.daysLeft)?.label}` : ''}`} />
          </Pressable>
        ))}
      </Section>

      <Section title="Engagements ending in 30 days">
        {(d.contractsEnding || []).length === 0 ? <Text style={styles.muted}>None.</Text> : null}
        {(d.contractsEnding || []).map((p) => (
          <Pressable key={p.schoolUserId} onPress={() => router.push(`${ROOT}/hr-employee?id=${p.schoolUserId}`)} accessibilityRole="button">
            <Row label={p.fullName} value={`${EMPLOYMENT_TYPE_LABELS[p.employmentType] || '—'} · ${day(p.contractEndDate)}`} />
          </Pressable>
        ))}
      </Section>

      <View style={styles.buttons}>
        <Button label="New offer letter" icon="mail-outline" onPress={() => openOnWebsite(ROOT, '/hr/platform/dashboard/offers/new', 'New offer letter')} />
      </View>
    </ScreenScaffold>
  );
}

/* ── Employees ─────────────────────────────────────────────────────────────────────────────── */

export function HrEmployeesScreen({ type }) {
  const ROOT = useRoot();
  const filterType = typeof type === 'string' && type ? type : '';
  const load = useCallback(
    () => staffApi.get(`${BASE}/employees`, { params: { type: filterType, includeExited: true, includeUnverified: true } }),
    [filterType],
  );
  return (
    <CrudListScreen
      title={filterType ? EMPLOYMENT_TYPE_LABELS[filterType] || 'Employees' : 'Employees'}
      fallbackRoute={ROOT}
      load={load}
      loadKey={filterType}
      itemKey={(r) => r.schoolUserId}
      tabs={[
        { value: 'active', label: 'Current', filter: (r) => !r.exitDate },
        { value: 'missing', label: 'Records to complete', filter: (r) => !r.exitDate && (r.missing || []).length > 0 },
        { value: 'exited', label: 'Exited', filter: (r) => !!r.exitDate },
      ]}
      emptyTitle="Nobody here"
      emptyMessage="New people join through an accepted offer letter or by signing up on the employee login."
      describe={(r) => ({
        title: r.fullName,
        subtitle: [r.employeeCode, r.designation || r.userType, r.email].filter(Boolean).join(' · '),
        chips: [
          { label: r.employmentTypeLabel || EMPLOYMENT_TYPE_LABELS[r.employmentType] || 'Not classified', tone: r.employmentType ? 'info' : 'warning' },
          r.verified === false ? { label: 'Awaiting approval', tone: 'warning' } : null,
          r.exitDate ? { label: `Exit ${day(r.exitDate)}`, tone: 'error' } : null,
        ],
        meta: [
          ['Joined', day(r.dateOfJoining)],
          ['Manager', r.reportingManagerName],
          ['Probation ends', day(r.probationEndDate)],
          ['Annual CTC', r.annualCtc != null ? rupees(r.annualCtc) : ''],
          ['Missing', (r.missing || []).join(', ')],
        ],
      })}
      actions={[{ key: 'open', label: 'Open record', icon: 'person-outline', run: (r) => router.push(`${ROOT}/hr-employee?id=${r.schoolUserId}`) }]}
    />
  );
}

const PROBATION_MONTHS = [1, 2, 3, 4, 5, 6, 9, 12].map((m) => ({ value: String(m), label: `${m} ${m === 1 ? 'month' : 'months'}` }));
const EXTEND_MONTHS = [1, 2, 3, 4, 5, 6].map((m) => ({ value: String(m), label: `${m} ${m === 1 ? 'month' : 'months'}` }));
const EXIT_REASONS = [
  { value: 'RESIGNED', label: 'Resigned' },
  { value: 'TERMINATED', label: 'Terminated' },
  { value: 'CONTRACT_ENDED', label: 'Contract ended' },
  { value: 'ABSCONDED', label: 'Absconded' },
];
const NEEDS_END = ['CONTRACT', 'CONSULTANT', 'INTERN'];

export function HrEmployeeScreen({ id }) {
  const ROOT = useRoot();
  const styles = useStyles();
  const { toast, showToast } = useToast();
  const [sheet, setSheet] = useState(null); // 'employment' | 'extend' | 'exit'
  const [busy, setBusy] = useState('');

  const fetcher = useCallback(
    async (signal) => {
      const [detail, managers] = await Promise.all([
        staffApi.get(`${BASE}/employees/${id}`, { signal }),
        staffApi.get(`${BASE}/managers`, { signal }).catch(() => []),
      ]);
      return { detail, managers: Array.isArray(managers) ? managers : [] };
    },
    [id],
  );
  const { data, loading, error, reload, refreshing, refresh } = useStaffResource(fetcher, { initialData: null });
  const detail = data?.detail;
  const e = detail?.employment || {};

  const act = async (key, fn, message) => {
    setBusy(key);
    try {
      await fn();
      showToast(message, 'success');
      reload();
    } catch (err) {
      showToast(err?.message || 'That did not work.', 'error');
    } finally {
      setBusy('');
    }
  };

  const confirmFirst = (message, run) =>
    Alert.alert('Are you sure?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', onPress: run },
    ]);

  const managerOptions = [
    { value: '', label: 'None' },
    ...(e.reportingManagerId && !(data?.managers || []).some((m) => String(m.schoolUserId) === String(e.reportingManagerId))
      ? [{ value: String(e.reportingManagerId), label: `${e.reportingManagerName} (not a Reporting Manager)` }]
      : []),
    ...(data?.managers || [])
      .filter((m) => String(m.schoolUserId) !== String(detail?.schoolUserId))
      .map((m) => ({ value: String(m.schoolUserId), label: m.designation ? `${m.fullName} — ${m.designation}` : m.fullName })),
  ];

  const employmentFields = (v) => [
    { key: 'employmentType', label: 'Engagement', type: 'select', options: Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => ({ value, label })) },
    { key: 'dateOfJoining', label: 'Date of joining', type: 'date' },
    ...(v.employmentType === 'PROBATIONARY' ? [{ key: 'probationMonths', label: 'Probation', type: 'select', options: PROBATION_MONTHS }] : []),
    ...(NEEDS_END.includes(v.employmentType)
      ? [{ key: 'contractEndDate', label: v.employmentType === 'CONTRACT' ? 'Contract end date' : 'Engagement end date', type: 'date', required: v.employmentType === 'CONTRACT' }]
      : []),
    {
      key: 'reportingManagerId',
      label: 'Reporting manager',
      type: 'select',
      options: managerOptions,
      helper: "Only Reporting Manager accounts are listed. They get this person's leave requests and can extend their probation.",
    },
    { key: 'designation', label: 'Designation', type: 'text' },
    { key: 'department', label: 'Department', type: 'text' },
    { key: 'jobLocation', label: 'Job location', type: 'text' },
    { key: 'band', label: 'Band', type: 'text' },
  ];

  // The website's rules, verbatim: probation dates are recomputed only when the type is (re)set,
  // so an unrelated save never silently undoes a manager's extension.
  const saveEmployment = async (_payload, v) => {
    const typeChanged = (v.employmentType || '') !== (e.employmentType || '');
    const body = {
      employmentType: v.employmentType || null,
      dateOfJoining: v.dateOfJoining || null,
      designation: v.designation || '',
      department: v.department || '',
      jobLocation: v.jobLocation || '',
      band: v.band || '',
      contractEndDate: NEEDS_END.includes(v.employmentType) && v.contractEndDate ? v.contractEndDate : null,
    };
    if (v.employmentType === 'PROBATIONARY' && (typeChanged || Number(v.probationMonths) !== Number(e.probationMonths))) {
      body.probationMonths = Number(v.probationMonths || 3);
    } else if (!typeChanged) {
      body.employmentType = null;
    }
    if (v.reportingManagerId) body.reportingManagerId = Number(v.reportingManagerId);
    else if (e.reportingManagerId) body.clearReportingManager = true;
    await staffApi.put(`${BASE}/employees/${id}/employment`, body);
    setSheet(null);
    showToast('Employment details saved.', 'success');
    reload();
  };

  const onProbation = e.employmentType === 'PROBATIONARY';
  const canExtend = onProbation && e.probationDaysLeft > 0 && (!e.latestAllowedEndDate || e.probationEndDate < e.latestAllowedEndDate);
  const left = daysLeft(e.probationDaysLeft);

  return (
    <ScreenScaffold
      title={detail?.fullName || 'Employee'}
      fallbackRoute={`${ROOT}/hr-employees`}
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
      toast={toast}
    >
      {detail ? (
        <>
          <Section title="Employee">
            <View style={styles.chips}>
              <StatusChip label={e.employmentTypeLabel || EMPLOYMENT_TYPE_LABELS[e.employmentType] || 'Not classified'} tone={e.employmentType ? 'info' : 'warning'} />
              {left && onProbation ? <StatusChip label={left.label} tone={left.tone} /> : null}
              {e.exitDate ? <StatusChip label={`Exit ${day(e.exitDate)}`} tone="error" /> : null}
            </View>
            {detail.verified === false ? (
              <Text style={styles.warn}>
                This account is waiting for platform-admin approval. You can prepare the record now; the person cannot sign in or be paid until it is approved.
              </Text>
            ) : null}
            <Row label="Employee code" value={detail.employeeCode} />
            <Row label="Designation" value={detail.designation || detail.userType} />
            <Row label="Department" value={detail.department} />
            <Row label="Email" value={detail.email} />
            <Row label="Mobile" value={detail.mobile} />
          </Section>

          <Section title="Employment" right={<Button label="Edit" icon="create-outline" tone="ghost" onPress={() => setSheet('employment')} />}>
            <Row label="Joined" value={day(e.dateOfJoining)} />
            <Row label="Reporting manager" value={e.reportingManagerName || 'Not set'} />
            <Row label="Contract ends" value={day(e.contractEndDate)} />
            <Row label="Job location" value={e.jobLocation} />
            <Row label="Band" value={e.band} />
          </Section>

          <Section title="Probation">
            {onProbation ? (
              <>
                <Row label="Started" value={day(e.probationStartDate || e.dateOfJoining)} />
                <Row label="Agreed length" value={e.probationMonths ? `${e.probationMonths} months` : ''} />
                <Row label="Originally ends" value={day(e.originalProbationEndDate)} />
                <Row label="Now ends" value={day(e.probationEndDate)} />
                <Row label="Latest possible end" value={day(e.latestAllowedEndDate)} />
                <View style={styles.buttons}>
                  <Button
                    label="Confirm now"
                    icon="checkmark-done-outline"
                    busy={busy === 'confirm'}
                    onPress={() =>
                      confirmFirst(`Confirm ${detail.fullName} as a Permanent Employee today?`, () =>
                        act('confirm', () => staffApi.post(`${BASE}/employees/${id}/probation/confirm`, {}), `${detail.fullName} is now a Permanent Employee.`),
                      )
                    }
                  />
                  {canExtend ? <Button label="Extend on manager's behalf" icon="time-outline" tone="ghost" onPress={() => setSheet('extend')} /> : null}
                </View>
              </>
            ) : (
              <Text style={styles.muted}>
                {e.employmentType ? `${EMPLOYMENT_TYPE_LABELS[e.employmentType]} — not on probation.` : 'Set the engagement under Employment first.'}
              </Text>
            )}
            <ProbationHistory load={() => staffApi.get(`${BASE}/employees/${id}/probation/history`)} />
          </Section>

          <Section title="Salary & CTC">
            <Text style={styles.muted}>The CTC calculator and Annexure B are on the website.</Text>
            <View style={styles.buttons}>
              <Button
                label="Open salary on the website"
                icon="calculator-outline"
                tone="ghost"
                onPress={() => openOnWebsite(ROOT, `/hr/platform/dashboard/employees/${id}`, detail.fullName)}
              />
            </View>
          </Section>

          <Section title="Exit">
            {e.exitDate ? (
              <>
                <Row label="Last working day" value={day(e.exitDate)} />
                <Row label="Reason" value={EXIT_REASONS.find((r) => r.value === e.exitReason)?.label || e.exitReason} />
                <Row label="Notes" value={e.exitNotes} />
                <View style={styles.buttons}>
                  <Button
                    label="Withdraw exit"
                    icon="arrow-undo-outline"
                    tone="ghost"
                    busy={busy === 'revoke'}
                    onPress={() => act('revoke', () => staffApi.del(`${BASE}/employees/${id}/exit`), 'Exit withdrawn.')}
                  />
                </View>
              </>
            ) : (
              <View style={styles.buttons}>
                <Button label="Record an exit" icon="exit-outline" tone="danger" onPress={() => setSheet('exit')} />
              </View>
            )}
          </Section>

          <FieldsSheet
            visible={sheet === 'employment'}
            title="Employment details"
            fields={employmentFields}
            initial={{
              employmentType: e.employmentType || '',
              dateOfJoining: e.dateOfJoining || '',
              probationMonths: String(e.probationMonths || 3),
              contractEndDate: e.contractEndDate || '',
              reportingManagerId: e.reportingManagerId ? String(e.reportingManagerId) : '',
              designation: detail.designation || '',
              department: detail.department || '',
              jobLocation: e.jobLocation || '',
              band: e.band || '',
            }}
            onSubmit={saveEmployment}
            onClose={() => setSheet(null)}
          />
          <FieldsSheet
            visible={sheet === 'extend'}
            title="Extend probation"
            subtitle={`Currently ends ${day(e.probationEndDate)}.`}
            submitLabel="Extend"
            fields={[
              { key: 'extendByMonths', label: 'Extend by', type: 'select', options: EXTEND_MONTHS, default: '1' },
              { key: 'reason', label: 'Reason', type: 'multiline', required: true },
            ]}
            onSubmit={async (p) => {
              const res = await staffApi.post(`${BASE}/employees/${id}/probation/extend`, { extendByMonths: Number(p.extendByMonths || 1), reason: p.reason });
              setSheet(null);
              showToast(`Probation extended to ${day(res?.probationEndDate)}.`, 'success');
              reload();
            }}
            onClose={() => setSheet(null)}
          />
          <FieldsSheet
            visible={sheet === 'exit'}
            title="Record an exit"
            submitLabel="Record exit"
            fields={[
              { key: 'exitDate', label: 'Last working day', type: 'date', required: true },
              { key: 'exitReason', label: 'Reason', type: 'select', options: EXIT_REASONS, default: 'RESIGNED', required: true },
              { key: 'exitNotes', label: 'Notes', type: 'multiline' },
            ]}
            onSubmit={async (p) => {
              await staffApi.post(`${BASE}/employees/${id}/exit`, { exitDate: p.exitDate, exitReason: p.exitReason, exitNotes: p.exitNotes || '' });
              setSheet(null);
              showToast('Exit recorded.', 'success');
              reload();
            }}
            onClose={() => setSheet(null)}
          />
        </>
      ) : null}
    </ScreenScaffold>
  );
}

/* ── Probation ─────────────────────────────────────────────────────────────────────────────── */

export function HrProbationScreen() {
  const ROOT = useRoot();
  const styles = useStyles();
  const fetcher = useCallback((signal) => staffApi.get(`${BASE}/probation`, { params: { withinDays: 30 }, signal }), []);
  const { data, loading, error, reload, refreshing, refresh } = useStaffResource(fetcher, { initialData: null });
  const open = (id) => router.push(`${ROOT}/hr-employee?id=${id}`);

  return (
    <ScreenScaffold title="Probation" fallbackRoute={ROOT} loading={loading} error={error} onRetry={reload} refreshing={refreshing} onRefresh={refresh}>
      <Text style={styles.lead}>
        Probationers become Permanent Employees automatically on their end date. Reporting managers are reminded 14, 7 and 1 day before, and can extend from My Team until then.
      </Text>
      <Section title={`On probation (${data?.onProbation?.length || 0})`}>
        {(data?.onProbation || []).length === 0 ? <Text style={styles.muted}>Nobody is on probation.</Text> : null}
        {(data?.onProbation || []).map((p) => {
          const left = daysLeft(p.daysLeft);
          return (
            <Pressable key={p.schoolUserId} onPress={() => open(p.schoolUserId)} style={styles.person} accessibilityRole="button">
              <View style={styles.personText}>
                <Text style={styles.personName}>{p.fullName}</Text>
                <Text style={styles.muted}>
                  {[p.designation, `Manager: ${p.reportingManagerName || 'not set'}`].filter(Boolean).join(' · ')}
                </Text>
                <Text style={styles.muted}>
                  Ends {day(p.probationEndDate)}
                  {p.extended ? ` (was ${day(p.originalProbationEndDate)})` : ''}
                </Text>
              </View>
              {left ? <StatusChip label={left.label} tone={left.tone} /> : null}
            </Pressable>
          );
        })}
      </Section>
      <Section title={`Engagements ending in ${data?.withinDays || 30} days`}>
        {(data?.contractsEnding || []).length === 0 ? <Text style={styles.muted}>None.</Text> : null}
        {(data?.contractsEnding || []).map((p) => (
          <Pressable key={p.schoolUserId} onPress={() => open(p.schoolUserId)} style={styles.person} accessibilityRole="button">
            <View style={styles.personText}>
              <Text style={styles.personName}>{p.fullName}</Text>
              <Text style={styles.muted}>
                {EMPLOYMENT_TYPE_LABELS[p.employmentType] || '—'} · {day(p.contractEndDate)}
              </Text>
            </View>
            {daysLeft(p.daysLeft) ? <StatusChip label={daysLeft(p.daysLeft).label} tone={daysLeft(p.daysLeft).tone} /> : null}
          </Pressable>
        ))}
      </Section>
    </ScreenScaffold>
  );
}

/* ── Payroll ───────────────────────────────────────────────────────────────────────────────── */

const RUN_TONE = { DRAFT: 'warning', LOCKED: 'info', PAID: 'success' };

export function HrPayrollScreen() {
  const ROOT = useRoot();
  const now = new Date();
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => ({ value: String(y), label: String(y) }));
  return (
    <CrudListScreen
      title="Payroll"
      fallbackRoute={ROOT}
      load={() => staffApi.get(`${BASE}/payroll/runs`)}
      addLabel="Run payroll for a month"
      formTitle={() => 'Run payroll'}
      fields={[
        { key: 'year', label: 'Year', type: 'select', options: years, default: String(now.getFullYear()), required: true },
        {
          key: 'month',
          label: 'Month',
          type: 'select',
          options: MONTH_NAMES.map((m, i) => ({ value: String(i + 1), label: m })),
          default: String(now.getMonth() + 1),
          required: true,
          helper: 'Recomputing a draft keeps the achievement % already entered. Locked months cannot be recomputed.',
        },
      ]}
      create={async (v) => {
        const result = await staffApi.post(`${BASE}/payroll/runs`, { year: Number(v.year), month: Number(v.month) });
        if (result?.id) router.push(`${ROOT}/hr-payroll-run?id=${result.id}`);
      }}
      emptyTitle="No payroll runs yet"
      emptyMessage="Compute a month as a draft, enter bonus achievement, then lock to release payslips."
      describe={(r) => ({
        title: `${MONTH_NAMES[(r.periodMonth || 1) - 1]} ${r.periodYear}`,
        chips: [{ label: r.status, tone: RUN_TONE[r.status] }],
        meta: [
          ['Employees', r.employeeCount],
          ['Gross', rupees(r.totalGross)],
          ['Net pay', rupees(r.totalNet)],
        ],
      })}
      actions={[{ key: 'open', label: 'Open run', icon: 'open-outline', run: (r) => router.push(`${ROOT}/hr-payroll-run?id=${r.id}`) }]}
    />
  );
}

export function HrPayrollRunScreen({ id }) {
  const ROOT = useRoot();
  const styles = useStyles();
  const { toast, showToast } = useToast();
  const [busy, setBusy] = useState('');
  const [editing, setEditing] = useState(null);
  const fetcher = useCallback((signal) => staffApi.get(`${BASE}/payroll/runs/${id}`, { signal }), [id]);
  const { data: run, loading, error, reload, refreshing, refresh, setData } = useStaffResource(fetcher, { initialData: null });

  const act = async (key, fn, message) => {
    setBusy(key);
    try {
      await fn();
      showToast(message, 'success');
      reload();
    } catch (err) {
      showToast(err?.message || 'That did not work.', 'error');
    } finally {
      setBusy('');
    }
  };
  const confirmFirst = (message, run2) =>
    Alert.alert('Are you sure?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', onPress: run2 },
    ]);

  const draft = run?.status === 'DRAFT';
  const payoutRows = (run?.variableEligible || []).filter((r) => r.payoutMonth);

  // One person's achievement at a time; the server takes the whole month's entries, so the others
  // are sent back as they are.
  const saveAchievement = async (p) => {
    const entries = payoutRows.map((row) =>
      row.schoolUserId === editing.schoolUserId
        ? { schoolUserId: row.schoolUserId, achievementPct: p.achievementPct == null ? null : Number(p.achievementPct), remarks: p.remarks || null }
        : { schoolUserId: row.schoolUserId, achievementPct: row.achievementPct ?? null, remarks: row.remarks || null },
    );
    const updated = await staffApi.put(`${BASE}/payroll/runs/${id}/variable-inputs`, entries);
    if (updated && setData) setData(updated);
    else reload();
    setEditing(null);
    showToast('Achievement saved and payroll recomputed.', 'success');
  };

  return (
    <ScreenScaffold
      title={run ? `Payroll — ${MONTH_NAMES[(run.periodMonth || 1) - 1]} ${run.periodYear}` : 'Payroll run'}
      fallbackRoute={`${ROOT}/hr-payroll`}
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
      toast={toast}
    >
      {run ? (
        <>
          <Section title="This run" right={<StatusChip label={run.status} tone={RUN_TONE[run.status]} />}>
            <Row label="Employees" value={run.employeeCount} />
            <Row label="Gross" value={rupees(run.totalGross)} />
            <Row label="Deductions" value={rupees(run.totalDeductions)} />
            <Row label="Net pay" value={rupees(run.totalNet)} />
            <View style={styles.buttons}>
              {draft ? (
                <Button
                  label="Lock and release payslips"
                  icon="lock-closed-outline"
                  busy={busy === 'lock'}
                  onPress={() =>
                    confirmFirst('Lock this month? Payslips are released to staff and the month can no longer be recomputed.', () =>
                      act('lock', () => staffApi.put(`${BASE}/payroll/runs/${id}/lock`, {}), 'Locked. Payslips are released.'),
                    )
                  }
                />
              ) : null}
              {run.status === 'LOCKED' ? (
                <Button
                  label="Mark as paid"
                  icon="checkmark-circle-outline"
                  busy={busy === 'paid'}
                  onPress={() => confirmFirst('Mark this month as paid?', () => act('paid', () => staffApi.put(`${BASE}/payroll/runs/${id}/paid`, {}), 'Marked as paid.'))}
                />
              ) : null}
            </View>
          </Section>

          {payoutRows.length ? (
            <Section title="Bonus achievement">
              {payoutRows.map((row) => (
                <View key={row.schoolUserId} style={styles.person}>
                  <View style={styles.personText}>
                    <Text style={styles.personName}>{row.fullName}</Text>
                    <Text style={styles.muted}>
                      {[row.variableFrequencyLabel, row.periodLabel, `Up to ${rupees(row.maxPayout)}`].filter(Boolean).join(' · ')}
                    </Text>
                    <Text style={styles.muted}>Achievement: {row.achievementPct != null ? `${row.achievementPct}%` : 'not entered'}</Text>
                  </View>
                  {draft ? <Button label="Enter" icon="create-outline" tone="ghost" onPress={() => setEditing(row)} /> : null}
                </View>
              ))}
            </Section>
          ) : null}

          <Section title={`Payslips (${(run.payslips || []).length})`}>
            {(run.payslips || []).length === 0 ? <EmptyState title="No payslips" message="Nobody was paid in this run." /> : null}
            {(run.payslips || []).map((s) => (
              <View key={s.id} style={styles.person}>
                <View style={styles.personText}>
                  <Text style={styles.personName}>{s.employeeName}</Text>
                  <Text style={styles.muted}>
                    {[s.designation, `${s.paidDays ?? '—'}/${s.totalDays ?? '—'} days`].filter(Boolean).join(' · ')}
                  </Text>
                  <Text style={styles.muted}>
                    Gross {rupees(s.grossEarnings)} · Net {rupees(s.netPay)}
                    {s.variablePay ? ` · Bonus ${rupees(s.variablePay)}` : ''}
                  </Text>
                </View>
                <Button
                  label="PDF"
                  icon="download-outline"
                  tone="ghost"
                  busy={busy === `slip-${s.id}`}
                  onPress={() =>
                    act(`slip-${s.id}`, () => downloadAndShare(`${BASE}/payslips/${s.id}/pdf`, `payslip-${s.id}.pdf`), 'Payslip ready.')
                  }
                />
              </View>
            ))}
          </Section>

          <FieldsSheet
            visible={!!editing}
            title={editing ? `Achievement — ${editing.fullName}` : ''}
            subtitle={editing ? `Up to ${rupees(editing.maxPayout)} this period.` : ''}
            fields={[
              { key: 'achievementPct', label: 'Achievement %', type: 'number' },
              { key: 'remarks', label: 'Remarks', type: 'text' },
            ]}
            initial={editing ? { achievementPct: editing.achievementPct ?? '', remarks: editing.remarks || '' } : null}
            onSubmit={saveAchievement}
            onClose={() => setEditing(null)}
          />
        </>
      ) : null}
    </ScreenScaffold>
  );
}

/* ── Offer letters ─────────────────────────────────────────────────────────────────────────── */

const OFFER_TONE = { DRAFT: 'neutral', SENT: 'info', VIEWED: 'info', ACCEPTED: 'success', DECLINED: 'error', EXPIRED: 'warning', WITHDRAWN: 'neutral' };
const OFFER_FILTERS = ['ALL', 'DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'WITHDRAWN'];
const offerLabel = (o) => (o.status === 'ACCEPTED' && o.onboarded ? 'Onboarded' : o.status ? o.status.charAt(0) + o.status.slice(1).toLowerCase() : '—');

export function HrOffersScreen() {
  const ROOT = useRoot();
  const styles = useStyles();
  return (
    <CrudListScreen
      title="Offer Letters"
      fallbackRoute={ROOT}
      load={() => staffApi.get(`${BASE}/offers`)}
      tabs={OFFER_FILTERS.map((f) => ({
        value: f,
        label: f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase(),
        filter: f === 'ALL' ? undefined : (o) => o.status === f,
      }))}
      header={() => (
        <View style={styles.buttons}>
          <Button label="New offer letter" icon="add-circle-outline" onPress={() => openOnWebsite(ROOT, '/hr/platform/dashboard/offers/new', 'New offer letter')} />
          <Button label="Letter template" icon="document-text-outline" tone="ghost" onPress={() => openOnWebsite(ROOT, '/hr/platform/dashboard/offers/template', 'Letter template')} />
        </View>
      )}
      emptyTitle="No offers here yet"
      emptyMessage="Draft an offer in the company format, email it with an accept/decline link, and onboard the candidate once they accept."
      describe={(o) => ({
        title: o.candidateName,
        subtitle: [o.offerNumber + (o.version > 1 ? ` · v${o.version}` : ''), o.candidateEmail].filter(Boolean).join(' · '),
        chips: [{ label: offerLabel(o), tone: o.onboarded ? 'success' : OFFER_TONE[o.status] }],
        meta: [
          ['Position', [o.position, EMPLOYMENT_TYPE_LABELS[o.employmentType]].filter(Boolean).join(' · ')],
          ['Annual CTC', rupees(o.annualCtc)],
          ['Start', day(o.startDate)],
          ['Accept by', day(o.acceptByDate)],
        ],
      })}
      actions={[{ key: 'open', label: 'Open', icon: 'open-outline', run: (o) => router.push(`${ROOT}/hr-offer?id=${o.id}`) }]}
    />
  );
}

export function HrOfferScreen({ id }) {
  const ROOT = useRoot();
  const styles = useStyles();
  const palette = usePalette();
  const { toast, showToast } = useToast();
  const [busy, setBusy] = useState('');
  const [sending, setSending] = useState(null); // 'send' | 'resend'
  const [withdrawing, setWithdrawing] = useState(false);
  const fetcher = useCallback(
    async (signal) => {
      const [offer, events] = await Promise.all([
        staffApi.get(`${BASE}/offers/${id}`, { signal }),
        staffApi.get(`${BASE}/offers/${id}/events`, { signal }).catch(() => []),
      ]);
      return { offer, events: Array.isArray(events) ? events : [] };
    },
    [id],
  );
  const { data, loading, error, reload, refreshing, refresh } = useStaffResource(fetcher, { initialData: null });
  const o = data?.offer;

  const act = async (key, fn, message) => {
    setBusy(key);
    try {
      await fn();
      showToast(message, 'success');
      reload();
    } catch (err) {
      showToast(err?.message || 'That did not work.', 'error');
    } finally {
      setBusy('');
    }
  };
  const confirmFirst = (message, run) =>
    Alert.alert('Are you sure?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', onPress: run },
    ]);

  return (
    <ScreenScaffold
      title={o ? o.candidateName : 'Offer letter'}
      fallbackRoute={`${ROOT}/hr-offers`}
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
      toast={toast}
    >
      {o ? (
        <>
          <Section title={o.offerNumber + (o.version > 1 ? ` · v${o.version}` : '')} right={<StatusChip label={offerLabel(o)} tone={o.onboarded ? 'success' : OFFER_TONE[o.status]} />}>
            <Row label="Candidate" value={o.candidateName} />
            <Row label="Email" value={o.candidateEmail} />
            <Row label="Position" value={o.position} />
            <Row label="Engagement" value={EMPLOYMENT_TYPE_LABELS[o.employmentType]} />
            <Row label="Annual CTC" value={rupees(o.annualCtc)} />
            <Row label="Start" value={day(o.startDate)} />
            <Row label="Accept by" value={day(o.acceptByDate)} />
            <Row label="First viewed" value={day(o.firstViewedAt)} />
            <Row label="Response from" value={o.responseName} />
            <Row label="Decline reason" value={o.declineReason} />
            <Row label="Withdrawn because" value={o.withdrawnReason} />
          </Section>

          {(o.readinessProblems || []).length ? (
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>Before this can be sent:</Text>
              {o.readinessProblems.map((p) => (
                <Text key={p} style={styles.noticeText}>• {p}</Text>
              ))}
            </View>
          ) : null}

          <View style={styles.buttons}>
            <Button
              label="View PDF"
              icon="document-outline"
              tone="ghost"
              busy={busy === 'pdf'}
              onPress={() => act('pdf', () => downloadAndShare(`${BASE}/offers/${id}/pdf`, `${o.offerNumber || `offer-${id}`}.pdf`), 'Offer letter ready.')}
            />
            {o.canEdit ? (
              <Button label="Edit on the website" icon="create-outline" tone="ghost" onPress={() => openOnWebsite(ROOT, `/hr/platform/dashboard/offers/${id}`, o.candidateName)} />
            ) : null}
            {o.canSend ? <Button label="Send to candidate" icon="send-outline" onPress={() => setSending('send')} /> : null}
            {o.canResend ? <Button label="Re-send with a new link" icon="refresh-outline" tone="ghost" onPress={() => setSending('resend')} /> : null}
            {o.canRevise ? (
              <Button
                label="Revise"
                icon="git-branch-outline"
                tone="ghost"
                busy={busy === 'revise'}
                onPress={() =>
                  confirmFirst('Start a new version of this offer? The current one stops working once the new one is sent.', () =>
                    act('revise', () => staffApi.post(`${BASE}/offers/${id}/revise`, {}), 'A new draft version was created.'),
                  )
                }
              />
            ) : null}
            {o.canOnboard ? (
              <Button
                label="Onboard"
                icon="person-add-outline"
                busy={busy === 'onboard'}
                onPress={() =>
                  confirmFirst(`Create ${o.candidateName}'s employee account from this offer?`, () =>
                    act('onboard', () => staffApi.post(`${BASE}/offers/${id}/onboard`, {}), 'Onboarded.'),
                  )
                }
              />
            ) : null}
            {o.onboarded && o.convertedSchoolUserId ? (
              <Button label="Open employee record" icon="person-outline" tone="ghost" onPress={() => router.push(`${ROOT}/hr-employee?id=${o.convertedSchoolUserId}`)} />
            ) : null}
            {o.canWithdraw ? <Button label="Withdraw" icon="close-circle-outline" tone="danger" onPress={() => setWithdrawing(true)} /> : null}
          </View>

          <Section title="History">
            {(data.events || []).length === 0 ? <Text style={styles.muted}>Nothing yet.</Text> : null}
            {(data.events || []).map((ev, i) => (
              <View key={ev.id ?? i} style={[styles.event, { borderLeftColor: palette.accent }]}>
                <Text style={styles.eventTitle}>{String(ev.eventType || ev.type || '').replace(/_/g, ' ').toLowerCase()}</Text>
                <Text style={styles.muted}>{[day(ev.createdAt), ev.actorName || ev.actorEmail, ev.detail || ev.note].filter(Boolean).join(' · ')}</Text>
              </View>
            ))}
          </Section>

          <SenderEmailSheet
            visible={!!sending}
            subtitle={
              sending === 'resend'
                ? 'The offer is sent again with a new link. The link in the earlier email stops working.'
                : `This emails the offer to ${o.candidateEmail} from the company mailbox.`
            }
            submitting={busy === 'send'}
            onClose={() => setSending(null)}
            onSubmit={async (senderEmail) => {
              const kind = sending;
              setSending(null);
              await act('send', () => staffApi.post(`${BASE}/offers/${id}/send`, { senderEmail }), kind === 'resend' ? 'Offer re-sent with a new link.' : `Offer emailed to ${o.candidateEmail}.`);
            }}
          />
          <FieldsSheet
            visible={withdrawing}
            title="Withdraw this offer"
            submitLabel="Withdraw"
            fields={[{ key: 'reason', label: 'Reason', type: 'multiline', required: true }]}
            onSubmit={async (p) => {
              await staffApi.post(`${BASE}/offers/${id}/withdraw`, { reason: p.reason });
              setWithdrawing(false);
              showToast('Offer withdrawn. Its link no longer works.', 'success');
              reload();
            }}
            onClose={() => setWithdrawing(false)}
          />
        </>
      ) : null}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  stat: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SLATE[200],
    borderTopWidth: 3,
    padding: SPACING.md,
  },
  statLabel: { fontSize: TYPE.caption, fontWeight: '700', color: SLATE[600] },
  statValue: { fontSize: TYPE.title, fontWeight: '800', marginTop: 4 },
  statNote: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 2 },
  card: { backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: SLATE[200], padding: SPACING.md, marginBottom: SPACING.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm, marginBottom: SPACING.sm },
  sectionTitle: { flex: 1, fontSize: TYPE.heading, fontWeight: '800', color: SLATE[900] },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.md, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: SLATE[100] },
  rowLabel: { flex: 1, fontSize: TYPE.body, color: SLATE[600] },
  rowValue: { flex: 1, fontSize: TYPE.body, fontWeight: '700', color: SLATE[900], textAlign: 'right' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.sm },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm, marginBottom: SPACING.sm },
  button: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, minHeight: 40 },
  buttonText: { fontSize: TYPE.label, fontWeight: '800' },
  pressed: { opacity: 0.85 },
  muted: { fontSize: TYPE.caption, color: SLATE[600], marginTop: 2 },
  lead: { fontSize: TYPE.body, color: SLATE[600], marginBottom: SPACING.md },
  warn: { fontSize: TYPE.caption, color: FEEDBACK.warningText, backgroundColor: FEEDBACK.warningBg, borderRadius: 10, padding: SPACING.sm, marginTop: SPACING.sm },
  person: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: SLATE[100] },
  personText: { flex: 1 },
  personName: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[900] },
  eventTitle: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[900], textTransform: 'capitalize' },
  notice: { backgroundColor: FEEDBACK.warningBg, borderColor: FEEDBACK.warningBorder, borderWidth: 1, borderRadius: 12, padding: SPACING.md, marginBottom: SPACING.md },
  noticeTitle: { fontSize: TYPE.label, fontWeight: '800', color: FEEDBACK.warningText },
  noticeText: { fontSize: TYPE.caption, color: FEEDBACK.warningText, marginTop: 2 },
  event: { borderLeftWidth: 2, paddingLeft: SPACING.sm, marginBottom: SPACING.sm },
}));
