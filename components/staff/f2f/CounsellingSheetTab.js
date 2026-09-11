import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TOUCH, TYPE, leading } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { Card, EmptyState, Select, StatusChip } from '../../ui';
import { SHEET_COLUMNS } from '../../../constants/counsellorReportConfig';
import { fetchReports } from '../../../services/counsellor/activityReportService';
import { shareLocalFile } from '../../../utils/downloadFile';

/**
 * The counselling sheet — every report in a date range, and the CSV of it.
 *
 * ══ A CARD LIST, NOT THE TEN-COLUMN TABLE ══════════════════════════════════
 * The web renders `SHEET_COLUMNS` as a literal ten-column table because it is the shape of the
 * printed document. Ten columns of narrative prose on a 360dp phone is not a table anyone can
 * read — it is ten columns of ellipsis. So the SCREEN shows a card per student with the four
 * narratives in full, and **the CSV keeps all ten columns in their printed order**. The export is
 * the artefact that has to match the sheet; the screen only has to be legible.
 *
 * ══ THE EXPORT IS A SHARE, BECAUSE THERE IS NO DOWNLOADS FOLDER ════════════
 * The web triggers a browser download. An app cannot; the share sheet is the export, and it hands
 * the file to email, Drive or Files. See `shareLocalFile`.
 */
export default function CounsellingSheetTab({ portal }) {
  const styles = useStyles();
  const palette = usePalette();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [months, setMonths] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const to = new Date();
      const from = new Date();
      from.setMonth(from.getMonth() - months);
      const res = await fetchReports(portal.activityReports, {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
        status: status || undefined,
      });
      setRows(Array.isArray(res) ? res : []);
    } catch (e) {
      setError(e?.message || 'Could not load the counselling sheet.');
    } finally {
      setLoading(false);
    }
  }, [portal.activityReports, status, months]);

  useEffect(() => {
    load();
  }, [load]);

  const exportCsv = async () => {
    try {
      const cell = (value) => {
        const s = value == null ? '' : String(value);
        // Quote everything and double any embedded quote. The narratives are free prose and
        // routinely contain commas, newlines and apostrophes; quoting only "when needed" is how a
        // CSV silently gains a column halfway down.
        return `"${s.replace(/"/g, '""')}"`;
      };
      const header = SHEET_COLUMNS.map((c) => cell(c.label)).join(',');
      const body = rows
        .map((r, i) =>
          SHEET_COLUMNS.map((c) => cell(c.key === 'serial' ? i + 1 : r[c.key])).join(','),
        )
        .join('\n');
      // The BOM is load-bearing: without it Excel opens a UTF-8 CSV as Windows-1252 and every
      // name with a diacritic arrives mangled. The web export carries it for the same reason.
      const csv = `﻿${header}\n${body}\n`;
      const name = `counselling-sheet-${new Date().toISOString().slice(0, 10)}.csv`;
      const res = await shareLocalFile(name, csv);
      if (!res.shared) {
        Alert.alert('Saved', `Sharing is unavailable on this device. The file is at ${res.uri}`);
      }
    } catch (e) {
      Alert.alert('Export failed', e?.message || 'Could not build the CSV.');
    }
  };

  return (
    <View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Card>
        <Select
          label="Period"
          value={String(months)}
          options={[
            { value: '1', label: 'Last month' },
            { value: '3', label: 'Last 3 months' },
            { value: '12', label: 'Last year' },
          ]}
          onChange={(v) => setMonths(Number(v))}
        />
        <Select
          label="Status"
          value={status}
          options={[
            { value: '', label: 'All' },
            { value: 'DRAFT', label: 'Draft' },
            { value: 'PUBLISHED', label: 'Published' },
          ]}
          onChange={setStatus}
        />
        <Pressable
          onPress={exportCsv}
          disabled={rows.length === 0}
          style={({ pressed }) => [
            styles.export,
            rows.length === 0 && styles.disabled,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Export the counselling sheet as CSV"
        >
          <Ionicons name="share-outline" size={18} color={palette.primary} />
          <Text style={[styles.exportText, { color: palette.primary }]}>
            {`Export ${rows.length} row${rows.length === 1 ? '' : 's'} as CSV`}
          </Text>
        </Pressable>
      </Card>

      {loading ? (
        <Text style={styles.meta}>Loading the sheet…</Text>
      ) : rows.length === 0 ? (
        <EmptyState message="No counselling reports in this period." />
      ) : (
        rows.map((r, i) => (
          <Card key={r.id || i}>
            <View style={styles.head}>
              <View style={styles.headText}>
                <Text style={styles.name}>{r.studentName || '—'}</Text>
                <Text style={styles.meta}>
                  {[r.grade, r.schoolName, r.counsellingDate].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <StatusChip
                label={r.status || 'DRAFT'}
                tone={r.status === 'PUBLISHED' ? 'success' : 'neutral'}
              />
            </View>

            {/* The four narratives in full. These are the columns the sheet exists for, and
                truncating them here would make the screen a worse version of the CSV. */}
            {SHEET_COLUMNS.filter((c) =>
              ['cognitivePotential', 'thinking', 'counsellorObservation', 'recommendation'].includes(c.key),
            ).map((c) =>
              r[c.key] ? (
                <View key={c.key} style={styles.field}>
                  <Text style={styles.fieldLabel}>{c.label}</Text>
                  <Text style={styles.fieldValue}>{r[c.key]}</Text>
                </View>
              ) : null,
            )}
          </Card>
        ))
      )}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  error: {
    fontSize: TYPE.caption,
    color: FEEDBACK.errorOnBg,
    backgroundColor: FEEDBACK.errorBg,
    borderRadius: 10,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  headText: { flex: 1, minWidth: 0 },
  name: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },
  meta: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 2 },

  field: { marginTop: SPACING.sm },
  fieldLabel: { fontSize: TYPE.micro, fontWeight: '800', color: SLATE[500], textTransform: 'uppercase' },
  fieldValue: { fontSize: TYPE.caption, color: SLATE[700], lineHeight: leading(TYPE.caption), marginTop: 2 },

  export: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: TOUCH.min,
    marginTop: SPACING.sm,
  },
  exportText: { fontSize: TYPE.label, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
}));
