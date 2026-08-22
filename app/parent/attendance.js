import { ParentCalendarScreen } from '../../components/parent';

/**
 * Attendance — the month grid with presence dots, leading with the present/absent summary.
 * Same component as Schedule; see ParentCalendarScreen for why the web's two pages became one.
 */
export default function ParentAttendance() {
  return <ParentCalendarScreen mode="attendance" />;
}
