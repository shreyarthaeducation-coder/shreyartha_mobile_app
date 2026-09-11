import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE, leading } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { Select } from '../../ui';
import { StudentCard, StudentCardTitle } from '../StudentCard';
import {
  fetchCareerPreferences,
  fetchChapters,
  fetchCurriculums,
  fetchTopics,
  saveCareerPreferences,
} from '../../../services/student/careerService';
import { fetchProfileSection } from '../../../services/student/profileService';

/**
 * Profile → Career. Three priority slots, each a Curriculum → Chapter → Topic cascade.
 *
 * **A SAVED SLOT LOCKS.** That is the web's behaviour (`lockedSlots`) and it is a contract with
 * the student, not a UI detail: once a preference is recorded it feeds their recommendations, and
 * silently allowing a re-pick here would diverge from what the website lets them do.
 *
 * The cascade endpoints live at **bare `/api`** — see the header of careerService.js.
 */

const EMPTY_SLOT = { curriculumId: '', chapterId: '', topicId: '' };

export default function CareerTab({ showToast }) {
  const styles = useStyles();
  const palette = usePalette();

  const [curriculums, setCurriculums] = useState([]);
  const [slots, setSlots] = useState([EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT]);
  const [locked, setLocked] = useState([false, false, false]);
  // Per-slot option lists, since each slot cascades independently.
  const [chapters, setChapters] = useState({});
  const [topics, setTopics] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Defined before `load`, which calls them. They only touch setState, so a stable identity is
  // not required — but the declaration order is: `load` is a useCallback created during render,
  // and reading these from its body before they initialise would be a TDZ error.
  const loadChapters = useCallback(async (index, curriculumId) => {
    try {
      // Resolve before setState — the updater is synchronous and cannot await.
      const list = await fetchChapters(curriculumId);
      setChapters((prev) => ({ ...prev, [index]: list }));
    } catch {
      setChapters((prev) => ({ ...prev, [index]: [] }));
    }
  }, []);

  const loadTopics = useCallback(async (index, chapterId) => {
    try {
      const list = await fetchTopics(chapterId);
      setTopics((prev) => ({ ...prev, [index]: list }));
    } catch {
      setTopics((prev) => ({ ...prev, [index]: [] }));
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    // Scope follows the student's own record: a college student browses a different tree.
    let scope = 'SCHOOL';
    try {
      const me = await fetchProfileSection('personal');
      if (me?.isCollegeStudent || me?.collegeName) scope = 'COLLEGE';
    } catch {
      // Default to SCHOOL — the common case.
    }

    const [listRes, prefsRes] = await Promise.allSettled([
      fetchCurriculums(scope),
      fetchCareerPreferences(),
    ]);
    if (listRes.status === 'fulfilled') setCurriculums(listRes.value);

    if (prefsRes.status === 'fulfilled') {
      const prefs = prefsRes.value || [];
      const next = [0, 1, 2].map((i) => {
        const p = prefs.find((x) => x.priority === i + 1);
        return p
          ? {
              curriculumId: String(p.curriculumId ?? ''),
              chapterId: String(p.chapterId ?? ''),
              topicId: String(p.topicId ?? ''),
            }
          : EMPTY_SLOT;
      });
      setSlots(next);
      setLocked([0, 1, 2].map((i) => !!prefs.find((x) => x.priority === i + 1)));

      // Saved slots still need their option lists so the picked names render, not bare ids.
      next.forEach((slot, i) => {
        if (slot.curriculumId) loadChapters(i, slot.curriculumId);
        if (slot.chapterId) loadTopics(i, slot.chapterId);
      });
    }
    setLoading(false);
  }, [loadChapters, loadTopics]);

  useEffect(() => {
    load();
  }, [load]);

  const pickCurriculum = (index, value) => {
    // Changing a level must clear its children, or the payload carries a chapter from another
    // curriculum and the server stores a nonsensical triple.
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...EMPTY_SLOT, curriculumId: value } : s)));
    setTopics((prev) => ({ ...prev, [index]: [] }));
    if (value) loadChapters(index, value);
  };

  const pickChapter = (index, value) => {
    setSlots((prev) =>
      prev.map((s, i) => (i === index ? { ...s, chapterId: value, topicId: '' } : s)),
    );
    if (value) loadTopics(index, value);
  };

  const pickTopic = (index, value) =>
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, topicId: value } : s)));

  const submit = async () => {
    const complete = slots.filter((s) => s.curriculumId && s.chapterId && s.topicId);
    if (complete.length === 0) {
      showToast?.('Complete at least one preference — curriculum, chapter and topic.', 'error');
      return;
    }
    setSaving(true);
    try {
      await saveCareerPreferences(slots);
      showToast?.('Preferences saved.', 'success');
      await load(); // re-read so the new locks come from the server, not a local guess
    } catch (e) {
      showToast?.(e?.message || 'Could not save your preferences.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" color={palette.primary} style={styles.loader} />;
  }

  const asOptions = (list, labelKey = 'name') =>
    (list || []).map((x) => ({ value: String(x.id), label: x[labelKey] || x.name || String(x.id) }));

  return (
    <>
      {slots.map((slot, index) => (
        <StudentCard key={index}>
          <View style={styles.head}>
            <StudentCardTitle>Preference {index + 1}</StudentCardTitle>
            {locked[index] ? (
              <View style={styles.lock}>
                <Ionicons name="lock-closed" size={11} color={palette.deep} />
                <Text style={styles.lockText}>Saved</Text>
              </View>
            ) : null}
          </View>

          <Select
            label="Curriculum"
            value={slot.curriculumId}
            options={[{ value: '', label: 'Not set' }, ...asOptions(curriculums)]}
            onChange={(v) => pickCurriculum(index, v)}
            disabled={locked[index]}
            searchable={curriculums.length > 12}
          />
          <Select
            label="Chapter"
            value={slot.chapterId}
            options={[{ value: '', label: 'Not set' }, ...asOptions(chapters[index])]}
            onChange={(v) => pickChapter(index, v)}
            disabled={locked[index] || !slot.curriculumId}
          />
          <Select
            label="Topic"
            value={slot.topicId}
            options={[{ value: '', label: 'Not set' }, ...asOptions(topics[index])]}
            onChange={(v) => pickTopic(index, v)}
            disabled={locked[index] || !slot.chapterId}
          />
        </StudentCard>
      ))}

      {locked.every(Boolean) ? (
        <Text style={styles.allLocked}>
          All three preferences are saved. Change them from the website if you need to.
        </Text>
      ) : (
        <Pressable
          onPress={submit}
          disabled={saving}
          style={({ pressed }) => [styles.save, saving && styles.saveOff, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator size="small" color={palette.onPrimary} />
          ) : (
            <Text style={styles.saveText}>Save Preferences</Text>
          )}
        </Pressable>
      )}
    </>
  );
}

const useStyles = makeStyles((p) => ({
  loader: { marginVertical: SPACING.xl },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: p.tint,
    marginBottom: SPACING.sm,
  },
  lockText: { fontSize: TYPE.micro, fontWeight: '700', color: p.deep },
  allLocked: {
    fontSize: TYPE.label,
    color: SLATE[600],
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: leading(TYPE.label),
  },
  save: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: p.primary,
    marginBottom: SPACING.lg,
  },
  saveOff: { backgroundColor: SLATE[400] },
  saveText: { fontSize: TYPE.heading, fontWeight: '700', color: p.onPrimary },
  pressed: { opacity: 0.78 },
}));
