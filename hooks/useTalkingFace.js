import { useEffect, useMemo, useRef, useState } from 'react';
import { flapAt, shapeAt, timeline } from '../utils/shreyaVisemes';

/**
 * A character's face, alive (4 Nov 2026) — the website's useTalkingFace for the phone: which mouth
 * shape to show while they speak, and when they blink.
 *
 * `talk` is what their voice is playing, `{audio, timing}`: `audio` is the expo-audio player
 * (`useShreyaVoice` hands it over as the clip starts), and the mouth follows ITS clock
 * (`currentTime`, `playing`), so it stays with the words even if playback stalls. With no timing
 * it flaps in a speech-like rhythm instead. Between lines it is null: the portrait as drawn. A
 * blink comes every 3–6 s, speaking or not.
 */
export default function useTalkingFace(talk) {
  const player = talk?.audio || null;
  const timing = talk?.timing;
  const [mouth, setMouth] = useState(null);
  const [blinking, setBlinking] = useState(false);
  const line = useMemo(() => (timing && timing.length ? timeline(timing) : null), [timing]);
  const shown = useRef(null);

  useEffect(() => {
    const show = (shape) => {
      if (shown.current !== shape) {
        shown.current = shape;
        setMouth(shape);
      }
    };
    if (!player) {
      show(null);
      return undefined;
    }
    let frame;
    const tick = () => {
      let t = 0;
      let playing = false;
      // A player removed under us (the clip was stopped) throws on access: the mouth rests.
      try {
        t = player.currentTime || 0;
        playing = !!player.playing;
      } catch (gone) {
        void gone;
      }
      if (!playing) show(null);
      else show(line ? shapeAt(line, t) : flapAt(t));
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
      show(null);
    };
  }, [player, line]);

  useEffect(() => {
    let wait;
    let open;
    const next = () => {
      wait = setTimeout(() => {
        setBlinking(true);
        open = setTimeout(() => {
          setBlinking(false);
          next();
        }, 140);
      }, 3000 + Math.random() * 3000);
    };
    next();
    return () => {
      clearTimeout(wait);
      clearTimeout(open);
    };
  }, []);

  return { mouth, blinking };
}
