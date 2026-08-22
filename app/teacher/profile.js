import { StaffProfileScreen } from '../../components/staff';

/**
 * Native teacher profile — thin wrapper over the shared staff profile screen.
 * Reads GET /api/teacher/profile (TeacherProfileResponse), falling back to the values cached at
 * login so the screen still renders something useful offline.
 */
export default function TeacherProfile() {
  return (
    <StaffProfileScreen
      endpoints={['/api/teacher/profile']}
      homeRoute="/teacher"
      roleLabel="Teacher"
      // Only the teacher panel gets the editable tabs; the app/staff/[role] shells stay read-only
      // until each role's web parity is checked.
      showAcademic
      showHr
    />
  );
}
