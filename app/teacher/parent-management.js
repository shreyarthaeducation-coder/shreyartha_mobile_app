import ParentManagementScreen from '../../components/staff/parents/ParentManagementScreen';

/** Parent Management (6 Nov 2026) — the class teacher's: only the sections they are class teacher of. */
export default function TeacherParentManagement() {
  return <ParentManagementScreen mode="teacher" homeRoute="/teacher" />;
}
