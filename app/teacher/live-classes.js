import { LiveClassesScreen } from '../../components/staff';

/**
 * Native Live Classes — Google Meet sessions via /api/shreya01/live-sessions.
 * The one screen here that is already Portal-B shaped, so the Shreyartha Teacher shell could
 * reuse it almost as-is.
 */
export default function TeacherLiveClasses() {
  return <LiveClassesScreen homeRoute="/teacher" />;
}
