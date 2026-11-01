import { useEffect, useRef } from 'react';
import { Animated, Image, Text, View } from 'react-native';
import { SLATE, TYPE } from '../../../../constants/theme';
import { CAST_IMAGES } from '../../../../constants/shreyaSpeaking';
import { makeStyles } from '../../../../utils/makeStyles';

/**
 * One of the cast (1 Nov 2026): their portrait for the student's band — or their initial in their
 * colour until the pictures are in — with a name badge. While they speak the card lifts and pulses
 * and a bubble shows what they are saying.
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
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [speaking, pulse]);

  const image = (CAST_IMAGES[band] || {})[character.key];
  const colour = character.colour;
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1.04, 1.1] });

  return (
    <View style={styles.card} accessibilityLabel={`${character.name}, ${character.role}`}>
      {bubble ? (
        <View style={[styles.bubble, { borderColor: colour }]}>
          <Text style={styles.bubbleText} numberOfLines={3}>
            {bubble}
          </Text>
        </View>
      ) : null}
      <Animated.View
        style={[
          styles.portrait,
          { borderColor: colour },
          speaking && { transform: [{ translateY: -4 }, { scale }] },
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
