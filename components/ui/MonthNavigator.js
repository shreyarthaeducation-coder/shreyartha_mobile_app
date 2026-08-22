import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SHADOWS, SLATE, SPACING } from '../../constants/theme';
import { usePalette } from './PaletteContext';

/**
 * Month + year selector: `‹ August 2026 ›` with the label opening a picker sheet.
 *
 * The web pages this replaces render a row of three year buttons and twelve month buttons
 * (TeacherSelfAttendance.js, TeacherAttendance.js, CounsellingNotes.js). That is a lot of screen
 * for a phone, so the arrows cover the common case — stepping one month — and the sheet keeps the
 * full grid for jumping further.
 *
 * `month` is 1-12 throughout, matching the backend's `?month=` param. Never 0-indexed.
 */

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function MonthNavigator({
  year,
  month,
  onChange,
  yearOptions,
  palette: paletteProp,
  disabled = false,
}) {
  const contextPalette = usePalette();
  // Explicit prop wins; otherwise the surrounding portal palette (teal by default).
  const palette = paletteProp || contextPalette;
  const [open, setOpen] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = yearOptions || [currentYear - 1, currentYear, currentYear + 1];

  const step = (delta) => {
    const next = month + delta;
    if (next < 1) onChange({ year: year - 1, month: 12 });
    else if (next > 12) onChange({ year: year + 1, month: 1 });
    else onChange({ year, month: next });
  };

  return (
    <View style={styles.bar}>
      <Pressable
        onPress={() => step(-1)}
        disabled={disabled}
        hitSlop={8}
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Previous month"
      >
        <Ionicons name="chevron-back" size={18} color={palette.primaryDark} />
      </Pressable>

      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        style={({ pressed }) => [styles.label, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`${MONTH_NAMES[month - 1]} ${year}. Tap to change.`}
      >
        <Text style={styles.labelText}>
          {MONTH_NAMES[month - 1]} {year}
        </Text>
        <Ionicons name="chevron-down" size={15} color={SLATE[500]} />
      </Pressable>

      <Pressable
        onPress={() => step(1)}
        disabled={disabled}
        hitSlop={8}
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Next month"
      >
        <Ionicons name="chevron-forward" size={18} color={palette.primaryDark} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          {/* Swallow taps on the sheet itself so they don't close it. */}
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Year</Text>
            <View style={styles.chipRow}>
              {years.map((y) => {
                const active = y === year;
                return (
                  <Pressable
                    key={y}
                    onPress={() => onChange({ year: y, month })}
                    style={[
                      styles.chip,
                      active && { backgroundColor: palette.primaryDark, borderColor: palette.primaryDark },
                    ]}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{y}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.sheetTitle, styles.sheetTitleSpaced]}>Month</Text>
            <View style={styles.monthGrid}>
              {MONTH_NAMES.map((name, index) => {
                const value = index + 1;
                const active = value === month;
                return (
                  <Pressable
                    key={name}
                    onPress={() => {
                      onChange({ year, month: value });
                      setOpen(false);
                    }}
                    style={[
                      styles.monthCell,
                      active && { backgroundColor: palette.tint, borderColor: palette.primary },
                    ]}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[styles.monthText, active && { color: palette.primaryDark, fontWeight: '700' }]}
                    >
                      {name.slice(0, 3)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable onPress={() => setOpen(false)} style={styles.close} accessibilityRole="button">
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SLATE[200],
    paddingHorizontal: 6,
    paddingVertical: 6,
    ...SHADOWS.sm,
  },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  labelText: { fontSize: 15.5, fontWeight: '700', color: SLATE[800] },
  pressed: { backgroundColor: SLATE[100] },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  sheetTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: SLATE[500],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: SPACING.sm,
  },
  sheetTitleSpaced: { marginTop: SPACING.lg },
  chipRow: { flexDirection: 'row', gap: SPACING.sm },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: SLATE[50],
  },
  chipText: { fontSize: 14, fontWeight: '600', color: SLATE[700] },
  chipTextActive: { color: '#ffffff' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  monthCell: {
    width: '22%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: SLATE[50],
  },
  monthText: { fontSize: 13.5, fontWeight: '600', color: SLATE[700] },
  close: {
    marginTop: SPACING.lg,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: SLATE[100],
  },
  closeText: { fontSize: 14, fontWeight: '700', color: SLATE[700] },
});
