import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Text, View } from 'react-native';
import { SLATE, TYPE } from '../../../../constants/theme';
import { CAST_IMAGES } from '../../../../constants/shreyaSpeaking';
import { makeStyles } from '../../../../utils/makeStyles';

/**
 * One of the cast (1 Nov 2026): their portrait for the student's band — or their initial in their
 * colour until the pictures are in — with a name badge. While they speak the card lifts and
 * breathes, a soft ring in their colour swells behind the portrait (2 Nov 2026, as the website's
 * glow), and a bubble shows what they are saying.
 *
 * One loop drives both, on the native driver. It is stopped and reset the moment they stop speaking
 * and when the card goes away, so no loop outlives its character.
 */
export default function CharacterCard({ character, band, speaking, bubble }) {
  const styles = useStyles();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!speaking) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return undefined;
    }
    const breathe = { duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true };
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, ...breathe }),
        Animated.timing(pulse, { toValue: 0, ...breathe }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(0);
    };
  }, [speaking, pulse]);

  const image = (CAST_IMAGES[band] || {})[character.key];
  const colour = character.colour;
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1.03, 1.07] });
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1.08, 1.32] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.12] });

  return (
    <View style={styles.card} accessibilityLabel={`${character.name}, ${character.role}`}>
      {bubble ? (
        <View style={[styles.bubble, { borderColor: colour }]}>
          <Text style={styles.bubbleText} numberOfLines={3}>
            {bubble}
          </Text>
        </View>
      ) : null}
      <Animated.View style={[styles.portraitWrap, speaking && { transform: [{ translateY: -4 }, { scale }] }]}>
        {speaking ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.ring, { backgroundColor: colour, opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
          />
        ) : null}
        <View style={[styles.portrait, { borderColor: colour }]}>
          {image ? (
            <Image source={image} style={styles.image} />
          ) : (
            <Text style={[styles.initial, { color: colour }]}>{character.name.charAt(0)}</Text>
          )}
        </View>
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
  // The portrait's own size, so the ring behind it changes nothing around the card.
  portraitWrap: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 56, height: 56, borderRadius: 28 },
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
