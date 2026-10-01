// By path, not through the staff barrel: in this repo a barrel import is an app-wide import.
import CounsellingNotesScreen from '../../components/staff/CounsellingNotesScreen';

/**
 * Native Counselling Needs and Notes — academic and parent sessions. A Student Support tile of its
 * own again since 1 Oct 2026, beside the Counselling Report (it was that screen's middle tab from
 * 29 Sep; `/teacher/counselling-report?tab=notes` now redirects here).
 */
export default function TeacherCounselling() {
  return <CounsellingNotesScreen homeRoute="/teacher" />;
}
