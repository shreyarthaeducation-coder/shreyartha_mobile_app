import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE } from '../../../constants/theme';
import { Card, EmptyState, ScreenScaffold, SegmentedTabs, TextField, useToast } from '../../ui';
import { usePalette } from '../../ui/PaletteContext';
import { defaultAcademicYear, fetchAcademicYears } from '../../../services/teacher/scopeService';
import {
  REPORT_CARD_TABS,
  addAreasToSections,
  fetchCategorySections,
  fetchNamesInUse,
} from '../../../services/admin/gradeAreaAdminService';

/**
 * Report Card Areas — the website's GradeAreaSetup (School Admin and Principal sidebars).
 *
 * Setting up the report card's graded areas with no exam behind them for every section at once:
 * a teacher can add an area to the sections they take, but a school sets itself up before term,
 * which is the difference between one action and forty. Each section shows how many areas it
 * already has, so the ones that were missed are visible. Adding is idempotent — an area a section
 * already has is left alone. Grades themselves are the teachers' to enter.
 */
export default function ReportCardAreasScreen({ homeRoute }) {
  const PALETTE = usePalette();
  const { toast, showToast } = useToast();
  const [years, setYears] = useState([]);
  const [yearId, setYearId] = useState(null);
  const [tab, setTab] = useState(REPORT_CARD_TABS[0].key);
  const [rows, setRows] = useState([]);
  const [namesInUse, setNamesInUse] = useState([]);
  const [loading, setLoading] = useState(false);
  const [names, setNames] = useState('');
  const [chosen, setChosen] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchAcademicYears()
      .then((list) => {
        if (!alive) return;
        setYears(list);
        setYearId(defaultAcademicYear(list)?.id ?? null);
      })
      .catch(() => alive && setYears([]));
    return () => {
      alive = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!yearId) return;
    setLoading(true);
    try {
      const [sections, used] = await Promise.all([fetchCategorySections(tab, yearId), fetchNamesInUse(tab, yearId)]);
      setRows(sections);
      setNamesInUse(used);
    } catch (e) {
      setRows([]);
      showToast(e?.message || 'Could not load sections.', 'error');
    } finally {
      setLoading(false);
    }
  }, [tab, yearId, showToast]);

  useEffect(() => {
    setChosen([]);
    load();
  }, [load]);

  // Sections grouped by class — the unit an admin thinks in.
  const byClass = useMemo(() => {
    const groups = [];
    const index = new Map();
    rows.forEach((row) => {
      if (!index.has(row.classId)) {
        index.set(row.classId, groups.length);
        groups.push({ classId: row.classId, className: row.className, sections: [] });
      }
      groups[index.get(row.classId)].sections.push(row);
    });
    return groups;
  }, [rows]);

  const toggle = (id) => setChosen((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleClass = (group) =>
    setChosen((prev) => {
      const ids = group.sections.map((s) => s.sectionId);
      const allOn = ids.every((id) => prev.includes(id));
      return allOn ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])];
    });

  const fieldNames = names
    .split(/[\n,]/)
    .map((n) => n.trim())
    .filter(Boolean);
  const active = REPORT_CARD_TABS.find((t) => t.key === tab);

  const apply = async () => {
    if (!fieldNames.length || !chosen.length) return;
    setSaving(true);
    try {
      const res = await addAreasToSections(tab, yearId, fieldNames, chosen);
      showToast(
        `Added ${res?.created ?? 0} area(s) across ${res?.sectionsTouched ?? 0} section(s).${
          res?.alreadyPresent ? ` ${res.alreadyPresent} were already there and were left alone.` : ''
        }`,
        'success',
      );
      setNames('');
      setChosen([]);
      await load();
    } catch (e) {
      showToast(e?.message || 'Could not add those areas.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addName = (name) => {
    if (fieldNames.some((n) => n.toLowerCase() === name.toLowerCase())) return;
    setNames((prev) => (prev.trim() ? `${prev.trim()}\n${name}` : name));
  };

  return (
    <ScreenScaffold title="Report Card Areas" fallbackRoute={homeRoute} scroll={false} toast={toast}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.blurb}>
          The graded areas of the report card that no exam produces. Set them up here for every section at once;
          teachers then record a grade per student under the matching tab on their own dashboard.
        </Text>

        {years.length > 1 ? (
          <View style={styles.chips}>
            {years.map((y) => {
              const on = y.id === yearId;
              return (
                <Pressable
                  key={y.id}
                  onPress={() => setYearId(y.id)}
                  style={[styles.chip, on && { backgroundColor: PALETTE.tint, borderColor: PALETTE.primary }]}
                >
                  <Text style={[styles.chipText, on && { color: PALETTE.primaryDark }]}>{y.yearLabel}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <SegmentedTabs options={REPORT_CARD_TABS.map((t) => ({ value: t.key, label: t.label }))} value={tab} onChange={setTab} />

        {!yearId ? (
          <EmptyState icon="calendar-outline" title="No academic year" message="Set up an academic year first." />
        ) : loading ? (
          <ActivityIndicator size="large" color={PALETTE.primary} style={styles.loader} />
        ) : rows.length === 0 ? (
          <EmptyState icon="school-outline" title="No sections" message="This year has no classes and sections yet." />
        ) : (
          <>
            <Card>
              <TextField
                label={`Areas to add — one per line (e.g. ${active?.example})`}
                value={names}
                onChangeText={setNames}
                multiline
                inputStyle={styles.multiline}
                placeholder={active?.example}
              />
              {namesInUse.length ? (
                <>
                  <Text style={styles.label}>Already used in the school — tap to add</Text>
                  <View style={styles.chips}>
                    {namesInUse.map((n) => (
                      <Pressable key={n} onPress={() => addName(n)} style={styles.chip}>
                        <Text style={styles.chipText}>＋ {n}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}
            </Card>

            <View style={styles.selectRow}>
              <Text style={styles.label}>
                {chosen.length} of {rows.length} section{rows.length === 1 ? '' : 's'} chosen
              </Text>
              <Pressable onPress={() => setChosen(chosen.length === rows.length ? [] : rows.map((r) => r.sectionId))}>
                <Text style={[styles.link, { color: PALETTE.primaryDark }]}>
                  {chosen.length === rows.length ? 'Clear' : 'Choose all'}
                </Text>
              </Pressable>
            </View>

            {byClass.map((group) => {
              const allOn = group.sections.every((s) => chosen.includes(s.sectionId));
              return (
                <Card key={group.classId}>
                  <Pressable onPress={() => toggleClass(group)} style={styles.classHead} accessibilityRole="checkbox" accessibilityState={{ checked: allOn }}>
                    <Ionicons name={allOn ? 'checkbox' : 'square-outline'} size={20} color={allOn ? PALETTE.primary : SLATE[400]} />
                    <Text style={styles.className}>Class {group.className}</Text>
                  </Pressable>
                  {group.sections.map((s) => {
                    const on = chosen.includes(s.sectionId);
                    return (
                      <Pressable key={s.sectionId} onPress={() => toggle(s.sectionId)} style={styles.sectionRow} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                        <Ionicons name={on ? 'checkbox' : 'square-outline'} size={18} color={on ? PALETTE.primary : SLATE[400]} />
                        <Text style={styles.sectionName}>Section {s.sectionName}</Text>
                        <Text style={styles.count}>
                          {s.fieldCount} area{s.fieldCount === 1 ? '' : 's'} · {s.studentCount} student{s.studentCount === 1 ? '' : 's'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </Card>
              );
            })}

            <Pressable
              onPress={apply}
              disabled={saving || !fieldNames.length || !chosen.length}
              style={({ pressed }) => [
                styles.apply,
                { backgroundColor: PALETTE.primary },
                (saving || !fieldNames.length || !chosen.length) && styles.disabled,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.applyText}>
                {saving
                  ? 'Adding…'
                  : `Add ${fieldNames.length || ''} area${fieldNames.length === 1 ? '' : 's'} to ${chosen.length} section${chosen.length === 1 ? '' : 's'}`}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: SPACING.md, paddingBottom: SPACING.xl, gap: SPACING.sm },
  loader: { marginVertical: SPACING.lg },
  blurb: { fontSize: TYPE.body, color: SLATE[600] },
  label: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[700], marginVertical: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: SLATE[200], backgroundColor: '#ffffff' },
  chipText: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[600] },
  multiline: { height: 96, textAlignVertical: 'top' },
  selectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { fontSize: TYPE.label, fontWeight: '700' },
  classHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  className: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, paddingLeft: 6, borderTopWidth: 1, borderTopColor: SLATE[100] },
  sectionName: { flex: 1, fontSize: TYPE.body, color: SLATE[800] },
  count: { fontSize: TYPE.caption, color: SLATE[500] },
  apply: { paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginTop: SPACING.sm },
  applyText: { fontSize: TYPE.body, fontWeight: '700', color: '#ffffff' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
});
