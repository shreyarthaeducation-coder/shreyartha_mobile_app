// app/dashboard/student.js
// This route now redirects to the native student panel (/student/).
// Kept as a thin redirect so that any existing links to /dashboard/student
// continue to work without breaking navigation history.

import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { PORTALS } from '../../constants/theme';

export default function StudentDashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Replace so the user cannot navigate back to this redirect shim.
    router.replace('/student/');
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={PORTALS.student.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // The student panel's own page colour. It used to paint the legacy dark theme's #0a0f1e,
    // which now flashes dark for a frame before replacing into a light panel.
    backgroundColor: PORTALS.student.pageBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
