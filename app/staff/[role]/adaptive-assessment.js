import { useLocalSearchParams } from 'expo-router';
import { AdaptiveAssessmentScreen } from '../../../components/staff';

/**
 * My Adaptive Assessment — the per-topic switch between the company question bank and the staff
 * member's own set, plus the attempt reports. The same screen `app/teacher/adaptive-assessment.js`
 * renders; it takes nothing but a home route.
 *
 * ── SHREYARTHA TEACHER ONLY, AND NOT BY ACCIDENT ────────────────────────────
 * `TeacherPracticeQuestionController` is `hasAnyRole('TEACHER','VICE_PRINCIPAL')`. That admits this
 * role via SHREYARTHA_TEACHER → TEACHER, and it admits the Vice Principal by name — but the VP tile
 * was deliberately not added. Every other role that reaches this file gets `null`, which is how the
 * shared wrappers in this folder gate: an unlisted role renders nothing rather than a screen whose
 * every call refuses.
 *
 * Returning `null` rather than redirecting is the established shape here — the route is unreachable
 * from any menu, so the only way in is a hand-typed deep link.
 */
export default function StaffAdaptiveAssessment() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();

  if (roleKey !== 'shreyartha_teacher') return null;

  return <AdaptiveAssessmentScreen homeRoute={`/staff/${roleKey}`} />;
}
