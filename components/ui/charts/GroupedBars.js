import { StyleSheet, Text, View } from 'react-native';
import { SLATE, TYPE } from '../../../constants/theme';

/**
 * Two-series horizontal bar breakdown — "This Student" against "Class Average", 0–100%.
 *
 * Replaces the web's Chart.js grouped bars (Bloom's Taxonomy and Skill Set on both the exam
 * analysis and the adaptive report). Horizontal in every case: the web flips Bloom's to vertical
 * only because a desktop has the width for it, and tag labels like "Self-awareness & Regulation"
 * have nowhere to go on a phone.
 *
 * **The value labels are not decoration.** The web sets `chartjs-plugin-datalabels` on these charts
 * specifically as accessibility relief for the amber class-average series, whose contrast against
 * the track is below 3:1 — so the number is what makes the bar readable, not the colour. They are
 * rendered inline here for the same reason.
 *
 * `rows` are `{ tag, percentage, classAveragePercentage?, correct?, total? }`. The comparison
 * series is dropped entirely when no row carries one, matching the web.
 */

const STUDENT_COLOR = '#4f46e5';
const CLASS_AVG_COLOR = '#f59e0b';

const clamp = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

function Bar({ value, color }) {
  const pct = clamp(value);
  return (
    <View style={styles.barRow}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.barValue, { color }]}>{pct}%</Text>
    </View>
  );
}

export default function GroupedBars({
  rows = [],
  emptyMessage = 'No breakdown available.',
  studentLabel = 'This student',
  averageLabel = 'Class average',
  style,
}) {
  if (!rows.length) {
    return <Text style={styles.empty}>{emptyMessage}</Text>;
  }

  const hasAverage = rows.some((row) => row.classAveragePercentage != null);

  return (
    <View style={style}>
      {hasAverage ? (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: STUDENT_COLOR }]} />
            <Text style={styles.legendText}>{studentLabel}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: CLASS_AVG_COLOR }]} />
            <Text style={styles.legendText}>{averageLabel}</Text>
          </View>
        </View>
      ) : null}

      {rows.map((row) => (
        <View key={row.tag} style={styles.group}>
          <View style={styles.tagRow}>
            <Text style={styles.tag} numberOfLines={2}>
              {row.tag}
            </Text>
            {row.total != null ? (
              <Text style={styles.count}>
                {row.total > 0 ? `${row.correct ?? 0}/${row.total}` : 'no questions'}
              </Text>
            ) : null}
          </View>
          <Bar value={row.percentage} color={STUDENT_COLOR} />
          {hasAverage ? (
            <Bar value={row.classAveragePercentage ?? 0} color={CLASS_AVG_COLOR} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', gap: 14, marginBottom: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSwatch: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: TYPE.caption, fontWeight: '600', color: SLATE[500] },

  group: { marginBottom: 12 },
  tagRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  tag: { flex: 1, fontSize: TYPE.label, fontWeight: '600', color: SLATE[700] },
  count: { fontSize: TYPE.caption, color: SLATE[500], fontWeight: '600' },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 3 },
  track: { flex: 1, height: 12, borderRadius: 6, backgroundColor: SLATE[200], overflow: 'hidden' },
  fill: { height: 12, borderRadius: 6 },
  barValue: { minWidth: 38, textAlign: 'right', fontSize: TYPE.caption, fontWeight: '800' },

  empty: { fontSize: TYPE.label, color: SLATE[500], fontStyle: 'italic', paddingVertical: 8 },
});
