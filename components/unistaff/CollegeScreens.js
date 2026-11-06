import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SLATE, SPACING, TOUCH, TYPE } from '../../constants/theme';
import { EmptyState, ScreenScaffold, SegmentedTabs, useToast } from '../ui';
import { usePalette } from '../ui/PaletteContext';
import useStaffResource from '../../hooks/useStaffResource';
import { universityStaffApi as api } from '../../services/portalClients';
import CrudListScreen from '../portal/CrudListScreen';
import PortalHomeScreen from '../portal/PortalHomeScreen';
import ParentTabsScreen from '../parent/ParentTabsScreen';
import FieldInput from '../portal/FieldInput';
import { formatLongDate } from '../../utils/dates';
import { makeStyles } from '../../utils/makeStyles';

/**
 * College Admin, native (5 Nov 2026) — the website's University Staff dashboard for the Vice
 * Chancellor and the Dean: Students, Courses & Academics (academic years → programmes →
 * departments → batches), Test & Examination (courses, exams and marks) and Session Requests to
 * industry. The website's own placeholder sections (attendance, staff, internship, placement,
 * alumni) are not carried over — there is nothing behind them yet.
 */

const A = '/api/college-admin';

export const COLLEGE_TILES = [
  { key: 'students', label: 'Student Management', icon: 'people-outline', route: '/unistaff/college/students' },
  { key: 'academics', label: 'Course & Academic Management', icon: 'library-outline', route: '/unistaff/college/academics' },
  { key: 'exams', label: 'Test & Examination', icon: 'clipboard-outline', route: '/unistaff/college/exams' },
  { key: 'sessions', label: 'Session Request', icon: 'calendar-outline', route: '/unistaff/college/sessions' },
];

export function CollegeHome() {
  const [stats, setStats] = useState(null);
  const load = useCallback(async () => {
    try {
      setStats(await api.get(`${A}/dashboard-stats`));
    } catch {
      setStats(null);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <PortalHomeScreen
      portalLabel={stats?.universityName ? `College Admin · ${stats.universityName}` : 'College Admin'}
      nameKey="universityStaffName"
      tiles={COLLEGE_TILES}
      onRefresh={load}
      changePasswordRoute="/unistaff/change-password"
      stats={
        stats
          ? [
              { label: 'Students', value: stats.totalStudents },
              { label: 'Programmes', value: stats.totalProgrammes },
              { label: 'Departments', value: stats.totalDepartments },
              { label: 'Batches', value: stats.totalBatches },
              { label: 'Staff', value: stats.totalStaff },
              { label: 'Staff awaiting verification', value: stats.pendingStaff },
            ]
          : undefined
      }
    />
  );
}

// ── Students ────────────────────────────────────────────────────────────────

const student = (s) => ({
  title: s.fullName,
  subtitle: [s.currentClass, s.stream].filter(Boolean).join(' · '),
  chips: [s.paid ? { label: s.planName || 'Paid plan', tone: 'success' } : { label: 'College student', tone: 'info' }],
  meta: [['Email', s.email], ['Mobile', s.mobile], ['Subscription', s.subscriptionStatus]],
});

export function CollegeStudents() {
  const load = () => api.get(`${A}/students`);
  return (
    <CrudListScreen
      title="Student Management"
      fallbackRoute="/unistaff/college"
      load={load}
      pick={(d) => d?.students}
      tabs={[
        { value: 'all', label: 'All', filter: () => true },
        { value: 'college', label: 'College', filter: (s) => !s.paid },
        { value: 'paid', label: 'Paid plan', filter: (s) => s.paid },
      ]}
      header={(d) =>
        d?.stats ? (
          <Text style={{ fontSize: TYPE.body, color: SLATE[600], marginBottom: SPACING.sm }}>
            {d.stats.totalStudents ?? 0} students · {d.stats.paidStudents ?? 0} on a paid plan
          </Text>
        ) : null
      }
      emptyTitle="No students yet"
      describe={student}
      itemKey={(s) => s.userId}
    />
  );
}

// ── Courses & Academic Management ───────────────────────────────────────────

const LEVELS = [
  { value: 'UG', label: 'UG' },
  { value: 'PG', label: 'PG' },
  { value: 'DIPLOMA', label: 'Diploma' },
  { value: 'PHD', label: 'PhD' },
];

export function CollegeAcademics() {
  const router = useRouter();
  return (
    <ParentTabsScreen
      title="Course & Academic Management"
      fallbackRoute="/unistaff/college"
      tabs={[
        {
          value: 'programmes',
          label: 'Programmes',
          render: () => (
            <CrudListScreen
              embedded
              load={() => api.get(`${A}/programmes`)}
              create={(v) => api.post(`${A}/programmes`, v)}
              remove={(p) => api.del(`${A}/programmes/${p.id}`)}
              addLabel="Add a programme"
              emptyTitle="No programmes yet"
              describe={(p) => ({
                title: p.name,
                subtitle: [p.code, p.degreeLevel].filter(Boolean).join(' · '),
                meta: [['Semesters', p.totalSemesters], ['Departments', p.departmentCount]],
              })}
              fields={[
                { key: 'name', label: 'Programme name', required: true },
                { key: 'code', label: 'Code' },
                { key: 'degreeLevel', label: 'Degree level', type: 'select', options: LEVELS },
                { key: 'durationYears', label: 'Duration (years)', type: 'number' },
                { key: 'totalSemesters', label: 'Total semesters', type: 'number' },
              ]}
              actions={[
                {
                  key: 'departments',
                  label: 'Departments',
                  icon: 'git-branch-outline',
                  run: async (p) => router.push({ pathname: '/unistaff/college/departments', params: { programmeId: String(p.id), name: p.name } }),
                },
              ]}
            />
          ),
        },
        {
          value: 'years',
          label: 'Academic years',
          render: () => (
            <CrudListScreen
              embedded
              load={() => api.get(`${A}/academic-years`)}
              create={(v) => api.post(`${A}/academic-years`, v)}
              remove={(y) => api.del(`${A}/academic-years/${y.id}`)}
              addLabel="Add an academic year"
              emptyTitle="No academic years yet"
              describe={(y) => ({ title: y.yearLabel, chips: y.current ? [{ label: 'Current', tone: 'success' }] : [] })}
              fields={[{ key: 'yearLabel', label: 'Academic year', required: true, placeholder: 'e.g. 2026-27' }]}
            />
          ),
        },
      ]}
    />
  );
}

export function CollegeDepartments() {
  const router = useRouter();
  const { programmeId, name } = useLocalSearchParams();
  return (
    <CrudListScreen
      title={name ? `${name} · Departments` : 'Departments'}
      fallbackRoute="/unistaff/college/academics"
      load={() => api.get(`${A}/departments?programmeId=${programmeId}`)}
      loadKey={programmeId}
      create={(v) => api.post(`${A}/departments`, { ...v, programmeId: Number(programmeId) })}
      remove={(d) => api.del(`${A}/departments/${d.id}`)}
      addLabel="Add a department"
      emptyTitle="No departments yet"
      describe={(d) => ({ title: d.name, subtitle: d.code, meta: [['Batches', d.batchCount]] })}
      fields={[
        { key: 'name', label: 'Department name', required: true },
        { key: 'code', label: 'Code' },
      ]}
      actions={[
        {
          key: 'batches',
          label: 'Batches',
          icon: 'people-outline',
          run: async (d) => router.push({ pathname: '/unistaff/college/batches', params: { departmentId: String(d.id), name: d.name } }),
        },
      ]}
    />
  );
}

export function CollegeBatches() {
  const { departmentId, name } = useLocalSearchParams();
  const [years, setYears] = useState([]);
  useEffect(() => {
    api.get(`${A}/academic-years`).then((y) => setYears(Array.isArray(y) ? y : [])).catch(() => {});
  }, []);
  return (
    <CrudListScreen
      title={name ? `${name} · Batches` : 'Batches'}
      fallbackRoute="/unistaff/college/academics"
      load={() => api.get(`${A}/batches?departmentId=${departmentId}`)}
      loadKey={departmentId}
      create={(v) => api.post(`${A}/batches`, { ...v, departmentId: Number(departmentId), academicYearId: v.academicYearId ? Number(v.academicYearId) : null })}
      remove={(b) => api.del(`${A}/batches/${b.id}`)}
      addLabel="Add a batch"
      emptyTitle="No batches yet"
      describe={(b) => ({ title: b.name, meta: [['Year', b.currentYear], ['Semester', b.currentSemester], ['Academic year', b.academicYearLabel]] })}
      fields={[
        { key: 'name', label: 'Batch name', required: true, placeholder: 'e.g. 2026–2030' },
        { key: 'currentYear', label: 'Current year', type: 'number' },
        { key: 'currentSemester', label: 'Current semester', type: 'number' },
        { key: 'academicYearId', label: 'Academic year', type: 'select', options: years.map((y) => ({ value: String(y.id), label: y.yearLabel })) },
      ]}
    />
  );
}

// ── Test & Examination ──────────────────────────────────────────────────────

const EXAM_TYPES = [
  { value: 'ONLINE_TEST', label: 'Online Test' },
  { value: 'INTERNAL_ASSESSMENT', label: 'Internal Assessment' },
  { value: 'MID_SEMESTER', label: 'Mid Semester' },
  { value: 'SEMESTER_EXAM', label: 'Semester Examination' },
  { value: 'CUSTOM', label: 'Custom' },
];
const typeLabel = (t) => EXAM_TYPES.find((x) => x.value === t)?.label || t || '—';

/** Programme → department → batch, the three pickers every exam screen starts from. */
function useScope() {
  const [programmes, setProgrammes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [scope, setScope] = useState({ programmeId: '', departmentId: '', batchId: '' });
  useEffect(() => {
    api.get(`${A}/programmes`).then((p) => setProgrammes(Array.isArray(p) ? p : [])).catch(() => {});
  }, []);
  useEffect(() => {
    setDepartments([]);
    if (scope.programmeId) api.get(`${A}/departments?programmeId=${scope.programmeId}`).then((d) => setDepartments(Array.isArray(d) ? d : [])).catch(() => {});
  }, [scope.programmeId]);
  useEffect(() => {
    setBatches([]);
    if (scope.departmentId) api.get(`${A}/batches?departmentId=${scope.departmentId}`).then((b) => setBatches(Array.isArray(b) ? b : [])).catch(() => {});
  }, [scope.departmentId]);
  return { programmes, departments, batches, scope, setScope };
}

export function CollegeExams() {
  const styles = useStyles();
  const router = useRouter();
  const { programmes, departments, batches, scope, setScope } = useScope();
  const [view, setView] = useState('exams');
  const batch = batches.find((b) => String(b.id) === scope.batchId);
  const opt = (list) => list.map((x) => ({ value: String(x.id), label: x.name }));

  const picker = (
    <View style={styles.scope}>
      <FieldInput field={{ key: 'p', label: 'Programme', type: 'select', options: opt(programmes) }} value={scope.programmeId} onChange={(v) => setScope({ programmeId: v, departmentId: '', batchId: '' })} />
      <FieldInput field={{ key: 'd', label: 'Department', type: 'select', options: opt(departments) }} value={scope.departmentId} onChange={(v) => setScope((s) => ({ ...s, departmentId: v, batchId: '' }))} />
      {view === 'exams' ? (
        <FieldInput field={{ key: 'b', label: 'Batch', type: 'select', options: opt(batches) }} value={scope.batchId} onChange={(v) => setScope((s) => ({ ...s, batchId: v }))} />
      ) : null}
    </View>
  );

  const courseKey = scope.departmentId;
  const examKey = `${scope.batchId}`;

  return (
    <ScreenScaffold title="Test & Examination" fallbackRoute="/unistaff/college" scroll={false}>
      <SegmentedTabs
        options={[
          { value: 'exams', label: 'Exams & marks' },
          { value: 'courses', label: 'Courses' },
        ]}
        value={view}
        onChange={setView}
        style={styles.tabs}
      />
      {view === 'courses' ? (
        scope.departmentId ? (
          <CrudListScreen
            key={`c-${courseKey}`}
            embedded
            header={() => picker}
            load={() => api.get(`${A}/courses?departmentId=${scope.departmentId}`)}
            loadKey={scope.departmentId}
            create={(v) => api.post(`${A}/courses`, { ...v, departmentId: Number(scope.departmentId) })}
            remove={(c) => api.del(`${A}/courses/${c.id}`)}
            addLabel="Add a course"
            emptyTitle="No courses in this department yet"
            describe={(c) => ({ title: c.name, subtitle: c.code, meta: [['Semester', c.semester], ['Credits', c.credits], ['Exams', c.examCount]] })}
            fields={[
              { key: 'name', label: 'Course name', required: true },
              { key: 'code', label: 'Code' },
              { key: 'semester', label: 'Semester', type: 'number' },
              { key: 'credits', label: 'Credits', type: 'number' },
            ]}
          />
        ) : (
          <View style={styles.pad}>
            {picker}
            <EmptyState title="Choose a programme and department" message="Its courses appear here." />
          </View>
        )
      ) : scope.batchId ? (
        <ExamList key={`e-${examKey}`} scope={scope} batch={batch} picker={picker} onMarks={(e) => router.push({ pathname: '/unistaff/college/marks', params: { examId: String(e.id), name: `${e.courseName || ''} · ${e.examName || ''}`, max: String(e.maxMarks ?? '') } })} />
      ) : (
        <View style={styles.pad}>
          {picker}
          <EmptyState title="Choose a programme, department and batch" message="Its exams appear here, with marks to enter." />
        </View>
      )}
    </ScreenScaffold>
  );
}

function ExamList({ scope, batch, picker, onMarks }) {
  const [courses, setCourses] = useState([]);
  useEffect(() => {
    api.get(`${A}/courses?departmentId=${scope.departmentId}`).then((c) => setCourses(Array.isArray(c) ? c : [])).catch(() => {});
  }, [scope.departmentId]);
  const examFields = [
    { key: 'examType', label: 'Exam type', type: 'select', options: EXAM_TYPES, default: 'INTERNAL_ASSESSMENT', required: true },
    { key: 'examCode', label: 'Exam code', required: true, placeholder: 'e.g. IA1' },
    { key: 'examName', label: 'Exam name', helper: 'The code is used when left blank' },
    { key: 'maxMarks', label: 'Maximum marks', type: 'number', default: '100' },
    { key: 'examDate', label: 'Exam date', type: 'date' },
  ];
  const body = (v) => ({
    batchId: Number(scope.batchId),
    examType: v.examType,
    examCode: String(v.examCode || '').trim(),
    examName: String(v.examName || v.examCode || '').trim(),
    maxMarks: Number(v.maxMarks) || 100,
    examDate: v.examDate || null,
  });
  return (
    <CrudListScreen
      embedded
      header={() => (
        <>
          {picker}
          <BulkExam batch={batch} fields={examFields} body={body} />
        </>
      )}
      load={() => api.get(`${A}/exams?batchId=${scope.batchId}`)}
      loadKey={scope.batchId}
      create={(v) => api.post(`${A}/exams`, { ...body(v), courseId: Number(v.courseId) })}
      remove={(e) => api.del(`${A}/exams/${e.id}`)}
      addLabel="Add an exam for one course"
      emptyTitle="No exams for this batch yet"
      fields={[{ key: 'courseId', label: 'Course', type: 'select', required: true, options: courses.map((c) => ({ value: String(c.id), label: c.name })) }, ...examFields]}
      describe={(e) => ({
        title: `${e.courseName || ''}${e.courseCode ? ` (${e.courseCode})` : ''}`,
        subtitle: `${e.examName || ''} · ${typeLabel(e.examType)}`,
        meta: [['Date', e.examDate ? formatLongDate(e.examDate) : ''], ['Maximum marks', e.maxMarks], ['Marked', e.rosterSize != null ? `${e.marked ?? 0} of ${e.rosterSize}` : '']],
      })}
      actions={[{ key: 'marks', label: 'Enter marks', icon: 'create-outline', run: async (e) => onMarks(e) }]}
    />
  );
}

/** One exam for every course of the batch's current semester — the website's "Add to all courses". */
function BulkExam({ batch, fields, body }) {
  const styles = useStyles();
  const palette = usePalette();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ examType: 'INTERNAL_ASSESSMENT', examCode: '', examName: '', maxMarks: '100', examDate: '' });
  const [state, setState] = useState('');
  if (!batch) return null;
  return (
    <View style={styles.bulk}>
      <Pressable onPress={() => setOpen((o) => !o)} style={({ pressed }) => [styles.bulkHead, pressed && styles.pressed]} accessibilityRole="button">
        <Ionicons name="layers-outline" size={18} color={palette.primaryDark} />
        <Text style={[styles.bulkTitle, { color: palette.primaryDark }]}>Add one exam to every course of semester {batch.currentSemester ?? '—'}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={palette.primaryDark} />
      </Pressable>
      {open ? (
        <View>
          {fields.map((f) => (
            <FieldInput key={f.key} field={f} value={values[f.key]} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />
          ))}
          <Pressable
            disabled={!values.examCode || state === 'saving'}
            onPress={async () => {
              setState('saving');
              try {
                const res = await api.post(`${A}/exams/bulk`, { ...body(values), semester: batch.currentSemester ?? null });
                setState(`Added to ${res?.created ?? 0} course(s). Pull down to refresh.`);
              } catch (e) {
                setState(e?.message || 'Could not add.');
              }
            }}
            style={({ pressed }) => [styles.primary, { backgroundColor: palette.primary }, (!values.examCode) && styles.disabled, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>{state === 'saving' ? 'Adding…' : 'Add to all courses'}</Text>
          </Pressable>
          {state && state !== 'saving' ? <Text style={styles.note}>{state}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

/** One exam's marks sheet: every student of the batch, marked or not; blank = not marked yet. */
export function CollegeMarks() {
  const styles = useStyles();
  const palette = usePalette();
  const { examId, name, max } = useLocalSearchParams();
  const { toast, showToast } = useToast();
  const fetcher = useCallback(() => api.get(`${A}/exams/${examId}/marks`), [examId]);
  const { data, loading, error, reload } = useStaffResource(fetcher, { initialData: null });
  const [rows, setRows] = useState(null);
  const [saving, setSaving] = useState(false);
  const shown = useMemo(() => rows || data?.rows || [], [rows, data]);
  const setRow = (id, patch) => setRows(shown.map((r) => (r.studentId === id ? { ...r, ...patch } : r)));

  const save = async () => {
    const bad = shown.find((r) => r.status !== 'ABSENT' && r.marksObtained !== '' && r.marksObtained != null && (Number.isNaN(Number(r.marksObtained)) || (max && Number(r.marksObtained) > Number(max))));
    if (bad) {
      showToast(`Check ${bad.studentName}'s mark${max ? ` (out of ${max})` : ''}.`, 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post(`${A}/exams/marks`, {
        examId: Number(examId),
        marks: shown.map((r) => ({
          studentId: r.studentId,
          marksObtained: r.marksObtained === '' || r.marksObtained == null ? null : Number(r.marksObtained),
          status: r.status,
        })),
      });
      showToast(`Saved ${res?.saved ?? 0} mark(s).`, 'success');
      setRows(null);
      reload();
    } catch (e) {
      showToast(e?.message || 'Could not save those marks.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenScaffold title={name || 'Marks'} fallbackRoute="/unistaff/college/exams" loading={loading} error={error} onRetry={reload} toast={toast}>
      {max ? <Text style={styles.note}>Out of {max}. Leave a box blank for "not marked yet".</Text> : null}
      {shown.length === 0 ? <EmptyState title="No students in this batch" /> : null}
      {shown.map((r) => {
        const absent = r.status === 'ABSENT';
        return (
          <View key={r.studentId} style={styles.markRow}>
            <View style={styles.markWho}>
              <Text style={styles.markName}>{r.studentName}</Text>
              {r.admissionNumber ? <Text style={styles.markSub}>{r.admissionNumber}</Text> : null}
            </View>
            <TextInput
              value={absent ? '' : r.marksObtained == null ? '' : String(r.marksObtained)}
              editable={!absent}
              onChangeText={(v) => setRow(r.studentId, { marksObtained: v, status: 'PRESENT' })}
              keyboardType="decimal-pad"
              placeholder="—"
              style={[styles.markInput, absent && styles.markInputOff]}
              accessibilityLabel={`${r.studentName} marks`}
            />
            <Pressable
              onPress={() => setRow(r.studentId, absent ? { status: 'PRESENT' } : { status: 'ABSENT', marksObtained: null })}
              style={({ pressed }) => [styles.absent, absent && { backgroundColor: palette.tint, borderColor: palette.primary }, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityState={{ selected: absent }}
            >
              <Text style={[styles.absentText, absent && { color: palette.primaryDark }]}>Absent</Text>
            </Pressable>
          </View>
        );
      })}
      {shown.length ? (
        <Pressable onPress={save} disabled={saving} style={({ pressed }) => [styles.primary, { backgroundColor: palette.primary }, pressed && styles.pressed]} accessibilityRole="button">
          <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save marks'}</Text>
        </Pressable>
      ) : null}
    </ScreenScaffold>
  );
}

// ── Session Request ─────────────────────────────────────────────────────────

const SESSION_MODES = [
  { value: 'IN_PERSON', label: 'In Person' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'HYBRID', label: 'Hybrid' },
];
const SESSION_CATEGORIES = [
  { value: 'CAREER_GUIDANCE', label: 'Career Guidance' },
  { value: 'INDUSTRY_TALK', label: 'Industry Talk' },
  { value: 'WORKSHOP', label: 'Workshop' },
  { value: 'INTERNSHIP_ORIENTATION', label: 'Internship Orientation' },
  { value: 'TECHNICAL_TRAINING', label: 'Technical Training' },
  { value: 'OTHER', label: 'Other' },
];
const AUDIENCES = [
  { value: 'SCHOOL_STUDENTS', label: 'School Students' },
  { value: 'COLLEGE_STUDENTS', label: 'College Students' },
  { value: 'UNIVERSITY_STUDENTS', label: 'University Students' },
  { value: 'FACULTY', label: 'Faculty' },
  { value: 'OTHER', label: 'Other' },
];
const PLATFORMS = [
  { value: 'GOOGLE_MEET', label: 'Google Meet' },
  { value: 'ZOOM', label: 'Zoom' },
  { value: 'MICROSOFT_TEAMS', label: 'Microsoft Teams' },
  { value: 'OTHER', label: 'Other' },
];
export const SESSION_STATUS_TONE = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'error', COMPLETED: 'info', CANCELLED: 'neutral' };
const lbl = (list, v) => list.find((x) => x.value === v)?.label || v;

/** Only the fields that belong to the chosen mode are sent, as on the website. */
function sessionPayload(v) {
  const out = {
    industryId: Number(v.industryId),
    title: v.title,
    description: v.description,
    category: v.category,
    contactPerson: v.contactPerson,
    contactEmail: v.contactEmail,
    contactNumber: v.contactNumber,
    sessionMode: v.sessionMode,
    preferredDate: v.preferredDate,
    preferredStartTime: v.preferredStartTime,
    durationMinutes: v.durationMinutes ? Number(v.durationMinutes) : 60,
    expectedParticipants: v.expectedParticipants === '' || v.expectedParticipants == null ? null : Number(v.expectedParticipants),
    targetAudience: v.targetAudience,
    preferredInstitution: v.preferredInstitution,
    additionalNotes: v.additionalNotes,
  };
  if (v.sessionMode === 'IN_PERSON' || v.sessionMode === 'HYBRID') {
    Object.assign(out, { venueName: v.venueName, venueAddress: v.venueAddress, venueCity: v.venueCity, facilities: v.facilities });
  }
  if (v.sessionMode === 'ONLINE' || v.sessionMode === 'HYBRID') {
    out.onlinePlatform = v.onlinePlatform;
    if (v.sessionMode === 'ONLINE') out.meetingLink = v.meetingLink;
  }
  return out;
}

export function CollegeSessions() {
  const [industries, setIndustries] = useState([]);
  useEffect(() => {
    api.get(`${A}/session-requests/industries`).then((l) => setIndustries(Array.isArray(l) ? l : [])).catch(() => {});
  }, []);
  const fields = [
    { key: 'sessionMode', label: 'Session mode', type: 'select', options: SESSION_MODES, required: true },
    { key: 'industryId', label: 'Industry', type: 'select', required: true, options: industries.map((i) => ({ value: String(i.id), label: `${i.companyName}${i.industrySector ? ` · ${i.industrySector}` : ''}` })) },
    { key: 'title', label: 'Session title', required: true },
    { key: 'description', label: 'Session description', type: 'multiline', required: true },
    { key: 'category', label: 'Category', type: 'select', options: SESSION_CATEGORIES, required: true },
    { key: 'targetAudience', label: 'Target audience', type: 'select', options: AUDIENCES, required: true },
    { key: 'contactPerson', label: 'Contact person', required: true },
    { key: 'contactEmail', label: 'Contact email', type: 'email', required: true },
    { key: 'contactNumber', label: 'Contact number', type: 'phone' },
    { key: 'preferredDate', label: 'Preferred date', type: 'date', required: true },
    { key: 'preferredStartTime', label: 'Preferred start time', required: true, placeholder: 'HH:MM, e.g. 14:30' },
    { key: 'durationMinutes', label: 'Duration (minutes)', type: 'number', default: '60', helper: 'Between 15 and 720' },
    { key: 'expectedParticipants', label: 'Expected participants', type: 'number' },
    { key: 'preferredInstitution', label: 'Preferred institution / campus' },
    { key: 'venueName', label: 'Venue (in person / hybrid)' },
    { key: 'venueAddress', label: 'Venue address (in person / hybrid)' },
    { key: 'venueCity', label: 'City (in person)' },
    { key: 'facilities', label: 'Facilities available' },
    { key: 'onlinePlatform', label: 'Online platform (online / hybrid)', type: 'select', options: PLATFORMS },
    { key: 'meetingLink', label: 'Meeting link (online)', type: 'url' },
    { key: 'additionalNotes', label: 'Additional notes', type: 'multiline' },
  ];
  return (
    <CrudListScreen
      title="Session Request"
      fallbackRoute="/unistaff/college"
      load={() => api.get(`${A}/session-requests`)}
      create={(v) => api.post(`${A}/session-requests`, sessionPayload(v))}
      update={(r, v) => api.put(`${A}/session-requests/${r.id}`, sessionPayload(v))}
      formFrom={(r) => ({ ...r, industryId: r.industryUserId != null ? String(r.industryUserId) : '' })}
      addLabel="Request a session"
      emptyTitle="No session requests yet"
      emptyMessage="Ask an approved industry for a talk, workshop or orientation. The platform approves it."
      fields={fields}
      describe={(r) => ({
        title: r.title,
        subtitle: r.companyName,
        chips: [{ label: lbl([{ value: 'PENDING', label: 'Pending' }, { value: 'APPROVED', label: 'Approved' }, { value: 'REJECTED', label: 'Rejected' }, { value: 'COMPLETED', label: 'Completed' }, { value: 'CANCELLED', label: 'Cancelled' }], r.status), tone: SESSION_STATUS_TONE[r.status] || 'neutral' }],
        meta: [
          ['Mode', lbl(SESSION_MODES, r.sessionMode)],
          ['Date', r.preferredDate ? formatLongDate(r.preferredDate) : ''],
          ['Starts', r.preferredStartTime],
          ['Duration', r.durationMinutes ? `${r.durationMinutes} min` : ''],
        ],
      })}
      actions={[
        {
          key: 'cancel',
          label: 'Cancel request',
          icon: 'close-circle-outline',
          when: (r) => r.status === 'PENDING' || r.status === 'APPROVED',
          fields: [{ key: 'reason', label: 'Reason', type: 'multiline' }],
          run: (r, v) => api.post(`${A}/session-requests/${r.id}/cancel`, { reason: v.reason }),
          done: 'Request cancelled.',
        },
      ]}
    />
  );
}

const useStyles = makeStyles(() => ({
  tabs: { marginHorizontal: SPACING.md, marginTop: SPACING.sm },
  pad: { padding: SPACING.md },
  scope: { backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: SLATE[200], padding: SPACING.md, marginBottom: SPACING.md },
  bulk: { backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: SLATE[200], padding: SPACING.md, marginBottom: SPACING.md },
  bulkHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, minHeight: TOUCH.min },
  bulkTitle: { flex: 1, fontSize: TYPE.body, fontWeight: '800' },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, minHeight: TOUCH.min, borderRadius: 14, marginTop: SPACING.sm },
  primaryText: { fontSize: TYPE.heading, fontWeight: '800', color: '#ffffff' },
  disabled: { opacity: 0.5 },
  note: { fontSize: TYPE.caption, color: SLATE[600], marginBottom: SPACING.sm, marginTop: SPACING.sm },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1, borderColor: SLATE[200], padding: SPACING.sm, marginBottom: 6 },
  markWho: { flex: 1 },
  markName: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },
  markSub: { fontSize: TYPE.caption, color: SLATE[500] },
  markInput: { width: 72, minHeight: TOUCH.min, borderWidth: 1, borderColor: SLATE[200], borderRadius: 10, textAlign: 'center', fontSize: TYPE.heading, color: SLATE[800] },
  markInputOff: { backgroundColor: SLATE[100] },
  absent: { minHeight: TOUCH.min, paddingHorizontal: SPACING.sm, borderRadius: 10, borderWidth: 1, borderColor: SLATE[200], alignItems: 'center', justifyContent: 'center' },
  absentText: { fontSize: TYPE.caption, fontWeight: '800', color: SLATE[500] },
  pressed: { opacity: 0.8 },
}));
