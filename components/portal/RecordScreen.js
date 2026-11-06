import { useCallback, useRef, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TOUCH, TYPE, leading } from '../../constants/theme';
import { FormSheet, ScreenScaffold, useToast } from '../ui';
import { usePalette } from '../ui/PaletteContext';
import useStaffResource from '../../hooks/useStaffResource';
import FieldInput, { initialValues, toPayload, validate } from './FieldInput';
import { makeStyles } from '../../utils/makeStyles';

/**
 * One record shown in sections, with an Edit form (5 Nov 2026) — the profile pages of the portals
 * carried over from the website (alumni profile, university profile & institution, industry
 * profile, investor profile).
 *
 * Props:
 *   title, fallbackRoute, embedded
 *   load()                       → the record
 *   sections                     `[{ title, rows: [[label, key | (record) => value]] }]`
 *   fields, save(values)         the Edit form; absent → read only
 *   photo(record)                an image URL for the header, optional
 *   heading(record), subheading(record)
 *   children(record, reload)     anything below the sections
 */
export default function RecordScreen({
  title,
  fallbackRoute,
  embedded = false,
  load,
  loadKey,
  sections = [],
  fields = [],
  save,
  formFrom,
  photo,
  heading,
  subheading,
  children,
}) {
  const styles = useStyles();
  const palette = usePalette();
  const { toast, showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // `load` is almost always an inline arrow, a new function every render, and useStaffResource
  // re-fetches whenever its fetcher changes — so the latest `load` is read through a ref and the
  // fetcher changes only when `loadKey` does (a filter the page passes in). Keying on `load`
  // itself fetched in a loop.
  const loadRef = useRef(load);
  loadRef.current = load;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetcher = useCallback(() => loadRef.current(), [loadKey]);
  const { data, loading, error, refreshing, reload, refresh } = useStaffResource(fetcher, { initialData: null });
  const record = data || {};

  const open = () => {
    setErrors({});
    setValues(initialValues(fields, formFrom ? formFrom(record) : record));
    setEditing(true);
  };

  const submit = async () => {
    const found = validate(fields, values);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      await save({ ...toPayload(fields, values) }, record);
      setEditing(false);
      showToast('Saved.', 'success');
      reload();
    } catch (e) {
      showToast(e?.message || 'Could not save.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const valueOf = (spec) => {
    const v = typeof spec === 'function' ? spec(record) : record[spec];
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    return String(v);
  };
  const photoUrl = photo ? photo(record) : null;

  return (
    <ScreenScaffold
      title={title}
      fallbackRoute={fallbackRoute}
      embedded={embedded}
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
      toast={toast}
    >
      {heading ? (
        <View style={[styles.hero, { backgroundColor: palette.tint }]}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.photo} />
          ) : (
            <View style={[styles.photo, styles.initial, { backgroundColor: palette.primary }]}>
              <Text style={styles.initialText}>{String(heading(record) || '?').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.heroText}>
            <Text style={[styles.heading, { color: palette.primaryDark }]}>{heading(record) || '—'}</Text>
            {subheading && subheading(record) ? <Text style={styles.subheading}>{subheading(record)}</Text> : null}
          </View>
        </View>
      ) : null}

      {save && fields.length ? (
        <Pressable
          onPress={open}
          style={({ pressed }) => [styles.edit, { borderColor: palette.primary }, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Ionicons name="create-outline" size={18} color={palette.primaryDark} />
          <Text style={[styles.editText, { color: palette.primaryDark }]}>Edit</Text>
        </Pressable>
      ) : null}

      {sections.map((section) => (
        <View key={section.title} style={styles.card}>
          <Text style={[styles.sectionTitle, { color: palette.primaryDark }]}>{section.title}</Text>
          {section.rows.map(([label, spec]) => (
            <View key={label} style={styles.row}>
              <Text style={styles.rowLabel}>{label}</Text>
              <Text style={styles.rowValue}>{valueOf(spec)}</Text>
            </View>
          ))}
        </View>
      ))}

      {children ? children(record, reload, showToast) : null}

      <FormSheet visible={editing} title={`Edit ${title}`} onClose={() => setEditing(false)} onSubmit={submit} submitting={saving}>
        {fields.map((f) => (
          <FieldInput
            key={f.key}
            field={f}
            value={values[f.key]}
            error={errors[f.key]}
            onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
          />
        ))}
      </FormSheet>
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  hero: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, borderRadius: 16, marginBottom: SPACING.md },
  photo: { width: 64, height: 64, borderRadius: 32 },
  initial: { alignItems: 'center', justifyContent: 'center' },
  initialText: { fontSize: TYPE.title, fontWeight: '800', color: '#ffffff' },
  heroText: { flex: 1 },
  heading: { fontSize: TYPE.title, fontWeight: '800' },
  subheading: { fontSize: TYPE.caption, color: SLATE[600], marginTop: 2 },
  edit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    minHeight: TOUCH.min,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: SPACING.md,
  },
  editText: { fontSize: TYPE.heading, fontWeight: '800' },
  card: { backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: SLATE[200], padding: SPACING.md, marginBottom: SPACING.sm },
  sectionTitle: { fontSize: TYPE.label, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.md, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: SLATE[100] },
  rowLabel: { fontSize: TYPE.body, color: SLATE[500], flexShrink: 0, maxWidth: '45%' },
  rowValue: { flex: 1, fontSize: TYPE.body, fontWeight: '600', color: SLATE[800], textAlign: 'right', lineHeight: leading(TYPE.body) },
  pressed: { opacity: 0.8 },
}));
