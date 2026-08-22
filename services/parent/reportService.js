// services/parent/reportService.js
// Mirrors: Parent/platform/pages/ParentCounsellorReport.js
// Backend: parent/controller/ParentDashboardController.java → getCounsellorReports
//
// ONE CALL, NO PARAMETERS. The controller takes only `Principal`; the child comes from
// `resolveLinkedStudent(parentEmail)` and the repository query is
// `findByStudent_IdOrderByReportDateDesc` — newest first, and structurally impossible to point at
// another family's child. (The teacher's equivalent DOES take a studentId, which is why its query
// carries an extra school-code guard.)
//
// A parent with no linked child gets 404 + `{success:false, message}`, which `parentApi` turns into
// a renderable error. The web instead runs the body through `Array.isArray(data) ? data : []`, so
// that case collapses into its friendly "no reports yet" empty state and the real reason — no child
// linked — never reaches the parent. We surface the message.

import { parentApi } from '../parentApi';

/**
 * Every counsellor report shared for the linked child, newest first.
 *
 * @returns {Promise<Array<{ id, counsellorName, className, sectionName, yearLabel, reportDate,
 *   formData, overallPerformance, learningGaps, careerClarity, counsellorRemarks,
 *   createdAt, updatedAt }>>}
 *
 * `formData` is the raw JSON string of the ten-section form, passed through unfiltered — the
 * parent DTO narrows the ENVELOPE (it drops eight counsellor-side internals) but never the form
 * body. `components/staff/counsellor/ReportBody.js` parses and renders it for both portals.
 */
export async function fetchCounsellorReports(signal) {
  const res = await parentApi.get('/api/parent/dashboard/counsellor-reports', { signal });
  return Array.isArray(res) ? res : [];
}
