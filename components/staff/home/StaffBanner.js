import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SLATE, SPACING, TOUCH, TYPE } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * The wide call-to-action strip between the heroes and the For Support block.
 *
 * Introduced for the Principal's "Schedule Live Meeting" card, which the design gives a shape none
 * of the other panels use: an icon, two lines of copy and an explicit button, full width, sitting
 * apart from the hero grid. It is a separate component rather than a `HeroCard` variant because it
 * is a different thing — a hero is a destination, this is an action with a destination attached.
 *
 * ── COLOURS ARE THE PANEL'S, NOT THIS FILE'S ────────────────────────────────
 * Every colour here comes from `palette` or `SLATE`, so the strip takes each panel's accent rather
 * than pinning the mockup's. That matters because this is meant to be reused by the Shreyartha
 * Admin panel next, whose accent is different again.
 *
 * A palette token that a portal does not define renders as `undefined`, which React Native treats
 * as "unset" — a transparent surface with black text, and no warning anywhere. Only `primary`,
 * `primaryDark` and `tint` are read, which `scripts/checkpalette.mjs` proves every palette defines.
 */
export default function StaffBanner({ title, subtitle, icon = 'sparkles', cta, onPress }) {
  const styles = useStyles();
  const palette = usePalette();

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <Ionicons name={icon} size={20} color={palette.onPrimary || '#ffffff'} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {/* The button carries the whole tap target. The strip itself is deliberately NOT pressable:
          two overlapping tap areas doing the same thing is how a screen reader announces one
          control twice. */}
      {cta ? (
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={cta}
        >
          <Ionicons name="add" size={16} color={palette.onPrimary || '#ffffff'} />
          <Text style={styles.ctaText}>{cta}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((p) => ({
  wrap: {
    backgroundColor: p.tint,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: SLATE[200],
    padding: SPACING.md,
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  icon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: p.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 3 },
  title: { fontSize: TYPE.body, fontWeight: '800', color: p.primaryDark },
  subtitle: { fontSize: TYPE.label, color: SLATE[500], lineHeight: 18 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    minHeight: TOUCH.min,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: p.primary,
  },
  ctaText: { fontSize: TYPE.label, fontWeight: '800', color: p.onPrimary },
  pressed: { opacity: 0.85 },
}));
