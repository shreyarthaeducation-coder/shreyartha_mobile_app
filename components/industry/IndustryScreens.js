import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SLATE, SPACING, TOUCH, TYPE } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { industryApi as api } from '../../services/portalClients';
import { pickImage, pickPdf } from '../../utils/filePicker';
import CrudListScreen from '../portal/CrudListScreen';
import RecordScreen from '../portal/RecordScreen';
import PortalHomeScreen from '../portal/PortalHomeScreen';
import ParentTabsScreen from '../parent/ParentTabsScreen';
import { formatLongDate, formatLongDateTime } from '../../utils/dates';
import { makeStyles } from '../../utils/makeStyles';

/**
 * The Industry portal, native (5 Nov 2026) — the website's Industry/platform: Profile, Eligibility
 * Criteria, Perks & Benefits, Assessment (with the question builder and assessments assigned to
 * students) and Session Requests from colleges. Questions are plain text here; the website's
 * rich-text editor and PDF import stay on the website.
 */

const D = '/api/industry/dashboard';
const lbl = (list, v) => list.find((x) => x.value === v)?.label || v || '';

export const INDUSTRY_TILES = [
  { key: 'profile', label: 'Profile & Institution', icon: 'business-outline', route: '/industry/profile' },
  { key: 'eligibility', label: 'Eligibility Criteria', icon: 'checkmark-done-outline', route: '/industry/eligibility' },
  { key: 'perks', label: 'Perks & Benefits', icon: 'gift-outline', route: '/industry/perks' },
  { key: 'assessment', label: 'Assessment', icon: 'clipboard-outline', route: '/industry/assessments' },
  { key: 'sessions', label: 'Session Request', icon: 'calendar-outline', route: '/industry/sessions' },
];

export function IndustryHome() {
  const [p, setP] = useState(null);
  const load = useCallback(async () => {
    try {
      setP(await api.get(`${D}/profile`));
    } catch {
      setP(null);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <PortalHomeScreen
      portalLabel="Industry"
      nameKey="industryUserName"
      tiles={INDUSTRY_TILES}
      onRefresh={load}
      intro={p ? (p.approved ? 'Approved — colleges and students can see your company.' : 'Pending approval — you can set everything up meanwhile.') : undefined}
      stats={p ? [{ label: 'Industry code', value: p.industryCode || '—' }, { label: 'Status', value: p.approved ? 'Approved' : 'Pending' }] : undefined}
    />
  );
}

export function IndustryProfile() {
  const styles = useStyles();
  const palette = usePalette();
  const [busy, setBusy] = useState('');
  const upload = async (kind, reload, showToast) => {
    const file = await pickImage();
    if (!file || file.denied) return;
    setBusy(kind);
    try {
      await api.multipart(`${D}/profile/${kind}`, { files: { file } });
      showToast(kind === 'logo' ? 'Logo updated.' : 'Banner updated.', 'success');
      reload();
    } catch (e) {
      showToast(e?.message || 'Upload failed.', 'error');
    } finally {
      setBusy('');
    }
  };
  return (
    <RecordScreen
      title="Profile & Institution"
      fallbackRoute="/industry"
      load={() => api.get(`${D}/profile`)}
      heading={(p) => p.companyName}
      subheading={(p) => p.officialEmail}
      photo={(p) => p.logoUrl || null}
      sections={[
        { title: 'Company', rows: [['Company', 'companyName'], ['Established', 'establishedYear'], ['Website', 'websiteUrl'], ['About', 'description']] },
        { title: 'Contact', rows: [['Contact person', 'fullName'], ['Official email', 'officialEmail'], ['Phone', 'contactNumber']] },
      ]}
      fields={[
        { key: 'companyName', label: 'Company name', required: true },
        { key: 'fullName', label: 'Contact person' },
        { key: 'officialEmail', label: 'Official email', type: 'email' },
        { key: 'contactNumber', label: 'Contact number', type: 'phone' },
        { key: 'websiteUrl', label: 'Website', type: 'url' },
        { key: 'establishedYear', label: 'Established year', type: 'number' },
        { key: 'description', label: 'About the company', type: 'multiline' },
      ]}
      save={(v, record) => api.put(`${D}/profile`, { ...record, ...v })}
    >
      {(p, reload, showToast) => (
        <View style={styles.media}>
          {p.bannerUrl ? <Image source={{ uri: p.bannerUrl }} style={styles.banner} resizeMode="cover" /> : null}
          <View style={styles.row}>
            {[
              ['logo', 'Upload logo', 'image-outline'],
              ['banner', 'Upload banner', 'easel-outline'],
            ].map(([kind, label, icon]) => (
              <Pressable
                key={kind}
                disabled={!!busy}
                onPress={() => upload(kind, reload, showToast)}
                style={({ pressed }) => [styles.button, { borderColor: palette.primary }, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Ionicons name={icon} size={18} color={palette.primaryDark} />
                <Text style={[styles.buttonText, { color: palette.primaryDark }]}>{busy === kind ? 'Uploading…' : label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </RecordScreen>
  );
}

const crud = (path) => ({
  load: () => api.get(`${D}/${path}`),
  create: (v) => api.post(`${D}/${path}`, v),
  update: (item, v) => api.put(`${D}/${path}/${item.id}`, v),
  remove: (item) => api.del(`${D}/${path}/${item.id}`),
});

const SCORE_TYPES = [
  { value: 'PERCENTAGE', label: 'Percentage (out of 100)' },
  { value: 'CGPA', label: 'CGPA (out of 10)' },
];

export function IndustryEligibility() {
  return (
    <CrudListScreen
      title="Eligibility Criteria"
      fallbackRoute="/industry"
      {...crud('eligibility')}
      addLabel="Add criteria"
      emptyTitle="No eligibility criteria yet"
      describe={(e) => ({
        title: e.title,
        meta: [
          ['Minimum score', e.minAcademicScore != null ? `${e.minAcademicScore}${e.academicScoreType === 'CGPA' ? ' CGPA' : '%'}` : ''],
          ['Age', [e.minAge, e.maxAge].some((x) => x != null) ? `${e.minAge ?? '—'} – ${e.maxAge ?? '—'}` : ''],
          ['Minimum qualification', e.minQualification],
          ['Degrees', e.eligibleDegrees],
          ['Experience', e.experienceRequirement],
          ['Technical skills', e.technicalSkills],
          ['Soft skills', e.softSkills],
          ['Certifications', e.preferredCertifications],
          ['Other conditions', e.additionalConditions],
        ],
      })}
      fields={[
        { key: 'title', label: 'Title', required: true },
        { key: 'academicScoreType', label: 'Score type', type: 'select', options: SCORE_TYPES, default: 'PERCENTAGE' },
        { key: 'minAcademicScore', label: 'Minimum academic score', type: 'number' },
        { key: 'minAge', label: 'Minimum age', type: 'number' },
        { key: 'maxAge', label: 'Maximum age', type: 'number' },
        { key: 'minQualification', label: 'Minimum qualification' },
        { key: 'eligibleDegrees', label: 'Eligible degrees' },
        { key: 'experienceRequirement', label: 'Experience' },
        { key: 'technicalSkills', label: 'Technical skills', type: 'multiline' },
        { key: 'softSkills', label: 'Soft skills', type: 'multiline' },
        { key: 'preferredCertifications', label: 'Preferred certifications', type: 'multiline' },
        { key: 'additionalConditions', label: 'Other conditions', type: 'multiline' },
      ]}
    />
  );
}

const OPPORTUNITY_TYPES = [
  { value: 'INTERNSHIP', label: 'Internship' },
  { value: 'FULL_TIME', label: 'Full-time' },
  { value: 'PART_TIME', label: 'Part-time' },
  { value: 'APPRENTICESHIP', label: 'Apprenticeship' },
];
const WORK_MODES = [
  { value: 'ON_SITE', label: 'On-site' },
  { value: 'HYBRID', label: 'Hybrid' },
  { value: 'REMOTE', label: 'Remote' },
];

export function IndustryPerks() {
  return (
    <CrudListScreen
      title="Perks & Benefits"
      fallbackRoute="/industry"
      {...crud('opportunities')}
      addLabel="Add an opportunity"
      emptyTitle="No opportunities yet"
      describe={(o) => ({
        title: o.roleTitle,
        subtitle: [lbl(OPPORTUNITY_TYPES, o.opportunityType), lbl(WORK_MODES, o.workMode), o.location].filter(Boolean).join(' · '),
        meta: [
          ['Compensation', o.compensation],
          ['Duration', o.duration],
          ['Working hours', o.workingHours],
          ['Training & mentorship', o.trainingMentorship],
          ['Certifications', o.certificationsOffered],
          ['Career growth', o.careerGrowth],
          ['Benefits', o.additionalBenefits],
          ['Other perks', o.otherPerks],
        ],
      })}
      fields={[
        { key: 'roleTitle', label: 'Role', required: true },
        { key: 'opportunityType', label: 'Type', type: 'select', options: OPPORTUNITY_TYPES, default: 'INTERNSHIP' },
        { key: 'workMode', label: 'Work mode', type: 'select', options: WORK_MODES },
        { key: 'location', label: 'Location' },
        { key: 'compensation', label: 'Compensation' },
        { key: 'duration', label: 'Duration' },
        { key: 'workingHours', label: 'Working hours' },
        { key: 'trainingMentorship', label: 'Training & mentorship', type: 'multiline' },
        { key: 'certificationsOffered', label: 'Certifications offered', type: 'multiline' },
        { key: 'careerGrowth', label: 'Career growth', type: 'multiline' },
        { key: 'additionalBenefits', label: 'Additional benefits', type: 'multiline' },
        { key: 'otherPerks', label: 'Other perks', type: 'multiline' },
      ]}
    />
  );
}

const ASSESSMENT_TYPES = [
  ['APTITUDE', 'Aptitude'], ['TECHNICAL', 'Technical'], ['CODING', 'Coding'], ['INTERVIEW', 'Interview'],
  ['LOGICAL_REASONING', 'Logical Reasoning'], ['VERBAL_ABILITY', 'Verbal Ability'], ['QUANTITATIVE', 'Quantitative'],
  ['DOMAIN_SPECIFIC', 'Domain-Specific'], ['INDUSTRY_SPECIFIC', 'Industry-Specific'], ['EMPLOYABILITY', 'Employability Skills'],
  ['CUSTOM', 'Custom'], ['OTHER', 'Other'],
].map(([value, label]) => ({ value, label }));
const NEXT = {
  DRAFT: [{ to: 'PUBLISHED', label: 'Publish' }],
  PUBLISHED: [{ to: 'CLOSED', label: 'Close' }, { to: 'DRAFT', label: 'Move to Draft' }],
  CLOSED: [{ to: 'DRAFT', label: 'Reopen as Draft' }],
};
const STATUS_TONE = { DRAFT: 'neutral', PUBLISHED: 'success', CLOSED: 'warning' };
const num = (v) => (v === '' || v == null ? null : Number(v));

export function IndustryAssessments() {
  const router = useRouter();
  const payload = (v) => ({
    mode: v.mode || 'CREATED',
    name: v.name,
    description: v.description,
    assessmentType: v.assessmentType,
    durationMinutes: num(v.durationMinutes),
    passingCriteria: v.passingCriteria,
    instructions: v.instructions,
    ...(v.mode === 'ATTACHED' ? { totalMarks: num(v.totalMarks), numberOfQuestions: num(v.numberOfQuestions) } : {}),
  });
  return (
    <ParentTabsScreen
      title="Assessment"
      fallbackRoute="/industry"
      tabs={[
        {
          value: 'mine',
          label: 'My assessments',
          render: () => (
            <CrudListScreen
              embedded
              load={() => api.get(`${D}/assessments`)}
              create={(v) => api.post(`${D}/assessments`, payload(v))}
              update={(a, v) => api.put(`${D}/assessments/${a.id}`, payload(v))}
              remove={(a) => api.del(`${D}/assessments/${a.id}`)}
              addLabel="New assessment"
              emptyTitle="No assessments yet"
              emptyMessage="Create one with questions here, or attach a paper (PDF) you already have."
              fields={[
                { key: 'mode', label: 'How', type: 'select', options: [{ value: 'CREATED', label: 'Create questions here' }, { value: 'ATTACHED', label: 'Attach a paper (PDF)' }], default: 'CREATED' },
                { key: 'name', label: 'Name', required: true },
                { key: 'assessmentType', label: 'Type', type: 'select', options: ASSESSMENT_TYPES, default: 'APTITUDE' },
                { key: 'durationMinutes', label: 'Duration (minutes)', type: 'number' },
                { key: 'passingCriteria', label: 'Passing criteria' },
                { key: 'totalMarks', label: 'Total marks (attached paper)', type: 'number' },
                { key: 'numberOfQuestions', label: 'Number of questions (attached paper)', type: 'number' },
                { key: 'description', label: 'Description', type: 'multiline' },
                { key: 'instructions', label: 'Instructions', type: 'multiline' },
              ]}
              describe={(a) => ({
                title: a.name,
                subtitle: [lbl(ASSESSMENT_TYPES, a.assessmentType), a.mode === 'ATTACHED' ? 'Attached paper' : 'Questions'].join(' · '),
                chips: [{ label: String(a.status || 'DRAFT').toLowerCase(), tone: STATUS_TONE[a.status] || 'neutral' }],
                meta: [['Duration', a.durationMinutes ? `${a.durationMinutes} min` : ''], ['Questions', a.numberOfQuestions], ['Total marks', a.totalMarks], ['Passing', a.passingCriteria], ['Files', Array.isArray(a.files) && a.files.length ? a.files.map((f) => f.name).join(', ') : '']],
                body: a.description,
              })}
              actions={[
                ...['PUBLISHED', 'CLOSED', 'DRAFT'].map((to) => ({
                  key: `to-${to}`,
                  label: (Object.values(NEXT).flat().find((n) => n.to === to) || {}).label,
                  icon: to === 'PUBLISHED' ? 'megaphone-outline' : to === 'CLOSED' ? 'lock-closed-outline' : 'arrow-undo-outline',
                  when: (a) => (NEXT[a.status || 'DRAFT'] || []).some((n) => n.to === to),
                  confirm: to === 'PUBLISHED' ? 'Publish this assessment?' : to === 'CLOSED' ? 'Close this assessment? It can be reopened as a draft later.' : undefined,
                  run: (a) => api.put(`${D}/assessments/${a.id}/status`, { status: to }),
                  done: 'Status changed.',
                })),
                {
                  key: 'questions',
                  label: 'Questions',
                  icon: 'list-outline',
                  when: (a) => a.mode !== 'ATTACHED',
                  run: async (a) => router.push({ pathname: '/industry/questions', params: { id: String(a.id), name: a.name } }),
                },
                {
                  key: 'attach',
                  label: 'Attach a file',
                  icon: 'attach-outline',
                  when: (a) => a.mode === 'ATTACHED',
                  run: async (a) => {
                    const file = await pickPdf();
                    if (!file || file.denied) return;
                    await api.multipart(`${D}/assessments/${a.id}/files`, { files: { file } });
                  },
                  done: 'File attached.',
                },
              ]}
            />
          ),
        },
        {
          value: 'assigned',
          label: 'Assigned to students',
          render: () => (
            <CrudListScreen
              embedded
              load={() => api.get(`${D}/assigned-assessments`)}
              emptyTitle="No assessments assigned yet"
              describe={(a) => ({
                title: a.title || a.assessmentName,
                subtitle: [a.category, a.assignedBy ? `Assigned by ${a.assignedBy}` : ''].filter(Boolean).join(' · '),
                chips: a.status ? [{ label: String(a.status).toLowerCase(), tone: 'info' }] : [],
                meta: [
                  ['Window', [a.startsAt ? formatLongDateTime(a.startsAt) : '', a.endsAt ? formatLongDateTime(a.endsAt) : ''].filter(Boolean).join(' – ')],
                  ['Questions', a.totalQuestions],
                  ['Total marks', a.totalMarks],
                  ['Completed', a.completedCount],
                  ['Assigned', a.assignedAt ? formatLongDate(a.assignedAt) : ''],
                ],
                body: a.description,
              })}
            />
          ),
        },
      ]}
    />
  );
}

const BLOOMS = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'];

/** One assessment's questions: text, options A–D, the right one, marks, Bloom's level and skill. */
export function IndustryQuestions() {
  const { id, name } = useLocalSearchParams();
  return (
    <CrudListScreen
      title={name || 'Questions'}
      fallbackRoute="/industry/assessments"
      load={() => api.get(`${D}/assessments/${id}/questions`)}
      loadKey={id}
      create={(v) => api.post(`${D}/assessments/${id}/questions`, v)}
      update={(q, v) => api.put(`${D}/assessments/${id}/questions/${q.id}`, v)}
      remove={(q) => api.del(`${D}/assessments/${id}/questions/${q.id}`)}
      addLabel="Add a question"
      emptyTitle="No questions yet"
      emptyMessage="An assessment can have up to 100 questions."
      describe={(q) => ({
        title: stripHtml(q.questionText),
        meta: ['A', 'B', 'C', 'D'].map((o) => [`${o}${q.correctAnswer === o ? ' ✓' : ''}`, stripHtml(q[`option${o}`])]).concat([
          ['Marks', `${q.marks ?? 1}${q.negativeMarks ? ` (−${q.negativeMarks})` : ''}`],
          ["Bloom's", q.bloomsLevel],
          ['Skill', q.skillSet],
        ]),
      })}
      formFrom={(q) => ({ ...q, questionText: stripHtml(q.questionText), optionA: stripHtml(q.optionA), optionB: stripHtml(q.optionB), optionC: stripHtml(q.optionC), optionD: stripHtml(q.optionD) })}
      fields={[
        { key: 'questionText', label: 'Question', type: 'multiline', required: true },
        { key: 'optionA', label: 'Option A', required: true },
        { key: 'optionB', label: 'Option B', required: true },
        { key: 'optionC', label: 'Option C' },
        { key: 'optionD', label: 'Option D' },
        { key: 'correctAnswer', label: 'Correct answer', type: 'select', options: ['A', 'B', 'C', 'D'], required: true },
        { key: 'marks', label: 'Marks', type: 'number', default: '1' },
        { key: 'negativeMarks', label: 'Negative marks', type: 'number', default: '0' },
        { key: 'bloomsLevel', label: "Bloom's level", type: 'select', options: BLOOMS },
        { key: 'skillSet', label: 'Skill' },
        { key: 'hint', label: 'Hint', type: 'multiline' },
        { key: 'solution', label: 'Solution', type: 'multiline' },
      ]}
    />
  );
}

function stripHtml(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

export function IndustrySessions() {
  return (
    <CrudListScreen
      title="Session Request"
      fallbackRoute="/industry"
      load={() => api.get(`${D}/session-requests`)}
      emptyTitle="No session requests yet"
      emptyMessage="Colleges' requests for talks, workshops and orientations appear here once approved."
      describe={(r) => ({
        title: r.title,
        subtitle: r.institutionName,
        chips: r.status ? [{ label: String(r.status).toLowerCase(), tone: r.status === 'APPROVED' ? 'success' : r.status === 'PENDING' ? 'warning' : 'neutral' }] : [],
        meta: [['Mode', String(r.sessionMode || '').replace(/_/g, ' ').toLowerCase()], ['Date', r.preferredDate ? formatLongDate(r.preferredDate) : ''], ['Starts', r.preferredStartTime]],
      })}
    />
  );
}

const useStyles = makeStyles(() => ({
  media: { marginTop: SPACING.sm },
  banner: { width: '100%', height: 140, borderRadius: 14, marginBottom: SPACING.sm, backgroundColor: SLATE[100] },
  row: { flexDirection: 'row', gap: SPACING.sm },
  button: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: TOUCH.min, borderRadius: 12, borderWidth: 1.5, backgroundColor: '#ffffff' },
  buttonText: { fontSize: TYPE.label, fontWeight: '800' },
  pressed: { opacity: 0.8 },
}));
