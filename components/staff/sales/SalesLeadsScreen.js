import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { SLATE, SPACING } from '../../../constants/theme';
import {
  Card,
  ChipMultiSelect,
  EmptyState,
  FormSheet,
  ScreenScaffold,
  Select,
  StatusChip,
  TextField,
  useToast,
} from '../../ui';
import { usePalette } from '../../ui/PaletteContext';
import makeStyles from '../../../utils/makeStyles';
import useStaffResource from '../../../hooks/useStaffResource';
import {
  LEAD_STAGES,
  createLead,
  deleteLead,
  fetchLeads,
  updateLead,
} from '../../../services/sales/salesService';
import {
  GRADE_OPTIONS,
  LEAD_STAGE_TONE,
  formatGrades,
  hasReading,
  humanise,
  normaliseGrades,
  parseGrades,
  readingLabel,
  readingTone,
  shortDate,
} from './salesFormat';

/**
 * The LEAD desk.
 *
 * Pincode is mandatory and validated here as well as on the server, because it is not decoration:
 * it anchors the territory-duplicate check and the geo check on every visit filed against this
 * lead. A lead saved without one silently disables both.
 */

const EMPTY_FORM = {
  schoolName: '',
  board: '',
  city: '',
  state: '',
  pincode: '',
  contactPerson: '',
  contactDesignation: '',
  contactPhone: '',
  expectedStudents: '',
  nextFollowUpDate: '',
  stage: 'NEW',
  // Normalised ascending CSV of grade tokens: "PRE,6,7,8". Stored expanded so the server can
  // answer "which leads teach grade 9" with a LIKE; compressed to "6-8" only for display.
  grades: '',
  notes: '',
};

const STAGE_FILTERS = [{ value: 'ALL', label: 'All stages' }, ...LEAD_STAGES];

export default function SalesLeadsScreen({ homeRoute = '/staff/sales' }) {
  const palette = usePalette();
  const styles = useStyles();
  const { toast, showToast } = useToast();

  const [stage, setStage] = useState('ALL');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetcher = useCallback((signal) => fetchLeads(signal), []);
  const { data, loading, error, refreshing, reload, refresh, revalidate } = useStaffResource(fetcher);

  const leads = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const visible = useMemo(
    () => (stage === 'ALL' ? leads : leads.filter((l) => l.stage === stage)),
    [leads, stage],
  );

  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setSheetOpen(true);
  };

  const openEdit = (lead) => {
    setForm({
      ...EMPTY_FORM,
      ...lead,
      expectedStudents: lead.expectedStudents != null ? String(lead.expectedStudents) : '',
      nextFollowUpDate: lead.nextFollowUpDate || '',
    });
    setEditingId(lead.id);
    setSheetOpen(true);
  };

  const save = async () => {
    if (!form.schoolName.trim()) {
      showToast('School name is required.', 'error');
      return;
    }
    if (!/^\d{6}$/.test(String(form.pincode || '').trim())) {
      showToast('A valid 6-digit pincode is required.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.expectedStudents) delete payload.expectedStudents;
      if (!payload.nextFollowUpDate) delete payload.nextFollowUpDate;

      const saved = editingId ? await updateLead(editingId, payload) : await createLead(payload);

      // Not an error — the save succeeded. The server flags a same-name-same-PIN clash so the rep
      // can decide, because two reps genuinely do work the same building sometimes.
      const clash = saved?.duplicateWarning?.[0];
      if (clash) {
        showToast(
          clash.ownedByAnotherRep
            ? `Saved. Note: ${clash.schoolName} in ${clash.pincode} is already worked by another rep.`
            : `Saved. You already have a lead for ${clash.schoolName} in ${clash.pincode}.`,
          'warning',
        );
      } else {
        showToast('Lead saved.', 'success');
      }
      setSheetOpen(false);
      revalidate();
    } catch (err) {
      showToast(err?.message || 'Could not save the lead.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (lead) => {
    Alert.alert('Delete lead', `Delete the lead for ${lead.schoolName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteLead(lead.id);
            showToast('Lead deleted.', 'success');
            revalidate();
          } catch (err) {
            showToast(err?.message || 'Could not delete the lead.', 'error');
          }
        },
      },
    ]);
  };

  return (
    <ScreenScaffold
      title="LEAD"
      fallbackRoute={homeRoute}
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
      toast={toast}
    >
      <View style={styles.bar}>
        <Select
          variant="chip"
          value={stage}
          options={STAGE_FILTERS}
          onChange={setStage}
          style={styles.filter}
        />
        <Pressable
          onPress={openNew}
          style={({ pressed }) => [
            styles.addBtn,
            { backgroundColor: palette.primaryDark },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
        >
          <Text style={styles.addBtnText}>+ New lead</Text>
        </Pressable>
      </View>

      {visible.length === 0 ? (
        <EmptyState
          icon="flag-outline"
          title={stage === 'ALL' ? 'No leads yet' : 'Nothing at this stage'}
          message={
            stage === 'ALL'
              ? 'Add the first school you are pitching. A pincode is required — it anchors the location check on your visits.'
              : 'Try another stage, or clear the filter.'
          }
        />
      ) : (
        visible.map((lead) => (
          <Card key={lead.id} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.school}>{lead.schoolName}</Text>
              <StatusChip
                label={humanise(lead.stage)}
                tone={LEAD_STAGE_TONE[lead.stage] || 'neutral'}
              />
              {/* The reading from the most recent rated visit. Absent until there is one — an
                  unworked lead has no funnel position, which is not the same as zero. */}
              {hasReading(lead.currentReading) ? (
                <StatusChip
                  label={readingLabel(lead.currentReading)}
                  tone={readingTone(lead.currentReading)}
                />
              ) : null}
            </View>

            <Text style={styles.meta}>
              {[lead.city, lead.pincode].filter(Boolean).join(' · ') || 'No location'}
              {lead.board ? ` · ${lead.board}` : ''}
              {lead.grades ? ` · Grades ${formatGrades(lead.grades)}` : ''}
            </Text>

            {lead.contactPerson ? (
              <Text style={styles.meta}>
                {lead.contactPerson}
                {lead.contactDesignation ? ` · ${lead.contactDesignation}` : ''}
              </Text>
            ) : null}

            <View style={styles.footRow}>
              <Text style={styles.foot}>
                {lead.expectedStudents ? `${lead.expectedStudents} students` : 'Size unknown'}
                {lead.nextFollowUpDate ? ` · follow up ${shortDate(lead.nextFollowUpDate)}` : ''}
              </Text>
              <View style={styles.actions}>
                <Pressable onPress={() => openEdit(lead)} hitSlop={8}>
                  <Text style={[styles.link, { color: palette.link }]}>Edit</Text>
                </Pressable>
                <Pressable onPress={() => confirmDelete(lead)} hitSlop={8}>
                  <Text style={[styles.link, styles.danger]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          </Card>
        ))
      )}

      <FormSheet
        visible={sheetOpen}
        title={editingId ? 'Edit lead' : 'New lead'}
        onClose={() => setSheetOpen(false)}
        onSubmit={save}
        submitLabel="Save lead"
        submitting={saving}
        fullHeight
      >
        <TextField
          label="School name *"
          value={form.schoolName}
          onChangeText={(v) => setForm({ ...form, schoolName: v })}
        />
        <TextField
          label="Pincode *"
          value={form.pincode}
          onChangeText={(v) => setForm({ ...form, pincode: v.replace(/\D/g, '').slice(0, 6) })}
          keyboardType="number-pad"
          maxLength={6}
        />
        <TextField
          label="City"
          value={form.city}
          onChangeText={(v) => setForm({ ...form, city: v })}
        />
        <TextField
          label="Board"
          value={form.board}
          onChangeText={(v) => setForm({ ...form, board: v })}
        />

        <Text style={styles.fieldLabel}>Grades taught</Text>
        <ChipMultiSelect
          options={GRADE_OPTIONS}
          value={parseGrades(form.grades)}
          // Normalised on every change, not on save: the stored value is always the ascending
          // CSV the server expects, whatever order the rep tapped the chips in.
          onChange={(next) => setForm({ ...form, grades: normaliseGrades(next) })}
        />
        <Text style={styles.hint}>
          {form.grades
            ? `Selected: ${formatGrades(form.grades)}`
            : 'Pick every grade this school runs.'}
        </Text>

        <TextField
          label="Contact person"
          value={form.contactPerson}
          onChangeText={(v) => setForm({ ...form, contactPerson: v })}
        />
        <TextField
          label="Their designation"
          value={form.contactDesignation}
          onChangeText={(v) => setForm({ ...form, contactDesignation: v })}
          placeholder="Principal, Director, Trustee…"
        />
        <TextField
          label="Contact phone"
          value={form.contactPhone}
          onChangeText={(v) => setForm({ ...form, contactPhone: v })}
          keyboardType="phone-pad"
        />
        <TextField
          label="Expected students"
          value={form.expectedStudents}
          onChangeText={(v) => setForm({ ...form, expectedStudents: v.replace(/\D/g, '') })}
          keyboardType="number-pad"
        />
        <Select
          label="Stage"
          value={form.stage}
          options={LEAD_STAGES}
          onChange={(v) => setForm({ ...form, stage: v })}
        />
        <TextField
          label="Next follow up (YYYY-MM-DD)"
          value={form.nextFollowUpDate}
          onChangeText={(v) => setForm({ ...form, nextFollowUpDate: v })}
          placeholder="2026-09-15"
        />
        <TextField
          label="Notes"
          value={form.notes}
          onChangeText={(v) => setForm({ ...form, notes: v })}
          multiline
        />
      </FormSheet>
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  filter: { flexShrink: 1 },
  addBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 9,
    borderRadius: 10,
  },
  pressed: { opacity: 0.85 },
  addBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  // The grade picker's own label and helper line. TextField draws its own label; ChipMultiSelect
  // is a bare control, so the form supplies one in the same visual language.
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: SLATE[600],
    marginBottom: 6,
  },
  hint: { fontSize: 12, color: SLATE[400], marginTop: -2, marginBottom: SPACING.sm },
  card: { marginBottom: SPACING.sm },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginBottom: 4,
  },
  school: { flex: 1, fontSize: 15, fontWeight: '700', color: SLATE[800] },
  meta: { fontSize: 12.5, color: SLATE[500], marginTop: 2 },
  footRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  foot: { flex: 1, fontSize: 12, color: SLATE[400] },
  actions: { flexDirection: 'row', gap: SPACING.md },
  link: { fontSize: 13, fontWeight: '600' },
  danger: { color: '#dc2626' },
}));
