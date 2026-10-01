import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SLATE } from '../../../../constants/theme';
import { LinkButton, PALETTE, SetChips, styles } from './marksParts';

/**
 * The website's "📷 Scan a marks sheet" panel, inside the marks sheet as it is inside the website's
 * grid: one answer book's cover is one student, so it asks whose it is — and, marking question by
 * question, which paper they sat, including a set the exam does not have yet — before it reads
 * anything. The marks land in that student's row; nothing is saved until Save marks.
 *
 * It used to be a sheet of its own that closed as the camera opened. A picker launched while one
 * Modal is closing and another opening is exactly what a phone refuses to show, so it lives inline
 * now and the sheet underneath never moves.
 */

const SHOWN = 8;

export default function ScanPanel({ students, mode, sets, setOf, scanning, onRead, onClose }) {
  const [studentId, setStudentId] = useState(null);
  const [set, setSet] = useState(1);
  const [filter, setFilter] = useState('');

  const matches = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const found = q
      ? students.filter(
          (s) =>
            (s.studentName || '').toLowerCase().includes(q) || String(s.rollNumber || '').toLowerCase().includes(q),
        )
      : students;
    return found.slice(0, SHOWN);
  }, [students, filter]);

  const chosen = students.find((s) => s.studentId === studentId) || null;
  const perQuestion = mode === 'question';
  const ready = studentId != null && !scanning;
  const read = (source) => onRead({ studentId, set: perQuestion ? set : 1, source });

  const pick = (id) => {
    setStudentId(id);
    // The paper they are already on is the likeliest one they sat.
    setSet(setOf(id));
    setFilter('');
  };

  return (
    <View style={[styles.offer, { borderColor: PALETTE.primary, backgroundColor: PALETTE.tint }]}>
      <View style={styles.scanRow}>
        <Text style={[styles.totalMarksLabel, { flex: 1, color: PALETTE.primaryDark }]}>Scan a marks sheet</Text>
        <LinkButton icon="close-outline" label="Close scanner" onPress={onClose} disabled={scanning} />
      </View>

      <Text style={styles.sectionLabel}>Whose answer book is this?</Text>
      {chosen ? (
        <View style={styles.scanRow}>
          <Text style={[styles.name, { flex: 1 }]} numberOfLines={1}>
            {chosen.studentName}
            {chosen.rollNumber ? ` (${chosen.rollNumber})` : ''}
          </Text>
          <LinkButton label="Change" onPress={() => setStudentId(null)} disabled={scanning} />
        </View>
      ) : (
        <>
          <TextInput
            style={[styles.remarksInput, { flex: 0 }]}
            value={filter}
            onChangeText={setFilter}
            placeholder="Find a student by name or roll number"
            placeholderTextColor={SLATE[500]}
            accessibilityLabel="Find a student"
          />
          <View style={styles.chips}>
            {matches.map((s) => (
              <Pressable
                key={s.studentId}
                onPress={() => pick(s.studentId)}
                style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Scan ${s.studentName}'s answer book`}
              >
                <Text style={styles.chipText} numberOfLines={1}>
                  {s.studentName}
                  {s.rollNumber ? ` (${s.rollNumber})` : ''}
                </Text>
              </Pressable>
            ))}
          </View>
          {students.length > SHOWN && !filter.trim() ? (
            <Text style={styles.hint}>Type a name or roll number to find anyone else.</Text>
          ) : null}
        </>
      )}

      {chosen && perQuestion ? (
        <>
          <Text style={styles.sectionLabel}>Set attempted</Text>
          <SetChips
            sets={sets}
            value={set}
            onPick={setSet}
            disabled={scanning}
            extra={[{ value: sets.length + 1, label: `Set ${sets.length + 1} (a new paper)` }]}
          />
          {set > sets.length ? (
            <Text style={styles.hint}>
              A new paper: the sheet&apos;s questions are shown for you to confirm before they are created.
            </Text>
          ) : null}
        </>
      ) : null}

      <Text style={styles.sectionLabel}>The answer book&apos;s cover</Text>
      <View style={styles.toolRow}>
        <LinkButton icon="camera-outline" label="Take photo" onPress={() => read('camera')} disabled={!ready} />
        <LinkButton icon="image-outline" label="Choose photo" onPress={() => read('library')} disabled={!ready} />
        <LinkButton icon="document-outline" label="Choose PDF" onPress={() => read('pdf')} disabled={!ready} />
      </View>
      {scanning ? (
        <View style={styles.scanRow}>
          <ActivityIndicator size="small" color={PALETTE.primary} />
          <Text style={[styles.hint, { flex: 1 }]}>
            Reading {chosen ? `${chosen.studentName}'s` : 'the'} marks sheet… this can take up to half a minute.
          </Text>
        </View>
      ) : studentId == null ? (
        <Text style={styles.hint}>Choose the student first.</Text>
      ) : null}
    </View>
  );
}
