import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, SHADOWS, FONTS } from '../../constants/theme';

export default function FeatureCard({ icon, title, description, backgroundColor, iconColor }) {
  return (
    <View style={[styles.card, { backgroundColor: backgroundColor || COLORS.surface }, SHADOWS.sm]}>
      <View style={[styles.iconWrap, { backgroundColor: iconColor ? `${iconColor}20` : `${COLORS.primary}15` }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    padding: SPACING.md,
    margin: SPACING.xs,
    minHeight: 140,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  icon: {
    fontSize: 22,
  },
  title: {
    ...FONTS.bold,
    fontSize: 14,
    marginBottom: SPACING.xs,
    color: COLORS.secondary,
  },
  description: {
    ...FONTS.small,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },
});
