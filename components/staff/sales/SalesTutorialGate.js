import { useCallback, useEffect, useState } from 'react';
import SalesTutorialSheet from './SalesTutorialSheet';
import { acknowledgeOnboarding, fetchOnboarding } from '../../../services/sales/salesService';

/**
 * Asks the server whether this rep still needs the walkthrough, and shows it if so.
 *
 * Split out from the home screen because `StaffHomeScreen` serves five roles: mounting the
 * onboarding fetch there would have every principal and counsellor calling a `/api/staff/sales`
 * endpoint they are not authorised for, earning a 403 on every home-screen load. This component is
 * rendered only when the role is sales, so the request only ever happens for someone who can make
 * it.
 *
 * Every failure is swallowed. Not being able to reach the server is not a reason to block a rep
 * from their panel, and the worst outcome of a silent failure here is the walkthrough appearing
 * once more next time.
 */
export default function SalesTutorialGate() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    fetchOnboarding(controller.signal)
      .then((status) => {
        if (alive && status?.showTutorial) setVisible(true);
      })
      .catch(() => {
        // Offline, or a rep whose approval was just revoked. Either way: no walkthrough, no error.
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  const dismiss = useCallback((completed) => {
    // Close first. The acknowledgement is bookkeeping; the rep should not wait on it.
    setVisible(false);
    acknowledgeOnboarding(completed).catch(() => {});
  }, []);

  return <SalesTutorialSheet visible={visible} onDismiss={dismiss} />;
}
