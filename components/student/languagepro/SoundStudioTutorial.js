import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SLATE, SPACING, TYPE } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * Sound Studio's five-step introduction.
 *
 * Port of `frontendmain/src/student/platform/LanguagePro/SoundStudio/SoundStudioTutorial.js`.
 *
 * ── ASYNCSTORAGE IS CORRECT HERE, UNLIKE THE WELCOME SCREEN ──────────────────
 * The web gates this on **`localStorage`**, not `sessionStorage` — "once ever", not "once per
 * session". That is the opposite of the student welcome interstitial
 * (`components/student/welcome/sessionFlag.js`), which deliberately uses an in-memory flag because
 * showing a student their progress once and never again would be useless.
 *
 * The difference is what the screen is FOR. The welcome screen shows data that changes; this
 * explains a chart that does not. Once you know how the chart is arranged, you know.
 *
 * The key is the web's, verbatim, so a student who has seen it on the website is not shown it again.
 *
 * ── THE COPY IS THE WEB'S, VERBATIM ──────────────────────────────────────────
 * These five steps teach an unfamiliar object — the IPA grid — and the wording was written for
 * that. Paraphrasing loses the specific promises ("nothing here is graded or saved") that make a
 * student willing to try recording themselves.
 */

const SEEN_KEY = 'soundStudioTutorialSeen';

const STEPS = [
  {
    icon: '🔤',
    title: 'Every sound of English, in one place',
    body:
      'English has 40 sounds but only 26 letters, which is why spelling is such a poor guide to ' +
      'pronunciation. Each box here is one sound. Tap any box to open it.',
  },
  {
    icon: '🗺️',
    title: 'How the chart is arranged',
    body:
      'For consonants, the rows tell you HOW you make the sound — whether the air stops, hisses or ' +
      'flows — and the columns tell you WHERE in your mouth it happens, from your lips at the left ' +
      'to the back of your mouth at the right. Vowels are arranged by where your tongue sits.',
    hint: "A small purple dot means the sound uses your voice — your throat buzzes. No dot means it's just air.",
  },
  {
    icon: '👄',
    title: 'Watch the mouth',
    body:
      "Each sound plays a mouth animation, seen from the front. Some sounds are a position you hold, " +
      "like 'mmm'. Others are a movement: 'p' builds up pressure with the lips closed and then pops " +
      'open. Press ↻ Replay as many times as you like, and try to copy it in a mirror.',
  },
  {
    icon: '🔊',
    title: 'Hear it in real words',
    body:
      'Every sound comes with three example words. Tap one to hear it, and look at the phonetic ' +
      "spelling next to it — that's the same alphabet used in dictionaries, so once you can read it " +
      "you can look up any word's pronunciation.",
  },
  {
    icon: '🎤',
    title: 'Then say it yourself',
    body:
      "Tap Record and say the example word once. You'll get a score out of 100 for that one sound, " +
      'plus a breakdown of every sound in the word. Aim for 80 or more — green is on target, amber ' +
      'is close, red needs another go.',
    hint: 'Nothing here is graded or saved. Practise as often as you like.',
  },
];

/**
 * Owns "has this been seen", so the screen only has to render the component and a help button.
 *
 * `seen` starts null — UNKNOWN, not false. Rendering the tutorial before the read resolves would
 * flash it at every student on every visit, which is precisely what the key exists to prevent.
 */
export function useSoundStudioTutorial() {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(null);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(SEEN_KEY)
      .then((v) => {
        if (!alive) return;
        setSeen(!!v);
        if (!v) setOpen(true);
      })
      // A storage failure must not cost the student the tutorial, nor show it forever: treat an
      // unreadable key as "already seen" and leave the help button as the way in.
      .catch(() => alive && setSeen(true));
    return () => {
      alive = false;
    };
  }, []);

  const closeTutorial = useCallback(() => {
    setOpen(false);
    setSeen(true);
    AsyncStorage.setItem(SEEN_KEY, '1').catch(() => {});
  }, []);

  // Re-opening from the help button always restarts at step 0 — the web does this too, and a
  // tutorial that resumes halfway is confusing when you asked for it deliberately.
  const openTutorial = useCallback(() => setOpen(true), []);

  return { open, seen, openTutorial, closeTutorial };
}

export default function SoundStudioTutorial({ open, onClose }) {
  const styles = useStyles();
  const palette = usePalette();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  if (!open) return null;

  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.icon}>{current.icon}</Text>
            <Text style={styles.title}>{current.title}</Text>
            <Text style={styles.text}>{current.body}</Text>
            {current.hint ? <Text style={styles.hint}>{current.hint}</Text> : null}
          </ScrollView>

          <View style={styles.dots}>
            {STEPS.map((s, i) => (
              <View key={s.title} style={[styles.dot, i === step && styles.dotOn]} />
            ))}
          </View>

          <Text style={styles.counter}>
            Step {step + 1} of {STEPS.length}
          </Text>

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.skipText}>{last ? 'Close' : 'Skip'}</Text>
            </Pressable>
            {!last ? (
              <Pressable
                onPress={() => setStep((s) => s + 1)}
                style={({ pressed }) => [styles.next, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Text style={styles.nextText}>Next</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.next, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Text style={styles.nextText}>Start exploring</Text>
              </Pressable>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((p) => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: SPACING.lg,
    maxHeight: '85%',
  },
  body: { paddingHorizontal: SPACING.lg, alignItems: 'center' },
  icon: { fontSize: 40, marginBottom: SPACING.sm },
  title: {
    fontSize: TYPE.title,
    fontWeight: '800',
    color: SLATE[800],
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  text: { fontSize: TYPE.body, color: SLATE[600], lineHeight: 21, textAlign: 'center' },
  hint: {
    fontSize: TYPE.label,
    color: p.deep,
    lineHeight: 19,
    textAlign: 'center',
    backgroundColor: p.tint,
    borderRadius: 10,
    padding: SPACING.sm,
    marginTop: SPACING.md,
    overflow: 'hidden',
  },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: SPACING.lg },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: SLATE[300] },
  dotOn: { backgroundColor: p.primary, width: 18 },
  counter: {
    fontSize: TYPE.caption,
    color: SLATE[400],
    textAlign: 'center',
    marginTop: SPACING.sm,
  },

  actions: {
    flexDirection: 'row',
    gap: 10,
    padding: SPACING.lg,
  },
  skip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: SLATE[300],
  },
  skipText: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[600] },
  next: {
    flex: 2,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: p.primary,
  },
  nextText: { fontSize: TYPE.body, fontWeight: '800', color: p.onPrimary },
  pressed: { opacity: 0.8 },
}));
