// services/shared/settleAll.js
//
// Run several reads in parallel, each guarded on its own.
//
// ── WHY IT LIVES HERE NOW ───────────────────────────────────────────────────
// Three identical copies existed: one inside `createPortalApi` (parent, partner), one on
// `studentApi`, and none on `staffApi` — which is why `services/teacher/searchService.js` hand-rolls
// `Promise.allSettled` and says so in its header. The staff search index needs the same fan-out, and
// a fourth copy to get it was not worth writing.
//
// It is pure: it touches nothing from any client's closure — no base URL, no token reader, no
// router, not even the client's own `request`. The only coupling is the `isForbidden` getter it
// reads off a rejection, and `PortalApiError`, `StudentApiError` and `StaffApiError` all define it
// identically as `status === 403`. That is what makes one implementation correct for all of them.
//
// ── WHY `forbidden` IS SEPARATE FROM `error` ────────────────────────────────
// A refusal is not a failure. The parent's Academic Progress fans out across nine endpoints and
// several legitimately refuse for a child who is not a school student; a search index asks for trees
// a role may not be allowed. Callers render those as "not included" rather than "went wrong", which
// they can only do if the two are distinguishable. `Promise.all` would collapse the whole page for
// one expected refusal, which is the bug this shape exists to prevent.

/**
 * @param {Record<string, Promise<any>>} tasks keyed promises; the keys come back untouched
 * @returns {Promise<Record<string, { data: any, error: string|null, forbidden: boolean }>>}
 */
export default async function settleAll(tasks) {
  const keys = Object.keys(tasks);
  const results = await Promise.allSettled(keys.map((k) => tasks[k]));
  const out = {};
  keys.forEach((key, i) => {
    const r = results[i];
    out[key] =
      r.status === 'fulfilled'
        ? { data: r.value, error: null, forbidden: false }
        : {
            data: null,
            error: r.reason?.message || 'Could not load.',
            forbidden: !!r.reason?.isForbidden,
          };
  });
  return out;
}
