import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { useAuth } from '../../context/AuthContext';

const LOGIN_URL = 'https://shreyartha.com/admin';
const DASHBOARD_PATH = '/admin/dashboard';
const MOBILE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

const LOGIN_POLL_JS = `
(function() {
  function sendPayload() {
    var adminToken = localStorage.getItem('adminToken');
    var adminLoggedIn = localStorage.getItem('adminLoggedIn');
    if (adminToken && adminLoggedIn === 'true') {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'LOGIN_SUCCESS',
        adminToken: adminToken,
        adminLoggedIn: adminLoggedIn
      }));
      return true;
    }
    return false;
  }

  if (!sendPayload()) {
    var interval = setInterval(function() {
      if (sendPayload()) {
        clearInterval(interval);
      }
    }, 500);
    setTimeout(function() { clearInterval(interval); }, 20000);
  }
})();
true;
`;

const READ_STORAGE_JS = `
(function() {
  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'LOGIN_SUCCESS',
    adminToken: localStorage.getItem('adminToken'),
    adminLoggedIn: localStorage.getItem('adminLoggedIn') || 'true'
  }));
})();
true;
`;

export default function AdminLoginScreen() {
  const router = useRouter();
  const { setUserType } = useAuth();
  const webViewRef = useRef(null);
  const handledLoginRef = useRef(false);
  const [loading, setLoading] = useState(true);

  const onMessage = async (event) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data || '{}');
      if (payload?.type !== 'LOGIN_SUCCESS' || handledLoginRef.current || !payload.adminToken) return;

      handledLoginRef.current = true;
      await AsyncStorage.multiSet([
        ['adminToken', payload.adminToken],
        ['adminLoggedIn', 'true'],
        ['userType', 'admin'],
      ]);
      setUserType('admin');
      router.replace('/dashboard/admin');
    } catch {
      // Ignore malformed payloads posted by website scripts.
    }
  };

  const onNavigationStateChange = (navState) => {
    if (navState?.url?.includes(DASHBOARD_PATH) && webViewRef.current && !handledLoginRef.current) {
      webViewRef.current.injectJavaScript(READ_STORAGE_JS);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <WebView
        ref={webViewRef}
        source={{ uri: LOGIN_URL }}
        userAgent={MOBILE_USER_AGENT}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        originWhitelist={['*']}
        setSupportMultipleWindows={false}
        injectedJavaScript={LOGIN_POLL_JS}
        onMessage={onMessage}
        onNavigationStateChange={onNavigationStateChange}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
      />

      {loading ? (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color="#B0003A" />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  topBar: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 10,
  },
  backButton: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  backText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
});
