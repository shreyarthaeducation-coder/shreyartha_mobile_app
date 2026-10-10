import { StudentStatusScreen } from '../../components/staff';

/**
 * Student Status (10 Oct 2026): how far each student of the teacher's own sections has got, from the
 * overview down to a single topic. The server decides which sections a teacher may open.
 */
export default function TeacherStudentStatus() {
  return <StudentStatusScreen homeRoute="/teacher" />;
}
