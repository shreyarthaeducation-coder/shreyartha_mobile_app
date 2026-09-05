import { useLocalSearchParams } from 'expo-router';
import { StaffMenuScreen } from '../../../components/staff';
import StaffHomeScreen from '../../../components/staff/home/StaffHomeScreen';
import SalesTutorialGate from '../../../components/staff/sales/SalesTutorialGate';
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

  // The walkthrough is mounted HERE rather than inside StaffHomeScreen, which five roles share:
  // its onboarding check calls a /api/staff/sales endpoint, so every principal and counsellor
  // would otherwise 403 on every home-screen load. Gated on the role, it only ever runs for
  // someone authorised to make the call.
  const salesTutorial = roleKey === 'sales' ? <SalesTutorialGate /> : null;

  if (getStaffHome(roleKey)) {
    return (
      <>
        <StaffHomeScreen />
        {salesTutorial}
      </>
    );
  }

  return (
    <>
      <StaffMenuScreen config={config} />
      {salesTutorial}
    </>
  );
}
