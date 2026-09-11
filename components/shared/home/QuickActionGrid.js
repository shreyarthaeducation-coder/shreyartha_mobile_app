import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE, leading } from '../../../constants/theme';
import { makeStyles } from '../../../utils/makeStyles';
import { tint, tintAt } from './tints';

/**
 * The Quick Actions rail from the approved sales and counsellor designs.
 *
 * A horizontally-scrolling row of pastel cards, each an icon tile, a coloured title, a line of
 * copy and a chevron.
 *
 * ── WHY A RAIL AND NOT A WRAPPING GRID ──────────────────────────────────────
 * The sales design shows five actions with the fifth cut off at the right edge, which is a
 * deliberate scroll affordance rather than a rendering accident — it is what tells the reader
 * there is more. A wrapping grid would put three on the first row and two on the second, leaving a
 * half-empty row directly above the performance card. `CARD_WIDTH` is fixed rather than a
 * percentage so the cut-off card is cut off by the same amount on every screen size.
 *
 * ── THIS IS NOT `HeroCard` ──────────────────────────────────────────────────
 * `HeroCard` is a full-width gradient slab and there are two or three of them per panel; the whole
 * reason they read as the primary action is that nothing else on the screen is a gradient. Five
 * gradients in a row would spend that. These are white cards with one pastel tile each, and the
 * heroes stay exactly as they were, below.
 *
 * ── A TINT IS OPTIONAL ──────────────────────────────────────────────────────
 * An item that names no `tint` takes one from the cycle by position, so a descriptor can leave
 * them out entirely and still get five distinguishable cards.
 *
 * @param {Array<{key, label, blurb?, icon, tint?, onPress}>} actions
 */
export default function QuickActionGrid({ title = 'Quick Actions', actions = [] }) {
  const styles = useStyles();

  if (!actions.length) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {actions.map((action, i) => {
          const hue = action.tint ? tint(action.tint) : tintAt(i);
          return (
            <Pressable
              key={action.key}
              onPress={action.onPress}
              style={({ pressed }) => [
                styles.action,
                { backgroundColor: `${hue.bg}` },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                action.blurb ? `${action.label}. ${action.blurb}` : action.label
              }
            >
              <View style={styles.iconTile}>
                <Ionicons name={action.icon} size={24} color={hue.fg} />
              </View>

              <Text style={[styles.label, { color: hue.fg }]} numberOfLines={2}>
                {action.label}
              </Text>

              {action.blurb ? (
                <Text style={styles.blurb} numberOfLines={3}>
                  {action.blurb}
                </Text>
              ) : null}

              {/* Bottom-right, and pushed there by the spacer above rather than by a fixed
                  height — the cards must stay level whether a blurb wraps to two lines or three. */}
              <View style={styles.spacer} />
              <Ionicons
                name="chevron-forward"
                size={20}
                color={hue.fg}
                style={styles.chevron}
              />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const CARD_WIDTH = 148;

const useStyles = makeStyles(() => ({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: SLATE[200],
    paddingVertical: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2,
  },
  // The heading is padded but the rail is not, so the cards can scroll to the card's own edge
  // instead of stopping short of it.
  title: {
    fontSize: TYPE.title,
    fontWeight: '800',
    color: SLATE[900],
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  rail: { paddingHorizontal: SPACING.md, gap: SPACING.sm },

  action: {
    width: CARD_WIDTH,
    minHeight: 176,
    borderRadius: 18,
    padding: SPACING.md,
    // Not `justifyContent: space-between`: the spacer below does that job, and space-between
    // would also spread the icon and title apart when a blurb is short.
    alignItems: 'flex-start',
  },
  iconTile: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    // White on the pastel ground, so the icon reads as a disc rather than as floating on the card.
    backgroundColor: 'rgba(255,255,255,0.75)',
    marginBottom: SPACING.sm,
  },
  label: { fontSize: TYPE.heading, fontWeight: '800' },
  blurb: { fontSize: TYPE.caption, color: SLATE[600], lineHeight: leading(TYPE.caption), marginTop: 4 },

  spacer: { flex: 1, minHeight: SPACING.sm },
  // Inline decoration inside a card that is itself the button — it needs no tap target of its own,
  // and the card around it is a 176pt control. No `minHeight` here on purpose: writing one, even
  // zero, makes this look like a control that fails the tap guideline.
  chevron: { alignSelf: 'flex-end' },

  pressed: { opacity: 0.75 },
}));
