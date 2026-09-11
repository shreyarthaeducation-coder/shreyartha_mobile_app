import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { TYPE } from '../../constants/theme';

/** Inline text link — "Forgot Password?", "Back to Login", the signup/login footer toggle. */
export default function LinkButton({ label, onPress, color, align = 'center', style }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="link"
      style={[{ alignSelf: alignToFlex(align) }, styles.press, style]}
    >
      {({ pressed }) => (
        <Text style={[styles.text, { color }, pressed && styles.pressed]}>{label}</Text>
      )}
    </Pressable>
  );
}

const alignToFlex = (align) =>
  align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';

const styles = StyleSheet.create({
  press: { paddingVertical: 6 },
  text: { fontSize: TYPE.body, fontWeight: '600' },
  pressed: { opacity: 0.6, textDecorationLine: 'underline' },
});
