import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { useAuth } from '../../context/AuthContext';

const LOGIN_URL = 'https://shreyartha.com/parentlogin';
const DASHBOARD_PATH = '/parent/platform/dashboard';
const MOBILE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

const LOGIN_POLL_JS = `
(function() {
  function sendPayload() {
    var parentUserToken = localStorage.getItem('parentUserToken');
    var parentLoggedIn = localStorage.getItem('parentLoggedIn');
    if (parentUserToken && parentLoggedIn === 'true') {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'LOGIN_SUCCESS',
        parentUserToken: parentUserToken,
        parentLoggedIn: parentLoggedIn,
        parentUserVerified: localStorage.getItem('parentUserVerified') || '',
        parentUserName: localStorage.getItem('parentUserName') || '',
        linkedStudentName: localStorage.getItem('linkedStudentName') || '',
        linkedStudentEmail: localStorage.getItem('linkedStudentEmail') || ''
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
    parentUserToken: localStorage.getItem('parentUserToken'),
    parentLoggedIn: localStorage.getItem('parentLoggedIn') || 'true',
    parentUserVerified: localStorage.getItem('parentUserVerified') || '',
    parentUserName: localStorage.getItem('parentUserName') || '',
    linkedStudentName: localStorage.getItem('linkedStudentName') || '',
    linkedStudentEmail: localStorage.getItem('linkedStudentEmail') || ''
  }));
})();
true;
`;

export default function ParentLoginScreen() {
  const router = useRouter();
  const { setUserType } = useAuth();
  const webViewRef = useRef(null);
  const handledLoginRef = useRef(false);
  const [loading, setLoading] = useState(true);

  const onMessage = async (event) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data || '{}');
      if (payload?.type !== 'LOGIN_SUCCESS' || handledLoginRef.current || !payload.parentUserToken) return;

      handledLoginRef.current = true;
      const pairs = [
        ['parentUserToken', payload.parentUserToken],
        ['parentLoggedIn', 'true'],
        ['userType', 'parent'],
      ];

      if (payload.parentUserVerified) pairs.push(['parentUserVerified', payload.parentUserVerified]);
      if (payload.parentUserName) pairs.push(['parentUserName', payload.parentUserName]);
      if (payload.linkedStudentName) pairs.push(['linkedStudentName', payload.linkedStudentName]);
      if (payload.linkedStudentEmail) pairs.push(['linkedStudentEmail', payload.linkedStudentEmail]);

      await AsyncStorage.multiSet(pairs);
      setUserType('parent');
      router.replace('/dashboard/parent');
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
