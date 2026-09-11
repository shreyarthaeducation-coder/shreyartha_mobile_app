import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TOUCH, TYPE, leading } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { Card } from '../../ui';

/**
 * "Change your password" — an account action, on the screen where a portal keeps account things.
 *
 * ══ WHY THIS COMPONENT EXISTS ══════════════════════════════════════════════
 * This used to be a lock-icon chip in `BrandBar`, and `BrandBar` is the header of ten surfaces. When
 * the school crest took the lead position, the button was removed from that shared header — but an
 * audit first showed that removing it would STRAND four portals: the only other route into
 * change-password anywhere in the app was one row in `StaffSupportScreen`, which serves the staff
 * shell alone. The teacher's support screen had no password row, the student's Support tab is a
 * chatbot, the parent has no footer at all, and the partner had nothing.
 *
 * So the row moved rather than vanished, and it is a component rather than four copies precisely
 * because the last version of this was one control on ten screens and nobody could tell.
 *
 * `route` differs per portal — `/student/change-password`, `/teacher/change-password`,
 * `/parent/change-password`, `/partner/change-password`, and `config.routes.changePassword` for the
 * staff shell — so it is a required prop with no default. A default would be a guess that resolves
 * to a real-looking screen for the wrong role.
 *
 * `StaffSupportScreen` deliberately does NOT use this: its row sits inside an existing "Who to ask"
 * card between two sibling rows and shares that card's dividers. Lifting it out would either break
 * that grouping or force this component to know about it.
 */
export default function ChangePasswordRow({
  route,
  label = 'Change your password',
  description = 'Set a new password for your account.',
}) {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();

  if (!route) return null;

  return (
    <Card>
      <Pressable
        onPress={() => router.push(route)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${description}`}
      >
        <View style={styles.icon}>
          <Ionicons name="lock-closed-outline" size={19} color={palette.primaryDark} />
        </View>
        <View style={styles.text}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={SLATE[400]} />
      </Pressable>
    </Card>
  );
}

const useStyles = makeStyles((p) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    minHeight: TOUCH.min,
    paddingVertical: SPACING.sm,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: p.tint,
  },
  text: { flex: 1 },
  label: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[800] },
  description: { fontSize: TYPE.caption, color: SLATE[500], lineHeight: leading(TYPE.caption), marginTop: 2 },
  pressed: { opacity: 0.8 },
}));
