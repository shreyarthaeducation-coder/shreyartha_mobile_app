// services/admin/overviewService.js
// Mirrors: frontendmain/src/School/Admin/pages/SchoolAdminOverview.js
// Backend: school/controller/SchoolClassManagementController.java (dashboard-stats, school-logo)
//          common/controller/ImageUploadController.java (the upload itself)
//
// ON THE WEB THE SHELL OWNS THIS FETCH, NOT THE PAGE. PrincipalDashboard calls
// /classes/dashboard-stats itself and passes `stats` down as a prop, which is also why the page
// takes a `refreshStats` callback. Here the screen owns both — there is no equivalent of the
// dashboard shell in the native app, and the menu grid must not block on a stats call.
//
// Both endpoints name PRINCIPAL explicitly (`hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')`), so this is
// one of the few admin features not relying on the role hierarchy.

import { staffApi } from '../staffApi';
import { SHARED_ADMIN_API } from '../../constants/schoolAdminPortals';

/** The web refuses anything larger before it uploads. S3StorageService also caps at 5 MB. */
export const MAX_LOGO_BYTES = 5 * 1024 * 1024;

/**
 * School-wide counts plus the school's own identity.
 *
 * @returns {Promise<{
 *   adminName: string, schoolName: string, schoolCode: string, schoolBoard: string,
 *   schoolLogo: string|null,
 *   totalPrincipals, verifiedPrincipals, unverifiedPrincipals,
 *   totalVicePrincipals, verifiedVicePrincipals, unverifiedVicePrincipals,
 *   totalTeachers, verifiedTeachers, unverifiedTeachers,
 *   totalCounselors, verifiedCounselors, unverifiedCounselors,
 *   totalStudents, paidStudents, freeStudents
 * }>}
 */
export function fetchDashboardStats(apiBase, signal) {
  return staffApi.get(`${apiBase}/dashboard-stats`, { signal });
}

/**
 * The five stat groups, in the web's order, as data rather than markup.
 *
 * `staffType` is the `type=` query the web's "View All →" link carries. NOTE the web hardcodes
 * those links to `/school/platform/admin/dashboard/staff?type=…` — the SCHOOL ADMIN's URL — so on
 * the Principal panel every "View All" navigates somewhere the Principal cannot route to. We pass
 * the filter to our own Staff Management screen instead. The student group has no staff type and
 * links nowhere useful on the web either; it opens Student Management here.
 */
export const STAT_SECTIONS = [
  {
    key: 'principals',
    title: 'Principal Overview',
    icon: 'ribbon-outline',
    staffType: 'PRINCIPAL',
    cards: [
      { label: 'Total Principals', field: 'totalPrincipals', tone: 'total' },
      { label: 'Verified', field: 'verifiedPrincipals', tone: 'success' },
      { label: 'Unverified', field: 'unverifiedPrincipals', tone: 'warning' },
    ],
  },
  {
    key: 'vicePrincipals',
    title: 'Vice Principal Overview',
    icon: 'shield-checkmark-outline',
    staffType: 'VICE_PRINCIPAL',
    cards: [
      { label: 'Total Vice Principals', field: 'totalVicePrincipals', tone: 'total' },
      { label: 'Verified', field: 'verifiedVicePrincipals', tone: 'success' },
      { label: 'Unverified', field: 'unverifiedVicePrincipals', tone: 'warning' },
    ],
  },
  {
    key: 'teachers',
    title: 'Teacher Overview',
    icon: 'school-outline',
    staffType: 'TEACHER',
    cards: [
      { label: 'Total Teachers', field: 'totalTeachers', tone: 'total' },
      { label: 'Verified', field: 'verifiedTeachers', tone: 'success' },
      { label: 'Unverified', field: 'unverifiedTeachers', tone: 'warning' },
    ],
  },
  {
    key: 'counselors',
    title: 'Counselor Overview',
    icon: 'heart-outline',
    // COUNSELOR — one L. The backend enum spelling; see constants/staffRoles.js's header.
    staffType: 'COUNSELOR',
    cards: [
      { label: 'Total Counselors', field: 'totalCounselors', tone: 'total' },
      { label: 'Verified', field: 'verifiedCounselors', tone: 'success' },
      { label: 'Unverified', field: 'unverifiedCounselors', tone: 'warning' },
    ],
  },
  {
    key: 'students',
    title: 'Student Overview',
    icon: 'people-outline',
    staffType: null,
    cards: [
      { label: 'Total Students', field: 'totalStudents', tone: 'total' },
      { label: 'Paid Students', field: 'paidStudents', tone: 'success' },
      { label: 'Free Students', field: 'freeStudents', tone: 'warning' },
    ],
  },
];

/**
 * Upload a new school logo, then point the school at it.
 *
 * Two calls, in order, exactly as the web does: the image goes to the shared upload endpoint and
 * comes back as a URL, which is then written onto the school. If the second call fails the image is
 * orphaned in S3 — the web has the same behaviour and there is no delete endpoint to compensate.
 *
 * `pickPhoto()` pins the picker to JPEG because S3StorageService.validateImage accepts only
 * png/jpeg/gif/webp and an iPhone HEIC would 400.
 */
export async function uploadSchoolLogo(apiBase, file) {
  const res = await staffApi.multipart(SHARED_ADMIN_API.imageUpload, { files: { file } });
  if (!res?.url) throw new Error('Upload failed: no URL returned.');
  await staffApi.put(`${apiBase}/school-logo`, { schoolLogo: res.url });
  return res.url;
}

/** Clear the logo. `null` is meaningful here — the field is nullable, not absent. */
export function removeSchoolLogo(apiBase) {
  return staffApi.put(`${apiBase}/school-logo`, { schoolLogo: null });
}
