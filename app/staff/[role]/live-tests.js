import { useLocalSearchParams } from 'expo-router';
import { LiveTestRoomsScreen } from '../../../components/staff';

/**
 * Live Test Rooms for the principal, vice principal and school counsellor (10 Oct 2026): any class
 * and section of their school. The principal and vice principal also follow every room of the
 * school, read-only. The server decides both (StaffScopeService, LiveTestRoomService.teacher).
 */
// `admin` (5 Nov 2026): the website's SchoolAdminDashboard mounts Live Test Rooms with oversight, as
// the Principal's does.
const HOSTS = ['principal', 'admin', 'vice_principal', 'counselor'];
const OVERSIGHT = ['principal', 'admin', 'vice_principal'];

export default function StaffLiveTests() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  if (!HOSTS.includes(roleKey)) return null; // the Shreyartha roles do not host rooms

  return <LiveTestRoomsScreen homeRoute={`/staff/${roleKey}`} oversight={OVERSIGHT.includes(roleKey)} />;
}
