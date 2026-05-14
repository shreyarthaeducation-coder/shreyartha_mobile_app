// app/dashboard/student.js
// This route now redirects to the native student panel (/student/).
// Kept as a thin redirect so that any existing links to /dashboard/student
// continue to work without breaking navigation history.

import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { STUDENT } from '../../constants/theme';

export default function StudentDashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Replace so the user cannot navigate back to this redirect shim.
    router.replace('/student/');
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={STUDENT.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: STUDENT.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
