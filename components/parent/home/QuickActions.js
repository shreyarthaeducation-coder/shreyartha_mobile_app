import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TOUCH, TYPE, leading } from '../../../constants/theme';
import { makeStyles } from '../../../utils/makeStyles';
import ComingSoon from '../../shared/ComingSoon';

/**
 * The parent dashboard's row of quick actions: Pay Fees, Payment History, Notifications,
 * Download Reports.
 *
 * ── A TILE WITH NO ENDPOINT IS INERT, AND THAT IS DELIBERATE ───────────────
 * Download Reports has no backing endpoint for a parent — see the header of
 * `components/shared/ComingSoon.js` for what was actually checked. A `soon` tile renders as a plain
 * `View` carrying the badge, never as a `Pressable`, so a tap does nothing at all rather than
 * navigating somewhere that then has nothing to show. (Notifications was inert too, until the parent
 * inbox existed; it is a normal tile now.)
 *
 * ── EACH TILE OWNS ITS TINT ─────────────────────────────────────────────────
 * The design gives the four tiles four pastel washes. They are decoration and carry no state, so
 * they are literal rgba here rather than four new palette tokens to keep in step — the same call
 * the student identity card's icon tiles made.
 *
 * @param {Array<{key,label,description,icon,tint,route?,soon?}>} actions
 */

export default function QuickActions({ actions = [], onPress }) {
  const styles = useStyles();

  return (
    <View style={styles.grid}>
      {actions.map((action) => {
        const body = (
          <>
            <View style={[styles.icon, styles[action.tint || 'blue']]}>
              <Ionicons name={action.icon} size={19} color={action.color} />
            </View>
            <Text style={styles.label} numberOfLines={1}>
              {action.label}
            </Text>
            <Text style={styles.description} numberOfLines={2}>
              {action.description}
            </Text>
            {action.soon ? <ComingSoon style={styles.soon} /> : null}
          </>
        );

        if (action.soon) {
          return (
            <View
              key={action.key}
              style={[styles.tile, styles.tileSoon]}
              accessibilityLabel={`${action.label}. Not available yet.`}
            >
              {body}
            </View>
          );
        }

        return (
          <Pressable
            key={action.key}
            onPress={() => onPress?.(action)}
            style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`${action.label}. ${action.description}`}
          >
            {body}
            <Ionicons name="chevron-forward" size={16} color={SLATE[400]} style={styles.chevron} />
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
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: SLATE[200],
    padding: SPACING.md,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  tileSoon: { backgroundColor: SLATE[50] },

  icon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  green: { backgroundColor: 'rgba(16, 185, 129, 0.14)' },
  blue: { backgroundColor: 'rgba(59, 130, 246, 0.14)' },
  amber: { backgroundColor: 'rgba(245, 158, 11, 0.16)' },
  violet: { backgroundColor: 'rgba(147, 51, 234, 0.14)' },

  label: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  description: { fontSize: TYPE.caption, color: SLATE[500], lineHeight: leading(TYPE.caption), marginTop: 2 },
  soon: { marginTop: SPACING.sm },
  chevron: { position: 'absolute', right: 10, bottom: 10 },

  pressed: { opacity: 0.8 },
}));
