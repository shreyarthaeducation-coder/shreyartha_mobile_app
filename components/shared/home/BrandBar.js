import { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TYPE } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import LanguagePicker from '../LanguagePicker';

/**
 * The top of a redesigned dashboard: brand on the left, account controls on the right.
 *
 *   [3C EDGE]                                   🌐 English ▾
 *
 * ── AND, FOR A SCHOOL-BOUND PORTAL, THE SCHOOL'S OWN IDENTITY FIRST ─────────
 *
 *   [ST XAVIER'S]                    🌐 English ▾  │  [3C EDGE]
 *
 * A student, teacher, vice principal, principal, counsellor or parent belongs to a school before
 * they belong to us, so that school's mark takes the position the eye goes to first and ours moves
 * to the end of the row.
 *
 * ── THE LEAD SLOT HAS THREE STATES, NOT TWO ─────────────────────────────────
 *   1. `schoolLogoUrl` that loads  → the school's crest
 *   2. else `schoolName`           → the school's NAME, as text
 *   3. else                        → the 3C Edge mark
 *
 * State 2 exists because state 3 is indistinguishable from the feature not working. Every school
 * row in the database started with `school_logo` NULL, so the header rendered byte-identically to
 * the old one and looked, correctly but uselessly, like nothing had shipped. Showing the name makes
 * a missing upload visible to whoever administers the school instead of silently plausible.
 *
 * `schoolLogoUrl`/`schoolName` are OPT-IN and that is load-bearing, not tidiness. This one component
 * is the header of TEN surfaces — the student, teacher, parent and partner homes plus all six
 * `app/staff/[role]` shells through StaffHomeScreen — and a partner is not school-bound at all.
 * Passing neither renders state 3, so the partner header and every pre-auth screen are untouched by
 * construction rather than by remembering to check.
 *
 * ── CHANGE PASSWORD IS NOT HERE ANY MORE ────────────────────────────────────
 * It used to sit in this row. It now lives in each portal's own Support or Profile screen, where an
 * account action belongs and where a description can explain it. Removing it from a SHARED header
 * is only safe because every portal gained its own route to it in the same change — before that,
 * `StaffSupportScreen` was the single non-header entry point in the entire app, covering the staff
 * shell and nothing else. If this ever comes back, check that claim again rather than assuming.
 *
 * ── THE LOGO SITS IN A WHITE CHIP ON PURPOSE ────────────────────────────────
 * `The3CEdge.png` is dark navy and blue artwork drawn for a white page, and it carries NO alpha
 * channel at all — its background is solid white. Dropped straight onto the dark glass it would read
 * as a white slab with a hard edge, and tinting is not an option for a logo. The white rounded chip
 * is how the approved design shows it anyway, and it is the one treatment that works whether or not
 * the PNG has transparency — which is why it survived the swap from the older "College · Counselling
 * · Career" lockup to this "A Shreyartha.ai Initiative" one. Swapping the asset again is one
 * `require`, but note this mark is WIDER (1.56:1, was 1.24:1), so it fills more of its box.
 */

const LOGO = require('../../../assets/images/The3CEdge.png');

/**
 * ── THE BELL IS OPT-IN ──────────────────────────────────────────────────────
 * `bell` is `{ count, route }` or absent. Absent renders nothing at all, so the four panels that
 * do not pass it are untouched — which matters because this component is the header of six staff
 * dashboards and one careless addition reaches all of them at once.
 *
 * The count is a number the caller has already fetched from `/api/staff/notifications/unread-count`;
 * this component never fetches. A count of 0 renders the bell with NO badge rather than a "0" —
 * a zero badge is a notification that there is nothing to notify.
 */
export default function BrandBar({
  // NOTE: `strings` and `changePasswordRoute` were removed with the Change Password button. The bar
  // now renders no translatable text of its own — the school name is a proper noun and the language
  // picker owns its own copy — so a `strings` prop would be dead weight that looks load-bearing.
  tone = 'dark',
  bell = null,
  schoolLogoUrl = null,
  schoolName = '',
}) {
  const styles = useStyles();
  const palette = usePalette();
  const light = tone === 'light';
  const router = useRouter();

  // A URL that 404s or 403s must not leave an empty chip where a crest should be. The stored value
  // is a raw unsigned S3 URL, so this is a real possibility rather than a defensive flourish.
  const [schoolLogoFailed, setSchoolLogoFailed] = useState(false);

  // RESET ON A NEW URL. Without this one failure disables the crest for the life of the mount, so a
  // counsellor covering two schools — the case `useSchoolLogo` exists for — would see the second
  // school's good logo suppressed by the first school's bad one, and a pull-to-refresh could never
  // recover it.
  useEffect(() => { setSchoolLogoFailed(false); }, [schoolLogoUrl]);

  const showSchoolLogo = !!schoolLogoUrl && !schoolLogoFailed;
  const trimmedName = String(schoolName || '').trim();
  // State 2: the name carries the school's identity when the crest cannot. See the class note.
  const showSchoolName = !showSchoolLogo && !!trimmedName;
  // Our mark moves to the end whenever the school has taken the lead — by crest OR by name.
  // Keying this off the logo alone would drop the 3C mark from the header entirely for every
  // school that has not uploaded one, which is most of them.
  const schoolLeads = showSchoolLogo || showSchoolName;

  const appLogo = (
    <View style={styles.logoChip}>
      <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel="The 3C Edge" />
    </View>
  );

  return (
    <View style={[styles.bar, light && styles.barLight]}>
      {showSchoolLogo ? (
        <View style={styles.logoChip}>
          <Image
            source={{ uri: schoolLogoUrl }}
            style={styles.schoolLogo}
            resizeMode="contain"
            onError={() => setSchoolLogoFailed(true)}
            accessibilityLabel={trimmedName ? `${trimmedName} logo` : 'School logo'}
          />
        </View>
      ) : showSchoolName ? (
        // Not in a white chip: this is text, and the chip is a treatment for dark artwork on dark
        // glass. `flexShrink` plus one line keeps a long school name from pushing the language
        // picker off a 360dp screen.
        <Text
          style={[styles.schoolNameText, light && styles.schoolNameTextLight]}
          numberOfLines={1}
          ellipsizeMode="tail"
          accessibilityLabel={trimmedName}
        >
          {trimmedName}
        </Text>
      ) : (
        appLogo
      )}

      <View style={styles.actions}>
        {bell ? (
          <>
            <Pressable
              onPress={() => router.push(bell.route)}
              hitSlop={8}
              style={({ pressed }) => [styles.bell, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={
                bell.count > 0 ? `Notifications, ${bell.count} unread` : 'Notifications'
              }
            >
              <Ionicons name="notifications-outline" size={20} color={palette.primary} />
              {bell.count > 0 ? (
                <View style={styles.badge}>
                  {/* Capped, because the badge is a 16pt circle and a three-digit count would
                      either overflow it or shrink to unreadable. */}
                  <Text style={styles.badgeText} numberOfLines={1}>
                    {bell.count > 99 ? '99+' : bell.count}
                  </Text>
                </View>
              ) : null}
            </Pressable>
            {/* Trailing, not leading. With Change Password gone the bell is first in this row, and
                a leading divider would draw a rule against nothing. */}
            <View style={[styles.divider, light && styles.dividerLight]} />
          </>
        ) : null}

        {/* `compact` drops the words "Change Language" and keeps the globe + current language, so
            the row fits a 360dp phone beside a school name that may be long. */}
        <LanguagePicker compact tone={tone} />

        {/* Our own mark, LAST, and only once the school has taken the lead position — by crest or
            by name — otherwise it would appear twice. It is rendered smaller here than in the lead
            slot: this is an attribution, not the thing being identified, and at full size on a
            360dp phone it crowds the control it sits beside. */}
        {schoolLeads ? (
          <>
            <View style={[styles.divider, light && styles.dividerLight]} />
            <View style={[styles.logoChipTrailing, !light && styles.logoChipTrailingDark]}>
              <Image
                source={LOGO}
                style={styles.logoSmall}
                resizeMode="contain"
                accessibilityLabel="The 3C Edge"
              />
            </View>
          </>
        ) : null}
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
  logo: { width: 100, height: 40 },

  // A school crest is square-ish where our lockup is wide, so it gets its own box rather than
  // being squeezed into the 100×40 one. `resizeMode="contain"` keeps whatever aspect ratio the
  // school actually uploaded — these are admin-supplied files of no guaranteed shape.
  schoolLogo: { width: 92, height: 34 },

  // The school's NAME, when it has no crest. Explicit colours per tone rather than one shared
  // value: an undefined colour is a LEGAL RN style that renders as the platform default, so a
  // missing tone here would be invisible on one bar and unreadable on the other rather than an
  // error. `flexShrink` lets a long name give way to the language picker instead of pushing it off.
  schoolNameText: {
    fontSize: TYPE.body,
    fontWeight: '800',
    color: '#ffffff',
    flexShrink: 1,
    paddingVertical: 5,
  },
  schoolNameTextLight: { color: SLATE[800] },

  // The trailing 3C mark. On a LIGHT bar it needs no chip — dark navy artwork on white reads
  // fine, and a second white slab beside the language picker would read as a button.
  logoChipTrailing: { paddingLeft: 2 },
  // On a DARK bar it does. `The3CEdge.png` is dark navy drawn for a white page, and tinting is not
  // an option for a logo — this is the same reason the lead chip exists. The student panel is the
  // only dark-tone caller today, and without this its trailing mark would be all but invisible.
  logoChipTrailingDark: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  logoSmall: { width: 70, height: 28 },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  divider: { width: 1, height: 18, backgroundColor: p.glassDarkBorder },
  dividerLight: { backgroundColor: SLATE[200] },

  // `overflow: visible` is the default, and load-bearing here: the badge is positioned outside the
  // icon's own box and would be clipped if this ever gained a hidden overflow.
  bell: { paddingVertical: 7, paddingHorizontal: 6 },
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    // A fixed red rather than the portal's primary: an unread count means the same thing on every
    // panel, and on the counsellor's purple bar a purple badge would disappear into the icon.
    backgroundColor: FEEDBACK.errorText,
  },
  badgeText: { fontSize: TYPE.micro, fontWeight: '800', color: '#ffffff' },

  pressed: { opacity: 0.7 },
}));
