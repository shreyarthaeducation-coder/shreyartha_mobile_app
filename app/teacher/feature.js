import { useLocalSearchParams } from 'expo-router';
import { StaffFeatureScreen } from '../../components/staff';
import { TEACHER_BASE } from '../../constants/teacherMenu';

/**
 * Teacher features that aren't native yet — thin wrapper over the shared staff WebView shell.
 * Params: ?label=<header title>&path=<web path under shreyartha.com>
 */
export default function TeacherFeatureScreen() {
  const { label = 'Dashboard', path = TEACHER_BASE } = useLocalSearchParams();
  return (
    <StaffFeatureScreen
      label={label}
      path={path}
      homeRoute="/teacher"
      defaultUserType="TEACHER"
    />
  );
}
