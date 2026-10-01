import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SLATE } from '../../../../constants/theme';
import { scanTone, sheetMismatch } from '../../../../utils/marksSheetScan';
import { grid } from './MarksGrid';
import { LinkButton, PALETTE, TONE_STYLE, sanitise, styles } from './marksParts';

/**
 * The questions a scanned sheet has, for the teacher to confirm before they are created — the
 * website's SheetPaperReview, inside the marks sheet as it is inside the website's grid. Each
 * question is a cell ("Q1" over its mark), as on the sheet itself. Nothing is created or saved here:
 * Create hands the confirmed paper back, and the marks sheet creates the questions and puts the
 * student's marks in place.
 */
export default function PaperReviewPanel({ review, student, issues, busy, onChange, onCreate, onTotalOnly, onCancel }) {
  if (!review) return null;
  const count = review.values.length;
  const mismatch = sheetMismatch(review.res?.header, student);
  const sum = review.values.reduce((s, v) => s + (Number(v) || 0), 0);

  return (
    <View style={[styles.offer, { borderColor: PALETTE.primary, backgroundColor: '#ffffff' }]}>
      <Text style={[styles.totalMarksLabel, { color: PALETTE.primaryDark }]}>
        {review.studentName}&apos;s answer book · {count} question{count === 1 ? '' : 's'}
        {review.set > 1 ? ` · Set ${review.set}` : ''}
      </Text>
      {mismatch ? (
        <Text style={styles.error}>⚠ {mismatch} Check it is the right answer book before saving.</Text>
      ) : null}
      <Text style={styles.hint}>
        This exam has no questions for this paper yet, so these were read off the sheet. Check them — add or remove
        one, or correct a mark; a blank box or a dash counts as 0. They are created only when you press Create, and
        nothing is saved until Save marks.
      </Text>

      <View style={styles.chips}>
        {review.values.map((value, i) => {
          const tone = scanTone(review.res?.marks?.[i]?.status);
          return (
            <View key={i} style={{ width: 62, alignItems: 'center', gap: 2 }}>
              <Text style={grid.headText}>Q{i + 1}</Text>
              <TextInput
                style={[grid.input, tone && TONE_STYLE[tone]]}
                value={value}
                keyboardType="decimal-pad"
                placeholder="—"
                placeholderTextColor={SLATE[500]}
                onChangeText={(text) =>
                  onChange({ ...review, values: review.values.map((v, j) => (j === i ? sanitise(text, null) : v)) })
                }
                accessibilityLabel={`Question ${i + 1}`}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.scanRow}>
        <LinkButton icon="add-outline" label="Add a question" onPress={() => onChange({ ...review, values: [...review.values, ''] })} />
        <LinkButton
          icon="remove-outline"
          label="Remove the last"
          disabled={review.values.length <= 1}
          onPress={() => onChange({ ...review, values: review.values.slice(0, -1) })}
        />
      </View>

      <View style={styles.qRow}>
        <Text style={[styles.qLabel, styles.totalLabel]}>Total marks (the paper is out of)</Text>
        <TextInput
          style={styles.markInput}
          value={review.totalMarks}
          keyboardType="number-pad"
          onChangeText={(text) => onChange({ ...review, totalMarks: text.replace(/[^0-9]/g, '') })}
          accessibilityLabel="Total marks"
        />
      </View>
      <View style={styles.qRow}>
        <Text style={[styles.qLabel, styles.totalLabel]}>{review.studentName}&apos;s total</Text>
        <TextInput
          style={[styles.markInput, review.typedTotal !== '' && styles.typedTotal]}
          value={review.typedTotal}
          keyboardType="decimal-pad"
          placeholder={String(sum)}
          placeholderTextColor={SLATE[500]}
          onChangeText={(text) => onChange({ ...review, typedTotal: sanitise(text, null) })}
          accessibilityLabel={`${review.studentName}'s total`}
        />
      </View>

      {issues.map((issue, i) => (
        <Text key={`${i}-${issue}`} style={styles.error}>
          {issue}
        </Text>
      ))}
      {(review.res?.warnings || []).map((warning, i) => (
        <Text key={`${i}-${warning}`} style={styles.warning}>
          {warning}
        </Text>
      ))}

      <View style={styles.toolRow}>
        <Pressable
          onPress={onCreate}
          disabled={busy || issues.length > 0}
          style={({ pressed }) => [
            styles.linkBtn,
            { backgroundColor: PALETTE.primaryDark, borderColor: PALETTE.primaryDark },
            (busy || issues.length > 0) && styles.disabled,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
        >
          {busy ? <ActivityIndicator size="small" color="#ffffff" /> : null}
          <Text style={[styles.linkText, { color: '#ffffff' }]}>
            Create {count} question{count === 1 ? '' : 's'}
          </Text>
        </Pressable>
        {review.fromTotalSheet ? <LinkButton label="Just enter the total" onPress={onTotalOnly} disabled={busy} /> : null}
        <LinkButton label="Cancel" onPress={onCancel} disabled={busy} />
      </View>
    </View>
  );
}
