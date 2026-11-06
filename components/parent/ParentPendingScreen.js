import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import usePortalLogout from '../../hooks/usePortalLogout';
import { makeStyles } from '../../utils/makeStyles';
import { ParentLinkBox } from './MyChildrenScreen';

/**
 * Shown to a parent whose account an admin has not verified yet.
 *
 * The web scatters this: Home and Fees each render their own inline "pending verification" block,
 * the chatbot silently does not mount, and the other seven pages fetch anyway and end in generic
 * error states. One screen is both clearer and honest — an unverified parent has no linked student,
 * so every dashboard endpoint would fail regardless.
 *
 * Change Password stays reachable, and that is not an oversight: `ParentAccountController` is the
 * one endpoint that names `UNVERIFIED_PARENT`, so it genuinely works before verification.
 */

const UNLOCKS = [
  'See your child’s academic progress and attendance',
  'Read counsellor notes and reports',
  'View and pay school fees',
];

export default function ParentPendingScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  // Bare `logout` only clears storage — it does not navigate, so the user stayed put on a
  // signed-out screen. See hooks/usePortalLogout.js.
  const { confirmLogout } = usePortalLogout({ loginRoute: '/auth/sign-in' });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.iconWrap}>
          <Ionicons name="hourglass-outline" size={34} color={palette.primaryDark} />
        </View>
        <Text style={styles.title}>Account pending verification</Text>
        <Text style={styles.text}>
          Your parent account is waiting to be verified and linked to your child’s profile. Enter the
          parent code from your child’s school below to do it now, or wait for the school to verify you.
        </Text>

        <Text style={styles.listTitle}>Once verified, you will be able to:</Text>
        {UNLOCKS.map((line) => (
          <View key={line} style={styles.listRow}>
            <Ionicons name="checkmark-circle" size={18} color={palette.primary} />
            <Text style={styles.listText}>{line}</Text>
          </View>
        ))}

        {/* The website's code box for every parent without a child (6 Nov 2026): the parent code
            from the school links AND verifies at once, so nobody need wait for an admin. */}
        <Text style={styles.listTitle}>Have a code from the school?</Text>
        <ParentLinkBox
          prompt="Enter the parent code from your child's school, or your child's mobile number or email."
          onLinked={() => router.replace('/parent')}
        />

        <Pressable
          onPress={() => router.push('/parent/change-password')}
          style={({ pressed }) => [styles.outlineBtn, { borderColor: palette.primary }, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={[styles.outlineText, { color: palette.primary }]}>Change Password</Text>
        </Pressable>

        <Pressable
          onPress={confirmLogout}
          style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.ghostText}>Log out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((p) => ({
  safe: { flex: 1, backgroundColor: SLATE[50] },
  body: { flexGrow: 1, justifyContent: 'center', padding: SPACING.lg },
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
  outlineBtn: {
    marginTop: SPACING.sm,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingVertical: 12,
    alignItems: 'center',
  },
  outlineText: { fontWeight: '700', fontSize: TYPE.heading },
  ghostBtn: { marginTop: SPACING.sm, paddingVertical: 12, alignItems: 'center' },
  ghostText: { color: SLATE[500], fontWeight: '700', fontSize: TYPE.heading },
  pressed: { opacity: 0.75 },
}));
