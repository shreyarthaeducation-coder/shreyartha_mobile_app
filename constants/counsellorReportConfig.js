/**
 * The counsellor-report schema, ported verbatim from
 * `frontendmain/src/School/shared/counsellorReportConfig.js`.
 *
 * Pure data — the renderer walks it. Keep it byte-identical to the web's so a report reads the
 * same on both platforms; if the web adds a field, mirror it here rather than inventing one.
 *
 * Field types: `rating` (0–5) · `text` · `textarea` · `boolean` (tri-state, null = unanswered) ·
 * `multiselect` (with optional `allowOther` + `otherKey`). `hideLabel` suppresses the label where
 * the section title already says it.
 */

export const RATING_SCALE = 5;

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
      { key: 'selfConfidence', label: 'Self Confidence', type: 'rating' },
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
      { key: 'leadershipParticipation', label: 'Leadership & Participation', type: 'rating' },
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
  {
    key: 'strengths',
    title: 'Strengths',
    fields: [{ key: 'strengths', label: 'Strengths', type: 'multiselect', hideLabel: true }],
  },
  {
    key: 'improvement',
    title: 'Areas Needing Improvement',
    fields: [
      { key: 'improvementAreas', label: 'Areas Needing Improvement', type: 'multiselect', hideLabel: true },
    ],
  },
  {
    key: 'recommendations',
    title: 'Counsellor Recommendations',
    fields: [
      { key: 'recommendations', label: 'Recommendations', type: 'multiselect', hideLabel: true },
    ],
  },
  {
    key: 'remarks',
    title: 'Counsellor Remarks',
    fields: [
      { key: 'counsellorRemarks', label: 'Counsellor Remarks', type: 'textarea', hideLabel: true },
    ],
  },
];

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
export const EXTRACTED_KEYS = [
  'overallPerformance',
  'learningGaps',
  'careerClarity',
  'counsellorRemarks',
];

/** A blank form with every field present, so controlled inputs never flip to uncontrolled. */
export function buildEmptyForm() {
  const form = {};
  REPORT_SECTIONS.forEach((section) => {
    section.fields.forEach((field) => {
      if (field.type === 'multiselect') {
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

/** Merges a saved formData blob over a blank form, dropping any keys no longer in the schema. */
export function hydrateForm(saved) {
  const form = buildEmptyForm();
  if (!saved) return form;
  Object.keys(form).forEach((key) => {
    if (saved[key] !== undefined && saved[key] !== null) {
      form[key] = saved[key];
    }
  });
  return form;
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
