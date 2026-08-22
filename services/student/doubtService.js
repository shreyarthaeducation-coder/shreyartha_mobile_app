// services/student/doubtService.js
// Mirrors: frontendmain/src/student/components/DoubtResolution/DoubtResolutionModal.js
// Server:  backendmain/.../infrastructure/doubt/DoubtResolutionController.java
//
// ── TIMEOUTS, AND WHY THEY ARE WORSE HERE THAN FOR JYORA ────────────────────
// `studentApi`'s DEFAULT_TIMEOUT_MS is 15 s. EVERY staged POST below is a synchronous DeepSeek call
// whose server-side read timeout is 120 s. Two are worse still:
//
//   POST /sessions      fal vision (120 s) preceded by a synchronous S3 upload  → budget ~130 s
//   POST /{id}/resolution  DeepSeek (120 s) THEN a fal FLUX illustration (60 s), SERIALLY → ~180 s
//
// And the failure mode is nastier than a plain timeout. When the client gives up, **the server
// keeps going and caches the result**. The student sees "something went wrong"; their retry then
// returns instantly with a fully-formed answer they never asked for again — because every stage
// endpoint replays its cached column rather than regenerating. That is why `withRecovery` below
// re-GETs the session on a timeout instead of re-POSTing.
//
// ── THE STAGE MACHINE IS THE SERVER'S ───────────────────────────────────────
// `stage` is an int 1-5, enforced in DoubtResolutionService.requireStage and **monotonic**
// (`setStage(Math.max(current, n))`). The client mirrors it only to decide what to render; it is
// never the authority. Every rejection — including "not found" and someone else's session — comes
// back as a **400**, so status alone cannot distinguish "too early" from "gone".
//
// ── ONE 200-WITH-ERROR ──────────────────────────────────────────────────────
// A subject mismatch is NOT an error status: `POST /sessions` answers 200 with
// `{ belongsToSubject: false, subjectGuess, session: null }` and no row is created. Callers MUST
// branch on that before touching `session`. See `createSession`'s return contract.

import { studentApi } from '../studentApi';
import { normaliseDoubtImage } from '../../utils/doubtImage';

/** Every staged call is a DeepSeek round trip. */
export const DOUBT_TIMEOUT_MS = 120000;

/** Create (vision + S3) and resolution (DeepSeek + FLUX, serially) need more. */
export const DOUBT_LONG_TIMEOUT_MS = 180000;

/**
 * Where the doubt was raised from. Persisted verbatim into a `varchar(32)`; the server does not
 * validate it and defaults a blank to CHATBOT.
 *
 * **`PERSONALIZED` is in this set** — it is in the entity's own javadoc and the web's
 * PersonalizedResources uses it. It is easy to miss because the other four read like a complete
 * list.
 */
export const SOURCES = {
  SCHOOL: 'SCHOOL',
  PERSONALIZED: 'PERSONALIZED',
  COMPETITIVE: 'COMPETITIVE',
  JYORA: 'JYORA',
  CHATBOT: 'CHATBOT',
};

/** The stage each action needs, straight from `requireStage` call sites in the service. */
export const STAGE_REQUIRED = {
  attempt: 1,
  resolution: 2,
  questions: 2,
  verify: 2,
  explore: 3,
  solution: 4,
};

/** Stage → the chip the history list shows, matching the web's ternary ladder. */
export function stageLabel(stage) {
  if (stage >= 5) return 'Solved';
  if (stage >= 3) return 'Verified';
  if (stage >= 2) return 'In progress';
  return 'New';
}

/* ── Reads ─────────────────────────────────────────────────────────────── */

export async function fetchHistory(signal) {
  const res = await studentApi.get('/api/student/doubt/sessions', { signal });
  return Array.isArray(res?.sessions) ? res.sessions : [];
}

export function fetchSession(id, signal) {
  return studentApi.get(`/api/student/doubt/sessions/${id}`, { signal });
}

/* ── Create ────────────────────────────────────────────────────────────── */

/**
 * Upload the image and read the question out of it.
 *
 * The image is normalised to JPEG first — see `utils/doubtImage`. Skipping that is how a perfectly
 * good iPhone photo gets refused as `Unsupported file type: image/heic`.
 *
 * The four context values are `@RequestParam`s on the server, i.e. plain form fields, so they go in
 * `fields` and NOT in `json`. A `json` part would arrive as `application/json` and never bind.
 * Blank values are omitted, matching the web — and `subjectName` in particular is what switches the
 * subject-mismatch check on at all.
 *
 * @returns {Promise<{ belongsToSubject: boolean, subjectGuess: string|null, session: object|null }>}
 *          **`session` is null when `belongsToSubject` is false.** That is a 200, not an error.
 */
export async function createSession({ uri, source, subjectName, chapterName, topicName }) {
  const file = await normaliseDoubtImage(uri);

  return studentApi.multipart(
    '/api/student/doubt/sessions',
    {
      fields: {
        source: source || SOURCES.CHATBOT,
        // `undefined` entries are skipped by multipart(); '' would be sent and would switch the
        // mismatch check on with nothing to compare against.
        subjectName: subjectName || undefined,
        chapterName: chapterName || undefined,
        topicName: topicName || undefined,
      },
      files: { file },
    },
    { timeoutMs: DOUBT_LONG_TIMEOUT_MS },
  );
}

/* ── Stages ────────────────────────────────────────────────────────────── */

/**
 * POST one stage, and recover a client-side timeout by READING rather than retrying.
 *
 * On a timeout the generation is almost certainly still running server-side and will be cached
 * against the session. Re-POSTing would either return that cache (fine) or start a second paid
 * generation (not fine). Re-GETting is strictly better: it costs nothing and returns the real state
 * whether or not the server finished.
 *
 * `studentApi` reports a timeout as `status: 0` with `isOffline` true — indistinguishable from a
 * genuine network failure, which is why the recovery attempt is allowed to fail quietly and let the
 * original error surface.
 */
async function stagePost(sessionId, path, body, timeoutMs = DOUBT_TIMEOUT_MS) {
  try {
    return await studentApi.post(
      `/api/student/doubt/sessions/${sessionId}/${path}`,
      body ?? {},
      { timeoutMs },
    );
  } catch (e) {
    if (!e?.isOffline) throw e;
    try {
      // A full session, not a stage payload — the caller merges either shape.
      return await fetchSession(sessionId);
    } catch {
      throw e; // Report the original timeout, not the recovery's failure.
    }
  }
}

/** `{ attempt }`. A SECOND submission is silently ignored server-side and the text discarded. */
export const submitAttempt = (id, attempt) => stagePost(id, 'attempt', { attempt });

/** The slowest call in the whole flow — DeepSeek then a FLUX illustration, one after the other. */
export const getResolution = (id) => stagePost(id, 'resolution', {}, DOUBT_LONG_TIMEOUT_MS);

export const getQuestions = (id) => stagePost(id, 'questions');

/**
 * `{ mcqAnswers, freeTextAnswers }` — positional arrays of **exactly 2 and 3**, or the server
 * answers "Please answer all the questions before submitting." MCQ answers are LETTERS.
 *
 * Graded once: a second submit replays the stored result rather than regrading, silently. Callers
 * should present that as "already graded", not as a failure.
 */
export const submitVerification = (id, mcqAnswers, freeTextAnswers) =>
  stagePost(id, 'verify', { mcqAnswers, freeTextAnswers });

export const getExplore = (id) => stagePost(id, 'explore');

export const getSolution = (id) => stagePost(id, 'solution');

/**
 * Merge a stage response into the session held on screen.
 *
 * The staged POSTs return **ad-hoc maps** (`{resolutionText, resolutionImageUrl, stage}`), not the
 * `DoubtSessionDto` the GET returns — so a plain assignment would drop everything else. The
 * timeout-recovery path above can also hand back a whole session, and this handles both: a spread
 * over the previous state is correct either way.
 */
export function mergeSession(prev, patch) {
  if (!patch) return prev;
  return { ...(prev || {}), ...patch };
}
