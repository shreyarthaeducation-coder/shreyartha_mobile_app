import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

/** One beat, matching the website's `landing-cta-pulse` so both platforms flash in step. */
const CYCLE_MS = 1600;
/** How far the glow ring bursts past the button's edge, in dp — the website's 24px spread. */
const RING_SPREAD = 24;

/**
 * A call-to-action that keeps drawing the eye: it swells, a glow ring bursts outward from it, and a
 * streak of light sweeps across it, once every 1.6 s. The same three effects, on the same beat, as
 * the website's "Get Started" — see `landing-cta-pulse` in frontendmain's LandingPage.css.
 *
 * <h2>Why it is built like this</h2>
 * The website draws the ring with `box-shadow`, which React Native cannot animate on the native
 * thread. So here the ring is a **View behind the button** that grows and fades, and the sweep is a
 * narrow **gradient inside it** that slides across. All three are interpolated from **one**
 * `Animated.Value`, the way one CSS keyframe drives all its properties — three separate loops would
 * drift apart within a minute. Everything is `useNativeDriver`, so a busy screen cannot stutter it.
 *
 * The ring grows by a fixed {@link RING_SPREAD} on every side rather than by a percentage, because a
 * wide button scaled by a percentage bulges sideways far more than it does vertically.
 *
 * Built on RN's own `Animated` and the `expo-linear-gradient` the app already ships — a new native
 * animation library would force a store release, and this app has no over-the-air update channel.
 *
 * <h2>It stops for Reduce Motion</h2>
 * A control that moves forever is a WCAG 2.2 "Pause, Stop, Hide" problem and a genuine difficulty
 * for vestibular disorders, so the OS setting is honoured — including when it is changed while the
 * app is open. The button is then simply still, and still the boldest thing on the screen.
 *
 * @param ringColor  the halo — brand colour on a light background, white on a coloured one
 * @param sheenColor the peak colour of the sweep; transparent at both ends
 * @param radius     must match the button's own borderRadius, or the ring's corners will not
 */
export default function PulsingCta({
  label,
  onPress,
  buttonStyle,
  textStyle,
  ringColor,
  sheenColor = 'rgba(255,255,255,0.55)',
  radius = 32,
  accessibilityLabel,
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    let loop;
    let cancelled = false;

    const start = () => {
      loop = Animated.loop(
        Animated.timing(progress, {
          toValue: 1,
          duration: CYCLE_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      );
      loop.start();
    };
    const stop = () => {
      loop?.stop();
      loop = null;
      // Back to rest — otherwise a stopped button can freeze mid-swell with the ring showing.
      progress.setValue(0);
    };
    const apply = (reduceMotion) => {
      if (cancelled) return;
      stop();
      if (!reduceMotion) start();
    };

    AccessibilityInfo.isReduceMotionEnabled().then(apply).catch(() => apply(false));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', apply);
    return () => {
      cancelled = true;
      stop();
      sub?.remove?.();
    };
  }, [progress]);

  const { width, height } = size;

  // Swell to 1.08 by 40% of the beat, then settle — the website's keyframe shape.
  const scale = progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 1.08, 1] });

  // The ring bursts out to RING_SPREAD on every side while fading from bright to nothing.
  const ringScaleX = progress.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [1, width ? 1 + (2 * RING_SPREAD) / width : 1, width ? 1 + (2 * RING_SPREAD) / width : 1],
  });
  const ringScaleY = progress.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [1, height ? 1 + (2 * RING_SPREAD) / height : 1, height ? 1 + (2 * RING_SPREAD) / height : 1],
  });
  const ringOpacity = progress.interpolate({
    inputRange: [0, 0.04, 0.4, 1],
    outputRange: [0, 0.8, 0, 0],
  });

  // The sweep crosses in the first ~45% of the beat, then waits off to the right.
  const sheenWidth = width * 0.4;
  const sheenX = progress.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [-sheenWidth * 1.6, width + sheenWidth, width + sheenWidth],
  });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            backgroundColor: ringColor,
            opacity: ringOpacity,
            transform: [{ scaleX: ringScaleX }, { scaleY: ringScaleY }],
          },
        ]}
      />
      <TouchableOpacity
        style={[buttonStyle, styles.clip, { borderRadius: radius }]}
        activeOpacity={0.75}
        onPress={onPress}
        onLayout={(e) => {
          const { width: w, height: h } = e.nativeEvent.layout;
          if (w !== width || h !== height) setSize({ width: w, height: h });
        }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label}
      >
        <Text style={textStyle}>{label}</Text>
        <AnimatedGradient
          pointerEvents="none"
          colors={[transparent(sheenColor), sheenColor, transparent(sheenColor)]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[
            styles.sheen,
            { width: sheenWidth, transform: [{ translateX: sheenX }, { skewX: '-22deg' }] },
          ]}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

/** The same colour at zero alpha, so the sweep fades to nothing rather than to black. */
function transparent(rgba) {
  const m = /^rgba?\(([^,]+),([^,]+),([^,)]+)/.exec(String(rgba).replace(/\s/g, ''));
  return m ? `rgba(${m[1]},${m[2]},${m[3]},0)` : 'rgba(255,255,255,0)';
}

const styles = StyleSheet.create({
  // Keeps the sweep inside the button. The ring is a SIBLING behind it, so this does not clip it.
  clip: { overflow: 'hidden' },
  sheen: { position: 'absolute', top: 0, bottom: 0, left: 0 },
});
