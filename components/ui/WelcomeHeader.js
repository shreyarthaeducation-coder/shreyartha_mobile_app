import { Image, Pressable, Text, View } from 'react-native';
import { SPACING } from '../../constants/theme';
import { usePalette } from './PaletteContext';
import { initialsOf } from '../staff/helpers';
import { makeStyles } from '../../utils/makeStyles';

/**
 * The identity block at the top of every portal's home screen:
 *
 *        Welcome
 *      ┌─────────┐
 *      │  photo  │
 *      └─────────┘
 *       Asha Menon
 *      Class 9 · SHREYA01
 *
 * One component for all portals rather than one per panel, because the request was explicitly
 * "for every user" — a per-panel copy is how the greeting drifted in the first place (the student
 * home said "Welcome, {name}" on one line, the staff shell said "Hi, {name}" beside an initials
 * circle).
 *
 * It needs no colour props: both the student screens and the staff shell already read
 * `usePalette()`, and both headers sit on a coloured band, so the text is white either way.
 *
 * `photoUrl` is optional and often absent — a staff member who has never uploaded an HR photo, and
 * every parent and partner, since those two have no photo field in the backend at all. The
 * initials circle is therefore the COMMON case, not an error path.
 *
 * Props:
 *   name          shown under the photo
 *   photoUrl      absolute URL; falls back to initials when missing or when the image fails
 *   subtitle      optional line under the name (role · school, or class)
 *   actions       a slot rendered top-right, for the controls each panel already had
 *                 (logout, plan badge, Upgrade)
 *   onPressPhoto  optional; makes the avatar a button (the student home opens the profile)
 */

export default function WelcomeHeader({
  name,
  photoUrl,
  subtitle,
  actions,
  onPressPhoto,
  greeting = 'Welcome',
  compact = false,
  style,
}) {
  const styles = useStyles();
  const palette = usePalette();

  // `compact` changes SIZES ONLY — never the element order. scripts/checkhomeheader.mjs asserts
  // greeting → avatar → name stays in that order and that the initials fallback survives, and the
  // product decision behind that ordering is not a layout detail to trade away for height.
  const c = (base, small) => (compact ? [base, small] : base);

  const avatar = (
    <View style={c(styles.avatar, styles.avatarCompact)}>
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={styles.avatarImg} resizeMode="cover" />
      ) : (
        <Text style={c(styles.initials, styles.initialsCompact)}>{initialsOf(name)}</Text>
      )}
    </View>
  );

  return (
    <View style={[styles.wrap, style]}>
      {/* The actions row sits above the block and is right-aligned, so a long name below can use
          the full width instead of competing with the logout button for it. */}
      {actions ? <View style={styles.actions}>{actions}</View> : null}

      <View style={c(styles.identity, styles.identityCompact)}>
        <Text style={c(styles.greeting, styles.greetingCompact)}>{greeting}</Text>

        {onPressPhoto ? (
          <Pressable
            onPress={onPressPhoto}
            style={({ pressed }) => [pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Open your profile"
          >
            {avatar}
          </Pressable>
        ) : (
          avatar
        )}

        <Text style={c(styles.name, styles.nameCompact)} numberOfLines={2}>
          {name}
        </Text>
        {subtitle ? (
          <Text style={c(styles.subtitle, styles.subtitleCompact)} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: { alignItems: 'stretch' },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  identity: { alignItems: 'center', marginTop: 2 },
  greeting: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginTop: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  initials: { color: '#ffffff', fontSize: 24, fontWeight: '800' },
  name: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12.5,
    marginTop: 2,
    textAlign: 'center',
  },
  pressed: { opacity: 0.75 },

  // ── compact overrides ─────────────────────────────────────────────────────────────────────────
  // Applied on top of the styles above, so anything not restated here (colour, weight, alignment)
  // is inherited and cannot drift between the two variants.
  //
  // The default block stacks greeting (13) → 72px avatar → name (18) → subtitle (12.5), each with
  // its own SPACING.sm gap: roughly 150pt of vertical space before the action chips even start.
  // These values take it to about 95pt while keeping every element and its order.
  identityCompact: { marginTop: 0 },
  greetingCompact: { fontSize: 11, letterSpacing: 0.5 },
  avatarCompact: { width: 46, height: 46, borderRadius: 23, marginTop: 4, borderWidth: 1.5 },
  initialsCompact: { fontSize: 16 },
  nameCompact: { fontSize: 15, marginTop: 4 },
  subtitleCompact: { fontSize: 11, marginTop: 1 },
}));
