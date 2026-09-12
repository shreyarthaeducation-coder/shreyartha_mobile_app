/**
 * Shared native shell screens for school-staff roles.
 * Consumed by app/teacher/* and the config-driven app/staff/[role]/* group.
 */
export { default as StaffHeader } from './StaffHeader';
export { default as StaffFeatureScreen } from './StaffFeatureScreen';
export { default as StaffMenuScreen } from './StaffMenuScreen';
export { default as StaffProfileScreen } from './StaffProfileScreen';
export { default as StaffPendingScreen } from './StaffPendingScreen';
export { default as StaffChangePasswordScreen } from './StaffChangePasswordScreen';
export { default as SelfAttendanceScreen } from './SelfAttendanceScreen';
export { default as MarkAttendanceScreen } from './MarkAttendanceScreen';
export { default as StudentGroupsScreen } from './StudentGroupsScreen';
export { default as TeacherResourcesScreen } from './TeacherResourcesScreen';
export { default as SyllabusCompletionScreen } from './SyllabusCompletionScreen';
export { default as ManageSubjectsScreen } from './ManageSubjectsScreen';
export { default as LiveClassesScreen } from './LiveClassesScreen';
export { default as ExamsScreen } from './ExamsScreen';
export { default as AdaptiveAssessmentScreen } from './AdaptiveAssessmentScreen';
export { default as MyCalendarScreen } from './MyCalendarScreen';
export { default as LeaveScreen } from './LeaveScreen';
export { default as PayrollScreen } from './PayrollScreen';
export { default as CounsellorReportScreen } from './CounsellorReportScreen';
export { default as UpskillScreen } from './UpskillScreen';
export { default as CounsellingNotesScreen } from './CounsellingNotesScreen';
export { default as StudentAnalyticsScreen } from './StudentAnalyticsScreen';
export { default as ShreyaLauncher } from './ShreyaLauncher';
export { default as ShreyaChatSheet } from './ShreyaChatSheet';
export { default as ResourceViewerScreen } from './ai/ResourceViewerScreen';
export { default as CounsellorReportFormScreen } from './CounsellorReportFormScreen';
export { default as WellnessGroupsScreen } from './WellnessGroupsScreen';
export { default as QueriesScreen } from './QueriesScreen';
// Admin-flavoured panels (Principal now; Shreyartha Admin reuses these with its own apiBase).
export { default as AdminOverviewScreen } from './admin/AdminOverviewScreen';
export { default as LinkedCollegesScreen } from './admin/LinkedCollegesScreen';
export { default as AliasManagerScreen } from './admin/AliasManagerScreen';
export { default as StaffManagementScreen } from './admin/StaffManagementScreen';
export { default as StudentManagementScreen } from './admin/StudentManagementScreen';
export { default as StaffAttendanceScreen } from './admin/StaffAttendanceScreen';
export { default as EventManagementScreen } from './admin/EventManagementScreen';
export { default as StaffEvaluationScreen } from './admin/StaffEvaluationScreen';
export { default as ClassManagementScreen } from './admin/ClassManagementScreen';
export { default as ManageStudentsScreen } from './admin/ManageStudentsScreen';
export { default as GradeManagementScreen } from './admin/GradeManagementScreen';
export { default as AdminExamsScreen } from './admin/AdminExamsScreen';
export { default as AdminLeaveScreen } from './admin/AdminLeaveScreen';
export { default as AdminPayrollScreen } from './admin/AdminPayrollScreen';
export { default as FeeManagementScreen } from './admin/FeeManagementScreen';
export { default as StaffMeetingScreen } from './admin/StaffMeetingScreen';
export { initialsOf, prettyRole } from './helpers';
