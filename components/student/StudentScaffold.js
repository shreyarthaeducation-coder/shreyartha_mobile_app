import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import { Toast } from '../ui';
import StudentHeader from './StudentHeader';

/**
 * Page chrome for a student screen: header, loading, error+retry, pull-to-refresh, toast.
 *
 * The student twin of `components/ui/ScreenScaffold`. Kept separate rather than given a mode,
 * because the two differ in the thing that matters most — this one is **transparent**, so the
 * fixed background painted by app/student/_layout.js shows through. ScreenScaffold paints
 * `palette.headerBg` on its SafeAreaView and a solid page beneath, which would cover it.
 *
 * Loading and error states sit on the background with light text; content sits in StudentCards.
 */
export default function StudentScaffold({
  title,
  fallbackRoute = '/student',
  headerRight,
  loading = false,
  error = '',
  onRetry,
  refreshing = false,
  onRefresh,
  toast,
  scroll = true,
  children,
}) {
  const styles = useStyles();
  const palette = usePalette();

  let body;
  if (loading) {
    body = (
      <View style={styles.centre}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  } else if (error) {
    body = (
      <View style={styles.centre}>
        <Text style={styles.error}>{error}</Text>
        {onRetry ? (
          <Pressable
            onPress={onRetry}
            style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        ) : null}
      </View>
    );
  } else if (scroll) {
    body = (
      <ScrollView
        contentContainerStyle={styles.scroll}
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
        {children}
      </ScrollView>
    );
  } else {
    body = <View style={styles.fill}>{children}</View>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StudentHeader title={title} fallbackRoute={fallbackRoute} right={headerRight} />
      {body}
      {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}
    </SafeAreaView>
  );
}

const useStyles = makeStyles((p) => ({
  // Opaque. It was transparent so the layout's ImageBackground showed through; that image is gone
  // and a transparent page over a plain navigator card flashes the window colour on push.
  safe: { flex: 1, backgroundColor: p.pageBg },
  fill: { flex: 1 },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xl },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  error: { fontSize: TYPE.heading, color: SLATE[700], textAlign: 'center', lineHeight: leading(TYPE.heading) },
  retry: {
    marginTop: SPACING.md,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: p.primary,
  },
  retryText: { fontSize: TYPE.body, fontWeight: '700', color: p.onPrimary },
  pressed: { opacity: 0.78 },
}));
