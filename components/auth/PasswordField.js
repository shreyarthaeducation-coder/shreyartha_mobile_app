import React, { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE } from '../../constants/theme';
import FormField from './FormField';

/**
 * Password input with a show/hide toggle.
 *
 * The web uses 👁️/🙈 emoji; on mobile these render inconsistently across platforms and read as
 * decoration rather than a control, so this uses proper Ionicons with an accessibility label.
 */
export default function PasswordField({ palette, ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <FormField
      {...props}
      palette={palette}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      textContentType="password"
      rightSlot={
        <Pressable
          onPress={() => setVisible((v) => !v)}
          hitSlop={10}
          style={styles.toggle}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        >
          <Ionicons
            name={visible ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={SLATE[500]}
          />
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  toggle: { paddingLeft: 8, paddingVertical: 4 },
});
