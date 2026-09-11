import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TYPE } from '../../../constants/theme';
import { makeStyles } from '../../../utils/makeStyles';
import { tint, tintAt } from './tints';

/**
 * A white card of headline figures — "Sales Performance (This Month)", "Today's Summary".
 *
 * Each stat is a pastel icon disc, a value, a label, and OPTIONALLY a change line.
 *
 * ── WHY NOT `StatStrip` ─────────────────────────────────────────────────────
 * `StatStrip` paints white-on-white-at-20%-opacity for the inside of a `HeroCard` gradient. Every
 * colour in it is an alpha of white, which is invisible on the white card these designs ask for.
 * It also has no concept of a change line. It is untouched and still serves the teacher, parent and
 * partner homes.
 *
 * ══ A DELTA IS REAL OR IT IS ABSENT ═════════════════════════════════════════
 * This is the contract that made this component necessary and it is not cosmetic. The sales design
 * shows "vs Last Month" under all four figures, and the backend can only support two of them:
 *
 *   · Total Sales    — `monthlyRevenue` carries 12 buckets, so month-over-month is real.
 *   · Schools Visited — real, at the cost of a second `/reports/visits` call for the prior month.
 *   · Proposals Sent  — `dealsSubmitted` is a CURRENT count. There is no history of it anywhere.
 *   · Conversion      — `pipeline` is a snapshot of open stages. Same.
 *
 * So a stat whose `delta` is `null` or `undefined` renders NO change line at all — not "0%", not
 * "—", not a grey dash. A fabricated 0% would read as "flat this month", which is a claim, and the
 * one thing a dashboard must never do is invent one. Same rule `StatStrip` already states for its
 * values, applied to the change line.
 *
 * `deltaNote` is the qualifier ("vs Last Month") and belongs to the CARD rather than to each stat,
 * because every delta on one card is measured the same way. A figure whose basis is unstated is
 * the easiest way to mislead.
 *
 * @param {Array<{key, label, value, icon, tint?, delta?: number|null, deltaUp?: boolean}>} stats
 */
export default function MetricRow({
  title,
  subtitle,
  actionLabel,
  onPressAction,
  stats = [],
  deltaNote,
}) {
  const styles = useStyles();

  if (!stats.length) return null;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
            {subtitle ? <Text style={styles.subtitle}>  {subtitle}</Text> : null}
          </Text>
        </View>

        {actionLabel && onPressAction ? (
          <Pressable
            onPress={onPressAction}
            hitSlop={8}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
          >
            <Text style={styles.actionText}>{actionLabel}</Text>
            <Ionicons name="chevron-forward" size={16} color={SLATE[500]} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.grid}>
        {stats.map((stat, i) => {
          const hue = stat.tint ? tint(stat.tint) : tintAt(i);
          // Explicitly `== null`, NOT falsy: a delta of exactly 0 is a real measurement — "no
          // change since last month" — and truthiness would silently drop it. Same falsy-strip
          // class of bug that treated a Customer Reading of 0 ("Sales lost") as absent.
          const hasDelta = stat.delta != null;
          const up = stat.deltaUp != null ? stat.deltaUp : Number(stat.delta) >= 0;

          return (
            <View key={stat.key} style={styles.item}>
              <View style={[styles.iconTile, { backgroundColor: hue.bg }]}>
                <Ionicons name={stat.icon} size={19} color={hue.fg} />
              </View>

              <Text style={styles.label} numberOfLines={2}>
                {stat.label}
              </Text>

              {/* Shrink rather than truncate — a rupee total that has been ellipsised is worse
                  than one that has been made smaller. */}
              <Text
                style={styles.value}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {stat.value}
              </Text>

              {hasDelta ? (
                <View style={styles.delta}>
                  {deltaNote ? <Text style={styles.deltaNote}>{deltaNote}</Text> : null}
                  <View style={styles.deltaRow}>
                    <Ionicons
                      name={up ? 'arrow-up' : 'arrow-down'}
                      size={12}
                      color={up ? FEEDBACK.successText : FEEDBACK.errorText}
                    />
                    <Text
                      style={[
                        styles.deltaText,
                        { color: up ? FEEDBACK.successText : FEEDBACK.errorText },
                      ]}
                    >
                      {Math.abs(Number(stat.delta))}%
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: SLATE[200],
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2,
  },

  head: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  headText: { flex: 1, minWidth: 0 },
  title: { fontSize: TYPE.title, fontWeight: '800', color: SLATE[900] },
  // Inline with the title, as the design shows ("Sales Performance (This Month)") — a separate
  // line would push the figures below the fold on a small phone.
  subtitle: { fontSize: TYPE.label, fontWeight: '600', color: SLATE[500] },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionText: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[500] },

  // TWO-UP, not the design's four-across. Four figures on a 360dp phone leaves about 78dp each,
  // which cannot hold "₹ 24,75,000" above a two-line label and a change line. Same call, and same
  // reason, as StatStrip's own comment.
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: SPACING.md },
  item: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  iconTile: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  label: { fontSize: TYPE.caption, color: SLATE[500], textAlign: 'center' },
  value: { fontSize: TYPE.headline, fontWeight: '800', color: SLATE[900], marginTop: 2 },

  delta: { alignItems: 'center', marginTop: 4 },
  deltaNote: { fontSize: TYPE.micro, color: SLATE[500] },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  deltaText: { fontSize: TYPE.caption, fontWeight: '700' },

  pressed: { opacity: 0.7 },
}));
