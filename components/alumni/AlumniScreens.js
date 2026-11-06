import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SLATE, SPACING, TOUCH, TYPE } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { alumniApi } from '../../services/portalClients';
import CrudListScreen from '../portal/CrudListScreen';
import RecordScreen from '../portal/RecordScreen';
import PortalHomeScreen from '../portal/PortalHomeScreen';
import ParentTabsScreen from '../parent/ParentTabsScreen';
import { formatLongDate, formatLongDateTime } from '../../utils/dates';
import { makeStyles } from '../../utils/makeStyles';

/**
 * The Alumni portal, native (5 Nov 2026) — the website's Alumni/platform, page for page:
 * My Profile (with Education, Career and Achievements), My Connections, Mentoring, Jobs, Events,
 * Messages and Contributions. Every call is the website's own (`/api/alumni/...`), through the
 * alumni token.
 */

const D = '/api/alumni/dashboard';
const year = (v) => (v ? String(v) : '');
const splitList = (text) =>
  String(text || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

export const ALUMNI_TILES = [
  { key: 'profile', label: 'My Profile', icon: 'person-circle-outline', route: '/alumni/profile', blurb: 'Your details, education and career' },
  { key: 'connections', label: 'My Connections', icon: 'people-outline', route: '/alumni/connections', blurb: 'Classmates and fellow alumni' },
  { key: 'mentoring', label: 'Mentoring', icon: 'school-outline', route: '/alumni/mentoring', blurb: 'Guide students who ask for you' },
  { key: 'jobs', label: 'Jobs', icon: 'briefcase-outline', route: '/alumni/jobs', blurb: 'Openings shared by alumni' },
  { key: 'events', label: 'Events', icon: 'calendar-outline', route: '/alumni/events', blurb: 'Meets, talks and reunions' },
  { key: 'messages', label: 'Messages', icon: 'chatbubbles-outline', route: '/alumni/messages', blurb: 'Talk to your connections' },
  { key: 'contributions', label: 'Contributions', icon: 'heart-outline', route: '/alumni/contributions', blurb: 'Give back to your school' },
];

export function AlumniHome() {
  const [incoming, setIncoming] = useState(null);
  const load = useCallback(async () => {
    try {
      const r = await alumniApi.get(`${D}/connections/incoming-count`);
      setIncoming(typeof r === 'number' ? r : r?.count ?? null);
    } catch {
      setIncoming(null);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <PortalHomeScreen
      portalLabel="Alumni"
      nameKey="alumniUserName"
      tiles={ALUMNI_TILES}
      stats={incoming == null ? undefined : [{ label: 'Connection requests waiting', value: String(incoming) }]}
      onRefresh={load}
      intro="Stay connected with your school, mentor its students and give back."
    />
  );
}

// ── My Profile ──────────────────────────────────────────────────────────────

const PROFILE_FIELDS = [
  { key: 'currentCompany', label: 'Current company' },
  { key: 'designation', label: 'Designation' },
  { key: 'industry', label: 'Industry' },
  { key: 'city', label: 'City' },
  { key: 'country', label: 'Country' },
  { key: 'linkedinUrl', label: 'LinkedIn URL', type: 'url' },
  { key: 'qualification', label: 'Highest qualification' },
  { key: 'skillsText', label: 'Skills', helper: 'Separate with commas' },
  {
    key: 'profileVisibility',
    label: 'Profile type',
    type: 'select',
    options: [
      { value: 'PUBLIC', label: 'Public profile (all can see)' },
      { value: 'PRIVATE', label: 'Private profile (only admin can see)' },
    ],
  },
  { key: 'testimonial', label: 'Testimonial', type: 'multiline' },
];

export function AlumniProfile() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  return (
    <RecordScreen
      title="My Profile"
      fallbackRoute="/alumni"
      load={() => alumniApi.get(`${D}/profile`)}
      heading={(p) => p.fullName}
      subheading={(p) => (p.approvalStatus ? `Account: ${String(p.approvalStatus).toLowerCase()}` : '')}
      photo={(p) => p.profilePhotoUrl || null}
      sections={[
        {
          title: 'Registration',
          rows: [
            ['Email', 'email'],
            ['Phone', 'phone'],
            ['School', (p) => [p.schoolName, year(p.schoolPassingYear)].filter(Boolean).join(' · ')],
            ['College', (p) => [p.collegeName, year(p.collegePassingYear)].filter(Boolean).join(' · ')],
          ],
        },
        {
          title: 'Professional',
          rows: [
            ['Company', 'currentCompany'],
            ['Designation', 'designation'],
            ['Industry', 'industry'],
            ['City', (p) => [p.city, p.country].filter(Boolean).join(', ')],
            ['LinkedIn', 'linkedinUrl'],
            ['Qualification', 'qualification'],
            ['Skills', (p) => (Array.isArray(p.skills) ? p.skills.join(', ') : '')],
            ['Profile type', (p) => (p.profileVisibility === 'PUBLIC' ? 'Public' : 'Private')],
            ['Testimonial', 'testimonial'],
          ],
        },
      ]}
      fields={PROFILE_FIELDS}
      formFrom={(p) => ({ ...p, skillsText: Array.isArray(p.skills) ? p.skills.join(', ') : '', profileVisibility: p.profileVisibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE' })}
      save={(v) => {
        const { skillsText, ...rest } = v;
        return alumniApi.put(`${D}/profile`, { ...rest, skills: splitList(skillsText) });
      }}
    >
      {() => (
        <View style={styles.links}>
          {[
            ['Education', 'school-outline', '/alumni/education'],
            ['Career', 'briefcase-outline', '/alumni/career'],
            ['Achievements', 'trophy-outline', '/alumni/achievements'],
          ].map(([label, icon, route]) => (
            <Pressable
              key={route}
              onPress={() => router.push(route)}
              style={({ pressed }) => [styles.link, { borderColor: palette.primary }, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Ionicons name={icon} size={18} color={palette.primaryDark} />
              <Text style={[styles.linkText, { color: palette.primaryDark }]}>{label}</Text>
              <Ionicons name="chevron-forward" size={16} color={palette.primaryDark} />
            </Pressable>
          ))}
        </View>
      )}
    </RecordScreen>
  );
}

const crud = (path) => ({
  load: () => alumniApi.get(`${D}/${path}`),
  create: (v) => alumniApi.post(`${D}/${path}`, v),
  update: (item, v) => alumniApi.put(`${D}/${path}/${item.id}`, v),
  remove: (item) => alumniApi.del(`${D}/${path}/${item.id}`),
});

export function AlumniEducation() {
  return (
    <CrudListScreen
      title="Education"
      fallbackRoute="/alumni/profile"
      {...crud('education')}
      addLabel="Add education"
      emptyTitle="No education added yet"
      describe={(e) => ({
        title: e.institution,
        subtitle: [e.degree, e.fieldOfStudy].filter(Boolean).join(' · '),
        meta: [['Years', [e.startYear, e.endYear].filter(Boolean).join(' – ')]],
      })}
      fields={[
        { key: 'institution', label: 'Institution', required: true },
        { key: 'degree', label: 'Degree' },
        { key: 'fieldOfStudy', label: 'Field of study' },
        { key: 'startYear', label: 'Start year', type: 'number' },
        { key: 'endYear', label: 'End year', type: 'number' },
      ]}
    />
  );
}

export function AlumniCareer() {
  return (
    <CrudListScreen
      title="Career"
      fallbackRoute="/alumni/profile"
      {...crud('career')}
      addLabel="Add a role"
      emptyTitle="No career entries yet"
      describe={(c) => ({
        title: c.title,
        subtitle: [c.company, c.industry].filter(Boolean).join(' · '),
        meta: [['Period', `${c.startDate ? formatLongDate(c.startDate) : '—'} – ${c.ongoing ? 'Present' : c.endDate ? formatLongDate(c.endDate) : '—'}`]],
        body: c.description,
      })}
      fields={[
        { key: 'title', label: 'Job title', required: true },
        { key: 'company', label: 'Company', required: true },
        { key: 'industry', label: 'Industry' },
        { key: 'startDate', label: 'Start date', type: 'date' },
        { key: 'ongoing', label: 'I work here now', type: 'switch' },
        { key: 'endDate', label: 'End date', type: 'date' },
        { key: 'description', label: 'Description', type: 'multiline' },
      ]}
    />
  );
}

export function AlumniAchievements() {
  return (
    <CrudListScreen
      title="Achievements"
      fallbackRoute="/alumni/profile"
      {...crud('achievements')}
      addLabel="Add an achievement"
      emptyTitle="No achievements yet"
      describe={(a) => ({ title: a.title, subtitle: year(a.year), body: a.description })}
      fields={[
        { key: 'title', label: 'Title', required: true },
        { key: 'year', label: 'Year', type: 'number' },
        { key: 'description', label: 'Description', type: 'multiline' },
      ]}
    />
  );
}

// ── My Connections ──────────────────────────────────────────────────────────

const STATUS_CHIP = {
  CONNECTED: { label: 'Connected', tone: 'success' },
  OUTGOING_PENDING: { label: 'Request sent', tone: 'info' },
  INCOMING_PENDING: { label: 'Wants to connect', tone: 'warning' },
};

const counterpart = (c) => ({
  title: c.counterpartName,
  subtitle: [c.counterpartDesignation, c.counterpartCompany].filter(Boolean).join(' · '),
  meta: [['School', c.counterpartSchoolName], ['College', c.counterpartCollegeName]],
});

export function AlumniConnections() {
  const overview = () => alumniApi.get(`${D}/connections`);
  return (
    <ParentTabsScreen
      title="My Connections"
      fallbackRoute="/alumni"
      tabs={[
        {
          value: 'directory',
          label: 'Directory',
          render: () => (
            <CrudListScreen
              embedded
              load={() => alumniApi.get(`${D}/directory`)}
              emptyTitle="No alumni to show yet"
              describe={(a) => ({
                title: a.fullName,
                subtitle: [a.designation, a.currentCompany].filter(Boolean).join(' · '),
                chips: [STATUS_CHIP[a.connectionStatus], a.classmate ? { label: 'Classmate', tone: 'info' } : null].filter(Boolean),
                meta: [
                  ['School', [a.schoolName, year(a.schoolPassingYear)].filter(Boolean).join(' · ')],
                  ['College', [a.collegeName, year(a.collegePassingYear)].filter(Boolean).join(' · ')],
                  ['City', [a.city, a.country].filter(Boolean).join(', ')],
                  ['Industry', a.industry],
                  ['Skills', Array.isArray(a.skills) ? a.skills.join(', ') : ''],
                ],
              })}
              actions={[
                {
                  key: 'connect',
                  label: 'Connect',
                  icon: 'person-add-outline',
                  when: (a) => !a.connectionStatus || a.connectionStatus === 'NONE',
                  run: (a) => alumniApi.post(`${D}/connections/${a.id}/request`),
                  done: 'Connection request sent.',
                },
              ]}
            />
          ),
        },
        {
          value: 'requests',
          label: 'Requests',
          render: () => (
            <CrudListScreen
              embedded
              load={overview}
              pick={(d) => d?.incoming}
              emptyTitle="No requests waiting"
              describe={counterpart}
              actions={[
                { key: 'accept', label: 'Accept', icon: 'checkmark-outline', run: (c) => alumniApi.post(`${D}/connections/${c.id}/accept`), done: 'Connection accepted.' },
                { key: 'reject', label: 'Decline', icon: 'close-outline', run: (c) => alumniApi.post(`${D}/connections/${c.id}/reject`), done: 'Request declined.' },
              ]}
            />
          ),
        },
        {
          value: 'connected',
          label: 'Connected',
          render: () => (
            <CrudListScreen
              embedded
              load={overview}
              pick={(d) => d?.accepted}
              emptyTitle="No connections yet"
              describe={counterpart}
            />
          ),
        },
        {
          value: 'sent',
          label: 'Sent',
          render: () => (
            <CrudListScreen
              embedded
              load={overview}
              pick={(d) => d?.outgoing}
              emptyTitle="No requests sent"
              describe={counterpart}
              actions={[
                { key: 'cancel', label: 'Cancel request', icon: 'close-outline', run: (c) => alumniApi.post(`${D}/connections/${c.id}/cancel`), done: 'Request cancelled.' },
              ]}
            />
          ),
        },
      ]}
    />
  );
}

// ── Mentoring ───────────────────────────────────────────────────────────────

const request = (r) => ({
  title: r.studentName,
  subtitle: r.studentSchoolName,
  meta: [['Scheduled', r.scheduledAt ? formatLongDateTime(r.scheduledAt) : '']],
  body: r.message,
});

export function AlumniMentoring() {
  const overview = () => alumniApi.get(`${D}/mentor/requests`);
  return (
    <ParentTabsScreen
      title="Mentoring"
      fallbackRoute="/alumni"
      tabs={[
        {
          value: 'profile',
          label: 'My mentor profile',
          render: () => (
            <RecordScreen
              embedded
              load={() => alumniApi.get(`${D}/mentor/profile`)}
              sections={[
                {
                  title: 'Mentor profile',
                  rows: [
                    ['Taking requests', (p) => (p.mentor ? 'Yes — students can ask you' : 'No')],
                    ['Areas', (p) => (Array.isArray(p.expertise) ? p.expertise.join(', ') : '')],
                  ],
                },
              ]}
              fields={[
                { key: 'mentor', label: 'Register me as a mentor', type: 'switch' },
                { key: 'expertiseText', label: 'Areas students can ask you about', helper: 'Separate with commas, e.g. Engineering, Career guidance' },
              ]}
              formFrom={(p) => ({ mentor: !!p.mentor, expertiseText: Array.isArray(p.expertise) ? p.expertise.join(', ') : '' })}
              save={(v) => alumniApi.put(`${D}/mentor/profile`, { mentor: !!v.mentor, expertise: splitList(v.expertiseText) })}
            />
          ),
        },
        {
          value: 'pending',
          label: 'Requests',
          render: () => (
            <CrudListScreen
              embedded
              load={overview}
              pick={(d) => d?.pending}
              emptyTitle="No requests waiting"
              describe={request}
              actions={[
                {
                  key: 'accept',
                  label: 'Accept',
                  icon: 'checkmark-outline',
                  fields: [{ key: 'scheduledAt', label: 'Meeting time', type: 'datetime', required: true }],
                  run: (r, v) => alumniApi.post(`${D}/mentor/requests/${r.id}/accept`, { scheduledAt: v.scheduledAt }),
                  done: 'Mentorship request accepted.',
                },
                { key: 'decline', label: 'Decline', icon: 'close-outline', run: (r) => alumniApi.post(`${D}/mentor/requests/${r.id}/decline`), done: 'Request declined.' },
              ]}
            />
          ),
        },
        {
          value: 'accepted',
          label: 'Accepted',
          render: () => (
            <CrudListScreen embedded load={overview} pick={(d) => d?.accepted} emptyTitle="No accepted requests" describe={request} />
          ),
        },
      ]}
    />
  );
}

// ── Jobs ────────────────────────────────────────────────────────────────────

const JOB_FIELDS = [
  { key: 'title', label: 'Title', required: true },
  { key: 'company', label: 'Company', required: true },
  { key: 'type', label: 'Type', type: 'select', options: [{ value: 'JOB', label: 'Job' }, { value: 'INTERNSHIP', label: 'Internship' }], default: 'JOB' },
  { key: 'location', label: 'Location' },
  { key: 'description', label: 'Description', type: 'multiline' },
  { key: 'applyInfo', label: 'How to apply', type: 'multiline' },
  { key: 'active', label: 'Open for applications', type: 'switch' },
];

const job = (p) => ({
  title: p.title,
  subtitle: [p.company, p.location].filter(Boolean).join(' · '),
  chips: [{ label: p.type === 'INTERNSHIP' ? 'Internship' : 'Job', tone: 'info' }, p.active === false ? { label: 'Closed', tone: 'neutral' } : null].filter(Boolean),
  meta: [['Posted by', [p.posterName, p.posterDesignation].filter(Boolean).join(' · ')], ['Apply', p.applyInfo]],
  body: p.description,
});

export function AlumniJobs() {
  return (
    <ParentTabsScreen
      title="Jobs"
      fallbackRoute="/alumni"
      tabs={[
        { value: 'board', label: 'Job board', render: () => <CrudListScreen embedded load={() => alumniApi.get(`${D}/jobs/board`)} emptyTitle="No openings yet" describe={job} /> },
        {
          value: 'mine',
          label: 'My postings',
          render: () => (
            <CrudListScreen
              embedded
              load={() => alumniApi.get(`${D}/jobs/mine`)}
              create={(v) => alumniApi.post(`${D}/jobs`, v)}
              update={(item, v) => alumniApi.put(`${D}/jobs/${item.id}`, v)}
              remove={(item) => alumniApi.del(`${D}/jobs/${item.id}`)}
              addLabel="Post an opening"
              emptyTitle="You have not posted anything yet"
              fields={JOB_FIELDS}
              describe={job}
            />
          ),
        },
      ]}
    />
  );
}

// ── Events ──────────────────────────────────────────────────────────────────

const event = (e) => ({
  title: e.title,
  subtitle: e.scheduledAt ? formatLongDateTime(e.scheduledAt) : '',
  chips: [e.type ? { label: String(e.type).replace(/_/g, ' ').toLowerCase(), tone: 'info' } : null, e.registered ? { label: 'Registered', tone: 'success' } : null].filter(Boolean),
  meta: [['Where', e.location], ['Meeting link', e.meetingLink], ['Registered', e.registeredCount != null ? String(e.registeredCount) : '']],
  body: e.description,
});

export function AlumniEvents() {
  const actions = [
    {
      key: 'register',
      label: 'Register',
      icon: 'checkmark-circle-outline',
      when: (e) => !e.registered,
      fields: [{ key: 'volunteerAsSpeaker', label: 'I would like to speak at this event', type: 'switch' }],
      run: (e, v) => alumniApi.post(`${D}/events/${e.id}/register`, { volunteerAsSpeaker: !!v.volunteerAsSpeaker }),
      done: 'You are registered.',
    },
    { key: 'cancel', label: 'Cancel registration', icon: 'close-outline', when: (e) => e.registered, run: (e) => alumniApi.post(`${D}/events/${e.id}/cancel`), done: 'Registration cancelled.' },
  ];
  return (
    <ParentTabsScreen
      title="Events"
      fallbackRoute="/alumni"
      tabs={[
        { value: 'all', label: 'All events', render: () => <CrudListScreen embedded load={() => alumniApi.get(`${D}/events`)} emptyTitle="No events yet" describe={event} actions={actions} /> },
        { value: 'mine', label: 'My events', render: () => <CrudListScreen embedded load={() => alumniApi.get(`${D}/events/mine`)} emptyTitle="You have not registered for any event" describe={event} actions={actions} /> },
      ]}
    />
  );
}

// ── Contributions ───────────────────────────────────────────────────────────

const PURPOSE = {
  GENERAL_DONATION: 'General Donation',
  SPONSOR_SCHOLARSHIP: 'Sponsor a Scholarship',
  SPONSOR_STUDENT: 'Sponsor a Student',
  SUPPORT_PROJECT: 'Support an Institutional Project',
};

export function AlumniContributions() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  return (
    <CrudListScreen
      title="Contributions"
      fallbackRoute="/alumni"
      load={() => alumniApi.get(`${D}/contributions/mine`)}
      emptyTitle="No contributions yet"
      emptyMessage="Donate, sponsor a scholarship or a student, or support a project."
      header={() => (
        <Pressable
          onPress={() => router.push('/alumni/contribute')}
          style={({ pressed }) => [styles.give, { backgroundColor: palette.primary }, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Ionicons name="heart" size={19} color="#ffffff" />
          <Text style={styles.giveText}>Make a contribution</Text>
        </Pressable>
      )}
      describe={(c) => ({
        title: `₹${Number(c.amountInr || 0).toLocaleString('en-IN')}`,
        subtitle: PURPOSE[c.purpose] || c.purpose,
        chips: [{ label: String(c.status || '').toLowerCase(), tone: c.status === 'PAID' || c.status === 'SUCCESS' ? 'success' : 'neutral' }],
        meta: [['Date', c.createdAt ? formatLongDate(c.createdAt) : '']],
        body: c.note,
      })}
    />
  );
}

const useStyles = makeStyles(() => ({
  links: { gap: SPACING.sm, marginTop: SPACING.sm },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: TOUCH.min,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: SPACING.md,
    backgroundColor: '#ffffff',
  },
  linkText: { flex: 1, fontSize: TYPE.heading, fontWeight: '800' },
  give: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    minHeight: TOUCH.min,
    borderRadius: 14,
    marginBottom: SPACING.md,
  },
  giveText: { fontSize: TYPE.heading, fontWeight: '800', color: '#ffffff' },
  pressed: { opacity: 0.8 },
  muted: { color: SLATE[500] },
}));
