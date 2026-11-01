import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { FEEDBACK, SLATE, SPACING, TYPE, leading } from '../../../../constants/theme';
import { makeStyles } from '../../../../utils/makeStyles';
import { shreyaEnglish } from '../../../../services/student/languageProService';
import { Select } from '../../../ui';
import { StudentCard } from '../../StudentCard';

/**
 * The passage in the student's own language (1 Nov 2026) — to understand what it means. They still
 * speak it in English, which the panel says.
 */
export default function TranslationPanel({ data }) {
  const styles = useStyles();
  const [lang, setLang] = useState('');
  const [lines, setLines] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const choose = async (code) => {
    setLang(code);
    setLines(null);
    setError('');
    if (!code) return;
    setLoading(true);
    try {
      const res = await shreyaEnglish.translation(data.chapterId, code);
      setLines(res?.lines || []);
    } catch (e) {
      setError(e?.message || 'Could not translate the passage.');
    } finally {
      setLoading(false);
    }
  };

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
