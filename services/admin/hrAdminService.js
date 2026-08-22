// services/admin/hrAdminService.js
// Mirrors: frontendmain/src/School/shared/hr/hrApi.js → `hrAdminApi`
// Backend: hr/controller/SchoolAdminHrController.java
//          @RequestMapping("/api/school-admin/hr")
//          @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','VICE_PRINCIPAL')") at CLASS level.
//
// ── THIS IS THE APPROVER HALF. services/teacher/hrService.js IS THE OTHER ONE ────────────────
// Two namespaces, two audiences, and mixing them is the mistake to avoid:
//
//   /api/staff/hr          MY leave, MY payslips, MY tax declaration  → services/teacher/hrService
//   /api/school-admin/hr   EVERYONE's leave queue, salaries, payroll  → this file
//
// They share verbs ("leave/requests", "payslips/{id}/pdf") and differ only in the prefix, so a
// stray edit here silently shows a principal their own leave instead of the queue they are meant to
// approve. Neither call errors; the screen just quietly answers the wrong question.
//
// ── WHO REACHES IT ──────────────────────────────────────────────────────────────────────────
// PRINCIPAL, via `role("PRINCIPAL").implies("SCHOOL_ADMIN")` in SecurityConfig's roleHierarchy,
// and VICE_PRINCIPAL, which the guard names outright. The website mounts these screens on neither
// dashboard — only on SCHOOL_ADMIN's — which is the gap this module exists to close.

import { staffApi } from '../staffApi';

const ADMIN = '/api/school-admin/hr';

/* ── Leave ─────────────────────────────────────────────────────────────────────────────────── */

/**
 * "Everything" is the literal string ALL, and it must be sent.
 *
 * `HrLeaveService.schoolRequests` treats null, blank AND "ALL" as unfiltered — but the CONTROLLER
 * declares `defaultValue = "PENDING"`, so an omitted param never reaches that branch. And
 * `staffApi`'s `buildQuery` drops empty strings. So passing '' would silently return the pending
 * queue on a tab labelled "All Requests" — no error, just the wrong list.
 */
export const LEAVE_STATUS_ALL = 'ALL';

/**
 * The leave queue, filtered by status.
 *
 * @param {'PENDING'|'APPROVED'|'REJECTED'|'WITHDRAWN'|'ALL'} status
 */
export function fetchLeaveRequests(status = 'PENDING', signal) {
  const value = status && String(status).trim() ? String(status).trim() : LEAVE_STATUS_ALL;
  return staffApi.get(`${ADMIN}/leave/requests`, { params: { status: value }, signal });
}

/**
 * Approve or reject one request.
 *
 * @param {number} id
 * @param {'APPROVE'|'REJECT'} action
 * @param {string} remarks visible to the requester
 */
export function decideLeave(id, action, remarks) {
  return staffApi.post(`${ADMIN}/leave/requests/${id}/decision`, { action, remarks });
}

/** The school's leave policy — the types and their annual entitlements. Read-only on this screen. */
export function fetchLeaveTypes(signal) {
  return staffApi.get(`${ADMIN}/leave/types`, { signal });
}

/**
 * Every staff member's balances for a leave year.
 *
 * `leaveYear` is optional; omitted, the server picks the current one. The HR year runs **April to
 * March** and unused leave lapses at the boundary, so the year is never a calendar year.
 */
export function fetchAllBalances(leaveYear, signal) {
  return staffApi.get(`${ADMIN}/leave/balances`, {
    params: leaveYear ? { leaveYear } : undefined,
    signal,
  });
}

/** Manually credit or debit one person's balance, with a reason. */
export function adjustBalance(schoolUserId, payload) {
  return staffApi.post(`${ADMIN}/leave/balances/${schoolUserId}/adjust`, payload);
}

/* ── Employees and salary ──────────────────────────────────────────────────────────────────── */

/** Everyone on the payroll for this school. */
export function fetchEmployees(signal) {
  return staffApi.get(`${ADMIN}/employees`, { signal });
}

export function fetchEmployeeProfile(schoolUserId, signal) {
  return staffApi.get(`${ADMIN}/employees/${schoolUserId}/profile`, { signal });
}

export function saveEmployeeProfile(schoolUserId, payload) {
  return staffApi.put(`${ADMIN}/employees/${schoolUserId}/profile`, payload);
}

export function fetchSalaryStructure(schoolUserId, signal) {
  return staffApi.get(`${ADMIN}/employees/${schoolUserId}/salary-structure`, { signal });
}

export function saveSalaryStructure(schoolUserId, payload) {
  return staffApi.put(`${ADMIN}/employees/${schoolUserId}/salary-structure`, payload);
}

/**
 * Break a monthly gross into its components before committing it.
 *
 * ALL THREE PARAMS ARE SENT, ALWAYS. `includeConveyance` defaults to **true** on the web, and
 * `metro` changes the HRA slab — omitting either does not error, it returns a different salary. The
 * booleans are stringified explicitly because the web sends `true`/`false`, not `1`/`0`.
 */
export function previewSalary({ monthlyGross, metro, includeConveyance = true }, signal) {
  return staffApi.get(`${ADMIN}/salary-preview`, {
    params: {
      monthlyGross,
      metro: String(!!metro),
      includeConveyance: String(!!includeConveyance),
    },
    signal,
  });
}

/* ── Payroll runs ──────────────────────────────────────────────────────────────────────────── */

export function fetchPayrollRuns(signal) {
  return staffApi.get(`${ADMIN}/payroll/runs`, { signal });
}

/** Compute a month as a DRAFT. Nothing is released to staff until the run is locked. */
export function runPayroll(year, month) {
  return staffApi.post(`${ADMIN}/payroll/runs`, { year, month });
}

export function fetchPayrollRun(id, signal) {
  return staffApi.get(`${ADMIN}/payroll/runs/${id}`, { signal });
}

/** Locking is what publishes the payslips — it is the irreversible step, not "paid". */
export function lockPayrollRun(id) {
  return staffApi.put(`${ADMIN}/payroll/runs/${id}/lock`, {});
}

export function markPayrollRunPaid(id) {
  return staffApi.put(`${ADMIN}/payroll/runs/${id}/paid`, {});
}

/**
 * The path of one payslip's PDF, for `utils/downloadFile.js` `downloadAndShare`.
 *
 * Returned as a PATH rather than fetched, exactly as `services/teacher/hrService.payslipPdfPath`
 * does: the PDF is generated server-side and streamed, so the native side downloads and shares it
 * rather than rendering it. **Do not add a top-level `react-native-pdf` import** to anything that
 * reaches this — one did that once and boot-crashed every route in the app through the
 * `components/staff` barrel.
 */
export const adminPayslipPdfPath = (id) => `${ADMIN}/payslips/${id}/pdf`;
