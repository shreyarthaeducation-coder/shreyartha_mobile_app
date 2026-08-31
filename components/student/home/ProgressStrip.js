import { Text, View } from 'react-native';
import { SPACING, TYPE } from '../../../constants/theme';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * The progress bars inside the My Analytics hero card.
 *
 * ── WHERE THESE CAME FROM ───────────────────────────────────────────────────
 * They were the whole content of the once-per-session welcome interstitial. That screen was retired
 * by the redesign — the new dashboard already carries the photo, class, stream and career the
 * interstitial existed to show, so keeping a full-screen gate in front of it re-introduced exactly
 * the tap the original port removed it for. The bars were the valuable half, so they moved here and
 * are now visible every time rather than once.
 *
 * ── EVERY BAR IS REAL, AND THAT IS ENFORCED UPSTREAM ────────────────────────
 * This component renders whatever `sectionRows()` hands it and invents nothing. That function's
 * rules are the reason it can be trusted, and they are worth restating because a future edit here
 * could quietly break them:
 *
 *   · A section whose call FAILED is omitted, never drawn at 0%. "You have completed none of this"
 *     and "we could not read your progress" are different statements.
 *   · A section with no work yet DOES appear at 0% — that is true, and it is an invitation.
 *   · Coding Pro comes from live data only. The analytics spine carries a hardcoded 75% that is
 *     identical for every student on the platform, and it must never reach a bar.
 *   · Language Lab has no percentage anywhere in the API and therefore has no bar at all.
 *
 * The strip shows at most three, because a hero card is a summary; the full list is one tap away on
 * the screen this card opens.
 */

const MAX_BARS = 3;

export default function ProgressStrip({ rows = [], loading = false, emptyLabel }) {
  const styles = useStyles();

  if (loading) {
    return <Text style={styles.note}>Loading your progress…</Text>;
  }
  if (!rows.length) {
    return <Text style={styles.note}>{emptyLabel || 'Start a topic to see your progress here.'}</Text>;
  }

  return (
    <View style={styles.strip}>
      {rows.slice(0, MAX_BARS).map((row) => {
        // Clamped, not trusted: a server percentage above 100 would otherwise overflow the track.
        const pct = Math.max(0, Math.min(100, Math.round(Number(row.percent) || 0)));
        return (
          <View key={row.key} style={styles.item}>
            <View style={styles.labelRow}>
              <Text style={styles.label} numberOfLines={1}>
                {row.label}
              </Text>
              <Text style={styles.value}>{pct}%</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct}%` }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  // The strip sits on the blue gradient, so every colour here is white at an opacity — the palette's
  // blues would vanish into the card they are printed on.
  strip: { flexDirection: 'row', gap: SPACING.sm },
  item: { flex: 1 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  label: { flexShrink: 1, fontSize: TYPE.micro, fontWeight: '600', color: '#ffffff', opacity: 0.92 },
  value: { fontSize: TYPE.micro, fontWeight: '800', color: '#ffffff' },
  track: {
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.32)',
    marginTop: 4,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 999, backgroundColor: '#ffffff' },
  note: { fontSize: TYPE.caption, color: '#ffffff', opacity: 0.9 },
}));
