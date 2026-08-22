import { useLocalSearchParams } from 'expo-router';
import { SyllabusCompletionScreen } from '../../../components/staff';
import { SHREYA01_TEACHER } from '../../../constants/shreya01TeacherPortal';
import { isVicePrincipal } from '../../../constants/vicePrincipalPortal';

/**
 * Syllabus Completion — Shreyartha teacher and vice principal.
 *
 * Portal B is scoped to one school+class; the VP takes the Portal A shape, where one unscoped
 * GET /api/teacher/syllabus-completion returns the whole assignment set. The response DTO is
 * identical either way, so the screen below the fetch is shared.
 */
export default function StaffSyllabus() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();

  // The web renders SyllabusCompletion unchanged for a VP — the defaults are already right.
  if (isVicePrincipal(roleKey)) {
    return <SyllabusCompletionScreen homeRoute={`/staff/${roleKey}`} />;
  }

  if (roleKey !== SHREYA01_TEACHER.key) return null; // the layout guard has already redirected

  return (
    <SyllabusCompletionScreen
      homeRoute={`/staff/${roleKey}`}
      scopeKind={SHREYA01_TEACHER.scope}
      schoolsEndpoint={SHREYA01_TEACHER.syllabus.schools}
    />
  );
}
