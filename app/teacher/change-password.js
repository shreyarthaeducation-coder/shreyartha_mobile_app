import { StaffChangePasswordScreen } from '../../components/staff';

/** Native change password for teachers — POST /api/school/change-password. */
export default function TeacherChangePassword() {
  return <StaffChangePasswordScreen homeRoute="/teacher" />;
}
