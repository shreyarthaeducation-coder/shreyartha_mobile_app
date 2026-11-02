import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Image, Text, View } from 'react-native';
import { SLATE, TYPE } from '../../../../constants/theme';
import { CAST_IMAGES } from '../../../../constants/shreyaSpeaking';
import { makeStyles } from '../../../../utils/makeStyles';

/**
 * One of the cast (1 Nov 2026): their portrait for the student's band — or their initial in their
 * colour until the pictures are in — with a name badge. While they speak the card lifts, a soft
 * ring in their own colour breathes around the portrait (2 Nov 2026, the website's glow), and a
 * bubble shows what they are saying. With the phone's Reduce Motion on, the ring stays still.
 */
export default function CharacterCard({ character, band, speaking, bubble }) {
  const styles = useStyles();
  const pulse = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

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

  useEffect(() => {
    if (!speaking || reduceMotion) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [speaking, reduceMotion, pulse]);

  const image = (CAST_IMAGES[band] || {})[character.key];
  const colour = character.colour;
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1.04, 1.07] });
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1.08, 1.22] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.15] });

  return (
    <View style={styles.card} accessibilityLabel={`${character.name}, ${character.role}`}>
      {bubble ? (
        <View style={[styles.bubble, { borderColor: colour }]}>
          <Text style={styles.bubbleText} numberOfLines={3}>
            {bubble}
          </Text>
        </View>
      ) : null}
      {speaking ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            { backgroundColor: colour },
            reduceMotion ? styles.ringStill : { opacity: ringOpacity, transform: [{ translateY: -4 }, { scale: ringScale }] },
          ]}
        />
      ) : null}
      <Animated.View
        style={[
          styles.portrait,
          { borderColor: colour },
          speaking && { transform: [{ translateY: -4 }, { scale: reduceMotion ? 1.04 : scale }] },
        ]}
      >
        {image ? (
          <Image source={image} style={styles.image} />
        ) : (
          <Text style={[styles.initial, { color: colour }]}>{character.name.charAt(0)}</Text>
        )}
      </Animated.View>
      <View style={[styles.badge, { backgroundColor: colour }]}>
        <Text style={styles.badgeText} numberOfLines={1}>
          {character.name}
        </Text>
      </View>
      <Text style={styles.role}>{character.role}</Text>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  card: { width: 64, alignItems: 'center' },
  // The glow: a disc in the character's colour behind the portrait, the same size, breathing out.
  ring: { position: 'absolute', top: 0, width: 56, height: 56, borderRadius: 28 },
  ringStill: { opacity: 0.3, transform: [{ translateY: -4 }, { scale: 1.14 }] },
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
  badge: { marginTop: 4, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, maxWidth: 64 },
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
