// services/counsellor/queriesService.js
// Mirrors: frontendmain/src/School/ShreyarthaCounsellor/ShreyarthaCouncellorDashboard.js
// Backend: shreyartha/controller/ShreyarthaCouncellorController.java
//          @PreAuthorize("hasRole('SHREYARTHA_COUNCELLOR')") on every method — Portal B only.
//
// NOTE THE PATH: `/api/shreyartha/councellor` — `shreyartha`, not `shreya01`, and `councellor`
// with a c. Three different spellings live in this app and all three are load-bearing.

import { staffApi } from '../staffApi';
import { COUNSELLOR_PORTALS } from '../../constants/counsellorPortals';

const BASE = COUNSELLOR_PORTALS.shreyartha_councellor.queries;

/**
 * The three streams. Identical verbs and bodies; only the path segment and the field names of the
 * asker differ, which is why one screen serves all three behind this descriptor.
 */
export const QUERY_STREAMS = [
  {
    key: 'website',
    label: 'Website',
    path: 'website-queries',
    icon: 'globe-outline',
    // Website queries carry the asker inline.
    person: (q) => ({ name: q.name, email: q.email, phone: q.phone || q.mobile }),
  },
  {
    key: 'student',
    label: 'Students',
    path: 'student-queries',
    icon: 'school-outline',
    // Student queries prefix the same fields; the web falls back the same way.
    person: (q) => ({
      name: q.studentName || q.name,
      email: q.studentEmail || q.email,
      phone: q.studentMobile || q.mobile || q.phone,
    }),
  },
  {
    key: 'chatbot',
    label: 'Chatbot',
    path: 'chatbot-inquiries',
    icon: 'chatbubbles-outline',
    person: (q) => ({ name: q.name, email: q.email, phone: q.phone || q.mobile }),
  },
];

export const getStream = (key) => QUERY_STREAMS.find((s) => s.key === key) || QUERY_STREAMS[0];

/** Assigned to this counsellor, newest first. */
export async function fetchQueries(streamKey, signal) {
  const res = await staffApi.get(`${BASE}/${getStream(streamKey).path}`, { signal });
  return Array.isArray(res) ? res : [];
}

/**
 * Answer a query. Sets `status` to RESOLVED server-side.
 *
 * A blank `solutionProvided` is a 400, and answering a query assigned to someone else is a **403**
 * — one of the few real 403s in this backend, which is exactly why staffApi must not treat it as
 * a dead session.
 */
export function submitSolution({ streamKey, id, solutionProvided }) {
  return staffApi.put(`${BASE}/${getStream(streamKey).path}/${id}/solution`, { solutionProvided });
}

/**
 * Schedule a Google Meet and send the link.
 *
 * **Only valid when `preferredMode` is VIDEO** — the server rejects anything else, so the action
 * is hidden rather than offered and then refused.
 *
 * @param {{ meetLink?, scheduledAt?, durationMinutes?, message? }} payload
 *        `scheduledAt` is a bare LocalDateTime string (`yyyy-MM-ddTHH:mm:ss`), no zone suffix.
 */
export function sendMeetLink({ streamKey, id, ...payload }) {
  return staffApi.post(`${BASE}/${getStream(streamKey).path}/${id}/send-meet-link`, payload);
}

/** NEW / READ / RESOLVED → a StatusChip tone. */
export const statusTone = (status) => {
  const s = String(status || '').toUpperCase();
  if (s === 'RESOLVED') return 'success';
  if (s === 'READ') return 'info';
  return 'warning';
};
