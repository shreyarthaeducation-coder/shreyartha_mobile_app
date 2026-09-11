/**
 * The counsellor-report schema, ported from
 * `frontendmain/src/School/shared/counsellorReportConfig.js`.
 *
 * Pure data — the renderer walks it. Keep it in step with the web's so a report reads the same on
 * both platforms; if the web adds a field, mirror it here rather than inventing one.
 * `scripts/checkreportconfig.mjs` compares the two and fails on drift, which is how the three
 * missing `options` arrays below were finally caught.
 *
 * Field types: `rating` (0–5) · `text` · `textarea` · `boolean` (tri-state, null = unanswered) ·
 * `multiselect` (with optional `allowOther` + `otherKey`) · `select` (a fixed option list, with
 * optional `optionLabels`). `hideLabel` suppresses the label where the section title already
 * says it.
 *
 * ── ELEVEN SECTIONS, TWO TABLES ─────────────────────────────────────────────
 * Section 11 ("Griffin") is the four AI-written narrative columns of the printed counselling
 * sheet. To the counsellor it is the last section of one form. Underneath it is a row of
 * `counselling_activity_reports`, NOT part of `counsellor_reports.form_data`, because that table
 * has a nullable student (walk-ins) and a DRAFT/PUBLISHED gate that keeps an unreviewed AI draft
 * about a child away from their parent.
 *
 * **`splitForm()` is therefore not optional.** Sending the whole form as `formData` would write
 * the six Griffin keys into the wrong table, bypass the gate entirely, and make an unpublished
 * draft parent-visible on mobile while leaving the real narrative row untouched.
 *
 * ── WHERE THIS IS USED, AND BY WHICH SCREEN ─────────────────────────────────
 * Two callers, and they are not equivalent:
 *
 *   · `components/staff/counsellor/CounsellorReportScreen` — the report tab. EDITS an existing
 *     narrative and never drafts one; there is no recorder on that screen.
 *   · `components/staff/f2f/LiveSessionTab` — the Face-to-Face room, added with the mobile F2F
 *     port. It records a turn, uploads it, reads back the labelled transcript and asks the model to
 *     draft all four Griffin fields, exactly as the web room does.
 *
 * This header used to say mobile could never generate the narrative. That was true only until the
 * room existed; `splitForm` is now on the write path of a screen that produces AI text about a
 * named child, which is what makes the DRAFT/PUBLISHED gate above load-bearing rather than
 * theoretical.
 */

export const RATING_SCALE = 5;

/** The section whose fields live on the activity-report row rather than in form_data. */
export const GRIFFIN_SECTION_KEY = 'griffin';

export const REPORT_SECTIONS = [
  {
    key: 'academic',
    title: 'Academic Performance',
    fields: [
      { key: 'overallPerformance', label: 'Overall Performance', type: 'rating' },
      { key: 'strongSubjects', label: 'Strong Subjects', type: 'text' },
      { key: 'weakSubjects', label: 'Weak Subjects', type: 'text' },
      { key: 'learningGaps', label: 'Learning Gaps', type: 'boolean' },
    ],
  },
  {
    key: 'studyHabits',
    title: 'Learning & Study Habits',
    fields: [
      { key: 'concentration', label: 'Concentration', type: 'rating' },
      { key: 'studyDiscipline', label: 'Study Discipline', type: 'rating' },
      { key: 'timeManagement', label: 'Time Management', type: 'rating' },
      { key: 'homeworkCompletion', label: 'Homework Completion', type: 'rating' },
    ],
  },
  {
    key: 'emotional',
    title: 'Emotional Wellbeing',
    fields: [
      { key: 'stressLevel', label: 'Stress Level', type: 'rating' },
      { key: 'selfConfidence', label: 'Self-Confidence', type: 'rating' },
      { key: 'motivation', label: 'Motivation', type: 'rating' },
      { key: 'emotionalStability', label: 'Emotional Stability', type: 'rating' },
    ],
  },
  {
    key: 'behaviour',
    title: 'Behaviour & Social Skills',
    fields: [
      { key: 'communication', label: 'Communication', type: 'rating' },
      { key: 'classroomBehaviour', label: 'Classroom Behaviour', type: 'rating' },
      { key: 'peerRelationships', label: 'Peer Relationships', type: 'rating' },
      { key: 'leadershipParticipation', label: 'Leadership/Participation', type: 'rating' },
    ],
  },
  {
    key: 'career',
    title: 'Career & Interests',
    fields: [
      { key: 'careerClarity', label: 'Career Clarity', type: 'rating' },
      {
        key: 'interestAreas',
        label: 'Interest Area',
        type: 'multiselect',
        options: ['STEM', 'Commerce', 'Humanities', 'Arts & Design', 'Sports', 'Entrepreneurship'],
        allowOther: true,
        otherKey: 'interestAreaOther',
      },
    ],
  },
  {
    key: 'family',
    title: 'Family & Support',
    fields: [
      { key: 'parentSupport', label: 'Parent Support', type: 'rating' },
      { key: 'homeLearningEnvironment', label: 'Home Learning Environment', type: 'rating' },
    ],
  },
  // The `options` on these three were MISSING for months. `Chips` defaults to `options = []`, so
  // all three sections rendered as a bare heading with nothing under them and a mobile counsellor
  // could not fill in Strengths, Areas Needing Improvement or Recommendations at all. Copied from
  // the web, which had them all along — the drift went unnoticed because nothing compared the two
  // files. scripts/checkreportconfig.mjs does now.
  {
    key: 'strengths',
    title: 'Strengths',
    fields: [
      {
        key: 'strengths',
        label: 'Strengths',
        type: 'multiselect',
        hideLabel: true,
        options: [
          'Critical Thinking',
          'Creativity',
          'Problem Solving',
          'Communication',
          'Leadership',
          'Teamwork',
          'Adaptability',
          'Decision Making',
          'Emotional Intelligence',
          'Responsibility',
        ],
      },
    ],
  },
  {
    key: 'improvement',
    title: 'Areas Needing Improvement',
    fields: [
      {
        key: 'improvementAreas',
        label: 'Areas Needing Improvement',
        type: 'multiselect',
        hideLabel: true,
        options: [
          'Academic Performance',
          'Concentration',
          'Time Management',
          'Exam Anxiety',
          'Confidence',
          'Communication',
          'Behaviour',
          'Career Awareness',
          'Emotional Wellbeing',
          'Goal Setting',
        ],
      },
    ],
  },
  {
    key: 'recommendations',
    title: 'Counsellor Recommendations',
    fields: [
      {
        key: 'recommendations',
        label: 'Counsellor Recommendations',
        type: 'multiselect',
        hideLabel: true,
        options: [
          'Academic Support',
          'Study Plan',
          'Time Management',
          'Career Guidance',
          'Stream Selection',
          'Parent Counselling',
          'Emotional Support',
          'Skill Development',
          'Competitive Exam Guidance',
          'Follow-up Session',
        ],
      },
    ],
  },
  {
    key: 'remarks',
    title: 'Counsellor Remarks',
    fields: [
      {
        key: 'counsellorRemarks',
        label: 'Counsellor Remarks',
        type: 'textarea',
        hideLabel: true,
        placeholder: 'Overall observations, context, and next steps…',
      },
    ],
  },
  {
    key: GRIFFIN_SECTION_KEY,
    title: 'Griffin — AI narrative',
    subtitle:
      'Written by the AI on the website, from the session recording or the counsellor’s notes. '
      + 'You can edit it here, but it can only be generated and published on the web.',
    // Read and written through the linked activity-report row, NOT counsellor_reports.form_data.
    storage: 'activity',
    aiFilled: true,
    fields: [
      {
        key: 'cognitivePotential',
        label: 'Cognitive: Potential for Improvement',
        type: 'textarea',
        aiFilled: true,
      },
      { key: 'thinking', label: 'Thinking', type: 'textarea', aiFilled: true },
      {
        key: 'counsellorObservation',
        label: 'Counsellor Observation',
        type: 'textarea',
        aiFilled: true,
      },
      { key: 'recommendation', label: 'Recommendation', type: 'textarea', aiFilled: true },
      {
        key: 'psychometricAssessment',
        label: 'Psychometric Assesment',
        type: 'select',
        options: ['Yes', 'No'],
      },
      {
        key: 'pronoun',
        label: 'Pronouns to use in the narrative',
        type: 'select',
        options: ['they', 'she', 'he'],
        optionLabels: { they: 'they / them', she: 'she / her', he: 'he / him' },
      },
    ],
  },
];

/** The eleventh section, resolved once so callers do not re-scan the array. */
export const GRIFFIN_SECTION =
  REPORT_SECTIONS.find((s) => s.key === GRIFFIN_SECTION_KEY) || null;

/** The ten sections stored in `counsellor_reports.form_data`. */
export const FORM_DATA_SECTIONS = REPORT_SECTIONS.filter((s) => s.storage !== 'activity');

/** Field keys that belong to the activity-report row rather than to form_data. */
export const GRIFFIN_KEYS = (GRIFFIN_SECTION?.fields || []).map((f) => f.key);

/**
 * Which sections get a chart, and which shape.
 *
 * `emotional` is a **polar area** on the web. Rather than build a fifth chart primitive for one
 * chart of four values, it renders as a radar here — the same four axes, read the same way. Noted
 * rather than glossed over.
 */
export const SECTION_CHARTS = {
  studyHabits: 'radar',
  emotional: 'radar',
  behaviour: 'bars',
  family: 'gauge',
};

/** Every section key that carries a chart. */
export const CHART_SECTION_KEYS = Object.keys(SECTION_CHARTS);

/** Rating fields of a section as `{ label, value }`, for the charts. */
export function sectionRatings(section, form) {
  return section.fields
    .filter((field) => field.type === 'rating')
    .map((field) => ({
      key: field.key,
      label: field.label,
      value: Number(form?.[field.key]) || 0,
    }));
}

/**
 * Parse the report's `formData`, which arrives as a **JSON string** — the same asymmetry as
 * counselling sessions (object in, string out).
 *
 * The four scalars `overallPerformance`, `careerClarity`, `learningGaps` and `counsellorRemarks`
 * also exist as nullable top-level columns on the response. The web reads only `formData`, so we
 * do too; reading the columns instead would make the two platforms disagree if a writer diverges.
 */
export function parseReportForm(report) {
  if (!report?.formData) return {};
  try {
    const parsed = JSON.parse(report.formData);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/* ── Authoring (the counsellor panels) ──────────────────────────────────────
   The teacher's read-only view needs none of this; the counsellor writes reports. */

/**
 * The four scalars the request duplicates at the top level.
 *
 * They are genuine nullable columns on `CounsellorReport` **as well as** members of the JSON blob.
 * That duplication is intentional on the web and correct — unlike the counselling-session bug —
 * so the save sends both. Do not "clean it up".
 */
/**
 * The ten columns of the PRINTED counselling sheet, verbatim from the web's
 * `F2F/activityReportConfig.js`.
 *
 * These are the columns of `Griffins.pdf` — the physical document this whole feature produces —
 * and they are NOT the same thing as `REPORT_SECTIONS`. The sections are what a counsellor fills
 * in; these ten are what gets printed and exported, four of them being the AI-written narratives.
 * Labels are the sheet's own, misspelling included ("Psychometric Assesment"): it is a column
 * heading on a real document, not prose.
 */
export const SHEET_COLUMNS = [
  { key: 'serial', label: 'S.L' },
  { key: 'studentName', label: 'Students Name' },
  { key: 'schoolName', label: 'Name of the school' },
  { key: 'grade', label: 'Grade' },
  { key: 'counsellingDate', label: 'Date of counselling' },
  { key: 'cognitivePotential', label: 'Cognitive: Potential for Improvement' },
  { key: 'thinking', label: 'Thinking' },
  { key: 'counsellorObservation', label: 'Counsellor Observation' },
  { key: 'recommendation', label: 'Recommendation' },
  { key: 'psychometricAssessment', label: 'Psychometric Assesment' },
];

export const EXTRACTED_KEYS = [
  'overallPerformance',
  'learningGaps',
  'careerClarity',
  'counsellorRemarks',
];

/**
 * Defaults for the two Griffin fields that are not free text. Kept out of the generic type-switch
 * below because `''` is a wrong answer for both: a blank pronoun would make the AI guess, and a
 * blank psychometric flag would print as an empty cell on the sheet.
 */
const GRIFFIN_DEFAULTS = {
  psychometricAssessment: 'No',
  pronoun: 'they',
};

/** A blank form with every field present, so controlled inputs never flip to uncontrolled. */
export function buildEmptyForm() {
  const form = {};
  REPORT_SECTIONS.forEach((section) => {
    section.fields.forEach((field) => {
      if (GRIFFIN_DEFAULTS[field.key] !== undefined) {
        form[field.key] = GRIFFIN_DEFAULTS[field.key];
      } else if (field.type === 'multiselect') {
        form[field.key] = [];
        if (field.allowOther) form[field.otherKey] = '';
      } else if (field.type === 'rating') {
        form[field.key] = 0;
      } else if (field.type === 'boolean') {
        form[field.key] = null;
      } else {
        form[field.key] = '';
      }
    });
  });
  return form;
}

/**
 * Merges what was saved over a blank form, dropping any keys no longer in the schema.
 *
 * @param saved    `counsellor_reports.form_data` — the ten sections
 * @param activity the linked activity-report row, if any — the Griffin section
 *
 * The two arrive from different tables and are merged into one object here, because that is the
 * point of the merge: from the form's side there is one report.
 */
export function hydrateForm(saved, activity) {
  const form = buildEmptyForm();
  const merge = (source) => {
    if (!source) return;
    Object.keys(form).forEach((key) => {
      if (source[key] !== undefined && source[key] !== null) {
        form[key] = source[key];
      }
    });
  };
  merge(saved);
  merge(activity);
  return form;
}

/**
 * Splits one edited form back into the two payloads that are actually persisted.
 *
 * Returns `{ formData, griffin }` — the ten sections for `counsellor_reports.form_data`, and the
 * Griffin fields for the activity-report row. Nothing else in the app needs to know which field
 * lives where, which is what keeps the split from leaking into every screen.
 */
export function splitForm(form) {
  const griffinKeys = new Set(GRIFFIN_KEYS);
  const formData = {};
  const griffin = {};
  Object.keys(form || {}).forEach((key) => {
    if (griffinKeys.has(key)) {
      griffin[key] = form[key];
    } else {
      formData[key] = form[key];
    }
  });
  return { formData, griffin };
}

/** True when the AI has written nothing into the Griffin section yet. */
export function isGriffinEmpty(form) {
  return (GRIFFIN_SECTION?.fields || [])
    .filter((f) => f.aiFilled)
    .every((f) => !String(form?.[f.key] || '').trim());
}

/** Human-readable value for the read-only views. Mirrors the web's `formatFieldValue`. */
export function formatFieldValue(field, value) {
  if (value === null || value === undefined || value === '') return '—';
  if (field.type === 'rating') {
    return value > 0
      ? `${'★'.repeat(value)}${'☆'.repeat(RATING_SCALE - value)} (${value}/${RATING_SCALE})`
      : '—';
  }
  if (field.type === 'boolean') return value ? 'Yes' : 'No';
  if (field.type === 'multiselect') {
    return Array.isArray(value) && value.length ? value.join(', ') : '—';
  }
  if (field.type === 'select' && field.optionLabels) {
    return field.optionLabels[value] || value;
  }
  return value;
}

/** Pulls the four extracted scalars out of the form for the request body. */
export function extractScalars(form) {
  return {
    overallPerformance: form.overallPerformance || null,
    learningGaps: form.learningGaps === null ? null : Boolean(form.learningGaps),
    careerClarity: form.careerClarity || null,
    counsellorRemarks: form.counsellorRemarks || null,
  };
}
