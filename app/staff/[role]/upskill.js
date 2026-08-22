import { useLocalSearchParams } from 'expo-router';
import { UpskillScreen } from '../../../components/staff';

/**
 * Upskill Your Self for any staff shell.
 *
 * `/api/teacher-skillsedge/*` is guarded `hasRole('ADMIN') or hasRole('TEACHER') or
 * hasRole('VICE_PRINCIPAL') or hasRole('PRINCIPAL')` and names no SHREYARTHA role — but
 * `SHREYARTHA_TEACHER` **implies TEACHER** in the role hierarchy (SecurityConfig.roleHierarchy),
 * so it passes. The web relies on the same implication: ShreyarthaTeacherDashboard imports
 * TeacherUpskill unchanged.
 */
export default function StaffUpskill() {
  const { role } = useLocalSearchParams();
  return <UpskillScreen homeRoute={`/staff/${String(role || '').toLowerCase()}`} />;
}
