import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FEEDBACK, SLATE, SPACING, TYPE, leading } from '../../../../constants/theme';
import { makeStyles } from '../../../../utils/makeStyles';
import { shreyaEnglish } from '../../../../services/student/languageProService';
import { Select } from '../../../ui';
import { StudentCard } from '../../StudentCard';

/** Where the student's last "My language" is kept (2 Nov 2026) — the same key as the website. */
export const MEANING_LANG_KEY = 'lws.meaningLang';

/**
 * The passage in the student's own language (1 Nov 2026) — to understand what it means. They still
 * speak it in English, which the panel says.
 *
 * The language they last chose is remembered (2 Nov 2026). Storage is read once per chapter, and
 * only when it answers — never before — is the passage translated, if the chapter offers that
 * language. A choice the student makes while storage is still answering wins, and a translation
 * that comes back after a newer one was asked for is dropped.
 */
export default function TranslationPanel({ data }) {
  const styles = useStyles();
  const [lang, setLang] = useState('');
  const [lines, setLines] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const latest = useRef(0);
  const restoredFor = useRef(null);
  const choseFor = useRef(null); // the chapter the student last picked a language on

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
    choseFor.current = data.chapterId;
    (code ? AsyncStorage.setItem(MEANING_LANG_KEY, code) : AsyncStorage.removeItem(MEANING_LANG_KEY)).catch(() => {
      // Not remembered this time; the translation itself still works.
    });
    translate(code);
  };

  // The remembered language, once per chapter, when this chapter offers it.
  const chapterId = data.chapterId;
  const languages = data.languages;
  useEffect(() => {
    if (!chapterId || !(languages || []).length || restoredFor.current === chapterId) return undefined;
    const previous = restoredFor.current;
    restoredFor.current = chapterId;
    let alive = true;
    AsyncStorage.getItem(MEANING_LANG_KEY)
      .then((saved) => {
        if (!alive || choseFor.current === chapterId) return;
        if (saved && languages.some((l) => l.code === saved)) translate(saved);
        // A new chapter without that language: not the last chapter's translation left showing.
        else if (previous !== null) translate('');
      })
      .catch(() => {
        // Nothing remembered to restore; the panel works as before.
      });
    return () => {
      alive = false;
    };
    // `translate` reads this render's chapter; re-running for its identity would translate twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, languages]);

  const options = (data.languages || []).map((l) => ({ value: l.code, label: `${l.name} (${l.nativeName})` }));

  return (
    <StudentCard>
      <Text style={styles.note}>
        Read the meaning in your language — then speak the passage in <Text style={styles.strong}>English</Text>.
      </Text>
      <Select label="My language" value={lang} options={options} onChange={choose} placeholder="Choose…" searchable />
      {loading ? <ActivityIndicator style={styles.loading} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {lines
        ? lines.map((l) => (
            <View key={l.index} style={styles.line}>
              <Text style={styles.translated}>
                <Text style={styles.strong}>{l.speaker}:</Text> {l.text}
              </Text>
              <Text style={styles.english}>{data.lines?.[l.index]?.text}</Text>
            </View>
          ))
        : null}
    </StudentCard>
  );
}

const useStyles = makeStyles(() => ({
  note: { fontSize: TYPE.body, color: SLATE[600], lineHeight: leading(TYPE.body), marginBottom: SPACING.sm },
  strong: { fontWeight: '700', color: SLATE[800] },
  loading: { marginTop: SPACING.md },
  error: { marginTop: SPACING.sm, fontSize: TYPE.label, color: FEEDBACK.errorText },
  line: { marginTop: SPACING.md },
  translated: { fontSize: TYPE.body, color: SLATE[800], lineHeight: leading(TYPE.body) },
  english: { marginTop: 2, fontSize: TYPE.caption, color: SLATE[500], lineHeight: leading(TYPE.caption) },
}));
