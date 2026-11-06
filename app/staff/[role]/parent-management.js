import { useLocalSearchParams } from 'expo-router';
import ParentManagementScreen from '../../../components/staff/parents/ParentManagementScreen';

/**
 * Parent Management (6 Nov 2026) — the website's /parent-management for the School Admin and the
 * Principal: parents waiting to be verified, and each section's parent and student codes.
 */
export default function StaffParentManagement() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  if (!['principal', 'admin'].includes(roleKey)) return null;
  return <ParentManagementScreen mode="admin" homeRoute={`/staff/${roleKey}`} />;
}
