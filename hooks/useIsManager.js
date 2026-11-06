import { useEffect, useState } from 'react';
import { staffApi } from '../services/staffApi';

/**
 * Whether the signed-in staff member has direct reports — the only thing that makes someone a
 * manager (6 Nov 2026, the website's School/shared/hr/useIsManager). Any failure reads as "not a
 * manager": a broken call can hide a tile, never break a screen. `enabled = false` makes no request.
 */
export default function useIsManager(enabled = true) {
  const [isManager, setIsManager] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setIsManager(false);
      return undefined;
    }
    let alive = true;
    staffApi
      .get('/api/staff/hr/my-team/summary')
      .then((s) => alive && setIsManager(!!s?.isManager))
      .catch(() => alive && setIsManager(false));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return isManager;
}
