import { AdaptiveAssessmentScreen } from '../../components/staff';

/**
 * Native My Adaptive Assessment — the per-topic switch between the company question bank and the
 * teacher's own set, plus the attempt reports.
 */
export default function TeacherAdaptiveAssessment() {
  return <AdaptiveAssessmentScreen homeRoute="/teacher" />;
}
