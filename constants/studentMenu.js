/**
 * The student dashboard tiles.
 *
 * Labels and order mirror `frontendmain/src/student/platform/dashboard.js`'s `dashboardSections`
 * verbatim, and the images are the same eight files the web serves from `/images/` — already
 * staged in `assets/images/` here. Labels are the English strings from
 * `src/i18n/locales/en/translation.json` → `dashboard.*`; the app is not translated yet, so they
 * are inlined rather than run through i18next.
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
    key: 'profile',
    label: 'Student Profile',
    image: require('../assets/images/student-profile.png'),
    native: '/student/profile',
  },
  {
    key: 'academicIq',
    label: 'Academic IQ',
    image: require('../assets/images/academiciq.png'),
    native: '/student/academic-iq',
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
 * The web header's actions (`components/Header/Header.js`, scoped by `.student-platform-theme`).
 * Log Out is handled separately because it needs the auth context, not a route.
 */
export const STUDENT_HEADER_ACTIONS = [
  { key: 'myAnalytics', label: 'My Analytics', icon: 'bar-chart-outline', native: '/student/analytics' },
  { key: 'counselor', label: 'Speak to Counselor', icon: 'chatbubbles-outline', native: '/student/counselor' },
  { key: 'changePassword', label: 'Change Password', icon: 'key-outline', native: '/student/change-password' },
];

export { STUDENT_BASE };
