// services/student/skillsEdgeService.js
// Mirrors: frontendmain/src/student/platform/SkillsEdge/SkillsEdge.js (1,378)
//          + SkillCertificateSubmission.js (199)
//
// NOTE: `SkillsEdgeTestYourUnderstanding.js` and `SkillDetailPage.js` also live in that folder and
// have **no importers anywhere in frontendmain/src**. They are dead. The live understanding test is
// the inline `activeContentTab === "understanding"` branch of SkillsEdge.js, and it is the one
// modelled here — the dead component scores differently.
//
// ── THE ENDPOINT-SPELLING TRAP, IN FULL ───────────────────────────────────────
// This one feature uses ALL THREE student prefixes. They are different controllers, not typos:
//
//   /api/skillsedge/          tree, progress, learning content, module completion
//   /api/student/skillsedge/  the understanding test        (SINGULAR)
//   /api/students/skillsedge/ certificates                  (PLURAL)
//
// Each was copied from the line in the web component that calls it. Never infer one from another:
// a wrong prefix 404s, and a 404 body has no `message`, so the screen loads *empty* rather than
// erroring. See the header of services/studentApi.js.

import { studentApi } from '../studentApi';
import { shuffleArray } from '../../utils/shuffle';

/* ── Tree and progress ─────────────────────────────────────────────────────
   The tree arrives whole: skills → `topics` → `learningObjectives`. Only a learning objective's
   modules are fetched on demand. The nesting reads oddly against the UI labels — a "skill" is the
   category ("Art & Craft") and a "topic" is the actual skill ("Calligraphy") — and the certificate
   is earned per TOPIC. */

export function fetchTree(signal) {
  return studentApi.get('/api/skillsedge/tree', { signal }).then((r) => (Array.isArray(r) ? r : []));
}

/** The student's chosen skills — an array of NAMES under `importantSkills`, not ids. */
export async function fetchSelectedSkills(signal) {
  const res = await studentApi.get('/api/skills/profile', { signal });
  return Array.isArray(res?.importantSkills) ? res.importantSkills : [];
}

export async function fetchCompletedTopics(signal) {
  const res = await studentApi.get('/api/skillsedge/topics/completed', { signal });
  return new Set(res?.completedTopicIds || []);
}

export async function fetchCompletedModules(signal) {
  const res = await studentApi.get('/api/skillsedge/topics/modules/completed', { signal });
  return new Set(res?.completedModuleIds || []);
}

/**
 * `{ modules: [{ id, moduleOrder, textContent, videoUrl, imageUrl, pdfUrl }] }`
 *
 * THERE IS NO `title`. `SkillsEdgeModule` has no such column and `SkillsEdgeModulePayload` does not
 * carry one — an earlier version of this comment claimed it did, and four render sites read
 * `m.title` and drew nothing, which is why module names were invisible in the app. Use
 * `moduleLabel()` from constants/skillsEdge.js, which is what the website does too ("Module 1",
 * "Module 2", …).
 */
export async function fetchLearningContent(learningObjectiveId, signal) {
  const res = await studentApi.get(`/api/skillsedge/learningcontent/${learningObjectiveId}`, {
    signal,
  });
  return Array.isArray(res?.modules) ? res.modules : [];
}

/** Toggles, so the server decides the new state — `{ completed: boolean }` comes back. */
export function toggleModuleComplete(moduleId) {
  return studentApi.post(`/api/skillsedge/topics/modules/${moduleId}/toggle-complete`);
}

/* ── Understanding test (SINGULAR `/api/student/`) ─────────────────────── */

/**
 * The topic-wide ASSESSMENT: every module's questions under one topic, in one test.
 *
 * Distinct from the per-module test above — this is the "Assessment" the website's Skills Edge
 * offers at the topic level and never wired up. Same question shape, so `UnderstandingTest` renders
 * and scores it unchanged through its `loadQuestions` override; the server samples and shuffles, and
 * `shuffleArray` here is belt-and-braces for an older server that does not.
 *
 * ONE-SHOT: nothing is persisted, exactly like the module test. Leaving the topic loses the attempt.
 */
export async function fetchTopicAssessment(topicId, signal) {
  const res = await studentApi.get(
    `/api/student/skillsedge/understanding/topic/${topicId}/assessment`,
    { signal },
  );
  return shuffleArray(Array.isArray(res) ? res : []);
}

/** Shuffled on arrival, as the web does — the server order is not meaningful. */
export async function fetchUnderstandingQuestions(moduleId, signal) {
  const res = await studentApi.get(`/api/student/skillsedge/understanding/${moduleId}/questions`, {
    signal,
  });
  return shuffleArray(Array.isArray(res) ? res : []);
}

// There is NO `fetchUnderstandingInfo` here on purpose. `/understanding/{moduleId}/info` exists on
// the backend, but the only caller in frontendmain is `SkillsEdgeTestYourUnderstanding.js` — the
// dead component. The live page fetches `/questions` and nothing else, and the questions carry
// everything the test renders. Adding `/info` would be porting dead code.

/* ── Certificates (PLURAL `/api/students/`) ────────────────────────────────
   Earned per TOPIC. Status carries both eligibility and any existing submission:
   `{ eligible, reason, totalModules, completedModules, submission }` where `reason` is one of
   PLAN_LOCKED | NO_MODULES_PUBLISHED | MODULES_INCOMPLETE and `submission.status` is
   PENDING | APPROVED | REJECTED. */

export function fetchCertificateStatus(topicId, signal) {
  return studentApi.get('/api/students/skillsedge/certificates/status', {
    params: { topicId },
    signal,
  });
}

/**
 * Submit (or revise) the project.
 *
 * Flat form fields plus up to three optional files — there is no `@RequestPart("data")` JSON part,
 * so the 415 trap that bites the staff uploads does not apply here. Files must still carry a
 * `type`, or the backend cannot tell what it received.
 */
export function submitCertificateProject({ topicId, title, description, video, pdf, ppt }) {
  const files = {};
  if (video) files.videoFile = video;
  if (pdf) files.pdfFile = pdf;
  if (ppt) files.pptFile = ppt;

  return studentApi.multipart('/api/students/skillsedge/certificates', {
    fields: { topicId, title, ...(description ? { description } : {}) },
    files,
  });
}

export const CERTIFICATE_DOWNLOAD = (id) => `/api/students/skillsedge/certificates/${id}/download`;

export const MAX_DESCRIPTION_WORDS = 200;

export const wordCount = (text) => (text ? text.trim().split(/\s+/).filter(Boolean).length : 0);

/* ── Scoring ───────────────────────────────────────────────────────────────
   Moved to services/student/understandingScoring.js — Academic IQ uses the very same scorer in
   three more places (verified identical to this one). Re-exported here so every existing import
   from this module keeps working. */

export {
  BLOOMS_LEVELS,
  normalizeBloomsLevel,
  scoreUnderstanding,
  masteryBand,
  masteryStatus,
  bloomsRemark,
} from './understandingScoring';
