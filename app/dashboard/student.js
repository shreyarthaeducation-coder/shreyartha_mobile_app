import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { useAuth } from '../../context/AuthContext';

const DASHBOARD_URL = 'https://shreyartha.com/student/platform/dashboard';
const MOBILE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

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
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [injectValues, setInjectValues] = useState(null);

  useEffect(() => {
    const loadStorage = async () => {
      const entries = await AsyncStorage.multiGet([
        'studentToken',
        'userToken',
        'studentLoggedIn',
        'studentRole',
        'cachedStudentRole',
      ]);
      const values = Object.fromEntries(entries);
      setInjectValues({
        studentToken: values.studentToken || '',
        userToken: values.userToken || values.studentToken || '',
        studentLoggedIn: values.studentLoggedIn || 'true',
        studentRole: values.studentRole || values.cachedStudentRole || '',
        cachedStudentRole: values.cachedStudentRole || values.studentRole || '',
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
    return getInjectedJS(injectValues);
  }, [injectValues]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {injectValues ? (
        <WebView
          ref={webViewRef}
          source={{ uri: DASHBOARD_URL }}
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
