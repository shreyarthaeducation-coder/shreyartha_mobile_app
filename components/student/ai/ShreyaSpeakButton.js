import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SPACING, TOUCH, TYPE } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import useShreyaVoice from '../../../hooks/useShreyaVoice';
import htmlToText from '../../../utils/htmlToText';

/**
 * "Shreya Speak" — read this content aloud.
 *
 * Port of `frontendmain/src/student/components/ReadAloudButton/ReadAloudButton.js`.
 *
 * ── THE STATE MACHINE ────────────────────────────────────────────────────────
 * idle → (tap) → loading → playing ⇄ paused, with a separate ■ stop while playing or paused.
 * The web has a fifth `error` state that renders identically to idle and re-enters the full path on
 * the next tap, so it is folded into idle here and the message shown alongside instead.
 *
 * ── WHAT IS DELIBERATELY NOT PORTED ──────────────────────────────────────────
 * The web's `disabled={activeLanguageConfig?.ttsSupported === false}` branch is **dead code in
 * production**: `TranslateController.languages()` builds a `LanguageDto` that has no `ttsSupported`
 * field at all, so the value is always `undefined` and the strict `=== false` never fires. Porting
 * it would add a disabled state that can never be reached. (What really happens for the 11 Indian
 * languages without a native Google voice is that TTS falls back to a Hindi voice.)
 *
 * Also not ported yet: the web translates the text into the student's selected UI language before
 * synthesising. Mobile reads in **English** for now — a deliberate, user-approved staging, because
 * mobile's LanguageContext exposes only `translateBatch` and the TTS spine is proven at `en`.
 *
 * ── ONLY ONE CLIP AT A TIME ──────────────────────────────────────────────────
 * Guaranteed by `utils/audioController`, which `useShreyaVoice` registers with. With this button on
 * seven screens that is not optional — see that file's header.
 */

export default function ShreyaSpeakButton({ text, label = 'Shreya Speak', compact = false, style }) {
  const styles = useStyles();
  const palette = usePalette();
  const voice = useShreyaVoice();

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');

  const { speak, stop, pause, resume, speaking, paused, error } = voice;

  const onPress = useCallback(async () => {
    setNotice('');

    if (speaking && !paused) return pause();
    if (paused) return resume();

    const plain = htmlToText(text);
    if (!plain) {
      // The web's exact behaviour: say so and stay idle, rather than appearing to do nothing.
      setNotice('Nothing to read here right now.');
      return undefined;
    }

    setLoading(true);
    try {
      // Resolves when the clip FINISHES, so the button returns to idle on its own.
      await speak(plain);
    } finally {
      setLoading(false);
    }
    return undefined;
  }, [text, speaking, paused, speak, pause, resume]);

  const showStop = speaking || paused;

  const icon = () => {
    if (loading) return <ActivityIndicator size="small" color={palette.deep} />;
    if (speaking && !paused) return <Ionicons name="pause" size={17} color={palette.deep} />;
    if (paused) return <Ionicons name="play" size={17} color={palette.deep} />;
    return (
      <Image
        source={require('../../../assets/images/Chatbot.png')}
        style={styles.avatar}
        resizeMode="contain"
      />
    );
  };

  return (
    <View style={style}>
      <View style={styles.row}>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.btn,
            compact && styles.btnCompact,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Read aloud"
          accessibilityState={{ selected: speaking && !paused }}
        >
          {icon()}
          {compact ? null : <Text style={styles.label}>{label}</Text>}
        </Pressable>

        {showStop ? (
          <Pressable
            onPress={stop}
            style={({ pressed }) => [styles.stop, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Stop reading aloud"
          >
            <Ionicons name="stop" size={14} color={palette.deep} />
          </Pressable>
        ) : null}
      </View>

      {/* A failure that says nothing is what hid a 400 for a whole phase — see useShreyaVoice. */}
      {error || notice ? <Text style={styles.notice}>{error || notice}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((p) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: p.tint,
    borderWidth: 1,
    borderColor: p.primary,
    minHeight: TOUCH.min,
  },
  btnCompact: { paddingHorizontal: 10 },
  avatar: { width: 20, height: 20 },
  label: { fontSize: TYPE.label, fontWeight: '700', color: p.deep },
  stop: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: p.tint,
    borderWidth: 1,
    borderColor: p.primary,
  },
  notice: { fontSize: TYPE.caption, color: FEEDBACK.errorText, lineHeight: 17, marginTop: 5 },
  pressed: { opacity: 0.75 },
}));
