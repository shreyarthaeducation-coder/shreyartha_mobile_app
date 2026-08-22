import { useLocalSearchParams } from 'expo-router';
import { LeaveScreen } from '../../../components/staff';

/**
 * Leave Management. `/api/staff/hr/*` names SHREYARTHA_TEACHER explicitly in its class-level
 * guard, so no role juggling is needed.
 *
 * Only the two TEACHER sidebars carry HR on the web — the counsellor, principal and VP panels have
 * no HR route at all, which is why their menus omit it rather than hiding it.
 */
export default function StaffLeave() {
  const { role } = useLocalSearchParams();
  return <LeaveScreen homeRoute={`/staff/${String(role || '').toLowerCase()}`} />;
}
