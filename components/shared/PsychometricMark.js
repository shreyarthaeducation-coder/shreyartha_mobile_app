import { StyleSheet, Text, View } from 'react-native';
import { FEEDBACK, TYPE } from '../../constants/theme';

/**
 * A student's psychometric progress in a staff list (30 Oct 2026) — the website's PsychometricStatus:
 * green with "3/6" once they have taken at least one test, red with "0/6" when they have taken none.
 * The numbers are the server's (`psychometricCompleted` / `psychometricTotal` on each student row).
 */

/** "started", "none", or null when the student's class has no psychometric tests. */
export function psychometricState(student) {
  if (!student || student.psychometricTotal == null || student.psychometricTotal <= 0) return null;
  return (student.psychometricCompleted || 0) > 0 ? 'started' : 'none';
}

/** Border and fill for a student's chip or row, or null to leave it as it was. */
export function psychometricTint(student) {
  const state = psychometricState(student);
  if (state === 'started') return { borderColor: FEEDBACK.successBorder, backgroundColor: FEEDBACK.successBg };
  if (state === 'none') return { borderColor: FEEDBACK.errorBorder, backgroundColor: FEEDBACK.errorBg };
  return null;
}

export default function PsychometricMark({ student }) {
  const state = psychometricState(student);
  if (!state) return null;
  const done = student.psychometricCompleted || 0;
  const total = student.psychometricTotal;
  return (
    <View
      style={[styles.mark, state === 'started' ? styles.started : styles.none]}
      accessibilityLabel={state === 'started' ? `Psychometric: ${done} of ${total} tests taken` : `Psychometric: none of ${total} tests taken`}
    >
      <Text style={[styles.text, { color: state === 'started' ? FEEDBACK.successText : FEEDBACK.errorText }]}>
        {done}/{total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1, borderWidth: 1, marginLeft: 6 },
  started: { borderColor: FEEDBACK.successBorder, backgroundColor: FEEDBACK.successBg },
  none: { borderColor: FEEDBACK.errorBorder, backgroundColor: FEEDBACK.errorBg },
  text: { fontSize: TYPE.caption, fontWeight: '700' },
});
