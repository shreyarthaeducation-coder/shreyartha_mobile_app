import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { SLATE, TYPE } from '../../../constants/theme';
import { makeStyles } from '../../../utils/makeStyles';
import { MOUTH_SHAPES, NEUTRAL, lerpParams, resolveShapes } from '../../../constants/mouthShapes';
import MouthSvg from './MouthSvg';

/**
 * A self-playing mouth for ONE sound.
 *
 * Ported from `frontendmain/.../phonetics/MouthDiagram.js`. Different kinds of sound are defined by
 * different MOVEMENTS, so the mouth walks a list of steps with per-step glide and hold times:
 *
 *   • stops (p b t d k g) — the sound IS the release. A held closure looks broken and makes /p/
 *     indistinguishable from /b/, so they close, hold, then burst open on a loop. The burst is
 *     deliberately ~4× faster than the closure, which is what makes it read as a plosive rather
 *     than a yawn.
 *   • affricates (tʃ dʒ) — a stop closure opening into a hiss.
 *   • nasals and other continuants — a single posture, held. There is no release: the air is going
 *     out through the nose.
 *   • diphthongs — glide between their two vowel positions.
 *
 * `closure` and `release` come from the catalogue entry, so the phonetics lives with the data
 * rather than in timing code.
 *
 * **`framer-motion`'s `animate(0, 1, …)` becomes an `Animated.Value` with a listener.** It was only
 * ever a numeric tween driving `setParams` — no DOM involved — so the substitution is mechanical.
 * The listener is what makes it work: the params must reach React state for `geometry()` to
 * recompute the paths, and `useNativeDriver` cannot do that by definition.
 */

const STEP = {
  closure: { glide: 0.32, hold: 340 },
  glideStep: { glide: 0.45, hold: 360 },
  burst: { glide: 0.1, hold: 260 },
  settle: { glide: 0.55, hold: 0 },
};

/** @returns {Array<{to: object, glide: number, hold: number}>} */
export function buildSteps({ shape, closure, release }) {
  const steps = [];
  const preset = (key) => MOUTH_SHAPES[key] || NEUTRAL;

  if (closure) steps.push({ to: preset(closure), ...STEP.closure });

  const targets = resolveShapes(shape);
  targets.forEach((to) => {
    // A lone posture with nothing after it simply settles and stays put.
    const timing = targets.length === 1 && !closure && !release ? STEP.settle : STEP.glideStep;
    steps.push({ to, ...timing });
  });

  if (release) steps.push({ to: preset(release), ...STEP.burst });

  return steps;
}

export default function MouthDiagram({
  shape,
  closure,
  release,
  voiced = false,
  size = 180,
  showReplay = true,
}) {
  const styles = useStyles();
  const steps = useMemo(() => buildSteps({ shape, closure, release }), [shape, closure, release]);
  const [params, setParams] = useState(NEUTRAL);

  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);
  const timerRef = useRef(null);
  const listenerRef = useRef(null);
  // Guards a queued step from firing into an unmounted tree, or into a replay that has since
  // restarted the sequence.
  const runRef = useRef(0);

  const stopAll = useCallback(() => {
    runRef.current += 1;
    if (animRef.current) animRef.current.stop();
    if (timerRef.current) clearTimeout(timerRef.current);
    if (listenerRef.current !== null) {
      progress.removeListener(listenerRef.current);
      listenerRef.current = null;
    }
    animRef.current = null;
    timerRef.current = null;
  }, [progress]);

  const play = useCallback(() => {
    stopAll();
    const run = (runRef.current += 1);
    setParams(NEUTRAL);

    const step = (index, from) => {
      if (runRef.current !== run) return;
      const s = steps[index % steps.length];

      progress.setValue(0);
      if (listenerRef.current !== null) progress.removeListener(listenerRef.current);
      listenerRef.current = progress.addListener(({ value }) => {
        if (runRef.current === run) setParams(lerpParams(from, s.to, value));
      });

      animRef.current = Animated.timing(progress, {
        toValue: 1,
        duration: s.glide * 1000, // framer-motion counts seconds, Animated milliseconds
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      });
      animRef.current.start(({ finished }) => {
        if (!finished || runRef.current !== run) return;
        if (steps.length < 2) return; // nothing to move on to
        timerRef.current = setTimeout(() => step(index + 1, s.to), s.hold);
      });
    };

    timerRef.current = setTimeout(() => step(0, NEUTRAL), 180);
  }, [steps, stopAll, progress]);

  useEffect(() => {
    play();
    return stopAll;
  }, [play, stopAll]);

  return (
    <View style={[styles.wrap, { width: size }]}>
      <MouthSvg params={params} voiced={voiced} size={size} />
      <View style={styles.foot}>
        <Text style={styles.voice}>
          {voiced ? '🔵 Voice on (throat buzzes)' : '⚪ No voice'}
        </Text>
        {showReplay ? (
          <Pressable
            onPress={play}
            style={({ pressed }) => [styles.replay, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.replayText}>↻ Replay</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((p) => ({
  wrap: { alignSelf: 'center', alignItems: 'center' },
  foot: { alignItems: 'center', gap: 6, marginTop: 4 },
  voice: { fontSize: TYPE.caption, fontWeight: '600', color: SLATE[500] },
  replay: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: p.tint,
  },
  replayText: { fontSize: TYPE.label, fontWeight: '700', color: p.deep },
  pressed: { opacity: 0.78 },
}));
