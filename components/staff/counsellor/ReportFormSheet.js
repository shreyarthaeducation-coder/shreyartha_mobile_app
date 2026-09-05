import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING } from '../../../constants/theme';
import { FormSheet, Select, TextField } from '../../ui';
import { RATING_SCALE, REPORT_SECTIONS } from '../../../constants/counsellorReportConfig';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * The ten-section counsellor report form.
 *
 * Field types come straight from `REPORT_SECTIONS`, which is a verbatim port of the web config:
 *   rating       → a 1–5 star tap row (tapping the lit star clears back to 0)
 *   boolean      → Yes / No pills, with a third state of "not answered" (null)
 *   multiselect  → chips, plus a free-text box when `allowOther` (written to `otherKey`)
 *   text         → single-line
 *   textarea     → multi-line
 *
 * `hideLabel` suppresses the field label for sections whose single field IS the section.
 *
 * ANDROID KEYBOARD: every field stays mounted for the life of the sheet. Do not add a
 * "show only the open section" optimisation — unmounting a sibling of a focused TextInput is what
 * dismisses the keyboard, and this form is nothing but siblings of text inputs.
 */


function StarRow({ value, onChange }) {
  const styles = useStyles();
  return (
    <View style={styles.starRow}>
      {Array.from({ length: RATING_SCALE }, (_, i) => i + 1).map((n) => {
        const lit = Number(value) >= n;
        return (
          <Pressable
            key={n}
            // Tapping the current value clears it — otherwise a mis-tap can never be undone,
            // since there is no other way back to "not rated".
            onPress={() => onChange(Number(value) === n ? 0 : n)}
            hitSlop={4}
            style={styles.star}
            accessibilityRole="button"
            accessibilityLabel={`${n} of ${RATING_SCALE}`}
          >
            <Ionicons name={lit ? 'star' : 'star-outline'} size={26} color={lit ? '#f59e0b' : SLATE[300]} />
          </Pressable>
        );
      })}
      <Text style={styles.starValue}>{Number(value) > 0 ? `${value}/${RATING_SCALE}` : 'Not rated'}</Text>
    </View>
  );
}

function BooleanPills({ value, onChange }) {
  const styles = useStyles();
  const options = [
    { label: 'Yes', v: true },
    { label: 'No', v: false },
  ];
  return (
    <View style={styles.pillRow}>
      {options.map((option) => {
        const on = value === option.v;
        return (
          <Pressable
            key={option.label}
            onPress={() => onChange(on ? null : option.v)}
            style={({ pressed }) => [styles.pill, on && styles.pillOn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.pillText, on && styles.pillTextOn]}>{option.label}</Text>
          </Pressable>
        );
      })}
      {value === null || value === undefined ? (
        <Text style={styles.notAnswered}>Not answered</Text>
      ) : null}
    </View>
  );
}

function Chips({ options = [], value = [], onChange }) {
  const styles = useStyles();
  const selected = Array.isArray(value) ? value : [];
  const toggle = (option) =>
    onChange(
      selected.includes(option) ? selected.filter((v) => v !== option) : [...selected, option],
    );

  return (
    <View style={styles.chipWrap}>
      {options.map((option) => {
        const on = selected.includes(option);
        return (
          <Pressable
            key={option}
            onPress={() => toggle(option)}
            style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
          >
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ReportFormSheet({
  visible,
  student,
  leaf,
  form,
  onPatch,
  onClose,
  onSubmit,
  saving,
  loading,
  error,
  existing,
}) {
  const styles = useStyles();
  const subtitleParts = [
    leaf?.className ? `Class ${leaf.className}` : null,
    leaf?.sectionName ? `Section ${leaf.sectionName}` : null,
    leaf?.yearLabel && leaf.yearLabel !== 'UNASSIGNED' ? leaf.yearLabel : null,
  ].filter(Boolean);

  return (
    <FormSheet
      visible={visible}
      title={student?.studentName || 'Counsellor report'}
      subtitle={subtitleParts.join(' · ') || undefined}
      onClose={onClose}
      onSubmit={loading ? undefined : onSubmit}
      submitting={saving}
      submitLabel={existing ? 'Update report' : 'Save report'}
      fullHeight
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <Text style={styles.loading}>Loading this student's report…</Text>
      ) : (
        REPORT_SECTIONS.map((section) => (
          <View key={section.key} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.subtitle ? <Text style={styles.sectionNote}>{section.subtitle}</Text> : null}

            {section.fields.map((field) => {
              const value = form?.[field.key];
              return (
                <View key={field.key} style={styles.field}>
                  {field.hideLabel ? null : <Text style={styles.label}>{field.label}</Text>}

                  {field.type === 'rating' ? (
                    <StarRow value={value} onChange={(v) => onPatch(field.key, v)} />
                  ) : field.type === 'boolean' ? (
                    <BooleanPills value={value} onChange={(v) => onPatch(field.key, v)} />
                  ) : field.type === 'select' ? (
                    // A fixed list, not free text. Without this branch a `select` fell through to
                    // the TextField below and a counsellor could type "maybe" into `pronoun` — a
                    // value the server rejects and quietly replaces with they/them.
                    <Select
                      label=""
                      value={value == null ? '' : String(value)}
                      options={(field.options || []).map((o) => ({
                        value: String(o),
                        label: field.optionLabels?.[o] || String(o),
                      }))}
                      onChange={(v) => onPatch(field.key, v)}
                    />
                  ) : field.type === 'multiselect' ? (
                    <>
                      <Chips
                        options={field.options}
                        value={value}
                        onChange={(v) => onPatch(field.key, v)}
                      />
                      {field.allowOther ? (
                        <TextField
                          label="Other"
                          value={form?.[field.otherKey] || ''}
                          onChangeText={(v) => onPatch(field.otherKey, v)}
                          placeholder="Anything not listed above"
                        />
                      ) : null}
                    </>
                  ) : (
                    <TextField
                      label=""
                      value={value == null ? '' : String(value)}
                      onChangeText={(v) => onPatch(field.key, v)}
                      multiline={field.type === 'textarea'}
                      inputStyle={field.type === 'textarea' ? styles.textarea : undefined}
                      placeholder={field.placeholder || ''}
                    />
                  )}
                </View>
              );
            })}
          </View>
        ))
      )}
    </FormSheet>
  );
}

const useStyles = makeStyles((p) => ({
  error: {
    fontSize: 12.5,
    color: FEEDBACK.errorText,
    backgroundColor: FEEDBACK.errorBg,
    borderRadius: 10,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  loading: { fontSize: 13, color: SLATE[500], textAlign: 'center', paddingVertical: SPACING.xl },

  section: { marginBottom: SPACING.lg },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: p.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: SPACING.sm,
  },
  // Explanatory line under a section heading — currently only Griffin, which has to say who
  // writes it and that generating it happens on the web.
  sectionNote: {
    fontSize: 12,
    lineHeight: 17,
    color: SLATE[500],
    marginTop: -6,
    marginBottom: SPACING.sm,
  },
  field: { marginBottom: SPACING.sm },
  label: { fontSize: 13, fontWeight: '600', color: SLATE[700], marginBottom: 6 },

  starRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  star: { padding: 2 },
  starValue: { marginLeft: 8, fontSize: 12, color: SLATE[500], fontWeight: '600' },

  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
  },
  pillOn: { backgroundColor: p.tint, borderColor: p.primary },
  pillText: { fontSize: 13, fontWeight: '600', color: SLATE[600] },
  pillTextOn: { color: p.primaryDark },
  notAnswered: { fontSize: 11.5, color: SLATE[400], fontStyle: 'italic' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
  },
  chipOn: { backgroundColor: p.tint, borderColor: p.primary },
  chipText: { fontSize: 12.5, fontWeight: '600', color: SLATE[600] },
  chipTextOn: { color: p.primaryDark },

  textarea: { height: 90, textAlignVertical: 'top' },
  pressed: { opacity: 0.75 },
}));
