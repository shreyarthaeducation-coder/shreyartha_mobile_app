import { useLocalSearchParams } from 'expo-router';
import { StaffPendingScreen } from '../../../components/staff';
import { getStaffRoleConfig } from '../../../constants/staffRoles';
import { isShreyarthaRole } from '../../../constants/authPortals';

export default function StaffPendingVerification() {
  const { role } = useLocalSearchParams();
  const config = getStaffRoleConfig(role);
  if (!config) return null; // the layout guard has already redirected

  // WHO approves depends on the cohort, and the screen used to tell everyone "the school
  // administrator". That is right for a partner school's teacher or counsellor and wrong for
  // Shreyartha HQ staff and sales reps, who are approved by the Shreyartha admin team — a different
  // person, reachable through a different panel. It was a harmless inaccuracy while the HQ roles
  // were verified the moment they registered and never saw this screen; now it is the first thing
  // every new HQ employee reads.
  return (
    <StaffPendingScreen
      roleLabel={config.label}
      unlocks={config.unlocks}
      approver={
        isShreyarthaRole(config.userType)
          ? 'the Shreyartha admin team'
          : 'the school administrator'
      }
    />
  );
}
