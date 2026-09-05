// services/counsellor/reportService.js
// Mirrors: frontendmain/src/School/shared/CounsellorReport.js (role="counselor" | "shreya01")
// Backend: counsellorreport/controller/CounselorReportController.java        (COUNSELOR)
//          counsellorreport/controller/Shreya01CounsellorReportController.js (SHREYARTHA_COUNCELLOR)
//
// Both controllers expose identical paths and identical DTOs; only the prefix differs, which is
// why the whole authoring screen is portal-agnostic and takes `apiBase`.

import { staffApi } from '../staffApi';
import { extractScalars, splitForm } from '../../constants/counsellorReportConfig';

/**
 * School → Class → Year → [Section].
 *
 * ONE SHAPE, TWO POPULATIONS — `CounsellorReportTreeService`:
 *   • school-bound: exactly ONE root (the counsellor's own school), built from CounselorClass
 *     rows, so only the sections they are ASSIGNED appear.
 *   • Shreyartha: one root PER LINKED SCHOOL (falling back to the counsellor's own school code
 *     when no links exist), built from every active class, and `sections` is ALWAYS [].
 *
 * Two traps in the shape itself:
 *   1. `classId` lives on the YEAR node, not the class node — one className spans several years
 *      and each is a different SchoolClass row.
 *   2. A class with no academic year lands under a single `UNASSIGNED` year, so `yearLabel` is not
 *      always a real year. Render it as "Year not set".
 *
 * @returns {Promise<Array<{ schoolId, schoolName, schoolCode, classes: Array<{ className,
 *   years: Array<{ academicYearId, yearLabel, isCurrent, classId, sections: Array<{sectionId, sectionName}> }> }> }>>}
 */
export async function fetchReportTree(apiBase, signal) {
  const res = await staffApi.get(`${apiBase}/tree`, { signal });
  return Array.isArray(res) ? res : [];
}

/** The roster for one tree leaf. `sectionName` is omitted entirely in the Shreyartha portal. */
export async function fetchReportStudents({ apiBase, classId, sectionName, yearLabel }, signal) {
  const res = await staffApi.get(`${apiBase}/students`, {
    params: { classId, sectionName: sectionName || undefined, yearLabel },
    signal,
  });
  return Array.isArray(res) ? res : [];
}

/**
 * One student's report for a year, or null when none exists.
 *
 * THE ENDPOINT RETURNS `{}` — an empty object — when there is no report, not 404 and not null
 * (`ResponseEntity.ok(report != null ? report : Map.of())`). A truthiness check passes on `{}`,
 * so the only safe test is for a real field.
 */
export async function fetchReport({ apiBase, studentId, yearLabel }, signal) {
  const res = await staffApi.get(`${apiBase}/report`, {
    params: { studentId, yearLabel },
    signal,
  });
  return res && res.id ? res : null;
}

/**
 * Create or update, recovering from the duplicate case.
 *
 * ### This deliberately improves on the web
 *
 * `POST /report` throws `ReportAlreadyExistsException`, which the controller answers as a 400
 * carrying **`existingReportId`** in the body — deliberately, so a client can recover. The web
 * ignores it and renders the raw message, which dead-ends the counsellor: a report exists, the
 * form will not save, and nothing offers a way forward. That happens whenever the client's
 * `existingReportId` is stale or was never set (e.g. the GET above ran with a different
 * `yearLabel`).
 *
 * We retry as a PUT against the id the server just handed us. Strictly additive: the alternative
 * is a stuck form.
 *
 * The payload nests `formData` AND spreads `extractScalars(form)`. Both are correct here — the
 * four scalars are real columns as well as blob members. This is NOT the counselling-session bug.
 *
 * ### `splitForm` is load-bearing, not tidiness
 *
 * The report spans two tables. Sections 1–10 are JSON in `counsellor_reports.form_data`; section
 * 11 (the AI narrative) is a row of `counselling_activity_reports`, which has its own
 * DRAFT/PUBLISHED gate.
 *
 * Sending the WHOLE form as `formData` — which is what this did before section 11 existed — would
 * write the six narrative keys into the wrong table, bypass that gate entirely, and leave the
 * real narrative row untouched. The result reads differently on web and mobile, and an unreviewed
 * AI draft about a child becomes parent-visible. Do not "simplify" this back to `formData: form`.
 */
export async function saveReport({ apiBase, reportId, studentId, leaf, form }) {
  const { formData, griffin } = splitForm(form);

  const payload = {
    studentId,
    classId: leaf.classId,
    yearLabel: leaf.yearLabel,
    sectionName: leaf.sectionName || '',
    formData,
    griffin,
    ...extractScalars(form),
  };

  if (reportId) {
    return staffApi.put(`${apiBase}/report/${reportId}`, payload);
  }

  try {
    return await staffApi.post(`${apiBase}/report`, payload);
  } catch (e) {
    const existing = e?.payload?.existingReportId;
    if (existing) {
      return staffApi.put(`${apiBase}/report/${existing}`, payload);
    }
    throw e;
  }
}
