import React, { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { FEEDBACK, SLATE, SPACING, TYPE } from '../../constants/theme';

/**
 * Labelled text input with an error state and a free-form helper slot.
 *
 * The `helper` slot is what the school-code lookup renders into ("Checking…" / the resolved
 * school name / "Invalid School Code"), so the lookup needs no bespoke component.
 *
 * Deliberately stateless: there is no focus-highlight style. Any per-focus setState here
 * re-renders while the IME is attaching, and on Android that re-layout has repeatedly detached
 * the focused EditText and closed the keyboard (first via `elevation`, then via the plain
 * border-colour swap). The static border is the price of a keyboard that stays open.
 */
const FormField = forwardRef(function FormField(
  {
    label,
    required,
    error,
    helper,
    palette,
    rightSlot,
    containerStyle,
    inputStyle,
    ...inputProps
  },
  ref,
) {
  const borderColor = error ? FEEDBACK.errorText : SLATE[200];

  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      ) : null}

      <View style={[styles.inputRow, { borderColor }]}>
        {/* inputStyle is merged, not replaced — a multiline caller needs height and
            textAlignVertical without losing the base padding and colour. */}
        <TextInput
          ref={ref}
          style={[styles.input, inputStyle]}
          // SLATE[500], not SLATE[400]. #94a3b8 on white is 2.59:1 — below WCAG AA — and this is
          // the ONLY shared text input in the app, so it set the placeholder contrast everywhere.
          placeholderTextColor={SLATE[500]}
          {...inputProps}
        />
        {rightSlot}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && helper ? <View style={styles.helper}>{helper}</View> : null}
    </View>
  );
});

export default FormField;

const styles = StyleSheet.create({
  wrap: { marginBottom: SPACING.md },
  // THE LABEL IS SMALLER THAN THE VALUE, NOT LARGER.
  //
  // This was label 16 / input 18 — inverted. Every field came out ~58px tall and the label read
  // quieter than the text it described, which is what made the auth cards feel oversized and
  // misaligned. One rung down plus a heavier weight and a darker slate is smaller, bolder and
  // higher-contrast at once. The TYPE scale itself is untouched: it was deliberately raised after
  // a "text everywhere is hard to read" report, and checkdesign asserts a floor of 11.5.
  label: {
    fontSize: TYPE.label,
    fontWeight: '700',
    color: SLATE[800],
    marginBottom: 6,
  },
  // FEEDBACK.errorText, not its own red. This asterisk and the error message below it sat on the
  // same field in two different reds — #e74c3c here, #dc2626 there — which nobody would choose.
  required: { color: FEEDBACK.errorText },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: TYPE.body,
    color: SLATE[900],
  },
  error: {
    marginTop: 5,
    fontSize: TYPE.label,
    color: FEEDBACK.errorText,
    fontWeight: '500',
  },
  helper: { marginTop: 5 },
});
