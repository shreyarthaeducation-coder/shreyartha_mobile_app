import TeacherAttendanceHubScreen from '../../components/teacher/TeacherAttendanceHubScreen';

/**
 * By path, not through a barrel: a barrel import here is an app-wide import, and expo-router scans
 * every route file.
 */
export default function TeacherRoute() {
  return <TeacherAttendanceHubScreen />;
}
