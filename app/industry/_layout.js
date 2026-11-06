import PortalGate from '../../components/portal/PortalGate';
import { PORTALS } from '../../constants/theme';

/** The Industry portal (5 Nov 2026). As on the website, an unapproved company may still set up. */
export default function IndustryLayout() {
  return <PortalGate tokenKey="industryUserToken" palette={PORTALS.industry} />;
}
