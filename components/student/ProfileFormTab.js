import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { FEEDBACK, QUIZ, SLATE, SPACING, TYPE } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import { DateTimeField, Select, TextField } from '../ui';
import { StudentCard, StudentCardTitle } from './StudentCard';
import {
  PROFILE_FORMS,
  emptyForm,
  fieldVisible,
} from '../../constants/studentProfileForms';
import { fetchProfileSection, saveProfileSection } from '../../services/student/profileService';

/**
 * One config-driven profile tab.
 *
 * Renders whatever `constants/studentProfileForms.js` declares for `tabKey`, so the five static
 * tabs share this single component instead of five near-identical screens.
 *
 * SAVE SEMANTICS: the sub-profiles POST when no record exists yet and PUT once one does. Whether
 * it exists is decided by the initial GET, tracked in `exists` — `saveProfileSection` applies the
 * rule, but it needs that flag from here.
 *
 * ANDROID KEYBOARD: every field stays mounted for the life of the tab. `dependsOn` fields are the
 * exception and they are genuinely conditional in the web too — but they only ever appear
 * *below* the select that reveals them, never between a focused input and its siblings.
 */

export default function ProfileFormTab({ tabKey, showToast }) {
  const styles = useStyles();
  const palette = usePalette();
  const config = PROFILE_FORMS[tabKey];

  const [form, setForm] = useState(() => emptyForm(tabKey));
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchProfileSection(tabKey);
      // A 200 with an empty body still means "no record yet" for the POST/PUT decision.
      const has = !!data && Object.keys(data).length > 0;
      setExists(has);
      setForm({ ...emptyForm(tabKey), ...(data || {}) });
    } catch (e) {
      // A 404/400 here usually means "not filled in yet", which is a blank form, not an error.
      if (e?.status === 403) setError(e.message || 'This section is not available on your plan.');
      else setForm(emptyForm(tabKey));
      setExists(false);
    } finally {
      setLoading(false);
    }
  }, [tabKey]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    const missing = (config.fields || [])
      .filter((f) => f.required && fieldVisible(f, form) && !String(form[f.key] ?? '').trim())
      .map((f) => f.label);
    if (missing.length) {
      showToast?.(`Please fill in: ${missing.join(', ')}`, 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = { ...form };
      (config.readOnly || []).forEach((k) => delete payload[k]);
      await saveProfileSection(tabKey, payload, exists);
      setExists(true);
      showToast?.('Saved.', 'success');
    } catch (e) {
      showToast?.(e?.message || 'Could not save.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" color={palette.primary} style={styles.loader} />;
  }

  return (
    <>
      <StudentCard>
        <StudentCardTitle>{config.title}</StudentCardTitle>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {(config.fields || []).map((field) => {
          if (!fieldVisible(field, form)) return null;
          const value = form[field.key];
          const readOnly = (config.readOnly || []).includes(field.key);

          if (field.type === 'select') {
            const options = field.options || [];
            return (
              <Select
                key={field.key}
                label={field.label + (field.required ? ' *' : '')}
                value={value || ''}
                options={[{ value: '', label: 'Not set' }, ...options]}
                onChange={(v) => patch(field.key, v)}
                searchable={options.length > 12}
              />
            );
          }

          if (field.type === 'date') {
            return (
              <DateTimeField
                key={field.key}
                label={field.label}
                mode="date"
                value={value || null}
                onChange={(v) => patch(field.key, v ? String(v).slice(0, 10) : '')}
                clearable
              />
            );
          }

          return (
            <TextField
              key={field.key}
              label={field.label + (field.required ? ' *' : '')}
              value={value == null ? '' : String(value)}
              onChangeText={(v) => patch(field.key, v)}
              editable={!readOnly}
              multiline={field.type === 'textarea'}
              inputStyle={field.type === 'textarea' ? styles.textarea : undefined}
              keyboardType={field.type === 'number' ? 'numeric' : 'default'}
              autoCapitalize={field.key.toLowerCase().includes('email') ? 'none' : 'sentences'}
              placeholder={field.placeholder || ''}
            />
          );
        })}
      </StudentCard>

      <Pressable
        onPress={submit}
        disabled={saving}
        style={({ pressed }) => [styles.save, saving && styles.saveOff, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        {saving ? (
          <ActivityIndicator size="small" color={palette.onPrimary} />
        ) : (
          <Text style={styles.saveText}>Save {config.title}</Text>
        )}
      </Pressable>
    </>
  );
}

const useStyles = makeStyles((p) => ({
  loader: { marginVertical: SPACING.xl },
  error: {
    fontSize: TYPE.label,
    color: FEEDBACK.errorText,
    backgroundColor: QUIZ.wrongBg,
    borderRadius: 10,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  textarea: { height: 84, textAlignVertical: 'top' },
  save: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: p.primary,
    marginBottom: SPACING.lg,
  },
  saveOff: { backgroundColor: SLATE[400] },
  saveText: { fontSize: TYPE.heading, fontWeight: '700', color: p.onPrimary },
  pressed: { opacity: 0.8 },
}));
