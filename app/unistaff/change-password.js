import ParentChangePasswordScreen from '../../components/parent/ParentChangePasswordScreen';
import { universityStaffApi } from '../../services/portalClients';

export default function UniversityStaffChangePassword() {
  return (
    <ParentChangePasswordScreen
      api={universityStaffApi}
      endpoint="/api/university-staff/auth/change-password"
      fallbackRoute="/unistaff"
    />
  );
}
