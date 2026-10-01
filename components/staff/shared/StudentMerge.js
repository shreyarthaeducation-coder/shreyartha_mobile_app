import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { FEEDBACK, SLATE, SPACING, TYPE } from '../../../constants/theme';
import { Card, FormSheet } from '../../ui';
import { usePalette } from '../../ui/PaletteContext';

/**
 * The same child listed twice — the school's record and an account they made themselves — from the
 * teacher's Student Management and the principal's Manage Students alike (the website offers it
 * "from all three sides").
 *
 * OFFERED, never done unasked: two children in a class really can share a name, and the person who
 * knows them decides. What a merge would move is shown before anything moves, and a merge cannot be
 * undone.
 */

/** The list of pairs, each with "Review & merge". Renders nothing when there are none. */
export function DuplicateStudentsCard({ duplicates, onReview }) {
  const PALETTE = usePalette();
  if (!duplicates || duplicates.length === 0) return null;
  return (
    <Card>
      <Text style={styles.title}>
        {duplicates.length} student{duplicates.length === 1 ? '' : 's'} may be listed twice
      </Text>
      <Text style={styles.hint}>
        The school&apos;s record and an account the student made themselves. Joining them keeps the school&apos;s record —
        roll number, photo and marks — and moves the login onto it.
      </Text>
      {duplicates.map((pair) => (
        <View key={pair.selfRegistered.studentId} style={styles.row}>
          <View style={styles.body}>
            <Text style={styles.name}>
              {pair.schoolRecord.fullName} <Text style={styles.meta}>(school record)</Text>
            </Text>
            <Text style={styles.name}>
              {pair.selfRegistered.fullName} <Text style={styles.meta}>(self-registered)</Text>
            </Text>
            <Text style={[styles.meta, pair.datesOfBirthAgree ? styles.agree : null]}>
              {pair.datesOfBirthAgree ? 'Same date of birth' : 'Dates of birth differ'}
            </Text>
          </View>
          <Pressable
            onPress={() => onReview(pair)}
            style={({ pressed }) => [
              styles.btn,
              { borderColor: PALETTE.primary, backgroundColor: PALETTE.tint },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
          >
            <Text style={[styles.btnText, { color: PALETTE.primaryDark }]}>Review & merge</Text>
          </Pressable>
        </View>
      ))}
    </Card>
  );
}

/** What the merge would do, and the one button that does it. */
export function StudentMergeSheet({ pair, plan, merging, onConfirm, onClose }) {
  const PALETTE = usePalette();
  const blocked = !!(plan?.warnings && plan.warnings.length);
  return (
    <FormSheet
      visible={!!pair}
      title="Merge these records?"
      subtitle={pair ? `${pair.selfRegistered.fullName} into ${pair.schoolRecord.fullName}` : undefined}
      onClose={onClose}
      onSubmit={plan && !blocked ? onConfirm : undefined}
      submitting={merging}
      submitDisabled={!plan || blocked}
      submitLabel="Yes, they are the same child"
      fullHeight
    >
      {!plan ? (
        <ActivityIndicator size="small" color={PALETTE.primary} style={styles.loader} />
      ) : blocked ? (
        plan.warnings.map((w, i) => (
          <Text key={`${i}-${w}`} style={styles.error}>
            {w}
          </Text>
        ))
      ) : (
        <>
          <Text style={styles.summary}>
            The school&apos;s record is kept, with its roll number, photograph and any marks already entered.
            {plan.loginMoving
              ? ` ${plan.survivingName} will sign in with ${plan.loginMoving}, the account they already use.`
              : ' That account cannot sign in, so there is no login to move.'}
          </Text>
          {(plan.moves || []).length ? (
            plan.moves.map((move) => (
              <Text key={`${move.table}.${move.column}`} style={styles.meta}>
                {move.table}: {move.moved} row{move.moved === 1 ? '' : 's'} move across
                {move.discarded > 0 ? ` · ${move.discarded} dropped, because the school's record already has one` : ''}
              </Text>
            ))
          ) : (
            <Text style={styles.meta}>That account has nothing recorded against it yet, so only the login moves.</Text>
          )}
          <Text style={styles.error}>This cannot be undone. Check these really are the same child.</Text>
        </>
      )}
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },
  hint: { fontSize: TYPE.label, color: SLATE[500], marginVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: SLATE[100] },
  body: { flex: 1 },
  name: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },
  meta: { fontSize: TYPE.label, color: SLATE[500], marginTop: 2, fontWeight: '400' },
  agree: { color: FEEDBACK.successText },
  btn: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1 },
  btnText: { fontSize: TYPE.label, fontWeight: '700' },
  loader: { marginVertical: SPACING.lg },
  summary: { fontSize: TYPE.body, color: SLATE[700], marginBottom: 8 },
  error: { fontSize: TYPE.label, color: FEEDBACK.errorText, marginTop: 8, fontWeight: '600' },
  pressed: { opacity: 0.72 },
});
