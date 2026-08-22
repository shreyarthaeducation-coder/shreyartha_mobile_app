// services/admin/eventService.js
// Mirrors: frontendmain/src/School/Admin/pages/EventManagement.js
// Backend: school/controller/SchoolAdminEventController.java
//
// DOUBLY GUARDED. This is the only admin path with a rule at BOTH layers: SecurityConfig's filter
// chain has a rule on "/api/school-admin/events" and everything under it, allowing SCHOOL_ADMIN
// and SHREYARTHA_ADMIN, and every method is additionally `hasRole('SCHOOL_ADMIN')`. A Principal
// clears both through the role hierarchy — but note that VICE_PRINCIPAL, which implies TEACHER and
// not SCHOOL_ADMIN, would be refused at the web layer before any handler runs.
//
// MULTIPART SHAPE: FLAT @RequestParams plus one MultipartFile — so `staffApi.multipart({ fields,
// files })`, never `{ json }`. This endpoint does NOT take a `@RequestPart("data")` payload and so
// sidesteps the 415 trap entirely. Verified against the controller, not assumed.

import { staffApi } from '../staffApi';

/**
 * Every event for this school.
 *
 * @returns {Promise<Array<{ id, title, description, startDateTime, endDateTime,
 *   targetClasses: string, bannerImageUrl, bannerImagePath }>>}
 */
export async function fetchEvents(apiBase, signal) {
  const res = await staffApi.get(apiBase, { signal });
  return Array.isArray(res) ? res : res?.data || [];
}

/**
 * Classes for the audience picker, for one academic year.
 *
 * `targetClasses` is stored as a COMMA-SEPARATED STRING OF CLASS NAMES, not ids — the checkbox
 * list keys on `cls.className` and the payload joins those names. So a renamed class silently
 * detaches its past events.
 */
export async function fetchEventClasses(classesBase, academicYearId, signal) {
  if (!academicYearId) return [];
  const res = await staffApi.get(`${classesBase}?academicYearId=${academicYearId}`, { signal });
  return Array.isArray(res) ? res : res?.data || res?.classes || [];
}

/** The web's own validation, in its own order, so the same first error surfaces. */
export function validateEvent(form) {
  if (!form.title?.trim()) return 'Title is required.';
  if (!form.startDateTime) return 'Start date & time is required.';
  if (!form.endDateTime) return 'End date & time is required.';
  if (new Date(form.endDateTime) <= new Date(form.startDateTime)) {
    return 'End date & time must be after start date & time.';
  }
  if (!form.targetClasses?.length) return 'Please select at least one class.';
  // The backend has `required = false` on the banner; the web requires it anyway. Kept — an event
  // card without a banner renders as an empty box.
  if (!form.bannerImage) return 'Please upload a banner image.';
  return null;
}

export function createEvent(apiBase, form) {
  return staffApi.multipart(apiBase, {
    fields: {
      title: form.title.trim(),
      description: (form.description || '').trim(),
      startDateTime: form.startDateTime,
      endDateTime: form.endDateTime,
      targetClasses: form.targetClasses.join(','),
    },
    files: { bannerImage: form.bannerImage },
  });
}

export function deleteEvent(apiBase, eventId) {
  return staffApi.del(`${apiBase}/${eventId}`);
}

/** `targetClasses` comes back as one string; the web splits and trims it for the badges. */
export function targetClassList(value) {
  return String(value || '')
    .split(',')
    .map((cls) => cls.trim())
    .filter(Boolean);
}

/**
 * Banner URLs may be absolute or a server-relative path.
 *
 * The web prefixes the relative case with its API base; ours must do the same or the image is a
 * broken box. Also: S3 URLs are stored UNENCODED elsewhere in this backend, so encode before use.
 */
export function bannerUrl(event, baseUrl) {
  const path = event?.bannerImageUrl || event?.bannerImagePath;
  if (!path) return '';
  return encodeURI(path.startsWith('http') ? path : `${baseUrl}${path}`);
}
