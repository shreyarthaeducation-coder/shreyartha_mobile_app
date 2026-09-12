// services/admin/studentRosterService.js
// Mirrors: frontendmain/src/School/Admin/pages/ManageStudents.js
// Backend: school/controller/SchoolStudentRosterController.java
//          @RequestMapping("/api/school-admin/students")
//          @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
//
// NAMED studentRosterService BECAUSE services/admin/studentService.js ALREADY EXISTS — that one is
// the verify/approve queue for accounts that signed themselves up. This one is the other direction:
// a school putting its own roster in, per academic year and section.
//
// ── THE IMPORT IS TWO CALLS, AND THAT IS THE POINT ──────────────────────────
// `preview` parses the spreadsheet and says what WOULD happen to each row; `commit` performs only
// the rows the user kept. Nothing is written by the preview. The row statuses the server returns
// each imply one natural action:
//
//   NEW          a person we have never seen        -> CREATE  (account + school record)
//   RECORD_ONLY  no email, so no account is possible -> CREATE  (school record alone)
//   UPGRADE      a record-only child now has details -> UPGRADE (give them an account)
//   MATCH        already exists                      -> LINK    (attach to this section)
//   anything else                                    -> SKIP    (blocked; no natural action)
//
// A row the user excludes is sent with action SKIP rather than dropped, so the server sees the whole
// sheet and its row numbers still line up with what the person was looking at.

import { staffApi } from '../staffApi';
import { downloadAndShare } from '../../utils/downloadFile';

const BASE = '/api/school-admin/students';

/** The students already in one section: `[{ id, fullName, email, origin, accountStatus, ... }]`. */
export function fetchRoster(sectionId, signal) {
  return staffApi.get(`${BASE}/roster`, { params: { sectionId }, signal });
}

/**
 * Parses a spreadsheet WITHOUT writing anything.
 * `file` is `{ uri, name, type }` from utils/filePicker `pickFile`.
 * Returns `{ rows: [{ rowNumber, status, fullName, email, ... }], ... }`.
 */
export function previewStudentImport(academicYearId, file) {
  return staffApi.multipart(`${BASE}/import/preview`, {
    fields: { academicYearId },
    files: { file },
  });
}

/** Applies the kept rows. `rows` carries every parsed row, each with its chosen action. */
export function commitStudentImport(academicYearId, rows) {
  return staffApi.post(`${BASE}/import/commit`, { academicYearId, rows });
}

/** Saves the blank .xlsx and hands it to the OS share sheet. */
export function downloadImportTemplate() {
  return downloadAndShare(
    `${BASE}/import/template`,
    'student_import_template.xlsx',
    // The server sends a spreadsheet; anything else (a JSON error envelope) must not be saved
    // under an .xlsx name and handed to the user as if it were one.
    'spreadsheet',
  );
}

/** Accepted upload types, matching the website's `\.(xlsx|xls|csv)$` guard. */
export const IMPORT_FILE_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'text/comma-separated-values',
];

/** The action a row takes when it is included. SKIP means it cannot be acted on at all. */
export function naturalAction(row) {
  if (row?.status === 'NEW' || row?.status === 'RECORD_ONLY') return 'CREATE';
  if (row?.status === 'UPGRADE') return 'UPGRADE';
  if (row?.status === 'MATCH') return 'LINK';
  return 'SKIP';
}

/** What each status means in words, for a screen with no room for a legend. */
export const STATUS_TEXT = {
  NEW: { label: 'New student', tone: 'success', note: 'An account and a school record are created.' },
  RECORD_ONLY: { label: 'Record only', tone: 'neutral', note: 'No email, so a school record without a login.' },
  UPGRADE: { label: 'Gains a login', tone: 'success', note: 'An existing record-only child gets an account.' },
  MATCH: { label: 'Already exists', tone: 'neutral', note: 'Linked to this section.' },
};

/** Anything the server flags that has no natural action — shown, never silently dropped. */
export function isBlocked(row) {
  return naturalAction(row) === 'SKIP';
}

export const ORIGIN_LABEL = { SCHOOL_IMPORT: 'Imported', SELF_SIGNUP: 'Signed up' };
