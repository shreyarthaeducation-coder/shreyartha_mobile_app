import { useLocalSearchParams } from 'expo-router';
import { ExamsScreen } from '../../../components/staff';
import { isVicePrincipal } from '../../../constants/vicePrincipalPortal';

/**
 * Test and Examination — vice principal.
 *
 * The web renders TeacherReports unchanged inside the VP dashboard, and TeacherReportController
 * is annotated `hasAnyRole('TEACHER','VICE_PRINCIPAL')` at CLASS level — the VP is named there
 * explicitly rather than arriving through the role hierarchy. So the teacher screen serves this
 * role with nothing but a different home route.
 *
 * Like teachers, a VP cannot create, edit or delete exams; those belong to the School Admin and
 * the Principal.
 */
export default function StaffReports() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  if (!isVicePrincipal(roleKey)) return null; // no other shell has this tab

  return <ExamsScreen homeRoute={`/staff/${roleKey}`} />;
}
