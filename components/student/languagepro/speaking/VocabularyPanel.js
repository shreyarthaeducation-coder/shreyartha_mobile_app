import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE, leading } from '../../../../constants/theme';
import { CATEGORY_STYLE } from '../../../../constants/shreyaSpeaking';
import { makeStyles } from '../../../../utils/makeStyles';
import { StudentCard } from '../../StudentCard';

/**
 * The passage's important words (1 Nov 2026), in their categories' colours — the same colours as
 * the website and the admin's preview. Tapping one has Sonia say it.
 */
export default function VocabularyPanel({ data, say }) {
  const styles = useStyles();
  const words = data.vocabulary || [];
  if (!words.length) {
    return (
      <StudentCard>
        <Text style={styles.body}>This chapter&apos;s words aren&apos;t ready yet.</Text>
      </StudentCard>
    );
  }
  const used = Object.keys(CATEGORY_STYLE).filter((k) => words.some((w) => w.category === k));

  return (
    <StudentCard>
      <View style={styles.key} accessibilityLabel="Colour key">
        {used.map((k) => (
          <View key={k} style={[styles.keyChip, { borderColor: CATEGORY_STYLE[k].colour }]}>
            <Text style={[styles.keyText, { color: CATEGORY_STYLE[k].colour }]}>{CATEGORY_STYLE[k].label}</Text>
          </View>
        ))}
      </View>
      {words.map((w) => {
        const style = CATEGORY_STYLE[w.category] || CATEGORY_STYLE.NEW_WORD;
        return (
          <View key={w.word} style={styles.row}>
            <Pressable
              onPress={() => say(w.word, 'SONIA')}
              style={({ pressed }) => [styles.word, { backgroundColor: style.colour }, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`${w.word}, ${style.label}. Hear it`}
            >
              <Ionicons name="volume-high" size={16} color="#ffffff" />
              <Text style={styles.wordText}>{w.word}</Text>
            </Pressable>
            {w.meaning ? <Text style={styles.meaning}>{w.meaning}</Text> : null}
          </View>
        );
      })}
    </StudentCard>
  );
}

const useStyles = makeStyles(() => ({
  body: { fontSize: TYPE.body, color: SLATE[600], lineHeight: leading(TYPE.body) },
  key: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  keyChip: { borderWidth: 2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  keyText: { fontSize: TYPE.caption, fontWeight: '700' },
  row: { marginBottom: SPACING.md },
  word: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  wordText: { fontSize: TYPE.heading, fontWeight: '700', color: '#ffffff' },
  meaning: { marginTop: 4, fontSize: TYPE.label, color: SLATE[600], lineHeight: leading(TYPE.label) },
  pressed: { opacity: 0.78 },
}));
