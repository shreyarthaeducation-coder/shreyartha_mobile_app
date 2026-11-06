import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE } from '../../constants/theme';
import { DateTimeField, Select, TextField } from '../ui';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';

/**
 * One form field from a plain description (5 Nov 2026) — what the portals carried over from the
 * website use for every add / edit form, so a page's form is a list of fields, not a screen of
 * hand-wired inputs.
 *
 * `field` is `{ key, label, type, options, required, placeholder, helper, maxLength }`, where `type`
 * is text | multiline | number | email | phone | url | date | datetime | select | switch | password.
 * `options` (select) is `[{ value, label }]` or plain strings.
 */
export default function FieldInput({ field, value, onChange, error }) {
  const styles = useStyles();
  const palette = usePalette();
  const label = field.required ? `${field.label} *` : field.label;
  const type = field.type || 'text';

  if (type === 'select') {
    const options = (field.options || []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
    return (
      <View style={styles.wrap}>
        <Select
          label={label}
          value={value ?? ''}
          options={options}
          onChange={onChange}
          placeholder={field.placeholder || 'Select…'}
          searchable={options.length > 12}
          error={error}
        />
      </View>
    );
  }

  if (type === 'date' || type === 'datetime') {
    return (
      <View style={styles.wrap}>
        <DateTimeField
          label={label}
          value={value ? new Date(value) : null}
          mode={type}
          clearable={!field.required}
          onChange={(d) => onChange(d ? (type === 'date' ? isoDate(d) : d.toISOString()) : '')}
          helper={error || field.helper}
        />
      </View>
    );
  }

  if (type === 'switch') {
    const on = value === true || value === 'true';
    return (
      <Pressable
        onPress={() => onChange(!on)}
        style={({ pressed }) => [styles.switchRow, pressed && styles.pressed]}
        accessibilityRole="switch"
        accessibilityState={{ checked: on }}
      >
        <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? palette.primary : SLATE[400]} />
        <Text style={styles.switchLabel}>{field.label}</Text>
      </Pressable>
    );
  }

  const keyboard = {
    number: 'decimal-pad',
    email: 'email-address',
    phone: 'phone-pad',
    url: 'url',
  }[type];

  return (
    <TextField
      label={label}
      value={value == null ? '' : String(value)}
      onChangeText={onChange}
      placeholder={field.placeholder}
      keyboardType={keyboard || 'default'}
      autoCapitalize={['email', 'url', 'password'].includes(type) ? 'none' : 'sentences'}
      secureTextEntry={type === 'password'}
      multiline={type === 'multiline'}
      maxLength={field.maxLength}
      inputStyle={type === 'multiline' ? styles.multiline : undefined}
      error={error}
      helper={field.helper ? <Text style={styles.helper}>{field.helper}</Text> : undefined}
    />
  );
}

/** "2026-11-05" in local time — a date field must not shift a day across midnight UTC. */
export function isoDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The form's starting values from a record (or blanks), by the fields' keys. */
export function initialValues(fields, record) {
  const out = {};
  for (const f of fields) {
    const v = record ? record[f.key] : undefined;
    out[f.key] = v == null ? (f.type === 'switch' ? false : (f.default ?? '')) : v;
  }
  return out;
}

/**
 * Checks the required fields; returns `{ key: message }` for the missing ones (empty when fine).
 */
export function validate(fields, values) {
  const errors = {};
  for (const f of fields) {
    const v = values[f.key];
    if (f.required && (v === '' || v == null)) errors[f.key] = `${f.label} is required`;
    else if (f.type === 'number' && v !== '' && v != null && !Number.isFinite(Number(v))) {
      errors[f.key] = `${f.label} must be a number`;
    }
  }
  return errors;
}

/** Values as the server wants them: numbers as numbers, empty strings as null. */
export function toPayload(fields, values) {
  const out = {};
  for (const f of fields) {
    const v = values[f.key];
    if (v === '' || v == null) out[f.key] = f.type === 'switch' ? false : null;
    else if (f.type === 'number') out[f.key] = Number(v);
    else out[f.key] = v;
  }
  return out;
}

const useStyles = makeStyles(() => ({
  wrap: { marginBottom: SPACING.md },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  helper: { fontSize: TYPE.caption, color: SLATE[500] },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, minHeight: 44, marginBottom: SPACING.md },
  switchLabel: { flex: 1, fontSize: TYPE.body, color: SLATE[700] },
  pressed: { opacity: 0.8 },
}));
