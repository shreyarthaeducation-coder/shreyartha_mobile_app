import { ParentCalendarScreen } from '../../components/parent';

/**
 * Schedule — the same month grid, leading with the event feed instead of the attendance summary.
 * The web's Schedule page is strictly weaker than its Attendance page (no month picker, no event
 * badges, no holiday styling, and it fetches every event ever rather than the month's); sharing
 * one component gives it all of those.
 */
export default function ParentSchedule() {
  return <ParentCalendarScreen mode="schedule" />;
}
