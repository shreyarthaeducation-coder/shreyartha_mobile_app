import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SLATE, SPACING, TYPE } from '../../constants/theme';
import { usePalette } from './PaletteContext';

/**
 * A wrapping row of toggleable pills — pick any number from a short, fixed list.
 *
 * The native form of the web's `.sales-chips` / `.cr-options`. Two nearly identical private
 * copies of this already existed (`counsellor/ReportFormSheet.js` and `CounsellingNotesScreen.js`)
 * before it was promoted here; both operate on plain strings.
 *
 * This one takes `{ value, label }` because the callers that needed it next do not have
 * `value === label`: a school's grades store as `"PRE"` and read as `"Pre-primary"`. A plain
 * string list is still accepted and treated as `value === label`, so the existing call sites can
 * move across unchanged.
 *
 * @param {Array<string | { value: string, label: string }>} options
 * @param {string[]} value      the selected values
 * @param {(next: string[]) => void} onChange  called with the full new selection
 */
export default function ChipMultiSelect({ options = [], value = [], onChange, style }) {
  const palette = usePalette();
  const selected = Array.isArray(value) ? value.map(String) : [];

  const items = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : { value: String(o.value), label: o.label },
  );

  const toggle = (option) =>
    onChange(
      selected.includes(option)
        ? selected.filter((v) => v !== option)
        : // Appended, not sorted — the caller owns the ordering rule. Sales normalises to an
          // ascending CSV on save; the counsellor report keeps selection order.
          [...selected, option],
    );

  return (
    <View style={[styles.wrap, style]}>
      {items.map((item) => {
        const on = selected.includes(item.value);
        return (
          <Pressable
            key={item.value}
            onPress={() => toggle(item.value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={item.label}
            style={({ pressed }) => [
              styles.chip,
              on && { backgroundColor: palette.primary, borderColor: palette.primary },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.text, on && styles.textOn]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.sm },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
    paddingVertical: 6,
    paddingHorizontal: 13,
    // So single-digit grades do not collapse to a circle narrower than a fingertip.
    minWidth: 42,
    alignItems: 'center',
  },
  pressed: { opacity: 0.75 },
  text: { fontSize: TYPE.body, color: SLATE[600] },
  textOn: { color: '#ffffff', fontWeight: '600' },
});
