import { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SLATE, SPACING } from '../../constants/theme';
import { usePalette } from './PaletteContext';
import useStaffResource from '../../hooks/useStaffResource';
import { fetchLiveSchools } from '../../services/teacher/liveSessionService';
import Select from './Select';

/**
 * School → Class chip bar, for every screen in the Shreyartha (SHREYA01) hierarchy.
 *
 * NOT a variant of ScopePicker, and deliberately so. ScopePicker is academic-year-driven by
 * construction — it fetches `/api/school/academic-years` and gates its class list on
 * `value.academicYearId`. The SHREYA01 endpoints take no year at all, so bolting a second mode
 * onto a component that already carries three class-tree loaders would make both harder to reason
 * about. This is the smaller, separate thing.
 *
 * Every SHREYA01 scope endpoint returns the same shape, which is why one picker serves them all:
 *
 *   [{ schoolId, schoolName, schoolCode, classes: [{ classId, className }] }]
 *
 *   /api/shreya01/schools                        Live Classes (teacher, Portal-A counsellor)
 *   /api/shreya01/counsellor/schools-classes     everything in the Shreyartha counsellor portal
 *
 * THERE IS NO SECTION TIER anywhere in this hierarchy — not "usually absent", never present. The
 * web's section selectors in these screens read a key that is never returned and are dead code.
 */

export const EMPTY_SCHOOL_SCOPE = {
  schoolId: null,
  schoolName: '',
  schoolCode: '',
  classId: null,
  className: '',
  // Only populated when `includeSubject` is set. `sectionId` is the SHREYA01 *virtual* section the
  // subject hangs off — this hierarchy still has no section the user ever picks, but the homework
  // and topic-completion endpoints need the id, so it rides along with the subject.
  subjectId: null,
  subjectName: '',
  sectionId: null,
  academicIqSubjectId: null,
};

export default function SchoolClassPicker({
  endpoint,
  value = EMPTY_SCHOOL_SCOPE,
  onChange,
  palette: paletteProp,
  style,
  children,
  // Adds a third chip fed by `class.subjects[]`. Only the HOMEWORK scope tree carries subjects —
  // the attendance, counselling and groups trees return classes alone, so leaving this off is the
  // right default and turning it on elsewhere would render a permanently empty chip.
  includeSubject = false,
}) {
  const contextPalette = usePalette();
  // Explicit prop wins; otherwise the surrounding portal palette (teal by default).
  const palette = paletteProp || contextPalette;
  // Held in a ref so the auto-select effect below doesn't re-run every time the parent hands us a
  // freshly-created callback — the same guard ScopePicker needs.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const fetcher = useCallback((signal) => fetchLiveSchools(signal, endpoint), [endpoint]);
  const { data: schools, loading, error } = useStaffResource(fetcher, { initialData: [] });

  const schoolList = schools || [];
  const school = schoolList.find((s) => s.schoolId === value.schoolId) || null;
  const classList = school?.classes || [];
  const klass = classList.find((c) => c.classId === value.classId) || null;
  const subjectList = includeSubject ? klass?.subjects || [] : [];

  // Auto-select the first school and class once they load. Unlike ScopePicker — which refuses to
  // pick for you when several options exist, because marking the wrong class is destructive —
  // these portals genuinely default to the first entry on the web too, and a counsellor with one
  // linked school would otherwise face an empty screen.
  useEffect(() => {
    if (loading || schoolList.length === 0) return;
    if (value.schoolId && classList.length > 0 && value.classId) return;

    const nextSchool = school || schoolList[0];
    const nextClass = (nextSchool.classes || [])[0] || null;
    if (nextSchool.schoolId === value.schoolId && nextClass?.classId === value.classId) return;

    onChangeRef.current?.({
      ...EMPTY_SCHOOL_SCOPE,
      schoolId: nextSchool.schoolId,
      schoolName: nextSchool.schoolName || '',
      schoolCode: nextSchool.schoolCode || '',
      classId: nextClass?.classId ?? null,
      className: nextClass?.className || '',
      ...(includeSubject
        ? {
            subjectId: (nextClass?.subjects || [])[0]?.subjectId ?? (nextClass?.subjects || [])[0]?.id ?? null,
            subjectName: (nextClass?.subjects || [])[0]?.subjectName || (nextClass?.subjects || [])[0]?.name || '',
            sectionId: (nextClass?.subjects || [])[0]?.sectionId ?? null,
            academicIqSubjectId: (nextClass?.subjects || [])[0]?.academicIqSubjectId ?? null,
          }
        : null),
    });
    // Keyed on primitives only; `schools` is a fresh array each fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, schoolList.length, value.schoolId, value.classId]);

  /** Flatten one `class.subjects[]` row into the scope. Kept in one place — the homework upload,
   *  the curriculum fetch and the topic-completion calls each need a different id off it. */
  const subjectFields = (sub) => ({
    subjectId: sub?.subjectId ?? sub?.id ?? null,
    subjectName: sub?.subjectName || sub?.name || '',
    sectionId: sub?.sectionId ?? null,
    academicIqSubjectId: sub?.academicIqSubjectId ?? null,
  });

  const pickSchool = (schoolId) => {
    const next = schoolList.find((s) => s.schoolId === schoolId);
    if (!next) return;
    const firstClass = (next.classes || [])[0] || null;
    onChange?.({
      ...value,
      schoolId: next.schoolId,
      schoolName: next.schoolName || '',
      schoolCode: next.schoolCode || '',
      classId: firstClass?.classId ?? null,
      className: firstClass?.className || '',
      // A subject id belongs to one class; carrying it across would query the wrong class.
      ...(includeSubject ? subjectFields((firstClass?.subjects || [])[0]) : null),
    });
  };

  const pickClass = (classId) => {
    const next = classList.find((c) => c.classId === classId);
    onChange?.({
      ...value,
      classId: next?.classId ?? null,
      className: next?.className || '',
      ...(includeSubject ? subjectFields((next?.subjects || [])[0]) : null),
    });
  };

  const pickSubject = (subjectId) => {
    const next = subjectList.find((sub) => (sub.subjectId ?? sub.id) === subjectId);
    onChange?.({ ...value, ...subjectFields(next) });
  };

  if (loading) {
    return (
      <View style={[styles.bar, style]}>
        <ActivityIndicator size="small" color={palette.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.bar, style]}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.bar, style]}>
      {/* A single linked school is the common case; a chip offering one choice is just noise. */}
      {schoolList.length > 1 ? (
        <Select
          variant="chip"
          label="School"
          value={value.schoolId}
          options={schoolList.map((s) => ({ value: s.schoolId, label: s.schoolName }))}
          onChange={pickSchool}
          palette={palette}
        />
      ) : null}

      <Select
        variant="chip"
        label="Class"
        placeholder={classList.length ? 'Class' : 'No classes'}
        value={value.classId}
        options={classList.map((c) => ({ value: c.classId, label: `Class ${c.className}` }))}
        onChange={pickClass}
        disabled={!value.schoolId || classList.length === 0}
        palette={palette}
      />

      {includeSubject ? (
        <Select
          variant="chip"
          label="Subject"
          placeholder={subjectList.length ? 'Subject' : 'No subjects'}
          value={value.subjectId}
          options={subjectList.map((sub) => ({
            value: sub.subjectId ?? sub.id,
            label: sub.subjectName || sub.name,
          }))}
          onChange={pickSubject}
          disabled={!value.classId || subjectList.length === 0}
          palette={palette}
        />
      ) : null}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  error: { fontSize: 12.5, color: SLATE[500] },
});
