import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, TYPE } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { ProgressBar } from '../../ui';

/**
 * The progress graph on the welcome screen: one tappable row per section.
 *
 * ── WHY NOT `GroupedBars` ────────────────────────────────────────────────────
 * It is the obvious candidate and it is the wrong one here for two reasons: its rows are plain
 * Views with no press target, and its colours are hardcoded `#4f46e5` / `#f59e0b`, which fight the
 * student panel's blue. `ProgressBar` is palette-aware and already clamps out-of-range values, so
 * the bar itself is reused and only the row chrome is new.
 *
 * `ProgressBar`'s own `label`/`showValue` are deliberately NOT used: they render in SLATE greys
 * sized for a white card, and this list sits on the dark photographic background. The label and the
 * percentage are drawn here in `onDark` instead.
 */

export default function SectionProgressList({ rows, loading, onOpen }) {
  const styles = useStyles();
  const palette = usePalette();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={palette.onDark} />
        <Text style={styles.loadingText}>Loading your progress…</Text>
      </View>
    );
  }

  // Nothing arrived. Say so plainly rather than drawing five empty bars, which would read as
  // "you have done nothing" — a different and much worse claim.
  if (!rows || rows.length === 0) {
    return (
      <Text style={styles.empty}>
        Your progress will appear here once you have started a section.
      </Text>
    );
  }

  return (
    <View style={styles.list}>
      {rows.map((row) => (
        <Pressable
          key={row.key}
          onPress={() => onOpen?.(row)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${row.label}, ${Math.round(row.percent)} percent complete. Open.`}
        >
          <View style={styles.rowHead}>
            <Text style={styles.label} numberOfLines={1}>
              {row.label}
            </Text>
            <Text style={styles.value}>{Math.round(row.percent)}%</Text>
            <Ionicons name="chevron-forward" size={13} color={palette.onDark} />
          </View>
          <ProgressBar value={row.percent} height={7} />
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = makeStyles((p) => ({
  list: { gap: SPACING.md },
  row: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: p.glass,
    borderWidth: 1,
    borderColor: p.glassBorder,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  label: { flex: 1, fontSize: TYPE.body, fontWeight: '700', color: '#ffffff' },
  value: { fontSize: TYPE.body, fontWeight: '800', color: p.onDark },

  loading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingVertical: SPACING.lg },
  loadingText: { fontSize: TYPE.label, fontWeight: '600', color: p.onDark },
  empty: {
    fontSize: TYPE.label,
    color: p.onDark,
    lineHeight: 19,
    textAlign: 'center',
    paddingVertical: SPACING.md,
  },
  pressed: { opacity: 0.75 },
}));
