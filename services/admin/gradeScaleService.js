// services/admin/gradeScaleService.js
// Mirrors: frontendmain/src/components/GradeManagement/GradeManagement.js (with scope="SCHOOL")
// Backend: grading/controller/SchoolGradeScaleController.java
//          @RequestMapping("/api/school-admin/grade-scales")
//          @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')") — the Principal is named
//          explicitly, so this needs no role-hierarchy hop.
//
// ── THE ONE RULE THAT SHAPES THE WHOLE SCREEN ───────────────────────────────
// A school does NOT start with grading scales of its own. It reads the platform's defaults, and
// until it presses "Customise", those defaults are READ-ONLY: create, edit and delete all belong to
// a school's own copy, not to the shared originals. `customised` in the GET response is what says
// which world you are in, and the screen must not offer an edit that the server will refuse.
//
// ── THE RESPONSE HAS TWO SHAPES, ON PURPOSE ─────────────────────────────────
// The platform admin's endpoint answers a bare ARRAY; the school's answers
// `{ scales, customised, defaultCount }`. The web component handles both because one component
// serves both scopes. This service is school-only, but it keeps the array branch: the same
// controller shape has drifted before, and reading an array as "no scales" would silently empty a
// school's grading table rather than fail loudly.

import { staffApi } from '../staffApi';

const BASE = '/api/school-admin/grade-scales';

/**
 * `{ scales: [{ id, name, maxMarks, appliesTo, bands: [...] }], customised, defaultCount }`.
 *
 * A band is `{ minMarks, maxMarks, grade, description }`. `customised` false means the scales
 * shown are the platform's, and nothing on them may be edited.
 */
export async function fetchGradeScales(signal) {
  const res = await staffApi.get(BASE, { signal });
  if (Array.isArray(res)) {
    return { scales: res, customised: true, defaultCount: res.length };
  }
  return {
    scales: Array.isArray(res?.scales) ? res.scales : [],
    customised: !!res?.customised,
    defaultCount: res?.defaultCount ?? 0,
  };
}

/** Copies the platform defaults into this school, after which they can be edited. */
export function customiseGradeScales() {
  return staffApi.post(`${BASE}/customise`);
}

/** Throws the school's copy away and goes back to following the platform defaults. */
export function revertGradeScales() {
  return staffApi.post(`${BASE}/revert`);
}

export function createGradeScale(body) {
  return staffApi.post(BASE, body);
}

export function updateGradeScale(id, body) {
  return staffApi.put(`${BASE}/${id}`, body);
}

export function deleteGradeScale(id) {
  return staffApi.del(`${BASE}/${id}`);
}

/**
 * The draft the editor holds, turned into the body the server wants.
 *
 * Bands are filtered the way the web filters them: a row is kept when ANY of its three meaningful
 * fields was touched, so a half-typed band is still sent (and refused with a message) rather than
 * silently dropped — a dropped band is a grade that quietly stops existing.
 */
export function buildScalePayload(draft) {
  const bands = (draft.bands || [])
    .filter((b) => String(b.grade ?? '').trim() !== '' || b.minMarks !== '' || b.maxMarks !== '')
    .map((b) => ({
      minMarks: Number(b.minMarks),
      maxMarks: Number(b.maxMarks),
      grade: String(b.grade ?? '').trim(),
      description: String(b.description ?? '').trim(),
    }));
  return {
    name: String(draft.name ?? '').trim(),
    maxMarks: Number(draft.maxMarks) || 0,
    appliesTo: String(draft.appliesTo ?? '').trim(),
    bands,
  };
}
