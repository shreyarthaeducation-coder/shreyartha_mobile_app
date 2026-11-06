import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FEEDBACK, SLATE, SPACING, TOUCH, TYPE, leading } from '../../../../constants/theme';
import { makeStyles } from '../../../../utils/makeStyles';
import useShreyaVoice from '../../../../hooks/useShreyaVoice';
import { usePalette } from '../../../ui/PaletteContext';
import { shreyaEnglish } from '../../../../services/student/languageProService';
import { Select } from '../../../ui';
import { StudentCard } from '../../StudentCard';

/** Where the student's last "My language" is kept (2 Nov 2026) — the same key as the website. */
export const MEANING_LANG_KEY = 'lws.meaningLang';

/**
 * The passage in the student's own language (1 Nov 2026) — to understand what it means. They still
 * speak it in English, which the panel says.
 *
 * The language they last chose is remembered (2 Nov 2026) and, when this chapter offers it, the
 * passage opens already translated. An answer that arrives after a newer choice is dropped rather
 * than shown; storage that fails only means the choice is not remembered.
 */
export default function TranslationPanel({ data }) {
  const styles = useStyles();
  const palette = usePalette();
  const [lang, setLang] = useState('');
  const [lines, setLines] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const latest = useRef(0);
  // Read aloud (6 Nov 2026): the translated lines in the chosen language's voice — the website's
  // speaker. `playing` is the line being said; `run` is bumped by every stop, so a stopped reading
  // never carries on to the next line.
  const voice = useShreyaVoice({ language: lang || 'en' });
  const stopRef = useRef(voice.stop);
  stopRef.current = voice.stop;
  const [playing, setPlaying] = useState(null);
  const run = useRef(0);

  const stopReading = () => {
    run.current += 1;
    stopRef.current();
    setPlaying(null);
  };

  /** Says the lines from `from` on (or only that one with `only`), one after another. */
  const readAloud = async (from, only = false) => {
    const ticket = ++run.current;
    stopRef.current();
    const list = lines || [];
    for (let i = from; i < list.length; i += 1) {
      if (ticket !== run.current) return;
      setPlaying(list[i].index);
      try {
        await voice.speak(list[i].text);
      } catch {
        // A line the voice service would not say is skipped, not the end of the reading.
      }
      if (only) break;
    }
    if (ticket === run.current) setPlaying(null);
  };

  // Another language, another chapter or leaving the tab ends the reading.
  useEffect(
    () => () => {
      run.current += 1;
      stopRef.current();
    },
    [lang, data.chapterId],
  );

  const translate = async (code) => {
    const ticket = ++latest.current;
    setLang(code);
    setLines(null);
    setError('');
    if (!code) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await shreyaEnglish.translation(data.chapterId, code);
      if (ticket === latest.current) setLines(res?.lines || []);
    } catch (e) {
      if (ticket === latest.current) setError(e?.message || 'Could not translate the passage.');
    } finally {
      if (ticket === latest.current) setLoading(false);
    }
  };

  const choose = (code) => {
    (code ? AsyncStorage.setItem(MEANING_LANG_KEY, code) : AsyncStorage.removeItem(MEANING_LANG_KEY)).catch(() => {});
    translate(code);
  };

  // The remembered language, when this chapter offers it — once, as the panel opens.
  const languages = data.languages;
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(MEANING_LANG_KEY)
      .then((saved) => {
        if (live && saved && latest.current === 0 && (languages || []).some((l) => l.code === saved)) {
          translate(saved);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
    // `translate` reads this render's chapter; the panel remounts for another chapter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.chapterId, languages]);

  const options = (data.languages || []).map((l) => ({ value: l.code, label: `${l.name} (${l.nativeName})` }));

  return (
    <StudentCard>
      <Text style={styles.note}>
        Read the meaning in your language — then speak the passage in <Text style={styles.strong}>English</Text>.
      </Text>
      <Select label="My language" value={lang} options={options} onChange={choose} placeholder="Choose…" searchable />
      {loading ? <ActivityIndicator style={styles.loading} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {lines && lines.length ? (
        <Pressable
          onPress={() => (playing === null ? readAloud(0) : stopReading())}
          style={({ pressed }) => [
            styles.listen,
            { backgroundColor: playing === null ? palette.primary : FEEDBACK.errorText },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={playing === null ? 'Listen to the whole passage' : 'Stop'}
        >
          <Ionicons name={playing === null ? 'volume-high' : 'stop'} size={18} color="#fff" />
          <Text style={styles.listenText}>{playing === null ? 'Listen to the whole passage' : 'Stop'}</Text>
        </Pressable>
      ) : null}
      {lines
        ? lines.map((l, i) => (
            <View key={l.index} style={[styles.line, playing === l.index && { backgroundColor: palette.tint }]}>
              <View style={styles.lineText}>
                <Text style={styles.translated}>
                  <Text style={styles.strong}>{l.speaker}:</Text> {l.text}
                </Text>
                <Text style={styles.english}>{data.lines?.[l.index]?.text}</Text>
              </View>
              <Pressable
                onPress={() => (playing === l.index ? stopReading() : readAloud(i, true))}
                style={({ pressed }) => [styles.say, pressed && styles.pressed]}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Listen to ${l.speaker}'s line`}
              >
                <Ionicons name={playing === l.index ? 'stop' : 'volume-medium-outline'} size={20} color={palette.primaryDark} />
              </Pressable>
            </View>
          ))
        : null}
      {voice.error ? <Text style={styles.error}>{voice.error}</Text> : null}
    </StudentCard>
  );
}

const useStyles = makeStyles(() => ({
  note: { fontSize: TYPE.body, color: SLATE[600], lineHeight: leading(TYPE.body), marginBottom: SPACING.sm },
  strong: { fontWeight: '700', color: SLATE[800] },
  loading: { marginTop: SPACING.md },
  error: { marginTop: SPACING.sm, fontSize: TYPE.label, color: FEEDBACK.errorText },
  line: { marginTop: SPACING.sm, flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, padding: SPACING.xs, borderRadius: 10 },
  lineText: { flex: 1 },
  say: {
    width: TOUCH.min,
    height: TOUCH.min,
    borderRadius: TOUCH.min / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLATE[50],
    borderWidth: 1,
    borderColor: SLATE[200],
  },
  listen: {
    marginTop: SPACING.md,
    minHeight: TOUCH.min,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  listenText: { color: '#fff', fontWeight: '700', fontSize: TYPE.label },
  pressed: { opacity: 0.8 },
  translated: { fontSize: TYPE.body, color: SLATE[800], lineHeight: leading(TYPE.body) },
  english: { marginTop: 2, fontSize: TYPE.caption, color: SLATE[500], lineHeight: leading(TYPE.caption) },
}));
