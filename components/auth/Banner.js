import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SPACING, TYPE, leading } from '../../constants/theme';

/**
 * Inline error / success banner, matching the web's .school-auth-error and
 * .school-auth-success blocks.
 *
 * Always renders a host View, collapsed to zero height when there is no message. Returning null
 * here changes the native child list of the card — and the login screen clears its error on
 * every keystroke, so after a failed login the first keypress would remove a sibling of the
 * focused TextInput mid-IME-attach, which on Android closes the keyboard.
 */
export default function Banner({ variant = 'error', message }) {
  const success = variant === 'success';

  if (!message) return <View collapsable={false} />;

  return (
    <View
      collapsable={false}
      style={[
        styles.wrap,
        {
          backgroundColor: success ? FEEDBACK.successBg : FEEDBACK.errorBg,
          borderColor: success ? FEEDBACK.successBorder : FEEDBACK.errorBorder,
        },
      ]}
      accessibilityRole="alert"
    >
      <Ionicons
        name={success ? 'checkmark-circle' : 'alert-circle'}
        size={19}
        color={success ? FEEDBACK.successText : FEEDBACK.errorText}
        style={styles.icon}
      />
      <Text
        style={[
          styles.text,
          { color: success ? FEEDBACK.successText : FEEDBACK.errorText },
        ]}
      >
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: SPACING.md,
  },
  icon: { marginTop: 1, marginRight: 8 },
  text: { flex: 1, fontSize: TYPE.body, lineHeight: leading(TYPE.body), fontWeight: '500' },
});
