import { useLocalSearchParams } from 'expo-router';
import { CounsellingNotesScreen } from '../../../components/staff';
import { resolveFeatureScope } from '../../../constants/staffScope';
import { SHREYA01_TEACHER } from '../../../constants/shreya01TeacherPortal';
import { isVicePrincipal } from '../../../constants/vicePrincipalPortal';

/**
 * Counselling Needs and Notes.
 *
 * The `role` prop is not cosmetic: it decides how many counselling types the picker offers, and
 * the portals genuinely differ.
 *
 *   counsellor shells      8 types  — the web's shared CounsellingNotes passes its own role
 *   Shreyartha teacher     2 types  — ShreyarthaCounselling calls getCounsellingTypesForRole("teacher")
 *   vice principal         2 types  — VicePrincipalDashboard renders TeacherCounsellingNotes,
 *                                     which passes role="teacher" to the same shared component
 *
 * The server's ALLOWED_TYPES agrees with all three, so offering a counsellor's eight here would
 * surface six types the role cannot actually save.
 */
export default function StaffCounselling() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  const scope = resolveFeatureScope(roleKey, 'counselling');
  if (!scope) return null; // the layout guard has already redirected

  const teacherFlavoured = roleKey === SHREYA01_TEACHER.key || isVicePrincipal(roleKey);

  return (
    <CounsellingNotesScreen
      homeRoute={`/staff/${roleKey}`}
      role={teacherFlavoured ? 'teacher' : 'counselor'}
      apiBase={scope.apiBase}
      scopeKind={scope.scopeKind}
      schoolsEndpoint={scope.schoolsEndpoint}
    />
  );
}
