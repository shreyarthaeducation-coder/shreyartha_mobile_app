import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING } from '../../constants/theme';
import { usePalette } from './PaletteContext';

/**
 * "Nothing here yet" block for the staff screens.
 *
 * Deliberately NOT app/components/EmptyState.js — that one is painted in the red marketing
 * palette (COLORS.primary) used by the public landing tabs, which looks wrong inside a teal
 * staff panel.
 */

export default function EmptyState({
  icon = 'file-tray-outline',
  title,
  message,
  actionLabel,
  onAction,
  palette: paletteProp,
  style,
}) {
  const contextPalette = usePalette();
  // Explicit prop wins; otherwise the surrounding portal palette (teal by default).
  const palette = paletteProp || contextPalette;
  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.iconWrap, { backgroundColor: palette.tint }]}>
        <Ionicons name={icon} size={28} color={palette.primaryDark} />
      </View>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: palette.primaryDark },
            pressed && styles.actionPressed,
          ]}
          accessibilityRole="button"
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: SPACING.xl, paddingHorizontal: SPACING.lg },
  iconWrap: {
    width: 62,
    height: 62,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: { fontSize: 15.5, fontWeight: '700', color: SLATE[800], textAlign: 'center' },
  message: {
    fontSize: 13.5,
    color: SLATE[500],
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 6,
  },
  action: {
    marginTop: SPACING.md,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  actionPressed: { opacity: 0.8 },
  actionText: { color: '#ffffff', fontWeight: '700', fontSize: 13.5 },
});
