import { createContext, useContext, useMemo } from 'react';
import { Text, View } from 'react-native';
import { INK, SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';

/**
 * A panel on the student page, in one of two tones.
 *
 * ── LIGHT — the default, and now the ONLY tone any screen uses ───────────────
 * An opaque white card with a hairline border. It used to be `rgba(255,255,255,0.93)` so the
 * background photograph read through it; with the photo gone there is nothing to see through, and
 * a translucent card over a flat page only muddies its own text.
 *
 * ── DARK (`tone="dark"`) — RETAINED, BUT NO LONGER USED ──────────────────────
 * `glassDark` with light text. It existed so copy laid over the photograph had a legible bed
 * underneath instead of sitting on whatever the image was doing at that pixel. The student panel
 * is a light page now, all 21 `tone="dark"` call sites are gone, and this branch has no caller.
 *
 * It is kept rather than deleted because the tone mechanism is the thing that makes the primitives
 * below safe — see the next note — and because removing it would also mean deleting the dark
 * branches in SegmentedTabs, CalendarGrid and MonthNavigator, which are the same shape. If it is
 * still unused when something else needs changing here, that is the moment to take all four out
 * together.
 *
 * ── WHY A CONTEXT AND NOT A PROP ─────────────────────────────────────────────
 * `StudentCardTitle`, `StudentNote` and `StudentInfoRow` are rendered as children, often several
 * levels down inside a screen's own markup. Threading a `tone` prop through each of them is how the
 * twelfth copy of a style gets it wrong. The card publishes its tone; the primitives read it. A
 * primitive used OUTSIDE any card falls back to light, which is what the default context gives.
 *
 * Screens holding their own `SLATE[800]` / `SLATE[500]` literals work unchanged — they are on light
 * cards, which is what those values were chosen for.
 */

/** The resolved ink for the surface a subtree sits on. Default light — see the note above. */
const CardToneContext = createContext(INK.light);

/** Text colours for the nearest enclosing StudentCard. */
export function useCardInk() {
  return useContext(CardToneContext);
}

export function StudentCard({ children, style, tone = 'light' }) {
  const styles = useStyles();
  const ink = tone === 'dark' ? INK.dark : INK.light;

  return (
    <CardToneContext.Provider value={ink}>
      <View style={[styles.card, tone === 'dark' && styles.cardDark, style]}>{children}</View>
    </CardToneContext.Provider>
  );
}

/**
 * A section heading inside a card.
 *
 * On a light card this is `palette.deep` — a blue that only works against near-white. On a dark one
 * it would be barely visible, so the dark tone uses the palette's `primary` (the light blue), which
 * is the same hue read the other way round.
 */
export function StudentCardTitle({ children, style }) {
  const styles = useStyles();
  const palette = usePalette();
  const ink = useCardInk();
  const onDark = ink === INK.dark;

  return (
    <Text style={[styles.title, { color: onDark ? palette.primary : palette.deep }, style]}>
      {children}
    </Text>
  );
}

/**
 * A quiet note inside a card — "no topics selected yet", "no resources for this chapter".
 *
 * NOT `EmptyState`, and the difference matters. `EmptyState` owns the whole screen: it has an icon,
 * a heading and vertical breathing room, and it says "there is nothing here at all". This says "this
 * one section is empty" while the rest of the screen is doing its job. Putting a large illustrated
 * empty state inside a card that sits above populated content is the mistake this exists to prevent.
 *
 * Twelve files had declared the identical `{ fontSize: TYPE.body, color: SLATE[500], lineHeight: leading(TYPE.body) }`
 * under the key `empty` — which only became visible once the type scale collapsed their font sizes
 * onto one value. Twelve copies of a style is twelve chances for the thirteenth to be different.
 */
export function StudentNote({ children, style }) {
  const styles = useStyles();
  const ink = useCardInk();
  return <Text style={[styles.note, { color: ink.muted }, style]}>{children}</Text>;
}

/** Body copy inside a card, inked for whichever tone the card is. */
export function StudentCardText({ children, style, numberOfLines }) {
  const styles = useStyles();
  const ink = useCardInk();
  return (
    <Text style={[styles.body, { color: ink.body }, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

/** A label/value row, matching components/ui/Card's InfoRow but on a student card. */
export function StudentInfoRow({ label, value }) {
  const styles = useStyles();
  const ink = useCardInk();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: ink.muted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: ink.title }]}>{value || '—'}</Text>
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
  // Only the two surface colours change. Radius, padding and shadow are the same object either way,
  // so a screen converted to dark keeps its exact rhythm.
  cardDark: {
    backgroundColor: '#ffffff',
    borderColor: SLATE[200],
    borderRadius: 20,
  },
  title: {
    fontSize: TYPE.label,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: SPACING.sm,
  },
  body: { fontSize: TYPE.body, lineHeight: leading(TYPE.body) },
  note: { fontSize: TYPE.body, lineHeight: leading(TYPE.body) },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, gap: SPACING.sm },
  rowLabel: { flex: 1, fontSize: TYPE.label, fontWeight: '600' },
  rowValue: { flex: 1.4, fontSize: TYPE.body, textAlign: 'right' },
}));

export default StudentCard;
