import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING } from '../../constants/theme';

/** Checkbox + wrapping label, used for the signup terms acknowledgement. */
export default function CheckboxRow({ checked, onToggle, label, error, palette }) {
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onToggle}
        style={styles.row}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: !!checked }}
        accessibilityLabel={label}
        hitSlop={6}
      >
        <View
          style={[
            styles.box,
            {
              borderColor: error && !checked ? FEEDBACK.errorText : SLATE[300],
            },
            checked && { backgroundColor: palette.primaryDark, borderColor: palette.primaryDark },
          ]}
        >
          {checked ? <Ionicons name="checkmark" size={14} color="#ffffff" /> : null}
        </View>
        <Text style={styles.label}>{label}</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: SPACING.md },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  box: {
    width: 21,
    height: 21,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  label: { flex: 1, fontSize: 13, lineHeight: 19, color: SLATE[600] },
  error: { marginTop: 5, fontSize: 12.5, color: FEEDBACK.errorText, fontWeight: '500' },
});
