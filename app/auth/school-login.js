import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { useAuth } from '../../context/AuthContext';

const LOGIN_URL = 'https://shreyartha.com/schoollogin';
const DASHBOARD_PATTERN = /\/school\/platform\/[^/]+\/dashboard/i;
const MOBILE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

const LOGIN_POLL_JS = `
(function() {
  function sendPayload() {
    var schoolUserToken = localStorage.getItem('schoolUserToken');
    var schoolLoggedIn = localStorage.getItem('schoolLoggedIn');
    if (schoolUserToken && schoolLoggedIn === 'true') {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'LOGIN_SUCCESS',
        schoolUserToken: schoolUserToken,
        schoolLoggedIn: schoolLoggedIn,
        schoolUserType: localStorage.getItem('schoolUserType') || '',
        schoolUserName: localStorage.getItem('schoolUserName') || '',
        schoolUserEmail: localStorage.getItem('schoolUserEmail') || '',
        schoolCode: localStorage.getItem('schoolCode') || ''
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
    schoolUserToken: localStorage.getItem('schoolUserToken'),
    schoolLoggedIn: localStorage.getItem('schoolLoggedIn') || 'true',
    schoolUserType: localStorage.getItem('schoolUserType') || '',
    schoolUserName: localStorage.getItem('schoolUserName') || '',
    schoolUserEmail: localStorage.getItem('schoolUserEmail') || '',
    schoolCode: localStorage.getItem('schoolCode') || ''
  }));
})();
true;
`;

export default function SchoolLoginScreen() {
  const router = useRouter();
  const { setUserType } = useAuth();
  const webViewRef = useRef(null);
  const handledLoginRef = useRef(false);
  const [loading, setLoading] = useState(true);

  const onMessage = async (event) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data || '{}');
      if (payload?.type !== 'LOGIN_SUCCESS' || handledLoginRef.current || !payload.schoolUserToken) return;

      handledLoginRef.current = true;
      const pairs = [
        ['schoolUserToken', payload.schoolUserToken],
        ['schoolLoggedIn', 'true'],
        ['userType', 'school'],
        ['schoolUserType', payload.schoolUserType || ''],
      ];

      if (payload.schoolUserName) pairs.push(['schoolUserName', payload.schoolUserName]);
      if (payload.schoolUserEmail) pairs.push(['schoolUserEmail', payload.schoolUserEmail]);
      if (payload.schoolCode) pairs.push(['schoolCode', payload.schoolCode]);

      await AsyncStorage.multiSet(pairs);
      setUserType('school');
      router.replace('/dashboard/school');
    } catch {
      // Ignore malformed payloads posted by website scripts.
    }
  };

  const onNavigationStateChange = (navState) => {
    if (DASHBOARD_PATTERN.test(navState?.url || '') && webViewRef.current && !handledLoginRef.current) {
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
