import { SyllabusCompletionScreen } from '../../components/staff';

/** Native Syllabus Completion — one call to /api/teacher/syllabus-completion drives the whole tree. */
export default function TeacherSyllabus() {
  return <SyllabusCompletionScreen homeRoute="/teacher" />;
}
