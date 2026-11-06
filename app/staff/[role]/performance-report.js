import { useLocalSearchParams } from 'expo-router';
import PerformanceReportScreen from '../../../components/staff/admin/PerformanceReportScreen';
import { getAdminPortal } from '../../../constants/schoolAdminPortals';

/**
 * Student Performance & Report — Principal and School Admin. `/api/school-admin` is SCHOOL_ADMIN, so
 * the guard is the descriptor's `classes` key (the VP descriptor carries HR only).
 */
export default function StaffPerformanceReport() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  if (!getAdminPortal(roleKey)?.classes) return null;
  return <PerformanceReportScreen homeRoute={`/staff/${roleKey}`} />;
}
