import { Text, View } from 'react-native';
import { SLATE, SPACING, TYPE } from '../../../constants/theme';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * A centred caption with a dotted rule either side — the design's "Have doubt?" separator.
 *
 * The dots are `borderRadius: 999` end caps on the rules rather than a repeated glyph: a dotted
 * border is `borderStyle: 'dotted'`, which Android renders inconsistently at hairline widths and
 * frequently drops entirely.
 */
export default function SectionDivider({ label, tone = 'dark' }) {
  const styles = useStyles();
  const light = tone === 'light';
  return (
    <View style={styles.row}>
      <View style={styles.dot} />
      <View style={[styles.rule, light && styles.ruleLight]} />
      <Text style={[styles.label, light && styles.labelLight]}>{label}</Text>
      <View style={[styles.rule, light && styles.ruleLight]} />
      <View style={styles.dot} />
    </View>
  );
}

const useStyles = makeStyles((p) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  rule: { flex: 1, height: 1, backgroundColor: p.glassDarkBorder },
  ruleLight: { backgroundColor: SLATE[200] },
  dot: { width: 5, height: 5, borderRadius: 999, backgroundColor: p.primary },
  label: { fontSize: TYPE.heading, fontWeight: '800', color: '#ffffff' },
  labelLight: { color: SLATE[800] },
}));
