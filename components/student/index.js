/**
 * Native screens and chrome for the student panel.
 *
 * Kept separate from components/staff because the visual language differs: student screens are
 * translucent cards on a fixed photographic background, staff screens are opaque cards on a slate
 * page. The shared kit in components/ui serves both — it reads PaletteContext.
 *
 * NOTE, from the counsellor pass: this is a barrel, and in this repo a barrel import is an
 * app-wide import. Anything added here is pulled into expo-router's route scan, so never re-export
 * a module whose body touches a native module at import time.
 */
export { default as StudentHome } from './StudentHome';
export { default as StudentHeader } from './StudentHeader';
export { default as StudentScaffold } from './StudentScaffold';
export { default as StudentFeatureScreen } from './StudentFeatureScreen';
export { StudentCard, StudentCardTitle, StudentInfoRow } from './StudentCard';
export { default as ProfileScreen } from './ProfileScreen';
export { default as StudentChangePasswordScreen } from './StudentChangePasswordScreen';
export { default as CounselorScreen } from './CounselorScreen';
export { default as EventsScreen } from './EventsScreen';
export { default as AnalyticsScreen } from './AnalyticsScreen';
export { default as SubjectCareerScreen } from './SubjectCareerScreen';
export { default as SkillsEdgeScreen } from './SkillsEdgeScreen';
export { default as LimitedAccessNote } from './LimitedAccessNote';
export { default as PsychometricScreen } from './PsychometricScreen';
export { default as AcademicIqScreen } from './AcademicIqScreen';
export { default as CodingProScreen } from './CodingProScreen';
export { default as LanguageProScreen } from './LanguageProScreen';
