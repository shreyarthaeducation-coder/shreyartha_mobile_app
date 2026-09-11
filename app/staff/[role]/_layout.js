import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect, Stack, useLocalSearchParams, usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { staffPalette } from '../../../constants/theme';
import { api } from '../../../services/apiService';
import { getStaffRoleConfig } from '../../../constants/staffRoles';
import { PaletteProvider } from '../../../components/ui/PaletteContext';
import PortalTabBar, {
  isTabRoot,
  staffFabFor,
  staffTabsFor,
} from '../../../components/shared/home/PortalTabBar';

/**
 * Route guard for the config-driven staff shells (counselor, principal, vice_principal and the
 * three Shreyartha roles) — the same contract as app/teacher/_layout.js, with the admitted role
 * taken from the [role] URL segment.
 *
 * A user whose stored role doesn't match the segment is sent to their own shell, so a stale deep
 * link can never show someone another role's menu.
 *
 * ── THE VERIFICATION GATE, WHICH THIS GROUP NEVER HAD ───────────────────────
 * `app/teacher/_layout.js` has gated its whole group on `schoolUserVerified` since the teacher
 * redesign. This layout read only the token and the role, so the ONLY verification check for all
 * six staff shells lived inside `StaffMenuScreen` — covering the home screen and none of the other
 * thirty-seven routes registered below.
 *
 * Login sends an unverified staff member to the pending screen, so nothing routine landed them
 * elsewhere. But a deep link, a back-stack pop, or a chatbot route straight to
 * `/staff/vice_principal/attendance` put them on a full, working-looking screen whose every call
 * 403s — with no error anywhere, because a refused list renders as an empty one. Gating here covers
 * the whole group at once, exactly as the teacher's does.
 *
 * `schoolUserVerified` is written for every school role at login by `services/schoolSession.js`,
 * where an ABSENT flag deliberately means NOT verified — so this gate cannot be defeated by a
 * response that simply omits it.
 *
 * The pending screen is itself in this group and must be exempt, or the redirect loops. Nothing
 * else is exempt: unlike the parent shell, the staff pending screen offers only Log Out, so there
 * is no second route an unverified staff member needs to reach.
 */

const BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  Constants.expoConfig?.extra?.apiBaseUrl ||
  'https://shreyartha.com'
).replace(/\/+$/, '');

export default function StaffRoleLayout() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  const config = getStaffRoleConfig(roleKey);

  // Drives the verification gate only. Read here rather than inside each screen so one check
  // covers all thirty-eight routes registered below.
  const pathname = usePathname();

  const [state, setState] = useState({
    checking: true,
    token: null,
    storedRole: '',
    verified: false,
  });

  useEffect(() => {
    let alive = true;

    (async () => {
      let entries = [];
      try {
        entries = await AsyncStorage.multiGet([
          'schoolUserToken',
          'schoolUserType',
          'schoolUserVerified',
        ]);
      } catch {
        // Fall through with empty values — treated as "no session".
      }
      if (!alive) return;

      const values = Object.fromEntries(entries);
      const token = values.schoolUserToken || null;
      setState({
        checking: false,
        token,
        storedRole: String(values.schoolUserType || '').toLowerCase(),
        // Anything other than the literal 'true' is unverified, matching both the web and the way
        // schoolSession.js writes it. '1' is accepted too because TeacherHomeScreen tolerates it.
        verified: values.schoolUserVerified === 'true' || values.schoolUserVerified === '1',
      });

      if (!token) return;

      // Web-parity liveness check. Non-blocking: a 401 lets apiService clear the session and
      // redirect on its own, so we don't duplicate that logic here.
      api.get('/api/school/auth/check').catch(() => {});

      // The web shreyartha_teacher shell fires this on every load to sync SchoolClass/Section
      // rows from student data. Raw fetch on purpose: apiService force-logs-out on any non-auth
      // 401/403, and this ping must never be able to end a session.
      if (roleKey === 'shreyartha_teacher') {
        fetch(`${BASE_URL}/api/shreya01/setup`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    })();

    return () => {
      alive = false;
    };
  }, [roleKey]);

  if (!config) return <Redirect href="/auth/school-login" />;

  // Each panel wears its own web accent — counsellors purple, principal red, vice principal
  // orange, everyone else the staff teal. `staffPalette` falls back to teal for any unlisted role,
  // and PaletteProvider defaults to teal too, so no other shell — and certainly not app/teacher,
  // which has no provider — can be affected by this. Resolved before the early returns so the very
  // first spinner is already the right colour: the role comes from the URL, not the session.
  const palette = staffPalette(roleKey);

  if (state.checking) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  if (!state.token) return <Redirect href="/auth/school-login" />;
  if (state.storedRole && state.storedRole !== roleKey) {
    if (state.storedRole === 'teacher') return <Redirect href="/teacher" />;
    if (getStaffRoleConfig(state.storedRole)) {
      return <Redirect href={`/staff/${state.storedRole}`} />;
    }
    return <Redirect href="/auth/school-login" />;
  }

  // See the docblock. The pending screen is in this group, so exempting it is what stops the
  // redirect looping on itself.
  const pendingRoute = `/staff/${roleKey}/pending-verification`;
  if (!state.verified && pathname !== pendingRoute) {
    return <Redirect href={pendingRoute} />;
  }

  // The footer, for the redesigned shells only. `staffTabsFor` returns [] for every other role and
  // `isTabRoot(pathname, [])` is false, so nothing renders and no unredesigned panel gains a bar it
  // never padded for.
  //
  // Read here rather than inside PortalTabBar so the bar is not mounted at all on the inner
  // screens — an absolutely-positioned View over a scroll area still eats touches along its edge
  // even when it renders nothing.
  const tabs = staffTabsFor(roleKey);
  // The raised centre button. Null for every role without one, and PortalTabBar then renders the
  // plain bar it always did. Its destination is deliberately not in `tabs` — see STAFF_FABS.
  const fab = staffFabFor(roleKey);

  return (
    <PaletteProvider palette={palette}>
    <View style={styles.shell}>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      {/* The redesigned shell: a hero grid, the self-service HR hub and the support tab.
          Each returns null for a role with no constants/staffHome.js descriptor. */}
      <Stack.Screen name="workspace" />
      <Stack.Screen name="my-attendance" />
      {/* The multi-tile hero hub. One route, not one per hero — see admin-hub.js. */}
      <Stack.Screen name="admin-hub" />
      <Stack.Screen name="support" />
      {/* The staff inbox behind the bell. Registered for every role, like every other screen in
          this group — the bell itself only appears on the panels that pass BrandBar a `bell`. */}
      <Stack.Screen name="notifications" />
      <Stack.Screen name="search" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="self-attendance" />
      <Stack.Screen name="attendance" />
      <Stack.Screen name="counselling" />
      {/* The face-to-face room — the counsellor FAB's destination. Registered for every role like
          everything else in this group; the screen returns null for a role with no counsellor
          portal, which is what keeps the other four panels unaffected. */}
      <Stack.Screen name="face-to-face" />
      <Stack.Screen name="counsellor-report" />
      <Stack.Screen name="groups" />
      <Stack.Screen name="queries" />
      <Stack.Screen name="my-calendar" />
      {/* Live Counselling for the Shreyartha counsellor — same screen, see the wrapper. */}
      <Stack.Screen name="live-classes" />
      {/* Shreyartha teacher (Portal B). Screens are registered for all roles because this is a
          dynamic route; the menu in constants/staffRoles.js decides who actually sees them.
          `subjects` exists only here; the rest are shared with another portal. */}
      <Stack.Screen name="homework" />
      <Stack.Screen name="resources" />
      <Stack.Screen name="syllabus" />
      <Stack.Screen name="subjects" />
      <Stack.Screen name="upskill" />
      {/* Shreyartha teacher only — the wrapper returns null for every other role. */}
      <Stack.Screen name="adaptive-assessment" />
      {/* Vice principal: the teacher exam screen, on a route the other shells don't use. */}
      <Stack.Screen name="reports" />
      {/* Principal (and later the Shreyartha admin): the admin-flavoured pages. */}
      <Stack.Screen name="overview" />
      <Stack.Screen name="linked-colleges" />
      <Stack.Screen name="staff" />
      <Stack.Screen name="students" />
      <Stack.Screen name="staff-attendance" />
      <Stack.Screen name="events" />
      <Stack.Screen name="staff-evaluation" />
      <Stack.Screen name="classes" />
      {/* `reports` is the VP's teacher exam screen; the principal's admin one is separate. */}
      <Stack.Screen name="admin-reports" />
      <Stack.Screen name="live-meeting" />
      <Stack.Screen name="academic-iq-aliases" />
      <Stack.Screen name="language-pro-aliases" />
      <Stack.Screen name="coding-pro-aliases" />
      {/* Self-service HR, on /api/staff/hr — the two teacher panels. */}
      <Stack.Screen name="leave" />
      <Stack.Screen name="payroll" />
      {/* My Expenses, on /api/staff/travel-expenses — sales, Shreyartha teacher and Shreyartha
          counsellor. Not in the sales block below: it serves all three Shreyartha shells. */}
      <Stack.Screen name="travel-expenses" />
      {/* Admin HR and fees, on /api/school-admin — Principal (all three) and VP (HR only). */}
      <Stack.Screen name="leave-management" />
      <Stack.Screen name="payroll-management" />
      <Stack.Screen name="fees" />
      <Stack.Screen name="student-analytics" />
      {/* Sales. Every one of these is sales-only — no other role's menu references them, so an
          unregistered name here is an expo-router unmatched route on that panel and nowhere else,
          which is exactly the silent break scripts/checksales.mjs asserts against. */}
      <Stack.Screen name="sales-dashboard" />
      <Stack.Screen name="sales-leads" />
      <Stack.Screen name="sales-visits" />
      <Stack.Screen name="sales-schools" />
      <Stack.Screen name="sales-deals" />
      <Stack.Screen name="sales-incentive" />
      <Stack.Screen name="sales-reports" />
      <Stack.Screen name="sales-tutorial" />
      <Stack.Screen name="pending-verification" />
      <Stack.Screen name="change-password" />
      <Stack.Screen name="feature" />
    </Stack>

    {/* tone="light" like every staff BrandBar: these palettes carry none of the dark-glass tokens
        the bar's default styles read, and an undefined colour renders as unset, not as an error. */}
    {isTabRoot(pathname, tabs) ? <PortalTabBar tabs={tabs} tone="light" fab={fab} /> : null}
    </View>
    </PaletteProvider>
  );
}

const styles = StyleSheet.create({
  // The footer is absolutely positioned over the navigator, so the Stack needs a positioned parent.
  shell: { flex: 1 },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
});
