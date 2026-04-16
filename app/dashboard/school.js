import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { useAuth } from '../../context/AuthContext';

const BASE_URL = 'https://shreyartha.com';
const MOBILE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

const roleToPath = {
  teacher: '/school/platform/teacher/dashboard',
  counselor: '/school/platform/counselor/dashboard',
  principal: '/school/platform/principal/dashboard',
  vice_principal: '/school/platform/vice_principal/dashboard',
  admin: '/school/platform/admin/dashboard',
};

const getInjectedJS = (values) => `
(function() {
  var values = ${JSON.stringify(values)};
  Object.keys(values).forEach(function(key) {
    if (values[key] !== null && values[key] !== undefined) {
      localStorage.setItem(key, String(values[key]));
    }
  });
})();
true;
`;

export default function SchoolDashboard() {
  const router = useRouter();
  const { logout } = useAuth();
  const webViewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [injectValues, setInjectValues] = useState(null);
  const [dashboardUrl, setDashboardUrl] = useState(`${BASE_URL}${roleToPath.teacher}`);

  useEffect(() => {
    const loadStorage = async () => {
      const entries = await AsyncStorage.multiGet([
        'schoolUserToken',
        'schoolLoggedIn',
        'schoolUserType',
        'schoolUserName',
        'schoolUserEmail',
        'schoolCode',
      ]);
      const values = Object.fromEntries(entries);
      const role = (values.schoolUserType || 'teacher').toLowerCase();
      const rolePath = roleToPath[role] || roleToPath.teacher;

      setDashboardUrl(`${BASE_URL}${rolePath}`);
      setInjectValues({
        schoolUserToken: values.schoolUserToken || '',
        schoolLoggedIn: values.schoolLoggedIn || 'true',
        schoolUserType: values.schoolUserType || 'TEACHER',
        schoolUserName: values.schoolUserName || '',
        schoolUserEmail: values.schoolUserEmail || '',
        schoolCode: values.schoolCode || '',
      });
    };

    loadStorage();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      router.replace('/(tabs)');
      return true;
    });

    return () => sub.remove();
  }, [canGoBack, router]);

  const handleLogoutNav = async (url) => {
    if (url.includes('/schoollogin')) {
      await logout();
      router.replace('/(tabs)');
    }
  };

  const injectedBeforeLoad = useMemo(() => {
    if (!injectValues) return 'true;';
    return getInjectedJS(injectValues);
  }, [injectValues]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {injectValues ? (
        <WebView
          ref={webViewRef}
          source={{ uri: dashboardUrl }}
          userAgent={MOBILE_USER_AGENT}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          originWhitelist={['*']}
          setSupportMultipleWindows={false}
          injectedJavaScriptBeforeContentLoaded={injectedBeforeLoad}
          onNavigationStateChange={(navState) => {
            setCanGoBack(navState.canGoBack);
            handleLogoutNav(navState.url || '');
          }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
        />
      ) : null}

      {(loading || !injectValues) ? (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color="#B0003A" />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
});
