import { StudentGroupsScreen } from '../../components/staff';

/**
 * Native Create Group — thin wrapper over the shared staff screen.
 * Reads GET /api/teacher/groups/{classes,students} and GET /api/teacher/groups;
 * writes POST /save, PUT /{groupId}, DELETE /{groupId}.
 */
export default function TeacherStudentGroups() {
  return <StudentGroupsScreen homeRoute="/teacher" />;
}
