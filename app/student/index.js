import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppWebView, { FORCE_DESKTOP_VIEWPORT_JS } from '../../components/AppWebView';
import { useAuth } from '../../context/AuthContext';

const DASHBOARD_URL = 'https://shreyartha.com/student/platform/dashboard';
const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

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

export default function StudentDashboard() {
  const router = useRouter();
  const { logout } = useAuth();
  const webViewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [injectValues, setInjectValues] = useState(null);
  const [webLoading, setWebLoading] = useState(true);

  useEffect(() => {
    const loadStorage = async () => {
      const entries = await AsyncStorage.multiGet([
        'studentToken',
        'userToken',
        'accessToken',
        'token',
        'studentLoggedIn',
        'studentRole',
      ]);
      const values = Object.fromEntries(entries);
      const token = values.studentToken || values.userToken || values.accessToken || values.token || '';
      setInjectValues({
        studentToken: token,
        userToken: values.userToken || token,
        accessToken: token,
        token: token,
        studentLoggedIn: values.studentLoggedIn || 'true',
        studentRole: values.studentRole || '',
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
    if (url.includes('/studentlogin')) {
      await logout();
      router.replace('/(tabs)');
    }
  };

  const injectedBeforeLoad = useMemo(() => {
    if (!injectValues) return 'true;';
    return FORCE_DESKTOP_VIEWPORT_JS + '\n' + getInjectedJS(injectValues);
  }, [injectValues]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {injectValues ? (
        <AppWebView
          ref={webViewRef}
          source={{ uri: DASHBOARD_URL }}
          userAgent={DESKTOP_USER_AGENT}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          originWhitelist={['*']}
          setSupportMultipleWindows={false}
          injectedJavaScriptBeforeContentLoaded={injectedBeforeLoad}
          onLoadEnd={() => setWebLoading(false)}
          onNavigationStateChange={(navState) => {
            setCanGoBack(navState.canGoBack);
            handleLogoutNav(navState.url || '');
          }}
        />
      ) : null}

      {(!injectValues || webLoading) ? (
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
