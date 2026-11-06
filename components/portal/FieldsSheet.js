import { useEffect, useState } from 'react';
import { FormSheet } from '../ui';
import FieldInput, { initialValues, toPayload, validate } from './FieldInput';

/**
 * A form in a bottom sheet from a list of fields (5 Nov 2026) — for a screen that is not a
 * CrudListScreen but still has one-off forms (an HR employee's employment details, a probation
 * extension). `onSubmit(payload)` may throw; its message stays in the sheet. `fields` may be a
 * function of the values typed so far, for a field that only applies to one choice of another.
 * `children` render below the fields (the CRM email's attachments).
 */
export default function FieldsSheet({ visible, title, subtitle, fields, initial, submitLabel = 'Save', onSubmit, onClose, children }) {
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState('');
  const list = typeof fields === 'function' ? fields(values) : fields;

  useEffect(() => {
    if (!visible) return;
    setValues(initialValues(typeof fields === 'function' ? fields(initial || {}) : fields, initial || null));
    setErrors({});
    setFailed('');
    // Reset only when the sheet opens; the fields can change while it is open (a select that
    // reveals another field) and must not wipe what was typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const submit = async () => {
    const found = validate(list, values);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    setFailed('');
    try {
      await onSubmit(toPayload(list, values), values);
    } catch (e) {
      setFailed(e?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      visible={visible}
      title={title}
      subtitle={failed || subtitle}
      submitLabel={submitLabel}
      submitting={saving}
      onClose={onClose}
      onSubmit={submit}
    >
      {list.map((f) => (
        <FieldInput
          key={f.key}
          field={f}
          value={values[f.key]}
          error={errors[f.key]}
          onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
        />
      ))}
      {children}
    </FormSheet>
  );
}
