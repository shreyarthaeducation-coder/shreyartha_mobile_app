import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TOUCH, TYPE, leading } from '../../constants/theme';
import { EmptyState, FormSheet, ScreenScaffold, SegmentedTabs, StatusChip, useToast } from '../ui';
import { usePalette } from '../ui/PaletteContext';
import useStaffResource from '../../hooks/useStaffResource';
import FieldInput, { initialValues, toPayload, validate } from './FieldInput';
import { makeStyles } from '../../utils/makeStyles';

/**
 * A list of records with add, edit, delete and per-record actions (5 Nov 2026) — the shape of most
 * pages in the portals carried over from the website (an alumni's education, an industry's
 * eligibility criteria, a placement head's drives, a college's programmes…). Each page is a short
 * description of its records and calls; the list, the forms, the confirmations and the errors are
 * this one screen, so every portal behaves the same.
 *
 * Props:
 *   title, fallbackRoute, embedded
 *   load()                    → the records (an array, or an object `pick` reads the array from)
 *   loadKey                   the filter `load` depends on (an id, a picked type); a change re-fetches
 *   pick(data)                → the array, when `load` returns a wrapper
 *   describe(item)            → `{ title, subtitle, meta: [[label, value]], chips: [{label, tone}], body }`
 *   fields                    the add/edit form (see FieldInput)
 *   create(values), update(item, values), remove(item)   each optional; absent hides the control
 *   formFrom(item)            the edit form's values (default: the record's own keys)
 *   actions                   `[{ key, label, icon, when(item), run(item, values), confirm, done, fields }]`
 *                             — `confirm` a message, or `confirm(item)` for one naming the record
 *                             — with `fields`, the action opens its own small form first (accepting a
 *                             mentorship request asks for a time) and `run` gets the form's values;
 *                             `fieldsFor(item)` instead when the form depends on the record
 *                             — and `initial(item)` prefills that form (a status the record already has)
 *   tabs                      `[{ value, label, filter(item) }]` — optional filter row
 *   header(data, reload)      anything above the list
 *   renderExtra(item)         anything more inside a record's card (a photo, a sub-list)
 *   addLabel, emptyTitle, emptyMessage, itemKey(item)
 */
export default function CrudListScreen({
  title,
  fallbackRoute,
  embedded = false,
  load,
  loadKey,
  pick,
  describe,
  fields = [],
  create,
  update,
  remove,
  formFrom,
  actions = [],
  tabs,
  header,
  addLabel = 'Add',
  emptyTitle = 'Nothing here yet',
  emptyMessage = '',
  itemKey = (item, i) => item?.id ?? i,
  formTitle,
  renderExtra,
}) {
  const styles = useStyles();
  const palette = usePalette();
  const { toast, showToast } = useToast();
  const [tab, setTab] = useState(tabs?.[0]?.value);
  const [editing, setEditing] = useState(null); // { item|null }
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [busyKey, setBusyKey] = useState(null);
  const [asking, setAsking] = useState(null); // { action, item } for an action with a form

  // `load` is almost always an inline arrow, a new function every render, and useStaffResource
  // re-fetches whenever its fetcher changes — so the latest `load` is read through a ref and the
  // fetcher changes only when `loadKey` does (a filter the page passes in). Keying on `load`
  // itself fetched in a loop.
  const loadRef = useRef(load);
  loadRef.current = load;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetcher = useCallback(() => loadRef.current(), [loadKey]);
  const { data, loading, error, refreshing, reload, refresh } = useStaffResource(fetcher, { initialData: null });
  const all = useMemo(() => {
    const raw = pick ? pick(data) : data;
    return Array.isArray(raw) ? raw : [];
  }, [data, pick]);
  const shown = tabs ? all.filter((item) => (tabs.find((t) => t.value === tab)?.filter || (() => true))(item)) : all;

  const open = (item) => {
    setEditing({ item });
    setErrors({});
    setValues(initialValues(fields, item ? (formFrom ? formFrom(item) : item) : null));
  };

  const submit = async () => {
    const found = validate(fields, values);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      const payload = toPayload(fields, values);
      if (editing.item) await update(editing.item, payload);
      else await create(payload);
      setEditing(null);
      showToast(editing.item ? 'Saved.' : 'Added.', 'success');
      reload();
    } catch (e) {
      showToast(e?.message || 'Could not save.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmThen = (message, run) => {
    Alert.alert('Are you sure?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', style: 'destructive', onPress: run },
    ]);
  };

  const runAction = async (key, fn, done) => {
    setBusyKey(key);
    try {
      await fn();
      if (done) showToast(done, 'success');
      reload();
    } catch (e) {
      showToast(e?.message || 'That did not work.', 'error');
    } finally {
      setBusyKey(null);
    }
  };

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
      {header ? header(data, reload) : null}
      {create ? (
        <Pressable
          onPress={() => open(null)}
          style={({ pressed }) => [styles.add, { backgroundColor: palette.primary }, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Ionicons name="add-circle-outline" size={20} color="#ffffff" />
          <Text style={styles.addText}>{addLabel}</Text>
        </Pressable>
      ) : null}
      {tabs ? <SegmentedTabs scrollable={tabs.length > 3} options={tabs} value={tab} onChange={setTab} style={styles.tabs} /> : null}

      {shown.length === 0 ? (
        <EmptyState title={emptyTitle} message={emptyMessage} />
      ) : (
        shown.map((item, i) => {
          const d = describe(item) || {};
          const key = String(itemKey(item, i));
          const itemActions = actions.filter((a) => !a.when || a.when(item));
          return (
            <View key={key} style={styles.card}>
              <View style={styles.head}>
                <View style={styles.headText}>
                  <Text style={styles.title}>{d.title || '—'}</Text>
                  {d.subtitle ? <Text style={styles.subtitle}>{d.subtitle}</Text> : null}
                </View>
                {update ? (
                  <Pressable onPress={() => open(item)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Edit ${d.title || ''}`}>
                    <Ionicons name="create-outline" size={20} color={palette.primaryDark} />
                  </Pressable>
                ) : null}
                {remove ? (
                  <Pressable
                    onPress={() => confirmThen(`Delete "${d.title || 'this'}"?`, () => runAction(`del-${key}`, () => remove(item), 'Deleted.'))}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${d.title || ''}`}
                  >
                    <Ionicons name="trash-outline" size={20} color={SLATE[500]} />
                  </Pressable>
                ) : null}
              </View>
              {d.chips?.length ? (
                <View style={styles.chips}>
                  {d.chips.filter(Boolean).map((c) => (
                    <StatusChip key={c.label} label={c.label} tone={c.tone || 'neutral'} />
                  ))}
                </View>
              ) : null}
              {(d.meta || []).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([label, value]) => (
                <View key={label} style={styles.meta}>
                  <Text style={styles.metaLabel}>{label}</Text>
                  <Text style={styles.metaValue}>{String(value)}</Text>
                </View>
              ))}
              {d.body ? <Text style={styles.body}>{d.body}</Text> : null}
              {renderExtra ? renderExtra(item, reload) : null}
              {itemActions.length ? (
                <View style={styles.actions}>
                  {itemActions.map((a) => {
                    const busy = busyKey === `${a.key}-${key}`;
                    const go = () => {
                      // `fieldsFor(item)`: a form that depends on the record — "Move to" offers only
                      // the statuses the server allows next for that one.
                      const formFields = a.fieldsFor ? a.fieldsFor(item) : a.fields;
                      if (formFields && formFields.length) {
                        setErrors({});
                        setValues(initialValues(formFields, a.initial ? a.initial(item) : null));
                        setAsking({ action: { ...a, fields: formFields }, item, key });
                        return;
                      }
                      runAction(`${a.key}-${key}`, () => a.run(item), a.done);
                    };
                    return (
                      <Pressable
                        key={a.key}
                        disabled={busy}
                        // `confirm` may name the record: a function of it (6 Nov 2026).
                        onPress={() =>
                          a.confirm ? confirmThen(typeof a.confirm === 'function' ? a.confirm(item) : a.confirm, go) : go()
                        }
                        style={({ pressed }) => [styles.action, { borderColor: palette.primary }, pressed && styles.pressed]}
                        accessibilityRole="button"
                      >
                        {a.icon ? <Ionicons name={a.icon} size={16} color={palette.primaryDark} /> : null}
                        <Text style={[styles.actionText, { color: palette.primaryDark }]}>{busy ? '…' : a.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })
      )}

      <FormSheet
        visible={!!asking}
        title={asking?.action.label}
        submitLabel={asking?.action.label}
        onClose={() => setAsking(null)}
        submitting={busyKey === `${asking?.action.key}-${asking?.key}`}
        onSubmit={async () => {
          const found = validate(asking.action.fields, values);
          setErrors(found);
          if (Object.keys(found).length) return;
          const { action, item, key: k } = asking;
          await runAction(`${action.key}-${k}`, () => action.run(item, toPayload(action.fields, values)), action.done);
          setAsking(null);
        }}
      >
        {(asking?.action.fields || []).map((f) => (
          <FieldInput
            key={f.key}
            field={f}
            value={values[f.key]}
            error={errors[f.key]}
            onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
          />
        ))}
      </FormSheet>

      <FormSheet
        visible={!!editing}
        title={formTitle ? formTitle(editing?.item) : editing?.item ? `Edit` : addLabel}
        onClose={() => setEditing(null)}
        onSubmit={submit}
        submitting={saving}
      >
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
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    minHeight: TOUCH.min,
    borderRadius: 14,
    marginBottom: SPACING.md,
  },
  addText: { fontSize: TYPE.heading, fontWeight: '800', color: '#ffffff' },
  tabs: { marginBottom: SPACING.md },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: SLATE[200],
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  headText: { flex: 1 },
  title: { fontSize: TYPE.heading, fontWeight: '800', color: SLATE[800], lineHeight: leading(TYPE.heading) },
  subtitle: { fontSize: TYPE.caption, color: SLATE[600], marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACING.sm },
  meta: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.md, marginTop: 6 },
  metaLabel: { fontSize: TYPE.caption, color: SLATE[500], flexShrink: 0 },
  metaValue: { flex: 1, fontSize: TYPE.caption, fontWeight: '700', color: SLATE[700], textAlign: 'right' },
  body: { fontSize: TYPE.body, color: SLATE[700], marginTop: SPACING.sm, lineHeight: leading(TYPE.body) },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: TOUCH.min,
    paddingHorizontal: SPACING.md,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  actionText: { fontSize: TYPE.label, fontWeight: '800' },
  pressed: { opacity: 0.8 },
}));
