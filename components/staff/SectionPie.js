import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { SLATE, SPACING, TYPE } from '../../constants/theme';
import { bottomPadding, useModalBottomInset } from '../shared/BottomInsetGuard';
import { pieSlices } from '../../utils/studentStatus';

/** Completed, started, not started — the website's colours. */
export const PIE_COLOURS = { done: '#16a34a', started: '#eab308', none: '#cbd5e1' };

/**
 * A pie drawn as dashed circle strokes, as DonutChart draws its ring: a stroke as wide as the
 * circle is round, one segment per slice, so no hand-made arc ever has to be right.
 */
export function PieSvg({ pie, size }) {
  const r = size / 4;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  return (
    <Svg width={size} height={size}>
      <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
        {pie.slices
          .filter((s) => s.count > 0)
          .map((s) => {
            const length = (s.count / pie.total) * circumference;
            const circle = (
              <Circle
                key={s.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={PIE_COLOURS[s.key]}
                strokeWidth={size / 2}
                strokeDasharray={`${length} ${circumference}`}
                strokeDashoffset={-offset}
              />
            );
            offset += length;
            return circle;
          })}
      </G>
    </Svg>
  );
}

const percent = (count, total) => `${Math.round((count / total) * 100)}%`;

/**
 * A column's pie at the top of Student Status (31 Oct 2026): small on the column's card, and
 * opened to a larger one with the counts. Nothing when the column applies to nobody.
 */
export default function SectionPie({ summary, label }) {
  const bottomInset = useModalBottomInset();
  const [open, setOpen] = useState(false);
  const pie = pieSlices(summary);
  if (!pie) return null;
  const done = pie.slices[0].count;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${done} of ${pie.total} completed, ${pie.left} left. Open chart`}
        style={styles.small}
      >
        <PieSvg pie={pie} size={28} />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, bottomPadding(styles.sheet, bottomInset)]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />
            <Text style={styles.title}>{label}</Text>
            <Text style={styles.sub}>Whole section</Text>
            <View style={styles.body}>
              <PieSvg pie={pie} size={170} />
              <View style={styles.legend}>
                {pie.slices.map((s) => (
                  <View key={s.key} style={styles.legendRow}>
                    <View style={[styles.swatch, { backgroundColor: PIE_COLOURS[s.key] }]} />
                    <Text style={styles.legendText}>
                      {s.label}: <Text style={styles.strong}>{s.count}</Text> ({percent(s.count, pie.total)})
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            <Text style={styles.total}>
              {done} of {pie.total} completed · {pie.left} left
            </Text>
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button" style={styles.close}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  small: { alignSelf: 'flex-start', marginTop: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: SLATE[300], marginBottom: SPACING.sm },
  title: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  sub: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 2 },
  body: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: SPACING.md, marginTop: SPACING.md },
  legend: { gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center' },
  swatch: { width: 12, height: 12, borderRadius: 3, marginRight: 8 },
  legendText: { fontSize: TYPE.body, color: SLATE[700] },
  strong: { fontWeight: '700', color: SLATE[900] },
  total: { textAlign: 'center', fontSize: TYPE.body, fontWeight: '700', color: SLATE[800], marginTop: SPACING.md },
  close: { alignSelf: 'center', marginTop: SPACING.md, paddingVertical: 10, paddingHorizontal: SPACING.lg, borderRadius: 999, backgroundColor: SLATE[100] },
  closeText: { fontSize: TYPE.body, fontWeight: '600', color: SLATE[800] },
});
