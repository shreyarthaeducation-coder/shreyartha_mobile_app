import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SLATE, SPACING } from '../../constants/theme';
import { usePalette } from './PaletteContext';
import Select from './Select';
import useStaffResource from '../../hooks/useStaffResource';
import { defaultAcademicYear, fetchAcademicYears } from '../../services/teacher/scopeService';

/**
 * Academic Year → Class → Section → (Subject) chip bar. The opening move of most Portal A teacher
 * screens.
 *
 * Replaces the web's `AcademicYearPicker` plus the rows of class/section/subject buttons that every
 * teacher page re-implements (TeacherAttendance, TeacherGroups, AssignHomework, TeacherReports…).
 *
 * PORTAL A ONLY. Portal B (`shreyartha_teacher`) is a different cascade — School → Class, keyed by
 * numeric ids, no sections, no academic year — and needs its own component or a `mode` prop.
 *
 * `loadClasses(academicYearId, signal)` must resolve to
 * `[{ classId, className, sections: [{ sectionId, sectionName,
 *     subjects?: [{ subjectId, subjectName, academicIqSubjectId? }] }] }]`.
 *
 * It is a function rather than an endpoint string because the tree has two genuinely different
 * sources: most features have a `…/classes` endpoint, but anything needing `academicIqSubjectId`
 * (the curriculum link) has to build the tree from `/api/teacher/profile` instead — that is the
 * only response carrying it alongside the academic year. `services/teacher/scopeService.js` ships
 * both loaders; callers pick one.
 *
 * NOTE none of the ids are what you send back. The teacher APIs key off `className`,
 * `sectionName` and `subjectName` **strings**; the ids exist for list keys and this picker only.
 * The exception is `academicIqSubjectId`, which IS a path param — on
 * `/api/teacher/academic/subjects/{academicIqSubjectId}/chapters` — and is a different id space
 * from `subjectId`. Don't swap them.
 *
 * Props:
 *   loadClasses         — see above
 *   value               — { academicYearId, classId, className, sectionId, sectionName,
 *                           subjectId, subjectName, academicIqSubjectId }
 *   onChange            — receives a complete replacement scope; the picker never emits a partial
 *   requireSection      — false for features that work at class level
 *   includeSubject      — show the subject chip, sourced from the selected section's `subjects`
 *   subjectExtraOptions — extra entries prepended to the subject list, e.g. Create Group's
 *                         "All Subjects". Kept generic: the picker doesn't know what they mean,
 *                         it just passes the chosen value back as `subjectId`/`subjectName`.
 */

export const EMPTY_SCOPE = {
  academicYearId: null,
  classId: null,
  className: '',
  sectionId: null,
  sectionName: '',
  subjectId: null,
  subjectName: '',
  academicIqSubjectId: null,
};

export default function ScopePicker({
  loadClasses,
  value = EMPTY_SCOPE,
  onChange,
  requireSection = true,
  includeSubject = false,
  subjectExtraOptions,
  palette: paletteProp,
  style,
}) {
  const contextPalette = usePalette();
  // Explicit prop wins; otherwise the surrounding portal palette (teal by default).
  const palette = paletteProp || contextPalette;
  // Held in a ref so the auto-select effects below don't re-run every time the parent hands us a
  // freshly-created callback.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const yearsFetcher = useCallback((signal) => fetchAcademicYears(signal), []);
  const { data: years, loading: yearsLoading, error: yearsError } = useStaffResource(yearsFetcher, {
    initialData: [],
  });

  // `loadClasses` must be a stable reference from the caller (module const or useCallback) —
  // useStaffResource keys its effect on the fetcher identity.
  const classesFetcher = useCallback(
    (signal) => loadClasses(value.academicYearId, signal),
    [loadClasses, value.academicYearId],
  );
  const { data: classes, loading: classesLoading, error: classesError } = useStaffResource(
    classesFetcher,
    { enabled: !!value.academicYearId, initialData: [] },
  );

  const yearList = years || [];
  const classList = classes || [];

  const selectedClass = useMemo(
    () => classList.find((cls) => cls.classId === value.classId) || null,
    [classList, value.classId],
  );
  const sectionList = selectedClass?.sections || [];

  const selectedSection = useMemo(
    () => sectionList.find((section) => section.sectionId === value.sectionId) || null,
    [sectionList, value.sectionId],
  );

  // Subjects hang off the SECTION, not the class. SHREYARTHA_TEACHER always gets an empty array
  // from the backend, so an empty subject list is a legitimate state, not an error.
  //
  // Extras are offered only when there is more than one real subject: an option that means
  // "all of them" is noise when there is exactly one, which is also the web's rule
  // (TeacherGroups.js gates its "All Subjects" button on `availableSubjects.length > 1`).
  const subjectList = useMemo(() => {
    const fromSection = selectedSection?.subjects || [];
    const extras = fromSection.length > 1 ? subjectExtraOptions || [] : [];
    return [...extras, ...fromSection];
  }, [selectedSection, subjectExtraOptions]);

  // Land on the school's current year, exactly as AcademicYearPicker does on the web.
  useEffect(() => {
    if (value.academicYearId || yearList.length === 0) return;
    const preferred = defaultAcademicYear(yearList);
    if (preferred) onChangeRef.current({ ...EMPTY_SCOPE, academicYearId: preferred.id });
  }, [yearList, value.academicYearId]);

  // Auto-select ONLY when there is a single option — a teacher with one class shouldn't have to
  // tap. With several, picking one for them risks marking the wrong class, so we don't.
  useEffect(() => {
    if (value.classId || classList.length !== 1) return;
    const only = classList[0];
    onChangeRef.current({
      ...EMPTY_SCOPE,
      academicYearId: value.academicYearId,
      classId: only.classId,
      className: only.className,
    });
  }, [classList, value.classId, value.academicYearId]);

  // Depends on the individual fields, not on `value` — the parent hands us a new object every
  // render, and spreading it here would make the effect fire on every one of them.
  useEffect(() => {
    if (value.sectionId || !selectedClass || sectionList.length !== 1) return;
    const only = sectionList[0];
    onChangeRef.current({
      academicYearId: value.academicYearId,
      classId: selectedClass.classId,
      className: selectedClass.className,
      sectionId: only.sectionId,
      sectionName: only.sectionName,
    });
  }, [sectionList, selectedClass, value.sectionId, value.academicYearId]);

  // Same one-option rule for subjects. Extras (like "All Subjects") are excluded from the count —
  // auto-picking a pseudo-option would be a surprise, and it only appears when there are ≥2 real
  // subjects anyway.
  useEffect(() => {
    if (!includeSubject || value.subjectId || !selectedSection) return;
    const real = selectedSection.subjects || [];
    if (real.length !== 1) return;
    const only = real[0];
    onChangeRef.current({
      academicYearId: value.academicYearId,
      classId: selectedClass?.classId ?? null,
      className: selectedClass?.className || '',
      sectionId: selectedSection.sectionId,
      sectionName: selectedSection.sectionName,
      subjectId: only.subjectId,
      subjectName: only.subjectName,
      academicIqSubjectId: only.academicIqSubjectId ?? null,
    });
  }, [includeSubject, selectedSection, selectedClass, value.subjectId, value.academicYearId]);

  const pickYear = (academicYearId) => onChangeRef.current({ ...EMPTY_SCOPE, academicYearId });

  const pickClass = (classId) => {
    const cls = classList.find((c) => c.classId === classId);
    onChangeRef.current({
      ...EMPTY_SCOPE,
      academicYearId: value.academicYearId,
      classId,
      className: cls?.className || '',
    });
  };

  const pickSection = (sectionId) => {
    const section = sectionList.find((s) => s.sectionId === sectionId);
    onChangeRef.current({
      ...value,
      sectionId,
      sectionName: section?.sectionName || '',
      // Subjects belong to a section, so changing section invalidates the choice.
      subjectId: null,
      subjectName: '',
      academicIqSubjectId: null,
    });
  };

  const pickSubject = (subjectId) => {
    const subject = subjectList.find((s) => s.subjectId === subjectId);
    onChangeRef.current({
      ...value,
      subjectId,
      subjectName: subject?.subjectName || '',
      // Null for pseudo-options like "All Subjects", and for subjects the school admin never
      // linked to curriculum content. Consumers must handle both.
      academicIqSubjectId: subject?.academicIqSubjectId ?? null,
    });
  };

  const error = yearsError || classesError;

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.row}>
        <Select
          variant="chip"
          label="Academic Year"
          placeholder={yearsLoading ? 'Loading…' : 'Academic Year'}
          value={value.academicYearId}
          options={yearList.map((year) => ({
            value: year.id,
            label: year.current ? `${year.yearLabel} (Current)` : year.yearLabel,
          }))}
          onChange={pickYear}
          palette={palette}
        />

        <Select
          variant="chip"
          label="Class"
          placeholder={classesLoading ? 'Loading…' : 'Class'}
          value={value.classId}
          options={classList.map((cls) => ({
            value: cls.classId,
            label: `Class ${cls.className}`,
          }))}
          onChange={pickClass}
          disabled={!value.academicYearId}
          palette={palette}
        />

        {requireSection ? (
          <Select
            variant="chip"
            label="Section"
            placeholder="Section"
            value={value.sectionId}
            options={sectionList.map((section) => ({
              value: section.sectionId,
              label: `Section ${section.sectionName}`,
            }))}
            onChange={pickSection}
            disabled={!selectedClass}
            palette={palette}
          />
        ) : null}

        {includeSubject ? (
          <Select
            variant="chip"
            label="Subject"
            placeholder="Subject"
            value={value.subjectId}
            options={subjectList.map((subject) => ({
              value: subject.subjectId,
              label: subject.subjectName,
            }))}
            onChange={pickSubject}
            disabled={!selectedSection}
            palette={palette}
          />
        ) : null}

        {yearsLoading || classesLoading ? (
          <ActivityIndicator size="small" color={palette.primary} style={styles.spinner} />
        ) : null}
      </View>

      {error ? (
        <Text style={styles.hint}>{error}</Text>
      ) : value.academicYearId && !classesLoading && classList.length === 0 ? (
        <Text style={styles.hint}>No classes assigned for this academic year.</Text>
      ) : includeSubject && selectedSection && (selectedSection.subjects || []).length === 0 ? (
        <Text style={styles.hint}>No subjects available for this section.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACING.sm },
  spinner: { marginLeft: 2 },
  hint: { fontSize: 12.5, color: SLATE[500], paddingHorizontal: 2 },
});
