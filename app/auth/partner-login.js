import { useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WebView } from "react-native-webview";
import { useAuth } from "../../context/AuthContext";

const LOGIN_URL = "https://shreyartha.com/partner";
const DASHBOARD_PATH = "/partner/platform/dashboard";
const MOBILE_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

const LOGIN_POLL_JS = `
(function() {
  function sendPayload() {
    var partnerUserToken = localStorage.getItem('partnerUserToken');
    var partnerLoggedIn = localStorage.getItem('partnerLoggedIn');
    if (partnerUserToken && partnerLoggedIn === 'true') {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'LOGIN_SUCCESS',
        partnerUserToken: partnerUserToken,
        partnerLoggedIn: partnerLoggedIn,
        partnerUserType: localStorage.getItem('partnerUserType') || '',
        partnerUserName: localStorage.getItem('partnerUserName') || '',
        partnerUserEmail: localStorage.getItem('partnerUserEmail') || '',
        partnerCode: localStorage.getItem('partnerCode') || ''
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
    partnerUserToken: localStorage.getItem('partnerUserToken'),
    partnerLoggedIn: localStorage.getItem('partnerLoggedIn') || 'true',
    partnerUserType: localStorage.getItem('partnerUserType') || '',
    partnerUserName: localStorage.getItem('partnerUserName') || '',
    partnerUserEmail: localStorage.getItem('partnerUserEmail') || '',
    partnerCode: localStorage.getItem('partnerCode') || ''
  }));
})();
true;
`;

export default function PartnerLoginScreen() {
  const router = useRouter();
  const { setUserType } = useAuth();
  const webViewRef = useRef(null);
  const handledLoginRef = useRef(false);
  const [loading, setLoading] = useState(true);

  const onMessage = async (event) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data || "{}");
      if (
        payload?.type !== "LOGIN_SUCCESS" ||
        handledLoginRef.current ||
        !payload.partnerUserToken
      )
        return;

      handledLoginRef.current = true;
      const pairs = [
        ["partnerUserToken", payload.partnerUserToken],
        ["partnerLoggedIn", "true"],
        ["userType", "partner"],
        ["partnerUserType", payload.partnerUserType || ""],
      ];

      if (payload.partnerUserName)
        pairs.push(["partnerUserName", payload.partnerUserName]);
      if (payload.partnerUserEmail)
        pairs.push(["partnerUserEmail", payload.partnerUserEmail]);
      if (payload.partnerCode) pairs.push(["partnerCode", payload.partnerCode]);

      await AsyncStorage.multiSet(pairs);
      setUserType("partner");
      router.replace("/dashboard/partner");
    } catch {
      // Ignore malformed payloads posted by website scripts.
    }
  };

  const onNavigationStateChange = (navState) => {
    if (
      navState?.url?.includes(DASHBOARD_PATH) &&
      webViewRef.current &&
      !handledLoginRef.current
    ) {
      webViewRef.current.injectJavaScript(READ_STORAGE_JS);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
          style={styles.backButton}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Partner Login</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.webViewContainer}>
        <WebView
          ref={webViewRef}
          source={{ uri: LOGIN_URL }}
          userAgent={MOBILE_USER_AGENT}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          originWhitelist={["*"]}
          setSupportMultipleWindows={false}
          injectedJavaScript={LOGIN_POLL_JS}
          onMessage={onMessage}
          onNavigationStateChange={onNavigationStateChange}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          renderError={() => (
            <View style={styles.errorView}>
              <Text style={styles.errorText}>Failed to load page.</Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => webViewRef.current?.reload()}
              >
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
        />

        {loading ? (
          <View style={styles.loaderOverlay}>
            <ActivityIndicator size="large" color="#b0003a" />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a1a2e" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  backButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  backText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  headerSpacer: { width: 56 },
  webViewContainer: { flex: 1 },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  errorView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  errorText: { fontSize: 15, color: "#333", marginBottom: 16 },
  retryBtn: {
    backgroundColor: "#b0003a",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
