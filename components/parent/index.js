/**
 * Native screens and chrome for the parent panel.
 *
 * Kept separate from components/staff and components/student because the panels differ in shell,
 * not in kit: the shared kit in components/ui serves all three, since it reads PaletteContext.
 *
 * NOTE, carried over from the counsellor pass: this is a barrel, and in this repo a barrel import
 * is an app-wide import. Anything added here is pulled into expo-router's route scan, so never
 * re-export a module whose body touches a native module at import time.
 */
export { default as ParentMenuScreen } from './ParentMenuScreen';
export { default as ParentPendingScreen } from './ParentPendingScreen';
export { default as ParentChangePasswordScreen } from './ParentChangePasswordScreen';
export { default as ParentFeatureScreen } from './ParentFeatureScreen';
export { default as CounselorNotesScreen } from './CounselorNotesScreen';
export { default as AssessmentResultsScreen } from './AssessmentResultsScreen';
export { default as ParentCalendarScreen } from './ParentCalendarScreen';
export { default as CounsellorReportScreen } from './CounsellorReportScreen';
export { default as AcademicProgressScreen } from './AcademicProgressScreen';
export { default as FeesScreen } from './FeesScreen';
export { default as LearningActivitiesScreen } from './LearningActivitiesScreen';
