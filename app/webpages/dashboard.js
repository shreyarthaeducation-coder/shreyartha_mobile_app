import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoadingScreen from '../components/LoadingScreen';

/**
 * Native dashboard router.
 * Reads userType from route params (set by auth screens) or falls back
 * to AsyncStorage, then redirects to the correct native dashboard screen.
 * No WebView is used.
 */
export default function DashboardRouter() {
  const { userType: paramUserType } = useLocalSearchParams();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const redirect = async () => {
      let type = paramUserType;

      if (!type) {
        try {
          type = await AsyncStorage.getItem('userType');
        } catch {
          type = null;
        }
      }

      if (cancelled) return;

      const routes = {
        student:  '/screens/dashboard/StudentDashboard',
        school:   '/screens/dashboard/SchoolDashboard',
        parent:   '/screens/dashboard/ParentDashboard',
        admin:    '/screens/dashboard/AdminDashboard',
      };

      const destination = routes[type] || routes.student;
      router.replace(destination);
    };

    redirect();
    return () => { cancelled = true; };
  }, [paramUserType, router]);

  return <LoadingScreen message="Redirecting to dashboard…" />;
}
