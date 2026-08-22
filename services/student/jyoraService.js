// services/student/jyoraService.js
// Mirrors: frontendmain/src/student/components/JyoraModal/JyoraModal.js and
//          frontendmain/src/student/components/QuestionGenModal/QuestionGenModal.js
//
// ── THE TIMEOUT IS THE WHOLE REASON THIS FILE EXISTS SEPARATELY ─────────────
// `studentApi`'s DEFAULT_TIMEOUT_MS is **15 seconds**. Jyora is a DeepSeek round trip: the server's
// `DeepSeekClient` allows a **120 second** read timeout, with maxTokens 3500 (/explain) and 6000
// (/generate-questions). A Jyora call left on the default aborts mid-generation and comes back as
// `status: 0`, which `StudentApiError.isOffline` reports as "you appear to be offline" — a working
// request presented to the student as a network failure, with a retry that fails identically.
//
// Both calls below therefore pass `timeoutMs: JYORA_TIMEOUT_MS`. Do not remove it.
//
// ── THE FIELD RENAME ────────────────────────────────────────────────────────
// The web component's prop is `staticContent`; the field the server reads is **`contentHtml`**.
// `JyoraAIController` takes a bare `Map<String,String>` and does `getOrDefault(key, "")`, so a
// misspelled key is not an error — it silently sends no content and Jyora explains the topic name
// with nothing to work from.
//
// Errors here are REAL statuses (400 / 500), not 200-with-error, so studentApi surfaces them
// normally. There is no rate limiting on either endpoint.

import { studentApi } from '../studentApi';

/** Matches the server's DeepSeek read timeout. See the header. */
export const JYORA_TIMEOUT_MS = 120000;

/**
 * The literal follow-up the "✨ Explore more" button sends. There is no free-text input by design —
 * the web removed it (its CSS still carries the orphaned `.jyora-followup-input` rules).
 * Byte-identical to `JyoraModal.js`; the checker asserts it.
 */
export const EXPLORE_MORE_PROMPT =
  'Explain this topic in more depth with additional examples, key points, and simple analogies a student can understand.';

/**
 * Ask Jyora to explain a topic.
 *
 * @param {object} ctx           the eight fields the server reads, all optional strings
 * @param {string} ctx.contentHtml the on-screen content (server strips HTML and truncates to 3000)
 * @returns {Promise<{response, html, imageUrl, imageCaption, diagramMermaid, video}>}
 *          `response` is PLAIN TEXT and is labelled in the controller as the "legacy field for
 *          older clients/mobile" — it is the guaranteed fallback when `html` is empty.
 */
export function explainTopic({
  boardName = '',
  className = '',
  subjectName = '',
  chapterName = '',
  topicName = '',
  contentLabel = '',
  contentHtml = '',
  followUpQuestion = '',
} = {}) {
  return studentApi.post(
    '/api/student/jyora/explain',
    {
      boardName,
      className,
      subjectName,
      chapterName,
      topicName,
      contentLabel,
      contentHtml,
      followUpQuestion,
    },
    { timeoutMs: JYORA_TIMEOUT_MS },
  );
}

/**
 * Generate ten similar practice questions from one question.
 *
 * `correctAnswer` is a LETTER ("A".."D") both in and out. `bloomsLevel` is accepted by the DTO and
 * then never used in the prompt — sent anyway, so the contract stays whole if that changes.
 *
 * @returns {Promise<{questions: Array<{questionText, optionA, optionB, optionC, optionD, correctAnswer, hint}>}>}
 */
export function generateQuestions({
  subjectName = '',
  chapterName = '',
  topicName = '',
  questionText = '',
  optionA = '',
  optionB = '',
  optionC = '',
  optionD = '',
  correctAnswer = '',
  hint = '',
  bloomsLevel = '',
} = {}) {
  return studentApi.post(
    '/api/student/jyora/generate-questions',
    {
      subjectName,
      chapterName,
      topicName,
      questionText,
      optionA,
      optionB,
      optionC,
      optionD,
      correctAnswer,
      hint,
      bloomsLevel,
    },
    { timeoutMs: JYORA_TIMEOUT_MS },
  );
}

/**
 * Practice Zone's questions carry `options[]` + `correctOptionIndex`; the generator wants
 * `optionA..D` + a letter. The web does this conversion inline at three call sites — here once.
 */
export function questionContextFromIndexed(question) {
  const options = question?.options || [];
  return {
    questionText: question?.questionText || '',
    optionA: options[0] || '',
    optionB: options[1] || '',
    optionC: options[2] || '',
    optionD: options[3] || '',
    correctAnswer: String.fromCharCode(65 + (question?.correctOptionIndex || 0)),
    hint: question?.explanation || '',
    bloomsLevel: question?.bloomsLevel || '',
  };
}

/** The understanding test's questions are already lettered. */
export function questionContextFromLettered(question) {
  return {
    questionText: question?.questionText || '',
    optionA: question?.optionA || '',
    optionB: question?.optionB || '',
    optionC: question?.optionC || '',
    optionD: question?.optionD || '',
    correctAnswer: question?.correctAnswer || '',
    hint: question?.hint || '',
    bloomsLevel: question?.bloomsLevel || '',
  };
}
