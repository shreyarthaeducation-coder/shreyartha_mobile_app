import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { FEEDBACK, SLATE, SPACING, TYPE, leading } from '../../../constants/theme';
import { makeStyles } from '../../../utils/makeStyles';
import useShreyaVoice from '../../../hooks/useShreyaVoice';
import { useLanguage } from '../../../context/LanguageContext';
import ttsClient from '../../../services/shared/ttsClient';

/**
 * "Tap anything to hear it" — choosing what gets read aloud, on a phone.
 *
 * ── THE PROBLEM THIS SOLVES ─────────────────────────────────────────────────
 * Read-aloud used to speak a whole screen: one long recital a parent had to sit through to reach
 * the one line they wanted. On the website they can now highlight the words they care about, but a
 * phone has no comfortable text selection across cards, so the same idea takes a different shape
 * here: press Shreya Speak once to turn the mode ON, then tap any card to hear just that card.
 *
 * ── HOW A CARD BECOMES TAPPABLE ─────────────────────────────────────────────
 * By wrapping itself in `<Readable text="…">`. Outside the mode a Readable is invisible and inert —
 * it renders its children and nothing else — so a screen that adopts it looks and behaves exactly
 * as before until the parent turns listening on. There is no DOM to scrape on React Native, so
 * each Readable states its own words; that is the cost of the feature and the reason it is opt-in
 * per card rather than magic.
 *
 * Nested Readables are fine: React Native delivers the press to the innermost one, which is the
 * more specific text and therefore the better answer.
 */

const ReadAloudModeContext = createContext(null);

/** Safe to call outside a provider — returns an inactive mode rather than throwing. */
export function useReadAloudMode() {
  return useContext(ReadAloudModeContext) || { active: false, speaking: false };
}

export function ReadAloudModeProvider({ children }) {
  const [active, setActive] = useState(false);
  const { language } = useLanguage();
  const { translateBatch } = useLanguage();
  // The neutral client, not studentApi: this runs in the parent and partner panels, whose tokens
  // studentApi does not read and whose session it would end on a 403.
  const voice = useShreyaVoice({ language, client: ttsClient });

  const speak = useCallback(
    async (text) => {
      const plain = String(text || '').trim();
      if (!plain) return;
      let spoken = plain;
      if (language && language !== 'en') {
        try {
          const [translated] = await translateBatch([plain], language);
          if (translated && translated.trim()) spoken = translated;
        } catch {
          // Speak the English rather than nothing.
        }
      }
      await voice.speak(spoken);
    },
    [language, translateBatch, voice],
  );

  const value = useMemo(
    () => ({
      active,
      speaking: voice.speaking,
      error: voice.error,
      toggle: () => {
        setActive((on) => {
          // Leaving the mode stops whatever is mid-sentence; staying in it does not.
          if (on) voice.stop();
          return !on;
        });
      },
      stop: voice.stop,
      speak,
    }),
    [active, voice, speak],
  );

  return (
    <ReadAloudModeContext.Provider value={value}>{children}</ReadAloudModeContext.Provider>
  );
}

/**
 * One tappable block of speech.
 *
 * @param text     what this block says, assembled by the screen
 * @param children what it shows
 */
export function Readable({ text, children, style }) {
  const styles = useStyles();
  const mode = useReadAloudMode();

  if (!mode.active || !String(text || '').trim()) {
    return children;
  }

  return (
    <Pressable
      onPress={() => mode.speak(text)}
      style={({ pressed }) => [styles.target, pressed && styles.targetPressed, style]}
      accessibilityRole="button"
      accessibilityLabel={`Read aloud: ${String(text).slice(0, 60)}`}
    >
      {children}
    </Pressable>
  );
}

/** The strip that says the mode is on, and how to leave it. */
export function ReadAloudBanner() {
  const styles = useStyles();
  const mode = useReadAloudMode();
  if (!mode.active) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>
        {mode.speaking ? 'Reading aloud…' : 'Tap anything on this screen to hear it'}
      </Text>
      <Pressable
        onPress={mode.toggle}
        style={({ pressed }) => [styles.bannerBtn, pressed && styles.targetPressed]}
        accessibilityRole="button"
      >
        <Text style={styles.bannerBtnText}>Done</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((p) => ({
  // A dashed outline, not a colour wash: it has to read as "tap me" over cards of every colour,
  // and it must not hide the content underneath it.
  target: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: p.primary,
    borderRadius: 14,
    marginBottom: SPACING.xs,
  },
  targetPressed: { opacity: 0.75 },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    backgroundColor: p.tint,
    borderRadius: 12,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  bannerText: {
    flex: 1,
    fontSize: TYPE.label,
    fontWeight: '700',
    color: p.deep,
    lineHeight: leading(TYPE.label),
  },
  bannerBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: p.primary,
  },
  bannerBtnText: { fontSize: TYPE.label, fontWeight: '800', color: p.onPrimary },
  error: { fontSize: TYPE.caption, color: FEEDBACK.errorText, marginBottom: SPACING.xs },
  muted: { color: SLATE[500] },
}));
