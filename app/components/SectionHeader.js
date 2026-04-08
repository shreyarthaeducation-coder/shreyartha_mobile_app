import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONTS } from '../../constants/theme';

export default function SectionHeader({ title, subtitle }) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  title: {
    ...FONTS.title,
    fontSize: 20,
    color: COLORS.secondary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...FONTS.subtitle,
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});
