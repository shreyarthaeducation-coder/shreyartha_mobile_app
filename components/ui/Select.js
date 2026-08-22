import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING } from '../../constants/theme';
import { usePalette } from './PaletteContext';

/**
 * Bottom-sheet select, in two shapes:
 *   variant="chip"  — compact pill for a scope bar: `[ Class 9 ▾ ]`
 *   variant="field" — labelled form field, full width
 *
 * Deliberately not @react-native-picker/picker (installed but unused): on iOS it renders an inline
 * wheel that breaks a card layout, on Android a system dialog, and neither takes the portal palette.
 *
 * NOTE ON DUPLICATION: components/auth/SelectField.js already implements this sheet. It is not
 * reused or refactored here on purpose — it is a shipped login-screen component, and the Android
 * keyboard-dismiss bugs that took two sessions to pin down all came from touching components that
 * sit near a focused TextInput. Fold SelectField into this one only once the login screens get
 * device time again.
 */

export default function Select({
  variant = 'field',
  label,
  value,
  options = [],
  onChange,
  placeholder = 'Select…',
  disabled = false,
  error,
  // Opt-in: adds a filter box to the sheet. Needed for SKILLS_MEASURED, which has 33 entries;
  // the short pickers stay exactly as they were.
  searchable = false,
  palette: paletteProp,
  style,
}) {
  const contextPalette = usePalette();
  // Explicit prop wins; otherwise the surrounding portal palette (teal by default).
  const palette = paletteProp || contextPalette;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((option) => option.value === value);
  const chip = variant === 'chip';

  const visibleOptions = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const needle = query.trim().toLowerCase();
    return options.filter((option) => String(option.label).toLowerCase().includes(needle));
  }, [searchable, query, options]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const trigger = chip ? (
    <Pressable
      onPress={() => setOpen(true)}
      disabled={disabled || options.length === 0}
      style={({ pressed }) => [
        styles.chip,
        selected && { backgroundColor: palette.tint, borderColor: palette.primary },
        (disabled || options.length === 0) && styles.chipDisabled,
        pressed && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${label || 'Select'}: ${selected?.label || placeholder}`}
    >
      <Text
        style={[styles.chipText, selected && { color: palette.primaryDark }]}
        numberOfLines={1}
      >
        {selected ? selected.label : placeholder}
      </Text>
      <Ionicons
        name="chevron-down"
        size={14}
        color={selected ? palette.primaryDark : SLATE[500]}
      />
    </Pressable>
  ) : (
    <View style={[styles.fieldWrap, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled || options.length === 0}
        style={({ pressed }) => [
          styles.field,
          { borderColor: error ? FEEDBACK.errorText : SLATE[200] },
          disabled && styles.chipDisabled,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${label || 'Select'}: ${selected?.label || placeholder}`}
      >
        <Text style={[styles.fieldValue, !selected && styles.placeholder]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={SLATE[500]} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );

  return (
    <>
      {trigger}

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          {/* Swallow taps on the sheet so they don't reach the backdrop and close it. */}
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{label || 'Select an option'}</Text>

            {searchable ? (
              <View style={styles.searchRow}>
                <Ionicons name="search" size={16} color={SLATE[400]} />
                <TextInput
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search…"
                  placeholderTextColor={SLATE[400]}
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {query ? (
                  <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
                    <Ionicons name="close-circle" size={17} color={SLATE[400]} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <FlatList
              data={visibleOptions}
              keyExtractor={(item) => String(item.value)}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                searchable ? <Text style={styles.noMatch}>No matches.</Text> : null
              }
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <Pressable
                    onPress={() => {
                      close();
                      if (!active) onChange(item.value, item);
                    }}
                    style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        active && { color: palette.primaryDark, fontWeight: '700' },
                      ]}
                    >
                      {item.label}
                    </Text>
                    {active ? (
                      <Ionicons name="checkmark" size={19} color={palette.primaryDark} />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
    maxWidth: '100%',
  },
  chipDisabled: { opacity: 0.5 },
  chipText: { flexShrink: 1, fontSize: 13, fontWeight: '600', color: SLATE[600] },
  pressed: { opacity: 0.7 },

  fieldWrap: { marginBottom: SPACING.md },
  label: { fontSize: 13, fontWeight: '600', color: SLATE[700], marginBottom: 6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  fieldValue: { flex: 1, fontSize: 15, color: SLATE[900] },
  placeholder: { color: SLATE[400] },
  error: { marginTop: 5, fontSize: 12.5, color: FEEDBACK.errorText, fontWeight: '500' },

  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingBottom: SPACING.lg,
    maxHeight: '70%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: SLATE[300],
    marginBottom: SPACING.sm,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: SLATE[800],
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 10,
    backgroundColor: SLATE[50],
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14.5, color: SLATE[900] },
  noMatch: {
    fontSize: 13,
    color: SLATE[400],
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  optionPressed: { backgroundColor: SLATE[50] },
  optionText: { flex: 1, fontSize: 15, color: SLATE[700] },
});
