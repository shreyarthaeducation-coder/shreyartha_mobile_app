import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { SLATE } from '../../../constants/theme';

/**
 * Performance radar — the adaptive report's six-metric profile.
 *
 * This is the reason the whole chart kit is hand-drawn rather than library-backed: no React Native
 * chart library ships a radar, so it had to be built either way, and one approach beats two.
 *
 * It is deliberately the *secondary* reading of the data. The web pairs the radar with a grid of
 * labelled values and mini bars precisely because a radar can't be read to a number; on a phone
 * that grid leads and this shows the shape. Which is also why there are no touch tooltips here —
 * there is nothing in the radar that the tiles beside it don't state outright.
 *
 * `metrics` are `{ key, label, value }` with value 0–100.
 */

const STUDENT_COLOR = '#4f46e5';
const RINGS = [25, 50, 75, 100];

/** Vertex for metric `i` of `n` at `value`%, first axis pointing straight up. */
const vertex = (cx, cy, radius, index, count, value) => {
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  const r = (radius * Math.max(0, Math.min(100, Number(value) || 0))) / 100;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
};

const toPoints = (pts) => pts.map((p) => `${p.x},${p.y}`).join(' ');

export default function RadarChart({ metrics = [], size = 260, style }) {
  if (metrics.length < 3) return null;

  const count = metrics.length;
  // Leaves room for the axis labels, which sit outside the outermost ring.
  const radius = size / 2 - 34;
  const cx = size / 2;
  const cy = size / 2;

  const shape = metrics.map((m, i) => vertex(cx, cy, radius, i, count, m.value));

  return (
    <View style={[styles.wrap, style]}>
      <Svg width={size} height={size}>
        {RINGS.map((ring) => (
          <Polygon
            key={ring}
            points={toPoints(metrics.map((_, i) => vertex(cx, cy, radius, i, count, ring)))}
            stroke={SLATE[200]}
            strokeWidth={1}
            fill="none"
          />
        ))}

        {metrics.map((m, i) => {
          const end = vertex(cx, cy, radius, i, count, 100);
          return (
            <Line
              key={m.key}
              x1={cx}
              y1={cy}
              x2={end.x}
              y2={end.y}
              stroke={SLATE[200]}
              strokeWidth={1}
            />
          );
        })}

        <Polygon
          points={toPoints(shape)}
          fill="rgba(79, 70, 229, 0.16)"
          stroke={STUDENT_COLOR}
          strokeWidth={2}
        />

        {shape.map((p, i) => (
          <Circle
            key={metrics[i].key}
            cx={p.x}
            cy={p.y}
            r={4}
            fill={STUDENT_COLOR}
            stroke="#ffffff"
            strokeWidth={2}
          />
        ))}

        {metrics.map((m, i) => {
          const label = vertex(cx, cy, radius + 18, i, count, 100);
          // Nudge the anchor so left-hand labels don't run into the chart.
          const anchor = label.x > cx + 4 ? 'start' : label.x < cx - 4 ? 'end' : 'middle';
          return (
            <SvgText
              key={m.key}
              x={label.x}
              y={label.y + 4}
              fontSize={10.5}
              fontWeight="600"
              fill={SLATE[600]}
              textAnchor={anchor}
            >
              {m.label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
});
