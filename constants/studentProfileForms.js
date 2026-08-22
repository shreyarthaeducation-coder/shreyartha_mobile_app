/**
 * The student profile tabs, as data.
 *
 * Ported from `frontendmain/src/student/platform/profile/*.js` — eight React components, ~3,700
 * lines, that are almost entirely label + input + select. Expressed as config here so one renderer
 * serves them all, the same way `HrTab`'s SECTIONS collapsed the staff HR form.
 *
 * FIELD KEYS ARE WIRE VALUES — they are the JSON property names the backend persists. A renamed
 * key is not an error, it is silently different data from what the website writes.
 *
 * Field shape: `{ key, label, type, options?, required?, placeholder?, dependsOn? }`
 *   text | number | textarea | select | multiselect | date
 *   `dependsOn: { key, equals }` hides the field until another answer matches — the web does this
 *   with a conditional render (e.g. the English certificate number only when a test was taken).
 *
 * THREE TABS ARE NOT HERE and are deliberately not config-driven, because they are not static
 * forms: `career` (its own endpoint and shape), `skillsedge` (a multiselect sourced from
 * /api/skillsedge/tree at runtime) and `survey` — the Student Reflection questionnaire, fetched
 * from /api/students/survey/questions. They are listed in PROFILE_TABS so the shell shows all
 * eight, and each renders its own component.
 */

const GENDERS = ['Male', 'Female', 'Non-Binary', 'Prefer not to say'];
const CLASSES = ['6', '7', '8', '9', '10', '11', '12'];
const SECTIONS = ['A', 'B', 'C', 'D', 'E'];
const STREAMS = ['Science', 'Commerce', 'Arts'];
const YES_NO = ['Yes', 'No'];

const opts = (list) => list.map((v) => ({ value: v, label: String(v) }));

/**
 * `form: null` means the tab renders its own component.
 *
 * NOT the web's tab order, despite what this comment used to claim — the web has six tabs and no
 * standalone reflection tab at all, because it renders the reflection questions inside its Personal
 * Details form. We keep it as its own tab: the reflection is a ONE-SHOT submit that locks
 * afterwards, and burying that at the bottom of a long form on a phone hides both the action and
 * the fact that it cannot be redone.
 *
 * `survey` is SECOND, directly after `personal`, at the request of the product owner ("student
 * reflection should come just after profile page"). The KEY stays `survey` — it maps to
 * /api/students/survey/* and to SurveyTab — while the LABEL matches the website, which renamed this
 * to "Student Reflection" some time ago (PersonalDetails.js). Do not rename the key, and do not
 * introduce a backend `StudentReflection` type: that name already belongs to the unrelated
 * Academic IQ per-topic reflection feature.
 */
export const PROFILE_TABS = [
  { key: 'personal', label: 'Personal', icon: 'person-outline' },
  { key: 'survey', label: 'Student Reflection', icon: 'clipboard-outline', custom: true },
  { key: 'academic', label: 'Academic IQ', icon: 'school-outline' },
  { key: 'education', label: 'Education', icon: 'library-outline' },
  { key: 'university', label: 'University', icon: 'business-outline', custom: true },
  { key: 'career', label: 'Career', icon: 'compass-outline', custom: true },
  { key: 'skillsedge', label: 'Skills', icon: 'construct-outline', custom: true },
  { key: 'additional', label: 'Additional', icon: 'document-text-outline' },
];

export const PROFILE_FORMS = {
  personal: {
    title: 'Personal Details',
    // `email` is shown but never sent — it is the login identity and the server ignores changes.
    readOnly: ['email'],
    fields: [
      { key: 'fullName', label: 'Full Name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'text' },
      { key: 'mobile', label: 'Mobile', type: 'text' },
      { key: 'dob', label: 'Date of Birth', type: 'date' },
      { key: 'gender', label: 'Gender', type: 'select', options: opts(GENDERS) },
      { key: 'currentClass', label: 'Current Class', type: 'select', options: opts(CLASSES) },
      { key: 'section', label: 'Section', type: 'select', options: opts(SECTIONS) },
      { key: 'stream', label: 'Stream', type: 'select', options: opts(STREAMS) },
      { key: 'curriculumName', label: 'Curriculum / Board', type: 'text' },
      { key: 'hobbies', label: 'Hobbies', type: 'textarea' },
      { key: 'strengths', label: 'Strengths', type: 'textarea' },
      { key: 'weakness', label: 'Areas to Improve', type: 'textarea' },
    ],
  },

  academic: {
    title: 'Academic IQ',
    fields: [
      {
        key: 'preparingCompetitiveExam',
        label: 'Preparing for a competitive exam?',
        type: 'select',
        options: opts(YES_NO),
      },
      {
        key: 'competitiveExamSelection',
        label: 'Which exam',
        type: 'text',
        dependsOn: { key: 'preparingCompetitiveExam', equals: 'Yes' },
        placeholder: 'JEE, NEET, CUET…',
      },
    ],
  },

  education: {
    title: 'Education Details',
    fields: [
      { key: 'class10School', label: 'Class 10 School', type: 'text', required: true },
      { key: 'class10Year', label: 'Year of Passing', type: 'number', required: true },
      { key: 'class10Percentage', label: 'Percentage', type: 'number', required: true },
      {
        key: 'englishTestTaken',
        label: 'English proficiency test taken?',
        type: 'select',
        options: opts(['None', 'IELTS', 'TOEFL', 'PTE', 'Duolingo']),
      },
      {
        key: 'englishCertificateNumber',
        label: 'Certificate Number',
        type: 'text',
        // The web only renders this once a test is chosen.
        dependsOn: { key: 'englishTestTaken', notEquals: 'None' },
      },
    ],
  },

  // `university` deliberately has NO entry here. It looks like a flat form and is not: its
  // location select switches which lookup feeds the region select, and the two university picks
  // come from a remote call keyed on the region *and* the college type. It lives in
  // components/student/profile/UniversityTab.js instead.
  //
  // An earlier version of this file did model it here, with `lookupCountry`/`lookupState` field
  // types — it was wrong in every field. `studyLocation` is "India" | "Abroad", not a country;
  // `collegeType` is Government/Private and India-only; and `universityPref1/2` were missing
  // entirely, which is the substance of the tab.

  additional: {
    title: 'Additional Details',
    fields: [
      { key: 'address', label: 'Address', type: 'textarea' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'state', label: 'State', type: 'text' },
      { key: 'citizen', label: 'Citizenship', type: 'text' },
      { key: 'aadhaarNumber', label: 'Aadhaar Number', type: 'text' },
      { key: 'hasPassport', label: 'Do you have a passport?', type: 'select', options: opts(YES_NO) },
      {
        key: 'passportDetails',
        label: 'Passport Details',
        type: 'text',
        dependsOn: { key: 'hasPassport', equals: 'Yes' },
      },
      { key: 'familyIncome', label: 'Annual Family Income', type: 'text' },
      {
        key: 'applyScholarship',
        label: 'Applying for a scholarship?',
        type: 'select',
        options: opts(YES_NO),
      },
      {
        key: 'scholarshipSupport',
        label: 'Support Required',
        type: 'textarea',
        dependsOn: { key: 'applyScholarship', equals: 'Yes' },
      },
      {
        key: 'scholarshipUtilisation',
        label: 'How would you use it?',
        type: 'textarea',
        dependsOn: { key: 'applyScholarship', equals: 'Yes' },
      },
      { key: 'ref1Name', label: 'Reference — Name', type: 'text' },
      { key: 'ref1Designation', label: 'Reference — Designation', type: 'text' },
      { key: 'ref1Email', label: 'Reference — Email', type: 'text' },
    ],
  },
};

/** Should a field render, given the current answers? */
export function fieldVisible(field, form) {
  const rule = field.dependsOn;
  if (!rule) return true;
  const value = form?.[rule.key];
  if (rule.equals !== undefined) return value === rule.equals;
  if (rule.notEquals !== undefined) return !!value && value !== rule.notEquals;
  return true;
}

/** Blank answers for a form, so controlled inputs never flip to uncontrolled. */
export function emptyForm(key) {
  const out = {};
  (PROFILE_FORMS[key]?.fields || []).forEach((f) => {
    out[f.key] = f.type === 'multiselect' ? [] : '';
  });
  return out;
}
