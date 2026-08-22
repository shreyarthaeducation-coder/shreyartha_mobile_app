import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { SPACING } from '../../constants/theme';

/**
 * Primary submit button.
 *
 * `loading` both shows the spinner and disables the press — this is the double-submit guard the
 * web page lacks entirely (its buttons stay live during the request).
 */
export default function PrimaryButton({ title, onPress, loading, disabled, palette, style }) {
  const isDisabled = loading || disabled;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: palette.primaryDark },
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.onPrimary} />
      ) : (
        <Text style={[styles.text, { color: palette.onPrimary }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xs,
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.995 }] },
  disabled: { opacity: 0.6 },
  text: { fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
});
