import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { FEEDBACK, SLATE, TYPE } from '../../../../constants/theme';
import QuestionHtml from '../../../QuestionHtml';
import { LinkButton } from '../marks/marksParts';
import RichTextEditorSheet from './RichTextEditorSheet';

/** True when the value is the editor's HTML rather than plain words. */
export const isRich = (value) => /<[a-z][\s\S]*>/i.test(String(value || ''));

/**
 * A question field that can hold the website's rich text.
 *
 * Plain words stay a native text box — most questions are just text, and a WebView for every
 * option would be slow and strange to type in. "Format" opens the website's own editor
 * (RichTextEditorSheet) for formatting, tables, maths and pictures; once the field holds rich text
 * it shows as the paper will print it, with Edit and Clear, and is never flattened back to plain.
 */
export default function RichField({ label, value, onChange, placeholder, required, multiline = true, disabled }) {
  const [editing, setEditing] = useState(false);
  const rich = isRich(value);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      {rich ? (
        <View style={styles.preview}>
          <QuestionHtml html={value} textStyle={styles.previewText} />
        </View>
      ) : (
        <TextInput
          style={[styles.input, multiline && styles.multiline]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={SLATE[500]}
          multiline={multiline}
          editable={!disabled}
          accessibilityLabel={label}
        />
      )}
      <View style={styles.row}>
        <LinkButton
          icon="text-outline"
          label={rich ? 'Edit' : 'Format · maths · table'}
          onPress={() => setEditing(true)}
          disabled={disabled}
          accessibilityLabel={`${rich ? 'Edit' : 'Format'} ${label}`}
        />
        {rich ? (
          <LinkButton
            icon="close-outline"
            label="Clear"
            onPress={() => onChange('')}
            disabled={disabled}
            accessibilityLabel={`Clear ${label}`}
          />
        ) : null}
      </View>
      <RichTextEditorSheet
        visible={editing}
        title={label}
        initialHtml={rich ? value : escapePlain(value)}
        placeholder={placeholder}
        onClose={() => setEditing(false)}
        onDone={(html) => {
          setEditing(false);
          // An editor left empty returns "<p></p>": nothing, not a blank paragraph.
          onChange(String(html || '').replace(/^<p><\/p>$/, ''));
        }}
      />
    </View>
  );
}

/** Plain words handed to the editor as a paragraph, with their line breaks kept. */
const escapePlain = (text) => {
  const t = String(text || '');
  if (!t.trim()) return '';
  const esc = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('');
};

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[700], marginBottom: 6 },
  required: { color: FEEDBACK.errorText },
  input: {
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: TYPE.body,
    color: SLATE[900],
    backgroundColor: '#ffffff',
  },
  multiline: { minHeight: 84, textAlignVertical: 'top' },
  preview: {
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 10,
    padding: 10,
    backgroundColor: SLATE[50],
  },
  previewText: { fontSize: TYPE.body, color: SLATE[800] },
  row: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
});
