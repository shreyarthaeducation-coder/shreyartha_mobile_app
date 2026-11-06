import { useEffect, useMemo, useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import * as Print from 'expo-print';
import { SLATE, SPACING, TYPE, leading } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { Select } from '../../ui';
import { makeStyles } from '../../../utils/makeStyles';
import { staffApi } from '../../../services/staffApi';
import CrudListScreen from '../../portal/CrudListScreen';
import ParentTabsScreen from '../../parent/ParentTabsScreen';

/**
 * Parent Management (6 Nov 2026) — the website's School/shared/parentManagement, for the School
 * Admin and Principal (`admin`) and the class teacher (`teacher`).
 *
 * The school half of My Children: parents who asked to be linked with their child's mobile or
 * email wait here to be verified (Verify & link / Reject), and per section the codes that link a
 * parent or a student straight away, with the parents already linked (Unlink) and printable slips.
 * A phone has no clipboard module in this app, so "Copy" is Share — the code goes wherever the
 * member of staff sends it.
 */

const MODES = {
  admin: {
    requests: '/api/school-admin/parents/requests',
    codes: '/api/school-admin/students/link-codes',
    sections: (yearId) => `/api/school-admin/classes?academicYearId=${yearId}`,
    toSections: (res) => {
      const classes = Array.isArray(res) ? res : res?.data || res?.classes || [];
      return classes.flatMap((cls) =>
        (cls.sections || []).map((sec) => ({ value: String(sec.id), label: `Class ${cls.className} - ${sec.sectionName}` })),
      );
    },
  },
  teacher: {
    requests: '/api/teacher/parents/requests',
    codes: '/api/teacher/students/link-codes',
    sections: (yearId) => `/api/teacher/class-teacher/mine?academicYearId=${yearId}`,
    toSections: (res) =>
      (Array.isArray(res) ? res : []).map((sec) => ({
        value: String(sec.sectionId),
        label: `Class ${sec.className} - ${sec.sectionName}`,
      })),
  },
};

const PARENT = 'PARENT';
const STUDENT = 'STUDENT';
const SITE = 'https://shreyartha.com';

const day = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

/** The website's printSlips page, word for word (School/shared/linkCodes/printSlips.js). */
function slipsHtml(sheet, type) {
  const isParent = type === PARENT;
  const heading = isParent ? 'Parent link code' : 'Student code';
  const place = [sheet.className && `Class ${sheet.className}`, sheet.sectionName && `Section ${sheet.sectionName}`]
    .filter(Boolean)
    .join(', ');
  const steps = isParent
    ? `<li>New here? Go to ${SITE}/parentlogin, and enter this code when you register.</li>
      <li>Already registered? Sign in at ${SITE}/signin, open My Children, and enter this code.</li>`
    : `<li>New here? Go to ${SITE}/studentlogin, choose "I have a student code", and enter this code.</li>
    <li>Already have an account? Sign in at ${SITE}/signin, and enter this code on your dashboard.</li>`;
  const slips = (sheet.rows || [])
    .filter((row) => (isParent ? row.parentCode : row.studentCode))
    .map(
      (row) => `
      <section class="slip">
        <h2>${heading}</h2>
        <p class="who">${escapeHtml(row.studentName)}${place ? ` &middot; ${escapeHtml(place)}` : ''}</p>
        ${sheet.schoolName ? `<p class="school">${escapeHtml(sheet.schoolName)}</p>` : ''}
        <div class="code">${escapeHtml(isParent ? row.parentCode : row.studentCode)}</div>
        <ol>${steps}</ol>
        <p class="keep">${isParent ? 'Both parents can use this code. Please keep it private.' : 'This code works once. Please do not share it.'}</p>
      </section>`,
    )
    .join('');
  const style = `
  body { font-family: Arial, Helvetica, sans-serif; margin: 0; color: #111; }
  .slips { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; padding: 8mm; }
  .slip { border: 1px dashed #666; padding: 5mm; break-inside: avoid; page-break-inside: avoid; }
  .slip h2 { font-size: 13pt; margin: 0 0 2mm; }
  .slip .who { font-size: 11pt; margin: 0 0 3mm; }
  .slip .school { font-size: 9pt; color: #444; margin: 0 0 3mm; }
  .slip .code { font: bold 18pt "Courier New", monospace; letter-spacing: 1px; border: 1px solid #111; padding: 2mm 3mm; display: inline-block; margin-bottom: 3mm; }
  .slip ol { font-size: 9pt; margin: 0; padding-left: 5mm; }
  .slip li { margin-bottom: 1mm; }
  .slip .keep { font-size: 8pt; color: #444; margin: 2mm 0 0; }`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${heading}s</title><style>${style}</style></head>
    <body><div class="slips">${slips}</div></body></html>`;
}

function Requests({ config }) {
  return (
    <CrudListScreen
      embedded
      load={() => staffApi.get(config.requests)}
      itemKey={(r) => r.requestId}
      emptyTitle="Nobody is waiting"
      emptyMessage="No parent is waiting to be verified."
      header={() => (
        <Text style={plain.note}>
          A parent links to their child in one of two ways. With the parent code from this school they are linked and
          verified at once. With their child&apos;s mobile or email they ask, and wait here for you to verify them.
        </Text>
      )}
      describe={(r) => ({
        title: r.parentName,
        subtitle: [r.parentMobile, r.parentEmail].filter(Boolean).join(' · '),
        meta: [
          ['Asked to link', r.studentName],
          ['Class', r.className || r.sectionName ? `${r.className || '-'}${r.sectionName ? ` - ${r.sectionName}` : ''}` : ''],
          ['They typed', r.typedValue],
          ['Asked on', day(r.requestedAt)],
        ],
      })}
      actions={[
        {
          key: 'approve',
          label: 'Verify & link',
          icon: 'checkmark-circle-outline',
          run: (r) => staffApi.post(`${config.requests}/${r.requestId}/approve`, {}),
          done: 'Verified and linked.',
        },
        {
          key: 'reject',
          label: 'Reject',
          icon: 'close-circle-outline',
          confirm: (r) =>
            `Reject ${r.parentName}'s request to be linked to ${r.studentName}? Their account stays, but they will not be linked or verified.`,
          run: (r) => staffApi.del(`${config.requests}/${r.requestId}`),
          done: 'Request rejected.',
        },
      ]}
    />
  );
}

function Codes({ config, mode }) {
  const styles = useStyles();
  const palette = usePalette();
  const [years, setYears] = useState([]);
  const [yearId, setYearId] = useState('');
  const [sections, setSections] = useState(null);
  const [sectionId, setSectionId] = useState('');
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    staffApi
      .get('/api/school/academic-years')
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.data || [];
        setYears(list.map((y) => ({ value: String(y.id), label: y.yearLabel || y.name || y.label || String(y.id), current: y.current || y.isCurrent })));
        const current = list.find((y) => y.current || y.isCurrent) || list[0];
        if (current) setYearId(String(current.id));
      })
      .catch(() => setYears([]));
  }, []);

  useEffect(() => {
    if (!yearId) return undefined;
    let live = true;
    setSections(null);
    staffApi
      .get(config.sections(yearId))
      .then((res) => {
        if (!live) return;
        const list = config.toSections(res);
        setSections(list);
        setSectionId((cur) => (list.some((s) => s.value === cur) ? cur : list.length === 1 ? list[0].value : ''));
      })
      .catch(() => live && setSections([]));
    return () => {
      live = false;
    };
  }, [yearId, config]);

  const base = config.codes;
  const make = async (types) => {
    setBusy(true);
    setNotice('');
    try {
      const made = {};
      for (const type of types) made[type] = (await staffApi.post(base, { sectionId: Number(sectionId), type }))?.made || 0;
      const total = Object.values(made).reduce((a, b) => a + b, 0);
      setNotice(
        total
          ? types.map((t) => `${made[t]} ${t === PARENT ? 'parent' : 'student'} code${made[t] === 1 ? '' : 's'}`).join(' and ') + ' made.'
          : 'Everyone who can have a code already has one.',
      );
      setSheet((s) => ({ ...(s || {}), stamp: Date.now() }));
    } catch (e) {
      setNotice(e?.message || 'That did not work. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const printSlips = (type) => {
    if (!sheet?.rows) return;
    Print.printAsync({ html: slipsHtml(sheet, type) }).catch(() => {});
  };

  const loadKey = useMemo(() => `${sectionId}:${sheet?.stamp || 0}`, [sectionId, sheet?.stamp]);
  const parentSlips = (sheet?.rows || []).filter((r) => r.parentCode).length;
  const studentSlips = (sheet?.rows || []).filter((r) => r.studentCode).length;

  const codeActions = (type, label, field) => [
    {
      key: `share-${type}`,
      label: `Share ${label} code`,
      icon: 'share-outline',
      when: (row) => !!row[field],
      run: (row) => Share.share({ message: row[field] }),
    },
    {
      key: `make-${type}`,
      label: `Make ${label} code`,
      icon: 'add-circle-outline',
      when: (row) => !row[field] && (type === PARENT || row.studentCodeAllowed),
      confirm:
        type === STUDENT
          ? (row) =>
              row.accountStatus === 'LOGIN'
                ? `${row.studentName} already has a login. The student who enters this code signs in with their own account from then on, and the current login stops working.`
                : `Make a student code for ${row.studentName}?`
          : undefined,
      run: (row) => staffApi.post(base, { sectionId: Number(sectionId), type, studentId: row.studentId }),
      done: 'Code made.',
    },
    {
      key: `replace-${type}`,
      label: `Replace ${label} code`,
      icon: 'refresh-outline',
      when: (row) => !!row[field],
      confirm: (row) =>
        `Replace ${row.studentName}'s ${label} code? The old slip stops working immediately. Anyone already linked stays linked.`,
      run: (row) => staffApi.post(base, { sectionId: Number(sectionId), type, studentId: row.studentId }),
      done: 'Code replaced. Print a new slip.',
    },
    {
      key: `remove-${type}`,
      label: `Remove ${label} code`,
      icon: 'trash-outline',
      when: (row) => !!row[field],
      confirm: (row) => `Remove ${row.studentName}'s ${label} code? The slip stops working. Anyone already linked stays linked.`,
      run: (row) => staffApi.del(`${base}/${row.studentId}/${type}?sectionId=${sectionId}`),
      done: 'Code removed.',
    },
  ];

  return (
    <View style={styles.flex}>
      <View style={styles.pickers}>
        <Select label="Academic year" value={yearId} options={years} onChange={setYearId} placeholder="Choose…" />
        <Select
          label="Section"
          value={sectionId}
          options={sections || []}
          onChange={setSectionId}
          placeholder={sections && !sections.length ? 'No sections' : 'Choose a section'}
          searchable={(sections || []).length > 12}
        />
        {sections && !sections.length && yearId ? (
          <Text style={styles.note}>
            {mode === 'teacher'
              ? "You are not class teacher of any section this year. Parents and their codes are managed by each section's class teacher."
              : 'No sections this year.'}
          </Text>
        ) : null}
      </View>

      {sectionId ? (
        <CrudListScreen
          embedded
          loadKey={loadKey}
          load={async () => {
            const res = await staffApi.get(`${base}?sectionId=${sectionId}`);
            setSheet((s) => ({ ...res, stamp: s?.stamp || 0 }));
            return res;
          }}
          pick={(res) => res?.rows || []}
          itemKey={(row) => row.studentId}
          emptyTitle="No students"
          emptyMessage="This section has no students yet."
          header={() => (
            <View style={styles.toolbar}>
              <Text style={styles.note}>
                Hand a code to a parent or student. A parent enters theirs to see their child, and both parents can use the
                same code. A student code connects the student to the school&apos;s record, and works once. A code already handed
                out is never changed by Make all.
              </Text>
              <ToolButton palette={palette} disabled={busy} label={busy ? 'Working…' : 'Make all codes for this section'} onPress={() => make([PARENT, STUDENT])} main />
              <View style={styles.row}>
                <ToolButton palette={palette} disabled={busy} label="Only parent codes" onPress={() => make([PARENT])} />
                <ToolButton palette={palette} disabled={busy} label="Only student codes" onPress={() => make([STUDENT])} />
              </View>
              <View style={styles.row}>
                <ToolButton palette={palette} disabled={!parentSlips} label={`Print parent slips (${parentSlips})`} onPress={() => printSlips(PARENT)} />
                <ToolButton palette={palette} disabled={!studentSlips} label={`Print student slips (${studentSlips})`} onPress={() => printSlips(STUDENT)} />
              </View>
              {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            </View>
          )}
          describe={(row) => ({
            title: row.studentName,
            subtitle: row.rollNumber ? `Roll ${row.rollNumber}` : 'No roll number',
            meta: [
              ['Parent code', row.parentCode || '—'],
              ['Student code', row.studentCodeAllowed ? row.studentCode || '—' : 'Own account, no school record'],
              [
                'Parents linked',
                (row.parents || []).length
                  ? row.parents.map((p) => `${p.fullName}${p.verified ? '' : ' (not verified)'}`).join(', ')
                  : 'None yet',
              ],
            ],
          })}
          actions={[
            ...codeActions(PARENT, 'parent', 'parentCode'),
            ...codeActions(STUDENT, 'student', 'studentCode'),
            {
              key: 'unlink',
              label: 'Unlink a parent',
              icon: 'person-remove-outline',
              when: (row) => (row.parents || []).length > 0,
              fieldsFor: (row) => [
                {
                  key: 'parentId',
                  label: 'Parent',
                  type: 'select',
                  required: true,
                  options: row.parents.map((p) => ({ value: String(p.parentId), label: p.fullName })),
                  helper: 'They will no longer see this child. Their account stays, and they can link again with a code.',
                },
              ],
              run: (row, v) => staffApi.del(`${base}/${row.studentId}/parents/${v.parentId}?sectionId=${sectionId}`),
              done: 'Parent unlinked.',
            },
          ]}
        />
      ) : null}
    </View>
  );
}

function ToolButton({ label, onPress, disabled, main, palette }) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.tool,
        main ? { backgroundColor: palette.primary, borderColor: palette.primary } : { borderColor: palette.primary },
        (pressed || disabled) && styles.dim,
      ]}
      accessibilityRole="button"
    >
      <Text style={[styles.toolText, { color: main ? '#ffffff' : palette.primary }]}>{label}</Text>
    </Pressable>
  );
}

export default function ParentManagementScreen({ mode = 'admin', homeRoute }) {
  const config = MODES[mode] || MODES.admin;
  return (
    <ParentTabsScreen
      title="Parent Management"
      fallbackRoute={homeRoute}
      tabs={[
        { value: 'requests', label: 'Waiting for verification', render: () => <Requests config={config} /> },
        { value: 'codes', label: 'Codes and linked parents', render: () => <Codes config={config} mode={mode} /> },
      ]}
    />
  );
}

const plain = { note: { fontSize: TYPE.label, color: SLATE[600], lineHeight: leading(TYPE.label), marginBottom: SPACING.sm } };

const useStyles = makeStyles(() => ({
  flex: { flex: 1 },
  pickers: { gap: SPACING.sm, marginBottom: SPACING.sm },
  note: { fontSize: TYPE.label, color: SLATE[600], lineHeight: leading(TYPE.label) },
  notice: { fontSize: TYPE.label, color: SLATE[700], fontWeight: '700' },
  toolbar: { gap: SPACING.sm, marginBottom: SPACING.md },
  row: { flexDirection: 'row', gap: SPACING.sm },
  tool: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: SPACING.sm,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolText: { fontSize: TYPE.label, fontWeight: '700', textAlign: 'center' },
  dim: { opacity: 0.6 },
}));
