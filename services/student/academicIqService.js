// services/student/academicIqService.js
// Mirrors: frontendmain/src/student/platform/AcademicIQ/{SchoolResources,PersonalizedResources,
//          PracticeZone,MyReflection}.js
//
// ── SIX NAMESPACES IN ONE AREA ────────────────────────────────────────────────
// Academic IQ is the worst place in the app for the prefix trap. All of these are real and none
// can be inferred from another:
//
//   /api/academiciq/        tree, topic content
//   /api/academic/profile   the student's curriculum + class ids
//   /api/students/…         personalized-resources                (PLURAL)
//   /api/student/…          understanding, reflection             (SINGULAR)
//   /api/adaptive/…         MyReflection's adaptive engine        (bare, no student prefix)
//   /api/practice/…         Practice Zone questions and progress  (bare, no student prefix)
//
// Every one was copied from the web line that calls it. A wrong prefix 404s, and a 404 body has no
// `message`, so the screen loads EMPTY rather than erroring.

import { studentApi } from '../studentApi';

/* ── The tree ──────────────────────────────────────────────────────────────
   Resolved by ID, not by label — `/api/academic/profile` hands back `curriculumId` and `classId`
   directly, so none of the Roman-numeral matching the Psychometric tree needs applies here. */

export function fetchAcademicProfile(signal) {
  return studentApi.get('/api/academic/profile', { signal });
}

export function fetchTree(signal) {
  return studentApi.get('/api/academiciq/tree', { signal }).then((r) => (Array.isArray(r) ? r : []));
}

/** Shown when the profile has no curriculum/class — the web's exact wording. */
export const NO_SELECTION_MESSAGE =
  'Academic IQ profile does not contain selected curriculum/class. Please set Academic IQ selections first.';

/**
 * The class node for this student, plus the display names the header uses.
 *
 * @returns {{ subjects, boardName, className, error }} `error` is set when the profile has no
 *          selections, which is a "go and choose" state rather than a failure.
 */
export function resolveClassSubjects(tree, profile) {
  const curriculumId = profile?.curriculumId ?? profile?.curriculum?.id ?? null;
  const classId = profile?.classId ?? profile?.class?.id ?? null;
  if (!curriculumId || !classId) {
    return { subjects: [], boardName: '', className: '', error: NO_SELECTION_MESSAGE };
  }

  const curriculum = (tree || []).find((c) => String(c.id) === String(curriculumId));
  const clazz = (curriculum?.classes || []).find((c) => String(c.id) === String(classId));

  return {
    subjects: clazz?.subjects || [],
    boardName: curriculum?.name || '',
    className: clazz?.name || '',
    error: curriculum && clazz ? '' : NO_SELECTION_MESSAGE,
  };
}

/**
 * Personalized Resources has its OWN tree — it does not filter the Academic IQ one.
 *
 * `/api/students/personalized-resources` returns the subjects a teacher assigned to this student,
 * already in `subjects → chapters → topics` shape, so it drops straight into the same renderer.
 * The web also fetches the academiciq tree on this screen, but only to look up the board and class
 * *names* for display — not to filter anything.
 */
export async function fetchPersonalizedSubjects(signal) {
  const res = await studentApi.get('/api/students/personalized-resources', { signal });
  return Array.isArray(res) ? res : [];
}

/**
 * Topic content — six tabs, all optional, three of them with their own media.
 * `{ lessonPlan, topicExplanation, realLifeRelevance, handwrittenNotes, importanceForBoard,
 *    difficultConcept, …VideoUrl, …ImageUrl }`
 */
export function fetchTopicContent(topicId, signal) {
  return studentApi.get(`/api/academiciq/topic/${topicId}/content`, { signal });
}

/** The six content tabs in the web's order; labels verbatim. */
export const CONTENT_TABS = [
  { key: 'lessonPlan', label: 'Lesson Plan' },
  { key: 'topicExplanation', label: 'Topic Explanation', media: true },
  { key: 'realLifeRelevance', label: 'Real Life Relevance', media: true },
  { key: 'handwrittenNotes', label: 'Handwritten Notes' },
  { key: 'importanceForBoard', label: 'Importance for Board' },
  { key: 'difficultConcept', label: 'Difficult Concept', media: true },
];

/** Understanding questions for a topic. SINGULAR `/api/student/`. */
export function fetchUnderstandingQuestions(topicId, signal) {
  return studentApi
    .get(`/api/student/understanding/${topicId}/questions`, { signal })
    .then((r) => (Array.isArray(r) ? r : []));
}

/* ── MyReflection's adaptive engine — BARE `/api/adaptive/` ────────────────
   Shaped for hooks/useAdaptiveSession: `answer` picks /submit on the last question and /next
   otherwise, and the hook supplies the guarded body. */

export const adaptiveEngine = (topicId) => ({
  start: () => studentApi.post(`/api/adaptive/topic/${topicId}/start`, {}),
  answer: (body, isLast) =>
    studentApi.post(
      isLast ? `/api/adaptive/topic/${topicId}/submit` : `/api/adaptive/topic/${topicId}/next`,
      body,
    ),
});

/* ── Reflection ────────────────────────────────────────────────────────── */

/** The four reflection levels, verbatim — text and level strings are stored on the record. */
export const REFLECTION_OPTIONS = [
  {
    id: 1,
    text: 'I am building clarity and understanding of the chapter.',
    level: 'Beginner',
    color: '#dc2626',
    description: "Let's strengthen the basics first.",
  },
  {
    id: 2,
    text: 'I understand parts of the chapter but need support to apply concepts.',
    level: 'Developing',
    color: '#f59e0b',
    description: 'Good start! Guided practice will help you apply the ideas better.',
  },
  {
    id: 3,
    text: 'I understand the chapter but need more practice to apply concepts independently.',
    level: 'Progressing',
    color: '#eab308',
    description: "You're progressing well. More practice will build confidence.",
  },
  {
    id: 4,
    text: 'I understand the chapter well and can analyse, apply, and connect ideas.',
    level: 'Proficient',
    color: '#65a30d',
    description: "Great work! You're ready for advanced challenges.",
  },
];

export const ADAPTIVE_TOTAL_QUESTIONS = 12;

/** Accuracy → reflection level. Boundaries are inclusive-upper, exactly as the web has them. */
export function accuracyToReflectionOption(pct) {
  const n = Number(pct) || 0;
  if (n <= 50) return REFLECTION_OPTIONS[0]; // Beginner
  if (n <= 75) return REFLECTION_OPTIONS[1]; // Developing
  if (n <= 90) return REFLECTION_OPTIONS[2]; // Progressing
  return REFLECTION_OPTIONS[3]; // Proficient
}

/** SINGULAR `/api/student/`. Also feeds My Analytics' Learning Gaps. */
export function submitReflection(topicId, option) {
  return studentApi.post('/api/student/reflection/submit', {
    topicId,
    reflectionLevel: option.level,
    reflectionOptionId: option.id,
    reflectionText: option.text,
  });
}

/* ── Practice Zone — BARE `/api/practice/` ─────────────────────────────── */

export function fetchPracticeQuestions(topicId, signal) {
  return studentApi
    .get(`/api/practice/topic/${topicId}/questions`, { signal })
    .then((r) => (Array.isArray(r) ? r : []));
}

export function fetchPracticeProgress(topicId, signal) {
  return studentApi.get(`/api/practice/topic/${topicId}/progress`, { signal });
}

export function savePracticeProgress(topicId, body) {
  return studentApi.post(`/api/practice/topic/${topicId}/progress`, body);
}

/* ── Universal Adaptive — SINGULAR `/api/student/universal-adaptive/` ──────
   A fundamentally different protocol from the other two engines, which is why it is driven with
   `protocol: 'server'`:

     • /start then /answer — there is NO /next and NO /submit
     • the request DTO is exactly `UniversalAdaptiveAnswerRequest { attemptId, selectedAnswerIndex }`
     • the LADDER LIVES ON THE SERVER, on a persisted `UniversalAdaptiveAttempt` row — two correct
       in a row levels up, two wrong levels down
     • there is NO question cap: the run ends when the server sets `assessmentComplete`, i.e. when
       the pool is exhausted
     • counters come back FLAT, and a full `report` arrives with the final answer

   Sending a `sessionState` here (the other engines' shape) is at best ignored and at worst a 400,
   and capping the run client-side truncated it. */

export function fetchUniversalAvailability(topicId, signal) {
  return studentApi.get(`/api/student/universal-adaptive/topic/${topicId}/availability`, { signal });
}

export const universalAdaptiveEngine = (topicId, attemptIdRef) => ({
  start: async () => {
    const data = await studentApi.post(`/api/student/universal-adaptive/topic/${topicId}/start`, {});
    if (attemptIdRef) attemptIdRef.current = data?.attemptId ?? null;
    return data;
  },
  // `body` is `{ selectedAnswerIndex }` from the hook's 'server' branch. The attempt id is the
  // server's handle on the ladder, so it is stamped here rather than held in component state.
  answer: (body) =>
    studentApi.post('/api/student/universal-adaptive/answer', {
      attemptId: attemptIdRef?.current ?? null,
      selectedAnswerIndex: body?.selectedAnswerIndex ?? null,
    }),
});

/** The finished analysis for an attempt, if the summary needs re-reading after the fact. */
export function fetchUniversalReport(attemptId, signal) {
  return studentApi.get(`/api/student/universal-adaptive/attempt/${attemptId}/report`, { signal });
}

export function stopUniversalAttempt(attemptId) {
  return studentApi.post(`/api/student/universal-adaptive/attempt/${attemptId}/stop`, {});
}
