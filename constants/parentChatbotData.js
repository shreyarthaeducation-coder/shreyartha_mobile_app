/**
 * parentChatbotData.js
 *
 * Verbatim port of frontendmain/src/Parent/platform/components/ParentChatbot/parentChatbotData.js.
 * Pure data — do not "improve" the copy here without changing the web too, or a parent gets a
 * different answer on each platform. Extracted by script and verified back, not retyped.
 *
 * `sectionKey` values must match ParentShreyaContextService on the backend EXACTLY. They are what
 * the server grounds each reply in; a renamed key does not error, it silently returns a generic
 * answer about the wrong thing.
 *
 * `routeSuffix` replaces the web's absolute `route`. The web stores
 * `/parent/platform/dashboard/...`; here the base is '/parent' and every suffix already matches a
 * native route, so `router.push('/parent' + routeSuffix)` needs no mapping table. `''` lands on the
 * menu grid, which is the right destination for the two sections that point at the dashboard root.
 *
 * Three sections deliberately share `/academic-progress` and two share `/assessment-results` — the
 * web does the same. They are different conversations about one screen, not a mistake.
 */

export const PARENT_SECTIONS = [
  {
    label: "Overall Summary",
    sectionKey: "child-overview",
    routeSuffix: "",
    overview:
      "The **Overall Summary** gives you a bird's-eye view of your child's journey on The 3C Edge.",
    functionality:
      "See your child's profile, overall syllabus completion, self-reflection progress and learning gaps in one place.",
    services: [
      "Child profile at a glance",
      "Overall syllabus completion",
      "Self-reflection progress",
      "Learning gaps summary",
    ],
  },
  {
    label: "Academic Progress",
    sectionKey: "academic-iq",
    routeSuffix: "/academic-progress",
    overview:
      "**Academic Progress** shows how your child is moving through their school syllabus, subject by subject.",
    functionality:
      "Track completion per subject and chapter, and see where learning gaps are appearing so you know where support helps most.",
    services: [
      "Subject-wise syllabus completion",
      "Chapter-level progress",
      "Learning gaps by understanding level",
      "Self-reflection based progress",
    ],
  },
  {
    label: "Test & Exam Performance",
    sectionKey: "competitive-exams",
    routeSuffix: "/academic-progress",
    overview:
      "**Test & Exam Performance** covers your child's competitive exam preparation and mock test results.",
    functionality:
      "Review which entrance exams your child is preparing for and how their mock test scores are trending.",
    services: [
      "Entrance exam preparation status",
      "Mock test performance",
      "Exam-wise analytics",
    ],
  },
  {
    label: "Psychometric & Career",
    sectionKey: "psychometric",
    routeSuffix: "/assessment-results",
    overview:
      "**Psychometric & Career** shows your child's progress through the scientifically designed career assessments.",
    functionality:
      "See which assessments your child has completed and understand what each one measures about their personality, interests and aptitude.",
    services: [
      "Personality Assessment progress",
      "Learning Style & Interest tests",
      "Stream Aptitude progress",
      "What each assessment means",
    ],
  },
  {
    label: "Career Interests",
    sectionKey: "subject-career",
    routeSuffix: "/assessment-results",
    overview:
      "**Career Interests** covers the subjects and career paths your child has been exploring.",
    functionality:
      "See your child's chosen career preferences and what those paths involve — courses, eligibility and future options.",
    services: [
      "Chosen career preferences",
      "Explored subjects & courses",
      "What each career path involves",
    ],
  },
  {
    label: "Skills Development",
    sectionKey: "skills-edge",
    routeSuffix: "/academic-progress",
    overview:
      "**Skills Development** tracks the future-ready skills your child is building beyond the classroom.",
    functionality:
      "See the skills your child has chosen to focus on and their progress through digital, AI and life-skills programs.",
    services: [
      "Chosen focus skills",
      "Digital & AI skills progress",
      "Life skills & soft skills",
    ],
  },
  {
    label: "Counselling & Wellbeing",
    sectionKey: "counselling",
    routeSuffix: "/counsellor-report",
    overview:
      "**Counselling & Wellbeing** brings together the school counsellor's notes and reports about your child.",
    functionality:
      "Review counselling session notes and the comprehensive counsellor report, and know when to reach out to the counsellor.",
    services: [
      "Counselling session notes",
      "Comprehensive counsellor report",
      "Guidance on supporting wellbeing",
    ],
  },
  {
    label: "Attendance",
    sectionKey: "attendance",
    routeSuffix: "/attendance",
    overview:
      "**Attendance** shows your child's school attendance as recorded on the platform.",
    functionality:
      "See a recent attendance summary here, or open the full month-by-month calendar on the Attendance page.",
    services: [
      "Recent attendance summary",
      "Absent dates",
      "Month-by-month calendar",
    ],
  },
  {
    label: "School Fees",
    sectionKey: "fees",
    routeSuffix: "/fees",
    overview:
      "**School Fees** keeps you on top of fee payments for the current academic year.",
    functionality:
      "Check what is paid, what is remaining and the next due date. Payments themselves are made on the School Fees page.",
    services: [
      "Fee status for the academic year",
      "Next installment & due date",
      "Payment history on the Fees page",
    ],
  },
  {
    label: "How to Help at Home",
    sectionKey: "support-at-home",
    routeSuffix: "/academic-progress",
    overview:
      "**How to Help at Home** turns your child's learning data into practical, everyday support ideas.",
    functionality:
      "Get suggestions grounded in your child's actual learning gaps — study routines, environment and encouragement that make a difference.",
    services: [
      "Suggestions grounded in real gaps",
      "Study routine & environment tips",
      "Encouragement that works",
    ],
  },
  {
    label: "Using the Parent Portal",
    sectionKey: "portal-guide",
    routeSuffix: "",
    overview:
      "**Using the Parent Portal** helps you find your way around every page of this dashboard.",
    functionality:
      "Ask where to find anything — reports, attendance, fees, resources — and Shreya will point you to the right page.",
    services: [
      "What each page shows",
      "Where to find reports & results",
      "Fees, attendance & schedule pages",
    ],
  },
]

/**
 * The offline fallback text for one section.
 *
 * Used when `/section-summary` answers with `fallback: true` — the AI provider failed but the
 * response is still a 200 carrying the sub-tiles, so the conversation continues with this static
 * text in place of the generated summary. Mirrors the web's `buildSectionExplanation`.
 */
export function buildParentSectionExplanation(section) {
  if (!section) return '';
  const services = (section.services || [])
    .map((s) => `✅ ${s}`)
    .join('\n');
  return [
    section.overview,
    `**How to use it:**\n${section.functionality}`,
    `**What you'll find:**\n${services}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * ── THE ChapterLink TRAP ─────────────────────────────────────────────────────
 * `routeSuffix` above covers the SECTION tiles. The backend can also attach a `ChapterLink` to a
 * reply, and its `route` is not the same shape across portals:
 *   teacher — TeacherShreyaContextService emits a bare suffix, so basePath + route is the route.
 *   parent  — ParentShreyaContextService emits a full WEB path, PARENT_DASHBOARD_ROUTE + pagePath.
 * Prefixing the parent's with basePath gives /parent/parent/platform/dashboard/attendance, which
 * throws nothing and navigates nowhere. So the sheet asks the portal to convert it.
 *
 * Lives beside the data rather than in parentChatbotConfig.js because it is a pure function over
 * these same routes, and because that keeps it importable by scripts/checkparent.mjs — the config
 * pulls in AsyncStorage and the HTTP client, neither of which loads outside Metro.
 */
export const WEB_DASHBOARD_PREFIX = '/parent/platform/dashboard';

/** @returns {string|null} the suffix to append to '/parent', or null if this app cannot open it. */
export function resolveParentLink(route) {
  if (typeof route !== 'string') return null;
  if (!route.startsWith(WEB_DASHBOARD_PREFIX)) return null;
  return route.slice(WEB_DASHBOARD_PREFIX.length);
}
