import { useLocalSearchParams } from 'expo-router';
import { StaffChangePasswordScreen } from '../../../components/staff';
import { resolveStaffMenus } from '../../../constants/staffRoles';

export default function StaffChangePassword() {
  const { role } = useLocalSearchParams();
  const config = resolveStaffMenus(String(role || '').toLowerCase());
  if (!config) return null; // the layout guard has already redirected
  return <StaffChangePasswordScreen homeRoute={config.routes.home} />;
}
