import { createContext, useContext, useEffect, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

/** The real bottom inset, for content that draws in its own window (a Modal). */
const RealBottomInsetContext = createContext(null);

/**
 * Keeps every screen above the phone's navigation bar (26 Oct 2026).
 *
 * Expo SDK 57 draws Android apps edge to edge, so anything pinned to the bottom of a screen — a
 * "Save grades" bar, a Submit button, the last row of a list — slid under the 3-button bar. The
 * screens were written before that and most never asked for the bottom inset. Rather than patch
 * each one, the whole navigator is padded once here, and everything beneath is told the bottom
 * inset is already taken: `useSafeAreaInsets().bottom` reads 0, and a native <SafeAreaView>
 * measures its own position, so it finds no overlap either. Nothing pads twice.
 *
 * Modals are the exception: React Native 0.86 draws them edge to edge in a window of their own,
 * outside this padding. A sheet pinned to the bottom of a Modal takes `useModalBottomInset()`.
 */
export default function BottomInsetGuard({ children }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <RealBottomInsetContext.Provider value={insets.bottom}>
        <SafeAreaInsetsContext.Provider value={{ ...insets, bottom: 0 }}>{children}</SafeAreaInsetsContext.Provider>
      </RealBottomInsetContext.Provider>
    </View>
  );
}

/**
 * The navigation bar's height, for a sheet pinned to the bottom of a Modal — or 0 while the
 * keyboard is up, since it covers the bar and the sheet's input should sit right on top of it.
 */
export function useModalBottomInset() {
  const real = useContext(RealBottomInsetContext);
  const insets = useSafeAreaInsets();
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return keyboard ? 0 : real ?? insets.bottom;
}

/** A sheet's own bottom padding plus `inset`, so its existing spacing is kept. */
export function bottomPadding(style, inset) {
  const flat = StyleSheet.flatten(style) || {};
  const base = flat.paddingBottom ?? flat.paddingVertical ?? flat.padding ?? 0;
  return { paddingBottom: base + inset };
}

const styles = StyleSheet.create({
  // White, so the strip behind the navigation bar reads as part of the page's bottom edge.
  root: { flex: 1, backgroundColor: '#ffffff' },
});
