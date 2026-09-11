import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { initialsOf } from '../../staff/helpers';
import { tint } from './tints';

/**
 * The photo-led dashboard header from the approved sales and counsellor designs.
 *
 *   ╭──────╮   Hi, Priya Sharma 👋
 *   │  📷  │   Sales Executive
 *   ╰──────╯
 *   ┌────────────────┬─────────────────┐
 *   │ 🪪 Employee ID │ 📅 Date of Joining│
 *   │ SHREYA01-EMP-7 │ 12 Jan 2024      │
 *   └────────────────┴─────────────────┘
 *
 * ── WHY THIS IS NOT `IdentityCard` WITH DIFFERENT ROWS ──────────────────────
 * `IdentityCard` is a photo beside a LIST of labelled facts, each a full-width row with the value
 * right-aligned. This is a photo above a greeting, with two or three facts as chips underneath.
 * Same information in a different shape, and trying to serve both from one component would mean a
 * layout switch that changes every element's position — two components is the smaller thing.
 * `IdentityCard` is untouched and still serves the other four staff panels.
 *
 * ── THE PHOTO FALLS BACK TO INITIALS, AND THAT IS THE COMMON CASE ───────────
 * Kept from `WelcomeHeader` and `IdentityCard` because it was a product decision rather than a
 * layout one. A staff photo lives on the HR profile (`/api/staff/hr/profile` → `profilePictureUrl`)
 * and most staff have never uploaded one.
 *
 * ── THE CAMERA BADGE IS OPTIONAL AND MEANS "UPLOAD" ─────────────────────────
 * Rendered only when `onPressPhoto` is given, because a badge that looks like a control and does
 * nothing is worse than no badge. `uploading` swaps it for a spinner so a slow upload on a phone
 * network does not read as a dead tap.
 *
 * ── A CHIP WITH NO VALUE IS OMITTED, NOT BLANKED ────────────────────────────
 * `employeeCode` and `dateOfJoining` are both nullable on the HR profile — a staff member who has
 * never been through payroll setup has neither. A chip reading "Not set" twice is noise on a
 * header; the row simply gets shorter, and renders nothing at all when every chip is empty.
 *
 * @param {Array<{key, icon, label, value, tint?}>} chips
 */
export default function ProfileHeaderCard({
  name,
  role,
  photoUrl,
  chips = [],
  greeting = 'Hi',
  onPressPhoto,
  uploading = false,
}) {
  const styles = useStyles();
  const palette = usePalette();

  const shown = chips.filter((chip) => chip && chip.value);

  const avatar = (
    <View style={styles.avatar}>
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={styles.avatarImg} resizeMode="cover" />
      ) : (
        <Text style={styles.initials}>{initialsOf(name)}</Text>
      )}
    </View>
  );

  return (
    <View style={styles.card}>
      <View style={styles.identity}>
        <View>
          {avatar}

          {onPressPhoto ? (
            <Pressable
              onPress={onPressPhoto}
              disabled={uploading}
              // A 28pt badge with hitSlop rather than a 44pt control: it sits on the avatar's
              // corner, and sizing it to the tap target would cover a third of the photo.
              hitSlop={10}
              style={({ pressed }) => [
                styles.camera,
                { backgroundColor: palette.primary },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Change your profile photo"
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons name="camera" size={17} color="#ffffff" />
              )}
            </Pressable>
          ) : null}
        </View>

        <View style={styles.text}>
          <Text style={styles.name} numberOfLines={2}>
            {greeting}, {name} 👋
          </Text>
          {role ? (
            <Text style={styles.role} numberOfLines={1}>
              {role}
            </Text>
          ) : null}
        </View>
      </View>

      {shown.length ? (
        <View style={styles.chips}>
          {shown.map((chip, i) => (
            <View
              key={chip.key}
              // The divider is on the chip rather than between them, so a single chip has none.
              style={[styles.chip, i > 0 && styles.chipDivided]}
            >
              <View style={[styles.chipIcon, { backgroundColor: tint(chip.tint).bg }]}>
                <Ionicons name={chip.icon} size={17} color={tint(chip.tint).fg} />
              </View>
              <View style={styles.chipText}>
                <Text style={styles.chipLabel} numberOfLines={1}>
                  {chip.label}
                </Text>
                {/* Shrink rather than truncate: the real employee code is
                    `{SCHOOLCODE}-EMP-{seq}` — 17+ characters — and an ellipsised ID is useless
                    to somebody reading it out to payroll. */}
                <Text
                  style={styles.chipValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {chip.value}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((p) => ({
  // Light-only. Both panels that use this render on SLATE[50] with no photographic background, so
  // unlike IdentityCard there is no dark tone to carry — and the dark tokens it would need
  // (`glassDark`, `glassDarkBorder`) exist on the student palette alone.
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: SLATE[200],
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },

  identity: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },

  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: p.tint,
    borderWidth: 2,
    borderColor: p.tint,
  },
  avatarImg: { width: '100%', height: '100%' },
  initials: { fontSize: TYPE.headline, fontWeight: '800', color: p.primaryDark },

  camera: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },

  text: { flex: 1 },
  name: { fontSize: TYPE.headline, fontWeight: '800', color: SLATE[900] },
  role: { fontSize: TYPE.body, color: SLATE[500], marginTop: 3 },

  chips: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: SLATE[200],
  },
  // `flex: 1` with `minWidth: 0` so two chips split the width evenly and a long value shrinks
  // inside its own half instead of pushing its neighbour off the card.
  chip: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  chipDivided: { borderLeftWidth: 1, borderLeftColor: SLATE[200], paddingLeft: SPACING.sm },
  chipIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { flex: 1, minWidth: 0 },
  chipLabel: { fontSize: TYPE.caption, color: SLATE[500] },
  chipValue: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[800], marginTop: 1 },

  pressed: { opacity: 0.75 },
}));
