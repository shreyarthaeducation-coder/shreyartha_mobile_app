import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SPACING, TOUCH, TYPE, leading } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import useShreyaVoice from '../../../hooks/useShreyaVoice';
import { useLanguage } from '../../../context/LanguageContext';
import htmlToText from '../../../utils/htmlToText';
import { languageCodeOf } from '../../../utils/languageCode';

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
 * ── IT READS IN THE SELECTED LANGUAGE ────────────────────────────────────────
 * The text is translated through `/api/v1/translate/batch` (public, no token) before being spoken,
 * the way the web does it. Mobile shipped English-only at first; this is the step that was missing.
 * Only 12 of the 22 languages have a native Google voice — the rest are spoken by a Hindi voice,
 * which the server reports as `voiceFallback` and the notice below says out loud, because audio in
 * the wrong accent with no explanation reads as a bug.
 *
 * ── ONLY ONE CLIP AT A TIME ──────────────────────────────────────────────────
 * Guaranteed by `utils/audioController`, which `useShreyaVoice` registers with. With this button on
 * seven screens that is not optional — see that file's header.
 */

export default function ShreyaSpeakButton({
  text,
  label = 'Shreya Speak',
  compact = false,
  style,
  // Non-student panels pass services/shared/ttsClient; students leave it undefined.
  client,
  // The rest is for the Shreya chat-sheet header (components/staff/ShreyaChatSheet.js): a pill that
  // reads on the dark header, a disabled state while Shreya is typing or the user is dictating, and
  // `onMessage`, which hands errors and notices to the sheet instead of growing the header a line.
  variant = 'default',
  disabled = false,
  onMessage,
  accessibilityLabel = 'Read aloud',
}) {
  const styles = useStyles();
  const palette = usePalette();
  const onDark = variant === 'onDark';
  const { language, translateBatch } = useLanguage();
  // `language` is the context's OBJECT; /tts and /translate/batch take its code (utils/languageCode).
  const code = languageCodeOf(language);
  const voice = useShreyaVoice({ language: code, client });

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
      // Say it in the language the screen is being read in. `translateBatch` returns the original
      // strings unchanged for English and on any failure, so a translation outage degrades to
      // English audio rather than to silence.
      let spoken = plain;
      if (code !== 'en') {
        try {
          const [translated] = await translateBatch([plain], code);
          if (translated && translated.trim()) spoken = translated;
        } catch {
          // Fall through and speak the English — better than nothing coming out.
        }
      }
      // Resolves when the clip FINISHES, so the button returns to idle on its own.
      await speak(spoken);
    } finally {
      setLoading(false);
    }
    return undefined;
  }, [text, speaking, paused, speak, pause, resume, code, translateBatch]);

  const showStop = speaking || paused;
  // On the chat header the palette's `deep` is dark-on-dark — and Principal / Shreyartha Teacher
  // palettes do not define it at all, which renders React Native's default black.
  const iconColor = onDark ? '#ffffff' : palette.deep;

  // A failure that says nothing is what hid a 400 for a whole phase — see useShreyaVoice. With
  // `onMessage` the caller shows it; without, it renders under the button as it always has.
  const message = error || notice;
  useEffect(() => {
    if (onMessage) onMessage(message || '');
  }, [message, onMessage]);

  const icon = () => {
    if (loading) return <ActivityIndicator size="small" color={iconColor} />;
    if (speaking && !paused) return <Ionicons name="pause" size={19} color={iconColor} />;
    if (paused) return <Ionicons name="play" size={19} color={iconColor} />;
    // The chat header already shows Shreya's face beside the title; a speaker says what this does.
    if (onDark) return <Ionicons name="volume-high" size={18} color={iconColor} />;
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
          disabled={disabled}
          style={({ pressed }) => [
            styles.btn,
            compact && styles.btnCompact,
            onDark && styles.btnOnDark,
            disabled && styles.btnDisabled,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ selected: speaking && !paused, disabled }}
        >
          {icon()}
          {compact ? null : <Text style={[styles.label, onDark && styles.labelOnDark]}>{label}</Text>}
        </Pressable>

        {showStop ? (
          <Pressable
            onPress={stop}
            style={({ pressed }) => [styles.stop, onDark && styles.stopOnDark, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Stop reading aloud"
          >
            <Ionicons name="stop" size={16} color={onDark ? FEEDBACK.errorText : palette.deep} />
          </Pressable>
        ) : null}
      </View>

      {!onMessage && message ? <Text style={styles.notice}>{message}</Text> : null}
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
  // Translucent white: reads on every portal's headerBg without knowing which one it is.
  btnOnDark: { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.45)' },
  btnDisabled: { opacity: 0.5 },
  avatar: { width: 20, height: 20 },
  label: { fontSize: TYPE.label, fontWeight: '700', color: p.deep },
  labelOnDark: { color: '#ffffff' },
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
  stopOnDark: { backgroundColor: 'rgba(255,255,255,0.92)', borderColor: 'rgba(255,255,255,0.7)' },
  notice: { fontSize: TYPE.caption, color: FEEDBACK.errorText, lineHeight: leading(TYPE.caption), marginTop: 5 },
  pressed: { opacity: 0.75 },
}));
