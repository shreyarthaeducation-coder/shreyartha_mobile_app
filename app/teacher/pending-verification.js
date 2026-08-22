import { StaffPendingScreen } from '../../components/staff';

/**
 * Shown when a teacher logs in before their school admin has verified the account — thin
 * wrapper over the shared staff pending screen.
 */
const UNLOCKS = [
  'Access your profile and classes',
  'Assign homework to students',
  'Upload resources and track syllabus completion',
];

export default function TeacherPendingVerification() {
  return <StaffPendingScreen roleLabel="Teacher" unlocks={UNLOCKS} />;
}
