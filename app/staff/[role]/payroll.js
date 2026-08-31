import { useLocalSearchParams } from 'expo-router';
import { PayrollScreen } from '../../../components/staff';

/**
 * My Payslips — this staff member's own payslips, on `/api/staff/hr`. Same eight-role guard and the
 * same "My" versus "Management" distinction as leave.js; the approver-side twin is
 * `payroll-management.js`.
 *
 * Payslips only exist once a payroll run has been executed for the school, so an empty list is a
 * normal state here rather than a failure.
 */
export default function StaffPayroll() {
  const { role } = useLocalSearchParams();
  return <PayrollScreen homeRoute={`/staff/${String(role || '').toLowerCase()}`} />;
}
