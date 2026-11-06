import { useLocalSearchParams } from 'expo-router';
import { HrEmployeesScreen } from '../../../components/hr/HrScreens';

/**
 * The HR portal — HR, and the Shreyartha Admin, who may run HR itself (the website's
 * HR_PORTAL_TYPES); `/api/staff/hr-portal` is hasAnyRole('SHREYARTHA_HR','SHREYARTHA_ADMIN').
 */
const HR_PORTAL_ROLES = ['hr', 'shreyartha_admin'];
export default function StaffHrEmployees() {
  const { role, type } = useLocalSearchParams();
  if (!HR_PORTAL_ROLES.includes(String(role || '').toLowerCase())) return null;
  return <HrEmployeesScreen type={typeof type === 'string' ? type : ''} />;
}
