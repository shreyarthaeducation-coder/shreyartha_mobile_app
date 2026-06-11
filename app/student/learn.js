import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppWebView, { FORCE_DESKTOP_VIEWPORT_JS } from '../../components/AppWebView';
import { useAuth } from '../../context/AuthContext';

const BASE_URL = 'https://shreyartha.com';

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

export default function StudentLearnScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const { label = 'Dashboard', path = '/student/platform/dashboard' } = useLocalSearchParams();
  const webViewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [injectValues, setInjectValues] = useState(null);

  const url = `${BASE_URL}${path}`;

  useEffect(() => {
    const loadStorage = async () => {
      const entries = await AsyncStorage.multiGet([
        'studentToken', 'userToken', 'accessToken', 'token', 'studentLoggedIn', 'studentRole',
      ]);
      const values = Object.fromEntries(entries);
      const token = values.studentToken || values.userToken || values.accessToken || values.token || '';
      setInjectValues({
        studentToken: token,
        userToken: values.userToken || token,
        accessToken: token,
        token,
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
      router.back();
      return true;
    });
    return () => sub.remove();
  }, [canGoBack, router]);

  const handleLogoutNav = async (navUrl) => {
    if (navUrl.includes('/studentlogin')) {
      await logout();
      router.replace('/(tabs)');
    }
  };

  const injectedBeforeLoad = useMemo(() => {
    if (!injectValues) return 'true;';
    return FORCE_DESKTOP_VIEWPORT_JS + '\n' + getInjectedJS(injectValues);
  }, [injectValues]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/student/'))}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{label}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={{ flex: 1 }}>
        {injectValues ? (
          <AppWebView
            ref={webViewRef}
            source={{ uri: url }}
            userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            javaScriptEnabled
            domStorageEnabled
            mixedContentMode="never"
            originWhitelist={['https://shreyartha.com', 'https://*.shreyartha.com']}
            setSupportMultipleWindows={false}
            injectedJavaScriptBeforeContentLoaded={injectedBeforeLoad}
            onNavigationStateChange={(navState) => {
              setCanGoBack(navState.canGoBack);
              handleLogoutNav(navState.url || '');
            }}
            onLoadStart={() => setPageLoading(true)}
            onLoadEnd={() => setPageLoading(false)}
          />
        ) : null}

        {(pageLoading || !injectValues) ? (
          <View style={styles.loaderOverlay}>
            <ActivityIndicator size="large" color="#b0003a" />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1a1a2e' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  backText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    marginHorizontal: 8,
  },
  headerSpacer: { width: 56 },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
});
