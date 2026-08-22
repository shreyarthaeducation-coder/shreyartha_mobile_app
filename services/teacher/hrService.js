// services/teacher/hrService.js
// Mirrors: frontendmain/src/School/shared/hr/hrApi.js (`hrStaffApi`)
// Backend: hr/controller/StaffHrController.java
//
// EVERY FAILURE FROM THIS CONTROLLER IS HTTP 400 with {success:false, message} — including
// not-found and ownership violations. Its `handle()` wrapper catches bare `Exception`, so there is
// no 404, no service-level 403 and no 500. Never branch on the status code here; read `message`.

import { staffApi } from '../staffApi';

const STAFF = '/api/staff/hr';

export const LEAVE_STATUS_TONE = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  WITHDRAWN: 'neutral',
  CANCELLED: 'neutral',
};

// ── leave ───────────────────────────────────────────────────────────────────

/**
 * Balance per leave type for a leave year.
 *
 * Unlimited types (Loss of Pay) come back with `unlimited: true`, `available: null` and no
 * used/pending/adjusted keys — render them without a meter.
 *
 * @returns {Promise<Array<{ leaveTypeId, code, name, annualQuota, accrualMode, opening, accrued,
 *   used, pending, adjusted, available, leaveYear, unlimited? }>>}
 */
export async function fetchLeaveBalances(leaveYear, signal) {
  const res = await staffApi.get(`${STAFF}/leave/balances`, {
    params: { leaveYear },
    signal,
  });
  return Array.isArray(res) ? res : [];
}

/**
 * The staff member's leave requests, newest start-date first.
 *
 * Note this is **not** filtered by leave year — the endpoint takes no parameter and returns every
 * request ever made, so the year selector on the Balances tab does not narrow this list.
 */
export async function fetchLeaveRequests(signal) {
  const res = await staffApi.get(`${STAFF}/leave/requests`, { signal });
  return Array.isArray(res) ? res : [];
}

/**
 * Apply for leave.
 *
 * The server rejects a good deal the client cannot easily pre-check: a request that **spans the
 * 31 March leave-year boundary**, one that overlaps an existing PENDING/APPROVED request, a
 * half-day on a type that doesn't allow it, and anything over `maxConsecutiveDays`. Surface the
 * returned `message` rather than a generic string — the web swallows it and shows "Could not
 * apply", which tells the teacher nothing.
 *
 * @param {{ leaveTypeCode, startDate, endDate, halfDayStart, halfDayEnd, reason,
 *           contactDuringLeave }} payload  dates are `YYYY-MM-DD`
 */
export function applyLeave(payload) {
  return staffApi.post(`${STAFF}/leave/requests`, payload);
}

/** Only a PENDING request can be withdrawn; the server re-checks ownership and status. */
export function withdrawLeave(id) {
  return staffApi.del(`${STAFF}/leave/requests/${id}`);
}

/**
 * Calendar days between two dates, minus half-days. Matches the web's live estimate — and note it
 * is calendar days: **weekends and holidays are not excluded**, because the platform has no
 * per-school working-day calendar.
 */
export function estimateLeaveDays({ startDate, endDate, halfDayStart, halfDayEnd }) {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  if (startDate === endDate) return halfDayStart || halfDayEnd ? 0.5 : 1;
  const days = Math.round((end - start) / 86400000) + 1;
  return days - (halfDayStart ? 0.5 : 0) - (halfDayEnd ? 0.5 : 0);
}

// ── payroll ─────────────────────────────────────────────────────────────────

/**
 * Payslips for a financial year, newest first.
 *
 * **Only payslips from a published payroll run are returned** — a draft run is invisible to staff
 * by design, so an empty list is a normal state, not an error.
 *
 * @returns {Promise<{ financialYears: string[], payslips: object[] }>}
 */
export async function fetchPayslips(fy, signal) {
  const res = await staffApi.get(`${STAFF}/payslips`, { params: { fy }, signal });
  return {
    financialYears: Array.isArray(res?.financialYears) ? res.financialYears : [],
    payslips: Array.isArray(res?.payslips) ? res.payslips : [],
  };
}

/** The path `utils/downloadFile.js` fetches. Returns real PDF bytes — but JSON on failure. */
export const payslipPdfPath = (id) => `${STAFF}/payslips/${id}/pdf`;

// ── employee profile (the My Profile HR tab) ────────────────────────────────

export function fetchHrProfile(signal) {
  return staffApi.get(`${STAFF}/profile`, { signal });
}

export function saveHrProfile(payload) {
  return staffApi.put(`${STAFF}/profile`, payload);
}

export async function fetchPtStates(signal) {
  const res = await staffApi.get(`${STAFF}/pt-states`, { signal });
  return Array.isArray(res) ? res : [];
}

export function fetchTaxDeclaration(fy, signal) {
  return staffApi.get(`${STAFF}/tax-declaration`, { params: { fy }, signal });
}

export function saveTaxDeclaration(fy, payload) {
  return staffApi.put(`${STAFF}/tax-declaration`, payload, { params: { fy } });
}

export function uploadHrPhoto(file) {
  return staffApi.multipart(`${STAFF}/profile/photo`, { files: { file } });
}

/**
 * Save the HR tab.
 *
 * SEQUENTIAL AND ORDER-DEPENDENT, not `Promise.all`. The profile carries the tax regime and must
 * land first; the declaration then writes its own copy over the top. Reversing them lets the
 * profile's stale regime win.
 */
export async function saveHrTab(fy, profile, declaration) {
  await saveHrProfile(profile);
  return saveTaxDeclaration(fy, declaration);
}

export const TAX_REGIMES = [
  { value: 'NEW', label: 'New regime' },
  { value: 'OLD', label: 'Old regime' },
];

export const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
