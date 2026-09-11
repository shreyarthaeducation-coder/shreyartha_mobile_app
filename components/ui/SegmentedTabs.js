import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, TYPE } from '../../constants/theme';
import { usePalette } from './PaletteContext';

/**
 * In-page tab switcher — the native form of the web's `.view-tabs` / `.hr-tabs` / `.sub-tabs`
 * button rows (Create/View groups, Exams/View Report, Balances/Requests, Assign/Submitted).
 *
 * Not to be confused with expo-router's `<Tabs>`, which is navigation. This switches a mode
 * inside one screen.
 *
 * `scrollable` is OPT-IN, for rows of four or more where equal-width tabs would truncate the
 * labels to nothing useful ("Mark Completed" → "Mark C…" on a 360dp phone). It sizes tabs to
 * their content inside a horizontal ScrollView instead. Every existing two- and three-tab call
 * site omits it and keeps the equal-width row byte for byte.
 *
 * `tone="dark"` is the third of the opt-in dark variants (with CalendarGrid and MonthNavigator),
 * added for the student panel's dark-glass screens. The default light track is SLATE[100], which on
 * a dark screen reads as a glaring white bar rather than a control. Every existing call site omits
 * it and is byte-for-byte unchanged.
 *
 * @param {Array<{ value: string, label: string, icon?: string }>} options
 */

export default function SegmentedTabs({
  options = [],
  value,
  onChange,
  tone = 'light',
  palette: paletteProp,
  style,
  scrollable = false,
}) {
  const contextPalette = usePalette();
  // Explicit prop wins; otherwise the surrounding portal palette (teal by default).
  const palette = paletteProp || contextPalette;
  const dark = tone === 'dark';

  const tabs = (
    <>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => !active && onChange(option.value)}
            style={({ pressed }) => [
              styles.tab,
              scrollable && styles.tabAuto,
              active && (dark ? { backgroundColor: palette.primary } : styles.tabActive),
              pressed && !active && styles.tabPressed,
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            {option.icon ? (
              <Ionicons
                name={option.icon}
                size={17}
                color={tabInk(active, dark, palette)}
              />
            ) : null}
            <Text
              style={[styles.label, { color: tabInk(active, dark, palette) }]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </>
  );

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.scroller, style]}
        // flexGrow keeps the grey track full-width on a screen wide enough to fit every tab;
        // without it the track would stop where the labels do.
        contentContainerStyle={[styles.wrap, styles.wrapScroll]}
        accessibilityRole="tablist"
      >
        {tabs}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.wrap, dark && styles.wrapDark, style]} accessibilityRole="tablist">
      {tabs}
    </View>
  );
}

/**
 * Label and icon colour for one tab.
 *
 * Four cases, not two: on the light track the active pill is white so the ink is `primaryDark`,
 * but on the dark track the active pill IS `primary`, so its ink has to be `onPrimary` — which for
 * the student palette is the dark navy, not white. Getting that pair backwards is how a selected
 * tab ends up light-on-light.
 */
function tabInk(active, dark, palette) {
  if (active) return dark ? palette.onPrimary : palette.primaryDark;
  return dark ? '#ffffff' : SLATE[600];
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: SLATE[100],
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  // tone="dark". Literal rgba rather than a palette token: this component renders under six portal
  // palettes and a white wash reads correctly on every one.
  wrapDark: { backgroundColor: 'rgba(255,255,255,0.12)' },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 8,
  },
  // A horizontal ScrollView in a column parent must not stretch vertically.
  scroller: { flexGrow: 0 },
  wrapScroll: { flexGrow: 1 },
  // Scrollable rows size to their label instead of sharing the width equally.
  tabAuto: { flex: 0, paddingHorizontal: 14 },
  // The active tab is a raised white pill on the grey track — the standard iOS/Android segmented
  // control, rather than the web's underline, which reads as a link on touch.
  tabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  tabPressed: { backgroundColor: SLATE[200] },
  label: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[600] },
});
