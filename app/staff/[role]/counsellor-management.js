import { useLocalSearchParams } from 'expo-router';
import { CounsellorManagementScreen } from '../../../components/staff/shreyartha/ShreyarthaAdminScreens';
import { getAdminPortal } from '../../../constants/schoolAdminPortals';

/** Counsellor Management — the Shreyartha Admin only (`/api/admin/counsellors`). */
export default function StaffCounsellorManagement() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  if (!getAdminPortal(roleKey)?.counsellorManagement) return null;
  return <CounsellorManagementScreen homeRoute={`/staff/${roleKey}`} />;
}
