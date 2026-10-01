import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, PORTALS, SLATE, SPACING, TYPE } from '../../../../constants/theme';
import { EXAM_STATUS } from '../../../../services/teacher/examService';

/**
 * The pieces every marks sheet shares — the roster, one student's sheet, the scanner, the paper
 * review. Lifted out of MarksSheet.js unchanged in look; nothing here is new design.
 */

export const PALETTE = PORTALS.school;

/**
 * Keeps only digits and a single dot, then rejects anything above `max`.
 *
 * THE MAXIMUM-MARK GUARD ONLY EXISTS HERE. On the web it is a `max=` attribute on a number input;
 * RN's TextInput has no such attribute, so without this clamp out-of-range marks would reach the API.
 */
export const sanitise = (text, max) => {
  const cleaned = String(text).replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
  if (cleaned === '') return '';
  const value = Number(cleaned);
  if (Number.isNaN(value)) return '';
  if (max != null && value > max) return String(max);
  return cleaned;
};

/** How a box the scan touched is coloured: verified, to check, or left for the teacher. */
export const TONE_STYLE = {
  ok: { backgroundColor: '#f0fdf4', borderColor: '#4ade80' },
  check: { backgroundColor: '#fffbeb', borderColor: '#f59e0b' },
  missing: { backgroundColor: '#fef2f2', borderColor: '#ef4444', borderWidth: 2 },
};

export function StatusToggle({ status, onPick, disabled }) {
  return (
    <View style={styles.statusToggle}>
      {[
        { value: EXAM_STATUS.PRESENT, short: 'P', tone: FEEDBACK.successOnBg, bg: FEEDBACK.successBg },
        { value: EXAM_STATUS.ABSENT, short: 'A', tone: FEEDBACK.errorOnBg, bg: FEEDBACK.errorBg },
      ].map((option) => {
        const active = status === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onPick(option.value)}
            disabled={disabled}
            style={({ pressed }) => [
              styles.statusBtn,
              active && { backgroundColor: option.bg, borderColor: option.tone },
              pressed && styles.pressed,
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.value === EXAM_STATUS.PRESENT ? 'Present' : 'Absent'}
          >
            <Text style={[styles.statusText, active && { color: option.tone }]}>{option.short}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A small secondary button in a sheet body. */
export function LinkButton({ label, icon, onPress, disabled, accessibilityLabel }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.linkBtn, disabled && styles.disabled, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
    >
      {icon ? <Ionicons name={icon} size={16} color={PALETTE.primaryDark} /> : null}
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

/**
 * Which paper a student sat — "Set 1", "Set 2", … as a row of chips. `extra` adds choices after the
 * real sets, e.g. `{ value: 3, label: 'Set 3 (a new paper)' }` for the scanner.
 */
export function SetChips({ sets, value, onPick, extra = [], disabled }) {
  const options = [...sets.map((s) => ({ value: s, label: `Set ${s}` })), ...extra];
  return (
    <View style={styles.chips} accessibilityRole="radiogroup">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onPick(option.value)}
            disabled={disabled}
            style={({ pressed }) => [
              styles.chip,
              active && { backgroundColor: PALETTE.tint, borderColor: PALETTE.primary },
              pressed && styles.pressed,
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipText, active && { color: PALETTE.primaryDark }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const styles = StyleSheet.create({
  loader: { marginVertical: SPACING.xl },
  empty: { fontSize: TYPE.body, color: SLATE[500], textAlign: 'center', paddingVertical: SPACING.lg },

  bulkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm },
  progress: { flex: 1, fontSize: TYPE.label, fontWeight: '700', color: SLATE[600] },
  bulkBtn: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: SLATE[200],
  },
  bulkText: { fontSize: TYPE.label, fontWeight: '700' },
  toolRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.sm },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: SLATE[100],
  },
  index: { minWidth: 20, fontSize: TYPE.label, fontWeight: '700', color: SLATE[500] },
  nameCol: { flex: 1 },
  name: { fontSize: TYPE.heading, fontWeight: '600', color: SLATE[800] },
  meta: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 1 },

  markBox: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  // 64 wide: "54.5" and "100" must read whole in the box (the website's a439c2c fixed the same).
  markInput: {
    width: 64,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 8,
    textAlign: 'center',
    fontSize: TYPE.heading,
    fontWeight: '700',
    color: SLATE[900],
    backgroundColor: '#ffffff',
  },
  remarksInput: {
    flex: 1,
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 8,
    fontSize: TYPE.body,
    color: SLATE[900],
    backgroundColor: '#ffffff',
  },
  markMax: { fontSize: TYPE.caption, color: SLATE[500], fontWeight: '600' },
  disabled: { opacity: 0.45 },
  typedTotal: { backgroundColor: '#eef2ff', borderColor: '#6366f1' },

  totalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 8,
    backgroundColor: SLATE[50],
  },
  totalText: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[700] },

  statusToggle: { flexDirection: 'row', gap: 4 },
  statusBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: SLATE[50],
  },
  statusText: { fontSize: TYPE.label, fontWeight: '800', color: SLATE[500] },

  qRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: SLATE[100],
  },
  qLabel: { flex: 1, fontSize: TYPE.body, color: SLATE[700] },
  totalLabel: { fontWeight: '700', color: SLATE[800] },
  sectionLabel: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[600], marginTop: SPACING.sm, marginBottom: 4 },

  totalMarksRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 4 },
  totalMarksLabel: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[700] },
  hint: { fontSize: TYPE.label, color: SLATE[500], marginVertical: 6 },
  warning: { fontSize: TYPE.label, color: '#92400e', marginVertical: 3 },
  error: { fontSize: TYPE.label, color: FEEDBACK.errorText, marginVertical: 3, fontWeight: '600' },

  scanRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginVertical: 6 },
  scanIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
  },
  linkText: { fontSize: TYPE.label, fontWeight: '700', color: PALETTE.primaryDark },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
  },
  chipText: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[600] },

  offer: {
    marginVertical: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fcd34d',
    backgroundColor: '#fffbeb',
    gap: 6,
  },
  offerText: { fontSize: TYPE.label, color: '#92400e' },
  notice: {
    marginVertical: 6,
    padding: 10,
    borderRadius: 8,
    backgroundColor: SLATE[50],
    borderWidth: 1,
    borderColor: SLATE[200],
  },
  noticeText: { fontSize: TYPE.label, color: SLATE[700] },

  pressed: { opacity: 0.72 },
});
