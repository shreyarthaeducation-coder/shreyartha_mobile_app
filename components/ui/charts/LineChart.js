import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Polyline, Text as SvgText } from 'react-native-svg';
import { SLATE } from '../../../constants/theme';
import { usePalette } from '../PaletteContext';

/**
 * Percentage line chart with a filled area — the native form of the web's chart.js `<Line>`.
 *
 * Built for the counsellor's Wellness Index, where the x-axis is a set of index short codes
 * (AFI, ERI, SFI…) and the y-axis is a 0–100 score. Note that those x values are **categorical**:
 * the line implies a progression between them that does not exist in the data. That is a known
 * property of the web's chart, kept deliberately for parity after the user compared both — do not
 * "fix" it back to bars without asking.
 *
 * Self-sizing: it measures its own width via onLayout, so callers only supply a height.
 */

const PAD_LEFT = 34;
const PAD_RIGHT = 10;
const PAD_TOP = 10;
const PAD_BOTTOM = 26;
const Y_TICKS = [0, 25, 50, 75, 100];

export default function LineChart({
  data = [],
  height = 190,
  palette: paletteProp,
  /** Per-point colour, e.g. by risk band. Falls back to the palette. */
  pointColor,
  style,
}) {
  const contextPalette = usePalette();
  // Explicit prop wins; otherwise the surrounding portal palette (teal by default).
  const palette = paletteProp || contextPalette;
  const [width, setWidth] = useState(0);

  const plotW = Math.max(0, width - PAD_LEFT - PAD_RIGHT);
  const plotH = height - PAD_TOP - PAD_BOTTOM;

  // A single point has no span to divide, so centre it rather than dividing by zero.
  const stepFor = (i) =>
    data.length === 1 ? PAD_LEFT + plotW / 2 : PAD_LEFT + (plotW * i) / (data.length - 1);
  const yFor = (value) => PAD_TOP + plotH - (Math.max(0, Math.min(100, value)) / 100) * plotH;

  const points = data.map((d, i) => `${stepFor(i)},${yFor(d.value)}`).join(' ');
  // Closing the polyline down to the baseline gives the web's filled area under the line.
  const area =
    data.length > 0
      ? `${stepFor(0)},${PAD_TOP + plotH} ${points} ${stepFor(data.length - 1)},${PAD_TOP + plotH}`
      : '';

  return (
    <View style={style} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && data.length > 0 ? (
        <Svg width={width} height={height}>
          {Y_TICKS.map((tick) => {
            const y = yFor(tick);
            return (
              <G key={tick}>
                <Line
                  x1={PAD_LEFT}
                  y1={y}
                  x2={width - PAD_RIGHT}
                  y2={y}
                  stroke={SLATE[200]}
                  strokeWidth={1}
                />
                <SvgText
                  x={PAD_LEFT - 6}
                  y={y + 3.5}
                  fill={SLATE[400]}
                  fontSize={9}
                  textAnchor="end"
                >
                  {tick}
                </SvgText>
              </G>
            );
          })}

          {data.length > 1 ? (
            <Polygon points={area} fill={palette.primary} fillOpacity={0.15} />
          ) : null}

          <Polyline
            points={points}
            fill="none"
            stroke={palette.primary}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {data.map((d, i) => (
            <Circle
              key={d.label ?? i}
              cx={stepFor(i)}
              cy={yFor(d.value)}
              r={4.5}
              fill={pointColor ? pointColor(d) : palette.primary}
              stroke="#ffffff"
              strokeWidth={1.5}
            />
          ))}

          {data.map((d, i) => (
            <SvgText
              key={`x${d.label ?? i}`}
              x={stepFor(i)}
              y={height - 9}
              fill={SLATE[500]}
              fontSize={9.5}
              fontWeight="700"
              textAnchor="middle"
            >
              {d.label}
            </SvgText>
          ))}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}

      <Text style={styles.axisLabel}>Score (%)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  axisLabel: { fontSize: 10.5, color: SLATE[400], textAlign: 'center', marginTop: 2 },
});
