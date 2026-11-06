import { useLocalSearchParams } from 'expo-router';
import MyTeamScreen from '../../../components/staff/team/MyTeamScreen';

/**
 * My Team — anyone who is someone's reporting manager (the Manager login and HR). The server answers
 * only for the caller's own direct reports, and an empty team for anyone else, so the route needs no
 * role list of its own: the menu decides who sees the tile.
 */
export default function StaffMyTeam() {
  const { role } = useLocalSearchParams();
  return <MyTeamScreen homeRoute={`/staff/${String(role || '').toLowerCase()}`} />;
}
