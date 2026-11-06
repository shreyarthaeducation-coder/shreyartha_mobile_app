import PortalPendingScreen from '../../components/portal/PortalPendingScreen';

export default function UniversityStaffPending() {
  return (
    <PortalPendingScreen
      message="Your account is waiting to be verified by your college. You will be able to sign in to your dashboard once it is."
      unlocks={['Manage students, courses and examinations', 'Request industry sessions', 'Run campus placements']}
    />
  );
}
