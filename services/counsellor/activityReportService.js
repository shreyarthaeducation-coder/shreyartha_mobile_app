// services/counsellor/activityReportService.js
// Mirrors: frontendmain/src/School/shared/F2F/ActivityReportPanel.js, ActivityReportGrid.js,
//          PostSessionWrapUp.js
// Backend:  counsellingactivity/controller/CounselorActivityReportController.java  (COUNSELOR)
//           counsellingactivity/controller/Shreya01ActivityReportController.java   (SHREYARTHA_*)
//
// The counselling sheet — the ten printed columns plus the four AI-written narratives that make up
// section 11, "Griffin". Every function takes `apiBase`, the portal's `activityReports` root.
//
// ══ THE SHEET SCHEMA IS ALREADY PORTED — DO NOT RE-DERIVE IT ═══════════════
// `constants/counsellorReportConfig.js` holds REPORT_SECTIONS, GRIFFIN_SECTION_KEY, GRIFFIN_KEYS
// and `splitForm()`, verbatim from the web. `splitForm` is not optional: the four narrative fields
// are top-level on the request, NOT nested under `griffin`, and sending the whole form as
// `formData` writes the narrative into the wrong column.

import { staffApi } from '../staffApi';
import { splitForm } from '../../constants/counsellorReportConfig';

// ─── Reading ────────────────────────────────────────────────────────────────

/**
 * The counselling sheet: every report in a date range.
 *
 * `liveSessionId` narrows it to one session, which is how the Previous-sessions tab finds the
 * reports written during a particular room.
 */
export function fetchReports(apiBase, { from, to, status, classId, liveSessionId } = {}, signal) {
  return staffApi.get(`${apiBase}/reports`, {
    params: {
      from: from || undefined,
      to: to || undefined,
      status: status || undefined,
      classId: classId || undefined,
      liveSessionId: liveSessionId || undefined,
    },
    signal,
  });
}

export function fetchReport(apiBase, reportId, signal) {
  return staffApi.get(`${apiBase}/reports/${reportId}`, { signal });
}

// ─── Writing ────────────────────────────────────────────────────────────────

/**
 * Create or update one report.
 *
 * The FIRST save creates the row and returns its id; every later save is a PUT. That ordering is
 * why the live session holds `reportId` inside its `active` student object — a report id that
 * outlived the student it belongs to would attach the next child's autosave to the previous
 * child's row.
 *
 * `splitForm` separates the ten sections (which go in `formData`) from the four narrative fields
 * (which are top-level). See the config's own note.
 */
export function saveReport(apiBase, reportId, { form, ...rest }) {
  const { formData, griffin } = splitForm(form || {});
  const body = { ...rest, ...griffin, formData };
  return reportId
    ? staffApi.put(`${apiBase}/reports/${reportId}`, body)
    : staffApi.post(`${apiBase}/reports`, body);
}

/**
 * Draft the four narrative fields from what was actually said.
 *
 * ══ THE TRANSCRIPT MUST BE PASSED EXPLICITLY ═══════════════════════════════
 * `generate` reads only `transcript` and `typedObservation`. It does NOT resolve `f2fTurnId` back
 * to the turn — `counsellingactivity` deliberately imports nothing from `facetoface`, which is why
 * that id is a bare Long there. Omit the transcript and the recording is uploaded, transcribed,
 * billed and then ignored, and the model drafts from the notes box alone.
 *
 * ══ THE NOTES GO ALONGSIDE, NOT INSTEAD ════════════════════════════════════
 * `typedObservation` is sent with the transcript, not as a fallback for it. The server used to
 * collapse the two and keep only the transcript, which made the notes box a promise it did not
 * keep — the counsellor's own interpretation is the best proxy for how they would have written it.
 *
 * ══ IT ALWAYS RETURNS 200 ══════════════════════════════════════════════════
 * `{success, aiAvailable, report, missingSignals, message?}`. `aiAvailable: false` covers three
 * different situations — nothing to write from, the model refused, the model was unreachable — and
 * the server distinguishes them in `message`. Show that message rather than inventing one.
 */
export function generateReport(apiBase, body) {
  return staffApi.post(`${apiBase}/reports/generate`, body);
}

/**
 * Publish, and it is a deliberate act.
 *
 * Nothing generated is visible to a parent or teacher until this runs — the draft/published gate
 * is the reason an AI narrative about a child cannot reach a parent by autosave.
 */
export function publishReport(apiBase, reportId) {
  return staffApi.post(`${apiBase}/reports/${reportId}/publish`, {});
}

export function unpublishReport(apiBase, reportId) {
  return staffApi.post(`${apiBase}/reports/${reportId}/unpublish`, {});
}

// ─── Post-session wrap-up ───────────────────────────────────────────────────

/** The roster for one finished session, with whatever was already recorded against each student. */
export function fetchWrapUpStudents(apiBase, { source = 'LIVE', sessionId }, signal) {
  return staffApi.get(`${apiBase}/wrap-up/students`, { params: { source, sessionId }, signal });
}

/**
 * Attendance + counselling notes for a whole roster, in one call.
 *
 * Always answers 200 with a per-student `results` array: one student failing must not lose the
 * other twenty-nine entries the counsellor just typed. Read `results` rather than trusting the
 * status.
 */
export function saveWrapUp(apiBase, body) {
  return staffApi.post(`${apiBase}/wrap-up`, body);
}
