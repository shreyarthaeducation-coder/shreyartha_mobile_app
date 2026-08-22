// constants/profileRules.js
// The Student Profile's behavioural rules, as pure functions.
// Mirrors: frontendmain/src/student/platform/profile/{PersonalDetails,AcademicIQ,SkillsEdge}.js
//
// Extracted because these are the parts a checker can EVALUATE. Every one of them is a rule a
// student runs into, and every one is easy to get subtly backwards.

/* ── The post-save lock ────────────────────────────────────────────────────── */

/**
 * Fields the lock deliberately SPARES.
 *
 * Everything else on Personal Details freezes permanently after the first save. Contact details do
 * not, because a student who changes their phone number must still be reachable — that is the whole
 * reason the exception exists, so shrinking this list is a functional change, not a tidy-up.
 */
export const ALWAYS_EDITABLE = ['email', 'mobile'];

/**
 * Has Personal Details locked?
 *
 * The web arms this on mount from the SAVED record — `fullName && gender && dob && currentClass` —
 * not from a "hasSaved" flag, so it is already locked when a returning student opens the tab. It
 * also arms immediately after a successful save.
 *
 * Note it is these four fields specifically, not "all required fields": `strengths`, `weakness` and
 * `favSubjects` are required to SAVE but do not participate in deciding the lock.
 */
export function isPersonalLocked(saved) {
  return !!(saved?.fullName && saved?.gender && saved?.dob && saved?.currentClass);
}

/** True when this field stays editable under the lock. */
export const isFieldEditable = (key, locked) => !locked || ALWAYS_EDITABLE.includes(key);

/** The button's label. "Selection saved" is terminal — it never returns to "Save". */
export const personalSubmitLabel = (locked, saving) => {
  if (locked) return 'Selection saved';
  return saving ? 'Saving…' : 'Save';
};

/* ── Personal Details fields ───────────────────────────────────────────────── */

export const GENDERS = ['Male', 'Female', 'Non-Binary', 'Prefer not to say'];
export const SECTIONS = ['A', 'B', 'C', 'D', 'E'];
export const CLASSES = ['6', '7', '8', '9', '10', '11', '12'];
/** College students pick a year instead of a class. */
export const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
export const STREAMS = ['Science', 'Commerce', 'Arts'];

/** Favourite subjects depend on the chosen stream — verbatim from the web. */
export const STREAM_SUBJECTS = {
  Science: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'English'],
  Commerce: ['Economics', 'Business Studies', 'Accountancy', 'Mathematics', 'English'],
  Arts: ['History', 'Geography', 'Political Science', 'Economics', 'English'],
};

/** Max characters on the two reflection textareas. */
export const REFLECTION_MAX = 120;

/**
 * What must be filled before Personal Details can be saved.
 *
 * `stream` carries a `*` and an HTML `required` on the web but is NOT in its JS validation list —
 * reproduced faithfully, because adding it would block students the website lets through.
 * `favSubjects` is required only for school students; a college student has no stream to pick from.
 */
export const PERSONAL_REQUIRED = [
  'fullName',
  'email',
  'gender',
  'dob',
  'mobile',
  'currentClass',
  'strengths',
  'weakness',
];

export function missingPersonalFields(form, isCollege) {
  const missing = PERSONAL_REQUIRED.filter((k) => {
    const v = form?.[k];
    return v === null || v === undefined || String(v).trim() === '';
  });
  if (!isCollege && !(form?.favSubjects || []).length) missing.push('favSubjects');
  return missing;
}

/* ── Academic IQ ───────────────────────────────────────────────────────────── */

/**
 * The column stores **"YES" / "NO"**, uppercase.
 *
 * The mobile form sent `'Yes'` / `'No'`, so `preparingCompetitiveExam === "YES"` never matched
 * server-side and the whole exam block stayed off — which in turn meant a mobile-only student could
 * never choose a competitive exam, and Batch 1's exam gate could never unlock for them.
 */
export const PREPARING = { YES: 'YES', NO: 'NO' };

export const MAX_ENTRANCE_EXAMS = 2;
export const MAX_EDITS_PER_YEAR = 12;

/**
 * Can this entrance exam be ticked?
 *
 * Refused at the third tick, exactly as the web does — and refused again at submit, because a
 * checkbox list restored from a saved record can already hold more than the cap.
 */
export const canAddEntranceExam = (selected) =>
  (selected?.length || 0) < MAX_ENTRANCE_EXAMS;

/**
 * @returns {string|null} an error, or null when valid.
 *
 * The minimum is CONDITIONAL: at least one entrance exam is required only when the chosen
 * competitive exam actually has any. An exam with none must still be savable.
 */
export function validateEntranceExams(selectedIds, availableCount) {
  const n = selectedIds?.length || 0;
  if (n > MAX_ENTRANCE_EXAMS) return `Max ${MAX_ENTRANCE_EXAMS} entrance exams allowed`;
  if (availableCount > 0 && n === 0) return 'Select at least 1 entrance exam';
  return null;
}

/* ── Skills Edge ───────────────────────────────────────────────────────────── */

export const MAX_SKILLS = 2;
/** Two topics in total, however they are distributed across the chosen skills. */
export const MAX_TOPICS_TOTAL = 2;

export const canAddSkill = (selected) => (selected?.length || 0) < MAX_SKILLS;

/**
 * How many topics one skill may hold — 1 each when two skills are chosen, 2 when only one is.
 * Either way the TOTAL is capped at 2, which is why both checks exist.
 */
export const maxTopicsPerSkill = (skillCount) => (skillCount >= 2 ? 1 : 2);

/**
 * @param {object} selectedTopics keyed by skill NAME, holding topic IDS
 * @returns {string|null} an error, or null when the tick is allowed
 */
export function canAddTopic(selectedTopics, skillName, skillCount) {
  const forSkill = selectedTopics?.[skillName] || [];
  const perSkill = maxTopicsPerSkill(skillCount);
  if (forSkill.length >= perSkill) {
    return skillCount >= 2
      ? 'You can only select 1 topic per skill when 2 skills are chosen.'
      : `You can select a maximum of ${perSkill} topics for ${skillName}.`;
  }
  const total = Object.values(selectedTopics || {}).reduce((s, ids) => s + (ids?.length || 0), 0);
  if (total >= MAX_TOPICS_TOTAL) {
    return `You can select a maximum of ${MAX_TOPICS_TOTAL} topics in total.`;
  }
  return null;
}

export const ENGLISH_SKILLS = ['Listening', 'Speaking', 'Reading', 'Writing'];
export const RATING_LEVELS = ['Beginner', 'Average', 'Proficient'];

/**
 * The Skills Edge payload — ALL FOUR FIELDS, ALWAYS.
 *
 * ── THIS IS THE DATA-LOSS BUG ───────────────────────────────────────────────
 * The mobile save sent `{ importantSkills }` alone. `/api/skills/profile` replaces the record
 * rather than patching it, so every save silently wiped `selectedTopics`, `englishCommunication`
 * and `isRelatedToJob` — including values the student had set on the website. Nothing errored and
 * nothing on screen showed the loss.
 *
 * Building the body in one place, with every field explicit, is what stops a future caller
 * reintroducing it.
 */
export function skillsProfileBody({
  importantSkills = [],
  selectedTopics = {},
  englishCommunication = {},
  isRelatedToJob = null,
} = {}) {
  return { importantSkills, selectedTopics, englishCommunication, isRelatedToJob };
}
