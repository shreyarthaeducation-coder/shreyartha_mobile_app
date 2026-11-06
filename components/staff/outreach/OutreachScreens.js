import { staffApi } from '../../../services/staffApi';
import { downloadAndShare } from '../../../utils/downloadFile';
import CrudListScreen from '../../portal/CrudListScreen';

/**
 * Admissions & Outreach for the School Admin (5 Nov 2026) — the website's Admission Enquiries, Job
 * Enquiries and Alumni Management (School/shared/outreach), on `/api/school-admin`, which is
 * `hasRole('SCHOOL_ADMIN')`. Every list answer is `{ items, hq, schoolNames }`; a school admin sees
 * only their own school's, so the HQ-only "assign to a school" control is left out here.
 *
 * Statuses and labels are the website's own (AdmissionEnquiries.js, JobEnquiries.js,
 * AlumniManagement.js) so a record reads the same on both.
 */

const BASE = '/api/school-admin';

export const ADMISSION_STATUS = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  VISIT_SCHEDULED: 'Visit scheduled',
  ADMITTED: 'Admitted',
  CLOSED: 'Closed',
};

export const JOB_STATUS = {
  NEW: 'New',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW: 'Interview',
  HIRED: 'Hired',
  REJECTED: 'Rejected',
};

export const ALUMNI_STATUS = { PENDING: 'Waiting for approval', APPROVED: 'Approved', REJECTED: 'Not approved' };

const MODE = { PHONE: 'Phone call', WHATSAPP: 'WhatsApp', EMAIL: 'Email' };

const TONE = {
  NEW: 'info',
  CONTACTED: 'warning',
  VISIT_SCHEDULED: 'warning',
  SHORTLISTED: 'warning',
  INTERVIEW: 'warning',
  ADMITTED: 'success',
  HIRED: 'success',
  APPROVED: 'success',
  PENDING: 'warning',
  CLOSED: 'neutral',
  REJECTED: 'error',
};

const when = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? String(v)
    : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const options = (labels) => Object.entries(labels).map(([value, label]) => ({ value, label }));

const tabsFor = (labels, field = 'status') => [
  { value: 'ALL', label: 'All' },
  ...Object.entries(labels).map(([value, label]) => ({ value, label, filter: (r) => r[field] === value })),
];

const items = (data) => data?.items || [];

/** The status-and-notes form both enquiry kinds share, prefilled with the record's own. */
const statusAction = (kind, labels) => ({
  key: 'status',
  label: 'Update status',
  icon: 'swap-horizontal-outline',
  fields: [
    { key: 'status', label: 'Status', type: 'select', options: options(labels), required: true },
    { key: 'staffNotes', label: 'Notes for the school', type: 'multiline', maxLength: 2000 },
  ],
  initial: (r) => ({ status: r.status, staffNotes: r.staffNotes || '' }),
  run: (r, v) => staffApi.put(`${BASE}/${kind}/${r.id}`, { status: v.status, staffNotes: v.staffNotes || '' }),
  done: 'Saved.',
});

export function AdmissionEnquiriesScreen({ homeRoute }) {
  return (
    <CrudListScreen
      title="Admission Enquiries"
      fallbackRoute={homeRoute}
      load={() => staffApi.get(`${BASE}/admission-enquiries`)}
      pick={items}
      tabs={tabsFor(ADMISSION_STATUS)}
      emptyTitle="No enquiries"
      emptyMessage="Enquiries parents send from the website's Admissions page appear here."
      describe={(r) => ({
        title: r.studentName || r.parentName || r.referenceNumber,
        subtitle: [r.referenceNumber, when(r.createdAt)].filter(Boolean).join(' · '),
        chips: [{ label: ADMISSION_STATUS[r.status] || r.status, tone: TONE[r.status] }],
        meta: [
          // HQ (the Shreyartha Admin) sees every school's, so each record names its own.
          ['School', r.school?.name || r.schoolName || r.schoolCode],
          ['Parent', r.parentName],
          ['Class', r.classSought],
          ['Academic year', r.academicYear],
          ['Current school', r.currentSchool],
          ['Phone', r.phone],
          ['Email', r.email],
          ['Contact by', MODE[r.preferredMode] || r.preferredMode],
          ['Handled by', r.handledBy],
          ['Notes', r.staffNotes],
        ],
        body: r.message,
      })}
      actions={[statusAction('admission-enquiries', ADMISSION_STATUS)]}
    />
  );
}

export function JobEnquiriesScreen({ homeRoute }) {
  return (
    <CrudListScreen
      title="Job Enquiries"
      fallbackRoute={homeRoute}
      load={() => staffApi.get(`${BASE}/job-enquiries`)}
      pick={items}
      tabs={tabsFor(JOB_STATUS)}
      emptyTitle="No applications"
      emptyMessage="Applications sent from the website's Careers page appear here."
      describe={(r) => ({
        title: r.fullName || r.referenceNumber,
        subtitle: [r.position, r.referenceNumber, when(r.createdAt)].filter(Boolean).join(' · '),
        chips: [{ label: JOB_STATUS[r.status] || r.status, tone: TONE[r.status] }],
        meta: [
          ['School', r.school?.name || r.schoolName || r.schoolCode],
          ['Qualification', r.qualification],
          ['Experience', r.experienceYears != null ? `${r.experienceYears} years` : ''],
          ['Subjects', r.subjects],
          ['Phone', r.phone],
          ['Email', r.email],
          ['Résumé', r.resumeFileName],
          ['Handled by', r.handledBy],
          ['Notes', r.staffNotes],
        ],
        body: r.coverNote,
      })}
      actions={[
        statusAction('job-enquiries', JOB_STATUS),
        {
          key: 'resume',
          label: 'Open résumé',
          icon: 'document-attach-outline',
          when: (r) => !!r.resumeFileName,
          // The server answers with the file's own type (PDF or Word), so no type is insisted on.
          run: (r) => downloadAndShare(`${BASE}/job-enquiries/${r.id}/resume`, r.resumeFileName || `resume-${r.id}`, ''),
        },
      ]}
    />
  );
}

export function AlumniManagementScreen({ homeRoute }) {
  return (
    <CrudListScreen
      title="Alumni Management"
      fallbackRoute={homeRoute}
      load={() => staffApi.get(`${BASE}/alumni`)}
      pick={items}
      tabs={tabsFor(ALUMNI_STATUS, 'approvalStatus')}
      emptyTitle="No alumni yet"
      emptyMessage="Former students who sign up as alumni of your school appear here for approval."
      describe={(r) => ({
        title: r.fullName,
        subtitle: [r.designation, r.currentCompany].filter(Boolean).join(' at ') || r.email,
        chips: [
          { label: ALUMNI_STATUS[r.approvalStatus] || r.approvalStatus, tone: TONE[r.approvalStatus] },
          r.approvalStatus === 'APPROVED'
            ? { label: r.profileVisibility === 'PUBLIC' ? 'Shown on the website' : 'Private', tone: 'neutral' }
            : null,
        ],
        meta: [
          ['Email', r.email],
          ['Phone', r.phone],
          ['School', [r.schoolName, r.schoolPassingYear].filter(Boolean).join(' · ')],
          ['College', [r.collegeName, r.collegePassingYear].filter(Boolean).join(' · ')],
          ['Qualification', r.qualification],
          ['City', r.city],
          ['LinkedIn', r.linkedinUrl],
          ['Reason', r.approvalStatus === 'REJECTED' ? r.rejectionReason : ''],
        ],
        body: r.testimonial,
      })}
      actions={[
        {
          key: 'approve',
          label: 'Approve',
          icon: 'checkmark-circle-outline',
          when: (r) => r.approvalStatus !== 'APPROVED',
          confirm: 'Approve this alumni account? They can then sign in.',
          run: (r) => staffApi.post(`${BASE}/alumni/${r.id}/approve`, {}),
          done: 'Approved.',
        },
        {
          key: 'reject',
          label: 'Reject',
          icon: 'close-circle-outline',
          when: (r) => r.approvalStatus === 'PENDING',
          fields: [{ key: 'reason', label: 'Reason (shown to them)', type: 'multiline', required: true, maxLength: 500 }],
          run: (r, v) => staffApi.post(`${BASE}/alumni/${r.id}/reject`, { reason: v.reason }),
          done: 'Rejected.',
        },
        {
          key: 'visibility',
          label: 'Website visibility',
          icon: 'eye-outline',
          when: (r) => r.approvalStatus === 'APPROVED',
          fields: [
            {
              key: 'visibility',
              label: 'Show on the school website',
              type: 'select',
              required: true,
              options: [
                { value: 'PUBLIC', label: 'Shown on the website' },
                { value: 'PRIVATE', label: 'Private' },
              ],
            },
          ],
          initial: (r) => ({ visibility: r.profileVisibility || 'PRIVATE' }),
          run: (r, v) => staffApi.post(`${BASE}/alumni/${r.id}/visibility`, { visibility: v.visibility }),
          done: 'Saved.',
        },
      ]}
    />
  );
}
