import { useLocalSearchParams } from 'expo-router';
import { StaffPendingScreen } from '../../../components/staff';
import { getStaffRoleConfig } from '../../../constants/staffRoles';

export default function StaffPendingVerification() {
  const { role } = useLocalSearchParams();
  const config = getStaffRoleConfig(role);
  if (!config) return null; // the layout guard has already redirected
  return <StaffPendingScreen roleLabel={config.label} unlocks={config.unlocks} />;
}
