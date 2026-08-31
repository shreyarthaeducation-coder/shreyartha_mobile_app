/**
 * The My Workspace tiles.
 *
 * Labels and order mirror `frontendmain/src/student/platform/dashboard.js`'s `dashboardSections`,
 * and the images are the same files the web serves from `/images/` — already staged in
 * `assets/images/` here.
 *
 * TWO DEPARTURES FROM THE WEB'S EIGHT, both from the dashboard redesign:
 *   · **Student Profile is gone** — it is the footer's Profile tab now, so a tile for it would be a
 *     second door to a room the student is already standing next to.
 *   · **Practice Zone is added** — the workspace's own description names it, and it was previously
 *     reachable only by drilling into Academic IQ.
 *
 * Item shape mirrors constants/teacherMenu.js so the same two-line porting contract applies:
 *   { key, label, image, native? , path? }
 *     native — an in-app route; rendered as a native screen
 *     path   — a web path opened through app/student/feature.js (native header + WebView body)
 *
 * As each area is ported, flip one item from `path` to `native` — nothing else changes. Until
 * then the unported areas keep working through the WebView rather than disappearing.
 */

const STUDENT_BASE = '/student/platform';

export const STUDENT_MENU = [
  {
    key: 'academicIq',
    label: 'Academic IQ',
    image: require('../assets/images/academiciq.png'),
    native: '/student/academic-iq',
  },
  {
    // Practice Zone was reachable only by drilling into Academic IQ, even though the workspace's
    // own description names it. It is a top-level destination here as well; the Academic IQ hub
    // keeps its copy, so nothing is taken away.
    key: 'practiceZone',
    label: 'Practice Zone',
    image: require('../assets/images/academiciq.png'),
    native: '/student/practice-zone',
  },
  {
    key: 'psychometric',
    label: 'Psychometric Assessment',
    image: require('../assets/images/psychometric-assessment.png'),
    native: '/student/psychometric',
  },
  {
    key: 'subjectCareer',
    label: 'Subject & Career',
    image: require('../assets/images/subject-career.png'),
    native: '/student/subject-career',
  },
  {
    key: 'skillsEdge',
    label: 'Skill Edge',
    image: require('../assets/images/skill-edge.png'),
    native: '/student/skills-edge',
  },
  {
    key: 'languagePro',
    label: 'Language Pro',
    image: require('../assets/images/language-pro.png'),
    native: '/student/language-pro',
  },
  {
    key: 'coding',
    label: 'Coding',
    image: require('../assets/images/coding.png'),
    native: '/student/coding-pro',
  },
  {
    key: 'eventsInfo',
    label: 'Events & Info',
    image: require('../assets/images/events-info.png'),
    native: '/student/events',
  },
];

/**
 * The three controls the website floats over every `/student/platform/*` page
 * (`frontendmain/src/student/components/FloatingButtons/FloatingButtons.js`, mounted globally from
 * `App.js`'s `FloatingButtonsWrapper`).
 *
 * ── HOW THEY WENT MISSING ────────────────────────────────────────────────────
 * They were never ported and never deleted — they were ORPHANED. The web mounts them on any route
 * under `/student/platform`, and the app used to hit those routes through the WebView tiles. Once
 * every tile flipped from `path:` to `native:`, no route in the panel loads that path any more, so
 * the rail simply stopped existing on mobile.
 *
 * ── STATIC, NOT FLOATING ─────────────────────────────────────────────────────
 * On the desktop they are a hover-to-expand rail in the corner. On a phone a floating rail would
 * cover content on every screen and collide with the footer, so they are rows in My Workspace
 * instead — which is also where a student looking for their homework would go first.
 *
 * ── THESE ARE STUDENT ENDPOINTS ──────────────────────────────────────────────
 * `/api/students/resources/*` and `/api/students/personalised-resources` — NOT the teacher's
 * `/api/teacher/resources/*` or `/api/teacher/student-analytics/personalised-resources/*`. Both
 * families return the SAME DTO classes (`TeacherResourceResponse`, `PersonalisedResourceResponse`),
 * so a wrong path fails on authorization rather than on shape, which is the hardest kind to spot.
 * All three are FREE/SCHOOL/PREMIUM student roles only — college students get a 403.
 */
export const STUDENT_TEACHER_LINKS = [
  {
    key: 'teacherResources',
    label: "Teacher's Resources",
    description: 'Notes, videos and links your teacher shared for each topic.',
    icon: 'library-outline',
    native: '/student/teacher-resources?tab=resources',
  },
  {
    key: 'homework',
    label: 'Homework',
    description: 'What has been set for you, and where you turn it in.',
    icon: 'create-outline',
    native: '/student/teacher-resources?tab=homework',
  },
  {
    key: 'personalisedResources',
    // NAMED FOR THE TEACHER, NOT FOR THE ENDPOINT. This was "Personalised Resources", which is also
    // what the Academic IQ hub now calls its own card — and the two are different features whose
    // endpoints differ by one letter (`personali_s_ed` here, `personali_z_ed` there). Two entries
    // reading the same name in one panel is the confusion that made a working screen get reported
    // as broken once already. The label says who assigned it, which is the thing that actually
    // distinguishes them. The `key`, the route and the endpoint are all unchanged.
    label: 'Teacher-Assigned Resources',
    description: 'Material assigned to you personally, on the day it was set.',
    icon: 'locate-outline',
    native: '/student/personalised-resources',
  },
];

export { STUDENT_BASE };
