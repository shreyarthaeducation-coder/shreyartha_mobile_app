import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TOUCH, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import { useTranslations } from '../../hooks/useTranslations';
import { ScreenScaffold } from '../ui';
import { TEACHER_WORKSPACE_GROUPS } from '../../constants/teacherMenu';

/**
 * My Workspace — twelve of the teacher's sixteen tabs, in the four groups they already had.
 *
 * ── WHY A FLAT LIST OF GROUPS RATHER THAN THE OLD ACCORDION ─────────────────
 * The shared shell collapsed these into expandable sections because it had to show all sixteen at
 * once. Twelve across four labelled groups fits a scroll without hiding anything, and an accordion
 * that starts with three of four sections shut is a tab a teacher has to remember exists.
 *
 * The grouping is `constants/teacherMenu.js`'s own and is explicitly documented there as safe to
 * rearrange — what may never change is the item SET, which is why `TEACHER_MENU` is derived from
 * these groups plus the attendance items plus the profile item rather than maintained by hand.
 */

const STRINGS = {
  title: 'My Workspace',
  intro: 'Everything you need for your classes, in one place.',
};

export default function TeacherWorkspaceScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const t = useTranslations(STRINGS);

  return (
    <ScreenScaffold title={t.title} fallbackRoute="/teacher">
      <Text style={styles.intro}>{t.intro}</Text>

      {TEACHER_WORKSPACE_GROUPS.map((group) => (
        <View key={group.key}>
          <View style={styles.groupHead}>
            <Ionicons name={group.icon} size={16} color={palette.primaryDark} />
            <Text style={styles.groupLabel}>{group.label}</Text>
          </View>

          <View style={styles.grid}>
            {group.items.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => router.push(item.native)}
                style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <View style={styles.tileIcon}>
                  <Ionicons name={item.icon} size={19} color={palette.primaryDark} />
                </View>
                <Text style={styles.tileLabel} numberOfLines={2}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  intro: { fontSize: TYPE.label, color: SLATE[500], lineHeight: leading(TYPE.label), marginBottom: SPACING.md },

  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  groupLabel: {
    fontSize: TYPE.caption,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: SLATE[500],
  },

  // `space-between` for the horizontal gutter, `rowGap` for the vertical one — never `gap` with a
  // 48% width, which overflows and drops the grid to one tile per row.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  tile: {
    width: '48.5%',
    minHeight: TOUCH.min,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SLATE[200],
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 5,
    elevation: 1,
  },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: p.tint,
  },
  tileLabel: { flex: 1, fontSize: TYPE.label, fontWeight: '600', color: SLATE[700] },

  pressed: { opacity: 0.8 },
}));
