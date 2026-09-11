import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TOUCH, TYPE, leading } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { useTranslations } from '../../../hooks/useTranslations';
import { ScreenScaffold } from '../../ui';
import { resolveStaffMenus } from '../../../constants/staffRoles';
import { getStaffHome, itemsFor } from '../../../constants/staffHome';

/**
 * My Workspace — the tile grid behind the first hero, for any redesigned staff panel.
 *
 * The teacher's equivalent hardcodes `TEACHER_WORKSPACE_GROUPS`; this one reads the arrangement for
 * whichever role the `[role]` segment names. Same geometry deliberately, so the two panels do not
 * drift into two different grids.
 *
 * ── THE GROUPS ARE AN ARRANGEMENT, NOT A SECOND SOURCE OF TILES ─────────────
 * `constants/staffHome.js` lists only KEYS; the label, icon and route come from the role's own menu
 * in `staffRoles.js`. So a tile is defined once, and this screen cannot show a stale label for a
 * route that was renamed elsewhere. `itemsFor` resolves the keys and quietly drops any the menu no
 * longer carries — `assertArrangementCovers` is what makes an accidental omission a caught error
 * rather than a silently missing card.
 */

const STRINGS = {
  title: 'My Workspace',
  intro: 'Everything you need for your day, in one place.',
};

export default function StaffWorkspaceScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const t = useTranslations(STRINGS);

  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  const config = resolveStaffMenus(roleKey);
  const home = getStaffHome(roleKey);

  // A role without a descriptor never reaches this route from its own menu, so `null` here is the
  // same "unreachable except by hand-typed deep link" shape the other staff wrappers use.
  if (!config || !home) return null;

  return (
    <ScreenScaffold title={t.title} fallbackRoute={`/staff/${roleKey}`}>
      <Text style={styles.intro}>{t.intro}</Text>

      {home.workspaceGroups.map((group) => {
        const items = itemsFor(config.menu, group.itemKeys);
        if (!items.length) return null;

        return (
          <View key={group.key}>
            <View style={styles.groupHead}>
              <Ionicons name={group.icon} size={16} color={palette.primaryDark} />
              <Text style={styles.groupLabel}>{group.label}</Text>
            </View>

            <View style={styles.grid}>
              {items.map((item) => (
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
        );
      })}
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
