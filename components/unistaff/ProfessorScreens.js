import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TYPE } from '../../constants/theme';
import { EmptyState, ScreenScaffold, StatusChip, useToast } from '../ui';
import { usePalette } from '../ui/PaletteContext';
import { universityStaffApi as api } from '../../services/portalClients';
import PortalHomeScreen from '../portal/PortalHomeScreen';
import ParentTabsScreen from '../parent/ParentTabsScreen';
import HrTab from '../staff/profile/HrTab';
import { makeStyles } from '../../utils/makeStyles';

/**
 * The Professor's dashboard (6 Nov 2026) — the website's ProfessorDashboard, which now has one of
 * its own (Associate Dean keeps Faculty): My Profile in three parts, on
 * `/api/college-faculty/professor`.
 *
 *   Personalised Details  who they are at the college, and verification
 *   My Classes            pick batches from the Dean's records: year → programme → departments →
 *                         batches; earlier picks are kept, each can be removed
 *   Personal Details      the staff HR form, against the professor's own record, without payroll
 */

const P = '/api/college-faculty/professor';
const ROOT = '/unistaff/professor';

export const semesterLabel = (n) => {
  if (n === null || n === undefined || n === '') return null;
  const v = Number(n);
  const teen = v % 100 >= 11 && v % 100 <= 13;
  const suffix = teen ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[v % 10] || 'th';
  return `${v}${suffix} sem`;
};
const meta = (parts) => parts.filter((x) => x !== null && x !== undefined && x !== '').join(' · ');

export function ProfessorHome() {
  const [profile, setProfile] = useState(null);
  const load = useCallback(() => api.get(`${P}/profile`).then(setProfile).catch(() => setProfile(null)), []);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <PortalHomeScreen
      portalLabel={profile?.collegeName ? `Professor · ${profile.collegeName}` : 'Professor'}
      nameKey="universityStaffName"
      onRefresh={load}
      changePasswordRoute="/unistaff/change-password"
      tiles={[
        { key: 'details', label: 'Personalised Details', icon: 'person-circle-outline', route: `${ROOT}/profile?tab=details`, blurb: 'Your college, departments and status' },
        { key: 'classes', label: 'My Classes', icon: 'school-outline', route: `${ROOT}/profile?tab=classes`, blurb: 'The batches you teach' },
        { key: 'personal', label: 'Personal Details', icon: 'id-card-outline', route: `${ROOT}/profile?tab=personal`, blurb: 'Your own details and documents' },
      ]}
    />
  );
}

function Details() {
  const styles = useStyles();
  const [state, setState] = useState({ loading: true, profile: null, error: '' });
  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    api
      .get(`${P}/profile`)
      .then((p) => setState({ loading: false, profile: p, error: '' }))
      .catch((e) => setState({ loading: false, profile: null, error: e?.message || 'Could not load your profile.' }));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const p = state.profile || {};
  const departments = p.departments || [];
  return (
    <ScreenScaffold embedded loading={state.loading} error={state.error} onRetry={load}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Personal Information</Text>
        {[
          ['Full Name', p.fullName],
          ['Email', p.email],
          ['Mobile', p.mobile],
          ['College', p.collegeName],
          ['Programme Level', p.programmeLevel || 'Not assigned yet — add your classes under My Classes'],
          ['Designation', p.designation],
          ['Department(s)', departments.length ? departments.join(', ') : 'Not assigned yet'],
        ].map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowValue}>{value || '—'}</Text>
          </View>
        ))}
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Verification Status</Text>
          <StatusChip label={p.verified ? 'Verified' : 'Pending'} tone={p.verified ? 'success' : 'warning'} />
        </View>
      </View>
    </ScreenScaffold>
  );
}

function Chip({ label, on, onPress }) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, on ? { backgroundColor: palette.primary, borderColor: palette.primary } : null]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
    >
      <Text style={[styles.chipText, on && { color: palette.onPrimary }]}>{label}</Text>
    </Pressable>
  );
}

function Classes() {
  const styles = useStyles();
  const palette = usePalette();
  const { toast, showToast } = useToast();
  const [years, setYears] = useState(null);
  const [programmes, setProgrammes] = useState([]);
  const [groups, setGroups] = useState([]);
  const [yearId, setYearId] = useState(null);
  const [programme, setProgramme] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [pickedDepartments, setPickedDepartments] = useState([]);
  const [batchGroups, setBatchGroups] = useState([]);
  const [pickedBatches, setPickedBatches] = useState({});
  const [busy, setBusy] = useState(false);
  const [skipped, setSkipped] = useState([]);

  const load = useCallback(async () => {
    try {
      const [y, p, a] = await Promise.all([api.get(`${P}/academic-years`), api.get(`${P}/programmes`), api.get(`${P}/assignments`)]);
      const list = Array.isArray(y) ? y : [];
      setYears(list);
      setProgrammes(Array.isArray(p) ? p : []);
      setGroups(a?.groups || []);
      const current = list.find((x) => x.current) || list[0];
      setYearId((prev) => prev ?? (current ? current.id : null));
    } catch (e) {
      setYears((prev) => prev || []);
      showToast(e?.message || 'Something went wrong. Please try again.', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  // Departments follow the programme; another programme starts the picks over.
  useEffect(() => {
    setPickedDepartments([]);
    setPickedBatches({});
    setBatchGroups([]);
    if (!programme) {
      setDepartments([]);
      return undefined;
    }
    let live = true;
    api
      .get(`${P}/programmes/${programme.id}/departments`)
      .then((d) => live && setDepartments(Array.isArray(d) ? d : []))
      .catch((e) => live && showToast(e?.message || 'Could not load the departments.', 'error'));
    return () => {
      live = false;
    };
  }, [programme, showToast]);

  const departmentKey = pickedDepartments.join(',');
  useEffect(() => {
    if (!departmentKey) {
      setBatchGroups([]);
      return undefined;
    }
    let live = true;
    api
      .get(`${P}/batches?departmentIds=${departmentKey.split(',').map(encodeURIComponent).join(',')}`)
      .then((g) => live && setBatchGroups(Array.isArray(g) ? g : []))
      .catch((e) => live && showToast(e?.message || 'Could not load the batches.', 'error'));
    return () => {
      live = false;
    };
  }, [departmentKey, showToast]);

  const year = (years || []).find((y) => y.id === yearId) || null;
  const batchCount = useMemo(() => Object.values(pickedBatches).reduce((n, l) => n + l.length, 0), [pickedBatches]);

  const toggleDepartment = (id) => {
    const key = String(id);
    setPickedDepartments((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
    setPickedBatches((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };
  const toggleBatch = (departmentId, batchId) =>
    setPickedBatches((prev) => {
      const key = String(departmentId);
      const list = prev[key] || [];
      return { ...prev, [key]: list.includes(batchId) ? list.filter((x) => x !== batchId) : [...list, batchId] };
    });

  const add = async () => {
    if (!year || !programme || pickedDepartments.length === 0) {
      showToast('Choose an academic year, a programme and at least one department.', 'error');
      return;
    }
    const missing = batchGroups.filter((g) => !(pickedBatches[String(g.departmentId)] || []).length);
    if (missing.length) {
      showToast(`Choose at least one batch in ${missing.map((g) => g.departmentName).join(', ')}.`, 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post(`${P}/assignments`, {
        academicYearId: year.id,
        programmeId: programme.id,
        selections: pickedDepartments.map((d) => ({ departmentId: Number(d), batchIds: pickedBatches[d] || [] })),
      });
      setGroups(res?.groups || []);
      setSkipped((res?.skipped || []).map((s) => `${s.departmentName} · ${s.batchName}: ${s.reason}`));
      const added = (res?.added || []).length;
      showToast(added ? `Added ${added} batch${added === 1 ? '' : 'es'} to My Classes.` : 'Nothing new was added.', added ? 'success' : 'error');
      setPickedBatches({});
    } catch (e) {
      showToast(e?.message || 'Could not add those classes.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = (a, departmentName, yearLabel, programmeName) =>
    Alert.alert('Remove this class?', `${a.batchName} (${departmentName}, ${programmeName}, ${yearLabel})`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await api.del(`${P}/assignments/${a.id}`);
            if (res?.groups) setGroups(res.groups);
            else load();
            showToast('Removed.', 'success');
          } catch (e) {
            showToast(e?.message || 'Could not remove it.', 'error');
          }
        },
      },
    ]);

  return (
    <ScreenScaffold embedded loading={years === null} toast={toast}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add classes</Text>
        <Text style={styles.label}>Academic year</Text>
        <View style={styles.chips}>
          {(years || []).map((y) => (
            <Chip key={y.id} label={y.yearLabel} on={y.id === yearId} onPress={() => setYearId(y.id)} />
          ))}
        </View>
        <Text style={styles.label}>Programme</Text>
        <View style={styles.chips}>
          {programmes.length === 0 ? <Text style={styles.muted}>Your college has not added any programmes yet.</Text> : null}
          {programmes.map((p) => (
            <Chip key={p.id} label={p.code ? `${p.name} (${p.code})` : p.name} on={programme?.id === p.id} onPress={() => setProgramme(p)} />
          ))}
        </View>
        {programme ? (
          <>
            <Text style={styles.label}>Departments</Text>
            <View style={styles.chips}>
              {departments.length === 0 ? <Text style={styles.muted}>No departments in this programme yet.</Text> : null}
              {departments.map((d) => (
                <Chip key={d.id} label={d.name} on={pickedDepartments.includes(String(d.id))} onPress={() => toggleDepartment(d.id)} />
              ))}
            </View>
          </>
        ) : null}
        {batchGroups.map((g) => (
          <View key={g.departmentId}>
            <Text style={styles.label}>Batches — {g.departmentName}</Text>
            <View style={styles.chips}>
              {(g.batches || []).length === 0 ? <Text style={styles.muted}>No batches yet.</Text> : null}
              {(g.batches || []).map((b) => (
                <Chip
                  key={b.id}
                  label={meta([b.name, semesterLabel(b.currentSemester)])}
                  on={(pickedBatches[String(g.departmentId)] || []).includes(b.id)}
                  onPress={() => toggleBatch(g.departmentId, b.id)}
                />
              ))}
            </View>
          </View>
        ))}
        <Pressable
          onPress={add}
          disabled={busy}
          style={({ pressed }) => [styles.primary, { backgroundColor: palette.primary }, (busy || pressed) && styles.pressed]}
          accessibilityRole="button"
        >
          <Ionicons name="add-circle-outline" size={18} color={palette.onPrimary} />
          <Text style={[styles.primaryText, { color: palette.onPrimary }]}>
            {busy ? 'Adding…' : batchCount ? `Add ${batchCount} batch${batchCount === 1 ? '' : 'es'}` : 'Add to My Classes'}
          </Text>
        </Pressable>
        {skipped.map((s) => (
          <Text key={s} style={styles.skipped}>
            • {s}
          </Text>
        ))}
      </View>

      <Text style={styles.section}>My Classes</Text>
      {groups.length === 0 ? <EmptyState title="No classes yet" message="Pick an academic year, a programme, departments and batches above." /> : null}
      {groups.map((y) => (
        <View key={y.yearLabel}>
          <Text style={styles.yearLabel}>Academic Year {y.yearLabel}</Text>
          {(y.programmes || []).flatMap((p) =>
            (p.departments || []).map((d) => (
              <View key={`${p.programmeId}-${d.departmentId}`} style={styles.card}>
                <Text style={styles.cardTitle}>{d.departmentName}</Text>
                <Text style={styles.muted}>{p.programmeName}</Text>
                {(d.assignments || []).map((a) => (
                  <View key={a.id} style={styles.assignment}>
                    <View style={styles.assignmentText}>
                      <Text style={styles.batch}>{a.batchName}</Text>
                      <Text style={styles.muted}>{meta([semesterLabel(a.currentSemester), a.status])}</Text>
                    </View>
                    <Pressable onPress={() => remove(a, d.departmentName, y.yearLabel, p.programmeName)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${a.batchName}`}>
                      <Ionicons name="trash-outline" size={20} color={FEEDBACK.errorText} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )),
          )}
        </View>
      ))}
    </ScreenScaffold>
  );
}

/** The professor's own record for the staff HR form: same verbs, no tax declaration. */
const PERSONAL_API = {
  fetchProfile: () => api.get(`${P}/personal-details`),
  saveProfile: (body) => api.put(`${P}/personal-details`, body),
  uploadPhoto: (file) => api.multipart(`${P}/personal-details/photo`, { files: { file } }),
  fetchPtStates: () => Promise.resolve([]),
};

function Personal() {
  const { toast, showToast } = useToast();
  return (
    <ScreenScaffold embedded toast={toast}>
      <HrTab showToast={showToast} api={PERSONAL_API} payroll={false} />
    </ScreenScaffold>
  );
}

export function ProfessorProfile() {
  return (
    <ParentTabsScreen
      title="My Profile"
      fallbackRoute={ROOT}
      tabs={[
        { value: 'details', label: 'Personalised Details', render: () => <Details /> },
        { value: 'classes', label: 'My Classes', render: () => <Classes /> },
        { value: 'personal', label: 'Personal Details', render: () => <Personal /> },
      ]}
    />
  );
}

const useStyles = makeStyles(() => ({
  card: { backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: SLATE[200], padding: SPACING.md, marginBottom: SPACING.md },
  cardTitle: { fontSize: TYPE.heading, fontWeight: '800', color: SLATE[900], marginBottom: SPACING.xs },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: SLATE[100] },
  rowLabel: { fontSize: TYPE.body, color: SLATE[600] },
  rowValue: { flex: 1, fontSize: TYPE.body, fontWeight: '700', color: SLATE[900], textAlign: 'right' },
  label: { fontSize: TYPE.label, fontWeight: '800', color: SLATE[600], marginTop: SPACING.sm, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1.5, borderColor: SLATE[300], borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#ffffff' },
  chipText: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[700] },
  muted: { fontSize: TYPE.caption, color: SLATE[600], marginTop: 2 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 12, marginTop: SPACING.md },
  primaryText: { fontSize: TYPE.label, fontWeight: '800' },
  pressed: { opacity: 0.85 },
  skipped: { fontSize: TYPE.caption, color: FEEDBACK.warningText, marginTop: 4 },
  section: { fontSize: TYPE.label, fontWeight: '800', color: SLATE[500], textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm },
  yearLabel: { fontSize: TYPE.body, fontWeight: '800', color: SLATE[800], marginBottom: SPACING.xs },
  assignment: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, borderTopWidth: 1, borderTopColor: SLATE[100] },
  assignmentText: { flex: 1 },
  batch: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[900] },
}));
