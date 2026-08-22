import { useLocalSearchParams } from 'expo-router';
import { LiveClassesScreen } from '../../../components/staff';
import { getCounsellorPortal } from '../../../constants/counsellorPortals';
import { SHREYA01_TEACHER } from '../../../constants/shreya01TeacherPortal';
import { isVicePrincipal } from '../../../constants/vicePrincipalPortal';

/**
 * Live Classes (Portal A counsellor, Shreyartha teacher, vice principal) and Live Counselling
 * (Shreyartha counsellor) — the same screen.
 *
 * All three hit the identical `/api/shreya01/live-sessions/*` endpoints; only the list of schools
 * and the wording differ, which is why the web's `Shreya01LiveCounselling` is a near-copy of
 * `Shreya01LiveClasses`. `Shreya01LiveSessionController` guards every method with
 * `hasRole('COUNSELOR') or hasRole('SHREYARTHA_COUNCELLOR') or hasRole('SHREYARTHA_COUNSELLOR')`,
 * and the teacher roles reach it through their own guard — so all three portals arrive unchanged.
 */
export default function StaffLiveClasses() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();

  // The web renders Shreya01LiveClasses unchanged for a VP, and every method on
  // Shreya01LiveSessionController names VICE_PRINCIPAL explicitly. fetchLiveSchools defaults to
  // /api/shreya01/schools, which is what that page uses.
  if (isVicePrincipal(roleKey)) {
    return <LiveClassesScreen homeRoute={`/staff/${roleKey}`} />;
  }

  if (roleKey === SHREYA01_TEACHER.key) {
    return (
      <LiveClassesScreen
        homeRoute={`/staff/${roleKey}`}
        schoolsEndpoint={SHREYA01_TEACHER.liveSchools}
      />
    );
  }

  const portal = getCounsellorPortal(roleKey);
  if (!portal) return null; // the layout guard has already redirected

  const counselling = portal.hasLiveCounselling;

  return (
    <LiveClassesScreen
      homeRoute={`/staff/${roleKey}`}
      title={counselling ? 'Live Counselling' : 'Live Classes'}
      createLabel={counselling ? 'Schedule a counselling session' : 'Schedule a live class'}
      schoolsEndpoint={portal.liveSessionScope}
    />
  );
}
