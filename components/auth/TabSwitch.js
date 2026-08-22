import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SLATE, SPACING } from '../../constants/theme';

/**
 * Segmented Login / Signup switch.
 *
 * Rendered as a pill segmented control rather than the web's two bordered buttons — the
 * segmented control is the native idiom and reads better at phone width.
 */
export default function TabSwitch({ tabs, activeKey, onChange, palette, disabled }) {
  return (
    <View style={styles.wrap} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <Pressable
            key={tab.key}
            onPress={() => !disabled && onChange(tab.key)}
            disabled={disabled}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.tab, active && { backgroundColor: palette.primaryDark }]}
          >
            <Text style={[styles.label, active ? styles.labelActive : null]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: SLATE[100],
    borderRadius: 12,
    padding: 4,
    marginBottom: SPACING.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  label: { fontSize: 14.5, fontWeight: '600', color: SLATE[500] },
  labelActive: { color: '#ffffff' },
});
