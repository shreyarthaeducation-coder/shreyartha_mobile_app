import { useLocalSearchParams } from 'expo-router';
import { TeacherResourcesScreen } from '../../../components/staff';
import { SHREYA01_TEACHER } from '../../../constants/shreya01TeacherPortal';

/** Resources — the same screen as Homework with `group="resources"`. See homework.js. */
export default function StaffResources() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  if (roleKey !== SHREYA01_TEACHER.key) return null; // the layout guard has already redirected

  return (
    <TeacherResourcesScreen
      group="resources"
      homeRoute={`/staff/${roleKey}`}
      scopeKind={SHREYA01_TEACHER.scope}
      schoolsEndpoint={SHREYA01_TEACHER.homework.schools}
    />
  );
}
