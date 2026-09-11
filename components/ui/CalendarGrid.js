import { StyleSheet, Text, View, Pressable } from 'react-native';
import { SLATE, TYPE } from '../../constants/theme';
import { usePalette } from './PaletteContext';
import { dayOfMonth, mondayFirstIndex } from '../../utils/dates';

/**
 * Monday-first month grid, driven by the list of dates the server returned rather than by a local
 * Date loop — the backend owns which days are in the month, and re-deriving them client-side is
 * how the two drift apart.
 *
 * Presentation is entirely the caller's: `getDay(dateStr)` returns how one cell should look, so
 * the same grid serves Self Attendance (present/absent tint), My Calendar (event dots) and
 * anything else that needs a month view.
 *
 * @param {string[]} dates      ISO "YYYY-MM-DD", contiguous and in order
 * @param {(dateStr: string) => {
 *          disabled?: boolean, bg?: string, borderColor?: string,
 *          color?: string, dot?: string, bold?: boolean }} [getDay]
 * @param {string} [selectedDate]
 * @param {(dateStr: string) => void} [onDayPress]
 * @param {'light'|'dark'} [tone]  surface this grid is printed on; see below
 *
 * ── `tone` ──────────────────────────────────────────────────────────────────
 * Everything above was written for a white card on a slate page, which is what the staff screens
 * are. The student panel's redesigned screens put their calendar on dark glass, where a white cell
 * and SLATE weekday initials are the wrong way round. `tone="dark"` swaps the two surface colours
 * and nothing else — `getDay` still wins over both, so a caller that already tints its cells keeps
 * behaving identically. Default is `light`, so every existing caller is untouched.
 */

const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function CalendarGrid({
  dates = [],
  getDay,
  selectedDate,
  onDayPress,
  tone = 'light',
  palette: paletteProp,
  style,
}) {
  const contextPalette = usePalette();
  // Explicit prop wins; otherwise the surrounding portal palette (teal by default).
  const palette = paletteProp || contextPalette;
  const dark = tone === 'dark';
  // Blank cells so the 1st lands under its real weekday.
  const leadingBlanks = dates.length ? mondayFirstIndex(dates[0]) : 0;

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.weekRow}>
        {WEEKDAY_INITIALS.map((initial, index) => (
          <View key={`${initial}-${index}`} style={styles.weekCell}>
            <Text
              style={[
                styles.weekText,
                index === 6 && styles.weekTextSunday,
                dark && { color: palette.onDark },
              ]}
            >
              {initial}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {Array.from({ length: leadingBlanks }).map((_, index) => (
          <View key={`blank-${index}`} style={styles.cell} />
        ))}

        {dates.map((dateStr) => {
          const state = getDay ? getDay(dateStr) || {} : {};
          const selected = selectedDate === dateStr;
          const interactive = !state.disabled && !!onDayPress;

          return (
            <Pressable
              key={dateStr}
              onPress={interactive ? () => onDayPress(dateStr) : undefined}
              disabled={!interactive}
              style={({ pressed }) => [
                styles.cell,
                pressed && interactive && styles.cellPressed,
              ]}
              accessibilityRole={interactive ? 'button' : 'text'}
              accessibilityLabel={state.accessibilityLabel}
              accessibilityState={{ selected, disabled: !!state.disabled }}
            >
              <View
                style={[
                  styles.day,
                  // Tone first, so an explicit `getDay` colour still overrides it.
                  dark ? styles.dayDark : null,
                  state.bg ? { backgroundColor: state.bg } : null,
                  state.borderColor ? { borderColor: state.borderColor, borderWidth: 1 } : null,
                  selected ? { borderColor: palette.primary, borderWidth: 2 } : null,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    dark ? styles.dayTextDark : null,
                    state.color ? { color: state.color } : null,
                    state.bold ? styles.dayTextBold : null,
                    state.disabled ? styles.dayTextDisabled : null,
                  ]}
                >
                  {dayOfMonth(dateStr)}
                </Text>
                {/* Reserve the dot's row on every cell so numbers stay on one baseline. */}
                <View style={styles.dotSlot}>
                  {state.dot ? <View style={[styles.dot, { backgroundColor: state.dot }]} /> : null}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekCell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 6 },
  weekText: { fontSize: TYPE.caption, fontWeight: '700', color: SLATE[500] },
  weekTextSunday: { color: SLATE[500] },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 3 },
  cellPressed: { opacity: 0.65 },
  day: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: SLATE[200],
  },
  // tone="dark". Literal rgba rather than a palette token because this component is portal-agnostic
  // — it renders under the teal, purple, red, orange and blue palettes alike, and a white wash reads
  // correctly on every one of them.
  dayDark: { backgroundColor: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.18)' },
  dayText: { fontSize: TYPE.body, fontWeight: '600', color: SLATE[700] },
  dayTextDark: { color: '#ffffff' },
  dayTextBold: { fontWeight: '800' },
  dayTextDisabled: { color: SLATE[300] },
  dotSlot: { height: 8, justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
