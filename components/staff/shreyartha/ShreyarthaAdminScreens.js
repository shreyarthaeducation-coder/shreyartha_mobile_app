import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TYPE } from '../../../constants/theme';
import { EmptyState, ScreenScaffold, Select, useToast } from '../../ui';
import { usePalette } from '../../ui/PaletteContext';
import { staffApi } from '../../../services/staffApi';
import CrudListScreen from '../../portal/CrudListScreen';
import ParentTabsScreen from '../../parent/ParentTabsScreen';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * The three pages only the Shreyartha Admin has (6 Nov 2026) — everything else on its website panel
 * is the School Admin's dashboard, which the app already has natively:
 *
 *   Queries                          `/api/shreyartha/admin/**`  student, website and chatbot queries,
 *                                    each assigned to a Shreyartha counsellor
 *   Counsellor & Teacher Management  `/api/admin/counsellors/**` verify counsellors, and link schools
 *                                    to counsellors and teachers
 *   Class Management (SHREYA01)      `/api/shreya01/admin/**`    classes and subjects per school, in bulk
 *
 * All three guards name SHREYARTHA_ADMIN.
 */

const Q = '/api/shreyartha/admin';
const C = '/api/admin/counsellors';
const S = '/api/shreya01/admin';

const when = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};
const MODE = { CALL: 'Phone call', PHONE: 'Phone call', WHATSAPP: 'WhatsApp', EMAIL: 'Email', VIDEO: 'Video call', IN_PERSON: 'In person' };

/* ── Queries ───────────────────────────────────────────────────────────────────────────────── */

function QueryList({ kind, path, assignPath }) {
  const [councellors, setCouncellors] = useState([]);
  useEffect(() => {
    staffApi
      .get(`${Q}/councellors`)
      .then((c) => setCouncellors(Array.isArray(c) ? c : []))
      .catch(() => setCouncellors([]));
  }, []);
  const options = councellors.map((c) => ({ value: String(c.id), label: c.fullName || c.name || c.email }));
  return (
    <CrudListScreen
      embedded
      load={() => staffApi.get(`${Q}/${path}`)}
      emptyTitle="No queries"
      emptyMessage="New queries appear here as they arrive."
      describe={(q) => ({
        title: q.name || q.studentName || q.email || q.studentEmail || `Query #${q.id}`,
        subtitle: [q.subject || q.queryFor || q.selectedCategory, when(q.createdAt)].filter(Boolean).join(' · '),
        chips: [
          q.status ? { label: String(q.status).replace(/_/g, ' ').toLowerCase(), tone: 'info' } : null,
          q.assignedCouncellor || q.assignedCouncellorId
            ? { label: `Assigned: ${q.assignedCouncellor?.fullName || q.assignedCouncellor || 'counsellor'}`, tone: 'success' }
            : { label: 'Not assigned', tone: 'warning' },
        ],
        meta: [
          ['Email', q.email || q.studentEmail],
          ['Phone', q.phone || q.mobile || q.studentMobile],
          ['School', q.schoolName || q.school],
          ['Class / role', q.gradeOrRole || q.userType],
          ['Preferred mode', MODE[q.preferredMode] || q.preferredMode],
          ['Preferred time', q.preferredDateTime ? when(q.preferredDateTime) : ''],
          ['Interest', q.selectedInterest || q.skillCategory],
          ['Problem', q.selectedProblem],
          ['Target exam', q.targetExam || q.specificExamNeed],
          ['Stream', q.recommendedStream],
          ['Pathway', q.arcPathway],
          ['Language', q.languageChoice],
          ['Solution', q.solutionProvided],
        ],
        body: q.message || q.queryDetails,
      })}
      actions={[
        {
          key: 'assign',
          label: 'Assign',
          icon: 'person-add-outline',
          fieldsFor: () => [{ key: 'councellorUserId', label: 'Shreyartha counsellor', type: 'select', options, required: true }],
          initial: (q) => ({ councellorUserId: q.assignedCouncellorId ? String(q.assignedCouncellorId) : '' }),
          run: (q, v) => staffApi.post(`${Q}/${assignPath}/${q.id}/assign`, { councellorUserId: Number(v.councellorUserId) }),
          done: 'Assigned.',
        },
      ]}
      itemKey={(q) => `${kind}-${q.id}`}
    />
  );
}

export function ShreyarthaQueriesScreen({ homeRoute }) {
  return (
    <ParentTabsScreen
      title="Queries"
      fallbackRoute={homeRoute}
      tabs={[
        { value: 'student', label: 'Student queries', render: () => <QueryList kind="STUDENT" path="student-queries" assignPath="student-queries" /> },
        { value: 'website', label: 'Website queries', render: () => <QueryList kind="FORM" path="website-queries" assignPath="website-queries" /> },
        { value: 'chatbot', label: 'Chatbot inquiries', render: () => <QueryList kind="CHATBOT" path="chatbot-inquiries" assignPath="chatbot-inquiries" /> },
      ]}
    />
  );
}

/* ── Counsellor & Teacher Management ───────────────────────────────────────────────────────── */

const linkActions = (base) => [
  {
    key: 'link',
    label: 'Link a school',
    icon: 'link-outline',
    fields: [{ key: 'schoolCode', label: 'School code', type: 'text', required: true }],
    run: (u, v) => staffApi.post(`${base(u)}/link-school`, { schoolCode: String(v.schoolCode).trim().toUpperCase() }),
    done: 'School linked.',
  },
  {
    key: 'unlink',
    label: 'Unlink a school',
    icon: 'unlink-outline',
    when: (u) => (u.linkedSchoolCodes || []).length > 0,
    fieldsFor: (u) => [{ key: 'schoolCode', label: 'School', type: 'select', required: true, options: (u.linkedSchoolCodes || []).map((c) => ({ value: c, label: c })) }],
    run: (u, v) => staffApi.post(`${base(u)}/unlink-school`, { schoolCode: v.schoolCode }),
    done: 'School unlinked.',
  },
];

const person = (u) => ({
  title: u.fullName,
  subtitle: [u.email, u.mobile].filter(Boolean).join(' · '),
  chips: [{ label: u.verified ? 'Verified' : 'Pending', tone: u.verified ? 'success' : 'warning' }],
  meta: [
    ['Own school', u.schoolCode],
    ['Linked schools', (u.linkedSchoolCodes || []).join(', ') || 'None'],
  ],
});

export function CounsellorManagementScreen({ homeRoute }) {
  return (
    <ParentTabsScreen
      title="Counsellor & Teacher Management"
      fallbackRoute={homeRoute}
      tabs={[
        {
          value: 'counsellors',
          label: 'Counsellors',
          render: () => (
            <CrudListScreen
              embedded
              load={() => staffApi.get(C)}
              tabs={[
                { value: 'all', label: 'All' },
                { value: 'verified', label: 'Verified', filter: (u) => !!u.verified },
                { value: 'pending', label: 'Pending', filter: (u) => !u.verified },
              ]}
              emptyTitle="No counsellors"
              describe={person}
              actions={[
                { key: 'verify', label: 'Verify', icon: 'checkmark-circle-outline', when: (u) => !u.verified, run: (u) => staffApi.post(`${C}/${u.id}/verify`, {}), done: 'Verified.' },
                {
                  key: 'unverify',
                  label: 'Unverify',
                  icon: 'close-circle-outline',
                  when: (u) => !!u.verified,
                  confirm: 'Unverify this counsellor? They lose access until verified again.',
                  run: (u) => staffApi.post(`${C}/${u.id}/unverify`, {}),
                  done: 'Unverified.',
                },
                ...linkActions((u) => `${C}/${u.id}`),
              ]}
            />
          ),
        },
        {
          value: 'teachers',
          label: 'Teachers',
          render: () => (
            <CrudListScreen
              embedded
              load={() => staffApi.get(`${C}/teachers`)}
              emptyTitle="No Shreyartha teachers"
              describe={person}
              actions={linkActions((u) => `${C}/teachers/${u.id}`)}
            />
          ),
        },
      ]}
    />
  );
}

/* ── Class Management (SHREYA01) ───────────────────────────────────────────────────────────── */

const CLASS_PRESETS = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'];

export function Shreya01ClassManagementScreen({ homeRoute }) {
  const styles = useStyles();
  const palette = usePalette();
  const { toast, showToast } = useToast();
  const [schools, setSchools] = useState(null);
  const [schoolId, setSchoolId] = useState(null);
  const [classes, setClasses] = useState([]);
  const [klass, setKlass] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [academic, setAcademic] = useState([]);
  const [pickedClasses, setPickedClasses] = useState([]);
  const [customClass, setCustomClass] = useState('');
  const [pickedSubjects, setPickedSubjects] = useState([]);
  const [customSubject, setCustomSubject] = useState('');
  const [busy, setBusy] = useState(false);
  const school = (schools || []).find((s) => s.schoolId === schoolId) || null;

  useEffect(() => {
    staffApi
      .get(`${S}/schools`)
      .then((r) => {
        const list = Array.isArray(r) ? r : [];
        setSchools(list);
        if (list.length === 1) setSchoolId(list[0].schoolId);
      })
      .catch((e) => {
        setSchools([]);
        showToast(e?.message || 'Could not load the schools.', 'error');
      });
  }, [showToast]);

  const loadClasses = useCallback(async () => {
    if (!schoolId) return setClasses([]);
    try {
      const r = await staffApi.get(`${S}/schools/${schoolId}/classes`);
      setClasses(Array.isArray(r) ? r : []);
    } catch (e) {
      showToast(e?.message || 'Could not load the classes.', 'error');
    }
    return undefined;
  }, [schoolId, showToast]);

  useEffect(() => {
    setKlass(null);
    loadClasses();
  }, [loadClasses]);

  const loadSubjects = useCallback(async () => {
    if (!klass) return;
    try {
      const [subs, ac] = await Promise.all([
        staffApi.get(`${S}/classes/${klass.classId}/subjects`),
        staffApi.get(`${S}/schools/${schoolId}/subjects/academic`, { params: { className: klass.className } }).catch(() => []),
      ]);
      setSubjects(Array.isArray(subs) ? subs : []);
      setAcademic(Array.isArray(ac) ? ac : []);
    } catch (e) {
      showToast(e?.message || 'Could not load the subjects.', 'error');
    }
  }, [klass, schoolId, showToast]);

  useEffect(() => {
    setPickedSubjects([]);
    loadSubjects();
  }, [loadSubjects]);

  const existing = useMemo(() => new Set(classes.map((c) => c.className)), [classes]);
  const existingSubjects = useMemo(() => new Set(subjects.map((s) => s.subjectName)), [subjects]);

  const addClasses = async () => {
    const names = [...pickedClasses, ...(customClass.trim() ? [customClass.trim()] : [])];
    if (!names.length) return showToast('Select or enter at least one class', 'error');
    setBusy(true);
    try {
      const res = await staffApi.post(`${S}/schools/${schoolId}/classes/bulk`, { classNames: names });
      showToast(`${res?.added || names.length} class(es) added!`, 'success');
      setPickedClasses([]);
      setCustomClass('');
      loadClasses();
    } catch (e) {
      showToast(e?.message || 'Could not add the classes.', 'error');
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  const addSubjects = async () => {
    const payload = academic.filter((a) => pickedSubjects.includes(a.id)).map((a) => ({ subjectName: a.name, academicIqSubjectId: a.id }));
    if (customSubject.trim()) payload.push({ subjectName: customSubject.trim() });
    if (!payload.length) return showToast('Select at least one subject or enter a custom name', 'error');
    setBusy(true);
    try {
      const res = await staffApi.post(`${S}/classes/${klass.classId}/subjects/bulk`, { subjects: payload });
      showToast(`${res?.added || payload.length} subject(s) added!`, 'success');
      setPickedSubjects([]);
      setCustomSubject('');
      loadSubjects();
      loadClasses();
    } catch (e) {
      showToast(e?.message || 'Could not add the subjects.', 'error');
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  const confirmDelete = (message, run) =>
    Alert.alert('Delete?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: run },
    ]);

  const Chip = ({ label, on, onPress, disabled }) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.chip, on && { backgroundColor: palette.primary, borderColor: palette.primary }, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on, disabled: !!disabled }}
    >
      <Text style={[styles.chipText, on && { color: palette.onPrimary }]}>{label}</Text>
    </Pressable>
  );

  return (
    <ScreenScaffold title="Class Management" fallbackRoute={homeRoute} loading={schools === null} toast={toast}>
      <Select
        label="School"
        value={schoolId}
        onChange={setSchoolId}
        options={(schools || []).map((s) => ({ value: s.schoolId, label: s.schoolName }))}
        placeholder="Choose a school"
        searchable={(schools || []).length > 8}
      />
      {!school ? (
        <EmptyState title="Pick a school" message="Its classes and subjects appear here." />
      ) : klass ? (
        <>
          <Pressable onPress={() => setKlass(null)} style={styles.back} accessibilityRole="button">
            <Text style={[styles.backText, { color: palette.primaryDark }]}>← All classes</Text>
          </Pressable>
          <View style={styles.card}>
            <Text style={styles.title}>
              {klass.className} — subjects ({subjects.length})
            </Text>
            {subjects.length === 0 ? <Text style={styles.muted}>No subjects yet.</Text> : null}
            {subjects.map((s) => (
              <View key={s.id} style={styles.row}>
                <Text style={styles.rowText}>{s.subjectName}</Text>
                <Pressable
                  onPress={() =>
                    confirmDelete(`Delete ${s.subjectName}?`, async () => {
                      try {
                        await staffApi.del(`${S}/subjects/${s.id}`);
                        loadSubjects();
                        loadClasses();
                      } catch (e) {
                        showToast(e?.message || 'Could not delete it.', 'error');
                      }
                    })
                  }
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${s.subjectName}`}
                >
                  <Ionicons name="trash-outline" size={19} color={FEEDBACK.errorText} />
                </Pressable>
              </View>
            ))}
          </View>
          <View style={styles.card}>
            <Text style={styles.title}>Add subjects</Text>
            <Text style={styles.muted}>From Academic IQ for {klass.className}, or type your own.</Text>
            <View style={styles.chips}>
              {academic.map((a) => (
                <Chip
                  key={a.id}
                  label={a.name}
                  on={pickedSubjects.includes(a.id)}
                  disabled={existingSubjects.has(a.name)}
                  onPress={() => setPickedSubjects((p) => (p.includes(a.id) ? p.filter((x) => x !== a.id) : [...p, a.id]))}
                />
              ))}
            </View>
            <TextInput value={customSubject} onChangeText={setCustomSubject} placeholder="Custom subject name" placeholderTextColor={SLATE[400]} style={styles.input} />
            <Pressable onPress={addSubjects} disabled={busy} style={[styles.primary, { backgroundColor: palette.primary }, busy && styles.disabled]} accessibilityRole="button">
              <Text style={[styles.primaryText, { color: palette.onPrimary }]}>{busy ? 'Adding…' : 'Add subjects'}</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.title}>
              {school.schoolName} — classes ({classes.length})
            </Text>
            {classes.length === 0 ? <Text style={styles.muted}>No classes yet.</Text> : null}
            {classes.map((c) => (
              <Pressable key={c.classId} onPress={() => setKlass(c)} style={styles.row} accessibilityRole="button">
                <View style={styles.rowTextWrap}>
                  <Text style={styles.rowText}>{c.className}</Text>
                  <Text style={styles.muted}>{c.subjectCount ?? 0} subject(s)</Text>
                </View>
                <Pressable
                  onPress={() =>
                    confirmDelete(`Delete ${c.className} and its subjects?`, async () => {
                      try {
                        await staffApi.del(`${S}/classes/${c.classId}`);
                        loadClasses();
                      } catch (e) {
                        showToast(e?.message || 'Could not delete it.', 'error');
                      }
                    })
                  }
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${c.className}`}
                >
                  <Ionicons name="trash-outline" size={19} color={FEEDBACK.errorText} />
                </Pressable>
                <Ionicons name="chevron-forward" size={18} color={palette.primaryDark} />
              </Pressable>
            ))}
          </View>
          <View style={styles.card}>
            <Text style={styles.title}>Add classes</Text>
            <View style={styles.chips}>
              {CLASS_PRESETS.map((n) => (
                <Chip
                  key={n}
                  label={n}
                  on={pickedClasses.includes(n)}
                  disabled={existing.has(n)}
                  onPress={() => setPickedClasses((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]))}
                />
              ))}
            </View>
            <TextInput value={customClass} onChangeText={setCustomClass} placeholder="Custom class name" placeholderTextColor={SLATE[400]} style={styles.input} />
            <Pressable onPress={addClasses} disabled={busy} style={[styles.primary, { backgroundColor: palette.primary }, busy && styles.disabled]} accessibilityRole="button">
              <Text style={[styles.primaryText, { color: palette.onPrimary }]}>{busy ? 'Adding…' : 'Add classes'}</Text>
            </Pressable>
          </View>
        </>
      )}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  card: { backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: SLATE[200], padding: SPACING.md, marginTop: SPACING.md },
  title: { fontSize: TYPE.heading, fontWeight: '800', color: SLATE[900], marginBottom: SPACING.xs },
  muted: { fontSize: TYPE.caption, color: SLATE[600], marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, borderTopWidth: 1, borderTopColor: SLATE[100] },
  rowTextWrap: { flex: 1 },
  rowText: { flex: 1, fontSize: TYPE.body, fontWeight: '700', color: SLATE[900] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACING.sm },
  chip: { borderWidth: 1.5, borderColor: SLATE[300], borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#ffffff' },
  chipText: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[700] },
  disabled: { opacity: 0.45 },
  input: { borderWidth: 1, borderColor: SLATE[300], borderRadius: 10, padding: SPACING.sm, fontSize: TYPE.body, color: SLATE[900], marginTop: SPACING.sm },
  primary: { borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: SPACING.md },
  primaryText: { fontSize: TYPE.label, fontWeight: '800' },
  back: { paddingVertical: SPACING.sm },
  backText: { fontSize: TYPE.label, fontWeight: '800' },
}));
