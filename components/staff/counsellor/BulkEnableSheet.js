import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TYPE, leading } from '../../../constants/theme';
import { usePalette } from '../../../components/ui/PaletteContext';
import { FormSheet } from '../../ui';
import {
  applyBulkEnable,
  fetchBulkEnableOptions,
  previewBulkEnable,
} from '../../../services/counsellor/psychometricService';
import {
  defaultTicks,
  describeSection,
  headline,
  openCount,
  plural,
  studentsIn,
  topicIdsOf,
} from '../../../utils/psychometricBulkEnable';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * "Psychometric tests for Class 7" — open or close tests for whole sections at once (10 Oct 2026).
 * The app's twin of the website's `School/shared/PsychometricBulkEnable`.
 *
 * Sets EXACTLY the ticked tests for every student of the chosen sections: ticked open, unticked
 * closed. Apply waits for a preview of what will change. The per-student "Enable Psychometric"
 * sheet stays for exceptions.
 */
export default function BulkEnableSheet({ visible, classId, initialSectionId, onClose, showToast }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const [options, setOptions] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [setId, setSetId] = useState(null);
  const [chosen, setChosen] = useState([]);
  const [ticked, setTicked] = useState(new Set());
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);

  // The parent passes an inline showToast; a ref keeps the effects keyed on ids alone.
  const toastRef = useRef(showToast);
  toastRef.current = showToast;

  const load = async (signal) => {
    const res = await fetchBulkEnableOptions(classId, signal);
    setOptions(res);
    return res;
  };

  // Each opening starts afresh: the section on screen (or every section), the only test set if
  // there is one, and ticks on what is already open for everyone.
  useEffect(() => {
    if (!visible || !classId) return undefined;
    const controller = new AbortController();
    setOptions(null);
    setLoadError('');
    setPreview(null);
    load(controller.signal)
      .then((res) => {
        const ids = (res?.sections || []).map((s) => s.sectionId);
        const first = ids.includes(initialSectionId) ? [initialSectionId] : ids;
        setChosen(first);
        const only = res?.testSets?.length === 1 ? res.testSets[0] : null;
        setSetId(only ? only.psychometricClassId : null);
        setTicked(only ? defaultTicks(only, res.sections, first) : new Set());
      })
      .catch((e) => {
        if (!controller.signal.aborted) setLoadError(e?.message || "Could not load this class's tests.");
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, classId, initialSectionId]);

  const testSet = useMemo(
    () => (options?.testSets || []).find((s) => s.psychometricClassId === setId) || null,
    [options, setId],
  );
  const allIds = useMemo(() => topicIdsOf(testSet), [testSet]);
  const students = studentsIn(options?.sections, chosen);

  const body = useMemo(
    () => (visible && testSet && chosen.length > 0
      ? { sectionIds: chosen, psychometricClassId: setId, openTopicIds: allIds.filter((id) => ticked.has(id)) }
      : null),
    [visible, testSet, chosen, setId, allIds, ticked],
  );

  // A fresh preview whenever the choice changes; Apply waits for it.
  useEffect(() => {
    setPreview(null);
    setPreviewError('');
    if (!body) return undefined;
    const controller = new AbortController();
    setPreviewing(true);
    const timer = setTimeout(() => {
      previewBulkEnable(body, controller.signal)
        .then((res) => setPreview(res))
        .catch((e) => {
          if (!controller.signal.aborted) setPreviewError(e?.message || 'Could not work out what would change.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setPreviewing(false);
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [body]);

  const toggleTopic = (id) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSection = (id) =>
    setChosen((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const chooseSet = (id) => {
    setSetId(id);
    const next = (options?.testSets || []).find((s) => s.psychometricClassId === id);
    setTicked(defaultTicks(next, options?.sections, chosen));
  };

  const changes = preview ? preview.sections.reduce((n, s) => n + s.studentsChanged, 0) : 0;

  const apply = async () => {
    if (!body || !preview || changes === 0) return;
    setApplying(true);
    try {
      const res = await applyBulkEnable(body);
      const changed = (res?.sections || []).reduce((n, s) => n + s.studentsChanged, 0);
      toastRef.current?.(`Saved — tests changed for ${plural(changed, 'student')}.`, 'success');
      onClose();
    } catch (e) {
      setPreviewError(e?.message || 'The tests could not be saved.');
    } finally {
      setApplying(false);
    }
  };

  const Check = ({ on, round }) => (
    <Ionicons
      name={on ? (round ? 'radio-button-on' : 'checkbox') : round ? 'radio-button-off' : 'square-outline'}
      size={22}
      color={on ? PALETTE.primary : SLATE[400]}
    />
  );

  return (
    <FormSheet
      visible={visible}
      title={options ? `Psychometric tests — Class ${options.className}` : 'Psychometric tests'}
      subtitle="Ticked open, unticked closed"
      onClose={onClose}
      onSubmit={apply}
      submitting={applying}
      submitDisabled={!preview || changes === 0}
      submitLabel={preview && changes === 0 ? 'Nothing to change' : `Apply to ${plural(students, 'student')}`}
      fullHeight
    >
      <Text style={styles.intro}>
        Ticked tests will be open and unticked tests closed for every student of the sections you choose. For
        one student, use “Enable Psychometric” on their row instead.
      </Text>

      {loadError ? <Text style={styles.error} accessibilityRole="alert">{loadError}</Text> : null}
      {!options && !loadError ? <ActivityIndicator color={PALETTE.primary} style={styles.loader} /> : null}

      {options ? (
        <>
          <Text style={styles.groupTitle}>Sections</Text>
          <View style={styles.chips}>
            {options.sections.map((s) => {
              const on = chosen.includes(s.sectionId);
              return (
                <Pressable
                  key={s.sectionId}
                  onPress={() => toggleSection(s.sectionId)}
                  style={[styles.chip, on && { borderColor: PALETTE.primary, backgroundColor: PALETTE.tint }]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`Section ${s.sectionName}, ${plural(s.students, 'student')}`}
                >
                  <Check on={on} />
                  <Text style={styles.chipText}>
                    {s.sectionName} · {s.students}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {chosen.length === 0 ? <Text style={styles.muted}>Choose at least one section.</Text> : null}

          {options.testSets.length === 0 ? (
            <Text style={styles.error}>There are no psychometric tests for Class {options.className} yet.</Text>
          ) : null}

          {options.testSets.length > 1 ? (
            <>
              <Text style={styles.groupTitle}>Which tests? This class has more than one set</Text>
              {options.testSets.map((s) => {
                const on = setId === s.psychometricClassId;
                return (
                  <Pressable
                    key={s.psychometricClassId}
                    onPress={() => chooseSet(s.psychometricClassId)}
                    style={styles.row}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                  >
                    <Check on={on} round />
                    <Text style={styles.rowText}>{s.psychometricClassName}</Text>
                  </Pressable>
                );
              })}
            </>
          ) : null}

          {testSet ? (
            <>
              <View style={styles.testsHeader}>
                <Text style={styles.groupTitle}>
                  Tests ({ticked.size} of {allIds.length} ticked)
                </Text>
                <Pressable onPress={() => setTicked(new Set(allIds))} hitSlop={6} accessibilityRole="button">
                  <Text style={[styles.link, { color: PALETTE.primaryDark }]}>Tick all</Text>
                </Pressable>
                <Pressable onPress={() => setTicked(new Set())} hitSlop={6} accessibilityRole="button">
                  <Text style={[styles.link, { color: PALETTE.primaryDark }]}>Untick all</Text>
                </Pressable>
              </View>
              {testSet.chapters.map((chapter) => (
                <View key={chapter.chapterId ?? chapter.chapterName} style={styles.chapter}>
                  <Text style={styles.chapterName}>{chapter.chapterName}</Text>
                  {chapter.topics.map((t) => {
                    const on = ticked.has(t.topicId);
                    return (
                      <Pressable
                        key={t.topicId}
                        onPress={() => toggleTopic(t.topicId)}
                        style={styles.row}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={t.topicName}
                      >
                        <Check on={on} />
                        <View style={styles.rowTextWrap}>
                          <Text style={styles.rowText}>{t.topicName}</Text>
                          {chosen.length > 0 ? (
                            <Text style={styles.muted}>
                              open now for {openCount(options.sections, chosen, t.topicId)} of {students}
                            </Text>
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </>
          ) : null}

          {body ? (
            <View style={styles.preview} accessibilityLiveRegion="polite">
              {previewing ? <Text style={styles.muted}>Working out what will change…</Text> : null}
              {preview ? (
                <>
                  <Text style={styles.headline}>{headline(preview)}</Text>
                  {preview.sections.map((s) => (
                    <Text key={s.sectionId} style={styles.previewLine}>
                      • {describeSection(s)}
                    </Text>
                  ))}
                </>
              ) : null}
            </View>
          ) : null}
          {previewError ? <Text style={styles.error} accessibilityRole="alert">{previewError}</Text> : null}
        </>
      ) : null}
    </FormSheet>
  );
}

const useStyles = makeStyles(() => ({
  intro: { fontSize: TYPE.label, color: SLATE[600], lineHeight: leading(TYPE.label), marginBottom: SPACING.md },
  loader: { marginVertical: SPACING.lg },
  groupTitle: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[700], marginTop: SPACING.sm, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SLATE[300],
  },
  chipText: { fontSize: TYPE.label, color: SLATE[800], fontWeight: '600' },
  testsHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginTop: SPACING.sm },
  link: { fontSize: TYPE.label, fontWeight: '700' },
  chapter: { marginTop: SPACING.sm },
  chapterName: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[500] },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 8 },
  rowTextWrap: { flex: 1 },
  rowText: { fontSize: TYPE.body, color: SLATE[800] },
  muted: { fontSize: TYPE.caption, color: SLATE[500] },
  preview: { backgroundColor: SLATE[50], borderRadius: 10, padding: SPACING.md, marginTop: SPACING.md },
  headline: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[800], marginBottom: 4 },
  previewLine: { fontSize: TYPE.label, color: SLATE[700], lineHeight: leading(TYPE.label), marginTop: 2 },
  error: { fontSize: TYPE.label, color: FEEDBACK.errorText, backgroundColor: FEEDBACK.errorBg, borderRadius: 8, padding: SPACING.sm, marginTop: SPACING.sm },
}));
