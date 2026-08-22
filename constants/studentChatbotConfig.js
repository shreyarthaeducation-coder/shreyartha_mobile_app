// constants/studentChatbotConfig.js
// The `config` object that turns the shared ShreyaChatSheet into the student's Shreya.
//
// Everything portal-specific lives here: which sections exist, which static text stands in when the
// AI is down, which HTTP client carries the token, which storage key holds the user's name, how the
// greeting reads, and how a ChapterLink route becomes a route in THIS app. The sheet knows none of
// it — see components/staff/ShreyaChatSheet.js.

import {
  STUDENT_SECTIONS,
  buildStudentSectionExplanation,
} from './studentChatbotData';
import * as studentShreya from '../services/student/shreyaService';

/**
 * StudentChatbot.js greets with `Hi ${name}, what can I help you with?` where name comes from
 * `/api/students/profile`. The sheet hands us whatever `nameKey` holds; the caller seeds that key
 * from the profile it has already fetched, so no second request is made.
 */
function studentGreeting(name) {
  return `Hi ${name}, what can I help you with?`;
}

/**
 * ── ChapterLink ROUTES ARE ABSOLUTE WEB PATHS HERE ───────────────────────────
 * Like the parent's and unlike the teacher's (which emits a bare suffix), ShreyaContextService
 * emits full website paths. It has exactly two:
 *
 *   ACADEMIC_IQ_ROUTE  /student/platform/academiciq/personalized-resources
 *   SKILLS_EDGE_ROUTE  /student/platform/skillsedge
 *
 * and the native spellings differ by more than a prefix, so this is a table rather than a strip.
 * The resources screen picks its tree from a `source` param, and the web link is specifically the
 * *personalized* one, so the query string is part of the mapping.
 *
 * KNOWN REDUCTION: the web also passes `state` — `skillName`, or `subjectName`/`chapterId`/
 * `chapterName` — which deep-links to the exact chapter. The native Skills Edge screen takes no
 * such param, so the link opens the right screen but not the exact row. Better than a button that
 * goes nowhere, and worth wiring when those screens learn to accept a target.
 */
const LINK_ROUTES = {
  '/student/platform/academiciq/personalized-resources': '/academic-iq-resources?source=personalized',
  '/student/platform/skillsedge': '/skills-edge',
};

/** @returns {string|null} the suffix to append to '/student', or null if this app cannot open it. */
export function resolveStudentLink(route) {
  if (typeof route !== 'string') return null;
  return LINK_ROUTES[route] ?? null;
}

export const STUDENT_CHATBOT_CONFIG = {
  sections: STUDENT_SECTIONS,
  buildExplanation: buildStudentSectionExplanation,
  service: studentShreya,
  nameKey: 'studentUserName',
  greeting: studentGreeting,
  resolveLink: resolveStudentLink,
};
