// services/teacher/aiContentService.js
// Mirrors: frontendmain/src/School/Teacher/pages/SHREYA01/TeachAI/{TeacherResourceViewer,TeachAiPanel}.js
// Backend: shreya01/ai/TeacherAiContentController.java
//          @PreAuthorize("hasRole('TEACHER') or hasRole('SHREYARTHA_TEACHER')")
//          — Portal A reaches this despite the /shreya01/ path.

import { staffApi } from '../staffApi';

const BASE = '/api/shreya01/ai-content';

/**
 * Vision + DeepSeek; 3D generation is the slowest at ~10–30 s.
 *
 * ── WHY 90s WAS NOT ENOUGH ──────────────────────────────────────────────────
 * The v4 models reason before answering, and reasoning is charged against the same token budget
 * as the answer — so `DeepSeekClient` now sends a thinking allowance on top of each caller's
 * budget, and retries once when a reply comes back empty because the model used the whole budget
 * thinking. Measured against the live API, one HOTS deep-dive takes 16–40 s; a retried one
 * therefore lands near 80 s, which 90 s does not safely cover.
 *
 * 180 s matches the 3D timeout, and the ceiling that actually matters is the backend's own
 * per-attempt read timeout (120 s), not this one.
 */
const AI_TIMEOUT_MS = 180000;
const THREE_D_TIMEOUT_MS = 180000;

/**
 * The six canonical Bloom's levels, verbatim from frontendmain/src/common/bloomsLabels.js.
 *
 * NOT the same list as `BLOOM_TAXONOMY` in examService.js — that one carries the "-ing" forms plus
 * three stream names, because it feeds the exam question form. Using it here would send the server
 * a level it does not recognise.
 */
export const CANONICAL_BLOOMS = [
  'Remember',
  'Understand',
  'Apply',
  'Analyze',
  'Evaluate',
  'Create',
];

/**
 * Every failure from this controller is `{ message }`, but **the status carries meaning here**,
 * unlike most of this backend:
 *   400 — bad input (no resource, unreadable file)
 *   502 — the AI provider itself failed (Vision / DeepSeek / Fal.ai) — retryable
 *   500 — anything else
 */
export function aiErrorText(e, fallback) {
  if (e?.status === 502) {
    return e?.message || 'The AI service is busy right now. Please try again in a moment.';
  }
  return e?.message || fallback;
}

/**
 * Create a session from a cropped region.
 *
 * **Flat `@RequestParam` multipart** — `fields`, NOT `json`. This is the one upload in the app
 * that does not go through `@RequestPart("data")`, so the 415 trap does not apply.
 *
 * @param {{ uri: string, name?: string, type?: string }} file the cropped JPEG
 */
export function createAiSession({ file, resourceId, bloomsLevel, chapterName, topicName }) {
  return staffApi.multipart(
    `${BASE}/sessions`,
    {
      fields: { resourceId, bloomsLevel, chapterName, topicName },
      files: { file: { name: 'selection.jpg', type: 'image/jpeg', ...file } },
    },
    { timeoutMs: AI_TIMEOUT_MS },
  );
}

/** Past generations for this resource, newest first. */
export async function fetchAiSessions(resourceId, signal) {
  const res = await staffApi.get(`${BASE}/sessions`, { params: { resourceId }, signal });
  return Array.isArray(res?.sessions) ? res.sessions : [];
}

export function fetchAiSession(id, signal) {
  return staffApi.get(`${BASE}/sessions/${id}`, { signal });
}

/* ── Follow-ups ───────────────────────────────────────────────────────────────
   All three are cache-first server-side: a second call returns the stored result instantly.
   That is why the UI disables each button once its result exists rather than allowing a re-roll. */

export function exploreContent(sessionId) {
  return staffApi.post(`${BASE}/sessions/${sessionId}/explore-content`, {}, {
    timeoutMs: AI_TIMEOUT_MS,
  });
}

export function fetchHots(sessionId) {
  return staffApi.post(`${BASE}/sessions/${sessionId}/hots`, {}, { timeoutMs: AI_TIMEOUT_MS });
}

/** The only follow-up that takes a body; the web sends `{}` and lets the server pick the level. */
export function fetchQuiz(sessionId, bloomsLevel) {
  return staffApi.post(
    `${BASE}/sessions/${sessionId}/quiz`,
    bloomsLevel ? { bloomsLevel } : {},
    { timeoutMs: AI_TIMEOUT_MS },
  );
}

/* ── View in 3D ─────────────────────────────────────────────────────────────── */

export function generate3d({ file, resourceId }) {
  return staffApi.multipart(
    `${BASE}/generate-3d`,
    {
      fields: { resourceId },
      files: { file: { name: 'selection.jpg', type: 'image/jpeg', ...file } },
    },
    { timeoutMs: THREE_D_TIMEOUT_MS },
  );
}

export async function fetch3dModels(resourceId, signal) {
  const res = await staffApi.get(`${BASE}/models-3d`, { params: { resourceId }, signal });
  return Array.isArray(res?.models) ? res.models : [];
}
