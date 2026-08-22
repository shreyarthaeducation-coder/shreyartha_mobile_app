import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING } from '../../constants/theme';

/**
 * Dropdown replacement built as a bottom-sheet modal.
 *
 * Deliberately not @react-native-picker/picker (which is installed): on iOS it renders an inline
 * wheel that breaks a card layout, on Android a system dialog, and neither can be styled to match
 * the portal palette. A modal sheet looks and behaves identically on both platforms.
 */
export default function SelectField({
  label,
  required,
  value,
  options,
  onChange,
  palette,
  error,
  placeholder = 'Select…',
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      ) : null}

      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label || 'Select'}. Current value ${selected?.label || 'none'}`}
        style={[styles.field, { borderColor: error ? FEEDBACK.errorText : SLATE[200] }]}
      >
        <Text style={[styles.value, !selected && styles.placeholder]}>
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={SLATE[500]} />
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{label || 'Select an option'}</Text>

            <FlatList
              data={options}
              keyExtractor={(item) => String(item.value)}
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: SPACING.md },
  label: { fontSize: 13, fontWeight: '600', color: SLATE[700], marginBottom: 6 },
  required: { color: '#e74c3c' },
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
  value: { fontSize: 15, color: SLATE[900] },
  placeholder: { color: SLATE[400] },
  error: { marginTop: 5, fontSize: 12.5, color: FEEDBACK.errorText, fontWeight: '500' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingBottom: SPACING.lg,
    maxHeight: '70%',
  },
  sheetHandle: {
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
  optionText: { fontSize: 15, color: SLATE[700] },
});
