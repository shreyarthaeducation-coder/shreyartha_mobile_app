// services/student/languageProService.js
// Mirrors: frontendmain/src/student/platform/LanguagePro/{LanguagePro,LanguageProSchoolResources,
//          LanguageProPersonalizedResources}.js and src/api/{shreyaEnglishApi,phoneticsApi}.js
//
// ── FOUR NAMESPACES ──────────────────────────────────────────────────────────
//   /api/languagepro/              the content tree and topic content        (BARE)
//   /api/student/languagepro/      the understanding test                    (SINGULAR)
//   /api/student/shreya-english/   Learn with Shreya                         (SINGULAR)
//   /api/v1/phonetics/             the IPA dictionary                        (VERSIONED)
//   /api/students/profile          the student's class                       (PLURAL)
//
// Pronunciation scoring and TTS live in services/student/speechService.js — that one needed a new
// backend endpoint, so it is kept separate from the plain content reads here.

import { studentApi } from '../studentApi';
import { findMatchedClass } from '../../utils/classMatch';
import { isCollegeStudent } from '../../utils/studentType';

/* ── Resources ─────────────────────────────────────────────────────────── */

export function fetchTree(signal) {
  return studentApi.get('/api/languagepro/tree', { signal }).then((r) => (Array.isArray(r) ? r : []));
}

/**
 * The level-matched subset, for the Personalized Resources card.
 *
 * ── THIS RETURNS AN OBJECT, NOT AN ARRAY ─────────────────────────────────────
 * `LanguageProPersonalizedResponse` is
 *   { studentLevel, weakSkills[{skill, level}], isFullyProficient, curriculums[],
 *     previousClassCurriculums[], allSkills{Listening|Speaking|Reading|Writing → level} }
 *
 * This used to coerce a non-array to `[]`, which meant it returned an EMPTY LIST every single
 * time — the screen could never have shown anything.
 *
 * **The step-down logic lives on the server.** The web walks down a class per weakness level
 * (`average` → −1 class, `beginner` → −2) in the browser; here the backend has already filtered to
 * the skills where the student is Beginner or Average and handed back both the current-class and
 * the previous-class curriculums. Do not re-derive it client-side.
 *
 * Note the failure mode: on an internal error this endpoint answers **200 with
 * `isFullyProficient: true`**, not an error status. "Nothing to show" and "it broke" look the same.
 */
export async function fetchPersonalized(signal) {
  const res = await studentApi.get('/api/languagepro/personalized', { signal });
  return {
    studentLevel: res?.studentLevel ?? null,
    weakSkills: Array.isArray(res?.weakSkills) ? res.weakSkills : [],
    // The DTO field is `isFullyProficient`; Jackson serialises it as `fullyProficient` for a
    // boolean getter, so both spellings occur on the wire depending on the mapper's config.
    fullyProficient: !!(res?.isFullyProficient ?? res?.fullyProficient),
    curriculums: Array.isArray(res?.curriculums) ? res.curriculums : [],
    previousClassCurriculums: Array.isArray(res?.previousClassCurriculums)
      ? res.previousClassCurriculums
      : [],
    allSkills: res?.allSkills && typeof res.allSkills === 'object' ? res.allSkills : {},
  };
}

/** The four skills the level strip shows, in the web's order. */
export const LANGUAGE_SKILLS = ['Listening', 'Speaking', 'Reading', 'Writing'];

export function fetchTopicContent(topicId, signal) {
  return studentApi.get(`/api/languagepro/topiccontent/${topicId}`, { signal });
}

/** SINGULAR `/api/student/`, and keyed by CHAPTER id — not the topic id the content uses. */
export function fetchUnderstandingQuestions(chapterId, signal) {
  return studentApi
    .get(`/api/student/languagepro/understanding/${chapterId}/questions`, { signal })
    .then((r) => (Array.isArray(r) ? r : []));
}

/**
 * The student's class NAME plus whether they are a college student.
 *
 * `isCollege` is not cosmetic here — it decides three things the web branches on:
 *   • an unmatched class falls back to `classes[0]` for college students and to NOTHING otherwise
 *     (the same defect that showed a Class 6 student the Class 9 Coding Pro syllabus)
 *   • the Personalized Resources card is hidden entirely
 *   • "School Resources" is relabelled "College Resources"
 */
export async function fetchStudentClass(signal) {
  const profile = await studentApi.get('/api/students/profile', { signal });
  return {
    className: profile?.currentClass || profile?.class || null,
    isCollege: isCollegeStudent(profile),
  };
}

/**
 * Which class of a curriculum this student should see — the same college-only fallback rule as
 * Coding Pro's `resolveCodingClass`. Returns null when a SCHOOL student's class does not match, so
 * the caller can say so rather than silently showing another class's content.
 */
export function resolveLanguageClass(curriculum, className, isCollege) {
  if (!curriculum) return null;
  if (isCollege) return (curriculum.classes || [])[0] || null;
  return findMatchedClass(curriculum, className);
}

/* ── Learn with Shreya — SINGULAR `/api/student/shreya-english/` ───────── */

export const shreyaEnglish = {
  tree: (signal) => studentApi.get('/api/student/shreya-english/tree', { signal }),
  profile: (signal) => studentApi.get('/api/student/shreya-english/profile', { signal }),
  progress: (signal) => studentApi.get('/api/student/shreya-english/progress', { signal }),
  chapter: (chapterId, signal) =>
    studentApi.get(`/api/student/shreya-english/chapters/${chapterId}`, { signal }),

  placementQuestions: (signal) =>
    studentApi.get('/api/student/shreya-english/placement/questions', { signal }),
  submitPlacement: (payload) =>
    studentApi.post('/api/student/shreya-english/placement/submit', payload),

  /**
   * Record one chapter attempt.
   *
   * The payload is UNCHANGED from the web — `{accuracy, fluency, completeness, prosody, overall,
   * recognizedText, wordsJson, answers}`. Only where those numbers come from differs: the browser
   * gets them from the Azure SDK, the app from `POST /api/v1/speech/assess`.
   */
  submitAttempt: (chapterId, payload) =>
    studentApi.post(`/api/student/shreya-english/chapters/${chapterId}/attempt`, payload),

  /** Re-run evaluation on the stored attempt; takes no body. */
  retryEvaluation: (chapterId) =>
    studentApi.post(`/api/student/shreya-english/chapters/${chapterId}/evaluate`, {}),

  levelUp: () => studentApi.post('/api/student/shreya-english/level-up', {}),
};

/* ── Phonetics — VERSIONED `/api/v1/phonetics/` ────────────────────────── */

export const phonetics = {
  /** IPA for one word. */
  word: (word, signal) =>
    studentApi.get(`/api/v1/phonetics/word/${encodeURIComponent(word)}`, { signal }),

  /** IPA for a whole passage — one entry per word token, in reading order. */
  transcribe: (text) => studentApi.post('/api/v1/phonetics/transcribe', { text }),
};

// No WEB_PATHS here any more. Every Language Pro area is native as of Phase 6c — Resources, Record
// Your Voice, Sound Studio and Learn with Shreya — so the WebView hand-offs this held are gone.
