import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { useToast } from '../../ui';
import StudentScaffold from '../StudentScaffold';
import SoundStudioTutorial, { useSoundStudioTutorial } from './SoundStudioTutorial';
import { StudentCard, StudentCardTitle } from '../StudentCard';
import PhonemeDetailPanel from './PhonemeDetailPanel';
import {
  CONSONANTS,
  DIPHTHONGS,
  VOWELS,
  findById,
} from '../../../constants/phonemeCatalog';

/**
 * Sound Studio — the interactive IPA chart for the sounds of English.
 *
 * **Open to every student at any level, by design.** On the web it is entered from a banner that
 * sits *outside* the level list in the Learn with Shreya map, specifically so it reads no
 * `unlocked` flag and cannot be level-gated. Keep it that way: this screen must never consult
 * `useStudentAccess`, and it must not appear on the Language Pro landing page.
 *
 * The grid is the IPA chart made student-friendly: **rows are how the sound is made, columns are
 * where**. Those keys must match the catalogue's `manner`/`place`/`gridPos` values exactly — a
 * mismatch means a sound silently never appears, which is why `checkphonemes.mjs` asserts every
 * entry carries coordinates this chart knows.
 */

/** Chart axes, verbatim from the web — the keys index into the catalogue. */
const MANNERS = [
  ['stop', 'Stop sounds', 'The air stops completely, then pops out'],
  ['nasal', 'Nose sounds', 'The air goes out through your nose'],
  ['fricative', 'Hissing sounds', 'The air squeezes through a narrow gap'],
  ['affricate', 'Combo sounds', 'A stop that releases into a hiss'],
  ['approximant', 'Flowing sounds', 'The air flows freely, no blocking'],
];
const PLACES = [
  ['lips', 'Lips'],
  ['teeth', 'Teeth'],
  ['ridge', 'Behind teeth'],
  ['back', 'Back of mouth'],
];
const VOWEL_ROWS = [
  ['high', 'Tongue high'],
  ['mid', 'Tongue middle'],
  ['low', 'Tongue low'],
];
const VOWEL_COLS = [
  ['front', 'Front'],
  ['central', 'Middle'],
  ['back', 'Back'],
];

function SoundCell({ phoneme, active, onPress, styles }) {
  if (!phoneme) return <View style={styles.cellEmpty} />;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.cell,
        phoneme.voiced && styles.cellVoiced,
        active && styles.cellActive,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={phoneme.label}
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.cellSymbol, active && styles.cellSymbolActive]}>{phoneme.ipa}</Text>
      <Text style={[styles.cellExample, active && styles.cellExampleActive]} numberOfLines={1}>
        {phoneme.examples[0].word}
      </Text>
    </Pressable>
  );
}

export default function SoundStudio() {
  const styles = useStyles();
  const palette = usePalette();
  const { open, openTutorial, closeTutorial } = useSoundStudioTutorial();
  const { toast, showToast } = useToast();
  // `?sound=<id>` — PhonemeDetail's "Practise this sound →" link lands here.
  const { sound } = useLocalSearchParams();

  const [selectedId, setSelectedId] = useState(null);
  const [section, setSection] = useState('consonants');

  useEffect(() => {
    if (sound && findById(String(sound))) {
      const p = findById(String(sound));
      setSelectedId(p.id);
      setSection(p.type === 'consonant' ? 'consonants' : p.type === 'vowel' ? 'vowels' : 'diphthongs');
    }
  }, [sound]);

  const selected = selectedId ? findById(selectedId) : null;

  // Index by chart coordinate once, so a cell is a lookup rather than a scan per square.
  const consonantAt = useMemo(() => {
    const map = {};
    CONSONANTS.forEach((p) => {
      map[`${p.manner}|${p.place}`] = map[`${p.manner}|${p.place}`] || [];
      map[`${p.manner}|${p.place}`].push(p);
    });
    return map;
  }, []);

  const vowelAt = useMemo(() => {
    const map = {};
    VOWELS.forEach((p) => {
      const key = `${p.gridPos.row}|${p.gridPos.col}`;
      map[key] = map[key] || [];
      map[key].push(p);
    });
    return map;
  }, []);

  const pick = useCallback((p) => setSelectedId((cur) => (cur === p.id ? null : p.id)), []);

  const renderConsonants = () =>
    MANNERS.map(([manner, label, hint]) => (
      <StudentCard key={manner}>
        <StudentCardTitle>{label}</StudentCardTitle>
        <Text style={styles.hint}>{hint}</Text>
        {PLACES.map(([place, placeLabel]) => {
          const here = consonantAt[`${manner}|${place}`] || [];
          if (here.length === 0) return null;
          return (
            <View key={place} style={styles.placeRow}>
              <Text style={styles.placeLabel}>{placeLabel}</Text>
              <View style={styles.cellRow}>
                {here.map((p) => (
                  <SoundCell
                    key={p.id}
                    phoneme={p}
                    active={selectedId === p.id}
                    onPress={() => pick(p)}
                    styles={styles}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </StudentCard>
    ));

  const renderVowels = () =>
    VOWEL_ROWS.map(([row, rowLabel]) => (
      <StudentCard key={row}>
        <StudentCardTitle>{rowLabel}</StudentCardTitle>
        {VOWEL_COLS.map(([col, colLabel]) => {
          const here = vowelAt[`${row}|${col}`] || [];
          if (here.length === 0) return null;
          return (
            <View key={col} style={styles.placeRow}>
              <Text style={styles.placeLabel}>{colLabel}</Text>
              <View style={styles.cellRow}>
                {here.map((p) => (
                  <SoundCell
                    key={p.id}
                    phoneme={p}
                    active={selectedId === p.id}
                    onPress={() => pick(p)}
                    styles={styles}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </StudentCard>
    ));

  const renderDiphthongs = () => (
    <StudentCard>
      <StudentCardTitle>Gliding sounds</StudentCardTitle>
      <Text style={styles.hint}>Two vowel positions in one sound — the mouth moves as you say it.</Text>
      <View style={styles.cellRow}>
        {DIPHTHONGS.map((p) => (
          <SoundCell
            key={p.id}
            phoneme={p}
            active={selectedId === p.id}
            onPress={() => pick(p)}
            styles={styles}
          />
        ))}
      </View>
    </StudentCard>
  );

  const SECTIONS = [
    { key: 'consonants', label: `Consonants (${CONSONANTS.length})` },
    { key: 'vowels', label: `Vowels (${VOWELS.length})` },
    { key: 'diphthongs', label: `Gliding (${DIPHTHONGS.length})` },
  ];

  return (
    <StudentScaffold
      title="Sound Studio"
      toast={toast}
      headerRight={
        <Pressable
          onPress={openTutorial}
          hitSlop={8}
          style={({ pressed }) => [pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="How to use Sound Studio"
        >
          <Ionicons name="help-circle-outline" size={22} color="#ffffff" />
        </Pressable>
      }
    >
      {/* Shown automatically on a student's first visit, and re-openable from the header. The chart
          is an unfamiliar object; the web introduces it the same way. */}
      <SoundStudioTutorial open={open} onClose={closeTutorial} />

      <Text style={styles.intro}>
        Every sound of English. Tap one to see how your mouth makes it, hear example words, and
        record yourself to get that one sound scored.
      </Text>

      {selected ? (
        <PhonemeDetailPanel
          key={selected.id}
          phoneme={selected}
          onClose={() => setSelectedId(null)}
          showToast={showToast}
        />
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}
      >
        {SECTIONS.map((s) => {
          const on = section === s.key;
          return (
            <Pressable
              key={s.key}
              onPress={() => setSection(s.key)}
              style={({ pressed }) => [styles.tab, on && styles.tabOn, pressed && styles.pressed]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.tabText, on && styles.tabTextOn]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: palette.primaryDark }]} />
          <Text style={styles.legendText}>Voiced — throat buzzes</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.legendDotQuiet]} />
          <Text style={styles.legendText}>Voiceless</Text>
        </View>
      </View>

      {section === 'consonants'
        ? renderConsonants()
        : section === 'vowels'
          ? renderVowels()
          : renderDiphthongs()}
    </StudentScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  intro: { fontSize: TYPE.label, color: p.onDark, lineHeight: 19, marginBottom: SPACING.md },
  hint: { fontSize: TYPE.caption, color: SLATE[500], lineHeight: 17, marginBottom: SPACING.sm },

  tabRow: { gap: 7, paddingBottom: SPACING.sm, paddingRight: SPACING.md },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: p.headerBorder,
  },
  tabOn: { backgroundColor: p.primary, borderColor: p.primary },
  tabText: { fontSize: TYPE.label, fontWeight: '600', color: p.onDark },
  tabTextOn: { color: p.onPrimary },

  legend: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendDotQuiet: { backgroundColor: 'rgba(255,255,255,0.35)' },
  legendText: { fontSize: TYPE.caption, color: p.onDark },

  placeRow: { marginBottom: SPACING.sm },
  placeLabel: {
    fontSize: TYPE.micro,
    fontWeight: '700',
    color: SLATE[400],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 5,
  },
  cellRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  cell: {
    minWidth: 66,
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: SLATE[100],
    borderWidth: 1.5,
    borderColor: SLATE[200],
  },
  // Voiced sounds are tinted, matching the web's `.voiced` cell.
  cellVoiced: { backgroundColor: p.tint, borderColor: 'rgba(79,195,247,0.45)' },
  cellActive: { backgroundColor: p.primaryDark, borderColor: p.primaryDark },
  cellEmpty: { minWidth: 66 },
  cellSymbol: { fontSize: TYPE.headline, fontWeight: '700', color: SLATE[800] },
  cellSymbolActive: { color: '#ffffff' },
  cellExample: { fontSize: TYPE.micro, color: SLATE[500], marginTop: 1 },
  cellExampleActive: { color: 'rgba(255,255,255,0.85)' },

  pressed: { opacity: 0.78 },
}));
