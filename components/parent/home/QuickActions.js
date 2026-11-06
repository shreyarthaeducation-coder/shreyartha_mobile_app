import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TOUCH, TYPE, leading } from '../../../constants/theme';
import { hueOf } from '../../../constants/parentColours';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * The parent dashboard's row of quick actions: Pay Fees, Payment History, Notifications and
 * View Report.
 *
 * Every tile opens something real (4 Nov 2026): the inert "Coming soon" Download Reports tile is
 * View Report now, the child's tests, report card and counselling report.
 *
 * Each tile wears its area's hue (constants/parentColours) — a soft wash, its border and its ink —
 * the same hue the area has everywhere else in the parent app. Labels may take two lines: "Payment
 * History" cut to "Payment Hist…" on a 360dp phone.
 *
 * @param {Array<{key,label,description,icon,route}>} actions
 */

export default function QuickActions({ actions = [], onPress }) {
  const styles = useStyles();

  return (
    <View style={styles.grid}>
      {actions.map((action) => {
        const hue = hueOf(action.key);
        return (
          <Pressable
            key={action.key}
            onPress={() => onPress?.(action)}
            style={({ pressed }) => [
              styles.tile,
              { backgroundColor: hue.bg, borderColor: hue.border },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${action.label}. ${action.description}`}
          >
            <View style={[styles.icon, { borderColor: hue.border }]}>
              <Ionicons name={action.icon} size={19} color={hue.fg} />
            </View>
            <Text style={[styles.label, { color: hue.fg }]} numberOfLines={2}>
              {action.label}
            </Text>
            <Text style={styles.description} numberOfLines={2}>
              {action.description}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={hue.fg} style={styles.chevron} />
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  // `space-between` for the horizontal gutter and `rowGap` for the vertical one. Two-up rather than
  // the design's four-across: four tiles on a 360dp phone leaves ~78dp each, which cannot hold
  // "Payment History" on one line, let alone its subtitle.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  tile: {
    width: '48.5%',
    minHeight: TOUCH.min,
    borderRadius: 16,
    borderWidth: 1,
    padding: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    backgroundColor: '#ffffff',
    borderWidth: 1,
  },
  label: { fontSize: TYPE.heading, fontWeight: '800', lineHeight: leading(TYPE.heading) },
  description: { fontSize: TYPE.caption, color: SLATE[600], lineHeight: leading(TYPE.caption), marginTop: 2 },
  chevron: { position: 'absolute', right: 10, bottom: 10 },

  pressed: { opacity: 0.8 },
}));
