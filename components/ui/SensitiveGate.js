import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import makeStyles from '../../utils/makeStyles';
import { usePalette } from './PaletteContext';

/**
 * Hides personal or financial content behind one deliberate tap.
 *
 * Used on the HR surfaces — payslips and the salary breakup, EPF/ESI/PT/TDS, UAN and PF account,
 * bank account and IFSC, Aadhaar and PAN, and (for approvers) other employees' salary structures.
 *
 * Gating the whole panel rather than masking each field is the deliberate choice: a screen with
 * forty individually-masked numbers still leaks its shape, still shows the totals row, and gives
 * forty chances to miss one. One panel either shows or does not.
 *
 * This is a speed bump, not an access control — see utils/confirmSensitive.js. It stops the
 * realistic case (a handed-over phone, someone reading over a shoulder) and nothing stronger.
 *
 * Pair with `useSensitiveReveal`, which re-masks on blur so the unlock does not silently persist
 * for the lifetime of the mounted screen.
 *
 * @param {object}   props
 * @param {boolean}  props.revealed
 * @param {Function} props.onReveal  awaited; the hook shows the confirmation
 * @param {Function} [props.onHide]  renders a "Hide" control when supplied
 * @param {string}   [props.title]
 * @param {string}   [props.message]
 * @param {string}   [props.actionLabel]
 */
export default function SensitiveGate({
  revealed,
  onReveal,
  onHide,
  title = 'Personal information',
  message = 'Salary, statutory and bank details are hidden until you choose to show them.',
  actionLabel = 'Show details',
  children,
}) {
  const styles = useStyles();
  const palette = usePalette();

  if (revealed) {
    return (
      <>
        {onHide ? (
          <Pressable
            onPress={onHide}
            style={({ pressed }) => [styles.hideRow, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Hide personal information"
          >
            <Ionicons name="eye-off-outline" size={17} color={palette.primaryDark} />
            <Text style={styles.hideText}>Hide details</Text>
          </Pressable>
        ) : null}
        {children}
      </>
    );
  }

  return (
    <View style={styles.panel}>
      <View style={styles.iconWrap}>
        <Ionicons name="lock-closed-outline" size={22} color={palette.primaryDark} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <Pressable
        onPress={onReveal}
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
      >
        <Ionicons name="eye-outline" size={18} color={palette.onPrimary} />
        <Text style={styles.btnText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((p) => ({
  panel: {
    alignItems: 'center',
    backgroundColor: p.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: p.cardBorder,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: p.tint,
    marginBottom: SPACING.sm,
  },
  title: { fontSize: TYPE.title, fontWeight: '700', color: p.primaryDark, textAlign: 'center' },
  message: {
    fontSize: TYPE.label,
    color: SLATE[600],
    textAlign: 'center',
    marginTop: 6,
    marginBottom: SPACING.md,
    lineHeight: leading(TYPE.label),
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: SPACING.lg,
    borderRadius: 999,
    backgroundColor: p.primary,
  },
  btnText: { fontSize: TYPE.body, fontWeight: '700', color: p.onPrimary },

  hideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 5,
    minHeight: 44,
    paddingHorizontal: SPACING.sm,
    marginBottom: 2,
  },
  hideText: { fontSize: TYPE.label, fontWeight: '600', color: p.primaryDark },
  pressed: { opacity: 0.75 },
}));
