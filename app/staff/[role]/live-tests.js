import { useLocalSearchParams } from 'expo-router';
import { LiveTestRoomsScreen } from '../../../components/staff';

/**
 * Live Test Rooms for the principal, vice principal and school counsellor (10 Oct 2026): any class
 * and section of their school. The principal and vice principal also follow every room of the
 * school, read-only. The server decides both (StaffScopeService, LiveTestRoomService.teacher).
 */
const HOSTS = ['principal', 'vice_principal', 'counselor'];
const OVERSIGHT = ['principal', 'vice_principal'];

export default function StaffLiveTests() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  if (!HOSTS.includes(roleKey)) return null; // the Shreyartha roles do not host rooms

  return <LiveTestRoomsScreen homeRoute={`/staff/${roleKey}`} oversight={OVERSIGHT.includes(roleKey)} />;
}
