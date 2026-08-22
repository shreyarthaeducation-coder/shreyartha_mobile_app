/**
 * constants/studentChatbotData.js
 *
 * The 9 student-panel sections Shreya can talk about, EXTRACTED BY SCRIPT from
 * frontendmain/src/student/components/StudentChatbot/studentChatbotData.js and verified back
 * string for string — never retyped.
 *
 * `sectionKey` values must match ShreyaContextService on the backend EXACTLY. They are what the
 * server grounds each reply in; a renamed key does not error, it silently answers about the
 * wrong thing.
 *
 * `routeSuffix` replaces the web's absolute `route`, and unlike the parent's it is NOT a prefix
 * strip: the website says "academiciq", "skillsedge", "coding" and "events-info" where this app
 * says "academic-iq", "skills-edge", "coding-pro" and "events". The mapping is an explicit table
 * in the extractor and every target is checked to exist.
 */

export const STUDENT_SECTIONS = [
  {
    "label": "Student Profile",
    "sectionKey": "student-profile",
    "routeSuffix": "/profile",
    "overview": "Your **Student Profile** is the central hub for all your personal and academic information.",
    "functionality": "Here you can view and update your details so the platform personalizes your experience. Keep your profile complete to unlock all features.",
    "services": [
      "Personal & academic information",
      "School details and contact info",
      "Profile photo upload",
      "Achievements & badges showcase",
      "Password change"
    ]
  },
  {
    "label": "Academic IQ",
    "sectionKey": "academic-iq",
    "routeSuffix": "/academic-iq",
    "overview": "**Academic IQ** is your subject-wise learning hub, designed to sharpen your academic skills.",
    "functionality": "Access curated resources aligned to your school curriculum, practise with topic-wise exercises, and dive into competitive exam preparation — all in one place.",
    "services": [
      "Personalized Resources",
      "School Resources",
      "Practice Zone",
      "Competitive Exam Prep access"
    ]
  },
  {
    "label": "Competitive Exams",
    "sectionKey": "competitive-exams",
    "routeSuffix": "/competitive-exam",
    "overview": "**Competitive Exams** gives you a dedicated space to prepare for national and state-level entrance exams.",
    "functionality": "Work through mock tests, study material, and track your performance to stay exam-ready every day.",
    "services": [
      "Mock Tests",
      "Study Material & Notes",
      "Performance Tracking & Analytics",
      "Exam-specific topic coverage"
    ]
  },
  {
    "label": "Psychometric Assessment",
    "sectionKey": "psychometric",
    "routeSuffix": "/psychometric",
    "overview": "**Psychometric Assessment** helps you discover your unique personality, strengths, and ideal career path.",
    "functionality": "Take scientifically designed tests and receive a detailed report with stream and career recommendations tailored to you.",
    "services": [
      "Personality Assessment",
      "Learning Style Test",
      "Interest Inventory",
      "Stream Aptitude Test",
      "ESDI Assessment",
      "Detailed Report with Career Recommendations"
    ]
  },
  {
    "label": "Subject & Career",
    "sectionKey": "subject-career",
    "routeSuffix": "/subject-career",
    "overview": "**Subject & Career** is your comprehensive guide to exploring academic subjects and future career options.",
    "functionality": "Get detailed information on courses, eligibility criteria, top colleges in India and abroad, and future job prospects — then test your fit with the Skill Match Meter.",
    "services": [
      "Course & Subject Exploration",
      "Eligibility Criteria",
      "Future Job Options",
      "Top Colleges – India & Abroad",
      "Skill Match Meter Quiz",
      "Videos & Learning Resources"
    ]
  },
  {
    "label": "Skills Edge",
    "sectionKey": "skills-edge",
    "routeSuffix": "/skills-edge",
    "overview": "**Skills Edge** equips you with future-ready skills that go beyond the classroom.",
    "functionality": "Access structured programs covering digital literacy, AI fundamentals, life skills and more, with curated content and hands-on activities.",
    "services": [
      "Digital Skills Programs",
      "AI & Technology Modules",
      "Life Skills & Soft Skills",
      "Curated Content & Activities"
    ]
  },
  {
    "label": "Language Pro",
    "sectionKey": "language-pro",
    "routeSuffix": "/language-pro",
    "overview": "**Language Pro** builds your English and foreign language proficiency with structured learning tracks.",
    "functionality": "Choose between Personalized Resources tailored to your level or School Resources aligned to your curriculum.",
    "services": [
      "English Language Learning",
      "Foreign Language Courses",
      "Personalized Resources Track",
      "School Resources Track"
    ]
  },
  {
    "label": "Coding",
    "sectionKey": "coding",
    "routeSuffix": "/coding-pro",
    "overview": "**Coding** introduces you to programming through the Coding Pro module — from basics to real-world projects.",
    "functionality": "Follow structured streams, work with school-aligned content, solve practice problems, and build projects to showcase your skills.",
    "services": [
      "Coding Streams (beginner to advanced)",
      "School Content Integration",
      "Practice Problems",
      "Projects & Portfolio"
    ]
  },
  {
    "label": "Events & Info",
    "sectionKey": "events-info",
    "routeSuffix": "/events",
    "overview": "**Events & Info** keeps you up to date with everything happening on the platform and beyond.",
    "functionality": "Browse upcoming events, workshops, and webinars, and never miss an important announcement.",
    "services": [
      "Upcoming Events Calendar",
      "Workshops & Webinars",
      "Important Announcements",
      "Platform Updates"
    ]
  }
];

/**
 * The static fallback text for a section, used when /section-summary answers with
 * `fallback: true` — the AI was unreachable but the sub-tiles are still real, so the
 * conversation continues with this in place of the generated summary. Mirrors the web's
 * buildSectionExplanation.
 */
export function buildStudentSectionExplanation(section) {
  if (!section) return '';
  const services = (section.services || [])
    .map((s) => `✅ ${s}`)
    .join('\n');
  return [
    section.overview,
    `**How to use it:**\n${section.functionality}`,
    `**Services available:**\n${services}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}
