import { useLocalSearchParams } from 'expo-router';
import { AlumniManagementScreen } from '../../../components/staff/outreach/OutreachScreens';
import { getAdminPortal } from '../../../constants/schoolAdminPortals';

/** Alumni Management — the School Admin only (`outreach` is on that descriptor alone). */
export default function StaffAlumniManagement() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  if (!getAdminPortal(roleKey)?.outreach) return null;
  return <AlumniManagementScreen homeRoute={`/staff/${roleKey}`} />;
}
