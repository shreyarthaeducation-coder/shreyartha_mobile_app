import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { SLATE } from '../../../constants/theme';

/**
 * A ring split into several slices — the multi-segment pie the kit has been missing.
 *
 * `DonutChart` next door is deliberately a single-value progress ring; a note in
 * `components/partner/PartnerOverviewScreen.js` has been asking for this component since the
 * partner dashboard wanted a real pie. The sales funnel (schools per Customer Reading) is the
 * first caller.
 *
 * ── HOW THE SEGMENTS ARE DRAWN ──────────────────────────────────────────────
 * The same `strokeDasharray`-on-a-`Circle` trick as DonutChart, plus `strokeDashoffset` to push
 * each slice past the ones before it. No arc `Path` maths, so none of the malformed `d` strings
 * hand-rolled arcs are prone to.
 *
 *   dasharray  = "<this slice's arc> <the rest of the circumference>"
 *   dashoffset = -(everything before it)     // negative = advance clockwise
 *
 * `strokeLinecap` is **butt**, not DonutChart's `round`: rounded caps overhang their arc at both
 * ends, so adjacent slices visibly overlap and a 1% slice draws as a blob wider than its share.
 *
 * Rotated -90° so the first slice starts at twelve o'clock, matching DonutChart.
 *
 * @param {Array<{key?, label?, value: number, color: string}>} segments
 *        `value` is a COUNT, not a percentage — the component works out the shares, so a caller
 *        never has to normalise and can never make them sum to something other than 100.
 * @param centreValue big text in the middle (defaults to the total)
 * @param centreCaption small text under it
 */
export default function SegmentedDonut({
  segments = [],
  size = 148,
  thickness = 16,
  trackColor = SLATE[200],
  centreValue,
  centreCaption,
  style,
}) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const centre = size / 2;

  const usable = segments.filter((s) => Number(s.value) > 0);
  const total = usable.reduce((sum, s) => sum + Number(s.value), 0);

  // Cumulative share BEFORE each slice, which is what the offset is measured from.
  let running = 0;
  const arcs = usable.map((s) => {
    const share = (Number(s.value) / total) * 100;
    const arc = { ...s, share, offset: running };
    running += share;
    return arc;
  });

  return (
    <View style={[styles.wrap, style]}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${centre}, ${centre}`}>
          <Circle
            cx={centre}
            cy={centre}
            r={radius}
            stroke={trackColor}
            strokeWidth={thickness}
            fill="none"
          />
          {arcs.map((a, i) => (
            <Circle
              key={a.key ?? a.label ?? i}
              cx={centre}
              cy={centre}
              r={radius}
              stroke={a.color}
              strokeWidth={thickness}
              fill="none"
              strokeLinecap="butt"
              strokeDasharray={`${(circumference * a.share) / 100} ${circumference}`}
              strokeDashoffset={-((circumference * a.offset) / 100)}
            />
          ))}
        </G>
      </Svg>

      <View style={[styles.centre, { width: size, height: size }]} pointerEvents="none">
        <Text style={styles.value}>{centreValue ?? total}</Text>
        {centreCaption ? <Text style={styles.caption}>{centreCaption}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  centre: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 24, fontWeight: '800', color: SLATE[800] },
  caption: { fontSize: 11, fontWeight: '600', color: SLATE[500], marginTop: 1 },
});
