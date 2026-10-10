import { useLocalSearchParams } from 'expo-router';
import { StudentStatusScreen } from '../../../components/staff';

/**
 * Student Status (10 Oct 2026) for the principal, vice principal, both counsellors and the
 * Shreyartha teacher — their whole school (a Shreyartha counsellor: their linked schools). The server
 * decides which sections each may open (StaffScopeService), by account type.
 */
const ROLES = ['principal', 'vice_principal', 'counselor', 'shreyartha_councellor', 'shreyartha_teacher'];

export default function StaffStudentStatus() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  if (!ROLES.includes(roleKey)) return null; // sales, HR and the Shreyartha admin have no classes

  return <StudentStatusScreen homeRoute={`/staff/${roleKey}`} />;
}
