import PortalGate from '../../components/portal/PortalGate';
import { PORTALS } from '../../constants/theme';

/** The Investor portal (5 Nov 2026). An account the admin has not verified waits on the pending screen. */
export default function InvestorLayout() {
  return (
    <PortalGate
      tokenKey="investorUserToken"
      okKey="investorUserVerified"
      palette={PORTALS.investor}
      pendingRoute="/investor/pending-verification"
    />
  );
}
