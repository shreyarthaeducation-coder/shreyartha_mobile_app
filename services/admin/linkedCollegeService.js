// services/admin/linkedCollegeService.js
// Mirrors: frontendmain/src/School/Admin/pages/LinkedColleges.js
//          + frontendmain/src/components/UniversityDetailView/UniversityDetailView.js
// Backend: school/controller/SchoolAdminLinkedUniversityController.java
//          @PreAuthorize("hasRole('SCHOOL_ADMIN') or hasRole('PRINCIPAL')") — names PRINCIPAL.
//
// TWO ENDPOINTS AND NO CREATE. Linking a university to a school is the PLATFORM admin's job
// (Admin Dashboard → Schools → Linked Universities). This page only flips student-facing
// visibility, which is OFF for every new link until someone turns it on. There is deliberately no
// add or remove here — don't add one.
//
// The list response carries the WHOLE showcase profile for every university, courses and gallery
// included, so the detail view needs no second request.

import { staffApi } from '../staffApi';

/**
 * Every university the platform admin has linked to this school.
 *
 * @returns {Promise<Array<{
 *   linkId: number, visibleToStudents: boolean,
 *   universityName, universityCode, collegeType, establishedYear, accreditation,
 *   description, logoUrl, bannerUrl,
 *   addressLine, city, state, country, postalCode, mapEmbedUrl,
 *   admissionsEmail, phoneNumber, websiteUrl,
 *   gallery: string[], videoTourUrl, virtualTourUrl,
 *   courses: Array<{ id, courseName, department, duration, degreeLevel, admissionFee,
 *     tuitionFee, hostelFee, totalEstimatedCost, minPercentage, requiredExams, popular,
 *     courseDetails }>
 * }>>}
 */
export async function fetchLinkedUniversities(apiBase, signal) {
  const res = await staffApi.get(apiBase, { signal });
  return Array.isArray(res) ? res : [];
}

/**
 * Show or hide one university from this school's students.
 *
 * POST, not PUT — the controller declares it as a post even though it is an update.
 */
export function setUniversityVisibility(apiBase, linkId, visible) {
  return staffApi.post(`${apiBase}/${linkId}/visibility`, { visible });
}

/** `accreditation` is a single comma-separated string; the web renders it as badges. */
export function accreditationBadges(accreditation) {
  if (!accreditation) return [];
  return String(accreditation)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/** The web's own guard before turning a value into a link. */
export const isHttpUrl = (value) => typeof value === 'string' && /^https?:\/\//i.test(value);

/** "Bengaluru, Karnataka" from whichever of the two exist. */
export function placeLine(u) {
  return [u?.city, u?.state].filter(Boolean).join(', ');
}

/**
 * The web renders eleven columns per course in a table — unusable on a phone, so the native detail
 * lists each course as a card. These are the money rows, in the web's order.
 */
export const COURSE_FEE_ROWS = [
  { label: 'Admission / registration', field: 'admissionFee' },
  { label: 'Annual / semester tuition', field: 'tuitionFee' },
  { label: 'Hostel (optional)', field: 'hostelFee' },
  { label: 'Total estimated cost', field: 'totalEstimatedCost' },
];

/** Web parity: `Min. 60%, JEE Main` from the two eligibility fields, or an em dash. */
export function eligibilityLine(course) {
  return (
    [
      course?.minPercentage != null ? `Min. ${course.minPercentage}%` : null,
      course?.requiredExams || null,
    ]
      .filter(Boolean)
      .join(', ') || '—'
  );
}
