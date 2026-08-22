import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SHADOWS, SLATE, SPACING } from '../../constants/theme';
import { usePalette } from './PaletteContext';

/**
 * The white rounded card the staff screens are built from, plus its two usual children.
 *
 * These styles were copy-pasted across StaffProfileScreen, StaffMenuScreen, StaffPendingScreen
 * and StaffChangePasswordScreen; this is that shape extracted once. Like the auth kit, every
 * component here takes an optional `palette` so the parent/student portals can reuse it.
 */

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function CardTitle({ children, style }) {
  return <Text style={[styles.cardTitle, style]}>{children}</Text>;
}

/** Icon tile + label + value, with an em-dash when the value is empty. */
export function InfoRow({ icon, label, value, palette: paletteProp }) {
  const contextPalette = usePalette();
  // Explicit prop wins; otherwise the surrounding portal palette (teal by default).
  const palette = paletteProp || contextPalette;
  return (
    <View style={styles.row}>
      {icon ? (
        <View style={[styles.rowIcon, { backgroundColor: palette.tint }]}>
          <Ionicons name={icon} size={17} color={palette.primaryDark} />
        </View>
      ) : null}
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value || '—'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SLATE[200],
    padding: SPACING.md,
    marginTop: SPACING.md,
    ...SHADOWS.sm,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: SLATE[500],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: SPACING.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 11.5, color: SLATE[500], fontWeight: '600' },
  rowValue: { fontSize: 14.5, color: SLATE[800], marginTop: 1 },
});
