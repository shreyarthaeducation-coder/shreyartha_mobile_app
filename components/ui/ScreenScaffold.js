import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { usePalette } from './PaletteContext';
// Imported by path, not through components/staff/index.js: the barrel also exports the screens,
// and those import this kit — going through it would close an import cycle.
import StaffHeader from '../staff/StaffHeader';
import Toast from './Toast';
// By path, for the same reason as StaffHeader above: the student barrel pulls in screens.
import ShreyaSpeakButton from '../student/ai/ShreyaSpeakButton';
import ttsClient from '../../services/shared/ttsClient';
import {
  ReadAloudBanner,
  ReadAloudModeProvider,
  useReadAloudMode,
} from '../shared/readaloud/ReadAloudMode';

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
 *   readAloud            — text for a "Shreya Speak" button above the content, in whichever of the
 *                          22 languages the panel is set to. The web reads the page out of the DOM;
 *                          React Native has no DOM, so each screen hands over the words it is
 *                          showing. Omit it and nothing is rendered, which is every other caller.
 *   selectableReadAloud  — the control becomes a "tap anything to hear it" switch instead, and the
 *                          screen's <Readable> blocks become individually tappable. This is the
 *                          phone's equivalent of highlighting a passage in a browser.
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

/**
 * The read-aloud control at the top of a screen.
 *
 * Two behaviours, and which one appears depends on the screen:
 *
 *   - `selectable` — the button turns "tap anything to hear it" ON, and each `<Readable>` block
 *     becomes tappable. This is the phone's answer to highlighting text in a browser.
 *   - plain `readAloud` text — one press reads the whole screen, which is all a screen can offer
 *     until its blocks are wrapped.
 *
 * `ttsClient` rather than the student transport in both cases: this renders in the parent, partner
 * and teacher panels, whose tokens `studentApi` does not read — and whose users must not be signed
 * out because a voice service refused.
 */
function ReadAloudControl({ text, selectable }) {
  const palette = usePalette();
  const mode = useReadAloudMode();

  if (selectable) {
    return (
      <View style={styles.readAloud}>
        <Pressable
          onPress={mode.toggle}
          style={({ pressed }) => [
            styles.modeBtn,
            { borderColor: palette.primary },
            mode.active && { backgroundColor: palette.primary },
            pressed && styles.modePressed,
          ]}
          accessibilityRole="button"
          accessibilityState={{ selected: mode.active }}
          accessibilityLabel={
            mode.active ? 'Stop choosing what to read aloud' : 'Choose what to read aloud'
          }
        >
          <Ionicons
            name={mode.active ? 'volume-high' : 'volume-medium-outline'}
            size={16}
            color={mode.active ? palette.onPrimary : palette.primary}
          />
          <Text
            style={[
              styles.modeBtnText,
              { color: mode.active ? palette.onPrimary : palette.primary },
            ]}
          >
            {mode.active ? 'Tap to hear' : 'Shreya Speak'}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (!text || !text.trim()) return null;
  return (
    <View style={styles.readAloud}>
      <ShreyaSpeakButton text={text} client={ttsClient} compact />
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
  readAloud = '',
  // When true the read-aloud control turns on "tap anything to hear it" instead of reading the
  // whole screen. The screen's own blocks opt in by wrapping themselves in <Readable text="…">.
  selectableReadAloud = false,
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
        <ReadAloudControl text={readAloud} selectable={selectableReadAloud} />
        <ReadAloudBanner />
        {children}
      </ScrollView>
    );
  } else {
    body = (
      <View style={styles.flex}>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        <ReadAloudControl text={readAloud} selectable={selectableReadAloud} />
        <ReadAloudBanner />
        {children}
      </View>
    );
  }

  return (
    <ReadAloudModeProvider>
      <SafeAreaView
        style={[styles.safe, { backgroundColor: palette.headerBg }]}
        edges={['top', 'left', 'right']}
      >
        <StaffHeader title={title} fallbackRoute={fallbackRoute} />
        <View style={styles.page}>{body}</View>
        <Toast message={toast?.message} tone={toast?.tone} />
      </SafeAreaView>
    </ReadAloudModeProvider>
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
  readAloud: { alignItems: 'flex-start', marginBottom: SPACING.sm },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  modeBtnText: { fontSize: TYPE.label, fontWeight: '700' },
  modePressed: { opacity: 0.75 },
  notice: {
    fontSize: TYPE.body,
    color: SLATE[500],
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
});
