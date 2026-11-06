import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SLATE, SPACING, TYPE } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { universityStaffApi as api } from '../../services/portalClients';
import CrudListScreen from '../portal/CrudListScreen';
import PortalHomeScreen from '../portal/PortalHomeScreen';
import FieldInput from '../portal/FieldInput';
import { formatLongDate, formatLongDateTime } from '../../utils/dates';
import { makeStyles } from '../../utils/makeStyles';

/**
 * Placement Head, native (5 Nov 2026) — the website's University Staff placement dashboard:
 * Overview, Student Registration, Eligible Students, Recruiters, Placement Drives (with each
 * drive's applicants: stage, interview and offer), Interviews, Offers, PPOs, the Placement Tracker
 * and Reports. Every call is the website's own `/api/placement-head/...`; which status a record may
 * move to next comes from the server (`allowedNext`), never from the app.
 */

const P = '/api/placement-head';
const label = (v) => String(v || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const lpa = (v) => (v == null || v === '' ? '' : `${v} LPA`);
const inr = (v) => (v == null || v === '' ? '' : `₹${Number(v).toLocaleString('en-IN')}`);
const num = (v) => (v === '' || v == null ? null : Number(v));
const pay = (x) => (x.payLpa != null ? lpa(x.payLpa) : x.payAmount != null ? `${inr(x.payAmount)}${x.payType === 'MONTHLY_STIPEND' ? ' / month' : ''}` : '');
const TONE = { PLACED: 'success', ACCEPTED: 'success', OPEN: 'success', SCHEDULED: 'info', COMPLETED: 'info', REJECTED: 'error', CANCELLED: 'neutral', DECLINED: 'error', WITHDRAWN: 'neutral' };
const status = (s) => (s ? { label: label(s), tone: TONE[s] || 'warning' } : null);
const statusField = (item) => ({
  key: 'status',
  label: 'Move to',
  type: 'select',
  required: true,
  options: (item?.allowedNext || []).map((s) => ({ value: s, label: label(s) })),
});
const reasonField = { key: 'reason', label: 'Reason (optional)', type: 'multiline' };

export const PLACEMENT_TILES = [
  { key: 'registration', label: 'Student Registration', icon: 'person-add-outline', route: '/unistaff/placement/students' },
  { key: 'eligible', label: 'Eligible Students', icon: 'checkmark-done-outline', route: '/unistaff/placement/eligible' },
  { key: 'recruiters', label: 'Recruiter Management', icon: 'business-outline', route: '/unistaff/placement/recruiters' },
  { key: 'drives', label: 'Placement Drives', icon: 'rocket-outline', route: '/unistaff/placement/drives' },
  { key: 'interviews', label: 'Interview Scheduling', icon: 'chatbubbles-outline', route: '/unistaff/placement/interviews' },
  { key: 'offers', label: 'Offers Management', icon: 'ribbon-outline', route: '/unistaff/placement/offers' },
  { key: 'ppo', label: 'PPO Management', icon: 'star-outline', route: '/unistaff/placement/ppo' },
  { key: 'tracker', label: 'Placement Tracker', icon: 'git-network-outline', route: '/unistaff/placement/tracker' },
  { key: 'reports', label: 'Reports', icon: 'document-text-outline', route: '/unistaff/placement/reports' },
];

export function PlacementHome() {
  const [o, setO] = useState(null);
  const load = useCallback(async () => {
    try {
      setO(await api.get(`${P}/overview`));
    } catch {
      setO(null);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <PortalHomeScreen
      portalLabel="Placement Head"
      nameKey="universityStaffName"
      tiles={PLACEMENT_TILES}
      onRefresh={load}
      changePasswordRoute="/unistaff/change-password"
      stats={
        o
          ? [
              { label: 'Registered for placements', value: o.registeredStudents },
              { label: 'Active drives', value: o.activeDrives },
              { label: 'Students placed', value: o.placedStudents },
              { label: 'Placement percentage', value: o.placementPercentage != null ? `${o.placementPercentage}%` : '—' },
              { label: 'Offers received', value: o.offersReceived },
              { label: 'Highest CTC', value: lpa(o.highestCtcLpa) || '—' },
            ]
          : undefined
      }
    />
  );
}

// ── Student Registration ────────────────────────────────────────────────────

const REG_FIELDS = [
  { key: 'cgpa', label: 'CGPA', type: 'number' },
  { key: 'percentage', label: 'Percentage', type: 'number' },
  { key: 'activeBacklogs', label: 'Active backlogs', type: 'number' },
  { key: 'skills', label: 'Skills', type: 'multiline' },
  { key: 'certifications', label: 'Certifications', type: 'multiline' },
  { key: 'notes', label: 'Notes', type: 'multiline' },
];
const regPayload = (s, v) => ({
  studentId: s.studentId,
  cgpa: num(v.cgpa),
  percentage: num(v.percentage),
  activeBacklogs: num(v.activeBacklogs),
  skills: v.skills,
  certifications: v.certifications,
  notes: v.notes,
});

export function PlacementStudents() {
  return (
    <CrudListScreen
      title="Student Registration"
      fallbackRoute="/unistaff/placement"
      load={() => api.get(`${P}/students`)}
      itemKey={(s) => s.studentId}
      tabs={[
        { value: 'all', label: 'All', filter: () => true },
        { value: 'registered', label: 'Registered', filter: (s) => s.registrationStatus === 'REGISTERED' },
        { value: 'not', label: 'Not registered', filter: (s) => s.registrationStatus !== 'REGISTERED' },
      ]}
      emptyTitle="No students"
      describe={(s) => ({
        title: s.name,
        subtitle: [s.rollNumber, s.departmentName, s.batchName].filter(Boolean).join(' · '),
        chips: [status(s.registrationStatus || 'NOT_REGISTERED'), s.placementStatus ? status(s.placementStatus) : null].filter(Boolean),
        meta: [['CGPA', s.cgpa], ['Percentage', s.percentage != null ? `${s.percentage}%` : ''], ['Backlogs', s.activeBacklogs], ['Resume', s.hasResume ? 'Uploaded' : '']],
      })}
      actions={[
        {
          key: 'register',
          label: 'Register',
          icon: 'person-add-outline',
          when: (s) => s.registrationStatus !== 'REGISTERED',
          fields: REG_FIELDS,
          run: (s, v) => api.post(`${P}/registrations`, regPayload(s, v)),
          done: 'Registered for placements.',
        },
        {
          key: 'edit',
          label: 'Update profile',
          icon: 'create-outline',
          when: (s) => s.registrationStatus === 'REGISTERED',
          fields: REG_FIELDS,
          run: (s, v) => api.put(`${P}/registrations/${s.registrationId}`, regPayload(s, v)),
          done: 'Placement profile updated.',
        },
        {
          key: 'withdraw',
          label: 'Withdraw',
          icon: 'remove-circle-outline',
          when: (s) => s.registrationStatus === 'REGISTERED',
          fields: [reasonField],
          run: (s, v) => api.post(`${P}/registrations/${s.registrationId}/withdraw`, { reason: v.reason }),
          done: 'Withdrawn from placements.',
        },
      ]}
    />
  );
}

// ── Eligible Students ───────────────────────────────────────────────────────

export function PlacementEligible() {
  const styles = useStyles();
  const [drives, setDrives] = useState([]);
  const [driveId, setDriveId] = useState('');
  useEffect(() => {
    api.get(`${P}/drives`).then((d) => setDrives(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);
  return (
    <CrudListScreen
      key={driveId || 'none'}
      title="Eligible Students"
      fallbackRoute="/unistaff/placement"
      load={() => (driveId ? api.get(`${P}/drives/${driveId}/eligibility`) : Promise.resolve([]))}
      loadKey={driveId}
      pick={(d) => (Array.isArray(d) ? d : d?.students || d?.rows || [])}
      itemKey={(s) => s.studentId}
      header={() => (
        <View style={styles.picker}>
          <FieldInput
            field={{ key: 'drive', label: 'Placement drive', type: 'select', options: drives.map((d) => ({ value: String(d.id), label: `${d.title} · ${d.companyName || ''}` })) }}
            value={driveId}
            onChange={setDriveId}
          />
        </View>
      )}
      emptyTitle={driveId ? 'No students to show for this drive' : 'Choose a drive'}
      describe={(s) => ({
        title: s.name,
        subtitle: [s.rollNumber, s.departmentName, s.batchName].filter(Boolean).join(' · '),
        chips: [s.verdict ? status(s.verdict) : null, s.inDrive ? { label: 'In this drive', tone: 'success' } : null].filter(Boolean),
        meta: [['CGPA', s.cgpa], ['Percentage', s.percentage != null ? `${s.percentage}%` : ''], ['Backlogs', s.activeBacklogs]],
        body: Array.isArray(s.reasons) ? s.reasons.join('\n') : s.reason,
      })}
      actions={[
        {
          key: 'add',
          label: 'Add to drive',
          icon: 'add-circle-outline',
          when: (s) => !s.inDrive && s.verdict !== 'INELIGIBLE',
          run: (s) => api.post(`${P}/drives/${driveId}/applicants`, { studentIds: [s.studentId], includeUndetermined: s.verdict !== 'ELIGIBLE' }),
          done: 'Added to the drive.',
        },
      ]}
    />
  );
}

// ── Recruiters ──────────────────────────────────────────────────────────────

export function PlacementRecruiters() {
  const [companies, setCompanies] = useState([]);
  useEffect(() => {
    api.get(`${P}/recruiters/companies`).then((c) => setCompanies(Array.isArray(c) ? c : [])).catch(() => {});
  }, []);
  return (
    <CrudListScreen
      title="Recruiter Management"
      fallbackRoute="/unistaff/placement"
      load={() => api.get(`${P}/recruiters`)}
      create={(v) => api.post(`${P}/recruiters`, { ...v, industryUserId: num(v.industryUserId) })}
      update={(r, v) => api.put(`${P}/recruiters/${r.id}`, { ...v, industryUserId: num(v.industryUserId) })}
      formFrom={(r) => ({ ...r, industryUserId: r.industryUserId != null ? String(r.industryUserId) : '' })}
      addLabel="Add a recruiter"
      emptyTitle="No recruiters yet"
      fields={[
        { key: 'industryUserId', label: 'Registered company (optional)', type: 'select', options: companies.map((c) => ({ value: String(c.id ?? c.industryUserId), label: c.companyName })) },
        { key: 'companyName', label: 'Company name', helper: 'Needed when the company is not registered' },
        { key: 'industrySector', label: 'Industry sector' },
        { key: 'website', label: 'Website', type: 'url' },
        { key: 'location', label: 'Location' },
        { key: 'recruiterName', label: 'Recruiter name' },
        { key: 'recruiterEmail', label: 'Recruiter email', type: 'email' },
        { key: 'recruiterPhone', label: 'Recruiter phone', type: 'phone' },
        { key: 'rolesOffered', label: 'Roles offered', type: 'multiline' },
        { key: 'status', label: 'Status', type: 'select', options: ['ACTIVE', 'INACTIVE'].map((s) => ({ value: s, label: label(s) })), default: 'ACTIVE' },
        { key: 'notes', label: 'Notes', type: 'multiline' },
      ]}
      describe={(r) => ({
        title: r.companyName,
        subtitle: [r.industrySector, r.location].filter(Boolean).join(' · '),
        chips: [status(r.status), r.registeredCompany ? { label: 'Registered', tone: 'info' } : null].filter(Boolean),
        meta: [['Recruiter', [r.recruiterName, r.recruiterEmail, r.recruiterPhone].filter(Boolean).join(' · ')], ['Drives', r.driveCount], ['Offers', r.offerCount], ['Placed', r.placedCount]],
        body: r.rolesOffered,
      })}
    />
  );
}

// ── Placement Drives ────────────────────────────────────────────────────────

const DRIVE_FIELDS = (recruiters) => [
  { key: 'recruiterId', label: 'Recruiter', type: 'select', required: true, options: recruiters.map((r) => ({ value: String(r.id), label: r.companyName })) },
  { key: 'title', label: 'Drive title', required: true },
  { key: 'jobRole', label: 'Job role', required: true },
  { key: 'employmentType', label: 'Employment type', type: 'select', options: ['FULL_TIME', 'INTERNSHIP', 'PART_TIME', 'CONTRACT'].map((t) => ({ value: t, label: label(t) })), default: 'FULL_TIME' },
  { key: 'workMode', label: 'Work mode', type: 'select', options: ['ON_SITE', 'HYBRID', 'REMOTE'].map((t) => ({ value: t, label: label(t) })) },
  { key: 'location', label: 'Location' },
  { key: 'payType', label: 'Pay', type: 'select', options: [{ value: 'ANNUAL_CTC', label: 'Annual CTC' }, { value: 'MONTHLY_STIPEND', label: 'Monthly stipend' }] },
  { key: 'payAmount', label: 'Amount (₹)', type: 'number' },
  { key: 'minCgpa', label: 'Minimum CGPA', type: 'number' },
  { key: 'minPercentage', label: 'Minimum percentage', type: 'number' },
  { key: 'maxActiveBacklogs', label: 'Maximum active backlogs', type: 'number' },
  { key: 'requiredSkills', label: 'Required skills', type: 'multiline' },
  { key: 'otherCriteria', label: 'Other criteria', type: 'multiline' },
  { key: 'applicationStart', label: 'Applications open', type: 'date' },
  { key: 'applicationDeadline', label: 'Application deadline', type: 'date' },
  { key: 'driveDate', label: 'Drive date', type: 'date' },
  { key: 'stages', label: 'Stages', type: 'multiline', helper: 'One per line, e.g. Aptitude test, Technical interview, HR interview' },
  { key: 'description', label: 'Description', type: 'multiline' },
];

export function PlacementDrives() {
  const router = useRouter();
  const [recruiters, setRecruiters] = useState([]);
  useEffect(() => {
    api.get(`${P}/recruiters`).then((r) => setRecruiters(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);
  const body = (v, d) => ({
    // Editing keeps the drive's eligible programmes, departments and batches as they were.
    eligibleProgrammeIds: d?.eligibleProgrammeIds || [],
    eligibleDepartmentIds: d?.eligibleDepartmentIds || [],
    eligibleBatchIds: d?.eligibleBatchIds || [],
    industryOpportunityId: d?.industryOpportunityId ?? null,
    ...v,
    recruiterId: num(v.recruiterId),
  });
  return (
    <CrudListScreen
      title="Placement Drives"
      fallbackRoute="/unistaff/placement"
      load={() => api.get(`${P}/drives`)}
      create={(v) => api.post(`${P}/drives`, body(v))}
      update={(d, v) => api.put(`${P}/drives/${d.id}`, body(v, d))}
      formFrom={(d) => ({ ...d, recruiterId: d.recruiterId != null ? String(d.recruiterId) : '' })}
      addLabel="Create a drive"
      emptyTitle="No placement drives yet"
      fields={DRIVE_FIELDS(recruiters)}
      describe={(d) => ({
        title: d.title,
        subtitle: [d.companyName, d.jobRole].filter(Boolean).join(' · '),
        chips: [status(d.status), d.employmentType ? { label: label(d.employmentType), tone: 'info' } : null].filter(Boolean),
        meta: [['Drive date', d.driveDate ? formatLongDate(d.driveDate) : ''], ['Deadline', d.applicationDeadline ? formatLongDate(d.applicationDeadline) : ''], ['Pay', pay(d)], ['Applicants', d.applicantCount], ['Placed', d.placedCount]],
      })}
      actions={[
        { key: 'open', label: 'Applicants', icon: 'people-outline', run: async (d) => router.push({ pathname: '/unistaff/placement/drive', params: { id: String(d.id) } }) },
        {
          key: 'status',
          label: 'Change status',
          icon: 'swap-horizontal-outline',
          when: (d) => (d.allowedNext || []).length > 0,
          fieldsFor: (d) => [statusField(d), reasonField],
          run: (d, v) => api.post(`${P}/drives/${d.id}/status`, { status: v.status, reason: v.reason }),
          done: 'Drive updated.',
        },
      ]}
    />
  );
}

/** One drive: its status, and every applicant with what can happen to them next. */
export function PlacementDrive() {
  const { id } = useLocalSearchParams();
  const [drive, setDrive] = useState(null);
  const loadDrive = useCallback(async () => {
    const d = await api.get(`${P}/drives/${id}`);
    setDrive(d);
    return d;
  }, [id]);
  const stages = String(drive?.stages || '').split('\n').filter(Boolean);
  return (
    <CrudListScreen
      title={drive?.title || 'Drive'}
      fallbackRoute="/unistaff/placement/drives"
      load={async () => (await loadDrive())?.applications || []}
      loadKey={id}
      emptyTitle="No applicants yet"
      emptyMessage="Add eligible students from Eligible Students."
      header={() =>
        drive ? (
          <DriveSummary drive={drive} />
        ) : null
      }
      describe={(a) => ({
        title: a.studentName,
        subtitle: [a.rollNumber, a.departmentName].filter(Boolean).join(' · '),
        chips: [status(a.status), a.currentStage ? { label: a.currentStage, tone: 'info' } : null].filter(Boolean),
      })}
      actions={[
        {
          key: 'stage',
          label: 'Set stage',
          icon: 'flag-outline',
          when: () => stages.length > 0,
          fields: [{ key: 'currentStage', label: 'Stage', type: 'select', required: true, options: stages }],
          run: (a, v) => api.put(`${P}/applications/${a.id}/status`, { currentStage: v.currentStage }),
          done: 'Stage updated.',
        },
        {
          key: 'status',
          label: 'Change status',
          icon: 'swap-horizontal-outline',
          when: (a) => (a.allowedNext || []).length > 0,
          fieldsFor: (a) => [statusField(a)],
          run: (a, v) => api.put(`${P}/applications/${a.id}/status`, { status: v.status }),
          done: 'Status updated.',
        },
        {
          key: 'interview',
          label: 'Schedule interview',
          icon: 'calendar-outline',
          fields: INTERVIEW_FIELDS,
          run: (a, v) => api.post(`${P}/interviews`, interviewPayload({ ...v, driveId: id, applicationId: a.id })),
          done: 'Interview scheduled.',
        },
        {
          key: 'offer',
          label: 'Record offer',
          icon: 'ribbon-outline',
          fields: OFFER_FIELDS,
          run: (a, v) => api.post(`${P}/offers`, { ...v, applicationId: a.id, payAmount: num(v.payAmount), studentId: a.studentId ?? null, recruiterId: drive?.recruiterId ?? null }),
          done: 'Offer recorded.',
        },
      ]}
    />
  );
}

function DriveSummary({ drive }) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <View style={styles.summary}>
      <Text style={[styles.summaryTitle, { color: palette.primaryDark }]}>{drive.companyName} · {drive.jobRole}</Text>
      <Text style={styles.summaryLine}>Status: {label(drive.status)}</Text>
      {drive.driveDate ? <Text style={styles.summaryLine}>Drive date: {formatLongDate(drive.driveDate)}</Text> : null}
      {pay(drive) ? <Text style={styles.summaryLine}>Pay: {pay(drive)}</Text> : null}
    </View>
  );
}

// ── Interviews ──────────────────────────────────────────────────────────────

const INTERVIEW_FIELDS = [
  { key: 'roundName', label: 'Round', required: true, placeholder: 'e.g. Technical interview' },
  { key: 'roundNo', label: 'Round number', type: 'number' },
  { key: 'scheduledDate', label: 'Date', type: 'date', required: true },
  { key: 'startTime', label: 'Start time', required: true, placeholder: 'HH:MM, e.g. 10:30' },
  { key: 'durationMinutes', label: 'Duration (minutes)', type: 'number', default: '30' },
  { key: 'mode', label: 'Mode', type: 'select', options: [{ value: 'IN_PERSON', label: 'In person' }, { value: 'ONLINE', label: 'Online' }, { value: 'HYBRID', label: 'Hybrid' }], default: 'IN_PERSON' },
  { key: 'venue', label: 'Venue' },
  { key: 'meetingLink', label: 'Meeting link', type: 'url' },
  { key: 'interviewer', label: 'Interviewer' },
];
const interviewPayload = (v) => ({ ...v, driveId: num(v.driveId), applicationId: num(v.applicationId), roundNo: num(v.roundNo), durationMinutes: num(v.durationMinutes) });

export function PlacementInterviews() {
  return (
    <CrudListScreen
      title="Interview Scheduling"
      fallbackRoute="/unistaff/placement"
      load={() => api.get(`${P}/interviews`)}
      emptyTitle="No interviews scheduled"
      emptyMessage="Schedule one from a drive's applicants."
      tabs={[
        { value: 'open', label: 'Upcoming', filter: (i) => ['SCHEDULED', 'RESCHEDULED'].includes(i.status) },
        { value: 'all', label: 'All', filter: () => true },
      ]}
      describe={(i) => ({
        title: `${i.studentName} · ${i.roundName || `Round ${i.roundNo || ''}`}`,
        subtitle: [i.companyName, i.driveTitle].filter(Boolean).join(' · '),
        chips: [status(i.status), i.outcome ? status(i.outcome) : null].filter(Boolean),
        meta: [['When', [i.scheduledDate ? formatLongDate(i.scheduledDate) : '', i.startTime].filter(Boolean).join(' · ')], ['Mode', label(i.mode)], ['Venue', i.venue], ['Link', i.meetingLink], ['Interviewer', i.interviewer], ['Cancelled because', i.cancelReason]],
      })}
      actions={[
        {
          key: 'reschedule',
          label: 'Reschedule',
          icon: 'time-outline',
          when: (i) => ['SCHEDULED', 'RESCHEDULED'].includes(i.status),
          fields: INTERVIEW_FIELDS,
          run: (i, v) => api.put(`${P}/interviews/${i.id}`, interviewPayload({ ...v, applicationId: i.applicationId })),
          done: 'Interview rescheduled.',
        },
        {
          key: 'result',
          label: 'Record result',
          icon: 'checkmark-done-outline',
          when: (i) => ['SCHEDULED', 'RESCHEDULED'].includes(i.status),
          fields: [
            { key: 'status', label: 'What happened', type: 'select', required: true, options: [{ value: 'COMPLETED', label: 'Interview completed' }, { value: 'NO_SHOW', label: 'Student did not attend' }] },
            { key: 'outcome', label: 'Outcome (when completed)', type: 'select', options: [{ value: 'CLEARED', label: 'Cleared' }, { value: 'NOT_CLEARED', label: 'Not cleared' }, { value: 'ON_HOLD', label: 'On hold' }] },
            { key: 'feedback', label: 'Feedback', type: 'multiline' },
          ],
          run: (i, v) => api.post(`${P}/interviews/${i.id}/result`, { status: v.status, outcome: v.status === 'COMPLETED' ? v.outcome : null, feedback: v.feedback }),
          done: 'Result recorded.',
        },
        {
          key: 'cancel',
          label: 'Cancel',
          icon: 'close-circle-outline',
          when: (i) => ['SCHEDULED', 'RESCHEDULED'].includes(i.status),
          fields: [reasonField],
          run: (i, v) => api.post(`${P}/interviews/${i.id}/cancel`, { reason: v.reason }),
          done: 'Interview cancelled.',
        },
      ]}
    />
  );
}

// ── Offers ──────────────────────────────────────────────────────────────────

const OFFER_FIELDS = [
  { key: 'jobRole', label: 'Job role', required: true },
  { key: 'offerType', label: 'Offer type', type: 'select', options: ['FULL_TIME', 'INTERNSHIP', 'PPO'].map((t) => ({ value: t, label: label(t) })), default: 'FULL_TIME' },
  { key: 'payType', label: 'Pay', type: 'select', options: [{ value: 'ANNUAL_CTC', label: 'Annual CTC' }, { value: 'MONTHLY_STIPEND', label: 'Monthly stipend' }], default: 'ANNUAL_CTC' },
  { key: 'payAmount', label: 'Amount (₹)', type: 'number' },
  { key: 'offerDate', label: 'Offer date', type: 'date' },
  { key: 'joiningDate', label: 'Joining date', type: 'date' },
];

export function PlacementOffers() {
  return (
    <CrudListScreen
      title="Offers Management"
      fallbackRoute="/unistaff/placement"
      load={() => api.get(`${P}/offers`)}
      emptyTitle="No offers yet"
      emptyMessage="Record an offer from a drive's applicants."
      describe={(x) => ({
        title: x.studentName,
        subtitle: [x.companyName, x.jobRole].filter(Boolean).join(' · '),
        chips: [status(x.status), x.offerType ? { label: label(x.offerType), tone: 'info' } : null].filter(Boolean),
        meta: [['Pay', pay(x)], ['Offer date', x.offerDate ? formatLongDate(x.offerDate) : ''], ['Joining', x.joiningDate ? formatLongDate(x.joiningDate) : ''], ['Drive', x.driveTitle], ['Offer letter', x.hasOfferLetter ? 'Uploaded' : '']],
      })}
      actions={[
        {
          key: 'status',
          label: 'Change status',
          icon: 'swap-horizontal-outline',
          when: (x) => (x.allowedNext || []).length > 0,
          fieldsFor: (x) => [statusField(x), reasonField],
          run: (x, v) => api.post(`${P}/offers/${x.id}/status`, { status: v.status, reason: v.reason }),
          done: 'Offer updated.',
        },
      ]}
    />
  );
}

// ── PPO ─────────────────────────────────────────────────────────────────────

export function PlacementPpo() {
  const [students, setStudents] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  useEffect(() => {
    api.get(`${P}/students`).then((s) => setStudents(Array.isArray(s) ? s : [])).catch(() => {});
    api.get(`${P}/recruiters`).then((r) => setRecruiters(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);
  return (
    <CrudListScreen
      title="PPO Management"
      fallbackRoute="/unistaff/placement"
      load={() => api.get(`${P}/ppos`)}
      create={(v) => api.post(`${P}/ppos`, { ...v, studentId: num(v.studentId), recruiterId: num(v.recruiterId), internshipDurationMonths: num(v.internshipDurationMonths), offeredCtc: num(v.offeredCtc) })}
      addLabel="Record a pre-placement offer"
      emptyTitle="No pre-placement offers yet"
      fields={[
        { key: 'studentId', label: 'Student', type: 'select', required: true, options: students.filter((s) => s.registrationStatus === 'REGISTERED').map((s) => ({ value: String(s.studentId), label: `${s.name}${s.rollNumber ? ` (${s.rollNumber})` : ''}` })) },
        { key: 'recruiterId', label: 'Company', type: 'select', required: true, options: recruiters.map((r) => ({ value: String(r.id), label: r.companyName })) },
        { key: 'internshipReference', label: 'Internship reference' },
        { key: 'internshipDurationMonths', label: 'Internship duration (months)', type: 'number' },
        { key: 'offeredRole', label: 'Offered role', required: true },
        { key: 'offeredCtc', label: 'Offered CTC (₹ a year)', type: 'number' },
        { key: 'offeredDate', label: 'Offered on', type: 'date', required: true },
        { key: 'joiningDate', label: 'Joining date', type: 'date' },
      ]}
      describe={(p) => ({
        title: p.studentName,
        subtitle: [p.companyName, p.offeredRole].filter(Boolean).join(' · '),
        chips: [status(p.status)].filter(Boolean),
        meta: [['Offered', lpa(p.offeredLpa)], ['Offered on', p.offeredDate ? formatLongDate(p.offeredDate) : ''], ['Internship', [p.internshipReference, p.internshipDurationMonths ? `${p.internshipDurationMonths} months` : ''].filter(Boolean).join(' · ')]],
      })}
      actions={[
        {
          key: 'status',
          label: 'Change status',
          icon: 'swap-horizontal-outline',
          when: (p) => (p.allowedNext || []).length > 0,
          fieldsFor: (p) => [statusField(p), reasonField],
          run: (p, v) => api.post(`${P}/ppos/${p.id}/status`, { status: v.status, reason: v.reason }),
          done: 'PPO updated.',
        },
      ]}
    />
  );
}

// ── Tracker ─────────────────────────────────────────────────────────────────

export function PlacementTracker() {
  return (
    <CrudListScreen
      title="Placement Tracker"
      fallbackRoute="/unistaff/placement"
      load={() => api.get(`${P}/tracker`)}
      pick={(d) => (Array.isArray(d) ? d : d?.students || [])}
      itemKey={(s) => s.studentId}
      emptyTitle="No registered students yet"
      describe={(s) => ({
        title: s.name,
        subtitle: [s.rollNumber, s.departmentName, s.batchName].filter(Boolean).join(' · '),
        chips: [status(s.placementStatus)].filter(Boolean),
        meta: [
          ['Applications', Array.isArray(s.applications) ? s.applications.length : s.applications],
          ['Interviews attended', s.interviewsAttended],
          ['Offers', Array.isArray(s.offers) ? s.offers.length : s.offers],
        ],
        body: Array.isArray(s.applications)
          ? s.applications.map((a) => `${a.companyName} · ${a.jobRole || a.driveTitle} — ${label(a.status)}${a.currentStage ? ` (${a.currentStage})` : ''}`).join('\n')
          : undefined,
      })}
    />
  );
}

// ── Reports ─────────────────────────────────────────────────────────────────

export function PlacementReports() {
  const styles = useStyles();
  const [types, setTypes] = useState([]);
  const [type, setType] = useState('');
  useEffect(() => {
    api.get(`${P}/reports/types`).then((t) => setTypes(Array.isArray(t) ? t : [])).catch(() => {});
  }, []);
  const options = types.map((t) => (typeof t === 'string' ? { value: t, label: label(t) } : { value: t.key || t.value || t.type, label: t.label || t.title || label(t.key || t.value) }));
  return (
    <CrudListScreen
      key={type || 'none'}
      title="Reports"
      fallbackRoute="/unistaff/placement"
      load={() => (type ? api.get(`${P}/reports/${type}`) : Promise.resolve(null))}
      loadKey={type}
      pick={(r) => {
        if (!r) return [];
        const cols = r.columns || [];
        return (r.rows || []).map((row, i) => ({ __i: i, cols, row, title: r.title }));
      }}
      itemKey={(x) => x.__i}
      header={(r) => (
        <View style={styles.picker}>
          <FieldInput field={{ key: 'type', label: 'Report', type: 'select', options }} value={type} onChange={setType} />
          {r?.summary ? (
            <Text style={styles.summaryLine}>
              {Object.entries(r.summary)
                .map(([k, v]) => `${label(k)}: ${v}`)
                .join(' · ')}
            </Text>
          ) : null}
        </View>
      )}
      emptyTitle={type ? 'Nothing in this report yet' : 'Choose a report'}
      describe={({ cols, row }) => {
        const cells = Array.isArray(row) ? row : cols.map((c) => row[c.key ?? c]);
        const names = cols.map((c) => c.label || c.title || label(c.key ?? c));
        return { title: String(cells[0] ?? ''), meta: names.slice(1).map((n, i) => [n, cells[i + 1] == null ? '' : String(cells[i + 1])]) };
      }}
    />
  );
}

const useStyles = makeStyles(() => ({
  picker: { backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: SLATE[200], padding: SPACING.md, marginBottom: SPACING.md },
  summary: { backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: SLATE[200], padding: SPACING.md, marginBottom: SPACING.md },
  summaryTitle: { fontSize: TYPE.heading, fontWeight: '800' },
  summaryLine: { fontSize: TYPE.caption, color: SLATE[600], marginTop: 4 },
}));
