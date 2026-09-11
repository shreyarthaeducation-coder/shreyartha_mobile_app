import { StyleSheet, Text, View } from 'react-native';
import { SLATE, TYPE } from '../../../constants/theme';
import { usePalette } from '../PaletteContext';

/**
 * Horizontal completion bar. No SVG — a filled View inside a track is exactly what the web's
 * `style={{ width: "N%" }}` divs are, and it costs nothing.
 *
 * `value` is a percentage 0–100. Values outside that are clamped rather than allowed to overflow
 * the track (the backend rounds to 2 decimals, so 100.00000001 is a real possibility).
 */

export default function ProgressBar({
  value = 0,
  color,
  height = 8,
  label,
  showValue = false,
  palette: paletteProp,
  style,
}) {
  const contextPalette = usePalette();
  // Explicit prop wins; otherwise the surrounding portal palette (teal by default).
  const palette = paletteProp || contextPalette;
  const pct = Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <View style={style}>
      {label || showValue ? (
        <View style={styles.head}>
          {label ? (
            <Text style={styles.label} numberOfLines={1}>
              {label}
            </Text>
          ) : null}
          {showValue ? <Text style={styles.value}>{Math.round(pct)}%</Text> : null}
        </View>
      ) : null}
      <View style={[styles.track, { height, borderRadius: height / 2 }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${pct}%`,
              height,
              borderRadius: height / 2,
              backgroundColor: color || palette.primary,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  label: { flex: 1, fontSize: TYPE.label, fontWeight: '600', color: SLATE[600] },
  value: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[700], marginLeft: 8 },
  track: { backgroundColor: SLATE[200], overflow: 'hidden', width: '100%' },
  fill: {},
});
