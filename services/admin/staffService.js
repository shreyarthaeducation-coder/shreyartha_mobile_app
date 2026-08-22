// services/admin/staffService.js
// Mirrors: frontendmain/src/School/Admin/pages/StaffManagement.js
// Backend: school/controller/SchoolAdminVerificationController.java — every method is
//          hasRole('SCHOOL_ADMIN'), so a Principal arrives through the role hierarchy
//          (SecurityConfig: PRINCIPAL implies SCHOOL_ADMIN) rather than by being named.
//
// This page verifies and unverifies the school's own staff. Until a staff member is verified their
// role is ROLE_UNVERIFIED_*, which is NOT in the role hierarchy at all — an unverified teacher
// reaches almost nothing. So the Verify button here is what actually turns a signup into a working
// account.

import { staffApi } from '../staffApi';

/** Status filter values. `pending` is a different ENDPOINT; the other two filter client-side. */
export const STAFF_STATUS = ['all', 'verified', 'pending'];

/**
 * Staff types offered as a filter, in the web's order.
 *
 * ADMIN is deliberately absent from the filter even though ADMIN rows appear in the list — the web
 * offers the same four. Note COUNSELOR has one L (the backend enum).
 */
export const STAFF_TYPES = ['all', 'PRINCIPAL', 'VICE_PRINCIPAL', 'TEACHER', 'COUNSELOR'];

/** Badge colours, verbatim from the web's `getUserTypeBadge`. */
export const STAFF_TYPE_COLOR = {
  TEACHER: '#3b82f6',
  COUNSELOR: '#8b5cf6',
  PRINCIPAL: '#ef4444',
  VICE_PRINCIPAL: '#f97316',
  ADMIN: '#10b981',
};

/** `VICE_PRINCIPAL` → `VICE PRINCIPAL`, as the web renders it. */
export const prettyStaffType = (userType) => String(userType || '').replace('_', ' ');

/**
 * The staff list for one status + type filter.
 *
 * `pending` hits a different endpoint; `verified` is the full list filtered client-side, exactly as
 * the web does it. The type filter is always client-side — there is no query parameter for it.
 *
 * @returns {Promise<Array<{ id, fullName, email, mobile, userType, verified }>>}
 */
export async function fetchStaff(apiBase, { status = 'all', userType = 'all' } = {}, signal) {
  const endpoint =
    status === 'pending'
      ? `${apiBase}/school-users/pending`
      : `${apiBase}/school-users`;
  const res = await staffApi.get(endpoint, { signal });
  let rows = Array.isArray(res) ? res : [];
  if (status === 'verified') rows = rows.filter((u) => u.verified);
  if (userType !== 'all') rows = rows.filter((u) => u.userType === userType);
  return rows;
}

/** POST with no body — the controller takes the id from the path. */
export function verifyStaff(apiBase, id) {
  return staffApi.post(`${apiBase}/school-users/${id}/verify`);
}

export function unverifyStaff(apiBase, id) {
  return staffApi.post(`${apiBase}/school-users/${id}/unverify`);
}

/**
 * A school admin cannot verify another ADMIN — the web prints "Requires System Admin" instead of
 * an action. Kept because the backend has no such guard: it would happily accept the call, so the
 * restriction only exists in the UI.
 */
export const canActOn = (user) => user?.userType !== 'ADMIN';
