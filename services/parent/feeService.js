// services/parent/feeService.js
// Mirrors: Parent/platform/pages/ParentFees.js + frontendmain/src/services/parentFeeApi.js
// Backend: schoolfee/controller/ParentFeeController.java
//
// THE STRICTEST PARENT ENDPOINTS. `resolveStudentId` refuses in three distinct ways, all as
// renderable messages rather than empty data:
//   403 "Parent not found"        the email is not a parent at all
//   403 "Account not yet verified" the parent exists but an admin has not verified them
//   404 "No linked student found"  verified, but no child is linked yet
// `parentApi` keeps all three renderable — through `apiService` the 403s would end the session.
//
// PAYMENT IS WEBHOOK-CONFIRMED. `SchoolFeeWebhookController` handles Razorpay's `payment.captured`
// and flips the payment to CAPTURED, the installment to PAID and the record's paidAmount. There is
// **no client verify endpoint** for school fees anywhere. So after checkout the client just
// refetches — and must tolerate the webhook not having landed yet.

import { parentApi } from '../parentApi';

/** `2026-27` — the shape the backend matches on, by exact string equality. */
export function defaultAcademicYear(now = new Date()) {
  const year = now.getFullYear();
  return `${year}-${String(year + 1).slice(-2)}`;
}

/**
 * Fee status for one academic year.
 *
 * TWO COMPLETELY DIFFERENT SHAPES. With no record for that year the response is a single key —
 * `{ enrolled: false }` — not a stub with zeroed totals. Reading `totalAmount` without checking
 * `enrolled` first yields `undefined`, which then formats as "-" rather than "₹0".
 *
 * The year is matched by EXACT STRING EQUALITY server-side, so `2025-26` and `2025-2026` are
 * different years and the second finds nothing.
 *
 * @returns {Promise<{ enrolled: false } | {
 *   enrolled: true, recordId, academicYear, totalAmount, paidAmount, remainingAmount,
 *   status: 'PENDING'|'PARTIAL'|'PAID'|'OVERDUE',
 *   installments: Array<{ id, installmentNumber, dueDate, amount, status, paidAt }>,
 *   nextDueDate: string|null, nextDueAmount: number|null, nextInstallmentId: number|null }>}
 */
export function fetchFeeStatus(academicYear, signal) {
  return parentApi.get('/api/parent/fees/status', {
    params: { academicYear },
    signal,
  });
}

/**
 * Payments made for this child.
 *
 * RETURNS THE JPA ENTITY, not a DTO, and only `CAPTURED` rows — a pending or failed payment never
 * appears. Each row carries a nested `feeRecord` object that is not useful here.
 *
 * ONLINE payments never set `paymentDate` (only offline ones do), so the date has to fall back to
 * `createdAt` — see `paymentDate()` below.
 */
export async function fetchPaymentHistory(signal) {
  const res = await parentApi.get('/api/parent/fees/history', { signal });
  return Array.isArray(res) ? res : [];
}

/**
 * Start an online payment.
 *
 * Persists a PENDING `SchoolFeePayment` row with the Razorpay order id and a generated receipt
 * number, then returns `{ orderId, keyId, amount, currency, paymentRecordId }` — **`amount` is in
 * PAISE**.
 *
 * Not used by the native screen today: the checkout runs in the WebView on the website's own fees
 * page, which creates its own order. Kept because it is the endpoint a future native SDK would
 * call, and because it documents the paise unit.
 */
export function initiatePayment(installmentId) {
  return parentApi.post('/api/parent/fees/initiate-payment', { installmentId });
}

/* ── Readers ─────────────────────────────────────────────────────────────── */

/**
 * Percent paid, 0–100.
 *
 * The web computes `Math.round(paid / total * 100)` for its label and clamps only the bar width, so
 * an overpaid record prints "104% paid", and a zero-total record prints "NaN%". Both are guarded
 * here.
 */
export function paidPercent(status) {
  const total = Number(status?.totalAmount) || 0;
  if (total <= 0) return 0;
  const paid = Number(status?.paidAmount) || 0;
  return Math.max(0, Math.min(100, Math.round((paid / total) * 100)));
}

/**
 * The date to show for a payment row.
 *
 * `paymentDate` is only set for OFFLINE payments, so ONLINE ones fall back to `createdAt` — an
 * `Instant`, which Jackson may emit as an ISO string OR as an epoch number depending on config.
 * The web's `createdAt.split("T")` breaks on the numeric form; this handles both.
 */
export function paymentDate(payment) {
  if (payment?.paymentDate) return String(payment.paymentDate).slice(0, 10);
  const created = payment?.createdAt;
  if (!created) return '';
  if (typeof created === 'number') {
    const d = new Date(created < 1e12 ? created * 1000 : created);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }
  return String(created).slice(0, 10);
}

/**
 * Chip tone per status, covering BOTH enums — the two overlap but are not the same set.
 *   FeeStatus         PENDING PARTIAL PAID OVERDUE
 *   InstallmentStatus UPCOMING DUE    PAID OVERDUE
 * `DUE` is kept even though nothing in the fee module currently writes it; the admin structure
 * service may.
 */
export function statusTone(status) {
  switch (status) {
    case 'PAID':
      return 'success';
    case 'OVERDUE':
      return 'error';
    case 'PARTIAL':
    case 'DUE':
      return 'warning';
    default:
      // PENDING, UPCOMING and anything unrecognised.
      return 'neutral';
  }
}

/** An installment can still be paid unless it is already settled. */
export const isPayable = (installment) => installment?.status !== 'PAID';
