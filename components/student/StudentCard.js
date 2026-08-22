import { Text, View } from 'react-native';
import { SLATE, SPACING, TYPE } from '../../constants/theme';
import { makeStyles } from '../../utils/makeStyles';

/**
 * A translucent white panel on the fixed background — the student panel's equivalent of
 * `components/ui/Card`, which is opaque white on a slate page and would look wrong here.
 *
 * `rgba(255,255,255,0.93)` and the light-blue hairline come straight from the web
 * (`.profile-main-flex`, `.dashboard-section-card`). The translucency is the point: the
 * background photograph has to read through, or the panel looks pasted on.
 *
 * Text inside is dark, because the card is light — only text directly on the background uses the
 * palette's `onDark`.
 */
export function StudentCard({ children, style }) {
  const styles = useStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

export function StudentCardTitle({ children, style }) {
  const styles = useStyles();
  return <Text style={[styles.title, style]}>{children}</Text>;
}

/**
 * A quiet note inside a card — "no topics selected yet", "no resources for this chapter".
 *
 * NOT `EmptyState`, and the difference matters. `EmptyState` owns the whole screen: it has an icon,
 * a heading and vertical breathing room, and it says "there is nothing here at all". This says "this
 * one section is empty" while the rest of the screen is doing its job. Putting a large illustrated
 * empty state inside a card that sits above populated content is the mistake this exists to prevent.
 *
 * Twelve files had declared the identical `{ fontSize: TYPE.body, color: SLATE[500], lineHeight: 19 }`
 * under the key `empty` — which only became visible once the type scale collapsed their font sizes
 * onto one value. Twelve copies of a style is twelve chances for the thirteenth to be different.
 */
export function StudentNote({ children, style }) {
  const styles = useStyles();
  return <Text style={[styles.note, style]}>{children}</Text>;
}

/** A label/value row, matching components/ui/Card's InfoRow but on the light card. */
export function StudentInfoRow({ label, value }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || '—'}</Text>
    </View>
  );
}

const useStyles = makeStyles((p) => ({
  card: {
    backgroundColor: p.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: p.cardBorder,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    // A photographic background needs a real shadow or the card floats ambiguously.
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 14,
    elevation: 4,
  },
  title: {
    fontSize: TYPE.label,
    fontWeight: '700',
    color: p.deep,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: SPACING.sm,
  },
  note: { fontSize: TYPE.body, color: SLATE[500], lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, gap: SPACING.sm },
  rowLabel: { flex: 1, fontSize: TYPE.label, fontWeight: '600', color: SLATE[500] },
  rowValue: { flex: 1.4, fontSize: TYPE.body, color: SLATE[800], textAlign: 'right' },
}));

export default StudentCard;
