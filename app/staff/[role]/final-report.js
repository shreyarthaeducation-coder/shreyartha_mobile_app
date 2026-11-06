import { useLocalSearchParams } from 'expo-router';
import FinalReportScreen from '../../../components/staff/admin/FinalReportScreen';
import { getAdminPortal } from '../../../constants/schoolAdminPortals';
import { getStaffRoleConfig } from '../../../constants/staffRoles';

/** Final Report — Principal and School Admin (SCHOOL_ADMIN); the VP descriptor has no `classes`. */
export default function StaffFinalReport() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  const config = getStaffRoleConfig(roleKey);
  if (!getAdminPortal(roleKey)?.classes || !config) return null;
  return <FinalReportScreen roleKey={roleKey} webPath={`${config.basePath}/final-report`} />;
}
