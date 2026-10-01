import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, TYPE } from '../../../../constants/theme';
import {
  copyPaperFrom,
  copyPaperTo,
  fetchCopySources,
  fetchCopyTargets,
} from '../../../../services/teacher/examService';
import { describeCopyResult } from '../../../../utils/questionPaper';
import { LinkButton, PALETTE, styles as parts } from '../marks/marksParts';

/**
 * Reusing a paper across sections — the website's copy panel, both directions.
 *
 * "from": pull another class's paper in here (added after what is here, or replacing it).
 * "to":   push this paper out to the grade's other sections this teacher teaches — the ones without
 *         a paper are ticked already; one whose paper would be overwritten is the teacher's choice,
 *         and one with marks entered cannot be replaced at all.
 * With several sets, which sets to copy: all of them unless the teacher says otherwise.
 */
export default function CopyPanel({ mode, examId, className, questionCount, setCount, onDone, onCancel, onError }) {
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState([]);
  const [targets, setTargets] = useState([]);
  const [sourceId, setSourceId] = useState(null);
  const [targetIds, setTargetIds] = useState(new Set());
  const [sets, setSets] = useState([]); // [] = all
  const [replace, setReplace] = useState(false);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        if (mode === 'from') {
          const list = await fetchCopySources(examId);
          if (alive) setSources(list);
        } else {
          const list = await fetchCopyTargets(examId);
          if (!alive) return;
          setTargets(list);
          setTargetIds(new Set(list.filter((t) => t.questionCount === 0).map((t) => t.examId)));
        }
      } catch (e) {
        onError?.(e?.message || 'Could not load the sections.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [mode, examId, onError]);

  const available = mode === 'from' ? sources.find((s) => s.examId === sourceId)?.questionSets || 1 : setCount;

  const toggleSet = (set) =>
    setSets((prev) => (prev.includes(set) ? prev.filter((s) => s !== set) : [...prev, set].sort((a, b) => a - b)));

  const copy = async () => {
    setCopying(true);
    try {
      const res =
        mode === 'from'
          ? await copyPaperFrom(examId, { sourceExamId: sourceId, questionSets: sets, replaceExisting: replace })
          : await copyPaperTo(examId, { targetExamIds: [...targetIds], questionSets: sets, replaceExisting: replace });
      onDone(describeCopyResult(res), mode === 'from');
    } catch (e) {
      onError?.(e?.message || 'Could not copy the paper.');
    } finally {
      setCopying(false);
    }
  };

  const Row = ({ selected, onPress, title, meta, radio, blocked }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, selected && styles.rowSelected, blocked && styles.rowBlocked, pressed && styles.pressed]}
      accessibilityRole={radio ? 'radio' : 'checkbox'}
      accessibilityState={radio ? { selected } : { checked: selected }}
    >
      <Ionicons
        name={radio ? (selected ? 'radio-button-on' : 'radio-button-off') : selected ? 'checkbox' : 'square-outline'}
        size={20}
        color={selected ? PALETTE.primary : SLATE[400]}
      />
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowMeta}>{meta}</Text>
      </View>
    </Pressable>
  );

  return (
    <View>
      <View style={styles.head}>
        <Text style={styles.title}>
          {mode === 'from' ? 'Copy a paper from another class' : `Copy this paper to other sections of ${className || 'the grade'}`}
        </Text>
        <LinkButton label="Cancel" onPress={onCancel} disabled={copying} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={PALETTE.primary} style={styles.loader} />
      ) : mode === 'from' ? (
        sources.length === 0 ? (
          <Text style={styles.empty}>None of your other classes has a question paper to copy yet.</Text>
        ) : (
          sources.map((s) => (
            <Row
              key={s.examId}
              radio
              selected={s.examId === sourceId}
              onPress={() => {
                setSourceId(s.examId);
                setSets([]);
              }}
              title={`${s.className}-${s.sectionName} · ${s.subjectName}${s.sameClass && s.sameSubject ? ' · same grade & subject' : ''}`}
              meta={`${s.examName} (${s.examCode}) · ${s.questionCount} question${s.questionCount !== 1 ? 's' : ''} · ${s.totalMarks} marks${s.questionSets > 1 ? ` · ${s.questionSets} sets` : ''}`}
            />
          ))
        )
      ) : targets.length === 0 ? (
        <Text style={styles.empty}>
          You do not teach this subject in any other section of {className || 'this grade'} for this exam, so there is
          nowhere to copy it to.
        </Text>
      ) : (
        targets.map((t) => (
          <Row
            key={t.examId}
            selected={targetIds.has(t.examId)}
            blocked={t.hasEnteredMarks && replace}
            onPress={() =>
              setTargetIds((prev) => {
                const next = new Set(prev);
                if (next.has(t.examId)) next.delete(t.examId);
                else next.add(t.examId);
                return next;
              })
            }
            title={`${t.className}-${t.sectionName} · ${t.subjectName}`}
            meta={`${t.examName} (${t.examCode}) · ${
              t.questionCount === 0 ? 'no questions yet' : `already has ${t.questionCount} question${t.questionCount !== 1 ? 's' : ''}`
            }${t.hasEnteredMarks ? ' · marks already entered' : ''}`}
          />
        ))
      )}

      {!loading && available > 1 ? (
        <>
          <Text style={styles.label}>Which sets to copy</Text>
          <View style={parts.chips}>
            {Array.from({ length: available }, (_, i) => i + 1).map((set) => {
              const on = sets.includes(set);
              return (
                <Pressable
                  key={set}
                  onPress={() => toggleSet(set)}
                  style={({ pressed }) => [
                    parts.chip,
                    on && { backgroundColor: PALETTE.tint, borderColor: PALETTE.primary },
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                >
                  <Text style={[parts.chipText, on && { color: PALETTE.primaryDark }]}>Set {set}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>
            {sets.length === 0
              ? `All ${available} sets.`
              : `Chosen: ${sets.map((s) => `Set ${s}`).join(', ')} — they become Set ${sets.map((_, i) => i + 1).join(', ')} ${mode === 'from' ? 'here' : 'there'}.`}
          </Text>
          {sets.length ? <LinkButton label="Copy all sets instead" onPress={() => setSets([])} /> : null}
        </>
      ) : null}

      {!loading && (mode === 'to' || questionCount > 0) && (mode === 'to' ? targets.length > 0 : sources.length > 0) ? (
        <Pressable
          onPress={() => setReplace((r) => !r)}
          style={({ pressed }) => [styles.replace, pressed && styles.pressed]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: replace }}
        >
          <Ionicons name={replace ? 'checkbox' : 'square-outline'} size={20} color={replace ? PALETTE.primary : SLATE[400]} />
          <Text style={styles.replaceText}>
            {mode === 'from'
              ? `Replace the ${questionCount} question${questionCount !== 1 ? 's' : ''} already here (otherwise the copied ones are added after them)`
              : "Replace a section's existing paper instead of skipping it"}
          </Text>
        </Pressable>
      ) : null}
      {mode === 'to' && replace && targets.some((t) => t.hasEnteredMarks) ? (
        <Text style={styles.error}>
          A section that already has marks entered cannot have its paper replaced. Untick it, or copy without replacing.
        </Text>
      ) : null}

      {!loading && (mode === 'from' ? sources.length > 0 : targets.length > 0) ? (
        <View style={styles.actions}>
          <LinkButton
            icon="copy-outline"
            label={
              copying
                ? 'Copying…'
                : mode === 'from'
                  ? 'Copy this paper here'
                  : `Copy to ${targetIds.size} section${targetIds.size !== 1 ? 's' : ''}`
            }
            onPress={copy}
            disabled={copying || (mode === 'from' ? sourceId == null : targetIds.size === 0)}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { flex: 1, fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },
  loader: { marginVertical: 24 },
  empty: { fontSize: TYPE.body, color: SLATE[500], paddingVertical: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SLATE[200],
    marginBottom: 6,
    backgroundColor: '#ffffff',
  },
  rowSelected: { borderColor: PALETTE.primary, backgroundColor: PALETTE.tint },
  rowBlocked: { borderColor: FEEDBACK.errorText },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },
  rowMeta: { fontSize: TYPE.label, color: SLATE[500], marginTop: 2 },
  label: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[700], marginTop: 10 },
  hint: { fontSize: TYPE.label, color: SLATE[500], marginVertical: 4 },
  replace: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  replaceText: { flex: 1, fontSize: TYPE.label, color: SLATE[700] },
  error: { fontSize: TYPE.label, color: FEEDBACK.errorText, marginTop: 6, fontWeight: '600' },
  actions: { marginTop: 12 },
  pressed: { opacity: 0.72 },
});
