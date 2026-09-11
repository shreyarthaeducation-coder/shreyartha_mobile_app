import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SCHOOL_LOGO_KEY } from '../constants/storageKeys';

/**
 * The school crest for the header, cached so it paints on a cold start.
 *
 * ── WHY A HOOK AND NOT SIX COPIES ───────────────────────────────────────────
 * Six school-bound portals need the same three behaviours — read the cache immediately, accept a
 * freshly-fetched URL when the portal's own profile call returns, and write it back — and each
 * portal gets that URL from a DIFFERENT endpoint:
 *
 *   teacher, vice principal   GET /api/teacher/profile              → schoolLogo
 *   principal                 GET /api/school-admin/classes/dashboard-stats → schoolLogo
 *   counselor                 GET /api/counselor/profile            → schoolLogo  (added for this)
 *   student                   GET /api/students/profile → schoolId,
 *                             then GET /api/students/school-info/{id} → schoolLogo
 *   parent                    GET /api/parent/dashboard/linked-student → schoolLogo  (added for this)
 *
 * So the FETCH cannot be shared and is deliberately not attempted here — every one of those calls
 * is already being made by the screen for its own reasons, and adding a seventh request per
 * dashboard to re-fetch a logo the screen already holds would be pure waste. The caller passes
 * whatever it found; this owns only the cache.
 *
 * ── WHY IT NEVER RETURNS A STALE CREST FOR A NEW SCHOOL ─────────────────────
 * `SCHOOL_LOGO_KEY` is in `ALL_AUTH_KEYS`, so a logout wipes it. Within one session the fresh
 * value always wins over the cached one, so a counsellor who covers two schools sees the crest of
 * whichever profile last answered rather than whichever was cached first.
 *
 * @param {string|null|undefined} url the logo the caller's own profile call returned, if any
 * @returns {string|null} the URL to render, cached value first, or null
 */
export default function useSchoolLogo(url) {
  const [cached, setCached] = useState(null);

  // Read once on mount. A failure costs the first paint and nothing else.
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(SCHOOL_LOGO_KEY)
      .then((value) => {
        if (alive && value) setCached(value);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Write through whenever the caller learns a real one.
  useEffect(() => {
    if (!url) return;
    setCached(url);
    AsyncStorage.setItem(SCHOOL_LOGO_KEY, url).catch(() => {});
  }, [url]);

  // The live value wins; the cache is only what covers the gap before it arrives.
  return url || cached || null;
}
