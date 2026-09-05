import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import SalesTutorialSheet from '../../../components/staff/sales/SalesTutorialSheet';

/**
 * Replay the walkthrough on demand.
 *
 * A route rather than a modal on the profile screen, so it can be reached from the menu tile and
 * from a deep link. Closing pops back rather than leaving a blank screen behind the dismissed
 * sheet.
 *
 * `replay` is what stops this recording anything: a rep who has already been taught and chooses
 * to look again has not "newly seen" the current version, and writing an acknowledgement here
 * would be indistinguishable from the first-run one.
 */
export default function StaffSalesTutorial() {
  const router = useRouter();
  const { role } = useLocalSearchParams();
  const [open, setOpen] = useState(true);

  const close = () => {
    setOpen(false);
    if (router.canGoBack()) router.back();
    else router.replace(`/staff/${String(role || 'sales').toLowerCase()}`);
  };

  return <SalesTutorialSheet visible={open} replay onDismiss={close} />;
}
