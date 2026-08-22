import { useLocalSearchParams } from 'expo-router';
import { StaffFeatureScreen } from '../../../components/staff';
import { resolveStaffMenus } from '../../../constants/staffRoles';

export default function StaffFeature() {
  const { role, label, path } = useLocalSearchParams();
  const config = resolveStaffMenus(String(role || '').toLowerCase());
  if (!config) return null; // the layout guard has already redirected
  return (
    <StaffFeatureScreen
      label={label || 'Dashboard'}
      path={path || config.basePath}
      homeRoute={config.routes.home}
      defaultUserType={config.userType}
    />
  );
}
