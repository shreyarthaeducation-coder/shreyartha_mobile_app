import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import confirmSensitive from '../utils/confirmSensitive';

/**
 * Keeps personal/financial fields masked until the user deliberately asks for them.
 *
 * The reset-on-blur is the part that matters. Without it, "reveal" is a one-time unlock for the
 * lifetime of the mounted screen: a teacher shows their payslip, navigates to Leave, hands the
 * phone to a colleague to look at the leave calendar, and a back-tap lands on a fully unmasked
 * salary slip. Re-masking whenever the screen loses focus makes the gate mean what it looks like
 * it means.
 *
 * @param {object} [options] forwarded to confirmSensitive (title/message/confirmLabel)
 * @returns {{ revealed: boolean, reveal: () => Promise<boolean>, hide: () => void,
 *             mask: (value: string, kind?: string) => string }}
 */
export default function useSensitiveReveal(options) {
  const [revealed, setRevealed] = useState(false);

  useFocusEffect(
    useCallback(() => () => setRevealed(false), []),
  );

  const reveal = useCallback(async () => {
    if (revealed) return true;
    const ok = await confirmSensitive(options);
    if (ok) setRevealed(true);
    return ok;
  }, [revealed, options]);

  const hide = useCallback(() => setRevealed(false), []);

  /**
   * Masks a value while hidden, keeping just enough shape to be recognisable.
   *
   * Account numbers and UAN/PAN/Aadhaar keep their last 4 so the owner can still tell which
   * account they are looking at; money and everything else is replaced outright, because a
   * partially-masked salary is still a salary.
   */
  const mask = useCallback(
    (value, kind = 'full') => {
      if (revealed) return value;
      if (value == null || value === '') return value;
      const str = String(value);
      if (kind === 'tail' && str.length > 4) {
        return `${'•'.repeat(Math.max(str.length - 4, 4))}${str.slice(-4)}`;
      }
      return '••••••';
    },
    [revealed],
  );

  return { revealed, reveal, hide, mask };
}
