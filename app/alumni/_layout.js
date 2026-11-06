import PortalGate from '../../components/portal/PortalGate';
import { PORTALS } from '../../constants/theme';

/** The Alumni portal (5 Nov 2026). No approval step on the website, so only the token is checked. */
export default function AlumniLayout() {
  return <PortalGate tokenKey="alumniUserToken" palette={PORTALS.alumni} />;
}
