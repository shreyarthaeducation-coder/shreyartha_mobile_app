// services/staff/counsellorSummaryService.js
//
// The counsellor dashboard's "Today's Summary" row and "Today's Sessions" list.
//
// ══ WHY THERE IS A BACKEND ENDPOINT FOR FOUR INTEGERS ══════════════════════
// Because none of them can be counted on the client. `GET /api/counselor/counselling/sessions`
// takes `studentId` AND `date` as MANDATORY parameters — it answers "what did I write about this
// one child today" — and there is no "all my sessions" read anywhere on the counselling surface.
// Counting students counselled from the client would mean one request per child on the roster.
//
// ══ WHAT IS NOT HERE, AND WHY ══════════════════════════════════════════════
// "Schools Visited" and a "Today's Visits" list, both of which the approved design shows. There is
// no counsellor visit entity, controller or service anywhere in the backend. Visits belong to the
// sales module, and `SalesController` is `hasRole('SHREYARTHA_SALES')` at class level with a second
// `SalesAccessService.requireSalesUser` check inside every service method — so widening the guard
// would still leave a counsellor with a 400 on every call. Those two are absent rather than zeroed.

import staffApi from '../staffApi';
import { todayIso } from '../../utils/dates';

/**
 * The API root for a counsellor role.
 *
 * The two portals are wired differently everywhere else — Portal A is name-keyed
 * (`{className, sectionName}`), Portal B is id-keyed (`{schoolId, classId}`) — but the summary
 * itself needs no variant: every figure is scoped server-side by the AUTHOR, so there is nothing
 * for the school/class shape to affect. Only the prefix differs.
 */
const PREFIXES = {
  counselor: { summary: '/api/counselor/summary', f2f: '/api/counselor/f2f' },
  shreyartha_councellor: {
    summary: '/api/shreya01/counsellor/summary',
    f2f: '/api/shreya01/counsellor/f2f',
  },
};

export function counsellorPrefixes(roleKey) {
  return PREFIXES[String(roleKey || '').toLowerCase()] || null;
}

/**
 * The four figures, or null.
 *
 * Null rather than a throw, and null rather than zeros: a dashboard block that could not load must
 * not be indistinguishable from a genuinely quiet day. `StaffHomeScreen` renders nothing at all in
 * that case, which is the same posture every other optional block on that screen already takes.
 */
export async function fetchTodaySummary(roleKey) {
  const prefixes = counsellorPrefixes(roleKey);
  if (!prefixes) return null;
  try {
    return await staffApi.get(`${prefixes.summary}/today`);
  } catch {
    return null;
  }
}

/**
 * Today's face-to-face sessions for this counsellor.
 *
 * Uses the EXISTING list endpoint with `from` and `to` both set to today — the repository query
 * behind it already filters by author and date range, so no new endpoint was needed for the list
 * even though the counts needed one.
 *
 * Returns `[]` on any failure, because the list block renders its own empty state and a day with
 * no sessions is the normal case.
 */
export async function fetchTodaySessions(roleKey) {
  const prefixes = counsellorPrefixes(roleKey);
  if (!prefixes) return [];
  const day = todayIso();
  try {
    const res = await staffApi.get(`${prefixes.f2f}/sessions?from=${day}&to=${day}`);
    // The controller pages through F2FApi, so the rows may arrive under `content` (a Spring Page)
    // or as a bare array depending on how the service maps them. Accept both rather than guess.
    const rows = Array.isArray(res) ? res : res?.content || res?.items || [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/**
 * A session row rendered for `TodayList`.
 *
 * `sessionStatus` is SCHEDULED → ONGOING → COMPLETED plus two CANCELLED arms. Only COMPLETED is
 * green; ONGOING is amber because it is a thing needing attention right now, and everything else
 * is neutral. A cancelled session still shows, because "why is nothing happening at 2pm" is a
 * question the list should answer.
 */
export function sessionRow(session, index) {
  const status = String(session?.sessionStatus || '').toUpperCase();
  const tone = status === 'COMPLETED' ? 'success' : status === 'ONGOING' ? 'warning' : 'neutral';
  return {
    key: String(session?.sessionUuid || session?.id || index),
    title: session?.title || session?.schoolName || 'Counselling session',
    subtitle: [session?.schoolName, session?.classLabel || session?.className]
      .filter(Boolean)
      .join(' · ') || null,
    time: session?.startTime || session?.sessionTime || null,
    status: status ? titleCase(status) : null,
    tone,
    icon: 'people-outline',
  };
}

function titleCase(value) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
