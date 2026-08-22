import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { SLATE } from '../../../constants/theme';

/**
 * Semi-circular gauge with a needle — the native rebuild of `School/shared/SkillGauge.js`.
 *
 * The web version is a Chart.js half-doughnut plus a plugin that reads the rendered arc's
 * `endAngle` back out of Chart.js internals and draws the needle on the raw 2D context. None of
 * that is portable, and it doesn't need to be: a semicircle is one `Path` arc, and the needle is a
 * `Line` at a known angle. Drawing it directly is both shorter and more predictable.
 *
 * Severity bands are copied exactly from the web so a gauge reads the same on both platforms.
 */

export const GAUGE_BANDS = [
  { min: 80, color: '#0ca30c', label: 'Good' },
  { min: 60, color: '#fab219', label: 'Fair' },
  { min: 40, color: '#ec835a', label: 'Needs Improvement' },
  { min: 0, color: '#d03b3b', label: 'Weak' },
];

export const gaugeSeverity = (pct) =>
  GAUGE_BANDS.find((band) => pct >= band.min) || GAUGE_BANDS[GAUGE_BANDS.length - 1];

/** Point on the gauge arc. 0% sits at 180° (left), 100% at 0° (right). */
const pointAt = (cx, cy, radius, pct) => {
  const angle = Math.PI * (1 - pct / 100);
  return { x: cx + radius * Math.cos(angle), y: cy - radius * Math.sin(angle) };
};

const arcPath = (cx, cy, radius, fromPct, toPct) => {
  const start = pointAt(cx, cy, radius, fromPct);
  const end = pointAt(cx, cy, radius, toPct);
  // Never more than a semicircle, so large-arc is always 0; sweep 1 draws clockwise.
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`;
};

export default function GaugeChart({ tag, percentage = 0, width = 150, style }) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(percentage) || 0)));
  const severity = gaugeSeverity(pct);

  const thickness = width * 0.13;
  const radius = (width - thickness) / 2;
  const cx = width / 2;
  const cy = radius + thickness / 2;
  const height = cy + thickness / 2 + 2;

  const needle = pointAt(cx, cy, radius * 0.82, pct);
  const needleBase = pointAt(cx, cy, radius * 0.22, pct);

  return (
    <View style={[styles.wrap, { width }, style]}>
      <Svg width={width} height={height}>
        <Path
          d={arcPath(cx, cy, radius, 0, 100)}
          stroke={SLATE[200]}
          strokeWidth={thickness}
          strokeLinecap="round"
          fill="none"
        />
        {pct > 0 ? (
          <Path
            d={arcPath(cx, cy, radius, 0, pct)}
            stroke={severity.color}
            strokeWidth={thickness}
            strokeLinecap="round"
            fill="none"
          />
        ) : null}
        <Line
          x1={needleBase.x}
          y1={needleBase.y}
          x2={needle.x}
          y2={needle.y}
          stroke={SLATE[800]}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <Circle cx={cx} cy={cy} r={5} fill={SLATE[800]} />
      </Svg>

      <Text style={styles.tag} numberOfLines={2}>
        {tag}
      </Text>
      <Text style={[styles.pct, { color: severity.color }]}>{pct}%</Text>
      <Text style={styles.label}>{severity.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  tag: { fontSize: 12, fontWeight: '700', color: SLATE[700], textAlign: 'center', marginTop: 4 },
  pct: { fontSize: 17, fontWeight: '800', marginTop: 2 },
  label: { fontSize: 11, color: SLATE[500], fontWeight: '600' },
});
