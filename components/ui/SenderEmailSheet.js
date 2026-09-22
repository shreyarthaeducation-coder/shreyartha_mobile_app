import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import { SLATE, SPACING, TYPE } from '../../constants/theme';
import FormSheet from './FormSheet';

/** The same rule the server applies, so the sheet refuses before the round trip. */
export const isSenderEmail = (s) =>
  /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(String(s || '').trim());

/**
 * Asks whoever is sending for their own mail id, then hands it back.
 *
 * Every mail a member of staff sends from a panel carries this. It is typed on every send and is
 * deliberately never prefilled — the typing is the point, because that address is what the admin
 * panel records the send against. The recipient never sees it: the mail goes out From the company
 * mailbox, replies come back there, and the address is only ever a BCC.
 *
 * The field is cleared whenever the sheet opens, so one send's address never rides along into the
 * next — `visible` is the reset trigger, not mount, because FormSheet keeps this mounted.
 */
export default function SenderEmailSheet({
  visible,
  title = 'Your email id',
  subtitle,
  note,
  submitLabel = 'Send',
  submitting = false,
  onClose,
  onSubmit,
  palette,
}) {
  const [senderEmail, setSenderEmail] = useState('');

  useEffect(() => {
    if (visible) setSenderEmail('');
  }, [visible]);

  return (
    <FormSheet
      visible={visible}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      onSubmit={() => onSubmit(senderEmail.trim())}
      submitLabel={submitLabel}
      submitting={submitting}
      submitDisabled={!isSenderEmail(senderEmail)}
      palette={palette}
    >
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <Text style={styles.label}>Your email id</Text>
      <TextInput
        style={styles.input}
        value={senderEmail}
        onChangeText={setSenderEmail}
        placeholder="you@example.com"
        placeholderTextColor={SLATE[500]}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        editable={!submitting}
      />
      <Text style={styles.hint}>
        This send is recorded against it and blind-copied to you. The recipient never sees it.
      </Text>
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  note: {
    fontSize: TYPE.body,
    lineHeight: 21,
    color: SLATE[600],
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: TYPE.label,
    fontWeight: '600',
    color: SLATE[700],
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: TYPE.heading,
    color: SLATE[800],
    backgroundColor: '#ffffff',
  },
  hint: {
    fontSize: TYPE.label,
    lineHeight: 19,
    color: SLATE[600],
    marginTop: 8,
  },
});
