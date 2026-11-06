import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE } from '../../../constants/theme';
import { EmptyState, ScreenScaffold, Select, StatusChip, useToast } from '../../ui';
import { usePalette } from '../../ui/PaletteContext';
import useStaffResource from '../../../hooks/useStaffResource';
import { staffApi } from '../../../services/staffApi';
import { defaultAcademicYear, fetchAcademicYears } from '../../../services/teacher/scopeService';
import FieldsSheet from '../../portal/FieldsSheet';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * Final Report (5 Nov 2026) — the website's Final Report → Report Cards tab for the Principal and
 * the School Admin, the part a school uses at the end of term: one section's children, each one's
 * remark and the class they go up to, and who may see the cards (the class teacher; the parents —
 * all of them, or chosen children). `/api/school-admin/final-report`, SCHOOL_ADMIN.
 *
 * What stays on the website, opened in the app's web view: drawing and printing the card itself
 * (paginated by the website's own layout code), and the year's setup — Terms & Exams, Card Layout,
 * Subjects. Those are set once a year at a desk; this is what changes in the last week of term.
 */

const BASE = '/api/school-admin/final-report';

/** "Class 7 A" — the server's class name may already read "Class 7" or just "7". */
const sectionName = (className, section) => `${/^class\s/i.test(String(className || '')) ? className : `Class ${className}`} ${section || ''}`.trim();

export default function FinalReportScreen({ roleKey, webPath }) {
  const styles = useStyles();
  const palette = usePalette();
  const { toast, showToast } = useToast();
  const [years, setYears] = useState([]);
  const [yearId, setYearId] = useState(null);
  const [sectionId, setSectionId] = useState(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState('');

  useEffect(() => {
    fetchAcademicYears()
      .then((rows) => {
        setYears(rows);
        setYearId(defaultAcademicYear(rows)?.id ?? null);
      })
      .catch(() => setYears([]));
  }, []);

  const sectionsFetcher = useCallback(
    (signal) => staffApi.get('/api/school-admin/grade-fields/SCHOLASTIC/sections', { params: { academicYearId: yearId }, signal }),
    [yearId],
  );
  const { data: sectionRows } = useStaffResource(sectionsFetcher, { enabled: !!yearId, initialData: [] });
  const sections = Array.isArray(sectionRows) ? sectionRows : [];

  const sheetFetcher = useCallback((signal) => staffApi.get(`${BASE}/sheet`, { params: { sectionId }, signal }), [sectionId]);
  const { data: sheet, loading, error, reload, refreshing, refresh, setData } = useStaffResource(sheetFetcher, {
    enabled: !!sectionId,
    initialData: null,
  });
  const v = sheet?.visibility || {};
  const chosen = v.parentStudentIds || [];

  const students = useMemo(() => {
    const all = sheet?.students || [];
    const q = search.trim().toLowerCase();
    return q ? all.filter((s) => String(s.studentName || '').toLowerCase().includes(q)) : all;
  }, [sheet, search]);

  // Only what changed is sent, so switching parents off and on again keeps a chosen list.
  const saveVisibility = async (patch) => {
    setSaving('visibility');
    try {
      const res = await staffApi.put(`${BASE}/visibility`, { sectionId: sheet.sectionId, ...patch });
      setData((prev) => ({ ...prev, visibility: res }));
      showToast('Saved.', 'success');
    } catch (e) {
      showToast(e?.message || 'Could not save.', 'error');
    } finally {
      setSaving('');
    }
  };

  const shareEverywhere = async (enabled) => {
    setSaving('all');
    try {
      const res = await staffApi.put(`${BASE}/visibility/all`, { classTeacher: enabled });
      setData((prev) => ({ ...prev, visibility: { ...(prev?.visibility || {}), classTeacher: enabled } }));
      const n = res?.sectionsUpdated ?? 0;
      showToast(`${enabled ? 'Shared with' : 'Hidden from'} the class teacher of all ${n} section${n === 1 ? '' : 's'}.`, 'success');
    } catch (e) {
      showToast(e?.message || 'Could not save.', 'error');
    } finally {
      setSaving('');
    }
  };

  const toggleChild = (studentId) => {
    const next = chosen.includes(studentId) ? chosen.filter((id) => id !== studentId) : [...chosen, studentId];
    saveVisibility({ parentScope: 'SELECTED', parentStudentIds: next });
  };

  const openWebsite = () => router.push({ pathname: `/staff/${roleKey}/feature`, params: { path: webPath, label: 'Final Report' } });

  return (
    <ScreenScaffold
      title="Final Report"
      fallbackRoute={`/staff/${roleKey}`}
      loading={!!sectionId && loading}
      error={sectionId ? error : ''}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={sectionId ? refresh : undefined}
      toast={toast}
    >
      <Text style={styles.lead}>
        Each child's remark and next class, and who may see the report cards. The card itself, and the year's terms, layout and subjects, are on the website.
      </Text>
      <Pressable onPress={openWebsite} style={({ pressed }) => [styles.webButton, { borderColor: palette.primary }, pressed && styles.pressed]} accessibilityRole="button">
        <Ionicons name="print-outline" size={18} color={palette.primaryDark} />
        <Text style={[styles.webText, { color: palette.primaryDark }]}>View, print and set up cards on the website</Text>
      </Pressable>

      <View style={styles.scope}>
        <Select
          variant="chip"
          label="Year"
          value={yearId}
          onChange={(y) => {
            setYearId(y);
            setSectionId(null);
          }}
          options={years.map((y) => ({ value: y.id, label: y.current ? `${y.yearLabel} (Current)` : y.yearLabel }))}
          placeholder="Year"
        />
        <Select
          variant="chip"
          label="Section"
          value={sectionId}
          onChange={setSectionId}
          options={sections.map((s) => ({ value: s.sectionId, label: sectionName(s.className, s.sectionName) }))}
          placeholder="Section"
          searchable={sections.length > 10}
        />
      </View>

      {!sectionId ? (
        <EmptyState title="Pick a section" message="Choose a class and section to see its report cards." />
      ) : sheet ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {sectionName(sheet.className, sheet.sectionName)}
              {sheet.academicYearLabel ? ` · ${sheet.academicYearLabel}` : ''}
            </Text>
            {sheet.classTeacher ? <Text style={styles.muted}>Class teacher: {sheet.classTeacher.name || sheet.classTeacher}</Text> : null}
            {sheet.layoutName ? <Text style={styles.muted}>Layout: {sheet.layoutName}</Text> : null}

            <View style={styles.switchRow}>
              <View style={styles.switchText}>
                <Text style={styles.switchLabel}>The class teacher can see these cards</Text>
              </View>
              <Switch value={!!v.classTeacher} disabled={!!saving} onValueChange={(on) => saveVisibility({ classTeacher: on })} />
            </View>
            <Pressable onPress={() => shareEverywhere(!v.classTeacher)} disabled={!!saving} hitSlop={6} accessibilityRole="button">
              <Text style={[styles.link, { color: palette.primaryDark }]}>
                {saving === 'all' ? 'Saving…' : `${v.classTeacher ? 'Hide from' : 'Share with'} every section's class teacher`}
              </Text>
            </Pressable>

            <View style={styles.switchRow}>
              <View style={styles.switchText}>
                <Text style={styles.switchLabel}>Parents can see these cards</Text>
              </View>
              <Switch value={!!v.parents} disabled={!!saving} onValueChange={(on) => saveVisibility({ parents: on })} />
            </View>
            {v.parents ? (
              <View style={styles.scopeRow}>
                {[
                  { value: 'ALL', label: 'Every child' },
                  { value: 'SELECTED', label: 'Chosen children' },
                ].map((o) => {
                  const on = (v.parentScope === 'SELECTED' ? 'SELECTED' : 'ALL') === o.value;
                  return (
                    <Pressable
                      key={o.value}
                      onPress={() => !on && saveVisibility({ parentScope: o.value })}
                      style={[styles.pill, on ? { backgroundColor: palette.primary, borderColor: palette.primary } : { borderColor: SLATE[300] }]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[styles.pillText, { color: on ? palette.onPrimary : SLATE[700] }]}>{o.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search a student…"
            placeholderTextColor={SLATE[400]}
            style={styles.search}
            accessibilityLabel="Search a student"
          />
          {students.length === 0 ? <EmptyState title="No students" message="Nobody in this section matches." /> : null}
          {students.map((st) => {
            const selectedScope = v.parents && v.parentScope === 'SELECTED';
            const shared = selectedScope && chosen.includes(st.studentId);
            return (
              <View key={st.studentId} style={styles.student}>
                <View style={styles.studentHead}>
                  <View style={styles.switchText}>
                    <Text style={styles.name}>{st.studentName}</Text>
                    <Text style={styles.muted}>{[st.rollNumber ? `Roll ${st.rollNumber}` : '', st.admissionNumber ? `Adm. ${st.admissionNumber}` : ''].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <Pressable onPress={() => setEditing(st)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Edit ${st.studentName}'s remark`}>
                    <Ionicons name="create-outline" size={20} color={palette.primaryDark} />
                  </Pressable>
                </View>
                <Text style={styles.remark}>{st.remarks || 'No remark yet.'}</Text>
                <View style={styles.chips}>
                  <StatusChip label={st.promotedTo ? `Promoted to ${st.promotedTo}` : 'Next class not set'} tone={st.promotedTo ? 'success' : 'neutral'} />
                  {selectedScope ? (
                    <Pressable onPress={() => toggleChild(st.studentId)} disabled={!!saving} accessibilityRole="button">
                      <StatusChip label={shared ? 'Parents can see' : 'Not shared with parents'} tone={shared ? 'info' : 'neutral'} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}
        </>
      ) : null}

      <FieldsSheet
        visible={!!editing}
        title={editing ? editing.studentName : ''}
        fields={[
          { key: 'remarks', label: 'Remark', type: 'multiline', maxLength: 2000 },
          { key: 'promotedTo', label: 'Promoted to', type: 'text', placeholder: 'e.g. Class 8' },
        ]}
        initial={editing ? { remarks: editing.remarks || '', promotedTo: editing.promotedTo || '' } : null}
        onSubmit={async (p) => {
          const body = { sectionId: sheet.sectionId, studentId: editing.studentId, remarks: p.remarks || '', promotedTo: p.promotedTo || '' };
          await staffApi.put(`${BASE}/remarks`, body);
          setData((prev) => ({
            ...prev,
            students: (prev?.students || []).map((s) => (s.studentId === editing.studentId ? { ...s, remarks: body.remarks, promotedTo: body.promotedTo } : s)),
          }));
          setEditing(null);
          showToast('Saved.', 'success');
        }}
        onClose={() => setEditing(null)}
      />
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  lead: { fontSize: TYPE.body, color: SLATE[600], marginBottom: SPACING.sm },
  webButton: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, padding: SPACING.sm, marginBottom: SPACING.md },
  webText: { flex: 1, fontSize: TYPE.label, fontWeight: '800' },
  pressed: { opacity: 0.85 },
  scope: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.md },
  card: { backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: SLATE[200], padding: SPACING.md, marginBottom: SPACING.md },
  cardTitle: { fontSize: TYPE.heading, fontWeight: '800', color: SLATE[900] },
  muted: { fontSize: TYPE.caption, color: SLATE[600], marginTop: 2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.md },
  switchText: { flex: 1 },
  switchLabel: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },
  link: { fontSize: TYPE.caption, fontWeight: '800', marginTop: SPACING.xs },
  scopeRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  pill: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  pillText: { fontSize: TYPE.label, fontWeight: '800' },
  search: {
    borderWidth: 1,
    borderColor: SLATE[300],
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontSize: TYPE.body,
    color: SLATE[900],
    backgroundColor: '#ffffff',
    marginBottom: SPACING.md,
  },
  student: { backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1, borderColor: SLATE[200], padding: SPACING.md, marginBottom: SPACING.sm },
  studentHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  name: { fontSize: TYPE.body, fontWeight: '800', color: SLATE[900] },
  remark: { fontSize: TYPE.body, color: SLATE[700], marginTop: SPACING.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACING.sm },
}));
