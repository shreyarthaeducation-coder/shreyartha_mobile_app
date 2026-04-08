import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONTS, SHADOWS } from '../../constants/theme';

export default function ErrorScreen({ message, onRetry }) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>{message || 'Please check your connection and try again.'}</Text>
      {onRetry ? (
        <TouchableOpacity style={[styles.btn, SHADOWS.sm]} onPress={onRetry}>
          <Text style={styles.btnText}>Try Again</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
  },
  icon: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  title: {
    ...FONTS.bold,
    fontSize: 18,
    color: COLORS.secondary,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  message: {
    ...FONTS.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  btn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 24,
  },
  btnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
});
