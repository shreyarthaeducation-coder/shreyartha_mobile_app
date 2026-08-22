import { TeacherResourcesScreen } from '../../components/staff';

/**
 * Native Homework — Assign + Submitted.
 * Same screen as app/teacher/resources.js, switched by `group`, mirroring the web's single
 * AssignHomework component behind two sidebar entries.
 */
export default function TeacherHomework() {
  return <TeacherResourcesScreen group="homework" homeRoute="/teacher" />;
}
