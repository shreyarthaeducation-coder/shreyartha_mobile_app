import { useLocalSearchParams } from 'expo-router';
import { PayrollScreen } from '../../../components/staff';

/** Payroll Management — same guard and same sidebar rule as leave.js. */
export default function StaffPayroll() {
  const { role } = useLocalSearchParams();
  return <PayrollScreen homeRoute={`/staff/${String(role || '').toLowerCase()}`} />;
}
