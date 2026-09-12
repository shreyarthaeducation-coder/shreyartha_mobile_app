import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE, leading } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import {
  Card,
  CardTitle,
  EmptyState,
  FormSheet,
  ScreenScaffold,
  StatusChip,
  TextField,
  useToast,
} from '../../ui';
import useStaffResource from '../../../hooks/useStaffResource';
import {
  buildScalePayload,
  createGradeScale,
  customiseGradeScales,
  deleteGradeScale,
  fetchGradeScales,
  revertGradeScales,
  updateGradeScale,
} from '../../../services/admin/gradeScaleService';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * Grade Management — the grading scales a school marks against.
 * Mirrors frontendmain/src/components/GradeManagement/GradeManagement.js at scope="SCHOOL".
 *
 * ── A SCHOOL BEGINS BY BORROWING, NOT OWNING ────────────────────────────────
 * Until someone presses "Customise", this school has no scales of its own: it is READING the
 * platform's defaults, and the server refuses every create, edit and delete against them. So the
 * screen hides those actions rather than offering a button that only produces an error. `customised`
 * from the server is the single source of that truth — never inferred from the list being non-empty,
 * because the defaults are a non-empty list too.
 *
 * Reverting is destructive in a way that is easy to miss: it throws away the school's own scales and
 * goes back to following the platform. It asks first, and says what is lost.
 */

const emptyBand = () => ({ minMarks: '', maxMarks: '', grade: '', description: '' });

const emptyDraft = () => ({
  name: '',
  maxMarks: '100',
  appliesTo: '',
  bands: [emptyBand()],
});

export default function GradeManagementScreen({ homeRoute }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const { toast, showToast } = useToast();

  const [editingId, setEditingId] = useState(null); // a scale id, or 'new'
  const [draft, setDraft] = useState(emptyDraft());
  const [busy, setBusy] = useState(false);

  const loader = useCallback((signal) => fetchGradeScales(signal), []);
  const { data, loading, refreshing, error, reload, refresh, revalidate } = useStaffResource(loader);

  const scales = data?.scales || [];
  const customised = !!data?.customised;

  // Every write funnels through here so one refused call cannot leave the sheet half-open with the
  // list showing something the server never accepted.
  const run = async (action, okMessage) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      await revalidate();
      if (okMessage) showToast(okMessage, 'success');
    } catch (e) {
      showToast(e?.message || 'Something went wrong. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const closeSheet = () => {
    setEditingId(null);
    setDraft(emptyDraft());
  };

  const startCreate = () => {
    setEditingId('new');
    setDraft(emptyDraft());
  };

  const startEdit = (scale) => {
    setEditingId(scale.id);
    setDraft({
      name: scale.name || '',
      maxMarks: String(scale.maxMarks ?? 100),
      appliesTo: scale.appliesTo || '',
      bands: (scale.bands || []).length
        ? scale.bands.map((b) => ({
            minMarks: b.minMarks == null ? '' : String(b.minMarks),
            maxMarks: b.maxMarks == null ? '' : String(b.maxMarks),
            grade: b.grade || '',
            description: b.description || '',
          }))
        : [emptyBand()],
    });
  };

  const setBand = (i, key, value) =>
    setDraft((p) => ({
      ...p,
      bands: p.bands.map((b, idx) => (idx === i ? { ...b, [key]: value } : b)),
    }));

  const addBand = () => setDraft((p) => ({ ...p, bands: [...p.bands, emptyBand()] }));

  const removeBand = (i) =>
    setDraft((p) => ({ ...p, bands: p.bands.filter((_, idx) => idx !== i) }));

  const save = () =>
    run(async () => {
      const body = buildScalePayload(draft);
      if (!body.name) throw new Error('Give the scale a name.');
      if (editingId === 'new') await createGradeScale(body);
      else await updateGradeScale(editingId, body);
      closeSheet();
    }, editingId === 'new' ? 'Grading scale created.' : 'Grading scale saved.');

  const confirmDelete = (scale) =>
    Alert.alert(
      'Delete this scale?',
      `"${scale.name}" and all of its grades will be removed.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => run(() => deleteGradeScale(scale.id), 'Grading scale deleted.'),
        },
      ],
    );

  const confirmCustomise = () =>
    Alert.alert(
      'Customise for this school?',
      'The platform scales are copied to your school, and you can then edit them. Reports already '
        + 'published are not changed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Customise',
          onPress: () => run(customiseGradeScales, 'These scales are now your school’s to edit.'),
        },
      ],
    );

  const confirmRevert = () =>
    Alert.alert(
      'Go back to the platform scales?',
      'Your school’s own scales are deleted and you follow the platform defaults again. This '
        + 'cannot be undone.',
      [
        { text: 'Keep mine', style: 'cancel' },
        {
          text: 'Revert',
          style: 'destructive',
          onPress: () => run(revertGradeScales, 'Back on the platform defaults.'),
        },
      ],
    );

  return (
    <ScreenScaffold
      title="Grade Management"
      fallbackRoute={homeRoute}
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
      toast={toast}
    >
      <Card>
        <View style={styles.headRow}>
          <CardTitle>{customised ? 'Your school’s scales' : 'Platform defaults'}</CardTitle>
          <StatusChip
            label={customised ? 'Customised' : 'Following defaults'}
            tone={customised ? 'success' : 'neutral'}
          />
        </View>
        <Text style={styles.body}>
          {customised
            ? 'These belong to your school. Editing one changes how marks are graded from now on.'
            : 'Your school follows the platform’s grading scales. Customise to make your own copy '
              + 'that you can edit.'}
        </Text>

        <View style={styles.actionRow}>
          {customised ? (
            <>
              <Pressable
                onPress={startCreate}
                disabled={busy}
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Ionicons name="add-outline" size={19} color="#ffffff" />
                <Text style={styles.primaryText}>New scale</Text>
              </Pressable>
              <Pressable
                onPress={confirmRevert}
                disabled={busy}
                style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Ionicons name="refresh-outline" size={19} color={PALETTE.primaryDark} />
                <Text style={[styles.secondaryText, { color: PALETTE.primaryDark }]}>
                  Revert to defaults
                </Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={confirmCustomise}
              disabled={busy}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Ionicons name="create-outline" size={19} color="#ffffff" />
              <Text style={styles.primaryText}>Customise for this school</Text>
            </Pressable>
          )}
        </View>
      </Card>

      {scales.length === 0 ? (
        <EmptyState
          icon="school-outline"
          title="No grading scales"
          message="Nothing to grade against yet. Customise for this school to create one."
        />
      ) : (
        scales.map((scale) => (
          <Card key={scale.id}>
            <View style={styles.headRow}>
              <CardTitle>{scale.name}</CardTitle>
              {customised ? (
                <View style={styles.rowActions}>
                  <Pressable
                    onPress={() => startEdit(scale)}
                    disabled={busy}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${scale.name}`}
                  >
                    <Ionicons name="pencil-outline" size={20} color={PALETTE.primaryDark} />
                  </Pressable>
                  <Pressable
                    onPress={() => confirmDelete(scale)}
                    disabled={busy}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${scale.name}`}
                  >
                    <Ionicons name="trash-outline" size={20} color={PALETTE.danger || '#b91c1c'} />
                  </Pressable>
                </View>
              ) : null}
            </View>

            <Text style={styles.meta}>
              Out of {scale.maxMarks}
              {scale.appliesTo ? ` · ${scale.appliesTo}` : ''}
            </Text>

            {(scale.bands || []).length === 0 ? (
              <Text style={styles.body}>No grades on this scale yet.</Text>
            ) : (
              (scale.bands || []).map((b, i) => (
                <View key={`${scale.id}-${i}`} style={styles.bandRow}>
                  <Text style={styles.bandGrade}>{b.grade || '—'}</Text>
                  <Text style={styles.bandRange}>
                    {b.minMarks}–{b.maxMarks}
                  </Text>
                  <Text style={styles.bandDesc} numberOfLines={2}>
                    {b.description || ''}
                  </Text>
                </View>
              ))
            )}
          </Card>
        ))
      )}

      <FormSheet
        visible={editingId !== null}
        title={editingId === 'new' ? 'New grading scale' : 'Edit grading scale'}
        onClose={closeSheet}
        onSubmit={save}
        submitLabel="Save"
      >
        <TextField
          label="Name"
          value={draft.name}
          onChangeText={(t) => setDraft((p) => ({ ...p, name: t }))}
          placeholder="e.g. CBSE Class 10"
        />
        <TextField
          label="Out of (maximum marks)"
          value={draft.maxMarks}
          onChangeText={(t) => setDraft((p) => ({ ...p, maxMarks: t.replace(/[^0-9]/g, '') }))}
          keyboardType="number-pad"
          placeholder="100"
        />
        <TextField
          label="Applies to (optional)"
          value={draft.appliesTo}
          onChangeText={(t) => setDraft((p) => ({ ...p, appliesTo: t }))}
          placeholder="e.g. Classes 9 and 10"
        />

        <Text style={styles.sectionLabel}>Grades</Text>
        {draft.bands.map((b, i) => (
          <View key={i} style={styles.bandEditor}>
            <View style={styles.bandEditorHead}>
              <Text style={styles.bandEditorTitle}>Grade {i + 1}</Text>
              {draft.bands.length > 1 ? (
                <Pressable
                  onPress={() => removeBand(i)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove grade ${i + 1}`}
                >
                  <Ionicons name="close-circle-outline" size={20} color={SLATE[500]} />
                </Pressable>
              ) : null}
            </View>
            <TextField
              label="Grade"
              value={b.grade}
              onChangeText={(t) => setBand(i, 'grade', t)}
              placeholder="A1"
            />
            <View style={styles.bandPair}>
              <View style={styles.bandPairItem}>
                <TextField
                  label="From"
                  value={b.minMarks}
                  onChangeText={(t) => setBand(i, 'minMarks', t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="91"
                />
              </View>
              <View style={styles.bandPairItem}>
                <TextField
                  label="To"
                  value={b.maxMarks}
                  onChangeText={(t) => setBand(i, 'maxMarks', t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="100"
                />
              </View>
            </View>
            <TextField
              label="Description (optional)"
              value={b.description}
              onChangeText={(t) => setBand(i, 'description', t)}
              placeholder="Outstanding"
            />
          </View>
        ))}

        <Pressable
          onPress={addBand}
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Ionicons name="add-outline" size={19} color={PALETTE.primaryDark} />
          <Text style={[styles.secondaryText, { color: PALETTE.primaryDark }]}>Add a grade</Text>
        </Pressable>
      </FormSheet>
    </ScreenScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },

  body: {
    fontSize: TYPE.body,
    color: SLATE[600],
    lineHeight: leading(TYPE.body),
    marginTop: 6,
  },
  meta: { fontSize: TYPE.label, color: SLATE[500], marginTop: 4, marginBottom: 8 },

  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: p.primary,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  primaryText: { color: '#ffffff', fontSize: TYPE.body, fontWeight: '700' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: p.cardBorder,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  secondaryText: { fontSize: TYPE.body, fontWeight: '700' },
  pressed: { opacity: 0.85 },

  bandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: SLATE[200],
  },
  // minWidth, not width: a two-character grade and a three-digit range must both fit without the
  // description column stealing their space or the text clipping at a larger OS font scale.
  bandGrade: { minWidth: 46, fontSize: TYPE.body, fontWeight: '800', color: SLATE[800] },
  bandRange: { minWidth: 78, fontSize: TYPE.label, color: SLATE[600] },
  bandDesc: { flex: 1, fontSize: TYPE.label, color: SLATE[500] },

  sectionLabel: {
    fontSize: TYPE.label,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: SLATE[500],
    marginTop: SPACING.md,
    marginBottom: 6,
  },
  bandEditor: {
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  bandEditorHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  bandEditorTitle: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[700] },
  bandPair: { flexDirection: 'row', gap: SPACING.sm },
  bandPairItem: { flex: 1 },
}));
