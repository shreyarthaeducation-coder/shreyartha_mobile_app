// services/admin/adminAttendanceService.js
// Mirrors: frontendmain/src/School/Admin/pages/AdminStaffAttendance.js
// Backend: school/staffattendance/controller/StaffAttendanceController.java — the
//          /api/school-admin/staff-attendance block is hasRole('SCHOOL_ADMIN'), reached by a
//          Principal through the role hierarchy.
//
// NAMED adminAttendanceService BECAUSE THREE OTHER THINGS ARE ALREADY CALLED "attendance":
//   services/staffAttendanceService.js         the login punch-in/out (/api/staff/attendance/start)
//   services/teacher/selfAttendanceService.js  a staff member's OWN monthly sheet
//   services/teacher/attendanceService.js      marking STUDENT attendance
// This one is the school-wide view of everyone's login sessions.
//
// ── READ-ONLY, AND THAT IS WEB PARITY, NOT A GAP ────────────────────────────────────────────
// The web page hides its settings panel and its click-to-toggle override behind
//   const isAdmin = localStorage.getItem("schoolUserType") === "ROLE_SCHOOL_ADMIN";
// but SchoolAuthService stores the plain signup value — ADMIN / PRINCIPAL / TEACHER — and NEVER
// "ROLE_SCHOOL_ADMIN". So that flag is false for every role, and the override and settings are
// unreachable on the website by anybody. The flag's intent was to exclude the Principal, which is
// the role we are serving, so read-only is right here either way and no divergence is needed.
// `PUT /override` and `GET|PUT /settings` are therefore deliberately NOT wrapped below.
// **When SHREYARTHA_ADMIN is ported this stops being harmless — revisit it then.**

import { staffApi } from '../staffApi';

/** Role filter, verbatim from the web (values are ROLE_-prefixed; the DTO's are not). */
export const ATTENDANCE_ROLES = [
  { value: 'ALL', label: 'All roles' },
  { value: 'ROLE_TEACHER', label: 'Teacher' },
  { value: 'ROLE_COUNSELOR', label: 'Counselor' },
  { value: 'ROLE_PRINCIPAL', label: 'Principal' },
  { value: 'ROLE_VICE_PRINCIPAL', label: 'Vice Principal' },
  { value: 'ROLE_SCHOOL_ADMIN', label: 'School Admin' },
];

/** Both prefixed and bare spellings appear in responses, so both are mapped. */
const ROLE_LABELS = {
  ROLE_TEACHER: 'Teacher',
  ROLE_COUNSELOR: 'Counselor',
  ROLE_PRINCIPAL: 'Principal',
  ROLE_VICE_PRINCIPAL: 'Vice Principal',
  ROLE_SCHOOL_ADMIN: 'School Admin',
  TEACHER: 'Teacher',
  COUNSELOR: 'Counselor',
  PRINCIPAL: 'Principal',
  VICE_PRINCIPAL: 'Vice Principal',
  SCHOOL_ADMIN: 'School Admin',
  ADMIN: 'School Admin',
};

export const roleLabel = (role) => ROLE_LABELS[role] || role || '—';

const roleQuery = (role) => (role && role !== 'ALL' ? `&role=${encodeURIComponent(role)}` : '');

/**
 * Every login session in the month.
 *
 * @returns {Promise<Array<{ name, email, role, schoolCode, loginAt, logoutAt,
 *   loginLocation, logoutLocation, durationMinutes, status: 'PRESENT'|'INCOMPLETE'|string }>>}
 */
export async function fetchStaffSessions(apiBase, { year, month, role }, signal) {
  const res = await staffApi.get(
    `${apiBase}/sessions?year=${year}&month=${month}${roleQuery(role)}`,
    { signal },
  );
  return Array.isArray(res) ? res : [];
}

/**
 * The month grid: one row per staff member, one column per date.
 *
 * TWO SPELLINGS FOR EVERY FIELD. The web reads `staffMembers || staff`, `staffName || name` and
 * `staffEmail || email` — the DTO has evidently changed shape at some point and the page kept both
 * readers. Normalised here once so the screen sees one shape.
 *
 * @returns {Promise<{ year, monthName, dates: string[], staff: Array<{ id, name, role,
 *   attendance: Record<string, 'PRESENT'|'ABSENT'|true|null> }> }>}
 */
export async function fetchStaffAttendanceCalendar(apiBase, { year, month, role }, signal) {
  const res = await staffApi.get(
    `${apiBase}/calendar?year=${year}&month=${month}${roleQuery(role)}`,
    { signal },
  );
  const rows = res?.staffMembers || res?.staff || [];
  return {
    year: res?.year || year,
    monthName: res?.monthName || '',
    dates: Array.isArray(res?.dates) ? res.dates : [],
    staff: rows.map((member, index) => ({
      id: member.staffId || member.staffEmail || member.email || index,
      name: member.staffName || member.name || '—',
      email: member.staffEmail || member.email || '',
      role: member.role,
      attendance: member.attendance || {},
    })),
  };
}

/** `true` is an accepted synonym for PRESENT in the calendar map — the web checks for both. */
export const isPresent = (value) => value === 'PRESENT' || value === true;
export const isAbsent = (value) => value === 'ABSENT';

/** Per-member present / absent / percentage over the month, as the web's summary columns. */
export function summarise(member, dates) {
  let present = 0;
  let absent = 0;
  for (const date of dates) {
    const value = member.attendance?.[date];
    if (isPresent(value)) present += 1;
    else if (isAbsent(value)) absent += 1;
  }
  const marked = present + absent;
  return { present, absent, percent: marked > 0 ? Math.round((present / marked) * 100) : 0 };
}

/** `1h 20m` from either field the DTO might carry. */
export function formatDuration(record) {
  let minutes = null;
  if (record?.durationMinutes != null) minutes = record.durationMinutes;
  else if (record?.durationMs != null) minutes = Math.floor(record.durationMs / 60000);
  if (minutes == null || Number.isNaN(minutes)) return '—';
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

/** The location blob is either a string or a `{status, lat, lng, message}` object. */
export function formatLocation(loc) {
  if (!loc) return '—';
  if (typeof loc === 'string') return loc || '—';
  if (loc.status === 'ok') {
    const lat = typeof loc.lat === 'number' ? loc.lat.toFixed(4) : '?';
    const lng = typeof loc.lng === 'number' ? loc.lng.toFixed(4) : '?';
    return `${lat}, ${lng}`;
  }
  if (loc.status === 'denied') return 'Location denied';
  if (loc.status === 'unavailable') return 'Unavailable';
  return loc.message || loc.status || '—';
}
