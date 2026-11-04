import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Pressable, Text, View } from 'react-native';
import { SLATE, TYPE } from '../../../../constants/theme';
import { CAST_FACES, CAST_IMAGES } from '../../../../constants/shreyaSpeaking';
import { FACES } from '../../../../constants/shreyaFaceRects';
import useTalkingFace from '../../../../hooks/useTalkingFace';
import { makeStyles } from '../../../../utils/makeStyles';
import { MOUTHS } from '../../../../utils/shreyaVisemes';

/**
 * One of the cast (1 Nov 2026): their portrait for the student's band — or their initial in their
 * colour — with a name badge. The website's CharacterCard, alive the same way (3 Nov 2026):
 * - idle      — floats gently, every card a little out of step (`order`);
 * - tapped    — `onTap`: a hop, then the screen has them introduce themselves;
 * - speaking  — a soft ring in their colour breathes behind them, the portrait bobs, and sound bars
 *               rise and fall under it; a bubble shows what they say;
 * - listening — the student is reading their line: a dashed ring turns around them;
 * - cheering  — the line was read with no mistake: two jumps and a star.
 * With the phone's Reduce Motion on, nothing moves: the rings stand still instead.
 *
 * And they talk (4 Nov 2026), as on the website: while `talk` (the voice's player and the line's
 * word timing) plays, the portrait's mouth changes shape with the words, and every few seconds they
 * blink — small patches cut from Gemini edits of the same portrait (`CAST_FACES`), laid where
 * `constants/shreyaFaceRects` says. A talking face replaces the sound bars and the bob with a slow
 * nod; Reduce Motion keeps the mouth and the blink (they carry meaning, and barely move) and drops
 * the nod. A character with no patches keeps the still portrait.
 */
export default function CharacterCard({
  character,
  band,
  speaking = false,
  listening = false,
  cheering = false,
  bubble,
  order = 0,
  talk = null,
  onTap,
}) {
  const styles = useStyles();
  const { mouth, blinking } = useTalkingFace(talk);
  const [reduceMotion, setReduceMotion] = useState(false);
  const float = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const jump = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const star = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => live && setReduceMotion(!!on))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (on) => setReduceMotion(!!on));
    return () => {
      live = false;
      sub?.remove?.();
    };
  }, []);

  // Idle: a slow float, started a little later for each card so they are never in step.
  useEffect(() => {
    if (reduceMotion || speaking) {
      float.stopAnimation();
      float.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const start = setTimeout(() => loop.start(), order * 450);
    return () => {
      clearTimeout(start);
      loop.stop();
    };
  }, [reduceMotion, speaking, order, float]);

  // Speaking: the breathing ring, the bob and the sound bars all ride one pulse.
  useEffect(() => {
    if (!speaking || reduceMotion) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [speaking, reduceMotion, pulse]);

  // Listening: the dashed ring turns.
  useEffect(() => {
    if (!listening || reduceMotion) {
      spin.stopAnimation();
      spin.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [listening, reduceMotion, spin]);

  // Cheering: two jumps and a star that pops in.
  useEffect(() => {
    if (!cheering) {
      star.setValue(0);
      return undefined;
    }
    if (reduceMotion) {
      star.setValue(1);
      return undefined;
    }
    const hopOnce = Animated.sequence([
      Animated.timing(jump, { toValue: 1, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(jump, { toValue: 0, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]);
    const run = Animated.parallel([
      Animated.sequence([hopOnce, hopOnce]),
      Animated.spring(star, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]);
    run.start();
    return () => run.stop();
  }, [cheering, reduceMotion, jump, star]);

  const tap = () => {
    if (!onTap) return;
    if (!reduceMotion) {
      Animated.sequence([
        Animated.timing(jump, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(jump, { toValue: 0, friction: 4, useNativeDriver: true }),
      ]).start();
    }
    onTap(character);
  };

  const image = (CAST_IMAGES[band] || {})[character.key];
  const sheets = (CAST_FACES[band] || {})[character.key];
  const rects = FACES[String(band || '').toLowerCase()]?.[character.key.toLowerCase()];
  const face = image && sheets && rects ? { sheets, rects } : null;
  const colour = character.colour;
  const lift = Animated.add(
    float.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }),
    jump.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }),
  );
  const bob = pulse.interpolate({ inputRange: [0, 1], outputRange: [1.03, 1.07] });
  const nod = pulse.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '2deg'] });
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1.08, 1.22] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.15] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const label = `${character.name}, ${character.role}${speaking ? ', speaking' : listening ? ', listening' : ''}`;

  const portrait = (
    <Animated.View style={[styles.holder, { transform: [{ translateY: lift }] }]}>
      {speaking ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glow,
            { backgroundColor: colour },
            reduceMotion ? styles.glowStill : { opacity: ringOpacity, transform: [{ scale: ringScale }] },
          ]}
        />
      ) : null}
      {listening && !speaking ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.listen, { borderColor: colour }, !reduceMotion && { transform: [{ rotate }] }]}
        />
      ) : null}
      <Animated.View
        style={[
          styles.portrait,
          { borderColor: colour },
          speaking && {
            transform: reduceMotion ? [{ scale: 1.04 }] : face ? [{ scale: 1.04 }, { rotate: nod }] : [{ scale: bob }],
          },
        ]}
      >
        {image ? (
          <Image source={image} style={styles.image} />
        ) : (
          <Text style={[styles.initial, { color: colour }]}>{character.name.charAt(0)}</Text>
        )}
        {face ? (
          <>
            <Patch rect={face.rects.mouth} size={face.rects.size} source={face.sheets.mouth} cells={MOUTHS.length} cell={mouth ? MOUTHS.indexOf(mouth) : -1} />
            <Patch rect={face.rects.eyes} size={face.rects.size} source={face.sheets.blink} cells={1} cell={blinking ? 0 : -1} />
          </>
        ) : null}
      </Animated.View>
      {cheering ? (
        <Animated.Text style={[styles.star, { transform: [{ scale: star }] }]} accessible={false}>
          ⭐
        </Animated.Text>
      ) : null}
    </Animated.View>
  );

  return (
    <View style={styles.card} accessibilityLabel={label}>
      {bubble ? (
        <View style={[styles.bubble, { borderColor: colour }]}>
          <Text style={styles.bubbleText} numberOfLines={3}>
            {bubble}
          </Text>
        </View>
      ) : null}
      {onTap ? (
        <Pressable onPress={tap} accessibilityRole="button" accessibilityLabel={`Say hello to ${character.name}`} hitSlop={6}>
          {portrait}
        </Pressable>
      ) : (
        portrait
      )}
      <View style={styles.wave} accessible={false}>
        {[0, 1, 2, 3].map((i) => (
          <Animated.View
            key={i}
            style={[
              styles.bar,
              { backgroundColor: colour, opacity: speaking && !face ? 1 : 0 },
              speaking && !reduceMotion && {
                transform: [
                  {
                    scaleY: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: i % 2 === 0 ? [0.4, 1] : [1, 0.4],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>
      <View style={[styles.badge, { backgroundColor: colour }]}>
        <Text style={styles.badgeText} numberOfLines={1}>
          {character.name}
        </Text>
      </View>
      <Text style={styles.role}>{character.role}</Text>
    </View>
  );
}

/**
 * One face patch over the portrait: a window at `rect` (in the portrait's own pixels, placed in
 * percent so it fits any card size) onto cell `cell` of a sheet `cells` wide; -1 hides it.
 */
function Patch({ rect, size, source, cells, cell }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: `${(rect.x / size) * 100}%`,
        top: `${(rect.y / size) * 100}%`,
        width: `${(rect.w / size) * 100}%`,
        height: `${(rect.h / size) * 100}%`,
        overflow: 'hidden',
        opacity: cell >= 0 ? 1 : 0,
      }}
    >
      <Image
        source={source}
        style={{ position: 'absolute', top: 0, height: '100%', width: `${cells * 100}%`, left: `${-Math.max(0, cell) * 100}%` }}
      />
    </View>
  );
}

const useStyles = makeStyles(() => ({
  card: { width: 64, alignItems: 'center' },
  holder: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  // Speaking: a disc in the character's colour behind the portrait, breathing out.
  glow: { position: 'absolute', width: 56, height: 56, borderRadius: 28 },
  glowStill: { opacity: 0.3, transform: [{ scale: 1.14 }] },
  // Listening: a dashed ring just outside the portrait.
  listen: {
    position: 'absolute',
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  portrait: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  image: { width: '100%', height: '100%' },
  initial: { fontSize: TYPE.title, fontWeight: '800' },
  star: { position: 'absolute', top: -8, right: -6, fontSize: TYPE.heading },
  wave: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 10, marginTop: 3 },
  bar: { width: 3, height: 10, borderRadius: 2 },
  badge: { marginTop: 2, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, maxWidth: 64 },
  badgeText: { fontSize: TYPE.micro, fontWeight: '700', color: '#ffffff' },
  role: { fontSize: TYPE.micro, color: SLATE[500] },
  bubble: {
    position: 'absolute',
    bottom: '100%',
    width: 120,
    marginBottom: 2,
    padding: 6,
    borderRadius: 10,
    borderWidth: 2,
    backgroundColor: '#ffffff',
    zIndex: 2,
  },
  bubbleText: { fontSize: TYPE.caption, color: SLATE[700] },
}));
