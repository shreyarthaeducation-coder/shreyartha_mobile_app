import { Text, View } from 'react-native';
import { SPACING, TYPE } from '../../../constants/theme';
import { makeStyles } from '../../../utils/makeStyles';
import ComingSoon from '../ComingSoon';

/**
 * A row of headline figures inside a `HeroCard`.
 *
 * `HeroCard` already takes `children` for exactly this — it is how the student's My Analytics card
 * carries its progress bars — so this is a sibling of `ProgressStrip`, not a new mechanism.
 *
 * ── A FIGURE IS REAL OR IT IS ABSENT ────────────────────────────────────────
 * A stat carrying `soon: true` renders the shared `ComingSoon` badge instead of a number. That is
 * the whole point: the partner design asks for Active Schools and Pending Schools, and **no status
 * exists on the partner↔school link or on the School entity at all** — `linkedSchoolCodes` is a
 * bare list of code strings. There is nothing to derive those from, so they must not be drawn as
 * zeros. Same contract as the parent's `ChildReportCard`, so the two read alike.
 *
 * `note` is the qualifier under the value, and it is load-bearing where a figure is narrower than
 * its label suggests — "This month", "Since joining". A number whose scope is unstated is the
 * easiest way to mislead on a dashboard.
 *
 * @param {Array<{key, label, value?, note?, soon?}>} stats
 */

export default function StatStrip({ stats = [] }) {
  const styles = useStyles();

  if (!stats.length) return null;

  return (
    <View style={styles.strip}>
      {stats.map((stat) => (
        <View key={stat.key} style={[styles.item, stat.soon && styles.itemSoon]}>
          {stat.soon ? (
            <>
              <Text style={styles.label} numberOfLines={1}>
                {stat.label}
              </Text>
              <ComingSoon label="soon" style={styles.badge} />
            </>
          ) : (
            <>
              <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {stat.value}
              </Text>
              <Text style={styles.label} numberOfLines={1}>
                {stat.label}
              </Text>
              {stat.note ? (
                <Text style={styles.note} numberOfLines={1}>
                  {stat.note}
                </Text>
              ) : null}
            </>
          )}
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  // Two-up rather than the design's four-across. Four figures on a 360dp phone leaves ~78dp each,
  // which cannot hold "₹ 24,75,000" — and a rupee total that has been ellipsised is worse than one
  // that wrapped. `flexBasis: '46%'` with `flexGrow` lets a pair share a row and a lone stat fill it.
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  item: {
    flexGrow: 1,
    flexBasis: '44%',
    paddingVertical: SPACING.sm,
    paddingHorizontal: 10,
    borderRadius: 12,
    // On a gradient, so every colour here is white at an opacity — a palette blue would vanish into
    // the card it is printed on.
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  itemSoon: { backgroundColor: 'rgba(255,255,255,0.10)' },

  // `adjustsFontSizeToFit` above lets a long rupee figure shrink rather than truncate; the floor
  // keeps it from becoming unreadable.
  value: { fontSize: TYPE.headline, fontWeight: '800', color: '#ffffff' },
  label: { fontSize: TYPE.micro, fontWeight: '700', color: '#ffffff' },
  note: { fontSize: TYPE.micro, color: '#ffffff', marginTop: 1 },
  badge: { marginTop: 4 },
}));
