import { useState, useRef } from 'react';
import { StyleSheet, ActivityIndicator, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { COLORS, SPACING } from '../../constants/theme';

const PAGE_CONFIG = {
  'learning-assessment': { title: 'Learning & Assessment' },
  'skills-learning': { title: 'Skills Learning' },
  'students-profile': { title: 'Students Profile' },
  'counselling': { title: 'Counselling' },
  'psychometric-assessment': { title: 'Psychometric Assessment' },
  'subject-career': { title: 'Subject & Career' },
  'competitive-examination': { title: 'Competitive Exam' },
  'coding-ai-robotics': { title: 'Coding / AI / Robotics' },
  'language-learning': { title: 'Language Learning' },
};

// Hide only headers, tagline, and search bar — NOT footers (website footers remain visible)
const injectedJS = `
  (function() {
    var HIDE_SELECTORS = [
      '.landing-header', '.la-header', '.sl-header', '.sp-header',
      '.co-header', '.ps-header', '.sc-header', '.ce-header',
      '.car-header', '.ll-header',
      '.global-search-section',
      '.landing-tagline-section'
    ];

    function hideElements() {
      HIDE_SELECTORS.forEach(function(sel) {
        document.querySelectorAll(sel).forEach(function(el) {
          el.style.display = 'none';
        });
      });
      document.body.style.paddingTop = '0px';
    }

    // Hide immediately if elements already exist
    hideElements();

    // Use MutationObserver to hide elements as soon as they are added to the DOM
    var observer = new MutationObserver(function() {
      hideElements();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  })();
  true;
`;

export default function WebPageScreen() {
  const { slug } = useLocalSearchParams();
  const router = useRouter();
  const webViewRef = useRef(null);
  const [loadError, setLoadError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const config = PAGE_CONFIG[slug];
  const title = config?.title || 'Page';

  // Load the target page URL directly — avoids loading the entire SPA at root first
  const pageUrl = `https://the3cedge.com/${slug}`;

  if (loadError) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Unable to load page</Text>
          <Text style={styles.errorMsg}>
            Please check your internet connection and try again.
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setLoadError(false);
              setIsLoading(true);
            }}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Hide expo-router's default header */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom header bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* WebView — loads the target page directly for speed */}
      <WebView
        ref={webViewRef}
        source={{ uri: pageUrl }}
        style={{ flex: 1 }}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        cacheEnabled
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        startInLoadingState
        injectedJavaScript={injectedJS}
        onLoadEnd={() => setIsLoading(false)}
        onError={() => setLoadError(true)}
      />

      {/* Loading overlay */}
      {isLoading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading {title}...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 12, borderBottomWidth: 1,
    borderBottomColor: '#eee', backgroundColor: COLORS.white,
  },
  backText: { color: COLORS.primary, fontWeight: '600', fontSize: 15 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.secondary, flex: 1, textAlign: 'center' },
  loader: {
    position: 'absolute', top: 60, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.white,
  },
  loadingText: { marginTop: 12, color: COLORS.textSecondary, fontSize: 14 },
  errorContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32,
  },
  errorIcon: { fontSize: 48, marginBottom: 16 },
  errorTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.secondary, marginBottom: 8 },
  errorMsg: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  retryBtn: {
    backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 36, borderRadius: 24,
  },
  retryBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
});