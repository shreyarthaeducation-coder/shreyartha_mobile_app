/**
 * API namespaces for the Shreyartha teacher panel (Portal B, `SHREYARTHA_TEACHER`).
 *
 * The web builds this panel from `School/ShreyarthaTeacher/ShreyarthaTeacherDashboard.js`, which
 * imports six Portal-A pages unchanged and eight SHREYA01-specific variants from
 * `School/Teacher/pages/SHREYA01/`. This descriptor is the app's equivalent of that import list:
 * one native screen per feature, told which namespace it is serving.
 *
 * ── THE RULE ─────────────────────────────────────────────────────────────────
 * Portal A is Academic Year → Class → Section → Subject and **name-keyed**
 * (`className`, `sectionName`). Portal B is **School → Class** — no year, no section, no subject —
 * and **id-keyed** (`classId`, plus `schoolId` on writes). Send a name where an id belongs and the
 * server matches nothing and answers `200 []`, so the screen reads "no students" rather than
 * failing. An empty list is the symptom; there is no error to catch.
 *
 * ── FOUR `schools-classes` ENDPOINTS, NOT ONE ────────────────────────────────
 * Each feature namespace publishes its own, and they are NOT interchangeable — a teacher's
 * homework scope and attendance scope are populated from different assignment sources even though
 * the JSON shape is identical. `SchoolClassPicker` takes the endpoint as a prop precisely so one
 * picker can serve all of them; the mistake to avoid is collapsing them to a single constant
 * because "they look the same".
 */

/** Curriculum lives on the TEACHER namespace for BOTH portals — there is no shreya01 twin. */
const ACADEMIC_BASE = '/api/teacher/academic';

export const SHREYA01_TEACHER = {
  key: 'shreyartha_teacher',
  label: 'Shreyartha Teacher',

  /** SchoolClassPicker, not ScopePicker. See the rule above. */
  scope: 'schoolClass',

  attendance: {
    base: '/api/shreya01/attendance',
    schools: '/api/shreya01/attendance/schools-classes',
  },
  counselling: {
    base: '/api/shreya01/counselling',
    schools: '/api/shreya01/counselling/schools-classes',
  },
  homework: {
    base: '/api/shreya01/homework',
    schools: '/api/shreya01/homework/schools-classes',
  },
  groups: {
    base: '/api/shreya01/groups',
    schools: '/api/shreya01/schools',
  },
  syllabus: {
    base: '/api/shreya01/syllabuses',
    schools: '/api/shreya01/schools',
  },
  subjects: {
    base: '/api/shreya01/subjects',
    // Manage Subjects scopes off the HOMEWORK tree, not its own — the web does the same.
    schools: '/api/shreya01/homework/schools-classes',
  },

  /** Shared with the Portal-A teacher and both counsellor portals. */
  liveSessions: '/api/shreya01/live-sessions',
  liveSchools: '/api/shreya01/schools',

  /**
   * NOT A TYPO, and not the counsellor's path.
   *
   *   teacher (this portal)   /api/shreya01/counselling/counsellor-report   ← read-only VIEW
   *   Shreyartha counsellor   /api/shreya01/counsellor-report               ← authoring FORM
   *
   * The teacher reads reports the counsellor writes, so the two screens are different components
   * as well as different endpoints. `CounsellorReportScreen` vs `CounsellorReportFormScreen`.
   */
  counsellorReport: '/api/shreya01/counselling/counsellor-report',

  academic: ACADEMIC_BASE,
  topicCompletion: '/api/teacher/topic-completion',
  topicCompletions: '/api/teacher/topic-completions',
};

/** Portal B counselling offers the TEACHER type set (two), not the counsellor's eight. */
export const SHREYA01_TEACHER_COUNSELLING_ROLE = 'teacher';

export default SHREYA01_TEACHER;
