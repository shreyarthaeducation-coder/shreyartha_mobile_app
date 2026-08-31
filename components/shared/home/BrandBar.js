import { Image, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import LanguagePicker from '../LanguagePicker';

/**
 * The top of a redesigned dashboard: brand on the left, account controls on the right.
 *
 *   [3C EDGE]              🔒 Change Password  │  🌐 English ▾
 *
 * These two controls used to be chips in a horizontally-scrolling row under the welcome block,
 * alongside My Analytics and Speak to Counselor. Those two now have better homes — a hero card and
 * a footer tab — so what is left is the pair that belongs in a header on every platform.
 *
 * ── THE LOGO SITS IN A WHITE CHIP ON PURPOSE ────────────────────────────────
 * `AppLogo.png` is dark navy artwork drawn for a white page. Dropped straight onto the dark glass it
 * would be close to invisible, and tinting it is not an option for a logo. The white rounded chip is
 * how the approved design shows it anyway, and it is the one treatment that works whether or not the
 * PNG carries an alpha channel — which matters, because the artwork in the design ("Inspire ·
 * Innovate · Impact") is not in this repo and the file here is the older "College · Counselling ·
 * Career" lockup. Swapping in the new asset is one `require`.
 */

const LOGO = require('../../../assets/images/AppLogo.png');

export default function BrandBar({ strings, changePasswordRoute, tone = 'dark' }) {
  const styles = useStyles();
  const palette = usePalette();
  const light = tone === 'light';
  const router = useRouter();

  return (
    <View style={[styles.bar, light && styles.barLight]}>
      <View style={styles.logoChip}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel="The 3C Edge" />
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => router.push(changePasswordRoute)}
          // Inline chip in a header row: hitSlop rather than a 44pt minHeight, which would set the
          // height of the whole bar.
          hitSlop={8}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Change password"
        >
          <Ionicons name="lock-closed-outline" size={16} color={palette.primary} />
          <Text style={[styles.actionText, light && styles.actionTextLight]} numberOfLines={1}>
            {strings?.changePassword || 'Change Password'}
          </Text>
        </Pressable>

        <View style={[styles.divider, light && styles.dividerLight]} />

        {/* `compact` drops the words "Change Language" and keeps the globe + current language, so
            the row fits a 360dp phone next to a two-word password label. */}
        <LanguagePicker compact tone={tone} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((p) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: p.glassDark,
    borderBottomWidth: 1,
    borderBottomColor: p.glassDarkBorder,
  },
  // tone="light" — the parent panel. Its palette has no dark tokens at all, so the bar paints its
  // own white surface rather than resolving to `undefined` and rendering transparent.
  barLight: { backgroundColor: '#ffffff', borderBottomColor: SLATE[200] },
  logoChip: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  logo: { width: 76, height: 30 },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 999,
    flexShrink: 1,
  },
  actionText: { fontSize: TYPE.caption, fontWeight: '600', color: '#ffffff', flexShrink: 1 },
  actionTextLight: { color: SLATE[700] },
  divider: { width: 1, height: 18, backgroundColor: p.glassDarkBorder },
  dividerLight: { backgroundColor: SLATE[200] },

  pressed: { opacity: 0.7 },
}));
