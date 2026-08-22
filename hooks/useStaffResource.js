import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Load / refresh / error state for one remote resource on a staff screen.
 *
 * Generalises the pattern hand-written in components/staff/StaffProfileScreen.js.
 *
 * IMPORTANT — `fetcher` must be memoised (useCallback) by the caller. The effect keys off its
 * identity, so a fetcher rebuilt every render loops forever. StaffProfileScreen hit exactly this
 * and worked around it by joining its endpoint array into a string key; wrapping in useCallback
 * with the real inputs (year, month, sectionId…) is the cleaner version of the same fix.
 *
 * The fetcher receives an AbortSignal. Pass it to staffApi so an in-flight request is dropped when
 * the screen unmounts or the inputs change, instead of resolving into a dead component.
 *
 * @param {(signal: AbortSignal) => Promise<any>} fetcher
 * @param {{ enabled?: boolean, initialData?: any }} [options]
 * @returns {{ data, loading, refreshing, error, reload, refresh, revalidate, setData }}
 *   reload     — show the spinner: first load, or retrying after a failure
 *   refresh    — pull-to-refresh: keep the stale content, drive the RefreshControl
 *   revalidate — silent re-fetch after a mutation; no spinner, no RefreshControl flash
 */
export default function useStaffResource(fetcher, { enabled = true, initialData = null } = {}) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const alive = useRef(true);
  const controller = useRef(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);

  const run = useCallback(
    async (mode) => {
      if (!enabled) {
        setLoading(false);
        return;
      }

      controller.current?.abort();
      const local = new AbortController();
      controller.current = local;

      if (mode === 'refresh') setRefreshing(true);
      else if (mode === 'load') setLoading(true);
      // 'silent' shows no indicator at all — the caller has already painted the result
      // optimistically and is only confirming it against the server.
      setError('');

      try {
        const result = await fetcher(local.signal);
        if (!alive.current || local.signal.aborted) return;
        setData(result);
      } catch (e) {
        if (!alive.current || local.signal.aborted || e?.aborted) return;
        setError(e?.message || 'Something went wrong. Please try again.');
      } finally {
        if (alive.current && !local.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [enabled, fetcher],
  );

  useEffect(() => {
    run('load');
  }, [run]);

  const reload = useCallback(() => run('load'), [run]);
  const refresh = useCallback(() => run('refresh'), [run]);
  const revalidate = useCallback(() => run('silent'), [run]);

  return { data, loading, refreshing, error, reload, refresh, revalidate, setData };
}
