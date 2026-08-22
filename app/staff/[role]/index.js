import { useLocalSearchParams } from 'expo-router';
import { StaffMenuScreen } from '../../../components/staff';
import { resolveStaffMenus } from '../../../constants/staffRoles';

export default function StaffHome() {
  const { role } = useLocalSearchParams();
  const config = resolveStaffMenus(String(role || '').toLowerCase());
  if (!config) return null; // the layout guard has already redirected
  return <StaffMenuScreen config={config} />;
}
