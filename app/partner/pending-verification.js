import { PartnerPendingScreen } from '../../components/partner';

/**
 * Shown until an admin verifies the partner account.
 *
 * Nothing in this panel works before then — `UNVERIFIED_PARTNER` is granted no endpoint at all.
 */
export default function PartnerPending() {
  return <PartnerPendingScreen />;
}
