import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import usePortalLogout from '../../hooks/usePortalLogout';
import { makeStyles } from '../../utils/makeStyles';

/**
 * Shown to a partner whose account an admin has not verified yet.
 *
 * Ports PartnerVerificationPending.js. Its two lines of copy are kept close to the web's wording
 * ("dashboard access is available only after admin verification"), with the unlock list added
 * because a bare refusal reads as a fault rather than a step.
 *
 * ── NOTHING IS REACHABLE FROM HERE, AND THAT IS CORRECT ──────────────────────
 * The parent's version of this screen keeps a Change Password button, because
 * `ParentAccountController` is the one endpoint that names `UNVERIFIED_PARENT`. The partner has no
 * such endpoint: no `@PreAuthorize` anywhere names `UNVERIFIED_PARTNER`, and all five partner
 * controllers require `hasRole('PARTNER')`. So this screen offers only "log out" — anything else
 * would be a button that always fails.
 */

const UNLOCKS = [
  'See subscriptions and revenue from your linked schools',
  'Track monthly earnings and commission',
  'Add the bank details your payouts are released to',
];

export default function PartnerPendingScreen() {
  const styles = useStyles();
  const palette = usePalette();
  // Bare `logout` only clears storage — it does not navigate, so the user stayed put on a
  // signed-out screen. See hooks/usePortalLogout.js.
  const { confirmLogout } = usePortalLogout({ loginRoute: '/auth/partner-login' });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Ionicons name="hourglass-outline" size={34} color={palette.primaryDark} />
        </View>
        <Text style={styles.title}>Partner account pending verification</Text>
        <Text style={styles.text}>
          Your account has been created successfully, but dashboard access is available only after
          admin verification. Please check back later or contact support for an update.
        </Text>

        <Text style={styles.listTitle}>Once verified, you will be able to:</Text>
        {UNLOCKS.map((line) => (
          <View key={line} style={styles.listRow}>
            <Ionicons name="checkmark-circle" size={18} color={palette.primary} />
            <Text style={styles.listText}>{line}</Text>
          </View>
        ))}

        <Pressable
          onPress={confirmLogout}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: palette.primary },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>Back to Login</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((p) => ({
  safe: { flex: 1, backgroundColor: SLATE[50] },
  body: { flex: 1, justifyContent: 'center', padding: SPACING.lg },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: p.tint,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  title: { fontSize: TYPE.headline, fontWeight: '800', color: SLATE[800], textAlign: 'center' },
  text: {
    fontSize: TYPE.body,
    color: SLATE[500],
    textAlign: 'center',
    lineHeight: leading(TYPE.body),
    marginTop: SPACING.sm,
  },
  listTitle: {
    fontSize: TYPE.body,
    fontWeight: '700',
    color: SLATE[600],
    marginTop: SPACING.lg,
    marginBottom: 8,
  },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  listText: { flex: 1, fontSize: TYPE.body, color: SLATE[600], lineHeight: leading(TYPE.body) },
  primaryBtn: {
    marginTop: SPACING.lg,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryText: { color: '#ffffff', fontWeight: '700', fontSize: TYPE.heading },
  pressed: { opacity: 0.75 },
}));
