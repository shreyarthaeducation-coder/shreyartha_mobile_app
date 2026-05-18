import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { useAuth } from '../../context/AuthContext';

const LOGIN_URL = 'https://shreyartha.com/studentlogin';
const DASHBOARD_PATH = '/student/platform/dashboard';
const MOBILE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

const LOGIN_POLL_JS = `
(function() {
  // This helper is intentionally duplicated in READ_STORAGE_JS because each
  // injected script must be self-contained inside the WebView runtime.
  // Some websites persist invalid placeholders as the string literals
  // "undefined"/"null"; filter them out so we only forward real tokens.
  function firstStorageValue(storage, keys) {
    for (var i = 0; i < keys.length; i += 1) {
      var value = storage.getItem(keys[i]);
      if (value && value !== 'undefined' && value !== 'null') return value;
    }
    return '';
  }

  function resolveToken() {
    var tokenKeys = ['studentToken', 'userToken', 'accessToken', 'token', 'jwtToken', 'authToken'];
    return firstStorageValue(localStorage, tokenKeys) || firstStorageValue(sessionStorage, tokenKeys);
  }

  function resolveRole() {
    var roleKeys = ['studentRole', 'cachedStudentRole', 'role', 'userRole'];
    return firstStorageValue(localStorage, roleKeys) || firstStorageValue(sessionStorage, roleKeys);
  }

  function sendPayload() {
    var studentToken = resolveToken();
    var userToken = studentToken;
    var studentLoggedIn = localStorage.getItem('studentLoggedIn') || sessionStorage.getItem('studentLoggedIn');
    var studentRole = resolveRole();
    if ((studentToken || userToken) && studentLoggedIn === 'true') {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'LOGIN_SUCCESS',
        studentToken: studentToken,
        userToken: userToken,
        studentLoggedIn: studentLoggedIn,
        studentRole: studentRole
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
  // Duplicated intentionally: injected WebView scripts do not share scope.
  // Keep the same guard as LOGIN_POLL_JS for websites that persist string placeholders.
  function firstStorageValue(storage, keys) {
    for (var i = 0; i < keys.length; i += 1) {
      var value = storage.getItem(keys[i]);
      if (value && value !== 'undefined' && value !== 'null') return value;
    }
    return '';
  }

  var tokenKeys = ['studentToken', 'userToken', 'accessToken', 'token', 'jwtToken', 'authToken'];
  var roleKeys = ['studentRole', 'cachedStudentRole', 'role', 'userRole'];
  var token = firstStorageValue(localStorage, tokenKeys) || firstStorageValue(sessionStorage, tokenKeys);
  var role = firstStorageValue(localStorage, roleKeys) || firstStorageValue(sessionStorage, roleKeys);

  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'LOGIN_SUCCESS',
    studentToken: token,
    userToken: token,
    studentLoggedIn: localStorage.getItem('studentLoggedIn') || sessionStorage.getItem('studentLoggedIn'),
    studentRole: role
  }));
})();
true;
`;

export default function StudentLoginScreen() {
  const router = useRouter();
  const { setUserType } = useAuth();
  const webViewRef = useRef(null);
  const handledLoginRef = useRef(false);
  const [loading, setLoading] = useState(true);

  const onMessage = async (event) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data || '{}');
      if (payload?.type !== 'LOGIN_SUCCESS' || handledLoginRef.current) return;

      const token = payload.studentToken || payload.userToken || payload.accessToken || payload.token;
      if (!token) return;

      handledLoginRef.current = true;
      await AsyncStorage.multiSet([
        ['studentToken', payload.studentToken || token],
        ['userToken', payload.userToken || token],
        ['accessToken', payload.accessToken || token],
        ['token', payload.token || token],
        ['studentLoggedIn', 'true'],
        ['userType', 'student'],
      ]);

      if (payload.studentRole) {
        await AsyncStorage.multiSet([
          ['studentRole', payload.studentRole],
          ['cachedStudentRole', payload.studentRole],
        ]);
      }

      setUserType('student');
      router.replace('/student/');
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
