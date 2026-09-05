import { useEffect, useState } from 'react';

/**
 * The settled value of something that changes faster than it should be acted on.
 *
 * Written for the sales school search, where every keystroke would otherwise be a network round
 * trip. The only prior art in the app is an inline `setTimeout` in `AdminPayrollScreen.js` for
 * its salary-breakup preview; extracting it once beats a third copy.
 *
 * Pair it with `useStaffResource`, whose fetcher aborts the previous request when its deps change
 * — between the two, a fast typist produces one request rather than eight, and a slow reply for
 * "st xav" can never overwrite the results for "st xavier".
 *
 * @param value the live value (usually a controlled input's text)
 * @param delay ms of quiet before it settles. 300 suits typing; the payroll preview uses 350.
 */
export default function useDebouncedValue(value, delay = 300) {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    // Cleared and restarted on every change, so the timer only fires once typing stops.
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}
