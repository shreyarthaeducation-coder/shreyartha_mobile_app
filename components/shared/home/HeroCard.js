import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, TOUCH, TYPE, leading } from '../../../constants/theme';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * One of the dashboard's two big destinations — My Workspace and My Analytics.
 *
 * A gradient slab with an icon tile, a title, a line of copy and a circular chevron. These two are
 * the only gradients in the panel, and that is what makes them read as the primary actions on a
 * screen where everything else is dark glass.
 *
 * ── `children` IS THE POINT OF THE MY ANALYTICS CARD ────────────────────────
 * My Analytics renders a strip of real progress bars underneath its copy. That content was
 * previously stranded inside a once-per-session welcome interstitial nobody saw twice; here it is on
 * the dashboard permanently. The card takes it as `children` rather than growing a `bars` prop, so
 * the workspace card stays exactly as simple as it looks.
 *
 * `expo-linear-gradient` is already a dependency and already shipping in components/auth/AuthScreen.
 */

export default function HeroCard({
  title,
  subtitle,
  icon,
  colors,
  onPress,
  children,
  // ── THE ONLY PAGE-RELATIVE THING ON THIS CARD ─────────────────────────────
  // Every other colour here is relative to the gradient the card paints ITSELF on, which the
  // caller supplies — so a hero is a saturated slab whatever the page behind it is, and needs no
  // light variant for its text, icon tile or chevron. The shadow is the exception: 30% black was
  // tuned to separate the card from a dark photograph, and on a light page it reads as a grey
  // smudge. `tone` exists for that one rule.
  //
  // Defaults to 'dark' so the teacher, partner and staff callers are untouched.
  tone = 'dark',
}) {
  const styles = useStyles();
  const light = tone === 'light';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, light && styles.wrapLight, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
    >
      <LinearGradient
        colors={colors}
        // Diagonal, saturated corner first — the flat left-to-right default makes a card this tall
        // look like a progress bar.
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.head}>
          <View style={styles.iconTile}>
            <Ionicons name={icon} size={24} color="#ffffff" />
          </View>

          <View style={styles.text}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          <View style={styles.chevron}>
            <Ionicons name="chevron-forward" size={19} color="#1f2937" />
          </View>
        </View>

        {children ? <View style={styles.extra}>{children}</View> : null}
      </LinearGradient>
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  wrap: {
    borderRadius: 20,
    marginBottom: SPACING.md,
    // The shadow belongs on the wrapper, not the gradient: a shadow on a LinearGradient child is
    // clipped by the parent's overflow on Android and simply does not draw.
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 14,
    elevation: 6,
  },
  // Softer and tighter on a light page. A 30% black shadow at radius 14 is a grey haze on white.
  wrapLight: { shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  card: { borderRadius: 20, padding: SPACING.md, minHeight: 104, justifyContent: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },

  iconTile: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  text: { flex: 1 },
  title: { fontSize: TYPE.headline, fontWeight: '800', color: '#ffffff' },
  // Full white. It sat at 0.92 opacity, which on the old light gradients took an already failing
  // subtitle lower still; the gradients were darkened so white passes, and a faded white would
  // throw that margin away again.
  subtitle: { fontSize: TYPE.label, color: '#ffffff', lineHeight: leading(TYPE.label), marginTop: 2 },

  chevron: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },

  extra: {
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.28)',
    minHeight: TOUCH.min,
    justifyContent: 'center',
  },

  pressed: { opacity: 0.88 },
}));
