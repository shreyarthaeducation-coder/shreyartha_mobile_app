/**
 * A class teacher's report cards for their own section — the website's TeacherReportCardPanel
 * (21 Oct 2026). The server checks on every request that this teacher is the section's class
 * teacher and that the school has shared its cards.
 */
import { staffApi } from '../staffApi';

/** The sections this teacher is class teacher of: `[{ sectionId, reportViewEnabled, ... }]`. */
export async function fetchMyClassTeacherSections(academicYearId, signal) {
  const res = await staffApi.get('/api/teacher/class-teacher/mine', { params: { academicYearId }, signal });
  return Array.isArray(res) ? res : [];
}

/** The section's cards: `{ sectionId, className, sectionName, terms, subjects, students }`. */
export function fetchReportCardSheet(sectionId, signal) {
  return staffApi.get('/api/teacher/report-cards/sheet', { params: { sectionId }, signal });
}

/**
 * One child's remark and promoted-to class. Both always go together: the server keeps them on one
 * row, so sending only the field that changed would blank the other.
 */
export function saveReportCardRemark(sectionId, studentId, remarks, promotedTo) {
  return staffApi.put('/api/teacher/report-cards/remarks', { sectionId, studentId, remarks, promotedTo });
}
