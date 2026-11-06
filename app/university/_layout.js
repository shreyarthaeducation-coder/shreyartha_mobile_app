import PortalGate from '../../components/portal/PortalGate';
import { PORTALS } from '../../constants/theme';

/**
 * The University portal (5 Nov 2026). As on the website, an account waiting for approval may still
 * fill in its profile, courses and media — the home says it is pending — so only the token is checked.
 */
export default function UniversityLayout() {
  return <PortalGate tokenKey="universityUserToken" palette={PORTALS.university} />;
}
