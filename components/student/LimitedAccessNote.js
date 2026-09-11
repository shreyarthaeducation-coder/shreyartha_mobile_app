import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';

/**
 * The "some of this is locked" banner — the native twin of
 * `frontendmain/src/student/platform/AcademicIQ/LimitedAccessBanner.js`.
 *
 * SHOW IT PER SECTION, NOT GLOBALLY. `useStudentAccess(...).limited` is scoped to one component
 * for this reason: the web deliberately uses `hasComponentRestrictions(component)` rather than its
 * global `isLimited`, so a student browsing a section where nothing is restricted is not told
 * their access is limited.
 *
 * Two wordings, as the web has: a monthly custom plan unlocks progressively, so telling that
 * student to "upgrade" would be wrong — they are already paying and simply have not reached the
 * month yet.
 */
export default function LimitedAccessNote({ monthlyPlan = false, currentMonth = 0 }) {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Ionicons name="lock-closed" size={18} color={palette.primary} />
        <View style={styles.text}>
          <Text style={styles.title}>
            {monthlyPlan ? `Month ${currentMonth} Access` : 'Limited Access'}
          </Text>
          <Text style={styles.sub}>
            {monthlyPlan
              ? `You're on Month ${currentMonth}. Content unlocks progressively as you continue your monthly payments.`
              : 'Unlock full access by upgrading to Premium Student.'}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={() =>
          router.push({
            pathname: '/student/feature',
            params: { path: '/student/platform/plans', title: 'My Plan' },
          })
        }
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Text style={styles.btnText}>{monthlyPlan ? 'Unlock All Now' : 'Upgrade Plan'}</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((p) => ({
  // A card. It was the glass treatment, floating on the background photograph; with the photo
  // gone there is nothing to see through, so it is a plain bordered surface like every other.
  wrap: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  text: { flex: 1 },
  title: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },
  sub: { fontSize: TYPE.caption, color: SLATE[600], lineHeight: leading(TYPE.caption), marginTop: 2 },
  btn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: p.primary,
  },
  btnText: { fontSize: TYPE.label, fontWeight: '700', color: p.onPrimary },
  pressed: { opacity: 0.78 },
}));
