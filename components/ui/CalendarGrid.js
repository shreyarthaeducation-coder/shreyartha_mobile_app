import { StyleSheet, Text, View, Pressable } from 'react-native';
import { SLATE } from '../../constants/theme';
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
 */

const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function CalendarGrid({
  dates = [],
  getDay,
  selectedDate,
  onDayPress,
  palette: paletteProp,
  style,
}) {
  const contextPalette = usePalette();
  // Explicit prop wins; otherwise the surrounding portal palette (teal by default).
  const palette = paletteProp || contextPalette;
  // Blank cells so the 1st lands under its real weekday.
  const leadingBlanks = dates.length ? mondayFirstIndex(dates[0]) : 0;

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.weekRow}>
        {WEEKDAY_INITIALS.map((initial, index) => (
          <View key={`${initial}-${index}`} style={styles.weekCell}>
            <Text style={[styles.weekText, index === 6 && styles.weekTextSunday]}>{initial}</Text>
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
                  state.bg ? { backgroundColor: state.bg } : null,
                  state.borderColor ? { borderColor: state.borderColor, borderWidth: 1 } : null,
                  selected ? { borderColor: palette.primary, borderWidth: 2 } : null,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
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
  weekText: { fontSize: 11.5, fontWeight: '700', color: SLATE[500] },
  weekTextSunday: { color: SLATE[400] },
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
  dayText: { fontSize: 14, fontWeight: '600', color: SLATE[700] },
  dayTextBold: { fontWeight: '800' },
  dayTextDisabled: { color: SLATE[300] },
  dotSlot: { height: 8, justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
