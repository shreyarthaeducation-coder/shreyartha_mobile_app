import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONTS } from '../../constants/theme';

export default function PageHero({ title, subtitle, icon, backgroundColor }) {
  const bg = backgroundColor || COLORS.primary;

  return (
    <View style={[styles.hero, { backgroundColor: bg }]}>
      {/* Decorative circles for gradient feel */}
      <View style={[styles.circle, styles.circleLarge, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
      <View style={[styles.circle, styles.circleSmall, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />

      <View style={styles.content}>
        {icon ? <Text style={styles.icon}>{icon}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl + SPACING.md,
    overflow: 'hidden',
    position: 'relative',
  },
  circle: {
    position: 'absolute',
    borderRadius: 999,
  },
  circleLarge: {
    width: 220,
    height: 220,
    top: -60,
    right: -60,
  },
  circleSmall: {
    width: 120,
    height: 120,
    bottom: -30,
    left: -20,
  },
  content: {
    alignItems: 'center',
    zIndex: 1,
  },
  icon: {
    fontSize: 52,
    marginBottom: SPACING.md,
  },
  title: {
    ...FONTS.title,
    color: COLORS.white,
    textAlign: 'center',
    fontSize: 26,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    ...FONTS.subtitle,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: SPACING.md,
  },
});
