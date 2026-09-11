import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SHADOWS, SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../../components/ui/PaletteContext';
import { PrimaryButton } from '../auth';
import useStaffLogout from '../../hooks/useStaffLogout';
import { makeStyles } from '../../utils/makeStyles';

/**
 * Shown when a staff member logs in before their administrator has verified the account.
 *
 * Copy mirrors the web pending screens, which withhold the sidebar and every feature route until
 * `schoolUserVerified` is true.
 *
 * There is no "refresh" action on purpose: `verified` only comes back on a fresh login response,
 * so logging in again is the honest way to pick up the change.
 */


export default function StaffPendingScreen({ roleLabel = 'Staff', unlocks = [] }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const { confirmLogout, loggingOut } = useStaffLogout();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.body}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="hourglass-outline" size={34} color={PALETTE.primaryDark} />
          </View>

          <Text style={styles.title}>Account Pending Verification</Text>
          <Text style={styles.text}>
            Your {roleLabel} account is currently pending verification by the school administrator.
          </Text>

          {unlocks.length > 0 ? (
            <>
              <Text style={styles.listIntro}>Once verified, you will be able to:</Text>
              <View style={styles.list}>
                {unlocks.map((item) => (
                  <View key={item} style={styles.listRow}>
                    <Ionicons name="checkmark-circle-outline" size={19} color={PALETTE.primary} />
                    <Text style={styles.listText}>{item}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <Text style={styles.note}>
            Log in again once your administrator has verified your account.
          </Text>

          <PrimaryButton
            title="Log Out"
            onPress={confirmLogout}
            loading={loggingOut}
            palette={PALETTE}
            style={styles.logoutBtn}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((p) => ({
  safe: { flex: 1, backgroundColor: SLATE[50] },
  body: { flex: 1, justifyContent: 'center', padding: SPACING.md },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: SLATE[200],
    ...SHADOWS.md,
  },
  iconWrap: {
    alignSelf: 'center',
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: p.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: TYPE.headline,
    fontWeight: '700',
    color: SLATE[800],
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  text: {
    fontSize: TYPE.heading,
    lineHeight: leading(TYPE.heading),
    color: SLATE[600],
    textAlign: 'center',
  },
  listIntro: {
    fontSize: TYPE.heading,
    fontWeight: '600',
    color: SLATE[700],
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  list: { gap: 10 },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  listText: { flex: 1, fontSize: TYPE.body, lineHeight: leading(TYPE.body), color: SLATE[600] },
  note: {
    fontSize: TYPE.body,
    lineHeight: leading(TYPE.body),
    color: SLATE[500],
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
  logoutBtn: { marginTop: SPACING.md },
}));
