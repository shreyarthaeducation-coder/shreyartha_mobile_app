import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { usePalette } from './PaletteContext';
// Imported by path, not through components/staff/index.js: the barrel also exports the screens,
// and those import this kit — going through it would close an import cycle.
import StaffHeader from '../staff/StaffHeader';
import Toast from './Toast';

/**
 * The frame every native staff sub-screen shares: teal safe area, back-bar header, and the
 * loading / error / content states in one place instead of re-written per screen.
 *
 * Props:
 *   title, fallbackRoute — passed to StaffHeader (fallbackRoute is where Back lands on a deep link)
 *   loading              — show the spinner instead of children
 *   error, onRetry       — replace children with a retry block
 *   notice               — non-blocking message rendered above the children (stale data, partial
 *                          failure); use this instead of `error` when there is still content
 *   refreshing, onRefresh— enables pull-to-refresh
 *   scroll               — false when the child owns its own scrolling (FlatList, SectionList)
 *   toast                — { message, tone } from useToast()
 *   contentStyle         — extra padding/layout for the scroll content
 */

function ErrorBlock({ message, onRetry, palette }) {
  return (
    <View style={styles.centered}>
      <Ionicons name="cloud-offline-outline" size={40} color={SLATE[400]} />
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retry,
            { backgroundColor: palette.primaryDark },
            pressed && styles.retryPressed,
          ]}
          accessibilityRole="button"
        >
          <Ionicons name="refresh" size={17} color="#ffffff" />
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function ScreenScaffold({
  title,
  fallbackRoute,
  loading = false,
  error = '',
  onRetry,
  notice = '',
  refreshing = false,
  onRefresh,
  scroll = true,
  toast,
  contentStyle,
  // Optional handle on the scroll view, for a screen that has to jump to one of its own
  // sections. Added for the parent fee screen, whose dashboard tile promises Payment History and
  // must land there rather than at the top. Every other caller omits it and is unchanged.
  scrollRef,
  palette: paletteProp,
  children,
}) {
  const contextPalette = usePalette();
  // Explicit prop wins; otherwise the surrounding portal palette (teal by default).
  const palette = paletteProp || contextPalette;
  let body;

  if (loading) {
    body = (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  } else if (error) {
    body = <ErrorBlock message={error} onRetry={onRetry} palette={palette} />;
  } else if (scroll) {
    body = (
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, contentStyle]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={palette.primary}
              colors={[palette.primary]}
            />
          ) : undefined
        }
      >
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {children}
      </ScrollView>
    );
  } else {
    body = (
      <View style={styles.flex}>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {children}
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.headerBg }]} edges={['top', 'left', 'right']}>
      <StaffHeader title={title} fallbackRoute={fallbackRoute} />
      <View style={styles.page}>{body}</View>
      <Toast message={toast?.message} tone={toast?.tone} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  page: { flex: 1, backgroundColor: SLATE[50] },
  flex: { flex: 1 },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  errorText: {
    fontSize: TYPE.body,
    color: SLATE[600],
    textAlign: 'center',
    lineHeight: leading(TYPE.body),
    marginTop: SPACING.sm,
  },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.md,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  retryPressed: { opacity: 0.8 },
  retryText: { color: '#ffffff', fontWeight: '700', fontSize: TYPE.heading },
  notice: {
    fontSize: TYPE.body,
    color: SLATE[500],
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
});
