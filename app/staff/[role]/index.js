import { useLocalSearchParams } from 'expo-router';
import { StaffMenuScreen } from '../../../components/staff';
import StaffHomeScreen from '../../../components/staff/home/StaffHomeScreen';
import { resolveStaffMenus } from '../../../constants/staffRoles';
import { getStaffHome } from '../../../constants/staffHome';

/**
 * The staff dashboard — one of two screens, chosen by whether the role has been redesigned.
 *
 * A role with a `constants/staffHome.js` descriptor renders the new `StaffHomeScreen`: identity
 * card, three heroes, a footer. Every other role keeps `StaffMenuScreen` — the WelcomeHeader and
 * tile grid — byte for byte.
 *
 * **The descriptor's absence is the switch**, and that is deliberate: `getStaffHome` returns null
 * for anything it does not know, so a role is opted IN by adding a descriptor rather than opted out
 * by remembering to exclude it. Principal and Shreyartha Admin cannot be affected by a redesign
 * phase they were not part of.
 *
 * `StaffHomeScreen` is imported BY PATH rather than through `components/staff` — expo-router scans
 * every route file, so a barrel import here becomes an app-wide import. That barrel boot-crashed
 * the whole app once, via a top-level react-native-pdf import reached through it.
 */
export default function StaffHome() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  const config = resolveStaffMenus(roleKey);
  if (!config) return null; // the layout guard has already redirected

  if (getStaffHome(roleKey)) return <StaffHomeScreen />;

  return <StaffMenuScreen config={config} />;
}
