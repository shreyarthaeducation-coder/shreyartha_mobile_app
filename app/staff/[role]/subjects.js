import { useLocalSearchParams } from 'expo-router';
import { ManageSubjectsScreen } from '../../../components/staff';
import { SHREYA01_TEACHER } from '../../../constants/shreya01TeacherPortal';

/**
 * Manage Subjects — Shreyartha teacher only. No other staff role has this tab, and no other
 * portal has the endpoints.
 */
export default function StaffSubjects() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  if (roleKey !== SHREYA01_TEACHER.key) return null; // the layout guard has already redirected

  return (
    <ManageSubjectsScreen
      homeRoute={`/staff/${roleKey}`}
      schoolsEndpoint={SHREYA01_TEACHER.subjects.schools}
    />
  );
}
