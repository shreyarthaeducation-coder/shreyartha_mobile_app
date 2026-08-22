import { memo, useEffect, useId, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

/**
 * The mouth — a front view drawn from six numeric shape parameters.
 *
 * Ported from `frontendmain/src/student/platform/LanguagePro/phonetics/MouthSvg.js`. Purely
 * presentational: it holds no animation state of its own, so the caller drives it.
 *
 * The web's two invariants, both preserved:
 *   1. **Geometry is recomputed from the numeric params every render.** Never animate the path `d`
 *      strings directly — interpolating path strings is fragile, and the params are the real model.
 *   2. **The voicing indicator animates `r` and `opacity`, not `scale`** — on the web because SVG
 *      transform-origin differs between browsers; here because react-native-svg's transform
 *      handling has the same class of inconsistency. Either way, animate the primitives.
 *
 * `framer-motion` does not exist in React Native, so the pulsing throat dot is a looped
 * `Animated.Value` instead. `react-native-svg` exposes no animated primitives, so the Circle is
 * wrapped once via `createAnimatedComponent` at module scope — doing that inside the component
 * would make a new component type on every render and remount the circle each frame.
 */

const CX = 100;
const CY = 74;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Path geometry from the shape parameters. Copied verbatim from the web — it is a pure function of
 * numbers, so it needs no adaptation and must not drift from the original.
 */
export function geometry(p) {
  const half = 52 + p.lipSpread * 18 - p.lipRound * 30;
  const gap = 3 + p.jawOpen * 52;
  // f/v — the bottom lip rises to meet the top teeth
  const lift = p.teethOnLip * gap * 0.55;
  const topInner = CY - gap / 2;
  const botInner = CY + gap / 2 - lift;
  const fullness = 1 + p.lipRound * 0.45;

  // Quadratic control points are doubled so the curve peak lands where we want.
  const q = (peak) => 2 * peak - CY;
  const r = (n) => Math.round(n * 100) / 100;

  return {
    interior: `M ${r(CX - half)} ${CY} Q ${CX} ${r(q(topInner))} ${r(CX + half)} ${CY} Q ${CX} ${r(
      q(botInner),
    )} ${r(CX - half)} ${CY} Z`,
    topLip: `M ${r(CX - half)} ${CY} Q ${CX} ${r(q(topInner - 11 * fullness))} ${r(
      CX + half,
    )} ${CY} Q ${CX} ${r(q(topInner))} ${r(CX - half)} ${CY} Z`,
    botLip: `M ${r(CX - half)} ${CY} Q ${CX} ${r(q(botInner))} ${r(CX + half)} ${CY} Q ${CX} ${r(
      q(botInner + 13 * fullness),
    )} ${r(CX - half)} ${CY} Z`,
    teethY: topInner + 1,
    teethH: Math.max(0, Math.min(9, gap * 0.32)),
    teethW: half * 1.1,
    gap,
    half,
    topInner,
    botInner,
  };
}

function MouthSvg({ params, voiced = false, size = 180 }) {
  const g = geometry(params);
  // Gradient ids must be unique per instance — two mouths on one screen would otherwise share
  // (and fight over) the same <Defs>.
  const uid = useId().replace(/:/g, '');

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!voiced) {
      pulse.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 450,
          easing: Easing.inOut(Easing.ease),
          // `r` and `opacity` on an SVG node are not native-driven props.
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 450,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [voiced, pulse]);

  // Same endpoints as the web's keyframes: r 5→8→5, opacity 0.85→0.45→0.85.
  const radius = pulse.interpolate({ inputRange: [0, 1], outputRange: [5, 8] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 0.45] });

  return (
    <Svg viewBox="0 0 200 150" width={size} height={size * 0.75}>
      <Defs>
        {/* Anything drawn inside the mouth is clipped to the cavity so it can never spill over the
            lips as the jaw moves. */}
        <ClipPath id={`cavity-clip-${uid}`}>
          <Path d={g.interior} />
        </ClipPath>
        <RadialGradient id={`face-${uid}`} cx="50%" cy="42%" r="65%">
          <Stop offset="0%" stopColor="#ffeede" />
          <Stop offset="100%" stopColor="#f6d8c3" />
        </RadialGradient>
        <LinearGradient id={`lip-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#e08585" />
          <Stop offset="55%" stopColor="#d4696c" />
          <Stop offset="100%" stopColor="#b94f57" />
        </LinearGradient>
        <RadialGradient id={`cavity-${uid}`} cx="50%" cy="35%" r="75%">
          <Stop offset="0%" stopColor="#8e3340" />
          <Stop offset="100%" stopColor="#5c1c27" />
        </RadialGradient>
      </Defs>

      {/* face */}
      <Ellipse cx={CX} cy={CY} rx={92} ry={68} fill={`url(#face-${uid})`} />
      {/* mouth interior */}
      <Path d={g.interior} fill={`url(#cavity-${uid})`} />

      {/* Back of the tongue sealing the throat (k, g, ŋ). From the front the dark cavity fills
          with tongue instead of opening into shadow. */}
      {params.backClosure > 0.02 ? (
        <G clipPath={`url(#cavity-clip-${uid})`}>
          <Ellipse
            cx={CX}
            cy={CY + g.gap * 0.1}
            rx={g.half * 0.78}
            ry={g.gap * 0.62}
            fill="#d4707d"
            opacity={params.backClosure * 0.92}
          />
        </G>
      ) : null}

      {/* top teeth */}
      {g.teethH > 1.5 ? (
        <Rect
          x={CX - g.teethW / 2}
          y={g.teethY}
          width={g.teethW}
          height={g.teethH}
          rx={2.5}
          fill="#fffdf6"
          stroke="#e6ded0"
          strokeWidth={0.6}
        />
      ) : null}

      {/* tongue tip between the teeth (th) */}
      {params.tongueBetweenTeeth > 0.02 ? (
        <Ellipse
          cx={CX}
          cy={(g.topInner + g.botInner) / 2 + 2}
          rx={17}
          ry={6.5}
          fill="#e8808f"
          opacity={params.tongueBetweenTeeth}
        />
      ) : null}

      {/* tongue raised behind the top teeth (t/d/n/l) */}
      {params.tongueUp > 0.02 ? (
        <Ellipse
          cx={CX}
          cy={g.botInner - g.gap * 0.28}
          rx={g.half * 0.45}
          ry={Math.max(4, g.gap * 0.3)}
          fill="#e8808f"
          opacity={params.tongueUp * 0.95}
        />
      ) : null}

      {/* lips */}
      <Path d={g.topLip} fill={`url(#lip-${uid})`} />
      <Path d={g.botLip} fill={`url(#lip-${uid})`} />

      {/* The seam where the lips press together. Only for a near-closed mouth — on an open one
          this line would run straight across the cavity. */}
      {g.gap < 9 ? (
        <Line
          x1={CX - g.half * 0.94}
          y1={CY}
          x2={CX + g.half * 0.94}
          y2={CY}
          stroke="rgba(110, 40, 50, 0.45)"
          strokeWidth={0.9}
          strokeLinecap="round"
          opacity={1 - g.gap / 9}
        />
      ) : null}

      {/* voicing indicator — pulsing throat dot */}
      {voiced ? <AnimatedCircle cx={CX} cy={138} fill="#7c5cff" r={radius} opacity={pulseOpacity} /> : null}
    </Svg>
  );
}

export default memo(MouthSvg);
