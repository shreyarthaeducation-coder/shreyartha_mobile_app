import { TeacherResourcesScreen } from '../../components/staff';

/**
 * Native My Teaching Resources — My Resources + Mark Completed.
 * Same screen as app/teacher/homework.js, switched by `group`.
 */
export default function TeacherResources() {
  return <TeacherResourcesScreen group="resources" homeRoute="/teacher" />;
}
