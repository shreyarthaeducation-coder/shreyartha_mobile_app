// services/counsellor/f2fService.js
// Mirrors: frontendmain/src/School/shared/F2F/F2FLiveSession.js
// Backend:  facetoface/controller/CounselorF2FController.java   (COUNSELOR)
//           facetoface/controller/Shreya01F2FController.java    (SHREYARTHA_COUNCELLOR)
//
// The two controllers are line-for-line twins delegating to one `F2FApi`; only the @PreAuthorize
// and the prefix differ. So every function here takes `f2f` — the portal's own root from
// constants/counsellorPortals.js — and nothing branches on role.
//
// ══ EVERY FAILURE ARRIVES AS HTTP 400 ══════════════════════════════════════
// `F2FApi.guard()` wraps every handler and turns any exception into
// `400 {success:false, message}`. So a refusal that is really a permission problem ("The
// microphone is no longer yours", "Consent to record has not been given") is a 400, not a 403.
// `staffApi` surfaces the message; do not special-case status codes here.

import { staffApi } from '../staffApi';

// ─── Sessions ───────────────────────────────────────────────────────────────

/**
 * Create a session AND enrol its students in one call — `studentIds` is part of the request body,
 * which is why there is no separate "add participants" step for the queue variant.
 *
 * A walk-in passes `mode: 'WALK_IN'` and **no schoolId**: the server falls back to the
 * counsellor's own school code. Sending one is not merely unnecessary, it is wrong for the
 * Shreyartha portal, where the counsellor covers several schools and a walk-in belongs to none of
 * them in particular.
 */
export function createSession(f2f, body) {
  return staffApi.post(`${f2f}/sessions`, body);
}

export function listSessions(f2f, { status, from, to, page = 0 } = {}, signal) {
  return staffApi.get(`${f2f}/sessions`, {
    params: { status: status || undefined, from: from || undefined, to: to || undefined, page },
    signal,
  });
}

export function getSession(f2f, uuid, signal) {
  return staffApi.get(`${f2f}/sessions/${uuid}`, { signal });
}

/** SCHEDULED → ONGOING → COMPLETED, plus the two CANCELLED arms. */
export function setSessionStatus(f2f, uuid, status) {
  return staffApi.post(`${f2f}/sessions/${uuid}/status`, { status });
}

/**
 * Consent is not a checkbox for the record — the server enforces it.
 *
 * `grantMic` refuses without it AND `uploadSegment` re-checks it on every upload, because
 * `walkIn` opens a turn directly and never asked. So a session whose consent was withdrawn
 * mid-way stops accepting audio immediately rather than at the next mic grant.
 */
export function setConsent(f2f, uuid, consentObtained, consentNote) {
  return staffApi.post(`${f2f}/sessions/${uuid}/consent`, { consentObtained, consentNote });
}

/**
 * The revision-gated poll — and the ONLY source of the student queue.
 *
 * `participants` and `activeParticipantId` come back on this call, so there is no separate roster
 * endpoint to fetch. Pass `since` and the server answers `{changed:false}` from a single indexed
 * column read; apply the payload only when `changed` is true, or the screen will re-render the
 * queue every three seconds and lose whatever the counsellor was typing.
 *
 * Call it WITHOUT `since` to force a full re-read — after a skip or a revoke, where the local
 * revision is stale in a way the diff cannot express.
 */
export function fetchState(f2f, uuid, since, signal) {
  return staffApi.get(`${f2f}/sessions/${uuid}/state`, {
    params: { since: since ?? undefined },
    signal,
  });
}

// ─── Participants ───────────────────────────────────────────────────────────

export function addParticipants(f2f, uuid, studentIds) {
  return staffApi.post(`${f2f}/sessions/${uuid}/participants`, { studentIds });
}

export function removeParticipant(f2f, uuid, participantId) {
  return staffApi.del(`${f2f}/sessions/${uuid}/participants/${participantId}`);
}

/** Refused while that student's turn is open — end the turn first. */
export function skipParticipant(f2f, uuid, participantId) {
  return staffApi.post(`${f2f}/sessions/${uuid}/participants/${participantId}/skip`, {});
}

/**
 * A student who is not on the roster: creates the participant, opens their turn and hands over the
 * microphone in one call.
 *
 * It also flips a SCHEDULED session to ONGOING itself. Note it performs NO consent check of its
 * own — `uploadSegment` is what refuses, so the consent bar must be honoured by the UI or a
 * walk-in appears to record for twenty minutes and produces nothing.
 */
export function walkIn(f2f, uuid, { displayName, gradeLabel, studentId } = {}) {
  return staffApi.post(`${f2f}/sessions/${uuid}/walk-in`, { displayName, gradeLabel, studentId });
}

// ─── The microphone ─────────────────────────────────────────────────────────

/**
 * Seat a student and open their turn → `{turnId, micToken}`.
 *
 * Opens a NEW turn every time it is called, so re-seating somebody who already holds the mic
 * strands the first turn. Refuses without consent, with recording switched off, or while another
 * participant holds the microphone.
 */
export function grantMic(f2f, uuid, participantId) {
  return staffApi.post(`${f2f}/sessions/${uuid}/participants/${participantId}/mic`, {});
}

/** Takes the microphone back from a stranded turn, freeing the session for the next student. */
export function revokeMic(f2f, turnId) {
  return staffApi.post(`${f2f}/turns/${turnId}/revoke`, {});
}

/**
 * One recording, as multipart.
 *
 * ══ THE PART IS `audio`, AND THE FIELDS ARE @RequestParam ══════════════════
 * The controller binds `micToken`, `segmentIndex`, `durationMs`, `speaker` and `audio` as
 * `@RequestParam`, NOT `@RequestPart`. React Native's FormData produces parts with no per-part
 * content type, which a `@RequestPart` binding rejects with a 415 before the handler is reached —
 * the same reason every other upload in this codebase takes `@RequestParam MultipartFile`.
 *
 * ══ THE MIC TOKEN IS THE AUTHENTICATION ════════════════════════════════════
 * Not the session. `finishTurn` nulls it, so an upload that arrives after the turn ended is
 * refused with "The microphone is no longer yours" — permanently. That is why the caller must
 * await the upload BEFORE finishing the turn.
 *
 * Idempotent on `(turnId, segmentIndex)`, so a retry after a timeout overwrites rather than
 * duplicating.
 *
 * ══ THE TIMEOUT MUST OUTLAST RECOGNITION, NOT THE UPLOAD ═══════════════════
 * This request does not return when the bytes have landed. The server transcribes the audio
 * INLINE and only then answers, so the response time is the recognition time — which for a
 * counselling turn is minutes, not the seconds a photo upload takes.
 *
 * `multipart` defaults to 60 s, sized for a photo over mobile data. On a real turn that expires
 * while Google is still working: the client aborts, counts the recording as failed, and goes
 * straight on to `/finish` — and the transcript then lands after the report has already been
 * drafted, so the counsellor gets the "[square brackets]" blank template with no clue why. A
 * short test recording answers in a few seconds and hides all of it, which is exactly how this
 * survived testing.
 *
 * 330 s deliberately exceeds the server's own `OPERATION_TIMEOUT_SECONDS = 300`: the server must
 * be the one that gives up first, so a slow recognition comes back as a real answer this client
 * can show, rather than as an abort it has to guess about.
 */
export const SEGMENT_UPLOAD_TIMEOUT_MS = 330000;

export function uploadSegment(f2f, turnId, { file, micToken, segmentIndex, durationMs, speaker }) {
  return staffApi.multipart(`${f2f}/turns/${turnId}/segments`, {
    fields: {
      micToken,
      segmentIndex: String(segmentIndex),
      durationMs: durationMs == null ? undefined : String(Math.round(durationMs)),
      speaker: speaker || 'UNKNOWN',
    },
    files: { audio: file },
  }, { timeoutMs: SEGMENT_UPLOAD_TIMEOUT_MS });
}

/**
 * End the turn and stitch the transcript from whatever segments have landed.
 *
 * `generateReport: false` on purpose — the caller draws the draft itself with an explicit
 * `generate` call, whose outcome it can show. Leaving it true drafts twice.
 */
export function finishTurn(f2f, turnId, generateReport = false) {
  return staffApi.post(`${f2f}/turns/${turnId}/finish`, { generateReport });
}

/**
 * The stitched transcript.
 *
 * READ `labelledText`, NOT `text`. The response has always carried the speaker-tagged form
 * alongside the flat blob, and the web read straight past it for months — handing the model one
 * undifferentiated paragraph while instructing it to tell the counsellor's questions from the
 * student's answers. `distinctSpeakers` and `minorityShare` say how far the prompt should trust
 * those labels and must be forwarded to `generate`.
 */
export function fetchTranscript(f2f, turnId, signal) {
  return staffApi.get(`${f2f}/turns/${turnId}/transcript`, { signal });
}
