// services/counsellor/psychometricService.js
// Backend: psychometric/controller/CounselorPsychometricController.java
//          — every method guarded hasAnyRole('COUNSELOR','SHREYARTHA_COUNCELLOR'), so BOTH portals
//            use these `/api/counselor/psychometric/*` paths unchanged.
//
// Drives the "🧠 Enable Psychometric" modal in Wellness Groups: a per-student switch over the
// admin's psychometric topic tree.

import { staffApi } from '../staffApi';
import { SHARED_COUNSELLOR_API } from '../../constants/counsellorPortals';

const BASE = SHARED_COUNSELLOR_API.psychometric;

/**
 * The admin's topic tree, scoped to the "SCHOOL" variant server-side.
 *
 * Shape is `PsychometricClass[]` with topics nested. The tree is global, not per-student — which
 * is why it is fetched once per screen and the per-student state comes from `/student-enables`.
 */
export async function fetchPsychometricTree(signal) {
  const res = await staffApi.get(`${BASE}/tree`, { signal });
  return Array.isArray(res) ? res : [];
}

/**
 * `{ [topicId]: boolean }` — only topics with a stored record appear, so a missing key means
 * "never set", not "disabled". Treat both as off, but do not assume the map is complete.
 */
export async function fetchStudentEnables(studentId, signal) {
  const res = await staffApi.get(`${BASE}/student-enables`, { params: { studentId }, signal });
  return res && typeof res === 'object' ? res : {};
}

/** Per-topic completion/attempt state for the student, for the modal's badges. */
export async function fetchStudentStatus(studentId, signal) {
  const res = await staffApi.get(`${BASE}/student-status`, { params: { studentId }, signal });
  return res && typeof res === 'object' ? res : {};
}

/** Creates or updates the enable record. Upsert, so re-sending the same value is safe. */
export function toggleTopicEnabled({ studentId, topicId, enabled }) {
  return staffApi.post(`${BASE}/toggle-enable`, { studentId, topicId, enabled });
}
