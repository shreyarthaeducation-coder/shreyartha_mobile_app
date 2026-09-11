import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE, leading } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import makeStyles from '../../../utils/makeStyles';
import { TUTORIAL_STEPS } from './salesTutorialSteps';

/**
 * The Sales walkthrough, as a full-screen sheet.
 *
 * Deliberately NOT built on `FormSheet`: that component is a bottom sheet with a pinned Save row,
 * shaped for editing a record. This is a full-bleed reader with its own pager and dots, and
 * bending FormSheet into it would have meant adding a mode to a component eight other screens use.
 *
 * `visible` is decided by the SERVER (`/onboarding` → `showTutorial`), not by AsyncStorage, so a
 * rep taught on the website is not taught again here. Skipping counts as seen — the Profile tile
 * replays it for anyone who wants it back.
 */
export default function SalesTutorialSheet({ visible, onDismiss, replay = false }) {
  const palette = usePalette();
  const styles = useStyles();
  const [index, setIndex] = useState(0);

  // Restart at the first slide each time it opens, so Replay never resumes mid-way.
  useEffect(() => {
    if (visible) setIndex(0);
  }, [visible]);

  if (!visible) return null;

  const step = TUTORIAL_STEPS[index];
  const isLast = index === TUTORIAL_STEPS.length - 1;

  return (
    <Modal visible animationType="slide" onRequestClose={() => onDismiss(false)}>
      <View style={styles.page}>
        <View style={styles.head}>
          <Text style={styles.count}>
            {`Step ${index + 1} of ${TUTORIAL_STEPS.length}`}
          </Text>
          <Pressable onPress={() => onDismiss(false)} hitSlop={10}>
            <Text style={[styles.skip, { color: palette.link }]}>{replay ? 'Close' : 'Skip'}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <View style={[styles.iconWrap, { backgroundColor: palette.tint }]}>
            <Ionicons name={step.icon} size={38} color={palette.primaryDark} />
          </View>
          <Text style={[styles.title, { color: palette.primaryDark }]}>{step.title}</Text>
          <Text style={styles.copy}>{step.body}</Text>
        </ScrollView>

        <View style={styles.dots}>
          {TUTORIAL_STEPS.map((s, i) => (
            <Pressable
              key={s.key}
              onPress={() => setIndex(i)}
              hitSlop={8}
              accessibilityLabel={`Go to step ${i + 1}: ${s.title}`}
              style={[
                styles.dot,
                i === index && [styles.dotActive, { backgroundColor: palette.primary }],
              ]}
            />
          ))}
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={() => setIndex((i) => Math.max(i - 1, 0))}
            disabled={index === 0}
            style={({ pressed }) => [
              styles.btn,
              styles.btnGhost,
              index === 0 && styles.btnDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.btnGhostText, { color: palette.link }]}>Back</Text>
          </Pressable>

          <Pressable
            onPress={() => (isLast ? onDismiss(true) : setIndex((i) => i + 1))}
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: palette.primaryDark },
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.btnText}>
              {isLast ? (replay ? 'Done' : 'Start selling') : 'Next'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(() => ({
  page: { flex: 1, backgroundColor: '#ffffff', paddingTop: SPACING.xl },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  count: {
    fontSize: TYPE.caption,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: SLATE[500],
  },
  skip: { fontSize: TYPE.heading, fontWeight: '600' },

  body: { alignItems: 'center', paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: { fontSize: TYPE.headline, fontWeight: '800', textAlign: 'center', marginBottom: SPACING.sm },
  copy: { fontSize: TYPE.heading, lineHeight: leading(TYPE.heading), color: SLATE[600], textAlign: 'center' },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 7, paddingVertical: SPACING.md },
  dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: SLATE[200] },
  dotActive: { width: 22 },

  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  btnGhost: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: SLATE[200] },
  btnDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
  btnText: { color: '#ffffff', fontWeight: '700', fontSize: TYPE.heading },
  btnGhostText: { fontWeight: '600', fontSize: TYPE.heading },
}));
