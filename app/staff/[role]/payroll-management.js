import { useLocalSearchParams } from 'expo-router';
import { AdminPayrollScreen } from '../../../components/staff';
import { getAdminPortal } from '../../../constants/schoolAdminPortals';

/**
 * Payroll Management — salary structures and payroll runs.
 *
 * Named `payroll-management` to stay clear of `payroll.js`, which is the staff member's own
 * payslips on `/api/staff/hr`. Same split as leave.
 */
export default function AdminPayrollManagement() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  const portal = getAdminPortal(roleKey);
  if (!portal?.hr) return null;

  return <AdminPayrollScreen homeRoute={`/staff/${roleKey}`} />;
}
