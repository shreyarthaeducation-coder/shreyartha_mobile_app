import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING, TYPE, leading } from '../../constants/theme';

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
    fontSize: TYPE.headline,
    color: COLORS.secondary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...FONTS.subtitle,
    fontSize: TYPE.body,
    color: COLORS.textSecondary,
    lineHeight: leading(TYPE.body),
  },
});
