// services/staff/studentStatusService.js
//
// Student Status (10 Oct 2026): how far a section's students have got, one level at a time.
// Backend: studentstatus/controller/StudentStatusController.java — every school staff role may call
// it; which sections each may open is decided by the server (StaffScopeService), by account type.

import { staffApi } from '../staffApi';

const BASE = '/api/staff/student-status';

/** `[{ schoolCode, schoolName, classes: [{ classId, className, sections: [{ sectionId, sectionName }] }] }]` */
export function fetchStudentStatusScope(signal) {
  return staffApi.get(`${BASE}/scope`, { signal });
}

/** One level ("node") of one section's table: `{ path, columns, students, summary, notes, … }`. */
export function fetchStudentStatusTable(sectionId, node, signal) {
  return staffApi.get(`${BASE}/sections/${sectionId}`, { params: { node: node || 'overview' }, signal });
}

/**
 * One student of the section, gathered for charts ("View insights", 14 Oct 2026):
 * `{ student, areas, exams, syllabus, progress, understanding }`. 404 when the student is not on
 * the section's roster; 403 outside this member of staff's scope.
 */
export function fetchStudentInsights(sectionId, studentId, signal) {
  return staffApi.get(`${BASE}/sections/${sectionId}/students/${studentId}/insights`, { signal });
}
