import PortalGate from '../../components/portal/PortalGate';
import { PORTALS } from '../../constants/theme';

/**
 * University Staff (5 Nov 2026): Vice Chancellor and Dean (College Admin), Professor and Associate
 * Dean (Faculty), Placement Head. An account not yet verified by its college waits on the pending
 * screen, and may still change its password.
 */
export default function UniversityStaffLayout() {
  return (
    <PortalGate
      tokenKey="universityStaffToken"
      okKey="universityStaffVerified"
      palette={PORTALS.universityStaff}
      pendingRoute="/unistaff/pending-verification"
      openRoutes={['/unistaff/change-password']}
    />
  );
}
