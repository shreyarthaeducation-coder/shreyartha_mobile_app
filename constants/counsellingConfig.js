/**
 * Counselling session types and their fields, ported from
 * `frontendmain/src/School/shared/counsellingConfig.js`.
 *
 * Pure data. A field is `{ key, label, type, options }` and the only two types the type-specific
 * fields ever use are `select` and `multiselect` — there is no validation metadata at all.
 *
 * A **teacher sees only `academic` and `parent`**: filtered here for the UI, and enforced
 * server-side by the controller's `ALLOWED_TYPES`, so the client filter is cosmetic.
 * **A counsellor sees all eight.**
 *
 * HISTORY, so the same gap is not reintroduced: this file originally carried only the two teacher
 * types, because it was ported during the teacher pass. `counsellingTypesForRole` was correct all
 * along — "all types" was simply only ever two. The counsellor panels silently offered a quarter of
 * the form until the six below were added.
 *
 * FIELD KEYS AND OPTION STRINGS ARE WIRE VALUES. They are stored as free-form JSON in
 * `formData`, so a renamed key or a reworded option is not an error — it is silently different
 * data from what the website writes. `behavioral` and `specialEducation` are American spellings in
 * the keys and must stay that way, even though the labels around them are British.
 */

export const COUNSELLING_TYPES = [
  {
    key: 'academic',
    label: 'Academic Counselling',
    fields: [
      {
        key: 'presentingConcern',
        label: 'Presenting Concern',
        type: 'multiselect',
        options: [
          'Low academic performance',
          'Subject-specific difficulty',
          'Exam anxiety',
          'Lack of concentration',
          'Poor time management',
          'Incomplete homework',
          'Irregular attendance',
          'Loss of interest in studies',
          'Difficulty understanding concepts',
          'Peer comparison pressure',
        ],
      },
      {
        key: 'academicRiskLevel',
        label: 'Academic Risk Level',
        type: 'select',
        options: ['Low', 'Moderate', 'High'],
      },
      {
        key: 'interventionType',
        label: 'Intervention Type',
        type: 'multiselect',
        options: [
          'Study plan created',
          'Remedial classes suggested',
          'Peer tutoring',
          'Parent meeting advised',
          'Subject teacher consulted',
          'Time-table restructured',
          'Goal setting exercise',
          'Regular follow-up scheduled',
        ],
      },
    ],
  },
  {
    key: 'career',
    label: 'Career & Future Planning',
    fields: [
      {
        key: 'careerClarityLevel',
        label: 'Career Clarity Level',
        type: 'select',
        options: [
          'Clear & Confident',
          'Exploring Options',
          'Confused',
          'Parent-driven decision',
          'Peer-influenced decision',
        ],
      },
      {
        key: 'identifiedInterestCluster',
        label: 'Identified Interest Cluster',
        type: 'select',
        options: [
          'STEM',
          'Commerce & Business',
          'Humanities & Social Sciences',
          'Creative Arts',
          'Sports',
          'Public Services',
          'Entrepreneurship',
          'Healthcare',
          'Undecided',
        ],
      },
      {
        key: 'requiredAction',
        label: 'Required Action',
        type: 'multiselect',
        options: [
          'Psychometric assessment recommended',
          'Career exploration session',
          'University mapping',
          'Skill gap analysis',
          'Parent alignment session',
          'Internship exposure',
          'Career workshop suggested',
        ],
      },
    ],
  },
  {
    key: 'emotional',
    label: 'Emotional & Social Wellness',
    fields: [
      {
        key: 'emotionalState',
        label: 'Emotional State',
        type: 'select',
        options: [
          'Stable',
          'Mild stress',
          'Anxiety',
          'Low self-esteem',
          'Mood fluctuations',
          'Social withdrawal',
          'Peer conflict',
          'Bullying victim',
          'Bullying behavior',
          'Relationship concerns',
        ],
      },
      {
        key: 'socialFunctioning',
        label: 'Social Functioning',
        type: 'select',
        options: [
          'Healthy peer group',
          'Limited friendships',
          'Social isolation',
          'Conflict-prone',
          'Over-dependent on peers',
        ],
      },
      {
        key: 'supportStrategy',
        label: 'Support Strategy',
        type: 'multiselect',
        options: [
          'Emotional regulation techniques',
          'Confidence building exercises',
          'Peer mediation',
          'Parent discussion',
          'Monitoring required',
          'Group counseling suggested',
        ],
      },
    ],
  },
  {
    // American spelling in the key — a wire value, not copy.
    key: 'behavioral',
    label: 'Behavioural Counselling',
    fields: [
      {
        key: 'behaviorConcernType',
        label: 'Behavior Concern Type',
        type: 'select',
        options: [
          'Classroom disruption',
          'Aggressive behavior',
          'Defiance',
          'Excessive absenteeism',
          'Digital addiction',
          'Rule violation',
          'Attention-seeking behavior',
          'Lack of discipline',
          'Authority conflict',
        ],
      },
      {
        key: 'frequency',
        label: 'Frequency',
        type: 'select',
        options: ['Occasional', 'Repeated', 'Chronic'],
      },
      {
        key: 'intervention',
        label: 'Intervention',
        type: 'multiselect',
        options: [
          'Behavior contract created',
          'Teacher coordination',
          'Parent meeting',
          'Reinforcement strategy',
          'Monitoring',
          'Referral to specialist',
        ],
      },
    ],
  },
  {
    key: 'mentalHealth',
    label: 'Mental Health Support',
    fields: [
      {
        key: 'concernArea',
        label: 'Concern Area',
        type: 'select',
        options: [
          'Anxiety symptoms',
          'Depression indicators',
          'Panic episodes',
          'Sleep disturbance',
          'Appetite change',
          'Emotional numbness',
          'Self-harm ideation (Red Flag)',
          'Trauma response',
          'Grief reaction',
        ],
      },
      {
        key: 'severityLevel',
        label: 'Severity Level',
        type: 'select',
        options: ['Mild', 'Moderate', 'Severe', 'Critical (Immediate Escalation)'],
      },
      {
        key: 'actionTaken',
        label: 'Action Taken',
        type: 'multiselect',
        options: [
          'Counseling intervention',
          'Parent informed',
          'Referral to psychologist',
          'Referral to psychiatrist',
          'Emergency protocol activated',
          'Crisis monitoring',
        ],
      },
    ],
  },
  {
    key: 'specialEducation',
    label: 'Special Education Support',
    fields: [
      {
        key: 'identifiedConcern',
        label: 'Identified Concern',
        type: 'select',
        options: [
          'ADHD indicators',
          'Learning difficulty',
          'Dyslexia indicators',
          'Dyscalculia indicators',
          'Autism spectrum indicators',
          'Speech/language delay',
          'Processing difficulty',
        ],
      },
      {
        key: 'supportRequired',
        label: 'Support Required',
        type: 'multiselect',
        options: [
          'Academic accommodation',
          'Individualized support plan',
          'Shadow teacher recommended',
          'Psychometric testing',
          'External evaluation referral',
          'Parent guidance session',
        ],
      },
    ],
  },
  {
    key: 'crisis',
    label: 'Crisis Intervention',
    fields: [
      {
        key: 'crisisType',
        label: 'Crisis Type',
        type: 'select',
        options: [
          'Self-harm risk',
          'Suicide ideation',
          'Abuse disclosure',
          'Bullying (Severe)',
          'Panic breakdown',
          'Family crisis',
          'Violence threat',
          'Substance abuse suspicion',
        ],
      },
      {
        key: 'immediateRiskLevel',
        label: 'Immediate Risk Level',
        type: 'select',
        options: ['Monitor closely', 'High alert', 'Immediate danger'],
      },
      {
        key: 'actionTaken',
        label: 'Action Taken',
        type: 'multiselect',
        options: [
          'Parent notified immediately',
          'Principal informed',
          'External authority informed (if required)',
          'Medical referral',
          'Emergency services contacted',
          'Case documentation completed',
        ],
      },
    ],
  },
  {
    key: 'parent',
    label: 'Parent Counselling',
    fields: [
      {
        key: 'parentConcern',
        label: 'Parent Concern',
        type: 'multiselect',
        options: [
          'Academic performance',
          'Behaviour at home',
          'Screen time',
          'Peer group',
          'Emotional wellbeing',
          'Career choices',
          'Attendance',
          'Health',
        ],
      },
      {
        key: 'parentEngagement',
        label: 'Parent Engagement',
        type: 'select',
        options: ['High', 'Moderate', 'Low'],
      },
      {
        key: 'agreedAction',
        label: 'Agreed Action',
        type: 'multiselect',
        options: [
          'Daily study routine at home',
          'Reduce screen time',
          'Regular parent-teacher check-ins',
          'Counsellor follow-up',
          'Medical/psychological referral',
          'Encourage extracurricular participation',
        ],
      },
    ],
  },
];

/** Present on every session regardless of type — these are real DTO fields, not `formData`. */
export const COMMON_FIELDS = {
  sessionMode: {
    key: 'sessionMode',
    label: 'Session Mode',
    type: 'select',
    options: ['In-person', 'Online', 'Emergency session'],
  },
  caseStatus: {
    key: 'caseStatus',
    label: 'Case Status',
    type: 'select',
    options: ['Open', 'Ongoing', 'Monitoring', 'Closed'],
  },
  improvementScore: { key: 'improvementScore', label: 'Improvement Score', min: 1, max: 10 },
  counselorNotes: { key: 'counselorNotes', label: 'Counsellor Notes' },
  followUpDate: { key: 'followUpDate', label: 'Follow-up Date' },
};

const TEACHER_KEYS = ['academic', 'parent'];

export function counsellingTypesForRole(role = 'teacher') {
  if (role === 'teacher') return COUNSELLING_TYPES.filter((t) => TEACHER_KEYS.includes(t.key));
  return COUNSELLING_TYPES;
}

/** Blank answers for a type: multiselects start as arrays, selects as empty strings. */
export function emptyFormFor(type) {
  const form = {};
  (type?.fields || []).forEach((field) => {
    form[field.key] = field.type === 'multiselect' ? [] : '';
  });
  return form;
}

export const emptyCommon = () => ({
  sessionMode: '',
  caseStatus: '',
  improvementScore: 5,
  counselorNotes: '',
  followUpDate: null,
});

export const typeLabel = (key) =>
  COUNSELLING_TYPES.find((t) => t.key === key)?.label || key || 'Session';
