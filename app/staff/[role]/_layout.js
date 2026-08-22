import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { staffPalette } from '../../../constants/theme';
import { api } from '../../../services/apiService';
import { getStaffRoleConfig } from '../../../constants/staffRoles';
import { PaletteProvider } from '../../../components/ui/PaletteContext';

/**
 * Route guard for the config-driven staff shells (counselor, principal, vice_principal and the
 * three Shreyartha roles) — the same contract as app/teacher/_layout.js, with the admitted role
 * taken from the [role] URL segment.
 *
 * A user whose stored role doesn't match the segment is sent to their own shell, so a stale deep
 * link can never show someone another role's menu.
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

  const [state, setState] = useState({ checking: true, token: null, storedRole: '' });

  useEffect(() => {
    let alive = true;

    (async () => {
      let entries = [];
      try {
        entries = await AsyncStorage.multiGet(['schoolUserToken', 'schoolUserType']);
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

  return (
    <PaletteProvider palette={palette}>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="self-attendance" />
      <Stack.Screen name="attendance" />
      <Stack.Screen name="counselling" />
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
      {/* Admin HR and fees, on /api/school-admin — Principal (all three) and VP (HR only). */}
      <Stack.Screen name="leave-management" />
      <Stack.Screen name="payroll-management" />
      <Stack.Screen name="fees" />
      <Stack.Screen name="student-analytics" />
      <Stack.Screen name="pending-verification" />
      <Stack.Screen name="change-password" />
      <Stack.Screen name="feature" />
    </Stack>
    </PaletteProvider>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
});
