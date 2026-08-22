// services/admin/schoolFeeAdminService.js
// Mirrors: frontendmain/src/services/schoolFeeApi.js
// Backend: schoolfee/controller/SchoolAdminFeeController.java
//          @RequestMapping("/api/school-admin/fees"), every method @PreAuthorize("hasRole('SCHOOL_ADMIN')")
//
// ── PRINCIPAL YES, VICE PRINCIPAL NO ────────────────────────────────────────────────────────
// A Principal reaches all of this through `role("PRINCIPAL").implies("SCHOOL_ADMIN")`. A Vice
// Principal does NOT: VICE_PRINCIPAL implies only TEACHER, and unlike SchoolAdminHrController this
// controller does not name it. So Fee Management must never appear on the VP menu — the screen
// would render and then 403 on every call. That asymmetry is asserted by scripts/checkadminhr.mjs.

import { staffApi } from '../staffApi';

const FEES = '/api/school-admin/fees';

/* ── Razorpay configuration (Setup tab) ────────────────────────────────────────────────────── */

export function fetchRazorpayConfig(signal) {
  return staffApi.get(`${FEES}/razorpay-config`, { signal });
}

export function saveRazorpayConfig(payload) {
  return staffApi.post(`${FEES}/razorpay-config`, payload);
}

/* ── Fee structures (Setup tab) ────────────────────────────────────────────────────────────── */

/**
 * `academicYear` matches by **exact string equality** server-side — "2025-26" is not "2025-2026".
 * The same trap the parent fee screen documents.
 */
export function fetchStructures(academicYear, signal) {
  return staffApi.get(`${FEES}/structures`, {
    params: academicYear ? { academicYear } : undefined,
    signal,
  });
}

export function createStructure(payload) {
  return staffApi.post(`${FEES}/structures`, payload);
}

export function updateStructure(id, payload) {
  return staffApi.put(`${FEES}/structures/${id}`, payload);
}

export function deleteStructure(id) {
  return staffApi.del(`${FEES}/structures/${id}`);
}

/** Attach a structure to students. Body is `{ studentIds }` — an array, even for one. */
export function assignStudents(structureId, studentIds) {
  return staffApi.post(`${FEES}/structures/${structureId}/assign-students`, { studentIds });
}

// THE ROSTER FOR THE ASSIGN PICKER IS NOT A FEE ROUTE, and it is not re-implemented here.
// `schoolFeeApi.getStudents` reaches for `/api/school-admin/classes/students`, which makes it look
// like part of this module; it is not. `services/admin/studentService.fetchStudents(apiBase)`
// already fetches exactly that from the descriptor's `classes` base and unwraps its
// `{ stats, students }` envelope — the screen calls that.

/* ── Records (Student Fees + Due & Overdue tabs) ───────────────────────────────────────────── */

export function fetchFeeDashboard(academicYear, signal) {
  return staffApi.get(`${FEES}/dashboard`, { params: { academicYear }, signal });
}

/**
 * @param {string} academicYear required
 * @param {'PAID'|'PARTIAL'|'PENDING'|'OVERDUE'|''} status optional filter
 */
export function fetchFeeRecords(academicYear, status, signal) {
  return staffApi.get(`${FEES}/records`, {
    params: status ? { academicYear, status } : { academicYear },
    signal,
  });
}

export function fetchFeeRecord(recordId, signal) {
  return staffApi.get(`${FEES}/records/${recordId}`, { signal });
}

/* ── Payments tab ──────────────────────────────────────────────────────────────────────────── */

/** Record a cash / cheque / bank-transfer payment taken outside Razorpay. */
export function logOfflinePayment(payload) {
  return staffApi.post(`${FEES}/payments/log-offline`, payload);
}

/**
 * ── A WEB BUG, NOT PORTED ───────────────────────────────────────────────────────────────────
 * `schoolFeeApi.updatePaymentNotes` calls **PUT**, but the controller declares
 * `@PatchMapping("/payments/{id}/notes")`. PUT on a PATCH-only mapping is a **405**, so editing a
 * payment's notes has never worked on the website. PATCH here, which is what the server accepts.
 */
export function updatePaymentNotes(paymentId, adminNotes) {
  return staffApi.patch(`${FEES}/payments/${paymentId}/notes`, { adminNotes });
}

/**
 * The payment ledger, optionally narrowed.
 *
 * `from`/`to` are plain calendar dates ("YYYY-MM-DD"). Build them from local fields — never
 * `toISOString()`, which shifts local midnight to the previous day in IST.
 */
export function fetchPayments({ mode, from, to } = {}, signal) {
  return staffApi.get(`${FEES}/payments`, { params: { mode, from, to }, signal });
}
