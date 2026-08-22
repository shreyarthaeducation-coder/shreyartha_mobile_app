import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { SLATE } from '../../../constants/theme';

/**
 * Ring chart for completion percentages.
 *
 * Drawn with `strokeDasharray` on a `Circle` rather than arc `Path`s: for a single filled segment
 * that is a two-line calculation and it can't produce the malformed `d` strings hand-rolled arc
 * maths is prone to. Rotated -90° so the fill starts at twelve o'clock.
 *
 * Deliberately two-tone. The web's pie has a third "in progress" slice that **can never render** —
 * every level of the syllabus response computes `notCompleted = total - completed`, so the
 * leftover is always zero. Shipping a three-colour legend for an unreachable state would be a lie.
 */

export default function DonutChart({
  value = 0,
  size = 132,
  thickness = 14,
  color = '#4caf50',
  trackColor = SLATE[200],
  caption,
  subCaption,
  style,
}) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const centre = size / 2;

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
          {pct > 0 ? (
            <Circle
              cx={centre}
              cy={centre}
              r={radius}
              stroke={color}
              strokeWidth={thickness}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${(circumference * pct) / 100} ${circumference}`}
            />
          ) : null}
        </G>
      </Svg>

      <View style={[styles.centre, { width: size, height: size }]} pointerEvents="none">
        <Text style={styles.value}>{Math.round(pct)}%</Text>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>

      {subCaption ? <Text style={styles.sub}>{subCaption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  centre: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 22, fontWeight: '800', color: SLATE[800] },
  caption: { fontSize: 11, fontWeight: '600', color: SLATE[500], marginTop: 1 },
  sub: { fontSize: 12, color: SLATE[500], marginTop: 8, textAlign: 'center' },
});
