/**
 * teacherChatbotData.js
 *
 * Verbatim port of frontendmain/src/School/Teacher/components/TeacherChatbot/teacherChatbotData.js.
 * Pure data — do not "improve" the copy here without changing the web too, or a teacher gets a
 * different answer on each platform.
 *
 * `sectionKey` values must match TeacherShreyaContextService on the backend exactly.
 *
 * `routeSuffix` is a SUFFIX. On the web the chatbot prefixes it with the portal base; here the
 * base is '/teacher' and **every suffix already matches a native route** — app/teacher/*.js was
 * named after the web paths, so `router.push('/teacher' + routeSuffix)` works with no mapping
 * table. `''` (portal-guide) lands on the menu grid, which is the right destination.
 *
 * `mainPortalOnly` hides a tile in the Shreyartha (Portal B) shell, which has no equivalent page.
 * Kept so the Portal B wiring costs nothing later.
 */

export const TEACHER_SECTIONS = [
  {
    label: 'My Classes & Students',
    sectionKey: 'my-classes',
    routeSuffix: '/student-analytics',
    overview:
      '**My Classes & Students** is your window into every section you teach and every student in them.',
    functionality:
      'Pick a class to see its roster, then pick a student for their syllabus progress, self-reflection and learning gaps.',
    services: [
      'Your class-section list',
      'Section rosters',
      'Per-student analytics & learning gaps',
    ],
  },
  {
    label: 'Attendance',
    sectionKey: 'attendance',
    routeSuffix: '/attendance',
    overview: "**Attendance** summarizes this month's attendance across your sections.",
    functionality:
      'See present rates per section and spot students with low attendance. Marking attendance itself happens on the Attendance page.',
    services: [
      'Current-month present rates',
      'Lowest-attendance students',
      'Link to the marking page',
    ],
  },
  {
    label: 'Homework & Resources',
    sectionKey: 'homework',
    routeSuffix: '/homework',
    overview:
      '**Homework & Resources** tracks what you have assigned and shared with your classes.',
    functionality:
      'Review recent homework and teaching resources, and drill into a homework to see who has submitted.',
    services: [
      'Recent homework & due dates',
      'Submission & review counts',
      'Recent teaching resources',
    ],
  },
  {
    label: 'Tests & Exams',
    sectionKey: 'reports',
    routeSuffix: '/reports',
    mainPortalOnly: true,
    overview:
      "**Tests & Exams** covers the exams you have created and your students' marks.",
    functionality:
      'Pick a subject assignment to see its exams, then pick a student for their test-by-test performance.',
    services: [
      'Exams per subject assignment',
      'Results-entered progress',
      'Per-student marks summaries',
    ],
  },
  {
    label: 'Syllabus Progress',
    sectionKey: 'syllabus',
    routeSuffix: '/syllabus',
    overview:
      '**Syllabus Progress** shows how far you have covered the curriculum in each subject you teach.',
    functionality:
      'See overall and per-subject completion, and drill into a subject for its chapter-by-chapter picture.',
    services: [
      'Overall completion percentage',
      'Per-subject completion',
      'Chapter-wise breakdown',
    ],
  },
  {
    label: 'Ability Groups',
    sectionKey: 'groups',
    routeSuffix: '/groups',
    overview:
      '**Ability Groups** shows how your students are grouped by understanding level in each subject.',
    functionality:
      'See group sizes per assignment and drill in for the student names at each level — useful for planning targeted teaching.',
    services: [
      'Group counts per subject',
      'Students at each level',
      'Targeted-teaching planning',
    ],
  },
  {
    label: 'Counselling & Reports',
    sectionKey: 'counselling',
    routeSuffix: '/counselling',
    overview:
      "**Counselling & Reports** brings together the counselling needs you have raised and the counsellor's assessments.",
    functionality:
      "Review your recent counselling sessions and open a student's counsellor report summary.",
    services: [
      'Your counselling sessions',
      'Counsellor report summaries',
      'When to involve the counsellor',
    ],
  },
  {
    label: 'Live Classes',
    sectionKey: 'live-classes',
    routeSuffix: '/live-classes',
    overview:
      '**Live Classes** lists the Google Meet sessions scheduled at your school.',
    functionality:
      'See what is coming up in the next two weeks; joining and managing sessions happens on the Live Classes page.',
    services: [
      'Upcoming sessions (14 days)',
      'Dates, times & status',
      'Meet links on the page',
    ],
  },
  {
    label: 'My Development',
    sectionKey: 'upskill',
    routeSuffix: '/upskill',
    overview:
      '**My Development** is your professional-development library from Teacher Skills Edge.',
    functionality:
      'Browse development chapters and their sub-skills, and ask Shreya what any of them covers.',
    services: [
      'Development chapters',
      'Sub-skills & learning objectives',
      'Content on the Upskill page',
    ],
  },
  {
    label: 'Using the Teacher Portal',
    sectionKey: 'portal-guide',
    routeSuffix: '',
    overview:
      '**Using the Teacher Portal** helps you find your way around every page of this dashboard.',
    functionality:
      'Ask where to find anything — attendance, homework, reports, analytics — and Shreya will point you to the right page.',
    services: [
      'What each page does',
      'Where to find student analytics',
      'Marking, grouping & reporting pages',
    ],
  },
];

/**
 * The static section explanation, shown when the AI is unavailable (`fallback: true`).
 * Uses the **bold** markers and newlines the chat renderer understands.
 */
export function buildSectionExplanation(section) {
  const serviceLines = section.services.map((s) => `✅ ${s}`).join('\n');

  return (
    `${section.overview}\n\n` +
    `**How to use it:**\n${section.functionality}\n\n` +
    `**What you'll find:**\n${serviceLines}`
  );
}

/** Portal A sees all ten; Portal B drops the `mainPortalOnly` tiles. */
export function sectionsForPortal(isShreya01 = false) {
  return TEACHER_SECTIONS.filter((s) => !s.mainPortalOnly || !isShreya01);
}
