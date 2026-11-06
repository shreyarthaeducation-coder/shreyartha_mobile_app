import PortalPendingScreen from '../../components/portal/PortalPendingScreen';

export default function InvestorPending() {
  return (
    <PortalPendingScreen
      message="Your investor account is waiting to be verified by the Shreyartha team."
      unlocks={['See your benefits and equity, year by year', 'Read your investor relations documents', 'Read your agreements and results']}
    />
  );
}
