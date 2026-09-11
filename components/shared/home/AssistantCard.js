import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { INK, SLATE, SPACING, TOUCH, TYPE, leading } from '../../../constants/theme';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * Jyora or Shreya, side by side under "Have doubt?".
 *
 * ── EACH ASSISTANT KEEPS ITS OWN COLOUR ─────────────────────────────────────
 * Jyora is purple and Shreya is blue on the website, on every AI action bar in this app, and in the
 * approved design. The panel palette is not applied here on purpose — these two are guests with
 * their own identity, the same reasoning `JyoraSheet` already records for itself. The `accent` prop
 * carries it so the two cards are one component rather than two near-copies.
 *
 * The avatars are the real artwork the rest of the app uses: `Jyora.png` and `Chatbot.png`, already
 * in assets/ and already on the counsellor screen and the AI bars.
 *
 * ── `icon` INSTEAD OF `avatar`, FOR THE CARD THAT SITS BESIDE AN ASSISTANT ───
 * The teacher's For Support block is a PAIR now: Shreya, and a Live Classes shortcut next to her.
 * The shortcut has no character and no artwork — there is no live-classes image in assets/ — but it
 * must line up with the card beside it to the pixel, and every rule that makes a pair line up lives
 * in here: `flex: 1`, the three-line blurb floor, and the CTA pinned to the bottom with
 * `marginTop: 'auto'`. Rebuilding those in a sibling component is how two cards end up half a line
 * apart the first time someone edits one of them.
 *
 * So: pass `avatar` for an assistant, or `icon` (an Ionicons name) for the shortcut beside it. The
 * icon takes the same `accent` the name and CTA do, and occupies exactly the avatar's footprint.
 */

export default function AssistantCard({
  name,
  role,
  blurb,
  cta,
  avatar,
  icon,
  accent,
  onPress,
  tone = 'dark',
  layout = 'column',
}) {
  const styles = useStyles();
  const light = tone === 'light';
  const row = layout === 'row';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        light && styles.cardLight,
        row && styles.cardRow,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${cta}. ${blurb}`}
    >
      {avatar ? (
        <Image
          source={avatar}
          style={[styles.avatar, row && styles.avatarRow]}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            styles.avatar,
            row && styles.avatarRow,
            styles.iconWell,
            light && styles.iconWellLight,
          ]}
        >
          <Ionicons name={icon || 'apps-outline'} size={row ? 30 : 34} color={accent} />
        </View>
      )}

      {/* `row` puts the copy in its own column beside the avatar with the CTA under it, which is
          what a single wide card needs. `column` stacks everything centred — the shape a pair of
          half-width cards needs to stay level with each other. */}
      <View style={row ? styles.rowBody : styles.columnBody}>
        <Text style={[styles.name, row && styles.nameRow, { color: accent }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.role, row && styles.roleRow, { color: accent }]} numberOfLines={1}>
          {role}
        </Text>
        <Text style={[styles.blurb, light && styles.blurbLight, row ? styles.blurbRow : styles.blurbColumn]}>
          {blurb}
        </Text>

        <View style={[styles.cta, row && styles.ctaRow, { backgroundColor: accent }]}>
          <Text style={styles.ctaText} numberOfLines={1}>
            {cta}
          </Text>
          <Ionicons name="chevron-forward" size={15} color="#ffffff" />
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((p) => ({
  card: {
    flex: 1,
    backgroundColor: p.glassDark,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: p.glassDarkBorder,
    padding: SPACING.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 12,
    elevation: 4,
  },
  // tone="light" — the parent panel, whose palette carries no dark tokens.
  cardLight: { backgroundColor: '#ffffff', borderColor: SLATE[200], shadowOpacity: 0.08, shadowRadius: 10 },
  // layout="row" — one wide card rather than a pair. `alignItems` moves off centre so a long blurb
  // wraps against the left edge instead of ragging on both.
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  columnBody: { alignSelf: 'stretch', alignItems: 'center', flex: 1 },
  rowBody: { flex: 1 },
  // Circular and cropped: both source images are square with the character centred, and `cover` on
  // a circle is what the design shows. `contain` would letterbox them inside the circle.
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    marginBottom: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  avatarRow: { width: 64, height: 64, borderRadius: 32, marginBottom: 0 },
  // The `icon` variant. Same footprint as the avatar so a pair stays level; only the fill differs,
  // because an Ionicon on the bare card would float rather than read as the avatar's counterpart.
  iconWell: { alignItems: 'center', justifyContent: 'center' },
  iconWellLight: { backgroundColor: SLATE[100] },
  name: { fontSize: TYPE.title, fontWeight: '800' },
  nameRow: { textAlign: 'left' },
  role: { fontSize: TYPE.caption, fontWeight: '600', opacity: 0.85, marginTop: 1 },
  roleRow: { textAlign: 'left' },
  blurb: {
    fontSize: TYPE.caption,
    color: INK.dark.body,
    lineHeight: leading(TYPE.caption),
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  // A PAIR of cards must end their CTAs at the same height or the row looks broken, so the column
  // layout floors the copy at three lines. Expressed as a floor added here rather than as a
  // `minHeight: 0` cancelled on the row variant — a sub-44 minHeight anywhere reads as a shrunken
  // tap target to the design checker, and it is right to: the exception is invisible at the call site.
  blurbColumn: { minHeight: 48 },
  blurbLight: { color: SLATE[600] },
  // A single wide card has no sibling to stay level with, so it takes no floor — only the centring
  // is undone here.
  blurbRow: { textAlign: 'left' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    alignSelf: 'stretch',
    minHeight: TOUCH.min,
    paddingHorizontal: 10,
    borderRadius: 999,
    marginTop: 'auto',
  },
  ctaRow: { alignSelf: 'flex-start', marginTop: SPACING.sm, paddingHorizontal: 18 },
  ctaText: { fontSize: TYPE.caption, fontWeight: '800', color: '#ffffff', flexShrink: 1 },

  pressed: { opacity: 0.82 },
}));
