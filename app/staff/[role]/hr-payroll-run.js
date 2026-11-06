import { useLocalSearchParams } from 'expo-router';
import { HrPayrollRunScreen } from '../../../components/hr/HrScreens';

/**
 * The HR portal — HR, and the Shreyartha Admin, who may run HR itself (the website's
 * HR_PORTAL_TYPES); `/api/staff/hr-portal` is hasAnyRole('SHREYARTHA_HR','SHREYARTHA_ADMIN').
 */
const HR_PORTAL_ROLES = ['hr', 'shreyartha_admin'];
export default function StaffHrPayrollRun() {
  const { role, id } = useLocalSearchParams();
  if (!HR_PORTAL_ROLES.includes(String(role || '').toLowerCase())) return null;
  return <HrPayrollRunScreen id={typeof id === 'string' ? id : ''} />;
}
