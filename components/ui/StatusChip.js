import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK } from '../../constants/theme';
import { usePalette } from './PaletteContext';

/**
 * Soft-tint status pill. Mirrors the web's `.hr-status--*` convention (a tinted background plus
 * matching text colour) rather than a solid badge, so a row of them stays readable.
 *
 * `tone` picks the palette: success | warning | error | info | neutral. `info` follows the
 * portal accent, so a teal panel gets a teal chip without the caller naming a colour.
 */

const TONES = {
  success: { bg: FEEDBACK.successBg, border: FEEDBACK.successBorder, text: FEEDBACK.successText },
  warning: { bg: FEEDBACK.warningBg, border: FEEDBACK.warningBorder, text: FEEDBACK.warningText },
  error: { bg: FEEDBACK.errorBg, border: FEEDBACK.errorBorder, text: FEEDBACK.errorText },
  neutral: { bg: FEEDBACK.neutralBg, border: FEEDBACK.neutralBorder, text: FEEDBACK.neutralText },
};

export default function StatusChip({
  label,
  tone = 'neutral',
  icon,
  palette: paletteProp,
  style,
}) {
  const contextPalette = usePalette();
  // Explicit prop wins; otherwise the surrounding portal palette (teal by default).
  const palette = paletteProp || contextPalette;
  const colors =
    tone === 'info'
      ? { bg: palette.tint, border: 'transparent', text: palette.primaryDark }
      : TONES[tone] || TONES.neutral;

  return (
    <View
      style={[styles.chip, { backgroundColor: colors.bg, borderColor: colors.border }, style]}
    >
      {icon ? <Ionicons name={icon} size={13} color={colors.text} /> : null}
      <Text style={[styles.text, { color: colors.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  text: { fontSize: 12, fontWeight: '700' },
});
