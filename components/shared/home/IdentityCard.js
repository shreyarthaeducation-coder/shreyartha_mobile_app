import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TYPE } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { initialsOf } from '../../staff/helpers';

/**
 * Who this portal is about, at the top of its dashboard: a photo, then a list of labelled facts.
 *
 *   ╭────╮   👤  Student's Name       Aarav Sharma
 *   │ 📷 │   🎓  Grade                Grade 10
 *   ╰────╯   📖  Stream               Science (PCM)
 *            🎯  Career Preferences   Data Scientist, AI Engineer
 *
 * ── THE ROWS ARE A PROP, AND THAT IS THE WHOLE GENERALISATION ───────────────
 * The student passes four facts about themselves; the parent passes six — their own name and email,
 * then the child's name, grade, stream and school. Everything else about the card is identical, so
 * the rows are data rather than markup. A row is
 * `{ key, icon, label, value, tint?: 'violet'|'blue'|'green'|'amber' }`.
 *
 * ── IT REPLACES `WelcomeHeader` ON THE TWO REDESIGNED HOMES ─────────────────
 * WelcomeHeader is still the "Welcome / photo / name" block on the staff shell. This card carries
 * more facts than that block was meant to hold, beside the photo rather than under it, which is what
 * the approved designs show. What it keeps from WelcomeHeader is the part that was a product
 * decision rather than a layout one: **the photo falls back to initials**.
 *
 * That fallback is not an edge case for the parent — it is the ONLY case. `ParentUser` has no photo
 * column and no upload endpoint anywhere in the backend, so a parent's avatar is always initials.
 * The child's photo is real and belongs to the report card further down that screen, not here.
 *
 * ── EVERY VALUE IS REAL OR ABSENT ───────────────────────────────────────────
 * A row with no value shows "Not set" and stays tappable where the portal gives it somewhere to go.
 * It never shows a placeholder that looks like data.
 */

export default function IdentityCard({
  name,
  photoUrl,
  rows = [],
  title,
  subtitle,
  badge,
  planName,
  onPressPhoto,
  onPressRow,
  onPressBadge,
  strings,
  tone = 'dark',
}) {
  const styles = useStyles();
  const palette = usePalette();
  const light = tone === 'light';

  const t = strings || {};
  const ROWS = rows;

  const avatar = (
    <View style={[styles.avatar, light && styles.avatarLight]}>
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={styles.avatarImg} resizeMode="cover" />
      ) : (
        <Text style={[styles.initials, light && styles.initialsLight]}>{initialsOf(name)}</Text>
      )}
    </View>
  );

  return (
    <View style={[styles.card, light && styles.cardLight]}>
      {/* The plan badge is the STUDENT's — a parent has no subscription of their own. Absent
          `badge` renders nothing at all rather than an Upgrade button aimed at the wrong person.

          ── THE BADGE AND UPGRADE ARE NO LONGER EITHER/OR ─────────────────────
          They used to be: a label meant a pill, no label meant an Upgrade button, and a subscriber
          therefore had no route to a higher plan anywhere on this screen. The tiers are not a
          ladder with one rung — custom plans sit above Premium — so "already paying" is not a
          reason to hide the way up. Both now render, pill first. */}
      {badge ? (
        <View style={styles.badgeRow}>
          {badge.label ? (
            <View style={[styles.badge, light && styles.badgeLight, badge.premium && styles.badgePremium]}>
              <Text
                style={[
                  styles.badgeText,
                  light && styles.badgeTextLight,
                  badge.premium && styles.badgeTextPremium,
                ]}
                numberOfLines={1}
              >
                {badge.label}
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={onPressBadge}
            hitSlop={8}
            style={({ pressed }) => [styles.upgrade, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t.upgrade || 'Upgrade'}
          >
            <Text style={styles.upgradeText}>{t.upgrade || 'Upgrade'}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.body}>
        {/* Left column: the heading pair, then the avatar. The student passes no title, so this
            collapses to the avatar alone and their card is unchanged. */}
        <View style={styles.lead}>
          {title ? <Text style={[styles.title, light && styles.titleLight]}>{title}</Text> : null}
          {subtitle ? (
            <Text style={[styles.subtitle, light && styles.subtitleLight]}>{subtitle}</Text>
          ) : null}

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

          {/* The plan, under the photo. The WORDING is the caller's — this component knows nothing
              about tiers, and a portal with no subscription concept simply passes nothing. Two
              lines allowed, because a custom plan name is free text and the column is only 116pt
              wide; anything longer than that is truncated rather than allowed to reflow the card. */}
          {planName ? (
            <Text style={[styles.plan, light && styles.planLight]} numberOfLines={2}>
              {planName}
            </Text>
          ) : null}
        </View>

        <View style={styles.rows}>
          {ROWS.map((row, i) => {
            const value = row.value;
            const body = (
              <>
                <View style={[styles.iconTile, styles[row.tint || 'blue']]}>
                  <Ionicons name={row.icon} size={15} color={palette.primary} />
                </View>
                <Text style={[styles.rowLabel, light && styles.rowLabelLight]} numberOfLines={1}>
                  {row.label}
                </Text>
                <Text
                  style={[
                    styles.rowValue,
                    light && styles.rowValueLight,
                    !value && styles.rowValueEmpty,
                  ]}
                  numberOfLines={2}
                >
                  {value || t.notSet || 'Not set'}
                </Text>
              </>
            );

            // A row is only a button where the portal gave it somewhere to go. The parent's rows
            // are read-only — there is no parent profile screen to open — and rendering them as
            // buttons that do nothing is worse than rendering them as text.
            return onPressRow ? (
              <Pressable
                key={row.key}
                onPress={() => onPressRow(row.key)}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && (light ? styles.rowDividedLight : styles.rowDivided),
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${row.label}: ${value || t.notSet || 'Not set'}`}
              >
                {body}
              </Pressable>
            ) : (
              <View
                key={row.key}
                style={[styles.row, i > 0 && (light ? styles.rowDividedLight : styles.rowDivided)]}
                accessibilityLabel={`${row.label}: ${value || t.notSet || 'Not set'}`}
              >
                {body}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((p) => ({
  card: {
    backgroundColor: p.glassDark,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: p.glassDarkBorder,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 5,
  },
  // tone="light" — the parent panel, which has no photographic background and no dark tokens.
  // Surface and border only; the geometry is shared so both dashboards keep the same rhythm.
  cardLight: {
    backgroundColor: '#ffffff',
    borderColor: SLATE[200],
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  body: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },

  // The heading pair sits above the avatar, left of the rows. Fixed-width so a long parent name in
  // the rows column cannot squeeze the avatar out of round.
  lead: { width: 116, alignItems: 'flex-start' },
  title: { fontSize: TYPE.title, fontWeight: '800', color: '#ffffff', marginBottom: 2 },
  titleLight: { color: SLATE[800] },
  subtitle: { fontSize: TYPE.caption, color: p.onDark, lineHeight: 15, marginBottom: SPACING.sm },
  subtitleLight: { color: SLATE[500] },

  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: p.tint,
    borderWidth: 2,
    borderColor: p.glassDarkBorder,
  },
  // White initials on a 12% tint work over dark navy; on a white card they vanish, so the light
  // tone inks them with the portal's own primary instead.
  avatarLight: { borderColor: p.tint },
  avatarImg: { width: '100%', height: '100%' },
  initials: { fontSize: TYPE.headline, fontWeight: '800', color: '#ffffff' },
  initialsLight: { color: p.primaryDark },

  // Sits directly under the avatar, inside the 116pt lead column. `width: '100%'` so a two-line
  // name wraps within the column instead of widening it.
  plan: {
    width: '100%',
    marginTop: 6,
    fontSize: TYPE.caption,
    fontWeight: '700',
    color: p.onDark,
  },
  planLight: { color: SLATE[500] },

  rows: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 7 },
  // A hairline between rows rather than around them — the design reads as one list, not four cards.
  rowDivided: { borderTopWidth: 1, borderTopColor: p.glassDarkBorder },
  iconTile: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Four washes of the panel's own blue at different strengths, standing in for the design's four
  // pastel tiles. Deliberately not four new hues: a new colour per row is four more values to keep
  // in step with the palette, for decoration that carries no meaning.
  violet: { backgroundColor: 'rgba(124, 92, 255, 0.22)' },
  blue: { backgroundColor: 'rgba(79, 195, 247, 0.22)' },
  green: { backgroundColor: 'rgba(34, 197, 94, 0.20)' },
  amber: { backgroundColor: 'rgba(250, 204, 21, 0.20)' },

  rowDividedLight: { borderTopWidth: 1, borderTopColor: SLATE[200] },

  rowLabel: { fontSize: TYPE.caption, color: p.onDark, width: 78 },
  rowLabelLight: { color: SLATE[500] },
  rowValue: { flex: 1, fontSize: TYPE.label, fontWeight: '700', color: '#ffffff', textAlign: 'right' },
  rowValueLight: { color: SLATE[800] },
  // Last in the cascade at both tones, so "Not set" always reads as absent rather than as a value.
  rowValueEmpty: { fontWeight: '500', color: SLATE[400] },

  // The pill and the Upgrade button share one right-aligned row. The alignment and the bottom
  // margin live here rather than on each child, which is where they used to be back when only one
  // of the two could ever render.
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginBottom: SPACING.sm,
  },
  badge: {
    // A custom plan name is free text and can be long; it yields to the Upgrade button, which has
    // a fixed width and must not be pushed off the card.
    flexShrink: 1,
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: p.glassDarkBorder,
  },
  // Only the student passes a `badge` today — it is a subscription plan, and no other portal has
  // one of its own. The light variant exists so that stays a product decision rather than a
  // constraint: without it, the first light-tone portal to pass one would get a black border
  // (undefined `glassDarkBorder`) and white-on-white text.
  badgeLight: { backgroundColor: p.tint, borderColor: SLATE[200] },
  badgePremium: { backgroundColor: '#d1fae5', borderColor: '#34d399' },
  badgeText: { fontSize: TYPE.caption, fontWeight: '700', color: '#ffffff' },
  badgeTextLight: { color: p.primaryDark },
  badgeTextPremium: { color: FEEDBACK.successOnBg },
  upgrade: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#facc15',
  },
  upgradeText: { fontSize: TYPE.caption, fontWeight: '700', color: '#1f2937' },

  pressed: { opacity: 0.75 },
}));
