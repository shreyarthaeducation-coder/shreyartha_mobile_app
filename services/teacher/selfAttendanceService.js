// services/teacher/selfAttendanceService.js
// Mirrors: frontendmain/src/School/Teacher/pages/TeacherSelfAttendance.js
//
// The staff member's own monthly attendance sheet. NOT the same thing as
// services/staffAttendanceService.js, which pings /api/staff/attendance/start|end to open and
// close a session at login/logout, nor the /api/staff/attendance/calendar feed StaffMyCalendar
// overlays. This one is the manually-marked month sheet the web renders as a wide table.
//
// Backend: TeacherSelfAttendanceController. Its @PreAuthorize admits TEACHER, COUNSELOR,
// PRINCIPAL, VICE_PRINCIPAL, SCHOOL_ADMIN and all four SHREYARTHA_* roles, so one screen serves
// every staff shell. Every handler catches its own exceptions and answers 400 with
// { success, message } — only the guard itself can 403.

import { staffApi } from '../staffApi';

export const ATTENDANCE_STATUS = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
};

/**
 * The month sheet.
 *
 * `attendance` comes back pre-seeded with every date in the month (value null when unmarked), and
 * `dates` is the authoritative day list — build the calendar from it rather than from a local Date
 * loop.
 *
 * @param {number} year
 * @param {number} month 1-12 (the API is not 0-indexed)
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ teacherId: number, teacherName: string, year: number, month: number,
 *                     monthName: string, dates: string[],
 *                     attendance: Record<string, 'PRESENT'|'ABSENT'|null> }>}
 */
export function fetchSelfAttendanceSheet(year, month, signal) {
  return staffApi.get('/api/teacher/self-attendance/sheet', {
    params: { year, month },
    signal,
  });
}

/**
 * Mark or change one day. This is an upsert server-side — re-marking a date replaces the previous
 * value rather than adding a row.
 *
 * The service validates only that `status` is PRESENT or ABSENT: there is no server-side Sunday
 * lock and no future-date rule, so those stay the screen's responsibility (as they are on the web).
 *
 * @param {string} date "YYYY-MM-DD"
 * @param {'PRESENT'|'ABSENT'} status
 */
export function markSelfAttendance(date, status) {
  return staffApi.post('/api/teacher/self-attendance/mark', { date, status });
}
