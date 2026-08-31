import TeacherHomeScreen from '../../components/teacher/TeacherHomeScreen';

/**
 * Native teacher home.
 *
 * This used to be `StaffMenuScreen` with a `TEACHER_CONFIG`. That component still renders the
 * Principal, Vice-Principal, both Counsellor portals and Shreyartha Admin, and is deliberately
 * untouched — see the header of components/teacher/TeacherHomeScreen.js for why the teacher got its
 * own screen instead of the shared shell being redesigned under five other roles.
 *
 * By path, not through a barrel: a barrel import here is an app-wide import.
 */
export default function TeacherHome() {
  return <TeacherHomeScreen />;
}
